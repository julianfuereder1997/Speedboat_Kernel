export type ModelPrompt = { system: string; user: string };
export type ModelUsage = { input_tokens: number; output_tokens: number };
export type ModelResult = { output: unknown; model: string; usage: ModelUsage };

/**
 * Zustandslos: Jeder Aufruf ist ein eigener, frischer Modellaufruf ohne Verlauf.
 * model_hint wird über die Konfiguration einem Modell zugeordnet.
 */
export interface ModelAdapter {
  complete(prompt: ModelPrompt, model_hint: string, output_schema: object): Promise<ModelResult>;
}

export type ModelErrorCode = "UNKNOWN_HINT" | "REFUSAL" | "MAX_TOKENS" | "INVALID_JSON" | "API_ERROR";

/** Fehler eines Modellaufrufs. `retryable` entscheidet, ob ein neuer Versuch sinnvoll ist. */
export class ModelError extends Error {
  override readonly name = "ModelError";
  constructor(
    readonly code: ModelErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly model?: string,
    readonly usage?: ModelUsage,
  ) {
    super(message);
  }
}
