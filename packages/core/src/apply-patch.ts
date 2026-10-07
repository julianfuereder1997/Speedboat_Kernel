import { isDeepStrictEqual } from "node:util";
import { checkSchema } from "./json-schema.js";
import { formatPointer, getAt, mutateAt, overlaps, parsePointer } from "./pointer.js";
import { commit, nowOf, reject, type Applied, type Options, type Rejected, type ReviewRequired } from "./result.js";
import type { z } from "zod";
import { Actor, type Json, PROVENANCE_KEY, provenanceValue, type Provenance } from "./schemas/common.js";
import type { CaseState, ChangeRequest } from "./schemas/case-state.js";
import type { Pack } from "./schemas/pack.js";
import { Patch } from "./schemas/patch.js";
import { assertValidated, type ValidatedPack } from "./validated-pack.js";

type JsonValue = z.infer<typeof Json>;

export type PatchResult = Applied | ReviewRequired | Rejected;

/** Prüft, ob die Akte zum Pack passt. */
export function packMismatch(state: CaseState, pack: Pack): Rejected | null {
  if (state.pack === pack.pack && state.pack_version === pack.version) return null;
  return reject("PACK_MISMATCH", `Akte gehört zu ${state.pack}@${state.pack_version}, Pack ist ${pack.pack}@${pack.version}`);
}

/**
 * Einziger Schreibweg für Objekte der Akte.
 * Reihenfolge: Form → Akte/Pack → Revision → Idempotenz → Typ/Rolle/Provenienz → Anwenden/Schema → Freeze.
 */
