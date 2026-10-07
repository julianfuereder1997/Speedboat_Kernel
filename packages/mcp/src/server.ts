import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export type McpConfig = {
  /** Basis-URL der Speedboat-API. */
  apiUrl: string;
  /** Akteur aus der Konfiguration (lokaler Entwicklungsnutzer); echte Anmeldung folgt in Phase 4. */
  actor: { id: string; kind: "human"; roles: string[] };
  fetch?: typeof fetch;
};

export const TOOL_NAMES = ["create_case", "get_case", "next_allowed_steps", "run_block", "get_run"] as const;

/**
 * MCP-Server ohne eigene Logik: Jedes Werkzeug ist genau ein Aufruf der API.
 * Alle Prüfungen (Rollen, Revision, Verträge, Abhängigkeiten) macht der Kern hinter der API.
 */
export function create_mcp_server(config: McpConfig): McpServer {
  const doFetch = config.fetch ?? fetch;
  const server = new McpServer({ name: "speedboat", version: "0.1.0" });

  const api = async (method: "GET" | "POST", path: string, body?: unknown) => {
    const res = await doFetch(new URL(path, config.apiUrl), {
      method,
      headers: { "content-type": "application/json", "x-speedboat-actor": JSON.stringify(config.actor) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    return { content: [{ type: "text" as const, text }], isError: !res.ok };
  };
  const seg = encodeURIComponent;

  server.registerTool(
    "create_case",
    {
      description:
        "Legt eine neue Akte für ein Pack an. Optional mit Startobjekten (Typ, ID, Wert, Provenienz), die im Namen des Nutzers geprüft eingetragen werden.",
      inputSchema: {
        pack: z.string().describe("Name des Packs"),
        version: z.string().optional().describe("Version des Packs, falls mehrere geladen sind"),
        case_id: z.string().optional().describe("Gewünschte ID der Akte; sonst wird eine erzeugt"),
        objects: z
          .array(
            z.object({
              type: z.string().describe("Objekttyp aus dem Pack"),
              id: z.string(),
              value: z.record(z.string(), z.unknown()),
              provenance: z.string().optional().describe("Provenienz-Wert aus dem Pack"),
            }),
          )
          .optional(),
      },
    },
    async (args) => api("POST", "/cases", args),
  );

  server.registerTool(
    "get_case",
    { description: "Liefert die aktuelle Akte mit Revision, Objekten, Läufen, Entscheidungen und Audit.", inputSchema: { case_id: z.string() } },
    async ({ case_id }) => api("GET", `/cases/${seg(case_id)}`),
  );

  server.registerTool(
    "next_allowed_steps",
    {
      description: "Liefert die Bausteine, die jetzt laufen dürfen, und die Gates, die entscheidungsreif sind.",
      inputSchema: { case_id: z.string() },
    },
    async ({ case_id }) => api("GET", `/cases/${seg(case_id)}/next-steps`),
  );

  server.registerTool(
    "run_block",
    {
      description: "Startet einen Baustein asynchron und gibt sofort eine run_id zurück. Den Stand liefert get_run.",
      inputSchema: { case_id: z.string(), block: z.string().describe("Name des Bausteins aus dem Pack") },
    },
    async ({ case_id, block }) => api("POST", `/cases/${seg(case_id)}/runs`, { block }),
  );

  server.registerTool(
    "get_run",
    {
      description: "Liefert den Stand eines Laufs: wartend, laufend, fertig oder gescheitert, mit Ergebnis und abgelehnten Versuchen.",
      inputSchema: { case_id: z.string(), run_id: z.string() },
    },
    async ({ case_id, run_id }) => api("GET", `/cases/${seg(case_id)}/runs/${seg(run_id)}`),
  );

  return server;
}

/** Konfiguration aus der Umgebung: SPEEDBOAT_API_URL, SPEEDBOAT_DEV_ACTOR (JSON). */
export function config_from_env(env: Record<string, string | undefined>): McpConfig {
  const actor = env["SPEEDBOAT_DEV_ACTOR"] ? JSON.parse(env["SPEEDBOAT_DEV_ACTOR"]) : { id: "local-dev", kind: "human", roles: ["editor"] };
  const parsed = z.object({ id: z.string().min(1), kind: z.literal("human"), roles: z.array(z.string()) }).strict().parse(actor);
  return { apiUrl: env["SPEEDBOAT_API_URL"] ?? "http://localhost:8787", actor: parsed };
}
