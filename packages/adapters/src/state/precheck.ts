import { CaseState, type SaveResult } from "@speedboat/core";

/** Prüfungen, die jeder StateAdapter vor dem Schreiben gleich macht. */
export function precheck(state: CaseState, expectedRevision?: number): Extract<SaveResult, { ok: false }> | null {
  const parsed = CaseState.safeParse(state);
  if (!parsed.success) return { ok: false, code: "INVALID_STATE", message: parsed.error.message };
  if (expectedRevision !== undefined && state.revision <= expectedRevision) {
    return { ok: false, code: "INVALID_STATE", message: `neue Revision ${state.revision} liegt nicht über ${expectedRevision}` };
  }
  return null;
}
