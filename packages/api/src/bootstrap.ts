import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { AnthropicModelAdapter, loadModelConfig, PostgresAttemptLog, PostgresStateAdapter, type ModelAdapter } from "@speedboat/adapters";
import { load_pack_dir, PackRegistry, PgBossRunQueue } from "@speedboat/runtime";
import { create_app } from "./app.js";
import { assert_startup_config } from "./config.js";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));

export type Running = { app: ReturnType<typeof create_app>; packs: PackRegistry; stop: () => Promise<void> };

/** Feste Obergrenze der Versuche je Lauf (Modell- und Speicherfehler eingeschlossen). */
export const MAX_ATTEMPTS = 3;

/**
 * Setzt API, Runtime und Adapter zusammen. Konfiguration nur aus der Umgebung:
 * DATABASE_URL, SPEEDBOAT_DEV_AUTH, NODE_ENV, SPEEDBOAT_PACKS_DIR, SPEEDBOAT_MODEL_CONFIG, ANTHROPIC_API_KEY (vom SDK gelesen).
 */
export async function bootstrap(
  env: Record<string, string | undefined>,
  overrides: { model?: ModelAdapter; pollingIntervalSeconds?: number } = {},
): Promise<Running> {
  const { devAuth } = assert_startup_config(env);
  const url = env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL fehlt");

  const models = loadModelConfig(env["SPEEDBOAT_MODEL_CONFIG"] ?? join(REPO, "config/models.json"));
  const packsDir = env["SPEEDBOAT_PACKS_DIR"] ?? join(REPO, "packs");
  const bundles = readdirSync(packsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(packsDir, d.name, "pack.json")))
    .map((d) => load_pack_dir(join(packsDir, d.name), { models }));
  const packs = new PackRegistry(bundles);

  const suffix = env["SPEEDBOAT_TABLE_SUFFIX"];
  const pool = new pg.Pool({ connectionString: url });
  const state = new PostgresStateAdapter(pool, suffix ? { table: `cases_${suffix}` } : {});
  const attempts = new PostgresAttemptLog(pool, suffix ? { table: `run_attempts_${suffix}` } : {});
  await state.migrate();
  await attempts.migrate();

  const model = overrides.model ?? new AnthropicModelAdapter({ config: models });
  const queue = new PgBossRunQueue(
    { state, model, attempts, packs },
    {
      connectionString: url,
      ...(suffix ? { schema: `pgboss_${suffix}` } : {}),
      maxAttempts: MAX_ATTEMPTS,
      retryDelaySeconds: Number(env["SPEEDBOAT_RETRY_DELAY_SECONDS"] ?? 10),
      ...(overrides.pollingIntervalSeconds ? { pollingIntervalSeconds: overrides.pollingIntervalSeconds } : {}),
    },
  );
  await queue.start();

  const app = create_app({ state, queue, packs, attempts, devAuth });
  return {
    app,
    packs,
    stop: async () => {
      await queue.stop();
      await pool.end();
    },
  };
}
