import { CaseState, type SaveResult, type StateAdapter } from "@speedboat/core";
import type pg from "pg";
import { precheck } from "./precheck.js";

/**
 * Akten in Postgres: die ganze Akte als JSONB, die Revision zusätzlich als eigene Spalte.
 * Geschrieben wird nur mit `WHERE revision = <erwartet>` (optimistische Sperre).
 */
export class PostgresStateAdapter implements StateAdapter {
  readonly #pool: pg.Pool;
  readonly #table: string;

  constructor(pool: pg.Pool, options: { table?: string } = {}) {
    const table = options.table ?? "cases";
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(table)) throw new Error(`unzulässiger Tabellenname: ${table}`);
    this.#pool = pool;
    this.#table = table;
  }

  async migrate(): Promise<void> {
    await this.#pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.#table} (
        case_id    text        PRIMARY KEY,
        revision   integer     NOT NULL CHECK (revision >= 0),
        state      jsonb       NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ${this.#table}_revision_matches CHECK ((state->>'revision')::integer = revision),
        CONSTRAINT ${this.#table}_case_id_matches  CHECK (state->>'case_id' = case_id)
      )`);
  }

  async create(state: CaseState): Promise<SaveResult> {
    const invalid = precheck(state);
    if (invalid) return invalid;
    const r = await this.#pool.query(
      `INSERT INTO ${this.#table} (case_id, revision, state) VALUES ($1, $2, $3::jsonb) ON CONFLICT (case_id) DO NOTHING`,
      [state.case_id, state.revision, JSON.stringify(state)],
    );
    return r.rowCount === 1 ? { ok: true } : { ok: false, code: "ALREADY_EXISTS", message: `${state.case_id} existiert bereits` };
  }

  async load(caseId: string): Promise<CaseState | null> {
    const r = await this.#pool.query<{ state: unknown }>(`SELECT state FROM ${this.#table} WHERE case_id = $1`, [caseId]);
    const row = r.rows[0];
    return row ? CaseState.parse(row.state) : null;
  }

  async save(state: CaseState, expectedRevision: number): Promise<SaveResult> {
    const invalid = precheck(state, expectedRevision);
    if (invalid) return invalid;
    const r = await this.#pool.query(
      `UPDATE ${this.#table} SET state = $1::jsonb, revision = $2, updated_at = now() WHERE case_id = $3 AND revision = $4`,
      [JSON.stringify(state), state.revision, state.case_id, expectedRevision],
    );
    if (r.rowCount === 1) return { ok: true };
    const exists = await this.#pool.query(`SELECT revision FROM ${this.#table} WHERE case_id = $1`, [state.case_id]);
    if (exists.rowCount === 0) return { ok: false, code: "NOT_FOUND", message: `${state.case_id} existiert nicht` };
    return { ok: false, code: "REVISION_CONFLICT", message: `gespeichert ist Revision ${exists.rows[0].revision}, erwartet ${expectedRevision}` };
  }
}
