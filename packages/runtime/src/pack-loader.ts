import { existsSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type { ModelConfig } from "@speedboat/adapters";
import { load_pack, MODEL_BLOCK_TYPES, type ValidatedPack } from "@speedboat/core";

/** Geprüftes Pack plus die Skill-Texte seiner Modell-Bausteine. */
export type PackBundle = { pack: ValidatedPack; skills: Record<string, string>; dir: string };

/**
 * Lädt ein Pack aus einem Verzeichnis (pack.json + Skill-Dateien) und prüft es vollständig:
 * validate_pack über load_pack, Existenz der Skill-Dateien, Zuordnung jedes model_hint in der Konfiguration.
 */
export function load_pack_dir(dir: string, options: { models: ModelConfig }): PackBundle {
  const root = resolve(dir);
  const loaded = load_pack(JSON.parse(readFileSync(join(root, "pack.json"), "utf8")));
  if (!loaded.ok) {
    throw new Error(`Pack in ${dir} ist ungültig: ${loaded.errors.map((e) => `${e.code} ${e.at}: ${e.message}`).join("; ")}`);
  }
  const problems: string[] = [];
  const skills: Record<string, string> = {};
  for (const b of loaded.pack.blocks) {
    if (b.skill !== undefined) {
      const path = resolve(root, b.skill);
      if (!path.startsWith(root + sep)) problems.push(`${b.block}: ${b.skill} liegt außerhalb des Packs`);
      else if (!existsSync(path)) problems.push(`${b.block}: Skill-Datei ${b.skill} fehlt`);
      else skills[b.block] = readFileSync(path, "utf8");
    }
    if (MODEL_BLOCK_TYPES.includes(b.type)) {
      const hint = b.model_hint ?? "default";
      if (!options.models.models[hint]) problems.push(`${b.block}: model_hint ${hint} ist nicht konfiguriert`);
    }
  }
  if (problems.length > 0) throw new Error(`Pack in ${dir}: ${problems.join("; ")}`);
  return { pack: loaded.pack, skills, dir: root };
}

/** Geladene Packs, gefunden über Name und Version der Akte. */
export class PackRegistry {
  readonly #bundles = new Map<string, PackBundle>();

  constructor(bundles: PackBundle[]) {
    for (const b of bundles) this.#bundles.set(`${b.pack.pack}@${b.pack.version}`, b);
  }

  get(pack: string, version: string): PackBundle | undefined {
    return this.#bundles.get(`${pack}@${version}`);
  }

  list(): PackBundle[] {
    return [...this.#bundles.values()];
  }
}
