# Entscheidungsprotokoll – Kern

Entscheidungen, die bei der Umsetzung von `packages/core` und `packages/adapters`
getroffen wurden. Je Eintrag: Entscheidung, Grund, Datum. Neue Einträge unten anfügen;
eine geänderte Entscheidung bekommt einen neuen Eintrag, der den alten nennt.

---

## E-01 Provenienz steht am Objekt und im Audit

- **Entscheidung:** Die Provenienz eines Objekts steht am Objekt selbst im reservierten
  Schlüssel `_provenance` und zusätzlich im Audit-Eintrag des Patches. Sie gilt pro Objekt,
  nicht pro Feld. Nur der Kern schreibt `_provenance`; das Objektschema des Packs prüft den
  Schlüssel nicht mit. Die erlaubten Werte definiert das Pack (`provenance_values`); der Kern
  prüft nur, dass bei `requires_provenance` ein gültiger Wert gesetzt ist. Eine reine
  Provenienz-Änderung geht über die Patch-Operation `set_provenance` (ohne `new_value`).
  Ändert sich ein Wert ohne neue Provenienz, entfällt die alte. Widersprüchliche Provenienz
  für dasselbe Objekt in einem Patch wird abgelehnt.
- **Grund:** `build_context` liefert Kritikern nur Objekte, nie das Audit. Ein Kritiker muss
  aber Annahmen von Belegtem unterscheiden können. Pro Objekt statt pro Feld hält Patches,
  Siegel und Kontexte einfach (siehe Regel R-01 für Pack-Autoren).
- **Datum:** 07.10.2026

## E-02 Change Requests stehen in der Akte

- **Entscheidung:** Ein Patch auf ein versiegeltes Objekt ergibt `REVIEW_REQUIRED`. Der Kern
  legt den Change Request im Feld `change_requests` der Akte an (revision +1, Audit-Eintrag).
  Das versiegelte Objekt bleibt unverändert. Ein gemischter Patch (versiegelt und frei) wird
  als Ganzes zum Change Request, nichts davon wird angewendet.
- **Grund:** Gemeint ist „das eingefrorene Objekt bleibt unverändert“, nicht „die Akte bleibt
  unverändert“ (Doku A.3: Change/Audit gehört zur Fallakte). So ist auch der Change Request
  revisioniert und nachvollziehbar.
- **Datum:** 07.10.2026

## E-03 Akteure haben eine Art: `human` oder `block`

- **Entscheidung:** Jeder Akteur hat `kind` (`human` | `block`) und Rollen. Gate-Entscheidungen
  und Siegel verlangen `kind = human` **und** die Rolle `reviewer`. Ein Block entscheidet nie,
  egal welche Rollen das Pack ihm gibt.
- **Grund:** Die Regel „Gate-Entscheidungen trifft nur ein Mensch“ darf nicht davon abhängen,
  dass ein Pack Rollen richtig vergibt.
- **Datum:** 07.10.2026

## E-04 Ajv statt `z.fromJSONSchema`

- **Entscheidung:** Objekt- und Ausgabeschemas der Packs sind JSON Schema (reine Daten) und
  werden mit Ajv 8 im Strict-Modus geprüft. Zod bleibt für die Schemas des Kerns selbst.
- **Grund:** `z.fromJSONSchema` ist in Zod 4.6.5 als „semi-experimental … liable to change“
  markiert. Ajv ist der etablierte Validator; der Strict-Modus fängt Tippfehler in Packs ab.
- **Datum:** 07.10.2026

## E-05 Ausgabeformat von Kritikern und Validatoren

- **Entscheidung:** Zusätzlich zum `output_schema` des Vertrags verlangt der Kern:
  Kritiker liefern `{ findings: [{ marker, target, … }] }`, Validatoren `{ passed: boolean, … }`.
  `marker` muss im Pack und im Vertrag des Kritikers stehen. `target` ist der Pfad eines
  ganzen Objekts (`/objects/<typ>/<id>`), das existiert und innerhalb der Eingaben des
  Kritikers liegt.
- **Grund:** `gate_check` und spätere Cockpit-Ansichten brauchen eine feste Form, unabhängig
  vom Pack. Ein Kritiker soll nur über das urteilen, was er sehen durfte.
