// Spielt den Ablauf einmal mit der echten Modell-API durch. NUR MANUELL ausführen, nie in CI.
//
//   ANTHROPIC_API_KEY=... DATABASE_URL=postgres://... pnpm demo:live ["Produkt" "Zielgruppe"]
//
// Kosten: ein Generator-Aufruf (model_hint default) und ein Kritiker-Aufruf (model_hint frontier),
// siehe config/models.json. Bei Fehlern wiederholt pg-boss bis zur festen Obergrenze.
import { bootstrap } from "@speedboat/api";

if (process.env["CI"]) throw new Error("live-demo läuft nie in CI.");
if (!process.env["ANTHROPIC_API_KEY"]) {
  console.error("ANTHROPIC_API_KEY fehlt. Setze den Schlüssel (z. B. als Codespaces-Secret) und starte erneut.");
  process.exit(1);
}
if (!process.env["DATABASE_URL"]) {
  console.error("DATABASE_URL fehlt (z. B. postgres://speedboat:speedboat_dev@localhost:5432/speedboat nach `pnpm db:up`).");
  process.exit(1);
}

const [product = "Wiederverwendbarer Kaffeebecher aus recyceltem Kunststoff", audience = "Pendlerinnen und Pendler in Großstädten"] = process.argv.slice(2);
const actor = { id: "live-demo", kind: "human", roles: ["editor"] };
const running = await bootstrap({ ...process.env, SPEEDBOAT_DEV_AUTH: "1", NODE_ENV: "development" });

const call = async (method: string, path: string, body?: unknown) => {
  const res = await running.app.request(path, {
    method,
    headers: { "content-type": "application/json", "x-speedboat-actor": JSON.stringify(actor) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(json)}`);
  return json;
};

async function runAndWait(case_id: string, block: string) {
  const { run_id } = await call("POST", `/cases/${case_id}/runs`, { block });
  process.stdout.write(`  ${block} (run ${run_id}) `);
  for (;;) {
    const run = await call("GET", `/cases/${case_id}/runs/${run_id}`);
    if (run.state === "done" || run.state === "failed") {
      console.log(`→ ${run.state}${run.attempts > 1 ? ` nach ${run.attempts} Versuchen` : ""}`);
      for (const a of run.rejected_attempts) {
        console.log(`    abgelehnt (Versuch ${a.attempt}): ${a.code} – ${a.message}${a.model ? ` [${a.model}, ${a.input_tokens ?? "?"}/${a.output_tokens ?? "?"} Tokens]` : ""}`);
      }
      if (run.state === "failed") throw new Error(`${block} gescheitert: ${run.outcome.code} – ${run.outcome.message}`);
      return run;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 1000));
  }
}

try {
  const case_id = `live-demo-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  console.log(`Fall ${case_id}`);
  await call("POST", "/cases", {
    pack: "demo-naming",
    case_id,
    objects: [{ type: "brief", id: "main", value: { product, audience }, provenance: "USER_INPUT" }],
  });
  console.log(`  Briefing: ${product} – ${audience}`);

  await runAndWait(case_id, "propose-names");
  await runAndWait(case_id, "challenge-names");

  const { case: c } = await call("GET", `/cases/${case_id}`);
  const findings: Array<{ marker: string; target: string; note?: string }> = c.runs.at(-1).output.findings;
  console.log("\nKandidaten (Provenienz) und Befunde des Kritikers:");
  for (const [id, cand] of Object.entries<any>(c.objects.candidate ?? {})) {
    console.log(`  • ${cand.name}  [${cand._provenance}]`);
    console.log(`      Begründung: ${cand.rationale}`);
    for (const f of findings.filter((f) => f.target === `/objects/candidate/${id}`)) console.log(`      ⚑ ${f.marker}: ${f.note ?? ""}`);
  }
  console.log(`\nAkte: Revision ${c.revision}, ${c.audit.length} Audit-Einträge, Läufe: ${c.runs.map((r: any) => r.block).join(", ")}`);
} finally {
  await running.stop();
}
