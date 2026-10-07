import type { CaseState } from "./schemas/case-state.js";

export type SaveResult = { ok: true } | { ok: false; code: "REVISION_CONFLICT" | "NOT_FOUND" | "ALREADY_EXISTS" | "INVALID_STATE"; message: string };

/**
 * Schnittstelle für den Ort, an dem Akten liegen. Der Kern ruft nur diese Funktionen auf.
 * `save` schreibt nur, wenn die gespeicherte Revision noch `expectedRevision` ist.
 */
export interface StateAdapter {
  create(state: CaseState): Promise<SaveResult>;
  load(caseId: string): Promise<CaseState | null>;
  save(state: CaseState, expectedRevision: number): Promise<SaveResult>;
}
