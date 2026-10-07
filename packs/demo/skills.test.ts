import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeModelAdapter, loadModelConfig, MemoryAttemptLog, MemoryStateAdapter } from "@speedboat/adapters";
import { apply_patch, create_case } from "@speedboat/core";
import { execute_block, load_pack_dir, PackRegistry } from "@speedboat/runtime";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const models = loadModelConfig(fileURLToPath(new URL("../../config/models.json", import.meta.url)));
const bundle = load_pack_dir(DIR, { models });

describe("Demo-Pack: Skill-Texte und Modelle", () => {
  it("lädt mit der echten Modellkonfiguration: Generator auf default, Kritiker auf frontier", () => {
    const hint = (b: string) => bundle.pack.blocks.find((x) => x.block === b)!.model_hint;
    expect(hint("propose-names")).toBe("default");
    expect(hint("challenge-names")).toBe("frontier");
    expect(models.models["default"]?.model).toBe("claude-sonnet-5");
    expect(models.models["frontier"]?.model).toBe("claude-opus-5-5");
  });

  it("hat echte Skill-Texte in Markdown", () => {
    expect(bundle.skills["propose-names"]).toMatch(/^# /);
    expect(bundle.skills["challenge-names"]).toMatch(/^# /);
    expect(bundle.skills["propose-names"]!.length).toBeGreaterThan(400);
    expect(bundle.skills["challenge-names"]!.length).toBeGreaterThan(400);
  });

  it("der Kritiker-Skill nennt genau die Marker des Packs", () => {
    for (const m of bundle.pack.markers) expect(bundle.skills["challenge-names"]).toContain(m.id);
  });

  it("läuft mit festen Antworten durch die Runtime: Kandidaten werden Objekte, Befunde bleiben im Lauf", async () => {
    const state = new MemoryStateAdapter();
    const human = { id: "u", kind: "human" as const, roles: ["editor"] };
    const s0 = create_case({ case_id: "d1", pack: bundle.pack, actor: human });
    const r = apply_patch(
      s0,
      { patch_id: "brief", case_id: "d1", base_revision: 0, changes: [{ op: "add", path: "/objects/brief/main", new_value: { product: "Reusable cup", audience: "Commuters" }, provenance: "USER_INPUT" }] },
      human,
      bundle.pack,
    );
    if (r.status !== "APPLIED") throw new Error(JSON.stringify(r));
    await state.create(r.case);
    const model = new FakeModelAdapter((c) =>
      c.model_hint === "default"
        ? { output: { candidates: [{ name: "Loopcup", rationale: "loop" }, { name: "Cup", rationale: "short" }] } }
        : { output: { findings: [{ marker: "too_generic", target: "/objects/candidate/gen-1", note: "any cup" }] } },
    );
    const deps = { state, model, attempts: new MemoryAttemptLog(), packs: new PackRegistry([bundle]) };
    expect(await execute_block(deps, { run_id: "gen", case_id: "d1", block: "propose-names", requested_by: "u" }, 1, { maxAttempts: 3 })).toMatchObject({ status: "done", patch: "APPLIED" });
    expect(await execute_block(deps, { run_id: "crit", case_id: "d1", block: "challenge-names", requested_by: "u" }, 1, { maxAttempts: 3 })).toMatchObject({ status: "done" });
    const s = (await state.load("d1"))!;
    expect(Object.values(s.objects["candidate"]!).map((c) => c["name"])).toEqual(["Loopcup", "Cup"]);
    expect(s.runs.at(-1)?.output).toEqual({ findings: [{ marker: "too_generic", target: "/objects/candidate/gen-1", note: "any cup" }] });
    expect(JSON.stringify(model.calls[1])).not.toContain("rationale");
  });
});
