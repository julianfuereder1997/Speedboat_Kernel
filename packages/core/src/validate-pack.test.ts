import { describe, expect, it } from "vitest";
import { validate_pack } from "./index.js";
import type { PackIssue, PackInput } from "./index.js";
import { samplePack } from "./test-support.js";

/** Kopie des Beispiel-Packs, verändert durch `edit`. */
function variant(edit: (p: PackInput & Record<string, any>) => void): unknown {
  const p = structuredClone(samplePack) as PackInput & Record<string, any>;
  edit(p);
  return p;
}

const codes = (issues: PackIssue[]) => issues.map((i) => i.code);
const block = (name: string) => ({
  block: name,
  type: "generate" as const,
  input: [],
  output_schema: { type: "object" },
  isolation: "shared" as const,
});

describe("validate_pack: gültig", () => {
  it("das Beispiel-Pack ist gültig, ohne Warnungen", () => {
    expect(validate_pack(samplePack)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it("ein Baustein, den niemand braucht, ist nur eine Warnung", () => {
    const r = validate_pack(
      variant((p) => {
        p.blocks.push(block("lonely"));
      }),
    );
    expect(r.valid).toBe(true);
    expect(r.warnings).toEqual([expect.objectContaining({ code: "UNUSED_BLOCK", at: "blocks.lonely" })]);
  });

  it("ein Baustein, der nur als Abhängigkeit gebraucht wird, ist keine Warnung", () => {
    const r = validate_pack(
      variant((p) => {
        p.blocks.push(block("prep"));
        p.dependencies["make-idea"] = ["prep"];
      }),
    );
    expect(r).toEqual({ valid: true, errors: [], warnings: [] });
  });
});

describe("validate_pack: Fehler", () => {
  const errorsOf = (raw: unknown) => {
    const r = validate_pack(raw);
    expect(r.valid).toBe(false);
    return r.errors;
  };

  it("bei ungültiger Struktur", () => {
    const errors = errorsOf({ pack: "x" });
    expect(errors.length).toBeGreaterThan(0);
    expect(new Set(codes(errors))).toEqual(new Set(["INVALID_STRUCTURE"]));
    expect(errors.map((e) => e.at)).toContain("blocks");
  });

  it("bei Zyklus, und das Gate, das davon abhängt, ist nie erfüllbar", () => {
    const errors = errorsOf(
      variant((p) => {
        p.blocks.push(block("a"), block("b"));
        p.dependencies["a"] = ["b"];
        p.dependencies["b"] = ["a"];
        p.dependencies["make-idea"] = ["a"];
      }),
    );
    expect(errors).toContainEqual(expect.objectContaining({ code: "CYCLE", message: expect.stringMatching(/a → b → a|b → a → b/) }));
    expect(errors).toContainEqual(expect.objectContaining({ code: "GATE_UNSATISFIABLE", at: "gates.g1.requires" }));
  });

  it("bei Selbstabhängigkeit", () => {
    expect(codes(errorsOf(variant((p) => void (p.dependencies["make-idea"] = ["make-idea"]))))).toContain("CYCLE");
  });

  it("bei Abhängigkeit auf einen unbekannten Baustein; das Gate ist dann nie erfüllbar", () => {
    const errors = errorsOf(variant((p) => void (p.dependencies["make-idea"] = ["ghost"])));
    expect(errors).toContainEqual(expect.objectContaining({ code: "UNKNOWN_BLOCK", at: "dependencies.make-idea" }));
    expect(errors).toContainEqual(expect.objectContaining({ code: "GATE_UNSATISFIABLE", at: "gates.g1.requires" }));
  });

  it("bei Abhängigkeiten für einen unbekannten Baustein", () => {
    expect(errorsOf(variant((p) => void (p.dependencies["ghost"] = [])))).toContainEqual(
      expect.objectContaining({ code: "UNKNOWN_BLOCK", at: "dependencies.ghost" }),
    );
  });

  it("bei unbekanntem Baustein in requires oder checks", () => {
    const errors = errorsOf(
      variant((p) => {
        p.gates["g1"]!.requires.push("ghost");
        p.gates["g1"]!.checks.push("phantom");
      }),
    );
    expect(errors).toContainEqual(expect.objectContaining({ code: "UNKNOWN_BLOCK", at: "gates.g1.requires" }));
    expect(errors).toContainEqual(expect.objectContaining({ code: "UNKNOWN_BLOCK", at: "gates.g1.checks" }));
  });

  it("bei check, der kein validate-Baustein ist", () => {
    expect(errorsOf(variant((p) => void p.gates["g1"]!.checks.push("make-idea")))).toContainEqual(
      expect.objectContaining({ code: "CHECK_NOT_VALIDATOR", at: "gates.g1.checks" }),
    );
  });

  it("bei Gate ohne Entscheidung", () => {
    expect(codes(errorsOf(variant((p) => void (p.gates["g1"]!.decisions = []))))).toContain("NO_DECISIONS");
  });

  it("bei abschließender Entscheidung, die das Gate nicht kennt", () => {
    expect(errorsOf(variant((p) => void (p.gates["g1"]!.final = ["done"])))).toContainEqual(
      expect.objectContaining({ code: "UNKNOWN_DECISION", at: "gates.g1.final" }),
    );
  });

  it("bei freezes.on mit einer Entscheidung, die das Gate nicht kennt", () => {
    expect(errorsOf(variant((p) => void (p.gates["g1"]!.freezes = { paths: ["/objects/idea/*"], on: ["done"] })))).toContainEqual(
      expect.objectContaining({ code: "UNKNOWN_DECISION", at: "gates.g1.freezes.on" }),
    );
  });

  it("bei freezes.paths mit unbekanntem Objekttyp", () => {
    expect(errorsOf(variant((p) => void (p.gates["g1"]!.freezes = { paths: ["/objects/ghost/*"], on: ["accept"] })))).toContainEqual(
      expect.objectContaining({ code: "UNKNOWN_OBJECT_TYPE", at: "gates.g1.freezes.paths" }),
    );
  });

  it("bei freezes.paths, die kein ganzes Objekt bezeichnen", () => {
    const r = validate_pack(variant((p) => void (p.gates["g1"]!.freezes = { paths: ["/objects/idea/i1/title"], on: ["accept"] })));
    expect(codes(r.errors)).toContain("INVALID_STRUCTURE");
  });

  it("bei doppelten Entscheidungen je Gate", () => {
    expect(codes(errorsOf(variant((p) => void p.gates["g1"]!.decisions.push("accept"))))).toContain("DUPLICATE_DECISION");
  });

  it("bei doppelten Bausteinen, Markern, Rollen oder Provenienz-Werten", () => {
    const errors = codes(
      errorsOf(
        variant((p) => {
          p.blocks.push(structuredClone(p.blocks[0]!));
          p.markers.push({ id: "weak" });
          p.roles.push("editor");
          p.provenance_values.push("ASSUMED");
        }),
      ),
    );
    expect(errors).toEqual(expect.arrayContaining(["DUPLICATE_BLOCK", "DUPLICATE_MARKER", "DUPLICATE_ROLE", "DUPLICATE_PROVENANCE_VALUE"]));
  });

  it("bei Kritiker ohne Marker", () => {
    expect(codes(errorsOf(variant((p) => void (p.blocks[1]!.markers = []))))).toContain("CRITIC_WITHOUT_MARKERS");
    expect(codes(errorsOf(variant((p) => void delete p.blocks[1]!.markers)))).toContain("CRITIC_WITHOUT_MARKERS");
  });

  it("bei Kritiker ohne fresh_context", () => {
    expect(codes(errorsOf(variant((p) => void (p.blocks[1]!.isolation = "shared"))))).toContain("CRITIC_NOT_ISOLATED");
  });

  it("bei Marker im Vertrag, der im Pack fehlt", () => {
    expect(errorsOf(variant((p) => void p.blocks[1]!.markers!.push("ghost")))).toContainEqual(
      expect.objectContaining({ code: "UNKNOWN_MARKER", at: "blocks.check-idea.markers" }),
    );
  });

  it("bei unbekanntem Bias-Profil", () => {
    expect(codes(errorsOf(variant((p) => void (p.blocks[1]!.bias = "ghost"))))).toContain("UNKNOWN_BIAS_PROFILE");
  });

  it("bei Rolle in write_roles, die das Pack nicht definiert", () => {
    expect(errorsOf(variant((p) => void p.object_types["note"]!.write_roles.push("ghost")))).toContainEqual(
      expect.objectContaining({ code: "UNKNOWN_ROLE", at: "object_types.note.write_roles" }),
    );
  });

  it("bei Gates, wenn das Pack die Rolle reviewer nicht vergibt", () => {
    expect(errorsOf(variant((p) => void (p.roles = ["editor"])))).toContainEqual(
      expect.objectContaining({ code: "NO_REVIEWER_ROLE", at: "roles" }),
    );
  });

  it("ohne Gates ist die Rolle reviewer nicht nötig", () => {
    const r = validate_pack(
      variant((p) => {
        p.roles = ["editor"];
        p.gates = {};
        p.blocks = p.blocks.filter((b) => b.block === "make-idea");
        p.dependencies = { "make-idea": [] };
      }),
    );
    expect(r.errors).toEqual([]);
  });

  it("bei Pflicht-Provenienz ohne definierte Provenienz-Werte", () => {
    expect(codes(errorsOf(variant((p) => void (p.provenance_values = []))))).toContain("NO_PROVENANCE_VALUES");
  });

  it("bei nicht kompilierbarem JSON Schema", () => {
    const errors = errorsOf(
      variant((p) => {
        p.object_types["note"]!.schema = { type: "nonsense" };
        p.blocks[0]!.output_schema = { unknownKeyword: true };
      }),
    );
    expect(errors).toContainEqual(expect.objectContaining({ code: "INVALID_SCHEMA", at: "object_types.note.schema" }));
    expect(errors).toContainEqual(expect.objectContaining({ code: "INVALID_SCHEMA", at: "blocks.make-idea.output_schema" }));
  });

  it("jeder Fehler hat code, at und message", () => {
    for (const issue of errorsOf(variant((p) => void (p.dependencies["make-idea"] = ["ghost"])))) {
      expect(issue).toEqual({ code: expect.any(String), at: expect.any(String), message: expect.any(String) });
    }
  });
});
