import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeModelAdapter, MemoryAttemptLog, MemoryStateAdapter, ModelConfig, ModelError, type FakeReply } from "@speedboat/adapters";
import { CaseState } from "@speedboat/core";
import { InlineRunQueue, load_pack_dir, PackRegistry } from "@speedboat/runtime";
import { assert_startup_config, create_app } from "./index.js";

const FIXTURE = fileURLToPath(new URL("../../runtime/src/test-fixtures/pack", import.meta.url));
const models = ModelConfig.parse({ models: { default: { model: "m-default" }, frontier: { model: "m-frontier" } } });
const bundle = load_pack_dir(FIXTURE, { models });
const dev = { id: "u-dev", kind: "human", roles: ["editor"] };
const items = [{ label: "Eins", reason: "r1" }];

function setup(replies: FakeReply[] | ((c: { model_hint: string }) => FakeReply) = [], devAuth = true) {
  const state = new MemoryStateAdapter();
  const attempts = new MemoryAttemptLog();
  const model = new FakeModelAdapter(replies);
  const packs = new PackRegistry([bundle]);
  const queue = new InlineRunQueue({ state, model, attempts, packs }, { maxAttempts: 3 });
  let n = 0;
  const app = create_app({ state, queue, packs, attempts, devAuth, newId: () => `id-${++n}` });
  const call = (method: string, path: string, body?: unknown, actor: unknown = dev) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json", ...(actor ? { "x-speedboat-actor": JSON.stringify(actor) } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  return { app, call, state, queue, model, attempts };
}

const seed = { pack: "runtime-fixture", objects: [{ type: "source", id: "s1", value: { text: "Quelle" }, provenance: "USER" }] };

async function json(res: Response) {
  return (await res.json()) as any;
}

describe("Akteur (Entwicklungsmodus)", () => {
  it("ohne Akteur: 401", async () => {
    const { call } = setup();
    expect((await call("GET", "/cases/x", undefined, null)).status).toBe(401);
  });

  it("ohne SPEEDBOAT_DEV_AUTH wird der Header nicht akzeptiert: 401", async () => {
    const { call } = setup([], false);
    const res = await call("GET", "/cases/x");
    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe("UNAUTHENTICATED");
  });

  it("ungültiger Akteur: 400; Block als Akteur: 403", async () => {
    const { app, call } = setup();
    expect((await app.request("/cases/x", { headers: { "x-speedboat-actor": "{kein json" } })).status).toBe(400);
    expect((await call("GET", "/cases/x", undefined, { id: "b", kind: "block", roles: [] })).status).toBe(403);
  });
});

describe("POST /cases", () => {
  it("legt eine Akte an und trägt Startobjekte im Namen des Menschen per apply_patch ein", async () => {
    const { call, state } = setup();
    const res = await call("POST", "/cases", { ...seed, case_id: "c1" });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.case).toMatchObject({ case_id: "c1", revision: 1, objects: { source: { s1: { text: "Quelle", _provenance: "USER" } } } });
    expect(body.case.audit.map((e: any) => [e.action, e.actor.id])).toEqual([
      ["create_case", "u-dev"],
      ["apply_patch", "u-dev"],
    ]);
    expect(CaseState.safeParse(await state.load("c1")).success).toBe(true);
  });

  it("ohne Startobjekte: Revision 0; ohne case_id wird eine erzeugt", async () => {
    const { call } = setup();
    const body = await json(await call("POST", "/cases", { pack: "runtime-fixture" }));
    expect(body.case).toMatchObject({ case_id: "id-1", revision: 0 });
  });

  it("unbekanntes Pack: 404", async () => {
    const { call } = setup();
    expect((await call("POST", "/cases", { pack: "ghost" })).status).toBe(404);
  });

  it("abgelehnte Startobjekte: 422 mit dem Code des Kerns, es entsteht keine Akte", async () => {
    const { call, state } = setup();
    const noProv = await call("POST", "/cases", { pack: "runtime-fixture", case_id: "c2", objects: [{ type: "source", id: "s1", value: { text: "x" } }] });
    expect(noProv.status).toBe(422);
    expect((await json(noProv)).error.code).toBe("MISSING_PROVENANCE");
    const badSchema = await call("POST", "/cases", { pack: "runtime-fixture", case_id: "c2", objects: [{ type: "source", id: "s1", value: { text: 5 }, provenance: "USER" }] });
    expect((await json(badSchema)).error.code).toBe("SCHEMA_VIOLATION");
    expect(await state.load("c2")).toBeNull();
  });

  it("ungültiger Body: 400; vorhandene case_id: 409", async () => {
    const { call } = setup();
    expect((await call("POST", "/cases", { pack: 7 })).status).toBe(400);
    await call("POST", "/cases", { ...seed, case_id: "c1" });
    expect((await call("POST", "/cases", { ...seed, case_id: "c1" })).status).toBe(409);
  });
});

