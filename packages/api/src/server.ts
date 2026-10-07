// Startet API und Worker in einem Prozess (Phase 1). Aufruf: pnpm --filter @speedboat/api start
import { serve } from "@hono/node-server";
import { bootstrap } from "./bootstrap.js";

const running = await bootstrap(process.env);
const port = Number(process.env["PORT"] ?? 8787);
const server = serve({ fetch: running.app.fetch, port });
console.log(`Speedboat-API auf http://localhost:${port} – Packs: ${running.packs.list().map((b) => `${b.pack.pack}@${b.pack.version}`).join(", ")}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    server.close();
    await running.stop();
    process.exit(0);
  });
}