- **Datum:** 07.10.2026

## E-06 Ein Validator-Lauf zählt nur nach der letzten Änderung seiner Eingaben

- **Entscheidung:** Ein `check` an einem Gate ist nur erfüllt, wenn der letzte Lauf des
  Validators bestanden hat **und** seine Revision mindestens die Revision der letzten
  Änderung an einem seiner Eingabepfade ist. Sonst gilt der Check als `stale`.
- **Grund:** Sonst könnte ein bestandener Check auf einem Stand beruhen, der nicht mehr gilt.
- **Datum:** 07.10.2026

## E-07 Läufe stehen in der Akte

- **Entscheidung:** Run-Records (`runs`) sind Teil der Akte, append-only, mit run_id,
  Baustein, Zeitpunkt, Revision der Akte zum Zeitpunkt des Laufs und Eingabepfaden.
  Jeder Eintrag erhöht die Revision und schreibt Audit.
- **Grund:** `gate_check` prüft gegen das Protokoll der Akte; was nicht in der Akte steht,
  ist nicht nachweisbar.
- **Datum:** 07.10.2026

## E-08 Eingabepfade sind JSON Pointer mit `*`

- **Entscheidung:** `contract.input` sind JSON Pointer (RFC 6901); ein Segment `*` steht für
  eine beliebige ID, z. B. `/objects/idea/*/title`.
- **Grund:** Ein Kritiker muss „alle Titel, aber keine Begründungen“ anfordern können, ohne
  die IDs vorab zu kennen.
- **Datum:** 07.10.2026

## E-09 Nur geprüfte Packs: `ValidatedPack`

- **Entscheidung:** `load_pack` ist der einzige Weg zu einem `ValidatedPack`: prüfen
  (`validate_pack`), tief einfrieren, intern registrieren. Alle Kernfunktionen nehmen nur
  diesen Typ an. Zur Compile-Zeit verhindert ein nicht exportiertes Markierungssymbol, dass
  ein normales `Pack` übergeben wird; zur Laufzeit wirft jede Kernfunktion einen `TypeError`,
  wenn das Pack nicht registriert ist (z. B. per Cast vorbeigeschmuggelt). `build_context`
  nimmt den Bausteinnamen und holt den Vertrag aus dem Pack.
- **Grund:** Ein ungeprüftes oder nach der Prüfung verändertes Pack darf den Kern nie
  erreichen. Der Vertrag eines Bausteins soll nicht vom Aufrufer kommen.
- **Datum:** 07.10.2026

## E-10 Abhängigkeiten: ein Lauf zählt als erfüllt

- **Entscheidung:** Ein Baustein darf laufen (`next_allowed_steps`, `record_run`), wenn jede
  seiner Abhängigkeiten mindestens einen Lauf in der Akte hat. Sonst lehnt `record_run` mit
  `DEPENDENCY_NOT_MET` ab.
- **Bekannte Einschränkung:** Ein Lauf zählt als erfüllte Abhängigkeit, auch wenn sich seine
  Eingaben danach geändert haben. Das löst die Impact-Analyse in Phase 3.
- **Datum:** 07.10.2026

## E-11 Abschließende Gate-Entscheidungen

- **Entscheidung:** Das Pack markiert je Gate, welche Entscheidungen abschließend sind
  (`final`). Ist die letzte Entscheidung abschließend, erscheint das Gate nicht mehr in
  `next_allowed_steps`, und `decide_gate` lehnt mit `GATE_CLOSED` ab. Ist sie es nicht,
  erscheint das Gate wieder, sobald `gate_check` erfüllt ist, mit `last_decision`.
  Wiederöffnen geht später nur über einen Change Request.
- **Grund:** Überarbeitungsschleifen müssen möglich sein, eine Freigabe darf aber nicht
  still überschrieben werden.
- **Datum:** 07.10.2026

## E-12 Automatisches Versiegeln am Gate, in einer Revision

