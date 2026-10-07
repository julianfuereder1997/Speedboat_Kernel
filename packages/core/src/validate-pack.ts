import { schemaError } from "./json-schema.js";
import { Pack } from "./schemas/pack.js";

export type PackIssue = { code: string; at: string; message: string };
export type PackValidation = { valid: boolean; errors: PackIssue[]; warnings: PackIssue[] };

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

/**
 * Prüft ein Pack mechanisch. Fehler machen es ungültig; Warnungen nicht.
 * Fehler: Strukturfehler, fehlende Verweise, Zyklen, nie erfüllbare Gates, doppelte Namen,
 * Kritiker ohne Marker oder ohne fresh_context, unbekannte Rollen, nicht kompilierbare Schemas.
 * Warnung: Bausteine, die weder ein Gate noch ein anderer Baustein braucht.
 */
export function validate_pack(input: unknown): PackValidation {
  const parsed = Pack.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => ({ code: "INVALID_STRUCTURE", at: i.path.join("."), message: i.message })),
      warnings: [],
    };
  }
  const pack = parsed.data;
  const errors: PackIssue[] = [];
  const warnings: PackIssue[] = [];
  const error = (code: string, at: string, message: string) => errors.push({ code, at, message });

  const blocks = new Map(pack.blocks.map((b) => [b.block, b]));
  const markers = new Set(pack.markers.map((m) => m.id));
  const roles = new Set(pack.roles);

  for (const d of duplicates(pack.blocks.map((b) => b.block))) error("DUPLICATE_BLOCK", `blocks.${d}`, `Baustein ${d} ist mehrfach definiert`);
  for (const d of duplicates(pack.markers.map((m) => m.id))) error("DUPLICATE_MARKER", `markers.${d}`, `Marker ${d} ist mehrfach definiert`);
  for (const d of duplicates(pack.roles)) error("DUPLICATE_ROLE", `roles.${d}`, `Rolle ${d} ist mehrfach definiert`);
  for (const d of duplicates(pack.provenance_values)) {
    error("DUPLICATE_PROVENANCE_VALUE", `provenance_values.${d}`, `Provenienz-Wert ${d} ist mehrfach definiert`);
  }

  // Objekttypen
  for (const [type, def] of Object.entries(pack.object_types)) {
    const at = `object_types.${type}`;
    for (const role of def.write_roles) {
      if (!roles.has(role)) error("UNKNOWN_ROLE", `${at}.write_roles`, `Rolle ${role} ist im Pack nicht definiert`);
    }
    if (def.requires_provenance && pack.provenance_values.length === 0) {
      error("NO_PROVENANCE_VALUES", `${at}.requires_provenance`, `${type} verlangt Provenienz, aber das Pack definiert keine Werte`);
    }
    const schemaMsg = schemaError(def.schema);
    if (schemaMsg) error("INVALID_SCHEMA", `${at}.schema`, schemaMsg);
  }

  // Bausteine
  for (const b of pack.blocks) {
    const at = `blocks.${b.block}`;
    const schemaMsg = schemaError(b.output_schema);
    if (schemaMsg) error("INVALID_SCHEMA", `${at}.output_schema`, schemaMsg);
    if (b.bias !== undefined && !Object.hasOwn(pack.bias_profiles, b.bias)) {
      error("UNKNOWN_BIAS_PROFILE", `${at}.bias`, `Bias-Profil ${b.bias} ist im Pack nicht definiert`);
    }
    if (b.type === "critic") {
      if (!b.markers || b.markers.length === 0) error("CRITIC_WITHOUT_MARKERS", `${at}.markers`, `Kritiker ${b.block} hat keine Marker`);
      if (b.isolation !== "fresh_context") error("CRITIC_NOT_ISOLATED", `${at}.isolation`, `Kritiker ${b.block} muss fresh_context haben`);
    }
    for (const m of b.markers ?? []) {
      if (!markers.has(m)) error("UNKNOWN_MARKER", `${at}.markers`, `Marker ${m} ist im Pack nicht definiert`);
    }
  }

  // Abhängigkeiten: Verweise
  const depsOf = (name: string) => pack.dependencies[name] ?? [];
  for (const [name, deps] of Object.entries(pack.dependencies)) {
    const at = `dependencies.${name}`;
    if (!blocks.has(name)) error("UNKNOWN_BLOCK", at, `Abhängigkeiten für unbekannten Baustein ${name}`);
    for (const dep of deps) if (!blocks.has(dep)) error("UNKNOWN_BLOCK", at, `${name} hängt von unbekanntem Baustein ${dep} ab`);
  }

  // Abhängigkeiten: Zyklen (jeder Zyklus einmal, beginnend beim kleinsten Namen)
  const cycles = new Map<string, string[]>();
  const state = new Map<string, "visiting" | "done">();
  const visit = (name: string, stack: string[]) => {
    if (state.get(name) === "done" || !blocks.has(name)) return;
    if (state.get(name) === "visiting") {
      const cycle = stack.slice(stack.indexOf(name));
      const start = cycle.indexOf([...cycle].sort()[0]!);
      const normalized = [...cycle.slice(start), ...cycle.slice(0, start)];
      cycles.set(normalized.join("\u0000"), normalized);
      return;
    }
    state.set(name, "visiting");
    for (const dep of depsOf(name)) visit(dep, [...stack, name]);
    state.set(name, "done");
  };
  for (const name of blocks.keys()) visit(name, []);
  for (const cycle of cycles.values()) {
    error("CYCLE", `dependencies.${cycle[0]}`, `Zyklus: ${[...cycle, cycle[0]].join(" → ")}`);
  }

  // Erfüllbarkeit: ein Baustein kann laufen, wenn er existiert und alle Abhängigkeiten laufen können.
  const memo = new Map<string, boolean>();
  const runnable = (name: string, path: ReadonlySet<string> = new Set()): boolean => {
    if (memo.has(name)) return memo.get(name)!;
    if (!blocks.has(name) || path.has(name)) return false;
    const next = new Set(path).add(name);
    const ok = depsOf(name).every((dep) => runnable(dep, next));
    memo.set(name, ok);
    return ok;
  };

  // Gates
  for (const [gate, def] of Object.entries(pack.gates)) {
    const at = `gates.${gate}`;
    if (def.decisions.length === 0) error("NO_DECISIONS", `${at}.decisions`, `Gate ${gate} hat keine Entscheidung`);
    for (const d of duplicates(def.decisions)) error("DUPLICATE_DECISION", `${at}.decisions`, `Entscheidung ${d} ist an ${gate} mehrfach definiert`);
    for (const field of ["requires", "checks"] as const) {
      const unknown = def[field].filter((b) => !blocks.has(b));
      for (const b of unknown) error("UNKNOWN_BLOCK", `${at}.${field}`, `Gate ${gate} verweist auf unbekannten Baustein ${b}`);
      const blocked = def[field].filter((b) => blocks.has(b) && !runnable(b));
      if (blocked.length > 0) {
        error("GATE_UNSATISFIABLE", `${at}.${field}`, `Gate ${gate} ist nie erfüllbar; nie lauffähig: ${blocked.join(", ")}`);
      }
    }
    for (const b of def.checks) {
      const t = blocks.get(b)?.type;
      if (t !== undefined && t !== "validate") error("CHECK_NOT_VALIDATOR", `${at}.checks`, `${b} ist ${t}, checks verlangen validate`);
    }
  }

  // Warnung: Bausteine, die niemand braucht
  const used = new Set<string>();
  for (const def of Object.values(pack.gates)) for (const b of [...def.requires, ...def.checks]) used.add(b);
  for (const [name, deps] of Object.entries(pack.dependencies)) for (const d of deps) if (d !== name) used.add(d);
  for (const name of blocks.keys()) {
    if (!used.has(name)) {
      warnings.push({ code: "UNUSED_BLOCK", at: `blocks.${name}`, message: `${name} wird von keinem Gate und keinem Baustein gebraucht` });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
