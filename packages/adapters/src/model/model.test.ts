import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { AnthropicModelAdapter, type AnthropicClientLike } from "./anthropic.js";
import { toApiSchema } from "./api-schema.js";
import { ModelConfig, loadModelConfig } from "./config.js";
import { FakeModelAdapter } from "./fake.js";
import { ModelError } from "./types.js";

const config = ModelConfig.parse({
  models: {
    frontier: { model: "claude-opus-5-5", effort: "high", max_tokens: 16000 },
    default: { model: "claude-sonnet-5", effort: "medium", max_tokens: 8000 },
  },
});
const prompt = { system: "Du bist ein Prüfer.", user: '{"kontext": 1}' };
const schema = { type: "object", required: ["findings"], properties: { findings: { type: "array", items: { type: "object" } } } };

function message(over: Partial<Anthropic.Message> = {}): Anthropic.Message {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text: '{"findings":[]}', citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 120, output_tokens: 30 },
    ...over,
  } as Anthropic.Message;
}

function fakeClient(reply: () => Promise<unknown>) {
  const create = vi.fn((_params: unknown) => reply());
  const betaCreate = vi.fn((_params: unknown) => reply());
  const client = { messages: { create }, beta: { messages: { create: betaCreate } } } as unknown as AnthropicClientLike;
  return { client, create, betaCreate };
}

async function modelError(p: Promise<unknown>): Promise<ModelError> {
  const e = await p.then(
    () => {
      throw new Error("erwartet ModelError");
    },
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(ModelError);
  return e as ModelError;
}

describe("toApiSchema", () => {
  const input = {
    type: "object",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          properties: { name: { type: "string", minLength: 1, maxLength: 40 }, score: { type: "number", minimum: 0, maximum: 1 } },
        },
      },
      mode: { type: "string", enum: ["a", "b"], description: "Modus" },
    },
  };

  it("setzt additionalProperties: false an jedem Objekt und entfernt nicht unterstützte Regeln", () => {
    expect(toApiSchema(input)).toEqual({
      type: "object",
      required: ["items"],
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { name: { type: "string" }, score: { type: "number" } },
          },
        },
        mode: { type: "string", enum: ["a", "b"], description: "Modus" },
      },
    });
  });

  it("verändert das Schema des Packs nicht", () => {
    const before = structuredClone(input);
    toApiSchema(input);
    expect(input).toEqual(before);
  });
});

describe("loadModelConfig", () => {
  it("liest die Zuordnung model_hint → Modell aus der Konfigurationsdatei des Repos", () => {
    const c = loadModelConfig(new URL("../../../../config/models.json", import.meta.url));
    expect(c.models["frontier"]?.model).toBe("claude-opus-5-5");
    expect(c.models["default"]?.model).toBe("claude-sonnet-5");
    expect(c.refusal_fallback.enabled).toBe(false);
  });

  it("schaltet den Refusal-Fallback standardmäßig ab", () => {
    expect(ModelConfig.parse({ models: { default: { model: "m" } } }).refusal_fallback.enabled).toBe(false);
  });

  it("lehnt unbekannte Effort-Stufen und leere Zuordnungen ab", () => {
    expect(ModelConfig.safeParse({ models: { default: { model: "m", effort: "turbo" } } }).success).toBe(false);
    expect(ModelConfig.safeParse({ models: {} }).success).toBe(false);
  });
});

