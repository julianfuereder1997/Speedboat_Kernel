import type { Pack } from "./schemas/pack.js";
import type { CaseState } from "./schemas/case-state.js";
import { inspect_pack, type PackIssue } from "./validate-pack.js";

declare const validated: unique symbol;

/** Ein Pack, das load_pack geprüft und eingefroren hat. Nur load_pack erzeugt diesen Typ. */
export type ValidatedPack = Pack & { readonly [validated]: true };

export type LoadPackResult = { ok: true; pack: ValidatedPack; warnings: PackIssue[] } | { ok: false; errors: PackIssue[]; warnings: PackIssue[] };

const registry = new WeakSet<object>();

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

/** Einziger Weg zu einem ValidatedPack: prüfen, einfrieren, registrieren. */
export function load_pack(input: unknown): LoadPackResult {
  const result = inspect_pack(input);
  if (!result.valid || !result.pack) return { ok: false, errors: result.errors, warnings: result.warnings };
  const pack = deepFreeze(result.pack); // Pack.parse liefert neue Objekte; die Eingabe bleibt unberührt
  registry.add(pack);
  return { ok: true, pack: pack as ValidatedPack, warnings: result.warnings };
}

/** Wirft, wenn das Pack nicht aus load_pack stammt (z. B. per Cast an der Typprüfung vorbei). */
export function assertValidated(pack: unknown): asserts pack is ValidatedPack {
  if (typeof pack !== "object" || pack === null || !registry.has(pack)) {
    throw new TypeError("Pack wurde nicht über load_pack geprüft");
  }
}

/** Wirft, wenn Akte und Pack nicht zusammengehören. */
export function assertSamePack(state: CaseState, pack: Pack): void {
  if (state.pack !== pack.pack || state.pack_version !== pack.version) {
    throw new Error(`Akte gehört zu ${state.pack}@${state.pack_version}, Pack ist ${pack.pack}@${pack.version}`);
  }
}
