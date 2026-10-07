import type { CaseState } from "./schemas/case-state.js";
import type { Pack } from "./schemas/pack.js";

/** Abhängigkeiten eines Bausteins, die noch keinen Lauf in der Akte haben. */
export function missingDependencies(state: CaseState, pack: Pack, block: string): string[] {
  const ran = new Set(state.runs.map((r) => r.block));
  return (pack.dependencies[block] ?? []).filter((dep) => !ran.has(dep));
}
