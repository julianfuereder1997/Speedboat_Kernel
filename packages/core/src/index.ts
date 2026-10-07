// Domänenfreier Kern. Keine Fachbegriffe, kein Pack-Wissen (siehe CLAUDE.md).
export const CORE_VERSION = "0.0.0";

export * from "./schemas/common.js";
export * from "./schemas/patch.js";
export * from "./schemas/contract.js";
export * from "./schemas/pack.js";
export * from "./schemas/case-state.js";

export { reject, type Applied, type Options, type RejectCode, type Rejected, type ReviewRequired } from "./result.js";
export { create_case } from "./create-case.js";
export { apply_patch, type PatchResult } from "./apply-patch.js";
export { build_context, type BlockContext } from "./build-context.js";
export { CriticOutput, ObjectRef, RunInput, ValidatorOutput, record_run } from "./runs.js";
export { GateDecisionInput, REVIEWER_ROLE, decide_gate, gate_check, lastChangeRevision, type FailedCheck, type GateCheck, type RunViolation } from "./gate.js";
export { canonicalJson, freeze, sha256Of, verify_freeze } from "./freeze.js";
export type { SaveResult, StateAdapter } from "./state-port.js";
export { validate_pack, type PackIssue, type PackValidation } from "./validate-pack.js";
