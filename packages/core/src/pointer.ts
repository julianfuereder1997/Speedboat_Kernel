// JSON Pointer (RFC 6901), ergänzt um `*` als Platzhalter für ein beliebiges Segment.

export function parsePointer(pointer: string): string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) throw new Error(`kein JSON Pointer: ${pointer}`);
  return pointer
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

export function formatPointer(segments: readonly string[]): string {
  return segments.map((s) => "/" + s.replace(/~/g, "~0").replace(/\//g, "~1")).join("");
}

type Container = Record<string, unknown> | unknown[];

const isContainer = (v: unknown): v is Container => typeof v === "object" && v !== null;

function child(parent: unknown, key: string): { found: boolean; value?: unknown } {
  if (Array.isArray(parent)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) return { found: false };
    const i = Number(key);
    return i < parent.length ? { found: true, value: parent[i] } : { found: false };
  }
  if (isContainer(parent) && Object.hasOwn(parent, key)) return { found: true, value: (parent as Record<string, unknown>)[key] };
  return { found: false };
}

export function getAt(root: unknown, segments: readonly string[]): { found: boolean; value?: unknown } {
  let cur: unknown = root;
  for (const s of segments) {
    const c = child(cur, s);
    if (!c.found) return { found: false };
    cur = c.value;
  }
  return { found: true, value: cur };
}

/**
 * Wendet eine Operation auf `root` an (mutierend; der Aufrufer übergibt eine Kopie).
 * Liefert eine Fehlermeldung oder null.
 */
export function mutateAt(
  root: unknown,
  segments: readonly string[],
  op: "add" | "replace" | "remove",
  value?: unknown,
): string | null {
  if (segments.length === 0) return "Wurzel kann nicht geändert werden";
  const parent = getAt(root, segments.slice(0, -1));
  if (!parent.found || !isContainer(parent.value)) return "Elternpfad fehlt";
  const key = segments.at(-1)!;
  const target = parent.value;

  if (Array.isArray(target)) {
    if (op === "add") {
      const i = key === "-" ? target.length : Number(key);
      if (!Number.isInteger(i) || i < 0 || i > target.length) return "ungültiger Array-Index";
      target.splice(i, 0, value);
      return null;
    }
    if (!child(target, key).found) return "Pfad existiert nicht";
    if (op === "replace") target[Number(key)] = value;
    else target.splice(Number(key), 1);
    return null;
  }

  const exists = Object.hasOwn(target, key);
  if (op === "add" && exists) return "Pfad existiert bereits";
  if (op !== "add" && !exists) return "Pfad existiert nicht";
  if (op === "remove") delete target[key];
  else target[key] = value;
  return null;
}

/** Passt ein konkreter Pfad (ohne `*`) auf ein Muster? Beide als Segmente. */
function segmentsMatch(pattern: readonly string[], concrete: readonly string[], n: number): boolean {
  for (let i = 0; i < n; i++) if (pattern[i] !== "*" && pattern[i] !== concrete[i]) return false;
  return true;
}

/**
 * Überschneiden sich zwei Pfade, d. h. ist einer (segmentweise) Präfix des anderen?
 * `*` im Muster passt auf jedes Segment.
 */
export function overlaps(pattern: string, concrete: string): boolean {
  const a = parsePointer(pattern);
  const b = parsePointer(concrete);
  return segmentsMatch(a, b, Math.min(a.length, b.length));
}

/** Löst ein Muster mit `*` gegen ein Dokument auf und liefert alle konkreten, existierenden Pfade. */
export function expand(root: unknown, pattern: readonly string[]): string[][] {
  let paths: string[][] = [[]];
  for (const seg of pattern) {
    const next: string[][] = [];
    for (const p of paths) {
      const here = getAt(root, p);
      if (!here.found) continue;
      if (seg === "*") {
        if (isContainer(here.value)) for (const k of Object.keys(here.value)) next.push([...p, k]);
      } else if (child(here.value, seg).found) {
        next.push([...p, seg]);
      }
    }
    paths = next;
  }
  return paths;
}
