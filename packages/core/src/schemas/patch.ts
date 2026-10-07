import { z } from "zod";
import { Id, Json, ObjectPath, PROVENANCE_KEY, Provenance } from "./common.js";

export const Change = z
  .object({
    /** set_provenance ändert nur die Provenienz eines ganzen Objekts, nicht seinen Wert. */
    op: z.enum(["add", "replace", "remove", "set_provenance"]),
    path: ObjectPath,
    old_value: Json.optional(),
    new_value: Json.optional(),
    provenance: Provenance.optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    const hasNew = c.new_value !== undefined;
    const segments = c.path.split("/");
    if ((c.op === "remove" || c.op === "set_provenance") && hasNew) ctx.addIssue({ code: "custom", message: `${c.op} hat kein new_value` });
    if ((c.op === "add" || c.op === "replace") && !hasNew) ctx.addIssue({ code: "custom", message: `${c.op} verlangt new_value` });
    if (c.op === "set_provenance") {
      if (c.provenance === undefined) ctx.addIssue({ code: "custom", message: "set_provenance verlangt provenance" });
      if (segments.length !== 4) ctx.addIssue({ code: "custom", message: "set_provenance gilt nur für ganze Objekte (/objects/<typ>/<id>)" });
    }
    if (segments[4] === PROVENANCE_KEY) {
      ctx.addIssue({ code: "custom", message: `${PROVENANCE_KEY} wird nur über provenance bzw. set_provenance geschrieben` });
    }
    const v = c.new_value;
    if (segments.length === 4 && v && typeof v === "object" && !Array.isArray(v) && Object.hasOwn(v, PROVENANCE_KEY)) {
      ctx.addIssue({ code: "custom", message: `new_value darf ${PROVENANCE_KEY} nicht enthalten` });
    }
  });
export type Change = z.infer<typeof Change>;

export const Patch = z
  .object({
    patch_id: Id,
    case_id: Id,
    base_revision: z.number().int().nonnegative(),
    changes: z.array(Change).min(1),
  })
  .strict();
export type Patch = z.infer<typeof Patch>;
