// Die strukturierte Ausgabe der Modell-API unterstützt nur einen Teil von JSON Schema.
// Hier wird das Pack-Schema für die API vereinfacht. Die volle Prüfung macht danach Ajv im Kern.

/** Regeln, die die API nicht unterstützt; sie werden entfernt und später vom Kern geprüft. */
const UNSUPPORTED = new Set([
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "$schema",
]);

export function toApiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toApiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (UNSUPPORTED.has(key)) continue;
    // In properties sind die Schlüssel Feldnamen, keine Schlüsselwörter.
    out[key] =
      key === "properties" && value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toApiSchema(v)]))
        : toApiSchema(value);
  }
  if (out["type"] === "object" || "properties" in out) out["additionalProperties"] = false;
  return out;
}
