import { describe, expect, it } from "vitest";
import { apply_patch, build_context } from "./index.js";
import type { CaseState } from "./index.js";
import { deepFreeze, editor, mustLoad, newCase, opts, patch, samplePack, sampleRaw } from "./test-support.js";

const SECRET = "weil der Generator es so begründet";

function caseWithIdeas(): CaseState {
  const s0 = newCase();
  const r1 = apply_patch(
    s0,
    patch(s0, [
      { op: "add", path: "/objects/note/n1", new_value: { text: "fact", tags: ["a"] }, provenance: "CONFIRMED" },
      { op: "add", path: "/objects/idea/i1", new_value: { title: "Idee eins", rationale: SECRET } },
      { op: "add", path: "/objects/idea/i2", new_value: { title: "Idee zwei", rationale: SECRET } },
    ]),
    editor,
    samplePack,
    opts,
  );
  if (r1.status !== "APPLIED") throw new Error(JSON.stringify(r1));
  return deepFreeze(r1.case);
}

/** Beispiel-Pack, in dem ein Baustein andere Eingabepfade hat; geladen über load_pack. */
const withInput = (block: string, input: string[]) =>
  mustLoad({ ...sampleRaw, blocks: sampleRaw.blocks.map((b) => (b.block === block ? { ...b, input } : b)) });

/** Sucht rekursiv nach einem Schlüssel oder einem String-Wert. */
function contains(value: unknown, needle: string): boolean {
  if (typeof value === "string") return value.includes(needle);
  if (value && typeof value === "object") {
    return Object.entries(value).some(([k, v]) => k === needle || contains(v, needle));
  }
  return false;
}

describe("build_context", () => {
  it("liefert dem Kritiker nur die Titel, nie die Begründung des Generators", () => {
    const state = caseWithIdeas();
    expect(contains(state, SECRET)).toBe(true); // sie steht in der Akte

    const ctx = build_context(state, samplePack, "check-idea");
    expect(ctx.data).toEqual({ objects: { idea: { i1: { title: "Idee eins" }, i2: { title: "Idee zwei" } } } });
    expect(contains(ctx, SECRET)).toBe(false);
    expect(contains(ctx, "rationale")).toBe(false);
  });

  it("liefert nur die Felder aus contract.input und keine Metadaten der Akte", () => {
    const ctx = build_context(caseWithIdeas(), samplePack, "make-idea");
    expect(ctx.data).toEqual({ objects: { note: { n1: { text: "fact", tags: ["a"], _provenance: "CONFIRMED" } } } });
    for (const key of ["audit", "runs", "decisions", "frozen", "change_requests", "idea"]) {
      expect(contains(ctx.data, key), key).toBe(false);
    }
  });

  it("liefert die Provenienz mit, wenn der Vertrag das ganze Objekt oder _provenance verlangt", () => {
    const state = caseWithIdeas();
    const pack = withInput("check-idea", ["/objects/note/*/text", "/objects/note/*/_provenance"]);
    expect(build_context(state, pack, "check-idea").data).toEqual({ objects: { note: { n1: { text: "fact", _provenance: "CONFIRMED" } } } });
  });

  it("gibt revision und Eingabepfade für den Run-Record zurück", () => {
    const state = caseWithIdeas();
    const ctx = build_context(state, samplePack, "check-idea");
    expect(ctx).toMatchObject({ case_id: "case-1", block: "check-idea", revision: state.revision, input_paths: ["/objects/idea/*/title"] });
  });

  it("meldet fehlende konkrete Pfade, statt auf die ganze Akte auszuweichen", () => {
    const pack = withInput("make-idea", ["/objects/note/n9", "/objects/idea/*/missing"]);
    const ctx = build_context(caseWithIdeas(), pack, "make-idea");
    expect(ctx.data).toEqual({});
    expect(ctx.missing).toEqual(["/objects/note/n9"]);
  });

  it("liefert eine Kopie: Änderungen am Kontext berühren die Akte nicht", () => {
    const state = caseWithIdeas();
    const ctx = build_context(state, samplePack, "make-idea");
    (ctx.data as { objects: { note: { n1: { text: string } } } }).objects.note.n1.text = "manipuliert";
    expect(state.objects.note?.n1?.text).toBe("fact");
  });

  it("ein Vertrag mit ungültigem Eingabepfad kommt gar nicht erst durch load_pack", () => {
    expect(() => withInput("make-idea", ["kein pointer"])).toThrow(/ungültig/);
  });

  it("wirft, wenn Akte und Pack nicht zusammenpassen", () => {
    const other = mustLoad({ ...sampleRaw, version: "2.0.0" });
    expect(() => build_context(caseWithIdeas(), other, "make-idea")).toThrow(/sample@1.0.0/);
  });

  it("ein leerer input ergibt einen leeren Kontext", () => {
    const ctx = build_context(caseWithIdeas(), withInput("make-idea", []), "make-idea");
    expect(ctx.data).toEqual({});
  });
});
