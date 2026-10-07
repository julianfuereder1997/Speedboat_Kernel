import { z } from "zod";

export const Id = z.string().min(1);
export const Timestamp = z.iso.datetime();
export const Json = z.json();
export const JsonObject = z.record(z.string(), Json);

/** JSON Pointer (RFC 6901). */
export const Pointer = z.string().regex(/^(\/[^/]*)*$/, "kein JSON Pointer");

/** JSON Pointer, in dem ein Segment `*` für „jede ID“ stehen darf. */
export const InputPath = Pointer.refine((p) => p.length > 0, "leerer Pfad");

/** Pfad, den ein Patch beschreiben darf: mindestens /objects/<typ>/<id>. */
export const ObjectPath = z.string().regex(/^\/objects\/[^/*]+\/[^/*]+(\/[^/]*)*$/, "Pfad muss unter /objects/<typ>/<id> liegen");

/** Reservierter Schlüssel an jedem Objekt; nur der Kern schreibt ihn. */
export const PROVENANCE_KEY = "_provenance";

/** Provenienz: entweder nur der Wert (z. B. ein Status aus dem Pack) oder Wert mit Quelle und Fundstelle. */
export const Provenance = z.union([
  z.string().min(1),
  z
    .object({
      status: z.string().min(1),
      source: z.string().min(1).optional(),
      locator: z.string().min(1).optional(),
    })
    .strict(),
]);
export type Provenance = z.infer<typeof Provenance>;
export const provenanceValue = (p: Provenance) => (typeof p === "string" ? p : p.status);

/** Rolle, die der Kern für jede Gate-Entscheidung und jedes Siegel verlangt. */
export const REVIEWER_ROLE = "reviewer";

export const ActorKind = z.enum(["human", "block"]);

export const Actor = z
  .object({
    id: Id,
    kind: ActorKind,
    roles: z.array(z.string().min(1)),
  })
  .strict();
export type Actor = z.infer<typeof Actor>;

/** Akteur ohne Rollen, wie er im Audit steht. */
export const ActorRef = z.object({ id: Id, kind: ActorKind }).strict();
export type ActorRef = z.infer<typeof ActorRef>;
