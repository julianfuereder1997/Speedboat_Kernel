import { describe, expect, it } from "vitest";
import { apply_patch, build_context, decide_gate, next_allowed_steps, record_run } from "./index.js";
import type { CaseState, Patch } from "./index.js";
import { deepFreeze, editor, newCase, opts, patch, reviewer, samplePack, writerBlock } from "./test-support.js";

function ok<T extends { status: string }>(r: T): Extract<T, { status: "APPLIED" }> {
  if (r.status !== "APPLIED") throw new Error(JSON.stringify(r));
  return r as Extract<T, { status: "APPLIED" }>;
}
const applyP = (s: CaseState, changes: Patch["changes"]) => ok(apply_patch(s, patch(s, changes), editor, samplePack, opts)).case;
function run(s: CaseState, block: string, run_id: string, output: unknown): CaseState {
  const ctx = build_context(s, samplePack, block);
  return ok(record_run(s, { run_id, block, revision: ctx.revision, input_paths: ctx.input_paths, output: output as never }, writerBlock, samplePack, opts)).case;
}

function readyCase(): CaseState {
  let s = applyP(newCase(), [{ op: "add", path: "/objects/idea/i1", new_value: { title: "t" } }]);
  s = run(s, "make-idea", "run-g1", {});
  s = run(s, "check-idea", "run-c1", { findings: [] });
  s = run(s, "lint-idea", "run-v1", { passed: true });
  return deepFreeze(s);
}

describe("next_allowed_steps: Bausteine", () => {
  it("bietet am Anfang nur Bausteine ohne Abhängigkeiten an", () => {
    expect(next_allowed_steps(newCase(), samplePack).blocks).toEqual(["make-idea"]);
  });

  it("bietet Bausteine an, sobald ihre Abhängigkeiten gelaufen sind; erneute Läufe bleiben möglich", () => {
    const s = run(applyP(newCase(), [{ op: "add", path: "/objects/idea/i1", new_value: { title: "t" } }]), "make-idea", "run-g1", {});
    expect(next_allowed_steps(s, samplePack).blocks).toEqual(["make-idea", "check-idea", "lint-idea"]);
  });

  it("verändert die Akte nicht", () => {
    const s = readyCase();
    const before = structuredClone(s);
    next_allowed_steps(s, samplePack);
    expect(s).toEqual(before);
  });
});

describe("next_allowed_steps: Gates", () => {
  it("bietet kein Gate an, solange gate_check nicht erfüllt ist", () => {
    expect(next_allowed_steps(newCase(), samplePack).gates).toEqual([]);
  });

  it("bietet ein entscheidungsreifes Gate an", () => {
    expect(next_allowed_steps(readyCase(), samplePack).gates).toEqual([{ gate: "g1" }]);
  });

  it("nach nicht abschließender Entscheidung erscheint das Gate wieder, mit last_decision", () => {
    const s = ok(decide_gate(readyCase(), samplePack, { gate: "g1", decision: "rework" }, reviewer, opts)).case;
    expect(next_allowed_steps(s, samplePack).gates).toEqual([{ gate: "g1", last_decision: "rework" }]);
    expect(decide_gate(s, samplePack, { gate: "g1", decision: "accept" }, reviewer, opts).status).toBe("APPLIED");
  });

  it("nach abschließender Entscheidung erscheint das Gate nicht mehr, und decide_gate lehnt mit GATE_CLOSED ab", () => {
    const s = ok(decide_gate(readyCase(), samplePack, { gate: "g1", decision: "accept" }, reviewer, opts)).case;
    expect(next_allowed_steps(s, samplePack).gates).toEqual([]);
    for (const decision of ["accept", "rework"]) {
      expect(decide_gate(s, samplePack, { gate: "g1", decision }, reviewer, opts)).toMatchObject({ status: "REJECTED", code: "GATE_CLOSED" });
    }
  });
});
