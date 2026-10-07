// Gemeinsame Fixtures für die Runtime-Tests. Wird nicht aus index.ts exportiert.
import { fileURLToPath } from "node:url";
import { FakeModelAdapter, MemoryAttemptLog, MemoryStateAdapter, ModelConfig, type FakeReply } from "@speedboat/adapters";
import { apply_patch, create_case, type Actor, type CaseState, type StateAdapter } from "@speedboat/core";
import { load_pack_dir, PackRegistry, type PackBundle } from "./index.js";

export const FIXTURE_DIR = fileURLToPath(new URL("./test-fixtures/pack", import.meta.url));
export const models = ModelConfig.parse({ models: { default: { model: "m-default" }, frontier: { model: "m-frontier" } } });
export const human: Actor = { id: "u-dev", kind: "human", roles: ["editor"] };
export const AT = "2026-10-07T10:00:00.000Z";
export const now = () => AT;

export const bundle: PackBundle = load_pack_dir(FIXTURE_DIR, { models });

/** Akte mit einer Quelle (Provenienz USER), gespeichert im übergebenen State-Adapter. */
export async function seedCase(state: StateAdapter, case_id = "case-1"): Promise<CaseState> {
  const s0 = create_case({ case_id, pack: bundle.pack, actor: human }, { now });
  const r = apply_patch(
    s0,
    { patch_id: `seed-${case_id}`, case_id, base_revision: 0, changes: [{ op: "add", path: "/objects/source/s1", new_value: { text: "Quelle eins" }, provenance: "USER" }] },
    human,
    bundle.pack,
    { now },
  );
  if (r.status !== "APPLIED") throw new Error(JSON.stringify(r));
  await state.create(r.case);
  return r.case;
}

export function deps(replies: FakeReply[] | ((call: import("@speedboat/adapters").FakeCall) => FakeReply)) {
  const state = new MemoryStateAdapter();
  const model = new FakeModelAdapter(replies);
  const attempts = new MemoryAttemptLog();
  return { state, model, attempts, packs: new PackRegistry([bundle]), now };
}

export const items = [
  { label: "Erstes", reason: "GEHEIME BEGRÜNDUNG A" },
  { label: "Zweites", reason: "GEHEIME BEGRÜNDUNG B" },
];
