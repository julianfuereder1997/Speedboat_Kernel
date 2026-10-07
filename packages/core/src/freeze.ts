import { createHash } from "node:crypto";
import { packMismatch } from "./apply-patch.js";
import { REVIEWER_ROLE } from "./gate.js";
import { getAt, overlaps, parsePointer } from "./pointer.js";
import { commit, nowOf, reject, type Applied, type Options, type Rejected } from "./result.js";
import { Actor, ObjectPath } from "./schemas/common.js";
import type { CaseState, FrozenRecord } from "./schemas/case-state.js";
import type { Pack } from "./schemas/pack.js";

/** JSON mit rekursiv sortierten Objektschlüsseln; Grundlage der Prüfsumme. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export const sha256Of = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");

/** Versiegelt ein Objekt (oder einen Teil davon). Danach ist es nur per Change Request änderbar. */
export function freeze(state: CaseState, path: string, actorInput: Actor, pack: Pack, opts?: Options): Applied | Rejected {
  const parsedActor = Actor.safeParse(actorInput);
  if (!parsedActor.success) return reject("FORBIDDEN", "ungültiger Akteur", parsedActor.error.issues);
  const actor = parsedActor.data;
  if (actor.kind !== "human" || !actor.roles.includes(REVIEWER_ROLE)) {
    return reject("FORBIDDEN", `Versiegeln verlangt einen Menschen mit Rolle ${REVIEWER_ROLE}`);
  }
  const mismatch = packMismatch(state, pack);
  if (mismatch) return mismatch;

  if (!ObjectPath.safeParse(path).success) return reject("NOT_FOUND", `${path} ist kein Objektpfad`);
  const target = getAt(state, parsePointer(path));
  if (!target.found) return reject("NOT_FOUND", `${path} existiert nicht`);
  const overlapping = Object.keys(state.frozen).filter((f) => overlaps(f, path));
  if (overlapping.length > 0) return reject("ALREADY_FROZEN", `${path} ist bereits versiegelt`, { frozen: overlapping });

  const previous = state.audit.filter((e) => e.action === "freeze" && e.ref === path).length;
  const at = nowOf(opts);
  const next = commit(state, actor, at, { action: "freeze", ref: path, paths: [] }, (d, revision) => {
    const record: FrozenRecord = { path, version: previous + 1, sha256: sha256Of(target.value), revision, at, by: actor.id };
    d.frozen[path] = record;
  });
  return { status: "APPLIED", case: next };
}

/** Stimmt die Prüfsumme des Siegels noch mit dem Objekt überein? */
export function verify_freeze(state: CaseState, path: string): boolean {
  const record = state.frozen[path];
  if (!record) return false;
  const target = getAt(state, parsePointer(path));
  return target.found && sha256Of(target.value) === record.sha256;
}
