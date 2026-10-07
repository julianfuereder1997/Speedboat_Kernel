import { ModelError, type ModelAdapter, type ModelPrompt, type ModelResult } from "./types.js";

export type FakeCall = { prompt: ModelPrompt; model_hint: string; output_schema: object };
export type FakeReply = { output: unknown; model?: string } | { error: ModelError };

/** Modell-Adapter für Tests: feste Antworten, jeder Aufruf wird protokolliert. Ruft nie eine API auf. */
export class FakeModelAdapter implements ModelAdapter {
  readonly calls: FakeCall[] = [];
  readonly #replies: FakeReply[] | ((call: FakeCall) => FakeReply);

  constructor(replies: FakeReply[] | ((call: FakeCall) => FakeReply)) {
    this.#replies = Array.isArray(replies) ? [...replies] : replies;
  }

  async complete(prompt: ModelPrompt, model_hint: string, output_schema: object): Promise<ModelResult> {
    const call: FakeCall = { prompt: structuredClone(prompt), model_hint, output_schema };
    this.calls.push(call);
    const reply = typeof this.#replies === "function" ? this.#replies(call) : this.#replies.shift();
    if (!reply) throw new Error("FakeModelAdapter: keine Antwort mehr vorrätig");
    if ("error" in reply) throw reply.error;
    return { output: structuredClone(reply.output), model: reply.model ?? `fake-${model_hint}`, usage: { input_tokens: 0, output_tokens: 0 } };
  }
}
