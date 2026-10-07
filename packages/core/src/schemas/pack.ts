import { z } from "zod";
import { Id, JsonObject } from "./common.js";
import { BlockContract } from "./contract.js";

export const ObjectType = z
  .object({
    /** JSON Schema für ein einzelnes Objekt dieses Typs. */
    schema: JsonObject,
    write_roles: z.array(Id).min(1),
    requires_provenance: z.boolean().default(false),
  })
  .strict();
export type ObjectType = z.infer<typeof ObjectType>;

/** Ganzes Objekt, ID darf `*` sein: /objects/<typ>/<id|*>. */
export const FreezePath = z.string().regex(/^\/objects\/[^/*]+\/[^/]+$/, "freezes.paths verlangt /objects/<typ>/<id|*>");

export const Gate = z
  .object({
    /** Bausteine, die vor dem Gate gelaufen sein müssen. */
    requires: z.array(Id),
    /** validate-Bausteine, deren letzter aktueller Lauf bestanden haben muss. */
    checks: z.array(Id),
    decisions: z.array(Id),
    /** Entscheidungen, nach denen das Gate geschlossen ist. */
    final: z.array(Id).default([]),
    /** Objekte, die bei einer der Entscheidungen in `on` automatisch versiegelt werden. */
    freezes: z.object({ paths: z.array(FreezePath).min(1), on: z.array(Id).min(1) }).strict().optional(),
  })
  .strict();
export type Gate = z.infer<typeof Gate>;

export const Marker = z.object({ id: Id, description: z.string().optional() }).strict();

export const Pack = z
  .object({
    pack: Id,
    version: Id,
    object_types: z.record(Id, ObjectType),
    blocks: z.array(BlockContract),
    /** Baustein → Bausteine, die vorher gelaufen sein müssen. */
    dependencies: z.record(Id, z.array(Id)),
    gates: z.record(Id, Gate),
    bias_profiles: z.record(Id, JsonObject),
    markers: z.array(Marker),
    /** Rollen, die dieses Pack vergibt (z. B. in write_roles). */
    roles: z.array(Id),
    /** Erlaubte Provenienz-Werte. */
    provenance_values: z.array(Id),
  })
  .strict();
export type Pack = z.infer<typeof Pack>;
export type PackInput = z.input<typeof Pack>;
