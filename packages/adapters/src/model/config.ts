import { readFileSync } from "node:fs";
import { z } from "zod";

export const ModelEntry = z
  .object({
    model: z.string().min(1),
    effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
    max_tokens: z.number().int().positive().default(16000),
  })
  .strict();

/** Zuordnung model_hint → Modell. Liegt in config/models.json, nicht im Code. */
export const ModelConfig = z
  .object({
    models: z.record(z.string().min(1), ModelEntry).refine((m) => Object.keys(m).length > 0, "mindestens ein model_hint"),
    /** Serverseitiger Refusal-Fallback. Standard: aus; eine Ablehnung ist ein endgültiger Fehler. */
    refusal_fallback: z.object({ enabled: z.boolean() }).strict().default({ enabled: false }),
  })
  .strict();
export type ModelConfig = z.infer<typeof ModelConfig>;

export function loadModelConfig(path: string | URL): ModelConfig {
  return ModelConfig.parse(JSON.parse(readFileSync(path, "utf8")));
}
