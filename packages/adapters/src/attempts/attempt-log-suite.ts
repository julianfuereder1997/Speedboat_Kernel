// Gemeinsame Vertragstests für jedes AttemptLog.
import { expect, it } from "vitest";
import type { AttemptEntry, AttemptLog } from "./types.js";

const entry = (run_id: string, attempt: number, over: Partial<AttemptEntry> = {}): AttemptEntry => ({
  run_id,
  case_id: "case-1",
  block: "propose",
  attempt,
  code: "OUTPUT_REJECTED",
  message: "UNKNOWN_MARKER: boring",
  model: "claude-sonnet-5",
  input_tokens: 1200,
  output_tokens: 300,
  at: "2026-10-07T10:00:00.000Z",
  ...over,
});

export function attemptLogSuite(getLog: () => AttemptLog, newRunId: () => string): void {
  it("speichert abgelehnte Versuche und liefert sie je run_id in Versuchsreihenfolge", async () => {
    const log = getLog();
    const run = newRunId();
    await log.record(entry(run, 2, { code: "MODEL_REFUSAL" }));
    await log.record(entry(run, 1));
    await log.record(entry(newRunId(), 1));
    expect(await log.list(run)).toEqual([entry(run, 1), entry(run, 2, { code: "MODEL_REFUSAL" })]);
  });

  it("speichert Versuche ohne Modell und Tokens (z. B. Konflikt beim Speichern)", async () => {
    const log = getLog();
    const run = newRunId();
    const e: AttemptEntry = { run_id: run, case_id: "c", block: "b", attempt: 1, code: "REVISION_CONFLICT", message: "x", at: "2026-10-07T10:00:00.000Z" };
    await log.record(e);
    expect(await log.list(run)).toEqual([e]);
  });

  it("liefert eine leere Liste für unbekannte Läufe", async () => {
    expect(await getLog().list(newRunId())).toEqual([]);
  });
}
