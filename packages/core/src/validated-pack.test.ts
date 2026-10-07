import { describe, expect, it } from "vitest";
import {
  Pack,
  apply_patch,
  build_context,
  create_case,
  decide_gate,
  freeze,
  gate_check,
  load_pack,
  next_allowed_steps,
  record_run,
  type ValidatedPack,
} from "./index.js";
import { editor, newCase, opts, reviewer, samplePack, sampleRaw } from "./test-support.js";

describe("load_pack", () => {
  it("liefert für ein gültiges Pack ein ValidatedPack und die Warnungen", () => {
    const r = load_pack(sampleRaw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pack.pack).toBe("sample");
    expect(r.warnings).toEqual([]);
  });

  it("liefert für ein ungültiges Pack kein Pack, nur die Fehler", () => {
    const r = load_pack({ ...sampleRaw, dependencies: { "make-idea": ["ghost"] } });
    expect(r.ok).toBe(false);
    expect(r).not.toHaveProperty("pack");
    if (r.ok) return;
    expect(r.errors.map((e) => e.code)).toContain("UNKNOWN_BLOCK");
  });

  it("friert das geprüfte Pack tief ein, damit es nach der Prüfung nicht verändert werden kann", () => {
    const r = load_pack(sampleRaw);
    if (!r.ok) throw new Error();
    expect(Object.isFrozen(r.pack)).toBe(true);
    expect(Object.isFrozen(r.pack.gates["g1"]!.requires)).toBe(true);
    expect(() => (r.pack.gates["g1"]!.requires as string[]).push("x")).toThrow(TypeError);
  });

  it("verändert die Eingabe nicht", () => {
    const raw = structuredClone(sampleRaw);
    load_pack(raw);
    expect(Object.isFrozen(raw)).toBe(false);
    expect(raw).toEqual(sampleRaw);
  });
});

describe("Kernfunktionen nehmen nur ein ValidatedPack an", () => {
  // Ein strukturell gültiges, aber nie per load_pack geprüftes Pack, an der Typprüfung vorbeigeschmuggelt.
  const unchecked = Pack.parse(sampleRaw) as ValidatedPack;
  const s = newCase();
  const p = { patch_id: "p", case_id: s.case_id, base_revision: s.revision, changes: [{ op: "remove" as const, path: "/objects/idea/i1" }] };
  const run = { run_id: "r", block: "make-idea", revision: 0, input_paths: ["/objects/note"], output: {} };

  it.each([
    ["create_case", () => create_case({ case_id: "c", pack: unchecked, actor: editor }, opts)],
    ["apply_patch", () => apply_patch(s, p, editor, unchecked, opts)],
    ["build_context", () => build_context(s, unchecked, "make-idea")],
    ["record_run", () => record_run(s, run, editor, unchecked, opts)],
    ["gate_check", () => gate_check(s, unchecked, "g1")],
    ["decide_gate", () => decide_gate(s, unchecked, { gate: "g1", decision: "accept" }, reviewer, opts)],
    ["freeze", () => freeze(s, "/objects/idea/i1", reviewer, unchecked, opts)],
    ["next_allowed_steps", () => next_allowed_steps(s, unchecked)],
  ])("%s wirft bei einem ungeprüften Pack", (_name, call) => {
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/load_pack/);
  });

  it("ein ungeprüftes Pack lässt sich gar nicht erst übergeben (Typprüfung)", () => {
    const plain: Pack = Pack.parse(sampleRaw);
    const check = () => {
      // @ts-expect-error Pack ist kein ValidatedPack
      apply_patch(s, p, editor, plain, opts);
      // @ts-expect-error Pack ist kein ValidatedPack
      gate_check(s, plain, "g1");
      // @ts-expect-error Pack ist kein ValidatedPack
      build_context(s, plain, "make-idea");
      // @ts-expect-error Pack ist kein ValidatedPack
      decide_gate(s, plain, { gate: "g1", decision: "accept" }, reviewer, opts);
      // @ts-expect-error Pack ist kein ValidatedPack
      freeze(s, "/objects/idea/i1", reviewer, plain, opts);
    };
    expect(check).toThrow(TypeError);
  });

  it("ein geprüftes Pack wird angenommen", () => {
    expect(() => gate_check(newCase(), samplePack, "g1")).not.toThrow();
  });
});

describe("build_context nimmt den Vertrag aus dem Pack", () => {
  it("wirft bei einem Baustein, den das Pack nicht kennt", () => {
    expect(() => build_context(newCase(), samplePack, "ghost")).toThrow(/ghost/);
  });
});
