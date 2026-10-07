import { describe, expect, it } from "vitest";
import { Actor, BlockContract, CaseState, Change, Patch, Pack } from "../index.js";

const AT = "2026-10-07T10:00:00.000Z";

const minimalCase = () => ({
  case_id: "case-1",
  pack: "sample",
  pack_version: "1.0.0",
  revision: 0,
  objects: {},
  decisions: [],
  frozen: {},
  change_requests: [],
  runs: [],
  audit: [
    { revision: 0, at: AT, actor: { id: "u1", kind: "human" }, action: "create_case", ref: "case-1", paths: [] },
  ],
});

const contract = (over: Record<string, unknown> = {}) => ({
  block: "make-idea",
  type: "generate",
  input: ["/objects/topic"],
  output_schema: { type: "object" },
  isolation: "shared",
  ...over,
});

const minimalPack = () => ({
  pack: "sample",
  version: "1.0.0",
  object_types: {
    item: { schema: { type: "object" }, write_roles: ["editor"], requires_provenance: true },
  },
  blocks: [contract()],
  dependencies: { "make-idea": [] },
  gates: { g1: { requires: ["make-idea"], checks: [], decisions: ["ok"] } },
  bias_profiles: {},
  markers: [],
  roles: ["editor"],
  provenance_values: ["CONFIRMED"],
});

describe("CaseState", () => {
  it("akzeptiert eine minimale Akte", () => {
    expect(CaseState.safeParse(minimalCase()).success).toBe(true);
  });

  it.each(["case_id", "pack", "pack_version", "revision", "objects", "decisions", "frozen", "change_requests", "runs", "audit"])(
    "verlangt das Feld %s",
    (field) => {
      const c: Record<string, unknown> = minimalCase();
      delete c[field];
      expect(CaseState.safeParse(c).success).toBe(false);
    },
  );

  it("lehnt unbekannte Felder ab", () => {
    expect(CaseState.safeParse({ ...minimalCase(), extra: 1 }).success).toBe(false);
  });

  it("lehnt negative Revision ab", () => {
    expect(CaseState.safeParse({ ...minimalCase(), revision: -1 }).success).toBe(false);
  });

  it("verlangt, dass der letzte Audit-Eintrag zur Revision passt", () => {
    expect(CaseState.safeParse({ ...minimalCase(), revision: 3 }).success).toBe(false);
  });

  it("verlangt streng steigende Revisionen im Audit", () => {
    const c = minimalCase();
    c.audit.push({ ...c.audit[0]!, revision: 0 });
    expect(CaseState.safeParse(c).success).toBe(false);
  });

  it("verlangt Objekte als Typ → ID → Objekt", () => {
    expect(CaseState.safeParse({ ...minimalCase(), objects: { item: { a: { x: 1 } } } }).success).toBe(true);
    expect(CaseState.safeParse({ ...minimalCase(), objects: { item: { a: 5 } } }).success).toBe(false);
  });
});

describe("Actor", () => {
  it("kennt genau die Arten human und block", () => {
    expect(Actor.safeParse({ id: "u", kind: "human", roles: [] }).success).toBe(true);
    expect(Actor.safeParse({ id: "b", kind: "block", roles: [] }).success).toBe(true);
    expect(Actor.safeParse({ id: "x", kind: "robot", roles: [] }).success).toBe(false);
  });
});

