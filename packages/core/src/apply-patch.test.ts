import { describe, expect, it } from "vitest";
import { CaseState, apply_patch, create_case } from "./index.js";
import type { CaseState as CaseStateT, Patch } from "./index.js";
import { AT, deepFreeze, editor, newCase, opts, outsider, patch, samplePack, writerBlock } from "./test-support.js";

const addNote = (state: CaseStateT, id = "n1", text = "hello"): Patch =>
  patch(state, [{ op: "add", path: `/objects/note/${id}`, new_value: { text }, provenance: "CONFIRMED" }]);

function applied(state: CaseStateT, p: Patch) {
  const r = apply_patch(state, p, editor, samplePack, opts);
  if (r.status !== "APPLIED") throw new Error(`erwartet APPLIED, bekommen ${JSON.stringify(r)}`);
  return r.case;
}

/** Akte mit einem eingefrorenen note n1. Das Siegel ist hier ein Platzhalter; freeze() kommt in Schritt 6. */
function withFrozenNote(): CaseStateT {
  const s = applied(newCase(), addNote(newCase()));
  return CaseState.parse({
    ...s,
    revision: s.revision + 1,
    frozen: {
      "/objects/note/n1": { path: "/objects/note/n1", version: 1, sha256: "0".repeat(64), revision: s.revision + 1, at: AT, by: "u-reviewer" },
    },
    audit: [...s.audit, { revision: s.revision + 1, at: AT, actor: { id: "u-reviewer", kind: "human" }, action: "freeze", ref: "/objects/note/n1", paths: [] }],
  });
}

describe("create_case", () => {
  it("legt eine gültige Akte mit Revision 0 und einem Audit-Eintrag an", () => {
    const c = create_case({ case_id: "c-9", pack: samplePack, actor: editor }, opts);
    expect(CaseState.parse(c)).toEqual(c);
    expect(c.revision).toBe(0);
    expect(c.pack).toBe("sample");
    expect(c.pack_version).toBe("1.0.0");
    expect(c.audit).toEqual([{ revision: 0, at: AT, actor: { id: "u-editor", kind: "human" }, action: "create_case", ref: "c-9", paths: [] }]);
  });
});

describe("apply_patch → APPLIED", () => {
  it("speichert die Änderung, erhöht revision um 1 und schreibt genau einen Audit-Eintrag", () => {
    const s0 = deepFreeze(newCase());
    const s1 = applied(s0, addNote(s0));
    expect(s1.revision).toBe(1);
    expect(s1.objects.note?.n1).toEqual({ text: "hello", _provenance: "CONFIRMED" });
    expect(s1.audit).toHaveLength(2);
    expect(s1.audit[1]).toMatchObject({
      revision: 1,
      at: AT,
      actor: { id: "u-editor", kind: "human" },
      action: "apply_patch",
      paths: ["/objects/note/n1"],
      provenance: { "/objects/note/n1": "CONFIRMED" },
    });
    expect(CaseState.safeParse(s1).success).toBe(true);
  });

  it("verändert die Eingabe-Akte nicht", () => {
    const s0 = deepFreeze(newCase());
    const before = structuredClone(s0);
    applied(s0, addNote(s0));
    expect(s0).toEqual(before);
  });

  it("unterstützt replace mit passendem old_value und remove", () => {
    const s1 = applied(newCase(), addNote(newCase()));
    const s2 = applied(s1, patch(s1, [{ op: "replace", path: "/objects/note/n1/text", old_value: "hello", new_value: "hi", provenance: "CONFIRMED" }]));
    expect(s2.objects.note?.n1).toEqual({ text: "hi", _provenance: "CONFIRMED" });
    const s3 = applied(s2, patch(s2, [{ op: "remove", path: "/objects/note/n1", provenance: "CONFIRMED" }]));
    expect(s3.objects.note?.n1).toBeUndefined();
    expect(s3.revision).toBe(3);
  });

  it("erlaubt einem Block mit passender Rolle das Schreiben", () => {
    const s0 = newCase();
    const r = apply_patch(s0, patch(s0, [{ op: "add", path: "/objects/idea/i1", new_value: { title: "t" } }]), writerBlock, samplePack, opts);
    expect(r.status).toBe("APPLIED");
  });

  it("verlangt keine Provenienz bei Typen ohne requires_provenance", () => {
    const s0 = newCase();
    const r = apply_patch(s0, patch(s0, [{ op: "add", path: "/objects/idea/i1", new_value: { title: "t" } }]), editor, samplePack, opts);
    expect(r.status).toBe("APPLIED");
  });
});

