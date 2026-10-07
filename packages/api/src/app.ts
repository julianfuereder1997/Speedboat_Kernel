import { randomUUID } from "node:crypto";
import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AttemptLog } from "@speedboat/adapters";
import { Actor, apply_patch, create_case, MODEL_BLOCK_TYPES, missingDependencies, next_allowed_steps, Provenance, type CaseState } from "@speedboat/core";
import type { PackRegistry, RunQueue } from "@speedboat/runtime";

export type AppDeps = {
  state: import("@speedboat/core").StateAdapter;
  queue: RunQueue;
  packs: PackRegistry;
  attempts: AttemptLog;
  /** Akteur aus dem Header x-speedboat-actor annehmen (nur Entwicklung; echte Anmeldung in Phase 4). */
  devAuth: boolean;
  newId?: () => string;
};

const CreateCaseBody = z
  .object({
    pack: z.string().min(1),
    version: z.string().min(1).optional(),
    case_id: z.string().min(1).optional(),
    objects: z
      .array(z.object({ type: z.string().min(1), id: z.string().min(1), value: z.record(z.string(), z.json()), provenance: Provenance.optional() }).strict())
      .optional(),
  })
  .strict();
const RunBody = z.object({ block: z.string().min(1) }).strict();

type Env = { Variables: { actor: Actor } };

const error = (c: Context, status: 400 | 401 | 403 | 404 | 409 | 422, code: string, message: string, details?: unknown) =>
  c.json({ error: { code, message, ...(details !== undefined ? { details } : {}) } }, status);

/** HTTP-API des Kerns. Enthält keine Fachlogik; alle Prüfungen macht der Kern. */
export function create_app(deps: AppDeps): Hono<Env> {
  const newId = deps.newId ?? randomUUID;
  const app = new Hono<Env>();

  app.use("*", async (c, next) => {
    const header = c.req.header("x-speedboat-actor");
    if (!deps.devAuth || header === undefined) return error(c, 401, "UNAUTHENTICATED", "Kein angemeldeter Akteur (Anmeldung folgt in Phase 4)");
    let parsed: z.ZodSafeParseResult<Actor>;
    try {
      parsed = Actor.safeParse(JSON.parse(header));
    } catch {
      return error(c, 400, "INVALID_ACTOR", "x-speedboat-actor ist kein JSON");
    }
    if (!parsed.success) return error(c, 400, "INVALID_ACTOR", "x-speedboat-actor ist ungültig", parsed.error.issues);
    if (parsed.data.kind !== "human") return error(c, 403, "FORBIDDEN", "Über die API handeln nur Menschen");
    c.set("actor", parsed.data);
    await next();
  });

  const body = async <T>(c: Context, schema: z.ZodType<T>) => {
    const raw = await c.req.json().catch(() => undefined);
    return schema.safeParse(raw);
  };

  app.post("/cases", async (c) => {
    const parsed = await body(c, CreateCaseBody);
    if (!parsed.success) return error(c, 400, "INVALID_REQUEST", "Body ist ungültig", parsed.error.issues);
    const { pack: name, version, case_id = newId(), objects = [] } = parsed.data;
    const candidates = deps.packs.list().filter((b) => b.pack.pack === name && (version === undefined || b.pack.version === version));
    if (candidates.length === 0) return error(c, 404, "UNKNOWN_PACK", `Pack ${name}${version ? `@${version}` : ""} ist nicht geladen`);
    if (candidates.length > 1) return error(c, 400, "AMBIGUOUS_PACK", `Pack ${name} ist in mehreren Versionen geladen; version angeben`);
    const { pack } = candidates[0]!;
    const actor = c.get("actor");

    let state: CaseState = create_case({ case_id, pack, actor });
    if (objects.length > 0) {
      const r = apply_patch(
        state,
        {
          patch_id: `${case_id}-start`,
          case_id,
          base_revision: state.revision,
          changes: objects.map((o) => ({
            op: "add" as const,
            path: `/objects/${o.type}/${o.id}`,
            new_value: o.value,
            ...(o.provenance !== undefined ? { provenance: o.provenance } : {}),
          })),
        },
        actor,
        pack,
      );
      if (r.status !== "APPLIED") return error(c, 422, r.status === "REJECTED" ? r.code : r.status, r.status === "REJECTED" ? r.message : "unerwartet", r.status === "REJECTED" ? r.details : undefined);
      state = r.case;
    }
    const saved = await deps.state.create(state);
    if (!saved.ok) return error(c, saved.code === "ALREADY_EXISTS" ? 409 : 422, saved.code, saved.message);
    return c.json({ case: state }, 201);
  });

  app.get("/cases/:id", async (c) => {
    const state = await deps.state.load(c.req.param("id"));
    return state ? c.json({ case: state }) : error(c, 404, "CASE_NOT_FOUND", "Akte existiert nicht");
  });

  app.get("/cases/:id/next-steps", async (c) => {
    const state = await deps.state.load(c.req.param("id"));
    if (!state) return error(c, 404, "CASE_NOT_FOUND", "Akte existiert nicht");
    const bundle = deps.packs.get(state.pack, state.pack_version);
    if (!bundle) return error(c, 409, "PACK_NOT_LOADED", `Pack ${state.pack}@${state.pack_version} ist nicht geladen`);
    return c.json(next_allowed_steps(state, bundle.pack));
  });

  app.post("/cases/:id/runs", async (c) => {
    const parsed = await body(c, RunBody);
    if (!parsed.success) return error(c, 400, "INVALID_REQUEST", "Body ist ungültig", parsed.error.issues);
    const { block } = parsed.data;
    const state = await deps.state.load(c.req.param("id"));
    if (!state) return error(c, 404, "CASE_NOT_FOUND", "Akte existiert nicht");
    const bundle = deps.packs.get(state.pack, state.pack_version);
    if (!bundle) return error(c, 409, "PACK_NOT_LOADED", `Pack ${state.pack}@${state.pack_version} ist nicht geladen`);
    const contract = bundle.pack.blocks.find((b) => b.block === block);
    if (!contract) return error(c, 404, "UNKNOWN_BLOCK", `Baustein ${block} ist im Pack nicht definiert`);
    if (!MODEL_BLOCK_TYPES.includes(contract.type)) return error(c, 400, "NOT_A_MODEL_BLOCK", `${block} ist ${contract.type}, kein Modell-Baustein`);
    const missing = missingDependencies(state, bundle.pack, block);
    if (missing.length > 0) return error(c, 409, "DEPENDENCY_NOT_MET", `${block} braucht vorher: ${missing.join(", ")}`, { missing });

    const run_id = newId();
    await deps.queue.enqueue({ run_id, case_id: state.case_id, block, requested_by: c.get("actor").id });
    return c.json({ run_id }, 202);
  });

  app.get("/cases/:id/runs/:run_id", async (c) => {
    const { id, run_id } = c.req.param();
    const state = await deps.state.load(id);
    if (!state) return error(c, 404, "CASE_NOT_FOUND", "Akte existiert nicht");
    const record = state.runs.find((r) => r.run_id === run_id);
    const status = await deps.queue.status(run_id);
    if (status && status.case_id !== id) return error(c, 404, "RUN_NOT_FOUND", "Lauf gehört nicht zu dieser Akte");
    if (!status && !record) return error(c, 404, "RUN_NOT_FOUND", "Lauf existiert nicht");
    const base = status ?? { run_id, case_id: id, block: record!.block, state: "done" as const, attempts: 1 };
    return c.json({ ...base, ...(record ? { record } : {}), rejected_attempts: await deps.attempts.list(run_id) });
  });

  return app;
}
