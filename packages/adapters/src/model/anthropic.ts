import Anthropic from "@anthropic-ai/sdk";
import { toApiSchema } from "./api-schema.js";
import type { ModelConfig } from "./config.js";
import { ModelError, type ModelAdapter, type ModelPrompt, type ModelResult, type ModelUsage } from "./types.js";

/** Der Teil des SDK-Clients, den der Adapter nutzt; in Tests durch einen Fake ersetzbar. */
export type AnthropicClientLike = {
  messages: { create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> };
  beta: { messages: { create(params: Anthropic.Beta.MessageCreateParamsNonStreaming): Promise<Anthropic.Beta.BetaMessage> } };
};

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/**
 * Modell-Adapter für die Anthropic-API. Der Schlüssel kommt aus der Umgebung (ANTHROPIC_API_KEY),
 * das Modell je model_hint aus der Konfiguration. Jeder Aufruf ist eine einzelne user-Nachricht ohne Verlauf.
 */
export class AnthropicModelAdapter implements ModelAdapter {
  readonly #config: ModelConfig;
  readonly #client: AnthropicClientLike;

  constructor(options: { config: ModelConfig; client?: AnthropicClientLike }) {
    this.#config = options.config;
    this.#client = options.client ?? new Anthropic();
  }

  async complete(prompt: ModelPrompt, model_hint: string, output_schema: object): Promise<ModelResult> {
    const entry = this.#config.models[model_hint];
    if (!entry) throw new ModelError("UNKNOWN_HINT", `model_hint ${model_hint} ist nicht konfiguriert`, false);

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: entry.model,
      max_tokens: entry.max_tokens,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
      output_config: {
        ...(entry.effort ? { effort: entry.effort } : {}),
        format: { type: "json_schema", schema: toApiSchema(output_schema) as Record<string, unknown> },
      },
    };

    let response: Anthropic.Message | Anthropic.Beta.BetaMessage;
    try {
      response = this.#config.refusal_fallback.enabled
        ? await this.#client.beta.messages.create({ ...params, betas: [FALLBACK_BETA], fallbacks: "default" } as Anthropic.Beta.MessageCreateParamsNonStreaming)
        : await this.#client.messages.create(params);
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        const retryable = error.status === undefined || error.status === 408 || error.status === 409 || error.status === 429 || error.status >= 500;
        const cause = error.cause instanceof Error ? ` (${error.cause.message})` : "";
        throw new ModelError("API_ERROR", `Modell-API: ${error.message}${cause}`, retryable, entry.model);
      }
      throw new ModelError("API_ERROR", `Modell-API nicht erreichbar: ${error instanceof Error ? error.message : String(error)}`, true, entry.model);
    }

    const usage: ModelUsage = { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens };
    if (response.stop_reason === "refusal") {
      const d = response.stop_details;
      const reason = [d?.category, d?.explanation].filter(Boolean).join(": ") || "ohne Angabe";
      throw new ModelError("REFUSAL", `Das Modell hat abgelehnt (${reason})`, false, response.model, usage);
    }
    if (response.stop_reason === "max_tokens") {
      throw new ModelError("MAX_TOKENS", `Ausgabe bei max_tokens=${entry.max_tokens} abgeschnitten`, true, response.model, usage);
    }
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    try {
      return { output: JSON.parse(text), model: response.model, usage };
    } catch {
      throw new ModelError("INVALID_JSON", "Ausgabe ist kein gültiges JSON", true, response.model, usage);
    }
  }
}
