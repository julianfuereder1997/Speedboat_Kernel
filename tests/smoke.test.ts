import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CORE_VERSION } from "@speedboat/core";

describe("Umgebung", () => {
  it("lädt den Kern über den Workspace", () => {
    expect(CORE_VERSION).toBe("0.0.0");
  });

  it("validiert mit Zod", () => {
    const Revision = z.object({ revision: z.number().int().nonnegative() });
    expect(Revision.parse({ revision: 1 })).toEqual({ revision: 1 });
    expect(Revision.safeParse({ revision: -1 }).success).toBe(false);
  });
});
