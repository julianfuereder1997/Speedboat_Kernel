/** Ein abgelehnter oder fehlgeschlagener Versuch eines Bausteinlaufs. Liegt außerhalb der Akte. */
export type AttemptEntry = {
  run_id: string;
  case_id: string;
  block: string;
  attempt: number;
  code: string;
  message: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  at: string;
};

/** Protokoll abgelehnter Versuche; Qualitätssignal für das Pack. */
export interface AttemptLog {
  record(entry: AttemptEntry): Promise<void>;
  list(runId: string): Promise<AttemptEntry[]>;
}