- **Entscheidung:** Ein Gate kann `freezes: { paths, on }` haben. Bei einer Entscheidung aus
  `on` versiegelt `decide_gate` alle passenden Objekte (`*` als ID erlaubt) im Auftrag des
  entscheidenden Menschen. Entscheidung und alle Siegel ergeben **genau eine Revision** mit
  einem Audit-Eintrag (`action: decide_gate`, Feld `frozen` mit den Pfaden). Bereits
  versiegelte Objekte werden übersprungen; fehlt ein konkret genanntes Objekt, wird die
  Entscheidung abgelehnt.
- **Grund:** Entscheidung und Versiegeln gehören fachlich zusammen; eine Revision macht den
  Stand atomar. `freeze` und `decide_gate` bauen das Siegel mit derselben Funktion, der Code
  wird dadurch nicht komplizierter. Nur bei bestimmten Entscheidungen zu versiegeln verhindert,
  dass etwa „überarbeiten“ einen Stand einfriert.
- **Datum:** 07.10.2026

## E-13 Packs mit Gates vergeben die Rolle `reviewer`

- **Entscheidung:** Hat ein Pack Gates, muss `reviewer` in `roles` stehen; sonst ist das Pack
  ungültig (`NO_REVIEWER_ROLE`).
- **Grund:** Ohne diese Rolle könnte niemand ein Gate entscheiden; der Fehler soll beim
  Laden auffallen, nicht im Fall.
- **Datum:** 07.10.2026

## E-14 In CI wird nichts still übersprungen

- **Entscheidung:** GitHub Actions führt bei jedem Push und Pull Request Typecheck,
  Domänen-Test und alle Tests aus, mit Postgres als Service-Container. Fehlt in CI
  `DATABASE_URL`, schlägt ein eigener Test fehl, statt die Postgres-Tests zu überspringen.
  Lokal ohne `DATABASE_URL` werden sie weiterhin übersprungen.
- **Grund:** Ein grüner CI-Lauf muss bedeuten, dass auch der State-Adapter geprüft wurde.
- **Datum:** 07.10.2026

---

# Phase 1: Durchstich vom MCP-Werkzeug bis zur Akte

## E-15 Startobjekte über create_case; Ergänzungen folgen in Phase 2

- **Entscheidung:** `create_case` nimmt optional Startobjekte samt Provenienz an. Der Kern legt
  die Akte an (Revision 0) und trägt die Objekte im Namen des anfragenden Menschen per
  `apply_patch` ein (Revision 1, eigener Audit-Eintrag). Lehnt der Kern ab, entsteht keine Akte.
- **Grund:** Ein Generator braucht Eingaben; keines der fünf Werkzeuge schreibt sonst Objekte.
- **Ausblick:** In Phase 2 folgt ein eigenes Werkzeug für menschliche Ergänzungen und
  Korrekturen an einer bestehenden Akte.
- **Datum:** 07.10.2026

## E-16 Neue Vertragsfelder: skill, model_hint, actor_roles, writes

- **Entscheidung:** Modell-Bausteine (`extract`, `generate`, `critic`) verweisen per `skill` auf eine
  Markdown-Datei im Pack (relativer Pfad, kein `..`). `model_hint` (Standard `default`) wählt das
  Modell über die Konfiguration. `actor_roles` sind die Rollen, mit denen ein Baustein Patches
  schreibt; `reviewer` ist verboten. `generate` und `extract` brauchen `writes`: welcher
  Objekttyp aus welchem Array der Ausgabe entsteht, mit fester Provenienz oder aus einem Feld.
  Run-Records speichern `requested_by`, den anstoßenden Menschen. `validate_pack` prüft alles
  davon; Existenz der Skill-Dateien und Zuordnung der Hints prüft der Pack-Loader der Runtime.
- **Grund:** Alles, was je Domäne variiert, bleibt im Pack; der Kern liest keine Dateien.
- **Datum:** 07.10.2026

## E-17 Ausgabe → Patch über contract.writes

- **Entscheidung:** Die Runtime übersetzt die Ausgabe eines Generators oder einer Extraktion über
  `writes` in `add`-Änderungen (`/objects/<typ>/<id>`, ID aus `id_field` oder `<run_id>-<index>`)
  und wendet sie per `apply_patch` im Namen des Bausteins an. Das Modell schreibt nie selbst Pfade.
- **Grund:** Weniger Fehlerquellen; alle Prüfungen (Rolle, Schema, Provenienz, Siegel) bleiben im Kern.
- **Datum:** 07.10.2026

