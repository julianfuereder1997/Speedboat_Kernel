import { describe, expect, it } from "vitest";
import { ModelError } from "@speedboat/adapters";
import { CaseState, create_case } from "@speedboat/core";
import { execute_block, RetryableRunError, type ExecuteDeps, type RunJob } from "./index.js";
import { AT, bundle, deps, human, items, seedCase } from "./test-support.js";

const job = (block: string, run_id = `run-${block}`): RunJob => ({ run_id, case_id: "case-1", block, requested_by: "u-dev" });
const opts = { maxAttempts: 3 };

/** Führt den Generator erfolgreich aus und liefert die Akte danach. */
async function afterGenerator(d: ReturnType<typeof deps>) {
  await seedCase(d.state);
  const r = await execute_block(d, job("propose"), 1, opts);
  expect(r.status).toBe("done");
  return (await d.state.load("case-1"))!;
}

async function expectRetry(p: Promise<unknown>, code: string) {
  const e = await p.then(
    () => {
      throw new Error("erwartet RetryableRunError");
    },
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(RetryableRunError);
  expect(e).toMatchObject({ code });
}

describe("execute_block: Generator", () => {
  it("baut den Prompt aus Skill und Kontext, ruft das Modell über den Hint, trägt Lauf und Patch ein", async () => {
    const d = deps([{ output: { items }, model: "m-default" }]);
    const before = await seedCase(d.state);
    const r = await execute_block(d, job("propose"), 1, opts);

    expect(r).toEqual({ status: "done", run_id: "run-propose", revision: before.revision + 2, patch: "APPLIED" });
    expect(d.model.calls).toHaveLength(1);
    expect(d.model.calls[0]).toMatchObject({ model_hint: "default", prompt: { system: expect.stringContaining("Propose items") } });

    const s = (await d.state.load("case-1"))!;
    expect(CaseState.safeParse(s).success).toBe(true);
    expect(s.runs).toEqual([
      expect.objectContaining({ run_id: "run-propose", block: "propose", block_type: "generate", revision: before.revision, requested_by: "u-dev", output: { items } }),
    ]);
    expect(s.objects["item"]).toEqual({
      "run-propose-0": { label: "Erstes", reason: "GEHEIME BEGRÜNDUNG A", _provenance: "GENERATED" },
      "run-propose-1": { label: "Zweites", reason: "GEHEIME BEGRÜNDUNG B", _provenance: "GENERATED" },
    });
    expect(s.audit.slice(-2)).toEqual([
      expect.objectContaining({ action: "record_run", actor: { id: "propose", kind: "block" } }),
      expect.objectContaining({ action: "apply_patch", ref: "run-propose-patch", actor: { id: "propose", kind: "block" } }),
    ]);
    expect(await d.attempts.list("run-propose")).toEqual([]);
  });

  it("ist idempotent: ein bereits eingetragener Lauf wird nicht erneut ausgeführt", async () => {
    const d = deps([{ output: { items } }]);
    await seedCase(d.state);
    await execute_block(d, job("propose"), 1, opts);
    const s = await d.state.load("case-1");
    expect(await execute_block(d, job("propose"), 2, opts)).toMatchObject({ status: "done", run_id: "run-propose" });
    expect(d.model.calls).toHaveLength(1);
    expect(await d.state.load("case-1")).toEqual(s);
  });
});

describe("execute_block: Kritiker", () => {
  it("frischer Aufruf ohne Verlauf; sieht nie die Begründungen; Befunde nur im Run-Record", async () => {
    const d = deps((call) =>
      call.model_hint === "default"
        ? { output: { items } }
        : { output: { findings: [{ marker: "vague", target: "/objects/item/run-propose-0" }] }, model: "m-frontier" },
    );
    const s1 = await afterGenerator(d);
    const r = await execute_block(d, job("review"), 1, opts);

    expect(r).toEqual({ status: "done", run_id: "run-review", revision: s1.revision + 1 });
    expect(d.model.calls).toHaveLength(2);
    const critic = d.model.calls[1]!;
    expect(critic.model_hint).toBe("frontier");
    expect(Object.keys(critic.prompt)).toEqual(["system", "user"]); // genau ein system- und ein user-Teil, kein Verlauf
    expect(critic.prompt.system).not.toContain(d.model.calls[0]!.prompt.system);
    expect(JSON.stringify(critic)).not.toContain("GEHEIME BEGRÜNDUNG");
    expect(critic.prompt.user).toContain('"label": "Erstes"');

    const s2 = (await d.state.load("case-1"))!;
    expect(s2.objects).toEqual(s1.objects);
    expect(s2.runs.at(-1)).toMatchObject({ run_id: "run-review", block_type: "critic", output: { findings: [{ marker: "vague" }] } });
  });
});

describe("execute_block: Fehler lassen die Akte unverändert", () => {
  it("wiederholbarer Modellfehler: Wiederholung, Versuch protokolliert, Akte gleich", async () => {
    const d = deps([{ error: new ModelError("API_ERROR", "überlastet", true, "m-default") }]);
    const before = await seedCase(d.state);
    await expectRetry(execute_block(d, job("propose"), 1, opts), "MODEL_API_ERROR");
    expect(await d.state.load("case-1")).toEqual(before);
    expect(await d.attempts.list("run-propose")).toEqual([
      { run_id: "run-propose", case_id: "case-1", block: "propose", attempt: 1, code: "MODEL_API_ERROR", message: "überlastet", model: "m-default", at: AT },
    ]);
  });

  it("beim letzten erlaubten Versuch wird ein wiederholbarer Fehler endgültig", async () => {
    const d = deps([{ error: new ModelError("MAX_TOKENS", "abgeschnitten", true, "m-default") }]);
    await seedCase(d.state);
    expect(await execute_block(d, job("propose"), 3, opts)).toMatchObject({ status: "failed", code: "MODEL_MAX_TOKENS", message: "abgeschnitten" });
  });

  it("Ablehnung durch das Modell: endgültig, mit Grund, Modell und Tokens im Protokoll", async () => {
    const d = deps([{ error: new ModelError("REFUSAL", "Das Modell hat abgelehnt (cyber)", false, "m-default", { input_tokens: 50, output_tokens: 0 }) }]);
    const before = await seedCase(d.state);
    expect(await execute_block(d, job("propose"), 1, opts)).toEqual({
      status: "failed",
      run_id: "run-propose",
      code: "MODEL_REFUSAL",
      message: "Das Modell hat abgelehnt (cyber)",
    });
    expect(await d.state.load("case-1")).toEqual(before);
    expect(await d.attempts.list("run-propose")).toEqual([
      expect.objectContaining({ attempt: 1, code: "MODEL_REFUSAL", model: "m-default", input_tokens: 50, output_tokens: 0 }),
    ]);
  });

  it("abgelehnte Ausgabe: genau eine Wiederholung, danach endgültig; beide Versuche protokolliert", async () => {
    const bad = { output: { findings: [{ marker: "boring", target: "/objects/item/run-propose-0" }] }, model: "m-frontier" };
    const d = deps((call) => (call.model_hint === "default" ? { output: { items } } : bad));
    const s1 = await afterGenerator(d);

    await expectRetry(execute_block(d, job("review"), 1, opts), "OUTPUT_REJECTED");
    expect(await execute_block(d, job("review"), 2, opts)).toMatchObject({ status: "failed", code: "OUTPUT_REJECTED", message: expect.stringContaining("UNKNOWN_MARKER") });
    expect(await d.state.load("case-1")).toEqual(s1);
    const log = await d.attempts.list("run-review");
    expect(log.map((e) => [e.attempt, e.code, e.model])).toEqual([
      [1, "OUTPUT_REJECTED", "m-frontier"],
      [2, "OUTPUT_REJECTED", "m-frontier"],
    ]);
  });

  it("Ausgabe, die das Objektschema verletzt, wird als abgelehnte Ausgabe behandelt", async () => {
    const d = deps([{ output: { items: [{ label: "", reason: "x" }] } }]); // minLength im Pack-Schema
    const before = await seedCase(d.state);
    await expectRetry(execute_block(d, job("propose"), 1, opts), "OUTPUT_REJECTED");
    expect(await d.state.load("case-1")).toEqual(before);
    expect((await d.attempts.list("run-propose"))[0]?.message).toMatch(/SCHEMA_VIOLATION/);
  });

  it("Konflikt beim Speichern: Wiederholung, der Stand des anderen Schreibers bleibt", async () => {
    const d = deps([{ output: { items } }]);
    await seedCase(d.state);
    const realLoad = d.state.load.bind(d.state);
    let other: CaseState | undefined;
    d.state.load = async (id: string) => {
      const s = await realLoad(id);
      // Zwischen Laden und Speichern schreibt jemand anderes.
      const changed = structuredClone(s!);
      changed.revision += 1;
      changed.audit.push({ ...changed.audit.at(-1)!, revision: changed.revision, ref: "fremd" });
      other = changed;
      await d.state.save(changed, s!.revision);
      return s;
    };
    await expectRetry(execute_block(d, job("propose"), 1, opts), "REVISION_CONFLICT");
    expect(await realLoad("case-1")).toEqual(other);
  });

  it.each([
    ["Akte fehlt", { case_id: "nope" }, "CASE_NOT_FOUND"],
    ["Baustein unbekannt", { block: "ghost" }, "UNKNOWN_BLOCK"],
    ["kein Modell-Baustein", { block: "lint" }, "NOT_A_MODEL_BLOCK"],
    ["Abhängigkeit nicht erfüllt", { block: "review" }, "DEPENDENCY_NOT_MET"],
  ])("deterministischer Fehler ist sofort endgültig: %s", async (_n, over, code) => {
    const d = deps([]);
    const before = await seedCase(d.state);
    expect(await execute_block(d, { ...job("propose"), ...over }, 1, opts)).toMatchObject({ status: "failed", code });
    expect(d.model.calls).toHaveLength(0);
    expect(await d.state.load("case-1")).toEqual(before);
  });

  it("fehlende Eingabe ist endgültig", async () => {
    const d = deps([]);
    await d.state.create(create_case({ case_id: "case-1", pack: bundle.pack, actor: human }, { now: () => AT }));
    expect(await execute_block(d, job("propose"), 1, opts)).toMatchObject({ status: "failed", code: "INPUT_MISSING" });
    expect(d.model.calls).toHaveLength(0);
  });
});