describe("GET /cases/:id und /next-steps", () => {
  it("liefert die Akte und die erlaubten Schritte; unbekannt: 404", async () => {
    const { call } = setup();
    await call("POST", "/cases", { ...seed, case_id: "c1" });
    expect((await json(await call("GET", "/cases/c1"))).case.revision).toBe(1);
    expect(await json(await call("GET", "/cases/c1/next-steps"))).toEqual({ blocks: ["propose"], gates: [] });
    expect((await call("GET", "/cases/nope")).status).toBe(404);
    expect((await call("GET", "/cases/nope/next-steps")).status).toBe(404);
  });
});

describe("POST /cases/:id/runs und GET /cases/:id/runs/:run_id", () => {
  it("reiht den Lauf ein, gibt sofort eine run_id zurück und meldet später das Ergebnis samt Run-Record", async () => {
    const { call, queue } = setup([{ output: { items } }]);
    await call("POST", "/cases", { ...seed, case_id: "c1" });
    const res = await call("POST", "/cases/c1/runs", { block: "propose" });
    expect(res.status).toBe(202);
    const { run_id } = await json(res);
    expect(run_id).toBe("id-1");
    await queue.idle();
    const run = await json(await call("GET", `/cases/c1/runs/${run_id}`));
    expect(run).toMatchObject({
      run_id,
      state: "done",
      attempts: 1,
      outcome: { status: "done", patch: "APPLIED" },
      record: { run_id, block: "propose", requested_by: "u-dev" },
      rejected_attempts: [],
    });
  });

  it("meldet abgelehnte Versuche mit Grund", async () => {
    const { call, queue } = setup([{ error: new ModelError("REFUSAL", "Das Modell hat abgelehnt (cyber)", false, "m-default") }]);
    await call("POST", "/cases", { ...seed, case_id: "c1" });
    const { run_id } = await json(await call("POST", "/cases/c1/runs", { block: "propose" }));
    await queue.idle();
    const run = await json(await call("GET", `/cases/c1/runs/${run_id}`));
    expect(run).toMatchObject({ state: "failed", outcome: { code: "MODEL_REFUSAL", message: "Das Modell hat abgelehnt (cyber)" } });
    expect(run.rejected_attempts).toEqual([expect.objectContaining({ attempt: 1, code: "MODEL_REFUSAL", model: "m-default" })]);
    expect(run).not.toHaveProperty("record");
  });

  it.each([
    ["unbekannte Akte", "nope", { block: "propose" }, 404, "CASE_NOT_FOUND"],
    ["unbekannter Baustein", "c1", { block: "ghost" }, 404, "UNKNOWN_BLOCK"],
    ["kein Modell-Baustein", "c1", { block: "lint" }, 400, "NOT_A_MODEL_BLOCK"],
    ["Abhängigkeit nicht erfüllt", "c1", { block: "review" }, 409, "DEPENDENCY_NOT_MET"],
    ["ungültiger Body", "c1", {}, 400, "INVALID_REQUEST"],
  ])("lehnt vor dem Einreihen ab: %s", async (_n, caseId, body, status, code) => {
    const { call, model } = setup();
    await call("POST", "/cases", { ...seed, case_id: "c1" });
    const res = await call("POST", `/cases/${caseId}/runs`, body);
    expect(res.status).toBe(status);
    expect((await json(res)).error.code).toBe(code);
    expect(model.calls).toHaveLength(0);
  });

  it("unbekannter Lauf oder Lauf einer anderen Akte: 404", async () => {
    const { call, queue } = setup([{ output: { items } }]);
    await call("POST", "/cases", { ...seed, case_id: "c1" });
    await call("POST", "/cases", { ...seed, case_id: "c2" });
    const { run_id } = await json(await call("POST", "/cases/c1/runs", { block: "propose" }));
    await queue.idle();
    expect((await call("GET", "/cases/c1/runs/nope")).status).toBe(404);
    expect((await call("GET", `/cases/c2/runs/${run_id}`)).status).toBe(404);
  });
});

describe("assert_startup_config", () => {
  it("verweigert den Start mit SPEEDBOAT_DEV_AUTH=1 und NODE_ENV=production", () => {
    expect(() => assert_startup_config({ SPEEDBOAT_DEV_AUTH: "1", NODE_ENV: "production" })).toThrow(/production/);
  });

  it("erlaubt Entwicklungsanmeldung außerhalb von production und production ohne sie", () => {
    expect(assert_startup_config({ SPEEDBOAT_DEV_AUTH: "1", NODE_ENV: "development" })).toEqual({ devAuth: true });
    expect(assert_startup_config({ SPEEDBOAT_DEV_AUTH: "1" })).toEqual({ devAuth: true });
    expect(assert_startup_config({ NODE_ENV: "production" })).toEqual({ devAuth: false });
  });
});
