import { z } from "zod";
import { Id, InputPath, JsonObject } from "./common.js";

export const BlockType = z.enum(["extract", "generate", "critic", "validate", "ask", "gate", "freeze", "action"]);
export type BlockType = z.infer<typeof BlockType>;

export const Isolation = z.enum(["shared", "fresh_context"]);

export const BlockContract = z
  .object({
    block: Id,
    type: BlockType,
    input: z.array(InputPath),
    output_schema: JsonObject,
    markers: z.array(Id).optional(),
    bias: Id.optional(),
    isolation: Isolation,
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.markers !== undefined && c.type !== "critic") {
      ctx.addIssue({ code: "custom", path: ["markers"], message: "Marker gibt es nur bei critic" });
    }
  });
export type BlockContract = z.infer<typeof BlockContract>;
