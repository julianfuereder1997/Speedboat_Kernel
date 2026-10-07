import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  Pack,
  apply_patch,
  build_context,
  create_case,
  decide_gate,
  freeze,
  gate_check,
  record_run,
  validate_pack,
  type Actor,
  type Applied,
  type CaseState,
  type Rejected,
} from "@speedboat/core";

const raw = readFileSync(new URL("./pack.json", import.meta.url), "utf8");
const pack = Pack.parse(JSON.parse(raw));
const opts = { now: () => "2026-10-07T10:00:00.000Z" };

const editor: Actor = { id: "u-editor", kind: "human", roles: ["editor"] };
const reviewer: Actor = { id: "u-reviewer", kind: "human", roles: ["reviewer"] };
const generator: Actor = { id: "propose-names", kind: "block", roles: ["generator"] };
const critic: Actor = { id: "challenge-names", kind: "block", roles: [] };
const contractOf = (block: string) => pack.blocks.find((b) => b.block === block)!;

function ok(r: Applied | Rejected | { status: string }): CaseState {
  if (r.status !== "APPLIED") throw new Error(JSON.stringify(r));
  return (r as Applied).case;
}

describe("Demo-Pack: Aufbau", () => {
  it("ist ein gültiges Pack aus reinen Daten", () => {
    expect(pack.pack).toBe("demo-naming");
    expect(JSON.parse(JSON.stringify(pack))).toEqual(pack);
  });

  it("besteht validate_pack ohne Fehler und ohne Warnungen", () => {
    expect(validate_pack(JSON.parse(raw))).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it("hat genau einen Generator, einen Kritiker mit zwei Markern und ein Gate", () => {
    expect(pack.blocks.map((b) => b.type).sort()).toEqual(["critic", "generate"]);
    expect(contractOf("challenge-names").markers).toEqual(["too_generic", "hard_to_pronounce"]);
    expect(pack.markers.map((m) => m.id)).toEqual(["too_generic", "hard_to_pronounce"]);
    expect(Object.keys(pack.gates)).toEqual(["name-review"]);
  });

  it("enthält keine Inhalte aus dem Förderkontext", () => {
    expect(raw).not.toMatch(/(?<![a-z])ffg(?![a-z])|f(ö|oe)rder|antrag|constitution|framing|(?<![a-z])qg\d/i);
  });
});

describe("Demo-Pack: Ablauf durch den Kern", () => {
  it("läuft von der Akte bis zur Gate-Entscheidung und zum Siegel", () => {
    // 1. Akte anlegen, Briefing mit Provenienz eintragen
    let s = create_case({ case_id: "demo-1", pack, actor: editor }, opts);
    s = ok(
      apply_patch(
        s,
        {
          patch_id: "p-brief",
          case_id: s.case_id,
          base_revision: s.revision,
          changes: [{ op: "add", path: "/objects/brief/main", new_value: { product: "Reusable coffee cup", audience: "Commuters" }, provenance: "USER_INPUT" }],
        },
        editor,
        pack,
        opts,
      ),
    );

    // 2. Generator: Kontext bauen, Lauf eintragen, Vorschläge als Patch einspielen
    const genCtx = build_context(contractOf("propose-names"), s);
    expect(genCtx.data).toEqual({ objects: { brief: { main: { product: "Reusable coffee cup", audience: "Commuters", _provenance: "USER_INPUT" } } } });
    const candidates = [
      { name: "Loopcup", rationale: "GEHEIM: wirkt kreislauffähig" },
      { name: "Cup", rationale: "GEHEIM: kurz" },
    ];
    s = ok(record_run(s, { run_id: "run-gen-1", block: "propose-names", revision: genCtx.revision, input_paths: genCtx.input_paths, output: { candidates } }, generator, pack, opts));
    s = ok(
      apply_patch(
        s,
        {
          patch_id: "p-candidates",
          case_id: s.case_id,
          base_revision: s.revision,
          changes: candidates.map((c, i) => ({ op: "add" as const, path: `/objects/candidate/c${i + 1}`, new_value: c })),
        },
        generator,
        pack,
        opts,
      ),
    );

    // 3. Kritiker: sieht Namen, nie die Begründungen
    const criticCtx = build_context(contractOf("challenge-names"), s);
    expect(JSON.stringify(criticCtx)).not.toContain("GEHEIM");
    expect(JSON.stringify(criticCtx)).not.toContain("rationale");
    expect(criticCtx.data).toMatchObject({ objects: { candidate: { c1: { name: "Loopcup" }, c2: { name: "Cup" } } } });
    // Der Kritiker sieht, dass das Briefing belegt ist und nicht angenommen.
    expect(criticCtx.data).toMatchObject({ objects: { brief: { main: { _provenance: "USER_INPUT" } } } });

    const criticRun = (run_id: string, marker: string) => ({
      run_id,
      block: "challenge-names",
      revision: criticCtx.revision,
      input_paths: criticCtx.input_paths,
      output: { findings: [{ marker, target: "/objects/candidate/c2" }] },
    });
    expect(record_run(s, criticRun("run-crit-1", "boring"), critic, pack, opts)).toMatchObject({ status: "REJECTED", code: "UNKNOWN_MARKER" });
    expect(record_run(s, criticRun("run-gen-1", "too_generic"), critic, pack, opts)).toMatchObject({ status: "REJECTED", code: "DUPLICATE_RUN_ID" });
    s = ok(record_run(s, criticRun("run-crit-1", "too_generic"), critic, pack, opts));

    // 4. Gate: geprüft, ein Block darf nicht entscheiden, der Reviewer schon
    expect(gate_check(s, pack, "name-review").ok).toBe(true);
    expect(decide_gate(s, pack, { gate: "name-review", decision: "approve" }, generator, opts)).toMatchObject({ status: "REJECTED", code: "FORBIDDEN" });
    s = ok(decide_gate(s, pack, { gate: "name-review", decision: "approve", reason: "Loopcup trägt" }, reviewer, opts));

    // 5. Gewählten Namen versiegeln; danach nur noch per Change Request
    s = ok(freeze(s, "/objects/candidate/c1", reviewer, pack, opts));
    const change = apply_patch(
      s,
      { patch_id: "p-rename", case_id: s.case_id, base_revision: s.revision, changes: [{ op: "replace", path: "/objects/candidate/c1/name", new_value: "Loopkup" }] },
      editor,
      pack,
      opts,
    );
    expect(change.status).toBe("REVIEW_REQUIRED");
    if (change.status !== "REVIEW_REQUIRED") return;
    expect(change.case.objects.candidate?.c1?.name).toBe("Loopcup");

    expect(change.case.revision).toBe(7); // acht Audit-Einträge, Revisionen 0–7
    expect(change.case.audit.map((e) => e.action)).toEqual([
      "create_case",
      "apply_patch",
      "record_run",
      "apply_patch",
      "record_run",
      "decide_gate",
      "freeze",
      "change_request",
    ]);
  });
});
