import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ModelConfig } from "@speedboat/adapters";
import { build_context, create_case } from "@speedboat/core";
import { build_prompt, load_pack_dir, output_to_patch, PackRegistry } from "./index.js";
import { FIXTURE_DIR, bundle, human, models, now } from "./test-support.js";

const tmp: string[] = [];
afterEach(() => tmp.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
function copyFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "pack-"));
  tmp.push(dir);
  cpSync(FIXTURE_DIR, dir, { recursive: true });
  return dir;
}

describe("load_pack_dir", () => {
  it("lädt Pack und Skill-Texte; das Pack ist geprüft", () => {
    expect(bundle.pack.pack).toBe("runtime-fixture");
    expect(bundle.skills).toEqual({
      propose: expect.stringContaining("Propose items"),
      review: expect.stringContaining("Check each item"),
    });
    expect(Object.isFrozen(bundle.pack)).toBe(true);
  });

  it("wirft, wenn eine Skill-Datei fehlt", () => {
    const dir = copyFixture();
    rmSync(join(dir, "skills/review.md"));
    expect(() => load_pack_dir(dir, { models })).toThrow(/review.*skills\/review.md/);
  });

  it("wirft, wenn ein model_hint nicht konfiguriert ist", () => {
    const only = ModelConfig.parse({ models: { default: { model: "m" } } });
    expect(() => load_pack_dir(FIXTURE_DIR, { models: only })).toThrow(/frontier/);
  });

  it("wirft mit den Fehlern aus validate_pack, wenn das Pack ungültig ist", () => {
    const dir = copyFixture();
    writeFileSync(join(dir, "pack.json"), JSON.stringify({ pack: "x" }));
    expect(() => load_pack_dir(dir, { models })).toThrow(/INVALID_STRUCTURE/);
  });

  it("PackRegistry findet Packs über Name und Version", () => {
    const reg = new PackRegistry([bundle]);
    expect(reg.get("runtime-fixture", "1.0.0")).toBe(bundle);
    expect(reg.get("runtime-fixture", "2.0.0")).toBeUndefined();
  });
});

describe("build_prompt", () => {
  const state = (() => {
    const s = create_case({ case_id: "c", pack: bundle.pack, actor: human }, { now });
    s.objects = {
      source: { s1: { text: "Quelle", _provenance: "USER" } },
      item: { i1: { label: "Eins", reason: "GEHEIME BEGRÜNDUNG" } },
    };
    return s;
  })();

  it("Generator: Skill als system, nur der Vertragskontext im user-Teil", () => {
    const p = build_prompt(bundle, "propose", build_context(state, bundle.pack, "propose"));
    expect(p.system).toBe(bundle.skills["propose"]!.trim());
    expect(p.user).toContain('"text": "Quelle"');
    expect(p.user).not.toContain("Eins");
  });

  it("Kritiker: Skill plus Bias-Profil und Marker; die Begründung des Generators kommt nie vor", () => {
    const p = build_prompt(bundle, "review", build_context(state, bundle.pack, "review"));
    expect(p.system).toContain(bundle.skills["review"]);
    expect(p.system).toContain("An outside reader with no context.");
    expect(p.user).toContain("vague");
    expect(p.user).toContain("duplicate");
    expect(p.user).toContain('"label": "Eins"');
    expect(JSON.stringify(p)).not.toContain("GEHEIME BEGRÜNDUNG");
    expect(JSON.stringify(p)).not.toContain("reason");
  });

  it("ist deterministisch", () => {
    const ctx = build_context(state, bundle.pack, "review");
    expect(build_prompt(bundle, "review", ctx)).toEqual(build_prompt(bundle, "review", ctx));
  });
});

describe("output_to_patch", () => {
  const contract = bundle.pack.blocks.find((b) => b.block === "propose")!;
  const base = { contract, run_id: "run-1", case_id: "c", base_revision: 4 };

  it("macht aus jedem Element ein neues Objekt mit fester Provenienz", () => {
    const r = output_to_patch({ ...base, output: { items: [{ label: "A", reason: "x" }, { label: "B", reason: "y" }] } });
    expect(r).toEqual({
      ok: true,
      patch: {
        patch_id: "run-1-patch",
        case_id: "c",
        base_revision: 4,
        changes: [
          { op: "add", path: "/objects/item/run-1-0", new_value: { label: "A", reason: "x" }, provenance: "GENERATED" },
          { op: "add", path: "/objects/item/run-1-1", new_value: { label: "B", reason: "y" }, provenance: "GENERATED" },
        ],
      },
    });
  });

  it("nimmt ID und Provenienz aus Feldern, wenn der Vertrag es sagt", () => {
    const c = { ...contract, writes: { object_type: "item", items: "/items", id_field: "key", provenance_field: "src" } };
    const r = output_to_patch({ ...base, contract: c, output: { items: [{ key: "k1", src: "USER", label: "A", reason: "x" }] } });
    expect(r).toMatchObject({ ok: true, patch: { changes: [{ path: "/objects/item/k1", new_value: { label: "A", reason: "x" }, provenance: "USER" }] } });
  });

  it.each([
    ["kein Array", { items: "x" }],
    ["Element ist kein Objekt", { items: [1] }],
    ["Pfad fehlt", {}],
  ])("lehnt ab: %s", (_n, output) => {
    expect(output_to_patch({ ...base, output })).toMatchObject({ ok: false });
  });

  it("lehnt doppelte oder fehlende IDs ab", () => {
    const c = { ...contract, writes: { object_type: "item", items: "/items", id_field: "key" } };
    expect(output_to_patch({ ...base, contract: c, output: { items: [{ key: "a" }, { key: "a" }] } })).toMatchObject({ ok: false });
    expect(output_to_patch({ ...base, contract: c, output: { items: [{ label: "ohne key" }] } })).toMatchObject({ ok: false });
  });
});