export function apply_patch(state: CaseState, patchInput: Patch, actorInput: Actor, pack: ValidatedPack, opts?: Options): PatchResult {
  assertValidated(pack);
  const parsedPatch = Patch.safeParse(patchInput);
  if (!parsedPatch.success) return reject("INVALID_PATCH", "Patch entspricht nicht dem Schema", parsedPatch.error.issues);
  const patch = parsedPatch.data;

  const parsedActor = Actor.safeParse(actorInput);
  if (!parsedActor.success) return reject("FORBIDDEN", "ungültiger Akteur", parsedActor.error.issues);
  const actor = parsedActor.data;

  if (patch.case_id !== state.case_id) return reject("WRONG_CASE", `Patch für ${patch.case_id}, Akte ist ${state.case_id}`);
  const mismatch = packMismatch(state, pack);
  if (mismatch) return mismatch;

  if (patch.base_revision !== state.revision) {
    return reject("STALE_REVISION", `base_revision ${patch.base_revision}, aktuell ${state.revision}`);
  }
  if (state.audit.some((e) => e.ref === patch.patch_id && (e.action === "apply_patch" || e.action === "change_request"))) {
    return reject("DUPLICATE_PATCH", `patch_id ${patch.patch_id} wurde bereits verarbeitet`);
  }

  // Je Objekt: Typ, ID und die Provenienz aus dem Patch (undefined = keine angegeben).
  const touched = new Map<string, { type: string; id: string; provenance: Provenance | undefined }>();
  const provenance: Record<string, Provenance> = {};
  for (const change of patch.changes) {
    const [, type, id] = parsePointer(change.path) as [string, string, string];
    const objectType = pack.object_types[type];
    if (!objectType) return reject("UNKNOWN_OBJECT_TYPE", `Objekttyp ${type} ist im Pack nicht definiert`, { path: change.path });
    if (!actor.roles.some((r) => objectType.write_roles.includes(r))) {
      return reject("FORBIDDEN", `${actor.id} fehlt eine der Rollen ${objectType.write_roles.join(", ")} für ${type}`, { path: change.path });
    }
    if (objectType.requires_provenance && change.provenance === undefined) {
      return reject("MISSING_PROVENANCE", `${type} verlangt Provenienz`, { path: change.path });
    }
    if (change.provenance !== undefined) {
      const value = provenanceValue(change.provenance);
      if (!pack.provenance_values.includes(value)) {
        return reject("INVALID_PROVENANCE", `Provenienz ${value} ist im Pack nicht definiert`, { path: change.path, allowed: pack.provenance_values });
      }
      provenance[change.path] = change.provenance;
    }
    const objectPath = formatPointer(["objects", type, id]);
    const seen = touched.get(objectPath);
    if (seen && !isDeepStrictEqual(seen.provenance, change.provenance)) {
      return reject("INVALID_PATCH", `widersprüchliche Provenienz für ${objectPath} in einem Patch`, { path: change.path });
    }
    touched.set(objectPath, { type, id, provenance: change.provenance });
  }

  // Auf einer Kopie anwenden; die Eingabe bleibt unberührt.
  const objects = structuredClone(state.objects);
  const root = { objects };
  for (const change of patch.changes) {
    const segments = parsePointer(change.path);
    const [, type] = segments as [string, string];
    objects[type] ??= {};
    if (change.op === "set_provenance") {
      const target = getAt(root, segments);
      if (!target.found) return reject("PATH_CONFLICT", `Objekt existiert nicht: ${change.path}`, { path: change.path, op: change.op });
      const current = (target.value as Record<string, unknown>)[PROVENANCE_KEY];
      if (change.old_value !== undefined && !isDeepStrictEqual(current, change.old_value)) {
        return reject("PATH_CONFLICT", `old_value passt nicht zur Provenienz von ${change.path}`, { path: change.path, current });
      }
      continue; // gesetzt wird unten, einheitlich für alle berührten Objekte
    }
    if (change.old_value !== undefined) {
      const current = getAt(root, segments);
      if (!current.found || !isDeepStrictEqual(current.value, change.old_value)) {
        return reject("PATH_CONFLICT", `old_value passt nicht zu ${change.path}`, { path: change.path, current: current.value });
      }
    }
    const error = mutateAt(root, segments, change.op, change.new_value);
    if (error) return reject("PATH_CONFLICT", `${error}: ${change.path}`, { path: change.path, op: change.op });
  }

  for (const [path, { type, id, provenance: objectProvenance }] of touched) {
    const value = objects[type]?.[id];
    if (value === undefined) continue; // entfernt
    // Die Provenienz steht am Objekt. Ändert sich der Wert ohne neue Provenienz, gilt die alte nicht mehr.
    if (objectProvenance === undefined) delete value[PROVENANCE_KEY];
    // Nach dem Parsen enthält die Provenienz keine undefined-Werte, ist also JSON.
    else value[PROVENANCE_KEY] = objectProvenance as JsonValue;
    const { [PROVENANCE_KEY]: _, ...content } = value;
    const check = checkSchema(pack.object_types[type]!.schema, content);
    if (!check.ok) return reject("SCHEMA_VIOLATION", `${path} verletzt das Schema von ${type}`, check.errors);
  }

  const at = nowOf(opts);
  const frozenPaths = Object.keys(state.frozen).filter((f) => patch.changes.some((c) => overlaps(f, c.path)));
  if (frozenPaths.length > 0) {
    const cr: ChangeRequest = {
      cr_id: `cr-${patch.patch_id}`,
      patch,
      frozen_paths: frozenPaths,
      requested_by: actor.id,
      at,
      revision: state.revision + 1,
      status: "open",
    };
    const next = commit(state, actor, at, { action: "change_request", ref: cr.cr_id, paths: [] }, (d) => {
      d.change_requests.push(cr);
    });
    return { status: "REVIEW_REQUIRED", case: next, change_request: cr };
  }

  const entry = { action: "apply_patch" as const, ref: patch.patch_id, paths: patch.changes.map((c) => c.path) };
  const next = commit(state, actor, at, Object.keys(provenance).length ? { ...entry, provenance } : entry, (d) => {
    d.objects = objects;
  });
  return { status: "APPLIED", case: next };
}