## E-18 Modell-Adapter: zustandslos, Zuordnung in der Konfiguration

- **Entscheidung:** `ModelAdapter.complete(prompt, model_hint, output_schema)` ist zustandslos:
  ein system-Teil (Skill-Text, bei Kritikern plus Bias-Profil) und genau eine user-Nachricht
  (Kontext aus `build_context` plus Ausgabehinweise). Jeder Kritiker-Lauf ist dadurch ein frischer
  Aufruf ohne Verlauf. `config/models.json` ordnet Hints zu: `frontier` → `claude-opus-5-5`,
  `default` → `claude-sonnet-5`, je mit Effort und `max_tokens`. Im Demo-Pack läuft der Kritiker
  auf `frontier`, der Generator auf `default`. Der Schlüssel kommt aus `ANTHROPIC_API_KEY`.
- **Grund:** Modellwechsel ist Konfiguration, kein Code; Isolation des Kritikers ist strukturell.
- **Datum:** 07.10.2026

## E-19 Schemavereinfachung im Adapter, Ajv bleibt Autorität

- **Entscheidung:** Die strukturierte Ausgabe der API unterstützt nur einen Teil von JSON Schema.
  Der Adapter setzt `additionalProperties: false` an jedem Objekt und entfernt nicht unterstützte
  Regeln (`minLength`, `minimum`, `minItems` …). Die vollständige Prüfung gegen das Pack-Schema
  macht danach Ajv im Kern bei `record_run` und `apply_patch`.
- **Grund:** Das Pack-Schema bleibt maßgeblich, unabhängig vom Modellanbieter.
- **Datum:** 07.10.2026

## E-20 Refusal-Fallback standardmäßig aus

- **Entscheidung:** Lehnt das Modell ab (`stop_reason: refusal`), ist der Lauf endgültig
  gescheitert, mit klarem Grund (`MODEL_REFUSAL`, Kategorie, Modell, Tokens). Der serverseitige
  Fallback existiert als Option in `config/models.json` (`refusal_fallback.enabled`), ist aber aus.
- **Grund:** Welches Modell einen Lauf erledigt, soll nachvollziehbar und konfiguriert sein.
- **Datum:** 07.10.2026

## E-21 Wiederholungen mit fester Obergrenze

- **Entscheidung:** Höchstens **3 Versuche** je Lauf (`MAX_ATTEMPTS`, pg-boss `retryLimit = 2`).
  Deterministische Fehler (Akte/Pack/Baustein fehlt, kein Modell-Baustein, Abhängigkeit oder
  Eingabe fehlt, unbekannter Hint, Ablehnung durch das Modell, 4xx der API) sind sofort endgültig.
  Abgelehnte Modellausgaben (Schema, Marker, Ziel, Patch) werden **genau einmal** wiederholt.
  Vorübergehende Fehler (429/5xx, abgeschnittene oder ungültige JSON-Ausgabe, Konflikt beim
  Speichern) bis zur Obergrenze. Ein Konflikt beim Speichern wiederholt den ganzen Job mit einem
  neuen Modellaufruf.
- **Bekannte Kosten:** Ein Speicherkonflikt kostet einen zusätzlichen Modellaufruf. Die alte Ausgabe
  wiederzuverwenden, wenn sich die Eingaben nicht geändert haben, ist auf später verschoben.
- **Datum:** 07.10.2026

## E-22 Abgelehnte Versuche in einem Protokoll außerhalb der Akte

- **Entscheidung:** Jeder gescheiterte Versuch landet in `run_attempts` (run_id, Versuch, Code,
  Grund, Modell, Tokens, Zeitpunkt), getrennt von der Akte. `get_run` liefert ihn mit.
  Unbekannte Tokenzahlen bleiben leer, nicht 0.
- **Grund:** Qualitätssignal für das Pack, ohne die Akte mit Fehlversuchen zu füllen.
- **Datum:** 07.10.2026

## E-23 Ein Job speichert genau einmal

- **Entscheidung:** Run-Record, Patch und ggf. Change Request entstehen im Speicher; gespeichert wird
  einmal am Ende mit der erwarteten Revision. Jeder Fehler lässt die Akte unverändert. Ein Job, dessen
  run_id schon in der Akte steht, gilt als erledigt (Idempotenz bei Wiederholung).
