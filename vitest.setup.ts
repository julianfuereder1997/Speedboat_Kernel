// Kein Test darf die echte Modell-API erreichen. Jeder fetch an anthropic.com schlägt fehl.
const realFetch = globalThis.fetch;
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/(^|\.)anthropic\.com/.test(new URL(url).hostname)) {
    throw new Error(`Testsperre: Aufruf der echten Modell-API blockiert (${url})`);
  }
  return realFetch(input, init);
};

// Kein Test darf in die Entwicklungsdatenbank schreiben. Tests nutzen nur TEST_DATABASE_URL;
// ein DATABASE_URL aus der Entwicklungsumgebung wird für den Testlauf verworfen.
const testUrl = process.env["TEST_DATABASE_URL"];
delete process.env["DATABASE_URL"];
if (testUrl) {
  const name = new URL(testUrl).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`Testsperre: TEST_DATABASE_URL zeigt auf "${name}"; erlaubt sind nur Datenbanken mit Endung _test.`);
  }
  process.env["DATABASE_URL"] = testUrl;
}
