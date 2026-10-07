import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CaseState, apply_patch, canonicalJson, freeze, sha256Of, verify_freeze } from "./index.js";
import type { CaseState as CaseStateT } from "./index.js";
import { AT, blockWithReviewerRole, deepFreeze, editor, newCase, opts, patch, reviewer, samplePack } from "./test-support.js";

function caseWithNote(): CaseStateT {
  const s0 = newCase();
  const r = apply_patch(
    s0,
    patch(s0, [{ op: "add", path: "/objects/note/n1", new_value: { text: "fact", tags: ["b", "a"] }, provenance: "CONFIRMED" }]),
    editor,
    samplePack,
    opts,
  );
  if (r.status !== "APPLIED") throw new Error(JSON.stringify(r));
  return deepFreeze(r.case);
}

function frozenCase(): CaseStateT {
  const r = freeze(caseWithNote(), "/objects/note/n1", reviewer, samplePack, opts);
  if (r.status !== "APPLIED") throw new Error(JSON.stringify(r));
  return deepFreeze(r.case);
}

describe("canonicalJson / sha256Of", () => {
  it("ist unabhängig von der Schlüsselreihenfolge, aber nicht von der Array-Reihenfolge", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(sha256Of({ x: 1, y: 2 })).toBe(sha256Of({ y: 2, x: 1 }));
    expect(sha256Of([1, 2])).not.toBe(sha256Of([2, 1]));
  });
});

describe("freeze", () => {
  it("versiegelt ein Objekt mit SHA-256, Version 1, revision +1 und Audit; das Objekt bleibt gleich", () => {
    const s = caseWithNote();
    const r = freeze(s, "/objects/note/n1", reviewer, samplePack, opts);
    expect(r.status).toBe("APPLIED");
    if (r.status !== "APPLIED") return;
    const expected = createHash("sha256").update('{"_provenance":"CONFIRMED","tags":["b","a"],"text":"fact"}').digest("hex");
    expect(r.case.frozen["/objects/note/n1"]).toEqual({
      path: "/objects/note/n1",
      version: 1,
      sha256: expected,
      revision: s.revision + 1,
      at: AT,
      by: "u-reviewer",
    });
    expect(r.case.objects).toEqual(s.objects);
    expect(r.case.revision).toBe(s.revision + 1);
    expect(r.case.audit.at(-1)).toMatchObject({ action: "freeze", ref: "/objects/note/n1", paths: [] });
    expect(CaseState.safeParse(r.case).success).toBe(true);
  });

  it("danach ist das Objekt nur noch per Change Request änderbar", () => {
    const s = frozenCase();
    const r = apply_patch(s, patch(s, [{ op: "replace", path: "/objects/note/n1/text", new_value: "neu", provenance: "ASSUMED" }]), editor, samplePack, opts);
    expect(r.status).toBe("REVIEW_REQUIRED");
    if (r.status !== "REVIEW_REQUIRED") return;
    expect(r.case.objects.note?.n1).toEqual(s.objects.note?.n1);
    expect(verify_freeze(r.case, "/objects/note/n1")).toBe(true);
  });

  it("verify_freeze erkennt ein an der Akte vorbei verändertes Objekt", () => {
    const s = frozenCase();
    expect(verify_freeze(s, "/objects/note/n1")).toBe(true);
    const tampered = structuredClone(s);
    tampered.objects.note!.n1!.text = "heimlich";
    expect(verify_freeze(tampered, "/objects/note/n1")).toBe(false);
  });

  const code = (r: ReturnType<typeof freeze>) => (r.status === "REJECTED" ? r.code : r.status);

  it("lehnt doppeltes Versiegeln ab, auch überlappend", () => {
    const s = frozenCase();
    expect(code(freeze(s, "/objects/note/n1", reviewer, samplePack, opts))).toBe("ALREADY_FROZEN");
    expect(code(freeze(s, "/objects/note/n1/text", reviewer, samplePack, opts))).toBe("ALREADY_FROZEN");
  });

  it("lehnt ein fehlendes Objekt ab", () => {
    expect(code(freeze(caseWithNote(), "/objects/note/n9", reviewer, samplePack, opts))).toBe("NOT_FOUND");
  });

  it("lehnt Pfade außerhalb von /objects ab", () => {
    expect(code(freeze(caseWithNote(), "/decisions", reviewer, samplePack, opts))).toBe("NOT_FOUND");
  });

  it("verlangt einen Menschen mit Reviewer-Rolle", () => {
    expect(code(freeze(caseWithNote(), "/objects/note/n1", editor, samplePack, opts))).toBe("FORBIDDEN");
    expect(code(freeze(caseWithNote(), "/objects/note/n1", blockWithReviewerRole, samplePack, opts))).toBe("FORBIDDEN");
  });
});
