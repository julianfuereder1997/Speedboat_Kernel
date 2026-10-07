import { describe, expect, it } from "vitest";
import { CaseState, apply_patch, build_context, decide_gate, gate_check, record_run } from "./index.js";
import type { CaseState as CaseStateT, Patch } from "./index.js";
import {
  AT,
  blockWithReviewerRole,
  deepFreeze,
  editor,
  newCase,
  opts,
  outsider,
  patch,
  reviewer,
  samplePack,
  writerBlock,
} from "./test-support.js";

const contractOf = (block: string) => samplePack.blocks.find((b) => b.block === block)!;

function ok<T extends { status: string }>(r: T): Extract<T, { status: "APPLIED" }> {
  if (r.status !== "APPLIED") throw new Error(JSON.stringify(r));
  return r as Extract<T, { status: "APPLIED" }>;
}

const applyP = (s: CaseStateT, changes: Patch["changes"]) => ok(apply_patch(s, patch(s, changes), editor, samplePack, opts)).case;

function run(s: CaseStateT, block: string, run_id: string, output: unknown): CaseStateT {
  const ctx = build_context(contractOf(block), s);
  return ok(record_run(s, { run_id, block, revision: ctx.revision, input_paths: ctx.input_paths, output: output as never }, writerBlock, samplePack, opts)).case;
}

/** Akte, in der g1 erfüllt ist: Generator, Kritiker, aktueller bestandener Validator. */
function readyCase(): CaseStateT {
  let s = applyP(newCase(), [
    { op: "add", path: "/objects/note/n1", new_value: { text: "fact" }, provenance: "CONFIRMED" },
    { op: "add", path: "/objects/idea/i1", new_value: { title: "t", rationale: "r" } },
  ]);
  s = run(s, "make-idea", "run-g1", {});
  s = run(s, "check-idea", "run-c1", { findings: [{ marker: "weak", target: "/objects/idea/i1" }] });
  s = run(s, "lint-idea", "run-v1", { passed: true });
  return deepFreeze(s);
}

describe("gate_check", () => {
  it("ist erfüllt, wenn alle requires gelaufen sind und alle checks aktuell bestanden haben", () => {
    expect(gate_check(readyCase(), samplePack, "g1")).toEqual({ ok: true, gate: "g1", missing: [], failed_checks: [], violations: [] });
  });

  it("meldet fehlende Pflichtbausteine und nicht gelaufene Checks", () => {
    const r = gate_check(newCase(), samplePack, "g1");
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["make-idea", "check-idea"]);
    expect(r.failed_checks).toEqual([{ block: "lint-idea", reason: "not_run" }]);
  });

  it("meldet einen nicht bestandenen Check", () => {
    let s = applyP(newCase(), [{ op: "add", path: "/objects/idea/i1", new_value: { title: "t" } }]);
    s = run(s, "make-idea", "run-g1", {});
    s = run(s, "check-idea", "run-c1", { findings: [] });
    s = run(s, "lint-idea", "run-v1", { passed: false });
    expect(gate_check(s, samplePack, "g1").failed_checks).toEqual([{ block: "lint-idea", reason: "failed", run_id: "run-v1" }]);
  });

  it("zählt einen Validator-Lauf nicht, wenn sich seine Eingaben danach geändert haben", () => {
    const stale = applyP(readyCase(), [{ op: "replace", path: "/objects/idea/i1/title", new_value: "neu" }]);
    expect(gate_check(stale, samplePack, "g1").failed_checks).toEqual([{ block: "lint-idea", reason: "stale", run_id: "run-v1" }]);

    const fresh = run(stale, "lint-idea", "run-v2", { passed: true });
    expect(gate_check(fresh, samplePack, "g1").ok).toBe(true);
  });

  it("zählt den Validator-Lauf weiter, wenn sich nur andere Pfade geändert haben", () => {
    const s = applyP(readyCase(), [{ op: "replace", path: "/objects/note/n1/text", new_value: "anders", provenance: "CONFIRMED" }]);
    expect(gate_check(s, samplePack, "g1").ok).toBe(true);
  });

  it("verlangt, dass jeder Kritiker eine eigene run_id hat, die nicht die eines Generators ist", () => {
    const s = readyCase();
    // Manipulierte Akte (z. B. direkt in der Datenbank geändert): Kritiker-Lauf trägt die run_id des Generators.
    const tampered = CaseState.parse({ ...s, runs: s.runs.map((r) => (r.block === "check-idea" ? { ...r, run_id: "run-g1" } : r)) });
    const r = gate_check(tampered, samplePack, "g1");
    expect(r.ok).toBe(false);
    expect(r.violations).toContainEqual({ run_id: "run-g1", reason: "critic_shares_generator_run_id" });
  });

  it("erkennt doppelte run_ids in der Akte", () => {
    const s = readyCase();
    const tampered = CaseState.parse({ ...s, runs: [...s.runs, { ...s.runs[0]! }] });
    expect(gate_check(tampered, samplePack, "g1").violations).toContainEqual({ run_id: "run-g1", reason: "duplicate_run_id" });
  });

  it("wirft bei unbekanntem Gate", () => {
    expect(() => gate_check(readyCase(), samplePack, "nope")).toThrow(/nope/);
  });
});

describe("decide_gate", () => {
  it("trägt die Entscheidung eines menschlichen Reviewers ein, revision +1, Audit", () => {
    const s = readyCase();
    const r = decide_gate(s, samplePack, { gate: "g1", decision: "accept", reason: "passt" }, reviewer, opts);
    expect(r.status).toBe("APPLIED");
    if (r.status !== "APPLIED") return;
    expect(r.case.decisions).toEqual([{ gate: "g1", decision: "accept", reason: "passt", decided_by: "u-reviewer", at: AT, revision: s.revision + 1 }]);
    expect(r.case.revision).toBe(s.revision + 1);
    expect(r.case.audit.at(-1)).toMatchObject({ action: "decide_gate", ref: "g1", actor: { id: "u-reviewer", kind: "human" } });
    expect(CaseState.safeParse(r.case).success).toBe(true);
  });

  const code = (r: ReturnType<typeof decide_gate>) => (r.status === "REJECTED" ? r.code : r.status);

  it("lehnt ab: Block, auch wenn das Pack ihm die Rolle reviewer gibt", () => {
    expect(code(decide_gate(readyCase(), samplePack, { gate: "g1", decision: "accept" }, blockWithReviewerRole, opts))).toBe("FORBIDDEN");
  });

  it("lehnt ab: Mensch ohne Rolle reviewer", () => {
    expect(code(decide_gate(readyCase(), samplePack, { gate: "g1", decision: "accept" }, editor, opts))).toBe("FORBIDDEN");
    expect(code(decide_gate(readyCase(), samplePack, { gate: "g1", decision: "accept" }, outsider, opts))).toBe("FORBIDDEN");
  });

  it("lehnt eine Entscheidung ab, die das Gate nicht erlaubt", () => {
    expect(code(decide_gate(readyCase(), samplePack, { gate: "g1", decision: "maybe" }, reviewer, opts))).toBe("INVALID_DECISION");
  });

  it("lehnt ab, solange das Gate blockiert ist", () => {
    const r = decide_gate(newCase(), samplePack, { gate: "g1", decision: "accept" }, reviewer, opts);
    expect(code(r)).toBe("GATE_BLOCKED");
  });

  it("lehnt ein unbekanntes Gate ab", () => {
    expect(code(decide_gate(readyCase(), samplePack, { gate: "zz", decision: "accept" }, reviewer, opts))).toBe("UNKNOWN_GATE");
  });
});
