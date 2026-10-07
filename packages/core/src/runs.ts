import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { packMismatch } from "./apply-patch.js";
import { checkSchema } from "./json-schema.js";
import { getAt, overlaps, parsePointer } from "./pointer.js";
import { commit, nowOf, reject, type Applied, type Options, type Rejected } from "./result.js";
import { Actor, Id, InputPath, Json } from "./schemas/common.js";
import type { CaseState, RunRecord } from "./schemas/case-state.js";
import type { Pack } from "./schemas/pack.js";

export const RunInput = z
  .object({
    run_id: Id,
    block: Id,
    /** Revision aus build_context. */
    revision: z.number().int().nonnegative(),
    input_paths: z.array(InputPath),
    output: Json,
  })
  .strict();
export type RunInput = z.infer<typeof RunInput>;

/** Pfad eines ganzen Objekts: /objects/<typ>/<id>. */
export const ObjectRef = z.string().regex(/^\/objects\/[^/*]+\/[^/*]+$/, "target muss ein ganzes Objekt sein");

/** Form, die der Kern von jeder Kritiker-Ausgabe verlangt: jeder Befund hat Marker und betroffenes Objekt. */
export const CriticOutput = z.object({ findings: z.array(z.object({ marker: Id, target: ObjectRef }).loose()) }).loose();
/** Form, die der Kern von jeder Validator-Ausgabe verlangt. */
export const ValidatorOutput = z.object({ passed: z.boolean() }).loose();

/** Trägt einen Baustein-Lauf in die Akte ein. Läufe sind append-only. */
export function record_run(state: CaseState, runInput: RunInput, actorInput: Actor, pack: Pack, opts?: Options): Applied | Rejected {
  const parsed = RunInput.safeParse(runInput);
  if (!parsed.success) return reject("INVALID_RUN", "Run entspricht nicht dem Schema", parsed.error.issues);
  const run = parsed.data;
  const parsedActor = Actor.safeParse(actorInput);
  if (!parsedActor.success) return reject("FORBIDDEN", "ungültiger Akteur", parsedActor.error.issues);
  const actor = parsedActor.data;

  const mismatch = packMismatch(state, pack);
  if (mismatch) return mismatch;

  const contract = pack.blocks.find((b) => b.block === run.block);
  if (!contract) return reject("UNKNOWN_BLOCK", `Baustein ${run.block} ist im Pack nicht definiert`);
  if (state.runs.some((r) => r.run_id === run.run_id)) {
    return reject("DUPLICATE_RUN_ID", `run_id ${run.run_id} ist bereits vergeben`);
  }
  if (run.revision > state.revision) {
    return reject("INVALID_RUN", `Run-Revision ${run.revision} liegt nach der Akte (${state.revision})`);
  }
  if (!isDeepStrictEqual(run.input_paths, contract.input)) {
    return reject("INVALID_RUN", "Eingabepfade entsprechen nicht dem Vertrag", { expected: contract.input, got: run.input_paths });
  }

  const check = checkSchema(contract.output_schema, run.output);
  if (!check.ok) return reject("SCHEMA_VIOLATION", `Ausgabe von ${run.block} verletzt output_schema`, check.errors);

  if (contract.type === "critic") {
    const out = CriticOutput.safeParse(run.output);
    if (!out.success) return reject("INVALID_RUN", "Kritiker-Ausgabe braucht findings[].marker und findings[].target", out.error.issues);
    const packMarkers = new Set(pack.markers.map((m) => m.id));
    const allowed = new Set((contract.markers ?? []).filter((m) => packMarkers.has(m)));
    const unknown = out.data.findings.map((f) => f.marker).filter((m) => !allowed.has(m));
    if (unknown.length > 0) return reject("UNKNOWN_MARKER", `unbekannte Marker: ${unknown.join(", ")}`, { unknown });
    for (const { target } of out.data.findings) {
      if (!contract.input.some((pattern) => overlaps(pattern, target))) {
        return reject("INVALID_RUN", `${target} liegt außerhalb der Eingaben von ${run.block}`, { target, input: contract.input });
      }
      if (!getAt(state, parsePointer(target)).found) return reject("INVALID_RUN", `${target} existiert nicht`, { target });
    }
  }
  if (contract.type === "validate") {
    const out = ValidatorOutput.safeParse(run.output);
    if (!out.success) return reject("INVALID_RUN", "Validator-Ausgabe braucht passed: boolean", out.error.issues);
  }

  const at = nowOf(opts);
  const record: RunRecord = {
    run_id: run.run_id,
    block: run.block,
    block_type: contract.type,
    at,
    revision: run.revision,
    input_paths: run.input_paths,
    output: run.output,
  };
  const next = commit(state, actor, at, { action: "record_run", ref: run.run_id, paths: [] }, (d) => {
    d.runs.push(record);
  });
  return { status: "APPLIED", case: next };
}
