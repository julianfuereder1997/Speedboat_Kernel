import type pg from "pg";
import type { AttemptEntry, AttemptLog } from "./types.js";

type Row = {
  run_id: string;
  case_id: string;
  block: string;
  attempt: number;
  code: string;
  message: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  at: Date;
};

/** Abgelehnte Versuche in einer eigenen Tabelle, getrennt von der Akte. */
export class PostgresAttemptLog implements AttemptLog {
  readonly #pool: pg.Pool;
  readonly #table: string;

  constructor(pool: pg.Pool, options: { table?: string } = {}) {
    const table = options.table ?? "run_attempts";
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(table)) throw new Error(`unzulässiger Tabellenname: ${table}`);
    this.#pool = pool;
    this.#table = table;
  }

  async migrate(): Promise<void> {
    await this.#pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.#table} (
        run_id        text        NOT NULL,
        attempt       integer     NOT NULL CHECK (attempt > 0),
        case_id       text        NOT NULL,
        block         text        NOT NULL,
        code          text        NOT NULL,
        message       text        NOT NULL,
        model         text,
        input_tokens  integer,
        output_tokens integer,
        at            timestamptz NOT NULL,
        PRIMARY KEY (run_id, attempt)
      )`);
  }

  async record(e: AttemptEntry): Promise<void> {
    await this.#pool.query(
      `INSERT INTO ${this.#table} (run_id, attempt, case_id, block, code, message, model, input_tokens, output_tokens, at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (run_id, attempt) DO NOTHING`,
      [e.run_id, e.attempt, e.case_id, e.block, e.code, e.message, e.model ?? null, e.input_tokens ?? null, e.output_tokens ?? null, e.at],
    );
  }

  async list(runId: string): Promise<AttemptEntry[]> {
    const r = await this.#pool.query<Row>(`SELECT * FROM ${this.#table} WHERE run_id = $1 ORDER BY attempt`, [runId]);
    return r.rows.map((row) => {
      const e: AttemptEntry = { run_id: row.run_id, case_id: row.case_id, block: row.block, attempt: row.attempt, code: row.code, message: row.message, at: row.at.toISOString() };
      if (row.model !== null) e.model = row.model;
      if (row.input_tokens !== null) e.input_tokens = row.input_tokens;
      if (row.output_tokens !== null) e.output_tokens = row.output_tokens;
      return e;
    });
  }
}
