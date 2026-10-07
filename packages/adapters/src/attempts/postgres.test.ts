import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe } from "vitest";
import { attemptLogSuite } from "./attempt-log-suite.js";
import { PostgresAttemptLog } from "./postgres.js";

const url = process.env.DATABASE_URL;
const table = `run_attempts_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

describe.skipIf(!url)("PostgresAttemptLog", () => {
  let pool: pg.Pool;
  let log: PostgresAttemptLog;
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    log = new PostgresAttemptLog(pool, { table });
    await log.migrate();
  });
  afterAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS ${table}`);
    await pool.end();
  });
  attemptLogSuite(() => log, () => randomUUID());
});