- **Datum:** 07.10.2026

## E-24 Entwicklungsanmeldung per Header, nie in production

- **Entscheidung:** Bis zur echten Anmeldung (Phase 4) nimmt die API den Akteur aus dem Header
  `x-speedboat-actor`, nur mit `SPEEDBOAT_DEV_AUTH=1`; sonst 401. Akteure der API sind immer
  `kind = human`. Mit `SPEEDBOAT_DEV_AUTH=1` und `NODE_ENV=production` verweigert der Server den Start.
- **Datum:** 07.10.2026

## E-25 MCP-Server ohne eigene Logik

- **Entscheidung:** Fünf Werkzeuge (`create_case`, `get_case`, `next_allowed_steps`, `run_block`,
  `get_run`), jedes genau ein API-Aufruf. Der Akteur kommt aus der Konfiguration
  (`SPEEDBOAT_DEV_ACTOR`, Standard: lokaler Entwicklungsnutzer).
- **Datum:** 07.10.2026

## E-26 Kein Test ruft die echte Modell-API

- **Entscheidung:** Alle Tests nutzen den Fake-Adapter. Zusätzlich sperrt `vitest.setup.ts` jeden
  `fetch` an `anthropic.com`. Das Live-Skript (`pnpm demo:live`) läuft nur manuell und verweigert
  den Start in CI.
- **Datum:** 07.10.2026

## E-27 Domänenfrei sind alle Pakete

- **Entscheidung:** Der Domänen-Test prüft alle Pakete unter `packages/` (core, adapters, runtime,
  api, mcp), nicht nur `core`.
- **Datum:** 07.10.2026

## E-28 API und Worker in einem Prozess

- **Entscheidung:** In Phase 1 starten API und pg-boss-Worker im selben Prozess (`server.ts`).
  Trennen lässt sich das später, ohne Code in Kern oder Runtime zu ändern.
- **Datum:** 07.10.2026

## E-29 Paketverwaltung

- **Entscheidung:** pnpm hat `@anthropic-ai/sdk@0.132.0` in `minimumReleaseAgeExclude` eingetragen,
  weil die Version jünger als das Mindestalter für Releases war; die Ausnahme gilt nur für diese
  Version. `esbuild` (für `tsx`) läuft ohne Build-Skript, die Binärdatei kommt als Plattformpaket.
- **Datum:** 07.10.2026

---

# Regeln für Pack-Autoren

- **R-01 Getrennte Provenienz heißt eigenes Objekt.** Provenienz gilt pro Objekt. Was eine
  eigene Herkunft braucht (z. B. ein Wert aus einem Dokument neben einer Annahme), wird als
  eigenes Objekt modelliert, nicht als Feld eines gemeinsamen Objekts.
- **R-02 Kritiker brauchen Marker und frischen Kontext.** Jeder Kritiker hat mindestens einen
  Marker aus der Marker-Liste des Packs und `isolation: fresh_context`.
- **R-03 Kritiker sehen nur, was im Vertrag steht.** Soll ein Kritiker die Provenienz sehen,
  muss sein `input` das ganze Objekt oder `/_provenance` enthalten.
- **R-04 Gates brauchen einen Reviewer.** Ein Pack mit Gates vergibt die Rolle `reviewer`.
- **R-05 Modell-Bausteine brauchen einen Skill-Text.** Jeder `extract`-, `generate`- und
  `critic`-Baustein verweist per `skill` auf eine Markdown-Datei im Pack und nennt einen
  `model_hint`, der in `config/models.json` steht.
- **R-06 Generatoren sagen, was sie schreiben.** `generate` und `extract` brauchen `writes` und
  `actor_roles`; die Rollen müssen die `write_roles` des Zieltyps treffen.
- **R-07 Schemas so eng wie möglich.** Die Modell-API sieht eine vereinfachte Fassung des Schemas;
  Regeln wie `minLength` prüft erst der Kern. Was die API direkt erzwingen kann (z. B. `enum` für
  Marker im Ausgabeschema eines Kritikers), gehört deshalb ins Schema.
