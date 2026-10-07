// Kein Test darf die echte Modell-API erreichen. Jeder fetch an anthropic.com schlägt fehl.
const realFetch = globalThis.fetch;
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/(^|\.)anthropic\.com/.test(new URL(url).hostname)) {
    throw new Error(`Testsperre: Aufruf der echten Modell-API blockiert (${url})`);
  }
  return realFetch(input, init);
};
