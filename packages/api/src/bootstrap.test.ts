import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { FakeModelAdapter } from "@speedboat/adapters";
import { bootstrap, type Running } from "./index.js";

const url = process.env.DATABASE_URL;
const PACKS = fileURLToPath(new URL("../../runtime/src/test-fixtures", import.meta.url));

describe("bootstrap", () => {
  it("verweigert den Start mit SPEEDBOAT_DEV_AUTH=1 und NODE_ENV=production, bevor irgendetwas verbunden wird", async () => {
    await expect(bootstrap({ SPEEDBOAT_DEV_AUTH: "1", NODE_ENV: "production", DATABASE_URL: "postgres://nie-verbunden" })).rejects.toThrow(/production/);
  });

  it("verlangt DATABASE_URL", async () => {
    await expect(bootstrap({ SPEEDBOAT_DEV_AUTH: "1" })).rejects.toThrow(/DATABASE_URL/);
  });
});

describe.skipIf(!url)("bootstrap mit Postgres und pg-boss", () => {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
  let running: Running | undefined;

  afterAll(async () => {
    await running?.stop();
    const pool = new pg.Pool({ connectionString: url });
    await pool.query(`DROP TABLE IF EXISTS cases_${suffix}, run_attempts_${suffix}`);
    await pool.query(`DROP SCHEMA IF EXISTS pgboss_${suffix} CASCADE`);
    await pool.end();
  });

  it("legt eine Akte an und führt einen Lauf über pg-boss bis in die Postgres-Akte aus", async () => {
    running = await bootstrap(
      {
        DATABASE_URL: url,
        SPEEDBOAT_DEV_AUTH: "1",
        SPEEDBOAT_PACKS_DIR: PACKS,
        SPEEDBOAT_TABLE_SUFFIX: suffix,
        SPEEDBOAT_RETRY_DELAY_SECONDS: "0",
      },
      { model: new FakeModelAdapter([{ output: { items: [{ label: "Eins", reason: "r" }] } }]), pollingIntervalSeconds: 0.5 },
    );
    const headers = { "content-type": "application/json", "x-speedboat-actor": JSON.stringify({ id: "u-dev", kind: "human", roles: ["editor"] }) };
    const created = await running.app.request("/cases", {
      method: "POST",
      headers,
      body: JSON.stringify({ pack: "runtime-fixture", case_id: "c1", objects: [{ type: "source", id: "s1", value: { text: "Quelle" }, provenance: "USER" }] }),
    });
    expect(created.status).toBe(201);
    const { run_id } = (await (await running.app.request("/cases/c1/runs", { method: "POST", headers, body: JSON.stringify({ block: "propose" }) })).json()) as { run_id: string };

    let run: any;
    for (let i = 0; i < 100; i++) {
      run = await (await running.app.request(`/cases/c1/runs/${run_id}`, { headers })).json();
      if (run.state === "done" || run.state === "failed") break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(run).toMatchObject({ state: "done", outcome: { patch: "APPLIED" }, record: { requested_by: "u-dev" } });
    const c = (await (await running.app.request("/cases/c1", { headers })).json()) as any;
    expect(Object.keys(c.case.objects.item)).toEqual([`${run_id}-0`]);
  }, 30_000);
});
