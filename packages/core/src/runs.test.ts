import { describe, expect, it } from "vitest";
import { CaseState, apply_patch, build_context, record_run } from "./index.js";
import type { CaseState as CaseStateT, RunInput } from "./index.js";
import { AT, deepFreeze, editor, mustLoad, newCase, opts, patch, samplePack, sampleRaw, writerBlock } from "./test-support.js";

/** Akte mit einer Idee, ohne Lauf. */
function caseWithIdeaOnly(): CaseStateT {
  const s0 = newCase();
  const r = apply_patch(s0, patch(s0, [{ op: "add", path: "/objects/idea/i1", new_value: { title: "t", rationale: "r" } }]), editor, samplePack, opts);
  if (r.status !== "APPLIED") throw new Error(JSON.stringify(r));
  return deepFreeze(r.case);
}

/** Akte mit einer Idee und einem Generator-Lauf, sodass Kritiker und Validator laufen dürfen. */
function caseWithIdea(): CaseStateT {
  const s = caseWithIdeaOnly();
  const r = record_run(s, runFor(s, "make-idea", "run-gen", {}), writerBlock, samplePack, opts);
  if (r.status !== "APPLIED") throw new Error(JSON.stringify(r));
  return deepFreeze(r.case);
}


function runFor(state: CaseStateT, block: string, run_id: string, output: unknown): RunInput {
  const ctx = build_context(state, samplePack, block);
  return { run_id, block, revision: ctx.revision, input_paths: ctx.input_paths, output: output as RunInput["output"] };
}

describe("record_run → APPLIED", () => {
  it("speichert run_id, Baustein, Zeitpunkt, Revision und Eingabepfade; revision +1 und Audit", () => {
    const s = caseWithIdeaOnly();
    const r = record_run(s, runFor(s, "make-idea", "run-g1", { anything: true }), writerBlock, samplePack, opts);
    expect(r.status).toBe("APPLIED");
    if (r.status !== "APPLIED") return;
    expect(r.case.runs).toEqual([
      { run_id: "run-g1", block: "make-idea", block_type: "generate", at: AT, revision: s.revision, input_paths: ["/objects/note"], output: { anything: true } },
    ]);
    expect(r.case.revision).toBe(s.revision + 1);
    expect(r.case.audit.at(-1)).toMatchObject({ action: "record_run", ref: "run-g1", paths: [], actor: { id: "make-idea", kind: "block" } });
    expect(r.case.objects).toEqual(s.objects);
    expect(CaseState.safeParse(r.case).success).toBe(true);
  });

  it("speichert, welcher Mensch den Lauf angestoßen hat", () => {
    const s = caseWithIdeaOnly();
    const r = record_run(s, { ...runFor(s, "make-idea", "run-g1", {}), requested_by: "u-editor" }, writerBlock, samplePack, opts);
    if (r.status !== "APPLIED") throw new Error(JSON.stringify(r));
    expect(r.case.runs.at(-1)?.requested_by).toBe("u-editor");
    expect(CaseState.safeParse(r.case).success).toBe(true);
  });

  it("akzeptiert Kritiker-Ausgaben mit bekannten Markern", () => {
    const s = caseWithIdea();
    const out = { findings: [{ marker: "weak", target: "/objects/idea/i1" }, { marker: "unclear", target: "/objects/idea/i1" }] };
    expect(record_run(s, runFor(s, "check-idea", "run-c1", out), writerBlock, samplePack, opts).status).toBe("APPLIED");
  });

  it("akzeptiert Kritiker-Ausgaben ohne Befund", () => {
    const s = caseWithIdea();
    expect(record_run(s, runFor(s, "check-idea", "run-c1", { findings: [] }), writerBlock, samplePack, opts).status).toBe("APPLIED");
  });
});

describe("record_run: Abhängigkeiten", () => {
  it("lehnt einen Lauf ab, dessen Abhängigkeiten noch nicht gelaufen sind", () => {
    const s = caseWithIdeaOnly();
    const r = record_run(s, runFor(s, "check-idea", "run-c1", { findings: [] }), writerBlock, samplePack, opts);
    expect(r).toMatchObject({ status: "REJECTED", code: "DEPENDENCY_NOT_MET", details: { missing: ["make-idea"] } });
  });

  it("nimmt den Lauf an, sobald die Abhängigkeit gelaufen ist", () => {
    const s = caseWithIdea();
    expect(record_run(s, runFor(s, "lint-idea", "run-v1", { passed: true }), writerBlock, samplePack, opts).status).toBe("APPLIED");
  });
});

