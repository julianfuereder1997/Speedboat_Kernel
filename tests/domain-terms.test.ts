import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACKAGES = join(ROOT, "packages");
const PACKAGE_DIRS = readdirSync(PACKAGES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(PACKAGES, d.name));

/** Domänenbegriffe, die in packages/ nie vorkommen dürfen (siehe CLAUDE.md; MCP, API und Runtime ebenso). */
const FORBIDDEN: Array<{ term: string; pattern: RegExp }> = [
  { term: "FFG", pattern: /(?<![a-z])ffg(?![a-z])/i },
  { term: "Förder", pattern: /f(ö|oe)rder/i },
  { term: "QG<n>", pattern: /(?<![a-z])qg\d+/i },
  { term: "RF<n>", pattern: /(?<![a-z])rf\d+/i },
  { term: "Constitution", pattern: /constitution/i },
  { term: "Framing", pattern: /framing/i },
  { term: "Antrag", pattern: /antrag/i },
];

function findTerms(text: string): string[] {
  return FORBIDDEN.filter(({ pattern }) => pattern.test(text)).map(({ term }) => term);
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules") return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("packages/ ist domänenfrei", () => {
  it("prüft alle Pakete, mindestens core, adapters, runtime, api und mcp", () => {
    expect(PACKAGE_DIRS.map((d) => relative(PACKAGES, d)).sort()).toEqual(expect.arrayContaining(["adapters", "api", "core", "mcp", "runtime"]));
  });

  it("enthält keinen Domänenbegriff", () => {
    const files = PACKAGE_DIRS.flatMap(filesUnder);
    expect(files.length).toBeGreaterThan(50);
    const hits = files.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, i) => findTerms(line).map((term) => `${relative(ROOT, file)}:${i + 1} enthält „${term}“: ${line.trim()}`)),
    );
    expect(hits).toEqual([]);
  });

  it("deckt jeden Beispielbegriff aus CLAUDE.md ab", () => {
    const claude = readFileSync(join(ROOT, "CLAUDE.md"), "utf8").replace(/\s+/g, " ");
    const list = /Domänenbegriffe \(z\. B\. ([^)]+)\)/.exec(claude)?.[1];
    expect(list, "Begriffsliste in CLAUDE.md nicht gefunden").toBeDefined();
    for (const term of list!.split(",").map((t) => t.trim())) {
      expect(findTerms(term), term).not.toEqual([]);
    }
  });

  it.each([
    ["FFG", "const x = 'FFG';"],
    ["Förder", "// Förderquote"],
    ["Förder", "foerderung"],
    ["QG<n>", "gates.QG2"],
    ["RF<n>", "flag: 'RF05'"],
    ["Constitution", "projectConstitution"],
    ["Framing", "framings[]"],
    ["Antrag", "Antragsteller"],
  ])("erkennt %s in %j", (term, text) => {
    expect(findTerms(text)).toContain(term);
  });

  it.each(["diffgraph", "perf1", "frame", "constants", "Auftrag"])("schlägt bei %j nicht an", (text) => {
    expect(findTerms(text)).toEqual([]);
  });
});
