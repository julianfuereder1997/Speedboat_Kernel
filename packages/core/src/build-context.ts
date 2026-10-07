import { expand, getAt, parsePointer } from "./pointer.js";
import type { CaseState } from "./schemas/case-state.js";
import { assertSamePack, assertValidated, type ValidatedPack } from "./validated-pack.js";

export type BlockContext = {
  case_id: string;
  block: string;
  /** Revision der Akte, aus der der Kontext gebaut wurde. */
  revision: number;
  input_paths: string[];
  /** Ausschnitt der Akte: genau die Pfade aus contract.input, sonst nichts. */
  data: Record<string, unknown>;
  /** Konkrete Eingabepfade (ohne `*`), die in der Akte fehlen. */
  missing: string[];
};

function setSparse(target: Record<string, unknown>, source: unknown, segments: readonly string[]): void {
  let out: Record<string, unknown> | unknown[] = target;
  for (let i = 0; i < segments.length; i++) {
    const key = segments[i]!;
    const last = i === segments.length - 1;
    const value = getAt(source, segments.slice(0, i + 1)).value;
    const slot = out as Record<string, unknown>;
    if (last) {
      slot[key] = structuredClone(value);
    } else {
      slot[key] ??= Array.isArray(value) ? [] : {};
      out = slot[key] as Record<string, unknown>;
    }
  }
}

/**
 * Baut den Kontext eines Bausteins. Der Kern entscheidet, was das Modell sieht, nicht das Modell.
 * Der Vertrag kommt aus dem geprüften Pack, nie vom Aufrufer.
 */
export function build_context(state: CaseState, pack: ValidatedPack, block: string): BlockContext {
  assertValidated(pack);
  assertSamePack(state, pack);
  const contract = pack.blocks.find((b) => b.block === block);
  if (!contract) throw new Error(`Baustein ${block} ist im Pack nicht definiert`);
  const data: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const pattern of contract.input) {
    const segments = parsePointer(pattern);
    const hits = expand(state, segments);
    if (hits.length === 0 && !segments.includes("*")) missing.push(pattern);
    for (const hit of hits) setSparse(data, state, hit);
  }
  return { case_id: state.case_id, block: contract.block, revision: state.revision, input_paths: [...contract.input], data, missing };
}