describe("record_run → REJECTED", () => {
  const code = (s: CaseStateT, run: RunInput, pack = samplePack) => {
    const r = record_run(s, run, writerBlock, pack, opts);
    return r.status === "REJECTED" ? r.code : r.status;
  };

  it("bei unbekanntem Marker in der Kritiker-Ausgabe", () => {
    const s = caseWithIdea();
    expect(code(s, runFor(s, "check-idea", "run-c1", { findings: [{ marker: "weak", target: "/objects/idea/i1" }, { marker: "invented", target: "/objects/idea/i1" }] }))).toBe("UNKNOWN_MARKER");
  });

  it("bei Marker, der im Pack steht, aber nicht im Vertrag des Kritikers", () => {
    const pack = mustLoad({ ...sampleRaw, markers: [...sampleRaw.markers, { id: "other" }] });
    const s = caseWithIdea();
    expect(code(s, runFor(s, "check-idea", "run-c1", { findings: [{ marker: "other", target: "/objects/idea/i1" }] }), pack)).toBe("UNKNOWN_MARKER");
  });

  it("bei Kritiker-Ausgabe ohne findings-Liste", () => {
    const pack = mustLoad({
      ...sampleRaw,
      blocks: sampleRaw.blocks.map((b) => (b.block === "check-idea" ? { ...b, output_schema: { type: "object" } } : b)),
    });
    const s = caseWithIdea();
    expect(code(s, runFor(s, "check-idea", "run-c1", { verdict: "fine" }), pack)).toBe("INVALID_RUN");
  });

  it("bei Befund ohne target oder mit target, das kein ganzes Objekt ist", () => {
    const pack = mustLoad({
      ...sampleRaw,
      blocks: sampleRaw.blocks.map((b) => (b.block === "check-idea" ? { ...b, output_schema: { type: "object" } } : b)),
    });
    const s = caseWithIdea();
    expect(code(s, runFor(s, "check-idea", "run-c1", { findings: [{ marker: "weak" }] }), pack)).toBe("INVALID_RUN");
    expect(code(s, runFor(s, "check-idea", "run-c2", { findings: [{ marker: "weak", target: "/objects/idea/i1/title" }] }), pack)).toBe("INVALID_RUN");
  });

  it("bei target, das in der Akte nicht existiert", () => {
    const s = caseWithIdea();
    expect(code(s, runFor(s, "check-idea", "run-c1", { findings: [{ marker: "weak", target: "/objects/idea/i9" }] }))).toBe("INVALID_RUN");
  });

  it("bei target außerhalb dessen, was der Kritiker laut Vertrag sehen durfte", () => {
    const s0 = caseWithIdea();
    const r = apply_patch(s0, patch(s0, [{ op: "add", path: "/objects/note/n1", new_value: { text: "x" }, provenance: "CONFIRMED" }]), editor, samplePack, opts);
    if (r.status !== "APPLIED") throw new Error();
    expect(code(r.case, runFor(r.case, "check-idea", "run-c1", { findings: [{ marker: "weak", target: "/objects/note/n1" }] }))).toBe("INVALID_RUN");
  });

  it("bei Validator-Ausgabe ohne passed", () => {
    const pack = mustLoad({
      ...sampleRaw,
      blocks: sampleRaw.blocks.map((b) => (b.block === "lint-idea" ? { ...b, output_schema: { type: "object" } } : b)),
    });
    const s = caseWithIdea();
    expect(code(s, runFor(s, "lint-idea", "run-v1", { ok: true }), pack)).toBe("INVALID_RUN");
  });

  it("bei Ausgabe, die das output_schema verletzt", () => {
    const s = caseWithIdea();
    expect(code(s, runFor(s, "lint-idea", "run-v1", { passed: "yes" }))).toBe("SCHEMA_VIOLATION");
  });

  it("bei wiederverwendeter run_id, auch wenn ein Kritiker die run_id eines Generators nimmt", () => {
    const s0 = caseWithIdeaOnly();
    const r = record_run(s0, runFor(s0, "make-idea", "run-1", {}), writerBlock, samplePack, opts);
    if (r.status !== "APPLIED") throw new Error();
    expect(code(r.case, runFor(r.case, "check-idea", "run-1", { findings: [] }))).toBe("DUPLICATE_RUN_ID");
  });

  it("bei unbekanntem Baustein", () => {
    const s = caseWithIdea();
    expect(code(s, { ...runFor(s, "make-idea", "run-x", {}), block: "ghost" })).toBe("UNKNOWN_BLOCK");
  });

  it("wenn die Eingabepfade nicht dem Vertrag entsprechen", () => {
    const s = caseWithIdea();
    expect(code(s, { ...runFor(s, "check-idea", "run-c1", { findings: [] }), input_paths: ["/objects/idea"] })).toBe("INVALID_RUN");
  });

  it("wenn die Revision in der Zukunft liegt", () => {
    const s = caseWithIdea();
    expect(code(s, { ...runFor(s, "make-idea", "run-g", {}), revision: s.revision + 1 })).toBe("INVALID_RUN");
  });

  it("wenn Akte und Pack nicht zusammenpassen", () => {
    const s = caseWithIdea();
    const run = runFor(s, "make-idea", "run-g", {});
    expect(code({ ...s, pack: "other" }, run)).toBe("PACK_MISMATCH");
  });
});
