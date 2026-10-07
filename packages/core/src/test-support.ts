// Gemeinsame Fixtures für die Kern-Tests. Wird nicht aus index.ts exportiert.
import type { Actor, CaseState, PackInput, Patch, ValidatedPack } from "./index.js";
import { create_case, load_pack } from "./index.js";

export const AT = "2026-10-07T10:00:00.000Z";
export const opts = { now: () => AT };

export const editor: Actor = { id: "u-editor", kind: "human", roles: ["editor"] };
export const reviewer: Actor = { id: "u-reviewer", kind: "human", roles: ["reviewer"] };
export const outsider: Actor = { id: "u-outsider", kind: "human", roles: [] };
export const writerBlock: Actor = { id: "make-idea", kind: "block", roles: ["editor"] };
export const blockWithReviewerRole: Actor = { id: "rogue", kind: "block", roles: ["editor", "reviewer"] };

export const sampleRaw: PackInput = {
  pack: "sample",
  version: "1.0.0",
  object_types: {
    note: {
      schema: {
        type: "object",
        required: ["text"],
        properties: { text: { type: "string" }, tags: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
      write_roles: ["editor"],
      requires_provenance: true,
    },
    idea: {
      schema: {
        type: "object",
        required: ["title"],
        properties: { title: { type: "string" }, rationale: { type: "string" } },
        additionalProperties: false,
      },
      write_roles: ["editor"],
    },
  },
  blocks: [
    {
      block: "make-idea",
      type: "generate",
      input: ["/objects/note"],
      output_schema: { type: "object" },
      isolation: "shared",
      skill: "skills/make-idea.md",
      actor_roles: ["editor"],
      writes: { object_type: "idea", items: "/ideas", provenance: "ASSUMED" },
    },
    {
      block: "check-idea",
      type: "critic",
      skill: "skills/check-idea.md",
      model_hint: "frontier",
      input: ["/objects/idea/*/title"],
      output_schema: {
        type: "object",
        required: ["findings"],
        properties: {
          findings: {
            type: "array",
            items: {
              type: "object",
              required: ["marker", "target"],
              properties: { marker: { type: "string" }, target: { type: "string" }, note: { type: "string" } },
            },
          },
        },
      },
      markers: ["weak", "unclear"],
      isolation: "fresh_context",
    },
    {
      block: "lint-idea",
      type: "validate",
      input: ["/objects/idea"],
      output_schema: {
        type: "object",
        required: ["passed"],
        properties: { passed: { type: "boolean" } },
      },
      isolation: "shared",
    },
  ],
  dependencies: { "make-idea": [], "check-idea": ["make-idea"], "lint-idea": ["make-idea"] },
  gates: {
    g1: { requires: ["make-idea", "check-idea"], checks: ["lint-idea"], decisions: ["accept", "rework"], final: ["accept"],
      freezes: { paths: ["/objects/idea/*"], on: ["accept"] } },
  },
  bias_profiles: { skeptic: { perspective: "outside reviewer" } },
  markers: [{ id: "weak" }, { id: "unclear" }],
  roles: ["editor", "reviewer"],
  provenance_values: ["CONFIRMED", "EXTRACTED", "ASSUMED"],
};

/** Lädt ein Pack über load_pack und wirft, wenn es ungültig ist. */
export function mustLoad(raw: unknown): ValidatedPack {
  const r = load_pack(raw);
  if (!r.ok) throw new Error(`Pack ungültig: ${JSON.stringify(r.errors)}`);
  return r.pack;
}

export const samplePack = mustLoad(sampleRaw);

export function newCase(): CaseState {
  return create_case({ case_id: "case-1", pack: samplePack, actor: editor }, opts);
}

let seq = 0;
export function patch(state: CaseState, changes: Patch["changes"], patch_id = `p-${++seq}`): Patch {
  return { patch_id, case_id: state.case_id, base_revision: state.revision, changes };
}

/** Friert ein Objekt tief ein, damit ein Test jede Mutation der Eingabe bemerkt. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}
