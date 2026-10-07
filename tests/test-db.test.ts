import { describe, expect, it } from "vitest";

describe("Testdatenbank", () => {
  it("Tests sehen nie eine Datenbank, deren Name nicht auf _test endet", () => {
    const url = process.env["DATABASE_URL"];
    if (url === undefined) return; // ohne TEST_DATABASE_URL laufen keine Postgres-Tests
    expect(new URL(url).pathname.replace(/^\//, "")).toMatch(/_test$/);
    expect(url).toBe(process.env["TEST_DATABASE_URL"]);
  });
});
