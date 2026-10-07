import { z } from "zod";
import { Id, InputPath, JsonObject, Pointer } from "./common.js";

export const BlockType = z.enum(["extract", "generate", "critic", "validate", "ask", "gate", "freeze", "action"]);
export type BlockType = z.infer<typeof BlockType>;

export const Isolation = z.enum(["shared", "fresh_context"]);

/** Baustein-Typen, deren Arbeit ein Modell erledigt. */
export const MODEL_BLOCK_TYPES: readonly BlockType[] = ["extract", "generate", "critic"];

/** Wie aus der Ausgabe eines generate-/extract-Bausteins ein Patch wird. */
export const Writes = z
  .object({
    /** Objekttyp, der angelegt wird. */
    object_type: Id,
    /** JSON Pointer in die Ausgabe auf ein Array; jedes Element wird ein Objekt. */
    items: Pointer,
    /** Feld im Element, das die Objekt-ID liefert; sonst <run_id>-<index>. */
    id_field: Id.optional(),
    /** Feste Provenienz für alle Objekte … */
    provenance: Id.optional(),
    /** … oder Feld im Element, das die Provenienz liefert. */
    provenance_field: Id.optional(),
  })
  .strict()
  .refine((w) => !(w.provenance !== undefined && w.provenance_field !== undefined), "provenance und provenance_field schließen sich aus");
export type Writes = z.infer<typeof Writes>;

export const BlockContract = z
  .object({
    block: Id,
    type: BlockType,
    input: z.array(InputPath),
    output_schema: JsonObject,
    markers: z.array(Id).optional(),
    bias: Id.optional(),
    isolation: Isolation,
    /** Pfad zum Skill-Text (Markdown) relativ zum Pack; Pflicht für Modell-Bausteine. */
    skill: z.string().min(1).optional(),
    /** Hinweis an den Modell-Adapter; die Zuordnung zum Modell steht in der Konfiguration. */
    model_hint: Id.optional(),
    /** Rollen, mit denen der Baustein Patches schreibt. */
    actor_roles: z.array(Id).optional(),
    writes: Writes.optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.markers !== undefined && c.type !== "critic") {
      ctx.addIssue({ code: "custom", path: ["markers"], message: "Marker gibt es nur bei critic" });
    }
  });
export type BlockContract = z.infer<typeof BlockContract>;