describe("apply_patch → REJECTED", () => {
  const rejected = (state: CaseStateT, p: unknown, actor = editor) => {
    const frozen = deepFreeze(state);
    const r = apply_patch(frozen, p as Patch, actor, samplePack, opts);
    expect(r.status).toBe("REJECTED");
    if (r.status !== "REJECTED") throw new Error();
    return r;
  };

  it("bei veralteter base_revision", () => {
    const s1 = applied(newCase(), addNote(newCase()));
    expect(rejected(s1, { ...addNote(s1, "n2"), base_revision: 0 }).code).toBe("STALE_REVISION");
    expect(rejected(s1, { ...addNote(s1, "n2"), base_revision: 5 }).code).toBe("STALE_REVISION");
  });

  it("bei ungültiger Patch-Struktur", () => {
    const s0 = newCase();
    expect(rejected(s0, { ...addNote(s0), changes: [] }).code).toBe("INVALID_PATCH");
    expect(rejected(s0, patch(s0, [{ op: "add", path: "/revision", new_value: 9 }])).code).toBe("INVALID_PATCH");
  });

  it("bei fremder case_id", () => {
    const s0 = newCase();
    expect(rejected(s0, { ...addNote(s0), case_id: "other" }).code).toBe("WRONG_CASE");
  });

  it("bei Akte eines anderen Packs oder einer anderen Pack-Version", () => {
    const s0 = { ...newCase(), pack_version: "0.9.0" };
    expect(rejected(s0, addNote(s0)).code).toBe("PACK_MISMATCH");
  });

  it("bei unbekanntem Objekttyp", () => {
    const s0 = newCase();
    expect(rejected(s0, patch(s0, [{ op: "add", path: "/objects/ghost/g1", new_value: {} }])).code).toBe("UNKNOWN_OBJECT_TYPE");
  });

  it("bei Schemafehler im Objekt", () => {
    const s0 = newCase();
    const wrongType = patch(s0, [{ op: "add", path: "/objects/note/n1", new_value: { text: 5 }, provenance: "ASSUMED" }]);
    const extraField = patch(s0, [{ op: "add", path: "/objects/note/n1", new_value: { text: "a", bogus: 1 }, provenance: "ASSUMED" }]);
    const missing = patch(s0, [{ op: "add", path: "/objects/note/n1", new_value: {}, provenance: "ASSUMED" }]);
    for (const p of [wrongType, extraField, missing]) expect(rejected(s0, p).code).toBe("SCHEMA_VIOLATION");
  });

  it("bei fehlender Rolle", () => {
    const s0 = newCase();
    expect(rejected(s0, addNote(s0), outsider).code).toBe("FORBIDDEN");
  });

  it("bei ungültigem Akteur", () => {
    const s0 = newCase();
    expect(rejected(s0, addNote(s0), { id: "x", kind: "robot", roles: ["editor"] } as never).code).toBe("FORBIDDEN");
  });

  it("bei Fakt ohne Provenienz", () => {
    const s0 = newCase();
    const r = rejected(s0, patch(s0, [{ op: "add", path: "/objects/note/n1", new_value: { text: "x" } }]));
    expect(r.code).toBe("MISSING_PROVENANCE");
  });

  it("bei Pfadkonflikten: replace auf Fehlendes, add auf Vorhandenes, falscher old_value", () => {
    const s1 = applied(newCase(), addNote(newCase()));
    expect(rejected(s1, patch(s1, [{ op: "replace", path: "/objects/note/n9/text", new_value: "a", provenance: "ASSUMED" }])).code).toBe("PATH_CONFLICT");
    expect(rejected(s1, addNote(s1, "n1")).code).toBe("PATH_CONFLICT");
    expect(rejected(s1, patch(s1, [{ op: "replace", path: "/objects/note/n1/text", old_value: "nope", new_value: "a", provenance: "ASSUMED" }])).code).toBe("PATH_CONFLICT");
  });

  it("bei wiederholter patch_id", () => {
    const s0 = newCase();
    const p = addNote(s0);
    const s1 = applied(s0, p);
    expect(rejected(s1, { ...addNote(s1, "n2"), patch_id: p.patch_id }).code).toBe("DUPLICATE_PATCH");
  });

  it("atomar: ist eine Änderung ungültig, wird keine angewendet", () => {
    const s0 = newCase();
    const p = patch(s0, [
      { op: "add", path: "/objects/note/n1", new_value: { text: "ok" }, provenance: "ASSUMED" },
      { op: "add", path: "/objects/note/n2", new_value: { text: 1 }, provenance: "ASSUMED" },
    ]);
    rejected(s0, p);
  });
});

