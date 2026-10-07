import { Actor } from "./schemas/common.js";
import type { CaseState } from "./schemas/case-state.js";
import type { Pack } from "./schemas/pack.js";
import { nowOf, type Options } from "./result.js";

/** Legt eine leere Akte mit Revision 0 an. */
export function create_case(input: { case_id: string; pack: Pack; actor: Actor }, opts?: Options): CaseState {
  const actor = Actor.parse(input.actor);
  return {
    case_id: input.case_id,
    pack: input.pack.pack,
    pack_version: input.pack.version,
    revision: 0,
    objects: {},
    decisions: [],
    frozen: {},
    change_requests: [],
    runs: [],
    audit: [{ revision: 0, at: nowOf(opts), actor: { id: actor.id, kind: actor.kind }, action: "create_case", ref: input.case_id, paths: [] }],
  };
}
