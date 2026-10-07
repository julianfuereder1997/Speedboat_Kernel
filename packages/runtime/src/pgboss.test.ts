import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, describe } from "vitest";
import { PgBossRunQueue } from "./index.js";
import { runQueueSuite } from "./queue-suite.js";

const url = process.env.DATABASE_URL;
const queues: PgBossRunQueue[] = [];
const schemas: string[] = [];

// Läuft nur mit DATABASE_URL; in CI immer (siehe Postgres-Schutztest im Adapter-Paket).
describe.skipIf(!url)("PgBossRunQueue", () => {
  afterAll(async () => {
    await Promise.all(queues.map((q) => q.stop()));
    const pool = new pg.Pool({ connectionString: url });
    for (const s of schemas) await pool.query(`DROP SCHEMA IF EXISTS ${s} CASCADE`);
    await pool.end();
  });

  runQueueSuite(
    async (d) => {
      const schema = `pgboss_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
      schemas.push(schema);
      const q = new PgBossRunQueue(d, { connectionString: url!, schema, maxAttempts: 3, retryDelaySeconds: 0, pollingIntervalSeconds: 0.5 });
      queues.push(q);
      await q.start();
      return q;
    },
    () => randomUUID(),
    30_000,
  );
});