describe("apply_patch: Provenienz", () => {
  const code = (s: CaseStateT, p: Patch) => {
    const r = apply_patch(s, p, editor, samplePack, opts);
    return r.status === "REJECTED" ? r.code : r.status;
  };

  it("steht am Objekt selbst und zusätzlich im Audit", () => {
    const s0 = newCase();
    const prov = { status: "EXTRACTED", source: "doc-1", locator: "S. 3" };
    const s1 = applied(s0, patch(s0, [{ op: "add", path: "/objects/note/n1", new_value: { text: "a" }, provenance: prov }]));
    expect(s1.objects.note?.n1).toEqual({ text: "a", _provenance: prov });
    expect(s1.audit.at(-1)?.provenance).toEqual({ "/objects/note/n1": prov });
  });

  it("gilt bei einer Feldänderung für das ganze Objekt", () => {
    const s1 = applied(newCase(), addNote(newCase()));
    const s2 = applied(s1, patch(s1, [{ op: "replace", path: "/objects/note/n1/text", new_value: "b", provenance: "ASSUMED" }]));
    expect(s2.objects.note?.n1).toEqual({ text: "b", _provenance: "ASSUMED" });
  });

  it("lehnt Werte ab, die das Pack nicht definiert", () => {
    const s0 = newCase();
    expect(code(s0, patch(s0, [{ op: "add", path: "/objects/note/n1", new_value: { text: "a" }, provenance: "GUESSED" }]))).toBe("INVALID_PROVENANCE");
    expect(code(s0, patch(s0, [{ op: "add", path: "/objects/note/n1", new_value: { text: "a" }, provenance: { status: "GUESSED" } }]))).toBe(
      "INVALID_PROVENANCE",
    );
    // auch bei Typen ohne Pflicht: wenn gesetzt, dann gültig
    expect(code(s0, patch(s0, [{ op: "add", path: "/objects/idea/i1", new_value: { title: "t" }, provenance: "GUESSED" }]))).toBe("INVALID_PROVENANCE");
  });

  it("set_provenance ändert nur die Provenienz, nicht den Wert", () => {
    const s1 = applied(newCase(), addNote(newCase()));
    const s2 = applied(s1, patch(s1, [{ op: "set_provenance", path: "/objects/note/n1", old_value: "CONFIRMED", provenance: "EXTRACTED" }]));
    expect(s2.objects.note?.n1).toEqual({ text: "hello", _provenance: "EXTRACTED" });
    expect(s2.revision).toBe(s1.revision + 1);
    expect(s2.audit.at(-1)).toMatchObject({ action: "apply_patch", paths: ["/objects/note/n1"], provenance: { "/objects/note/n1": "EXTRACTED" } });
  });

  it("set_provenance auf ein fehlendes Objekt oder mit falschem old_value wird abgelehnt", () => {
    const s1 = applied(newCase(), addNote(newCase()));
    expect(code(s1, patch(s1, [{ op: "set_provenance", path: "/objects/note/n9", provenance: "ASSUMED" }]))).toBe("PATH_CONFLICT");
    expect(code(s1, patch(s1, [{ op: "set_provenance", path: "/objects/note/n1", old_value: "ASSUMED", provenance: "EXTRACTED" }]))).toBe(
      "PATH_CONFLICT",
    );
  });

  it("set_provenance auf ein versiegeltes Objekt erzeugt einen Change Request", () => {
    const s = withFrozenNote();
    expect(code(s, patch(s, [{ op: "set_provenance", path: "/objects/note/n1", provenance: "ASSUMED" }]))).toBe("REVIEW_REQUIRED");
  });

  it("lehnt widersprüchliche Provenienz für dasselbe Objekt in einem Patch ab", () => {
    const s1 = applied(newCase(), addNote(newCase()));
    const p = patch(s1, [
      { op: "replace", path: "/objects/note/n1/text", new_value: "b", provenance: "ASSUMED" },
      { op: "add", path: "/objects/note/n1/tags", new_value: ["x"], provenance: "CONFIRMED" },
    ]);
    expect(code(s1, p)).toBe("INVALID_PATCH");
  });

  it("entfernt eine alte Provenienz, wenn sich der Wert ohne neue Provenienz ändert", () => {
    const s0 = newCase();
    const s1 = applied(s0, patch(s0, [{ op: "add", path: "/objects/idea/i1", new_value: { title: "t" }, provenance: "CONFIRMED" }]));
    expect(s1.objects.idea?.i1).toEqual({ title: "t", _provenance: "CONFIRMED" });
    const s2 = applied(s1, patch(s1, [{ op: "replace", path: "/objects/idea/i1/title", new_value: "u" }]));
    expect(s2.objects.idea?.i1).toEqual({ title: "u" });
  });

  it("das Objektschema des Packs prüft den reservierten Schlüssel nicht mit", () => {
    // note hat additionalProperties: false und trotzdem _provenance
    const s1 = applied(newCase(), addNote(newCase()));
    expect(code(s1, patch(s1, [{ op: "replace", path: "/objects/note/n1/text", new_value: "c", provenance: "CONFIRMED" }]))).toBe("APPLIED");
  });
});

