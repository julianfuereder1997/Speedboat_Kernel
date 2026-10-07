import { z } from "zod";
import { packMismatch } from "./apply-patch.js";
import { overlaps } from "./pointer.js";
import { commit, nowOf, reject, type Applied, type Options, type Rejected } from "./result.js";
import { Actor, Id } from "./schemas/common.js";
import type { CaseState, Decision } from "./schemas/case-state.js";
import type { Pack } from "./schemas/pack.js";
import { ValidatorOutput } from "./runs.js";

/** Rolle, die der Kern für jede Gate-Entscheidung verlangt. */
export const REVIEWER_ROLE = "reviewer";

export type FailedCheck = { block: string; reason: "not_run" | "failed" | "stale" | "not_a_validator"; run_id?: string };
export type RunViolation = { run_id: string; reason: "duplicate_run_id" | "critic_shares_generator_run_id" };
export type GateCheck = { ok: boolean; gate: string; missing: string[]; failed_checks: FailedCheck[]; violations: RunViolation[] };

/** Letzte Revision, in der ein Patch einen der Pfade (Muster mit `*`) geändert hat; 0, wenn nie. */
export function lastChangeRevision(state: CaseState, patterns: readonly string[]): number {
  let last = 0;
  for (const e of state.audit) {
    if (e.action !== "apply_patch") continue;
    if (e.paths.some((p) => patterns.some((pattern) => overlaps(pattern, p)))) last = e.revision;
  }
  return last;
}

/** Prüft ein Gate gegen das Run-Log. Rein lesend, deterministisch. */
export function gate_check(state: CaseState, pack: Pack, gateName: string): GateCheck {
  const gate = pack.gates[gateName];
  if (!gate) throw new Error(`Gate ${gateName} ist im Pack nicht definiert`);
  const contractOf = (block: string) => pack.blocks.find((b) => b.block === block);

  const violations: RunViolation[] = [];
  const seen = new Set<string>();
  for (const r of state.runs) {
    if (seen.has(r.run_id)) violations.push({ run_id: r.run_id, reason: "duplicate_run_id" });
    seen.add(r.run_id);
  }
  const generatorIds = new Set(state.runs.filter((r) => r.block_type === "generate").map((r) => r.run_id));
  for (const r of state.runs) {
    if (r.block_type === "critic" && generatorIds.has(r.run_id)) {
      violations.push({ run_id: r.run_id, reason: "critic_shares_generator_run_id" });
    }
  }

  const missing = gate.requires.filter((block) => !state.runs.some((r) => r.block === block));

  const failed_checks: FailedCheck[] = [];
  for (const block of gate.checks) {
    const contract = contractOf(block);
    if (contract?.type !== "validate") {
      failed_checks.push({ block, reason: "not_a_validator" });
      continue;
    }
    const latest = state.runs.findLast((r) => r.block === block);
    if (!latest) {
      failed_checks.push({ block, reason: "not_run" });
    } else if (latest.revision < lastChangeRevision(state, contract.input)) {
      failed_checks.push({ block, reason: "stale", run_id: latest.run_id });
    } else if (ValidatorOutput.safeParse(latest.output).data?.passed !== true) {
      failed_checks.push({ block, reason: "failed", run_id: latest.run_id });
    }
  }

  const ok = missing.length === 0 && failed_checks.length === 0 && violations.length === 0;
  return { ok, gate: gateName, missing, failed_checks, violations };
}

export const GateDecisionInput = z.object({ gate: Id, decision: Id, reason: z.string().optional() }).strict();
export type GateDecisionInput = z.infer<typeof GateDecisionInput>;

/** Trägt eine Gate-Entscheidung ein. Nur ein Mensch mit Reviewer-Rolle darf entscheiden, egal was das Pack sagt. */
export function decide_gate(state: CaseState, pack: Pack, input: GateDecisionInput, actorInput: Actor, opts?: Options): Applied | Rejected {
  const parsedActor = Actor.safeParse(actorInput);
  if (!parsedActor.success) return reject("FORBIDDEN", "ungültiger Akteur", parsedActor.error.issues);
  const actor = parsedActor.data;
  if (actor.kind !== "human") return reject("FORBIDDEN", "Gate-Entscheidungen trifft nur ein Mensch");
  if (!actor.roles.includes(REVIEWER_ROLE)) return reject("FORBIDDEN", `Gate-Entscheidungen verlangen die Rolle ${REVIEWER_ROLE}`);

  const parsed = GateDecisionInput.safeParse(input);
  if (!parsed.success) return reject("INVALID_DECISION", "Entscheidung entspricht nicht dem Schema", parsed.error.issues);
  const { gate: gateName, decision, reason } = parsed.data;

  const mismatch = packMismatch(state, pack);
  if (mismatch) return mismatch;
  const gate = pack.gates[gateName];
  if (!gate) return reject("UNKNOWN_GATE", `Gate ${gateName} ist im Pack nicht definiert`);
  if (!gate.decisions.includes(decision)) {
    return reject("INVALID_DECISION", `${decision} ist an ${gateName} nicht erlaubt`, { allowed: gate.decisions });
  }
  const check = gate_check(state, pack, gateName);
  if (!check.ok) return reject("GATE_BLOCKED", `${gateName} ist blockiert`, check);

  const at = nowOf(opts);
  const next = commit(state, actor, at, { action: "decide_gate", ref: gateName, paths: [] }, (d, revision) => {
    const entry: Decision = { gate: gateName, decision, decided_by: actor.id, at, revision };
    if (reason !== undefined) entry.reason = reason;
    d.decisions.push(entry);
  });
  return { status: "APPLIED", case: next };
}
