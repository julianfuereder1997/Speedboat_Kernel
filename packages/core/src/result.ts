import type { Actor } from "./schemas/common.js";
import type { AuditEntry, CaseState, ChangeRequest } from "./schemas/case-state.js";

export type RejectCode =
  | "INVALID_PATCH"
  | "INVALID_RUN"
  | "WRONG_CASE"
  | "PACK_MISMATCH"
  | "STALE_REVISION"
  | "DUPLICATE_PATCH"
  | "DUPLICATE_RUN_ID"
  | "UNKNOWN_OBJECT_TYPE"
  | "UNKNOWN_BLOCK"
  | "UNKNOWN_GATE"
  | "UNKNOWN_MARKER"
  | "SCHEMA_VIOLATION"
  | "MISSING_PROVENANCE"
  | "INVALID_PROVENANCE"
  | "FORBIDDEN"
  | "PATH_CONFLICT"
  | "GATE_BLOCKED"
  | "INVALID_DECISION"
  | "ALREADY_FROZEN"
  | "NOT_FOUND";

export type Rejected = { status: "REJECTED"; code: RejectCode; message: string; details?: unknown };
export type Applied = { status: "APPLIED"; case: CaseState };
export type ReviewRequired = { status: "REVIEW_REQUIRED"; case: CaseState; change_request: ChangeRequest };

export type Options = { now?: () => string };
export const nowOf = (o?: Options) => (o?.now ?? (() => new Date().toISOString()))();

export const reject = (code: RejectCode, message: string, details?: unknown): Rejected =>
  details === undefined ? { status: "REJECTED", code, message } : { status: "REJECTED", code, message, details };

/**
 * Einziger Weg, wie der Kern eine neue Akte erzeugt: Revision +1 und genau ein Audit-Eintrag.
 * `update` bekommt eine Kopie der Akte und die neue Revision.
 */
export function commit(
  state: CaseState,
  actor: Actor,
  at: string,
  entry: Pick<AuditEntry, "action" | "ref" | "paths" | "provenance">,
  update: (draft: CaseState, revision: number) => void,
): CaseState {
  const draft = structuredClone(state);
  const revision = state.revision + 1;
  update(draft, revision);
  draft.revision = revision;
  const audit: AuditEntry = { revision, at, actor: { id: actor.id, kind: actor.kind }, action: entry.action, ref: entry.ref, paths: entry.paths };
  if (entry.provenance !== undefined) audit.provenance = entry.provenance;
  draft.audit.push(audit);
  return draft;
}