describe("Patch", () => {
  const patch = (changes: unknown[]) => ({ patch_id: "p1", case_id: "case-1", base_revision: 0, changes });

  it("akzeptiert einen gültigen Patch", () => {
    const r = Patch.safeParse(
      patch([{ op: "replace", path: "/objects/item/a/x", old_value: 1, new_value: 2, provenance: "CONFIRMED" }]),
    );
    expect(r.success).toBe(true);
  });

  it("akzeptiert Provenienz als Objekt", () => {
    const r = Change.safeParse({
      op: "add",
      path: "/objects/item/a",
      new_value: {},
      provenance: { status: "EXTRACTED", source: "doc-1", locator: "p. 3" },
    });
    expect(r.success).toBe(true);
  });

  it("erlaubt set_provenance auf ein ganzes Objekt, mit Provenienz und ohne new_value", () => {
    expect(Change.safeParse({ op: "set_provenance", path: "/objects/item/a", provenance: "CONFIRMED" }).success).toBe(true);
    expect(Change.safeParse({ op: "set_provenance", path: "/objects/item/a" }).success).toBe(false);
    expect(Change.safeParse({ op: "set_provenance", path: "/objects/item/a", new_value: 1, provenance: "C" }).success).toBe(false);
    expect(Change.safeParse({ op: "set_provenance", path: "/objects/item/a/x", provenance: "C" }).success).toBe(false);
  });

  it("verbietet direktes Schreiben des reservierten Provenienz-Schlüssels", () => {
    expect(Change.safeParse({ op: "replace", path: "/objects/item/a/_provenance", new_value: "C" }).success).toBe(false);
    expect(Change.safeParse({ op: "add", path: "/objects/item/a", new_value: { _provenance: "C" } }).success).toBe(false);
  });

  it("lehnt leere Änderungsliste ab", () => {
    expect(Patch.safeParse(patch([])).success).toBe(false);
  });

  it("lehnt Pfade außerhalb von /objects/<typ>/<id> ab", () => {
    for (const path of ["/revision", "/frozen/x", "/objects/item", "objects/item/a", "/audit/0"]) {
      expect(Change.safeParse({ op: "add", path, new_value: 1 }).success, path).toBe(false);
    }
  });

  it("verlangt new_value bei add und replace", () => {
    expect(Change.safeParse({ op: "add", path: "/objects/item/a" }).success).toBe(false);
    expect(Change.safeParse({ op: "replace", path: "/objects/item/a" }).success).toBe(false);
  });

  it("verbietet new_value bei remove", () => {
    expect(Change.safeParse({ op: "remove", path: "/objects/item/a", new_value: 1 }).success).toBe(false);
    expect(Change.safeParse({ op: "remove", path: "/objects/item/a" }).success).toBe(true);
  });

  it("lehnt negative base_revision ab", () => {
    expect(Patch.safeParse({ ...patch([{ op: "remove", path: "/objects/item/a" }]), base_revision: -1 }).success).toBe(
      false,
    );
  });
});

describe("BlockContract", () => {
  it.each(["extract", "generate", "critic", "validate", "ask", "gate", "freeze", "action"])("kennt den Typ %s", (type) => {
    const extra = type === "critic" ? { markers: ["m1"], isolation: "fresh_context" } : {};
    expect(BlockContract.safeParse(contract({ type, ...extra })).success).toBe(true);
  });

  it("lehnt einen neunten Typ ab", () => {
    expect(BlockContract.safeParse(contract({ type: "summarize" })).success).toBe(false);
  });

  it("erlaubt Marker nur bei critic", () => {
    expect(BlockContract.safeParse(contract({ markers: ["m1"] })).success).toBe(false);
  });

  it("verlangt JSON-Pointer als Eingabepfade, * als Segment ist erlaubt", () => {
    expect(BlockContract.safeParse(contract({ input: ["/objects/idea/*/title"] })).success).toBe(true);
    expect(BlockContract.safeParse(contract({ input: ["objects.idea"] })).success).toBe(false);
  });

  it("kennt nur die Isolationen shared und fresh_context", () => {
    expect(BlockContract.safeParse(contract({ isolation: "sandbox" })).success).toBe(false);
  });
});

describe("Pack", () => {
  it("akzeptiert ein minimales Pack", () => {
    const r = Pack.safeParse(minimalPack());
    expect(r.error).toBeUndefined();
  });

  it("verlangt write_roles je Objekttyp", () => {
    const p = minimalPack();
    p.object_types.item.write_roles = [];
    expect(Pack.safeParse(p).success).toBe(false);
  });

  it("verlangt requires, checks und decisions je Gate", () => {
    const p: Record<string, unknown> = { ...minimalPack(), gates: { g1: { requires: [] } } };
    expect(Pack.safeParse(p).success).toBe(false);
  });

  it("lehnt Funktionen im Pack ab (nur Daten)", () => {
    const p = { ...minimalPack(), bias_profiles: { b: { score: () => 1 } } };
    expect(Pack.safeParse(p).success).toBe(false);
  });

  it.each(["roles", "provenance_values"])("verlangt das Feld %s", (field) => {
    const p: Record<string, unknown> = minimalPack();
    delete p[field];
    expect(Pack.safeParse(p).success).toBe(false);
  });

  it("lehnt unbekannte Felder ab", () => {
    expect(Pack.safeParse({ ...minimalPack(), states: [] }).success).toBe(false);
  });
});