describe("AnthropicModelAdapter", () => {
  it("schickt genau eine user-Nachricht, Skill als system, Modell und Effort aus der Konfiguration, Schema für die API", async () => {
    const { client, create, betaCreate } = fakeClient(async () => message());
    const result = await new AnthropicModelAdapter({ config, client }).complete(prompt, "frontier", schema);

    expect(create).toHaveBeenCalledTimes(1);
    expect(betaCreate).not.toHaveBeenCalled();
    const params = create.mock.calls[0]![0] as Record<string, unknown>;
    expect(params).toEqual({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
      output_config: { effort: "high", format: { type: "json_schema", schema: toApiSchema(schema) } },
    });
    expect(result).toEqual({ output: { findings: [] }, model: "claude-opus-5-5", usage: { input_tokens: 120, output_tokens: 30 } });
  });

  it("wählt das Modell über den Hint", async () => {
    const { client, create } = fakeClient(async () => message({ model: "claude-sonnet-5" }));
    await new AnthropicModelAdapter({ config, client }).complete(prompt, "default", schema);
    expect(create.mock.calls[0]![0]).toMatchObject({ model: "claude-sonnet-5", max_tokens: 8000, output_config: { effort: "medium" } });
  });

  it("unbekannter Hint: endgültiger Fehler, kein Aufruf", async () => {
    const { client, create } = fakeClient(async () => message());
    const e = await modelError(new AnthropicModelAdapter({ config, client }).complete(prompt, "turbo", schema));
    expect(e).toMatchObject({ code: "UNKNOWN_HINT", retryable: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("Ablehnung durch das Modell: endgültiger Fehler mit Grund, Modell und Tokens", async () => {
    const { client } = fakeClient(async () =>
      message({ stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber", explanation: "nein" } as never, content: [] }),
    );
    const e = await modelError(new AnthropicModelAdapter({ config, client }).complete(prompt, "frontier", schema));
    expect(e).toMatchObject({ code: "REFUSAL", retryable: false, model: "claude-opus-5-5", usage: { input_tokens: 120, output_tokens: 30 } });
    expect(e.message).toMatch(/cyber/);
  });

  it("abgeschnittene Ausgabe und ungültiges JSON sind wiederholbar", async () => {
    const cut = fakeClient(async () => message({ stop_reason: "max_tokens" }));
    expect(await modelError(new AnthropicModelAdapter({ config, client: cut.client }).complete(prompt, "frontier", schema))).toMatchObject({
      code: "MAX_TOKENS",
      retryable: true,
    });
    const junk = fakeClient(async () => message({ content: [{ type: "text", text: "kein json", citations: null }] }));
    expect(await modelError(new AnthropicModelAdapter({ config, client: junk.client }).complete(prompt, "frontier", schema))).toMatchObject({
      code: "INVALID_JSON",
      retryable: true,
    });
  });

  it("Rate-Limit und Serverfehler sind wiederholbar, Anfragefehler nicht", async () => {
    const limited = fakeClient(async () => {
      throw Anthropic.APIError.generate(429, { error: { message: "slow down" } }, "slow down", new Headers());
    });
    expect(await modelError(new AnthropicModelAdapter({ config, client: limited.client }).complete(prompt, "frontier", schema))).toMatchObject({
      code: "API_ERROR",
      retryable: true,
    });
    const bad = fakeClient(async () => {
      throw Anthropic.APIError.generate(400, { error: { message: "bad" } }, "bad", new Headers());
    });
    expect(await modelError(new AnthropicModelAdapter({ config, client: bad.client }).complete(prompt, "frontier", schema))).toMatchObject({
      code: "API_ERROR",
      retryable: false,
    });
  });

  it("Refusal-Fallback nur, wenn er in der Konfiguration eingeschaltet ist", async () => {
    const withFallback = ModelConfig.parse({ ...config, refusal_fallback: { enabled: true } });
    const { client, create, betaCreate } = fakeClient(async () => message());
    await new AnthropicModelAdapter({ config: withFallback, client }).complete(prompt, "frontier", schema);
    expect(create).not.toHaveBeenCalled();
    expect(betaCreate.mock.calls[0]![0]).toMatchObject({ betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  });

  it("mit echtem SDK-Client greift die Testsperre: die echte API wird nie erreicht", async () => {
    const real = new Anthropic({ apiKey: "test-key", maxRetries: 0 });
    const e = await modelError(new AnthropicModelAdapter({ config, client: real }).complete(prompt, "frontier", schema));
    expect(e.message).toMatch(/Testsperre/);
  });
});

describe("FakeModelAdapter", () => {
  it("liefert feste Antworten der Reihe nach und protokolliert jeden Aufruf einzeln", async () => {
    const fake = new FakeModelAdapter([{ output: { a: 1 } }, { output: { b: 2 } }]);
    expect((await fake.complete(prompt, "default", schema)).output).toEqual({ a: 1 });
    expect((await fake.complete({ system: "s2", user: "u2" }, "frontier", {})).output).toEqual({ b: 2 });
    expect(fake.calls).toEqual([
      { prompt, model_hint: "default", output_schema: schema },
      { prompt: { system: "s2", user: "u2" }, model_hint: "frontier", output_schema: {} },
    ]);
  });

  it("kann Fehler liefern und wirft, wenn keine Antwort mehr vorrätig ist", async () => {
    const fake = new FakeModelAdapter([{ error: new ModelError("REFUSAL", "nein", false) }]);
    expect(await modelError(fake.complete(prompt, "default", schema))).toMatchObject({ code: "REFUSAL" });
    await expect(fake.complete(prompt, "default", schema)).rejects.toThrow(/keine Antwort/);
  });

  it("kann Antworten aus dem Aufruf berechnen", async () => {
    const fake = new FakeModelAdapter((call) => ({ output: { echo: call.model_hint } }));
    expect((await fake.complete(prompt, "frontier", schema)).output).toEqual({ echo: "frontier" });
  });
});
