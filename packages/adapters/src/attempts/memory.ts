import type { AttemptEntry, AttemptLog } from "./types.js";

export class MemoryAttemptLog implements AttemptLog {
  readonly #entries: AttemptEntry[] = [];

  async record(entry: AttemptEntry): Promise<void> {
    this.#entries.push(structuredClone(entry));
  }

  async list(runId: string): Promise<AttemptEntry[]> {
    return this.#entries.filter((e) => e.run_id === runId).sort((a, b) => a.attempt - b.attempt).map((e) => structuredClone(e));
  }
}
