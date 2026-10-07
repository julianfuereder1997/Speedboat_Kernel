import { missingDependencies } from "./dependencies.js";
import { gate_check, lastDecision } from "./gate.js";
import type { CaseState } from "./schemas/case-state.js";
import { assertSamePack, assertValidated, type ValidatedPack } from "./validated-pack.js";

export type AllowedGate = { gate: string; last_decision?: string };
export type AllowedSteps = { blocks: string[]; gates: AllowedGate[] };

/**
 * Was laut Pack gerade erlaubt ist: Bausteine, deren Abhängigkeiten gelaufen sind,
 * und Gates, die entscheidungsreif und nicht abschließend entschieden sind. Rein lesend.
 */
export function next_allowed_steps(state: CaseState, pack: ValidatedPack): AllowedSteps {
  assertValidated(pack);
  assertSamePack(state, pack);
  const blocks = pack.blocks.map((b) => b.block).filter((b) => missingDependencies(state, pack, b).length === 0);
  const gates: AllowedGate[] = [];
  for (const [gate, def] of Object.entries(pack.gates)) {
    const last = lastDecision(state, gate);
    if (last !== undefined && def.final.includes(last)) continue;
    if (!gate_check(state, pack, gate).ok) continue;
    gates.push(last === undefined ? { gate } : { gate, last_decision: last });
  }
  return { blocks, gates };
}
