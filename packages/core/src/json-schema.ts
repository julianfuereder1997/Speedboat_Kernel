import { Ajv, type ValidateFunction } from "ajv";

const ajv = new Ajv({ allErrors: true, strict: true });
const cache = new WeakMap<object, ValidateFunction>();

export type SchemaCheck = { ok: true } | { ok: false; errors: Array<{ instancePath: string; message: string }> };

/** Kompiliert ein JSON Schema (aus dem Pack) einmal und prüft einen Wert dagegen. */
export function checkSchema(schema: object, value: unknown): SchemaCheck {
  let validate = cache.get(schema);
  if (!validate) {
    validate = ajv.compile(schema);
    cache.set(schema, validate);
  }
  if (validate(value)) return { ok: true };
  return { ok: false, errors: (validate.errors ?? []).map((e) => ({ instancePath: e.instancePath, message: e.message ?? "" })) };
}

/** Prüft, ob ein JSON Schema kompilierbar ist. Liefert die Fehlermeldung oder null. */
export function schemaError(schema: object): string | null {
  try {
    if (!cache.has(schema)) cache.set(schema, ajv.compile(schema));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
