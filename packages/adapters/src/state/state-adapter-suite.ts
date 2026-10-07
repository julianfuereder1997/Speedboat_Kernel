// Gemeinsame Vertragstests für jeden StateAdapter.
import { expect, it } from "vitest";
import { Pack, apply_patch, create_case, type Actor, type CaseState, type StateAdapter } from "@speedboat/core";

const AT = "2026-10-07T10:00:00.000Z";
const editor: Actor = { id: "u-editor", kind: "human", roles: ["editor"] };

export const pack = Pack.parse({
  pack: "sample",
  version: "1.0.0",
  object_types: { item: { schema: { type: "object" }, write_roles: ["editor"] } },
  blocks: [],
  dependencies: {},
  gates: {},
  bias_profiles: {},
  markers: [],
  roles: ["editor"],
  provenance_values: [],
});

export const fresh = (case_id: string) => create_case({ case_id, pack, actor: editor }, { now: () => AT });

export function next(state: CaseState, id: string): CaseState {
  const r = apply_patch(
    state,
    { patch_id: `p-${id}-${state.revision}`, case_id: state.case_id, base_revision: state.revision, changes: [{ op: "add", path: `/objects/item/${id}`, new_value: { v: id } }] },
    editor,
    pack,
    { now: () => AT },
  );
  if (r.status !== "APPLIED") throw new Error(JSON.stringify(r));
  return r.case;
}

export function stateAdapterSuite(getAdapter: () => StateAdapter, newId: () => string): void {
  it("legt an und lädt dieselbe Akte", async () => {
    const a = getAdapter();
    const s = fresh(newId());
    expect(await a.create(s)).toEqual({ ok: true });
    expect(await a.load(s.case_id)).toEqual(s);
  });

  it("liefert null für unbekannte Akten", async () => {
    expect(await getAdapter().load(newId())).toBeNull();
  });

  it("legt dieselbe case_id nicht zweimal an", async () => {
    const a = getAdapter();
    const s = fresh(newId());
    await a.create(s);
    expect(await a.create(s)).toMatchObject({ ok: false, code: "ALREADY_EXISTS" });
  });

  it("schreibt bei passender Revision", async () => {
    const a = getAdapter();
    const s0 = fresh(newId());
    await a.create(s0);
    const s1 = next(s0, "a");
    expect(await a.save(s1, 0)).toEqual({ ok: true });
    expect((await a.load(s0.case_id))?.revision).toBe(1);
  });

  it("schreibt nicht bei veralteter Revision; der gespeicherte Stand bleibt", async () => {
    const a = getAdapter();
    const s0 = fresh(newId());
    await a.create(s0);
    const s1 = next(s0, "a");
    await a.save(s1, 0);
    const competing = next(s0, "b"); // basiert ebenfalls auf Revision 0
    expect(await a.save(competing, 0)).toMatchObject({ ok: false, code: "REVISION_CONFLICT" });
    expect(await a.load(s0.case_id)).toEqual(s1);
  });

  it("lässt bei gleichzeitigem Schreiben genau einen gewinnen", async () => {
    const a = getAdapter();
    const s0 = fresh(newId());
    await a.create(s0);
    const results = await Promise.all(["a", "b", "c", "d"].map((id) => a.save(next(s0, id), 0)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.code === "REVISION_CONFLICT")).toHaveLength(3);
  });

  it("verlangt, dass die neue Revision über der erwarteten liegt", async () => {
    const a = getAdapter();
    const s0 = fresh(newId());
    await a.create(s0);
    expect(await a.save(s0, 0)).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });

  it("speichert keine schemawidrige Akte", async () => {
    const a = getAdapter();
    const s0 = fresh(newId());
    await a.create(s0);
    const broken = { ...next(s0, "a"), revision: 7 } as CaseState; // passt nicht zum Audit
    expect(await a.save(broken, 0)).toMatchObject({ ok: false, code: "INVALID_STATE" });
    expect(await a.create({ ...fresh(newId()), extra: 1 } as CaseState)).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });

  it("meldet NOT_FOUND beim Speichern einer unbekannten Akte", async () => {
    const s0 = fresh(newId());
    expect(await getAdapter().save(next(s0, "a"), 0)).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
}
