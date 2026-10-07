import { ModelError, type AttemptLog, type ModelAdapter, type ModelResult } from "@speedboat/adapters";
import {
  apply_patch,
  build_context,
  MODEL_BLOCK_TYPES,
  missingDependencies,
  record_run,
  type Actor,
  type CaseState,
  type StateAdapter,
} from "@speedboat/core";
import type { PackRegistry } from "./pack-loader.js";
import { build_prompt } from "./prompt.js";
import { output_to_patch } from "./writes.js";

/** Ein Job: genau ein Baustein für eine Akte, angestoßen von einem Menschen. */
export type RunJob = { run_id: string; case_id: string; block: string; requested_by: string };

export type ExecuteOutcome =
  | { status: "done"; run_id: string; revision: number; patch?: "APPLIED" | "REVIEW_REQUIRED"; change_request?: string }
  | { status: "failed"; run_id: string; code: string; message: string };

export type ExecuteDeps = { state: StateAdapter; model: ModelAdapter; attempts: AttemptLog; packs: PackRegistry; now?: () => string };
export type ExecuteOptions = { maxAttempts: number };

/** Der Versuch ist gescheitert, ein weiterer Versuch kann gelingen. Die Akte ist unverändert. */
export class RetryableRunError extends Error {
  override readonly name = "RetryableRunError";
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Rückweisungen des Kerns, die an der Modellausgabe liegen; ein neuer Versuch kann sie beheben. */
const OUTPUT_CODES = new Set(["INVALID_RUN", "SCHEMA_VIOLATION", "UNKNOWN_MARKER", "PATH_CONFLICT", "MISSING_PROVENANCE", "INVALID_PROVENANCE", "INVALID_PATCH"]);

/**
 * Führt einen Baustein einmal aus: Kontext bauen, Prompt bauen, Modell aufrufen, record_run,
 * bei generate/extract Ausgabe → Patch → apply_patch, dann genau ein Speichern mit erwarteter Revision.
 * Jeder Fehler lässt die Akte unverändert und landet im Versuchsprotokoll.
 */
export async function execute_block(deps: ExecuteDeps, job: RunJob, attempt: number, options: ExecuteOptions): Promise<ExecuteOutcome> {
  const now = deps.now ?? (() => new Date().toISOString());
  let modelInfo: { model: string; usage?: ModelResult["usage"] } | undefined;

  const log = async (code: string, message: string) => {
    await deps.attempts.record({
      run_id: job.run_id,
      case_id: job.case_id,
      block: job.block,
      attempt,
      code,
      message,
      ...(modelInfo ? { model: modelInfo.model } : {}),
      ...(modelInfo?.usage ? { input_tokens: modelInfo.usage.input_tokens, output_tokens: modelInfo.usage.output_tokens } : {}),
      at: now(),
    });
  };
  const fail = async (code: string, message: string): Promise<ExecuteOutcome> => {
    await log(code, message);
    return { status: "failed", run_id: job.run_id, code, message };
  };
  /** Wiederholen, solange die Obergrenze nicht erreicht ist; sonst endgültig. */
  const retry = async (code: string, message: string): Promise<ExecuteOutcome> => {
    if (attempt >= options.maxAttempts) return fail(code, message);
    await log(code, message);
    throw new RetryableRunError(code, message);
  };
  /** Abgelehnte Modellausgabe: genau eine Wiederholung. */
  const rejectOutput = async (message: string): Promise<ExecuteOutcome> => {
    const earlier = (await deps.attempts.list(job.run_id)).filter((e) => e.code === "OUTPUT_REJECTED").length;
    return earlier >= 1 ? fail("OUTPUT_REJECTED", message) : retry("OUTPUT_REJECTED", message);
  };

  const state = await deps.state.load(job.case_id);
  if (!state) return fail("CASE_NOT_FOUND", `Akte ${job.case_id} existiert nicht`);
  if (state.runs.some((r) => r.run_id === job.run_id)) return { status: "done", run_id: job.run_id, revision: state.revision };

  const bundle = deps.packs.get(state.pack, state.pack_version);
  if (!bundle) return fail("PACK_NOT_LOADED", `Pack ${state.pack}@${state.pack_version} ist nicht geladen`);
  const { pack } = bundle;
  const contract = pack.blocks.find((b) => b.block === job.block);
  if (!contract) return fail("UNKNOWN_BLOCK", `Baustein ${job.block} ist im Pack nicht definiert`);
  if (!MODEL_BLOCK_TYPES.includes(contract.type)) return fail("NOT_A_MODEL_BLOCK", `${job.block} ist ${contract.type}, kein Modell-Baustein`);
  const missing = missingDependencies(state, pack, job.block);
  if (missing.length > 0) return fail("DEPENDENCY_NOT_MET", `${job.block} braucht vorher: ${missing.join(", ")}`);

  const ctx = build_context(state, pack, job.block);
  if (ctx.missing.length > 0) return fail("INPUT_MISSING", `Eingaben fehlen: ${ctx.missing.join(", ")}`);

  let result: ModelResult;
  try {
    result = await deps.model.complete(build_prompt(bundle, job.block, ctx), contract.model_hint ?? "default", contract.output_schema);
  } catch (e) {
    if (!(e instanceof ModelError)) throw e;
    if (e.model !== undefined) modelInfo = e.usage ? { model: e.model, usage: e.usage } : { model: e.model };
    return e.retryable ? retry(`MODEL_${e.code}`, e.message) : fail(`MODEL_${e.code}`, e.message);
  }
  modelInfo = { model: result.model, usage: result.usage };

  const blockActor: Actor = { id: job.block, kind: "block", roles: contract.actor_roles ?? [] };
  const at = { now };
  const recorded = record_run(
    state,
    { run_id: job.run_id, block: job.block, revision: ctx.revision, input_paths: ctx.input_paths, output: result.output as never, requested_by: job.requested_by },
    blockActor,
    pack,
    at,
  );
  if (recorded.status === "REJECTED") {
    const message = `${recorded.code}: ${recorded.message}`;
    return OUTPUT_CODES.has(recorded.code) ? rejectOutput(message) : fail(recorded.code, message);
  }

  let next: CaseState = recorded.case;
  const outcome: Extract<ExecuteOutcome, { status: "done" }> = { status: "done", run_id: job.run_id, revision: 0 };
  if (contract.writes) {
    const translated = output_to_patch({ contract, output: result.output, run_id: job.run_id, case_id: job.case_id, base_revision: next.revision });
    if (!translated.ok) return rejectOutput(`INVALID_PATCH: ${translated.message}`);
    const applied = apply_patch(next, translated.patch, blockActor, pack, at);
    if (applied.status === "REJECTED") {
      const message = `${applied.code}: ${applied.message}`;
      return OUTPUT_CODES.has(applied.code) ? rejectOutput(message) : fail(applied.code, message);
    }
    next = applied.case;
    outcome.patch = applied.status;
    if (applied.status === "REVIEW_REQUIRED") outcome.change_request = applied.change_request.cr_id;
  }

  const saved = await deps.state.save(next, state.revision);
  if (!saved.ok) return saved.code === "REVISION_CONFLICT" ? retry("REVISION_CONFLICT", saved.message) : fail(`SAVE_${saved.code}`, saved.message);
  outcome.revision = next.revision;
  return outcome;
}