describe("apply_patch → REVIEW_REQUIRED", () => {
  it("legt bei eingefrorenem Objekt einen Change Request an; das Objekt bleibt unverändert", () => {
    const s = deepFreeze(withFrozenNote());
    const p = patch(s, [{ op: "replace", path: "/objects/note/n1/text", new_value: "changed", provenance: "ASSUMED" }]);
    const r = apply_patch(s, p, editor, samplePack, opts);
    expect(r.status).toBe("REVIEW_REQUIRED");
    if (r.status !== "REVIEW_REQUIRED") return;

    expect(r.case.objects).toEqual(s.objects);
    expect(r.case.frozen).toEqual(s.frozen);
    expect(r.case.revision).toBe(s.revision + 1);
    expect(r.change_request).toEqual({
      cr_id: `cr-${p.patch_id}`,
      patch: p,
      frozen_paths: ["/objects/note/n1"],
      requested_by: "u-editor",
      at: AT,
      revision: s.revision + 1,
      status: "open",
    });
    expect(r.case.change_requests).toEqual([r.change_request]);
    expect(r.case.audit.at(-1)).toMatchObject({ action: "change_request", ref: r.change_request.cr_id, paths: [] });
    expect(CaseState.safeParse(r.case).success).toBe(true);
  });

  it("wendet bei gemischtem Patch auch den nicht eingefrorenen Teil nicht an", () => {
    const s = withFrozenNote();
    const p = patch(s, [
      { op: "add", path: "/objects/note/n2", new_value: { text: "free" }, provenance: "ASSUMED" },
      { op: "remove", path: "/objects/note/n1", provenance: "ASSUMED" },
    ]);
    const r = apply_patch(s, p, editor, samplePack, opts);
    expect(r.status).toBe("REVIEW_REQUIRED");
    if (r.status !== "REVIEW_REQUIRED") return;
    expect(r.case.objects).toEqual(s.objects);
  });

  it("prüft auch bei eingefrorenem Objekt zuerst Rolle und Schema", () => {
    const s = withFrozenNote();
    const bad = patch(s, [{ op: "replace", path: "/objects/note/n1/text", new_value: 7, provenance: "ASSUMED" }]);
    expect(apply_patch(s, bad, editor, samplePack, opts).status).toBe("REJECTED");
    const ok = patch(s, [{ op: "replace", path: "/objects/note/n1/text", new_value: "x", provenance: "ASSUMED" }]);
    expect(apply_patch(s, ok, outsider, samplePack, opts).status).toBe("REJECTED");
  });
});
