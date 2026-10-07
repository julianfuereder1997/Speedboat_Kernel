import { z } from "zod";
import { ActorRef, Id, InputPath, Json, JsonObject, ObjectPath, Provenance, Timestamp } from "./common.js";
import { BlockType } from "./contract.js";
import { Patch } from "./patch.js";

const Revision = z.number().int().nonnegative();

export const AuditAction = z.enum([
  "create_case",
  "apply_patch",
  "change_request",
  "record_run",
  "decide_gate",
  "freeze",
]);

export const AuditEntry = z
  .object({
    /** Revision der Akte nach dieser Änderung. */
    revision: Revision,
    at: Timestamp,
    actor: ActorRef,
    action: AuditAction,
    /** patch_id, run_id, cr_id, Gate- oder Objektpfad. */
    ref: Id,
    /** Geänderte Objektpfade; leer, wenn keine Objekte geändert wurden. */
    paths: z.array(ObjectPath),
    /** Provenienz je geändertem Pfad, wie sie im Patch stand. */
    provenance: z.record(ObjectPath, Provenance).optional(),
  })
  .strict();
export type AuditEntry = z.infer<typeof AuditEntry>;

export const Decision = z
  .object({
    gate: Id,
    decision: Id,
    reason: z.string().optional(),
    decided_by: Id,
    at: Timestamp,
    revision: Revision,
  })
  .strict();
export type Decision = z.infer<typeof Decision>;

export const FrozenRecord = z
  .object({
    path: ObjectPath,
    version: z.number().int().positive(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    revision: Revision,
    at: Timestamp,
    by: Id,
  })
  .strict();
export type FrozenRecord = z.infer<typeof FrozenRecord>;

export const ChangeRequest = z
  .object({
    cr_id: Id,
    patch: Patch,
    frozen_paths: z.array(ObjectPath).min(1),
    requested_by: Id,
    at: Timestamp,
    revision: Revision,
    status: z.enum(["open"]),
  })
  .strict();
export type ChangeRequest = z.infer<typeof ChangeRequest>;

export const RunRecord = z
  .object({
    run_id: Id,
    block: Id,
    block_type: BlockType,
    at: Timestamp,
    /** Revision der Akte, auf der der Lauf gearbeitet hat. */
    revision: Revision,
    input_paths: z.array(InputPath),
    output: Json,
  })
  .strict();
export type RunRecord = z.infer<typeof RunRecord>;

export const CaseState = z
  .object({
    case_id: Id,
    pack: Id,
    pack_version: Id,
    revision: Revision,
    /** Objekttyp → Objekt-ID → Objekt. Die Typen definiert das Pack. */
    objects: z.record(Id, z.record(Id, JsonObject)),
    decisions: z.array(Decision),
    /** Objektpfad → Siegel. */
    frozen: z.record(ObjectPath, FrozenRecord),
    change_requests: z.array(ChangeRequest),
    runs: z.array(RunRecord),
    audit: z.array(AuditEntry).min(1),
  })
  .strict()
  .superRefine((c, ctx) => {
    for (let i = 1; i < c.audit.length; i++) {
      if (c.audit[i]!.revision <= c.audit[i - 1]!.revision) {
        ctx.addIssue({ code: "custom", path: ["audit", i], message: "Audit-Revisionen müssen streng steigen" });
      }
    }
    if (c.audit.at(-1)?.revision !== c.revision) {
      ctx.addIssue({ code: "custom", path: ["revision"], message: "revision passt nicht zum letzten Audit-Eintrag" });
    }
  });
export type CaseState = z.infer<typeof CaseState>;
