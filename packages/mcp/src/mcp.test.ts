import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { FakeModelAdapter, MemoryAttemptLog, MemoryStateAdapter, ModelConfig } from "@speedboat/adapters";
import { create_app } from "@speedboat/api";
import { InlineRunQueue, load_pack_dir, PackRegistry } from "@speedboat/runtime";
import { create_mcp_server, TOOL_NAMES, type McpConfig } from "./index.js";

const FIXTURE = fileURLToPath(new URL("../../runtime/src/test-fixtures/pack", import.meta.url));
const models = ModelConfig.parse({ models: { default: { model: "m-default" }, frontier: { model: "m-frontier" } } });
const bundle = load_pack_dir(FIXTURE, { models });
const config: McpConfig = { apiUrl: "http://api.test", actor: { id: "local-dev", kind: "human", roles: ["editor"] } };

async function connect(fetchImpl: typeof fetch) {
  const server = create_mcp_server({ ...config, fetch: fetchImpl });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientSide);
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: Array<{ type: string; text: string }>; isError?: boolean };
    return { isError: r.isError ?? false, body: JSON.parse(r.content[0]!.text) };
  };
  return { client, call };
}

/** Vollständiger Stapel im Prozess: API mit Memory-State, Inline-Queue und Fake-Modell. */
function stack() {
  const state = new MemoryStateAdapter();
  const attempts = new MemoryAttemptLog();
  const model = new FakeModelAdapter((c) => {
    if (c.model_hint === "default") return { output: { items: [{ label: "Eins", reason: "GEHEIME BEGRÜNDUNG" }] } };
    // Der Kritiker zielt auf das Objekt, das er in seinem Kontext sieht.
    const id = /"([^"]+-0)": \{/.exec(c.prompt.user)?.[1];
    return { output: { findings: [{ marker: "vague", target: `/objects/item/${id}` }] } };
  });
  const packs = new PackRegistry([bundle]);
  const queue = new InlineRunQueue({ state, model, attempts, packs }, { maxAttempts: 3 });
  const app = create_app({ state, queue, packs, attempts, devAuth: true });
  const requests: Array<{ method: string; path: string; actor: string | null }> = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    requests.push({ method: req.method, path: url.pathname, actor: req.headers.get("x-speedboat-actor") });
    return app.request(url.pathname + url.search, req);
  }) as typeof fetch;
  return { fetchImpl, queue, model, requests };
}

describe("MCP-Server", () => {
  it("bietet genau die fünf generisch benannten Werkzeuge an", async () => {
    const { client } = await connect(stack().fetchImpl);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["create_case", "get_case", "get_run", "next_allowed_steps", "run_block"]);
    expect([...TOOL_NAMES].sort()).toEqual(tools.map((t) => t.name).sort());
    for (const t of tools) expect(t.description, t.name).toBeTruthy();
  });

  it("jeder Werkzeugaufruf ist genau ein API-Aufruf mit dem konfigurierten Akteur; keine eigene Logik", async () => {
    const s = stack();
    const { call } = await connect(s.fetchImpl);
    await call("create_case", { pack: "runtime-fixture", case_id: "c1" });
    await call("get_case", { case_id: "c1" });
    await call("next_allowed_steps", { case_id: "c1" });
    await call("run_block", { case_id: "c1", block: "propose" });
    await call("get_run", { case_id: "c1", run_id: "x" });
    expect(s.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      "POST /cases",
      "GET /cases/c1",
      "GET /cases/c1/next-steps",
      "POST /cases/c1/runs",
      "GET /cases/c1/runs/x",
    ]);
    for (const r of s.requests) expect(JSON.parse(r.actor!)).toEqual(config.actor);
  });

  it("Fehler der API kommen als Werkzeugfehler mit dem Code zurück", async () => {
    const { call } = await connect(stack().fetchImpl);
    const r = await call("get_case", { case_id: "nope" });
    expect(r).toEqual({ isError: true, body: { error: { code: "CASE_NOT_FOUND", message: expect.any(String) } } });
  });

  it("Durchstich: Fall anlegen, Generator, Kritiker – vom Werkzeug bis zur geprüften Änderung in der Akte", async () => {
    const s = stack();
    const { call } = await connect(s.fetchImpl);

    const created = await call("create_case", {
      pack: "runtime-fixture",
      case_id: "c1",
      objects: [{ type: "source", id: "s1", value: { text: "Quelle" }, provenance: "USER" }],
    });
    expect(created).toMatchObject({ isError: false, body: { case: { revision: 1 } } });
    expect((await call("next_allowed_steps", { case_id: "c1" })).body).toEqual({ blocks: ["propose"], gates: [] });

    const gen = await call("run_block", { case_id: "c1", block: "propose" });
    expect(gen.isError).toBe(false);
    await s.queue.idle();
    const genRun = await call("get_run", { case_id: "c1", run_id: gen.body.run_id });
    expect(genRun.body).toMatchObject({ state: "done", outcome: { patch: "APPLIED" }, record: { requested_by: "local-dev" } });

    const itemId = `${gen.body.run_id}-0`;
    expect((await call("next_allowed_steps", { case_id: "c1" })).body.blocks).toContain("review");
    const critic = await call("run_block", { case_id: "c1", block: "review" });
    await s.queue.idle();
    const criticRun = await call("get_run", { case_id: "c1", run_id: critic.body.run_id });
    expect(criticRun.body).toMatchObject({
      state: "done",
      record: { block: "review", block_type: "critic", output: { findings: [{ marker: "vague", target: `/objects/item/${itemId}` }] } },
      rejected_attempts: [],
    });

    const c = (await call("get_case", { case_id: "c1" })).body.case;
    expect(c.objects.item[itemId]).toEqual({ label: "Eins", reason: "GEHEIME BEGRÜNDUNG", _provenance: "GENERATED" });
    expect(c.runs.map((r: { block: string }) => r.block)).toEqual(["propose", "review"]);
    expect(c.revision).toBe(4); // Start, Generator-Lauf, Generator-Patch, Kritiker-Lauf
    for (const call of s.model.calls) expect(JSON.stringify(call)).not.toContain("GEHEIME BEGRÜNDUNG");
  });
});
