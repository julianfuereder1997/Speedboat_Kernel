import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresStateAdapter } from "./postgres.js";
import { fresh, next, stateAdapterSuite } from "./state-adapter-suite.js";

const url = process.env.DATABASE_URL;
const table = `cases_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

// Läuft nur mit DATABASE_URL (z. B. nach `pnpm db:up`); sonst übersprungen.
describe.skipIf(!url)("PostgresStateAdapter", () => {
  let pool: pg.Pool;
  let adapter: PostgresStateAdapter;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    adapter = new PostgresStateAdapter(pool, { table });
    await adapter.migrate();
  });

  afterAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS ${table}`);
    await pool.end();
  });

  let n = 0;
  stateAdapterSuite(() => adapter, () => `pg-${++n}`);

  it("legt die Akte als JSONB und die Revision als eigene Spalte ab", async () => {
    const s = next(fresh("pg-jsonb"), "a");
    await adapter.create(s);
    const { rows } = await pool.query(
      `SELECT revision, jsonb_typeof(state) AS kind, state->>'case_id' AS case_id,
              (SELECT data_type FROM information_schema.columns WHERE table_name = $2 AND column_name = 'state') AS state_type
         FROM ${table} WHERE case_id = $1`,
      [s.case_id, table],
    );
    expect(rows[0]).toEqual({ revision: 1, kind: "object", case_id: "pg-jsonb", state_type: "jsonb" });
  });

  it("die Datenbank selbst verhindert eine Revisionsspalte, die nicht zur Akte passt", async () => {
    const s = fresh("pg-check");
    await adapter.create(s);
    await expect(pool.query(`UPDATE ${table} SET revision = 5 WHERE case_id = $1`, [s.case_id])).rejects.toThrow(/check/i);
  });

  it("lädt eine an der Akte vorbei manipulierte Zeile nicht stillschweigend", async () => {
    const s = fresh("pg-corrupt");
    await adapter.create(s);
    await pool.query(`UPDATE ${table} SET state = state || '{"extra": 1}'::jsonb WHERE case_id = $1`, [s.case_id]);
    await expect(adapter.load(s.case_id)).rejects.toThrow();
  });

  it("lehnt unsichere Tabellennamen ab", () => {
    expect(() => new PostgresStateAdapter(pool, { table: "x; DROP TABLE y" })).toThrow();
  });
});
