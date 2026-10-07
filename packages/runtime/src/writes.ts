import { formatPointer, getAt, parsePointer, type BlockContract, type Patch } from "@speedboat/core";

export type PatchFromOutput = { ok: true; patch: Patch } | { ok: false; message: string };

/** Übersetzt die Ausgabe eines generate-/extract-Bausteins über contract.writes in einen Patch. */
export function output_to_patch(input: {
  contract: BlockContract;
  output: unknown;
  run_id: string;
  case_id: string;
  base_revision: number;
}): PatchFromOutput {
  const { contract, output, run_id } = input;
  const w = contract.writes;
  if (!w) return { ok: false, message: `${contract.block} hat kein writes` };
  const found = getAt(output, parsePointer(w.items));
  if (!found.found || !Array.isArray(found.value)) return { ok: false, message: `${w.items} in der Ausgabe ist kein Array` };

  const changes: Patch["changes"] = [];
  const ids = new Set<string>();
  for (const [i, raw] of found.value.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, message: `Element ${i} ist kein Objekt` };
    const value: Record<string, unknown> = { ...raw };
    let id = `${run_id}-${i}`;
    if (w.id_field !== undefined) {
      const v = value[w.id_field];
      if (typeof v !== "string" || v.length === 0) return { ok: false, message: `Element ${i}: ${w.id_field} fehlt` };
      id = v;
      delete value[w.id_field];
    }
    if (ids.has(id)) return { ok: false, message: `ID ${id} kommt mehrfach vor` };
    ids.add(id);
    let provenance = w.provenance;
    if (w.provenance_field !== undefined) {
      const p = value[w.provenance_field];
      if (typeof p !== "string" || p.length === 0) return { ok: false, message: `Element ${i}: ${w.provenance_field} fehlt` };
      provenance = p;
      delete value[w.provenance_field];
    }
    const change: Patch["changes"][number] = { op: "add", path: formatPointer(["objects", w.object_type, id]), new_value: value as never };
    if (provenance !== undefined) change.provenance = provenance;
    changes.push(change);
  }
  if (changes.length === 0) return { ok: false, message: "Ausgabe enthält keine Elemente" };
  return { ok: true, patch: { patch_id: `${run_id}-patch`, case_id: input.case_id, base_revision: input.base_revision, changes } };
}
