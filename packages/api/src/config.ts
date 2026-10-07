/**
 * Prüft die Startkonfiguration. Die Entwicklungsanmeldung (Akteur aus einem Header) ist nur
 * außerhalb von production erlaubt; in production verweigert der Server den Start.
 */
export function assert_startup_config(env: Record<string, string | undefined>): { devAuth: boolean } {
  const devAuth = env["SPEEDBOAT_DEV_AUTH"] === "1";
  if (devAuth && env["NODE_ENV"] === "production") {
    throw new Error("SPEEDBOAT_DEV_AUTH=1 ist mit NODE_ENV=production nicht erlaubt; der Server startet nicht.");
  }
  return { devAuth };
}
