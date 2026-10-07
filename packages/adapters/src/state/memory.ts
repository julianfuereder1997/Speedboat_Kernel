import { CaseState, type SaveResult, type StateAdapter } from "@speedboat/core";
import { precheck } from "./precheck.js";

/** Akten im Arbeitsspeicher; für Tests und lokale Läufe. */
export class MemoryStateAdapter implements StateAdapter {
  readonly #rows = new Map<string, CaseState>();

  async create(state: CaseState): Promise<SaveResult> {
    const invalid = precheck(state);
    if (invalid) return invalid;
    if (this.#rows.has(state.case_id)) return { ok: false, code: "ALREADY_EXISTS", message: `${state.case_id} existiert bereits` };
    this.#rows.set(state.case_id, structuredClone(state));
    return { ok: true };
  }

  async load(caseId: string): Promise<CaseState | null> {
    const row = this.#rows.get(caseId);
    return row ? CaseState.parse(structuredClone(row)) : null;
  }

  async save(state: CaseState, expectedRevision: number): Promise<SaveResult> {
    const invalid = precheck(state, expectedRevision);
    if (invalid) return invalid;
    const current = this.#rows.get(state.case_id);
    if (!current) return { ok: false, code: "NOT_FOUND", message: `${state.case_id} existiert nicht` };
    if (current.revision !== expectedRevision) {
      return { ok: false, code: "REVISION_CONFLICT", message: `gespeichert ist Revision ${current.revision}, erwartet ${expectedRevision}` };
    }
    this.#rows.set(state.case_id, structuredClone(state));
    return { ok: true };
  }
}
