# Speedboat — Architekturvorschlag: Speedboat als Baukasten

Ein domänenfreier Human-in-the-Loop-Kern mit Packs, Adaptern und Claude als Oberfläche über MCP — aufbauend auf dem MVP v0.4

| **Dokument**    | **Wert**                                                                                                                 |
|-----------------|--------------------------------------------------------------------------------------------------------------------------|
| Titel           | Speedboat — Architekturvorschlag „Baukasten“                                                                             |
| Version         | 1.0 (Entwurf zur Diskussion)                                                                                             |
| Datum           | 24.09.2026                                                                                                               |
| Autor           | Julian Füreder-Kitzmüller                                                                                                |
| Grundlage       | FFG-Basisprogramm MVP Build Spec v0.4 (09.09.2026) · Architekturvorschlag MVP v0.4 v2 · Architekturfeedback (18.09.2026) |
| Adressat        | Normann, Christian                                                                                                       |
| Geltungsbereich | Zielarchitektur ab Etappe 1; der MVP v0.4 bleibt Etappe 1 und Pack Nr. 1                                                 |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong><span class="smallcaps">Worum es geht</span></strong></p>
<p>Der MVP v0.4 zeigt, dass sich die FFG-Methodik als Skills kodieren lässt. Dieses Dokument beschreibt, wie daraus ein Baukasten wird, ohne die Skills oder die Claude-Oberfläche aufzugeben: Claude bleibt oben die Oberfläche, darunter liegt ein kleiner Kern, der uns gehört, und dazwischen steckt ein offener Standard (MCP).</p>
<p>Der Kern setzt die Regeln durch, die Packs enthalten das Fachwissen, die Adapter verbinden nach außen. So wird aus einem FFG-Werkzeug ein System, in dem jede weitere Domäne eine Konfiguration ist und kein neues Projekt.</p></td>
</tr>
</tbody>
</table>

# 1. Kernthese und Leseanleitung

Speedboat verkauft nicht Textproduktion, sondern einen kodierten Entscheidungsprozess. Der MVP v0.4 hat gezeigt, dass sich dieser Prozess in Skills fassen lässt. Offen ist, worauf diese Skills laufen. Dieser Vorschlag beantwortet das mit einem Satz: **Claude oben, der Kern unten, MCP dazwischen.**

Damit bleibt alles erhalten, was v0.4 erarbeitet hat: die Skills, die Gate-Logik, die Provenienz, der Freeze und die Claude-Oberfläche. Neu ist nur, dass die harten Regeln nicht mehr im Prompt stehen, sondern in einem kleinen Programm, das jeder Aufruf passieren muss.

## 1.1 Die vier Sätze, auf die es ankommt

- **Was hart sein muss, prüft ein Skript.** Das Modell schlägt vor, das Skript prüft, der Mensch entscheidet. Pflichtschritte und Gates werden mechanisch durchgesetzt, nicht per Anweisung erbeten.

- **Was sich je Domäne ändert, steht in einer Datei.** Ablauf, Gates, Bias und Bausteine sind Konfiguration. Was gleich bleibt, steht im Code.

- **Was nach außen geht, geht über einen Adapter.** Modell, Zustand, Dokumente und Kommunikation sind einzeln austauschbar, ohne den Kern zu berühren.

- **Die Oberfläche ist ein Zugang, kein Fundament.** Claude spricht über MCP mit dem Kern. Jede andere KI-Oberfläche und jedes eigene Portal kann denselben Kern ansprechen.

## 1.2 Die Anforderungen, aus denen die Architektur folgt

Die Architektur ist keine Geschmacksfrage. Sie folgt aus fünf Anforderungen, die für ein erfolgsbasiert abrechnendes Dreierteam mit sensiblen Kundendaten gelten:

| **Anforderung**        | **Warum**                                                                        | **Architektonische Folge**                           |
|------------------------|----------------------------------------------------------------------------------|------------------------------------------------------|
| Wiederholbarkeit       | Unsere Marge hängt an Stunden pro Fall; Nacharbeit ist nicht verrechenbar        | Ablauf in einer Datei, mechanische Gate-Prüfung      |
| Prüfbarkeit            | Kunden geben ungeschützte Technologie-IP; Entscheidungen müssen nachweisbar sein | Provenienz, versiegelte Stände, Korrektur-Log        |
| Wiederverwendbarkeit   | Beratung skaliert linear mit unseren Stunden, ein Pack nicht                     | Domänenfreier Kern, Domänenwissen in Packs           |
| Anbieterunabhängigkeit | Modellmarkt ändert sich in Monaten, Preise und Qualität schwanken                | Adapter je Außenverbindung, MCP als offener Standard |
| EU-Datenhaltung        | Voraussetzung für Kunden mit Rechtsabteilung und für regulierte Umfelder         | Zielplattform in der EU; heute Stackit als Kandidat  |

## 1.3 Was sich gegenüber v0.4 ändert und was bleibt

| **Bereich**               | **MVP v0.4**                           | **Dieser Vorschlag**                                                           |
|---------------------------|----------------------------------------|--------------------------------------------------------------------------------|
| Skills                    | 19 Skills als Markdown                 | Bleiben unverändert; bekommen einen Bauteil-Vertrag                            |
| Oberfläche                | Claude mit Artifact-Cockpit            | Bleibt Claude, angebunden über MCP; Kundenportal erst ab echten Kundenfällen   |
| Ablaufsteuerung           | Mensch tippt Kommandos in eine Session | Kern kennt den Ablauf aus der process.yaml und bietet nur erlaubte Schritte an |
| Gate-Prüfung              | Überwiegend Prompt-Anweisung           | gate_check im Kern, mechanisch                                                 |
| Schreiben in project.json | Skill schreibt direkt                  | Skill liefert Patch, Kern prüft und schreibt                                   |
| Ablage                    | Google Drive                           | Heute Drive über Adapter, Ziel EU-Plattform                                    |
| Expertise-Pflege          | Skill-Dateien von Hand                 | Autorenmodus im Gespräch plus Regeln aus Gate-Korrekturen                      |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong><span class="smallcaps">Was dieser Vorschlag nicht ist</span></strong></p>
<p>Er ist keine Absage an Claude und kein Plädoyer für eine eigene Plattform ab morgen. Er verschiebt nichts von dem, was v0.4 baut, er legt nur fest, wo die Regeln liegen. Eine eigene Oberfläche ist erst für Kunden nötig, ein Builder im Browser erst für externe Fachexperten.</p></td>
</tr>
</tbody>
</table>

# 2. Die Architektur im Überblick

Die Architektur hat vier Schichten. Oberhalb einer klar gezogenen Linie steht alles, was eine Domäne wie die FFG kennt. Unterhalb steht alles, was für jede Domäne gleich bleibt.

*Abbildung 2 — Konfiguration und Bausteine sind domänenspezifisch, Kern und Adapter nicht.*

| **Schicht**   | **Inhalt**                                                            | **Wer pflegt**                         | **Ändert sich je Domäne** |
|---------------|-----------------------------------------------------------------------|----------------------------------------|---------------------------|
| Konfiguration | process.yaml, Pack, Bias-Profil, Bauteil-Verträge                     | Fachexperte, anfangs mit Unterstützung | Ja                        |
| Bausteine     | Skills als Markdown plus Vertrag, domänenspezifische Validator-Regeln | Fachexperte                            | Ja                        |
| Kern          | transition, gate_check, apply_patch, freeze                           | Technik, selten                        | Nein                      |
| Adapter       | Modell, Zustand, Dokumente, Kommunikation                             | Technik, bei Anbieterwechsel           | Nein                      |

## 2.1 Die Rezeptdatei: process.yaml

Die process.yaml beschreibt den fachlichen Ablauf eines Prozesses: welche Stationen es gibt, welche Bausteine vor einem Gate gelaufen sein müssen, welche Entscheidungen der Reviewer treffen darf und wohin ein Rücksprung führt. Sie ist das Rezept. Sie ist ausdrücklich **nicht** der n8n-Workflow: n8n ist der Postbote für Mails, Formulare und Erinnerungen und gehört zu den Adaptern.

> pack: ffg-basisprogramm
>
> version: 1.0
>
> bias_profile: antragsteller_vs_ffg_gutachter
>
> states: \[S0, S1, S2, S3, S4, S5, S6\]
>
> gates:
>
> QG1:
>
> requires: \[sb-01-intake, sb-02-gaps, sb-03-split, sb-04-flags\]
>
> checks: \[provenance_complete, flags_linked\]
>
> decisions: \[GO, CONDITIONAL_GO, STOP_REROUTE\]
>
> freezes: fact_layer
>
> QG3:
>
> decisions: \[APPROVED, OPEN_ITEMS, REVISION, BACK_TO_QG2\]
>
> on_back: S2

Inhaltlich legt der Fachexperte fest, was in dieser Datei steht. Geschrieben wird sie in den ersten Monaten im Gespräch mit ihm; ab Kapitel 6 übernimmt das der Autorenmodus.

## 2.2 Bausteine und ihr Vertrag

Ein Baustein ist eine einzelne Aufgabe: Fakten extrahieren, Framings erzeugen, einen Angriff fahren, eine Regel prüfen. Der Skill-Text bleibt, wie v0.4 ihn baut. Dazu kommt ein Vertrag, der festlegt, was der Baustein bekommt, was er liefern muss und wie er läuft:

> block: sb-07-attack
>
> type: critic \# extract \| generate \| critic \| validate \| ...
>
> input: framings\[\]
>
> output_schema: attack.schema.json
>
> bias: ffg_gutachter \# austauschbar über das Bias-Profil
>
> model_hint: frontier \# der Adapter wählt das konkrete Modell
>
> isolation: fresh_context \# der Kritiker sieht den Generator nicht
>
> tests: tests/attack/

Alles, was Speedboat tut, wird aus acht Bausteintypen zusammengesetzt. Braucht ein neues Pack einen neunten Typ, ist das eine bewusste Architekturentscheidung, kein Workaround.

| **Typ**     | **Aufgabe**                                                | **Wer arbeitet** |
|-------------|------------------------------------------------------------|------------------|
| Extraktion  | Fakten aus Unterlagen ziehen, mit Provenienz               | Modell           |
| Generator   | Vorschläge erzeugen, etwa Framings oder Objectives         | Modell           |
| Kritiker    | Vorschläge aus der Perspektive des Bias-Profils angreifen  | Modell, isoliert |
| Validator   | Harte Regeln prüfen, ohne zu urteilen                      | Skript           |
| Kundenfrage | Gezielte Klärungsfragen stellen und Antworten zurückführen | Kunde            |
| Human Gate  | Entscheidung am Quality Gate                               | Reviewer         |
| Freeze      | Freigegebenen Stand versiegeln                             | Skript           |
| Aktion      | Mail, Erinnerung, Register nach außen                      | n8n über Adapter |

## 2.3 Die Fallakte

Der Zustand ist die Fallakte: in welcher Station ein Fall steht, welche Fakten es gibt und woher jeder kommt, welche Red Flags offen sind, welches Framing gewählt wurde und welche Beweisschulden bestehen. Die Fallakte ist das Gedächtnis des Systems, denn ein Modell hat keines. Jeder Aufruf beginnt bei null; was der Kritiker am Dienstag über die Extraktion vom Montag weiß, steht in der Akte oder nirgends.

- **Pausieren:** Ein Fall kann wochenlang auf Kundenantworten warten und läuft danach genau dort weiter.

- **Zusammenarbeiten:** Mehrere Personen sehen dieselbe Akte statt jeweils einer eigenen Chat-Sitzung.

- **Nachweisen:** Was wann warum entschieden wurde, ist rekonstruierbar.

Der Unterschied zu den Dokumenten: Dokumente sind die Originale, also PDFs und Präsentationen. Die Fallakte ist das, was daraus strukturiert und geprüft wurde. Der Adapter „Zustand“ legt nur fest, wo die Akte liegt, heute in einer Datei, später in einer Datenbank.

# 3. Der Kern: was das Programm tut

Der Kern ist ein kleines Programm von wenigen hundert Zeilen. Er ist der Dirigent: Er kennt die Partitur (die process.yaml), ruft die Musiker auf (die Bausteine) und achtet darauf, dass niemand vorspielt, bevor er dran ist. Was inhaltlich gespielt wird, weiß er nicht.

*Abbildung 3 — Fünf Takte im Kern; jeder Takt spricht nur über eine Schnittstelle nach außen.*

## 3.1 Fünf Takte

| **Takt**             | **Skript**  | **Was passiert**                                                                                                                                         |
|----------------------|-------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 Schritt erlaubt?   | transition  | Liest die process.yaml und prüft, ob der Baustein im aktuellen Zustand zulässig ist. Einziger Schreiber des Zustands; jeder Übergang wird protokolliert. |
| 2 Baustein ausführen | Kern        | Lädt Skill und Vertrag, gibt dem Modell über den Adapter nur die benötigten Eingaben, bei Kritikern in frischem Kontext.                                 |
| 3 Patch eintragen    | apply_patch | Prüft das Ergebnis gegen das Schema und die Revision, verweigert Änderungen an eingefrorenen Objekten, erhöht die Revision.                              |
| 4 Gate prüfen        | gate_check  | Vergleicht die Pflichtschritte des Gates mit dem Protokoll. Fehlt einer, öffnet das Cockpit nicht.                                                       |
| 5 Versiegeln, melden | freeze      | Versiegelt den freigegebenen Stand mit SHA-256 und Version v+1, informiert Team und Kunde über den Kommunikations-Adapter.                               |

> required = pack\["gates"\]\["QG2"\]\["requires"\]
>
> done = {e\["step"\] for e in case\["run_log"\]}
>
> missing = \[s for s in required if s not in done\]
>
> if missing:
>
> raise GateBlocked(f"QG2 blockiert. Fehlt: {missing}")

Dieses Beispiel zeigt den Kern von gate_check: fünf Zeilen, kein Modell, gleiche Eingabe gleiche Ausgabe. Damit ist nachweisbar, dass ein Evaluator-Angriff stattgefunden hat, statt darauf zu vertrauen.

## 3.2 Warum der Kern domänenfrei ist

Die vier Aufgaben des Kerns sind in jedem Human-in-the-Loop-Prozess identisch: Schritte, die gelaufen sein müssen; Zustände mit erlaubten Übergängen; Änderungen, die kontrolliert eingetragen werden; Stände, die festgeschrieben werden. Fachlich unterschiedlich ist nur, welche Schritte, Zustände und Regeln gelten, und genau das steht im Pack. Der Kern ist wie ein Taschenrechner: Er weiß nicht, ob er Mieten oder Kalorien addiert.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong><span class="smallcaps">Die Eigenschaft ist eine Disziplin</span></strong></p>
<p>Der Kern ist domänenfrei, solange niemand eine FFG-Sonderregel „schnell“ ins Skript schreibt. Die laufende Kontrolle ist ein einfacher Test: Eine Suche im Kern-Code nach Begriffen wie „QG2“ oder „RF05“ darf nichts finden. Der eigentliche Beweis ist Etappe 3: Ein zweites Pack läuft, ohne dass eine Zeile im Kern geändert wird.</p></td>
</tr>
</tbody>
</table>

## 3.3 Die vier Adapter

Ein Adapter ist eine Handvoll Funktionen mit festem Namen, hinter denen etwas Austauschbares steckt. Der Kern ruft immer dieselben Befehle auf und merkt einen Anbieterwechsel nicht.

| **Adapter**   | **Befehle**            | **Heute**             | **Ziel**                                       |
|---------------|------------------------|-----------------------|------------------------------------------------|
| Zustand       | load · save            | project.json in Drive | Postgres auf EU-Plattform                      |
| Modell        | complete(prompt, hint) | Claude                | Router über mehrere Modelle, u. a. EU-gehostet |
| Dokumente     | get · put              | Google Drive          | Object Storage auf EU-Plattform                |
| Kommunikation | send · on_reply        | n8n mit Gmail         | n8n selbst gehostet                            |

Beim Modell-Adapter entscheidet der model_hint des Bausteins, welches Modell läuft. Die historischen Regressionsfälle dienen dabei als Benchmark: Derselbe Fall läuft gegen zwei Modelle, verglichen werden falsch-positive und falsch-negative Red Flags, erfundene Fakten und unnötige Kundenfragen.

# 4. Zugang über MCP: Claude als Oberfläche

Der Kern bietet seine Funktionen über eine API an. Davor steckt ein MCP-Server, der die API in Werkzeuge übersetzt, die Claude und andere KI-Oberflächen aufrufen können. Wer kein MCP spricht, etwa ein Kundenportal oder n8n, ruft dieselbe API direkt auf. Ein Kern, mehrere Zugänge.

*Abbildung 4 — Zwei Eingänge in denselben Kern; beide prüfen Rolle und Zustand.*

## 4.1 Die Werkzeuge

> \# Fallwerkzeuge
>
> get_case(case_id) → aktuelle Fallakte
>
> next_allowed_steps(case_id) → was laut process.yaml gerade erlaubt ist
>
> run_block(case_id, block) → Baustein ausführen, Patch prüfen, speichern
>
> \# Gate-Werkzeuge (nur Reviewer)
>
> request_gate(case_id, gate) → gate_check laufen lassen, Cockpit öffnen
>
> decide_gate(case_id, gate, …) → Entscheidung eintragen und versiegeln
>
> \# Autorenmodus (nur Autor) und Lernschleife: siehe Kapitel 6 und 7

## 4.2 Was das für den Claude-Ansatz bedeutet

- **Die Claude-Oberfläche bleibt.** Kein eigenes UI für das Team, schneller Start, die Skills aus v0.4 laufen weiter.

- **Die Regeln liegen im Server.** Claude kann kein Gate überspringen, weil der Server den Aufruf verweigert. Das ersetzt die Prompt-Anweisungen, die v0.4 für Pflichtschritte nutzt.

- **Die Oberfläche ist austauschbar.** MCP ist ein offener Standard. Heute Claude, morgen eine andere KI-Oberfläche oder ein eigenes Portal, jeweils gegen denselben Kern.

## 4.3 Die KI als Begleiterin

Weil Claude über get_case und next_allowed_steps jederzeit weiß, wo ein Fall steht, kann es durch den Prozess führen: erklären, vorbereiten, vergleichen. Für den Kunden gilt dasselbe Prinzip mit weniger Rechten; seine Begleit-KI stellt Fragen und nimmt Antworten entgegen, sieht aber nie die interne Bewertung.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong><span class="smallcaps">Beispiel und Regel</span></strong></p>
<p>„Kunde A steht vor QG2. Der Angriff ist gelaufen, drei Beweisschulden sind offen, die härteste betrifft die Neuheit. Soll ich die zwei Framings nebeneinanderlegen?“</p>
<p>Die Begleiterin darf nur Werkzeuge aufrufen, die der Kern im aktuellen Zustand und für die aktuelle Rolle erlaubt. Sie darf erklären, vorschlagen und vorbereiten, aber nie selbst entscheiden oder ein Gate öffnen. Das bleibt beim Menschen, erzwungen durch den Server, nicht durch ihr Wohlverhalten.</p></td>
</tr>
</tbody>
</table>

## 4.4 Grenzen

- **Kunden gehören nicht in unseren Claude-Arbeitsbereich.** Datentrennung zwischen Kunden und Rechte lassen sich dort nicht sauber abbilden. Für Kunden braucht es ab echten Kundenfällen ein schlankes Portal, das dieselbe API anspricht.

- **Die Team-Oberfläche hängt an Claude-Lizenzen und -Funktionen.** Für den internen Gebrauch ist das vertretbar; für ein Produkt an Dritte ist es eine Abhängigkeit, die der offene Stecker begrenzt.

# 5. Rollen und Oberflächen

Drei Rollen arbeiten mit demselben Kern. Der Server entscheidet anhand der Rolle, welche Werkzeuge jemand überhaupt sieht.

| **Rolle**           | **Zugang**               | **Sieht**                                | **Darf nicht**                                |
|---------------------|--------------------------|------------------------------------------|-----------------------------------------------|
| Autor (Fachexperte) | Claude über MCP          | Autorenmodus und Fallwerkzeuge           | Packs ohne Probelauf veröffentlichen          |
| Reviewer            | Claude über MCP, Cockpit | Fallwerkzeuge und Gate-Entscheidungen    | Packs ändern                                  |
| Kunde               | Portal über API          | Seine offenen Fragen und den Fortschritt | Interne Bewertungen sehen oder Gates auslösen |

## 5.1 Drei Oberflächen, eine Datenbasis

| **Oberfläche** | **Nutzung**                                                                       | **Priorität**                                                                 |
|----------------|-----------------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| Gate-Cockpit   | Reviewer, mehrmals pro Fall, 15–30 Minuten je Gate; zeigt nur Entscheidungsreifes | Sofort, als Claude-Artifact über MCP                                          |
| Kundenportal   | Kunde, laufend; Fragen beantworten, Unterlagen hochladen, Fortschritt sehen       | Ab echten Kundenfällen; adressiert den teuersten Schmerz, den unklaren Kunden |
| Pack-Builder   | Fachexperte, wenige Male im Jahr                                                  | Zuletzt; erst wenn Dritte ohne uns Packs bauen                                |

Das entspricht der ursprünglichen Skizze: Die Begleit-KI ist für den Kunden sichtbar, die interne Bewertung arbeitet unsichtbar hinter dem Quality Gate.

# 6. Wie Expertise ins System kommt

Der Fachexperte braucht anfangs keine eigene Plattform. Das Human-in-the-Loop-Prinzip wird auf das Bauen der Packs selbst angewendet: Die KI schlägt vor, der Kern prüft, der Experte entscheidet.

## 6.1 Im Gespräch: der Autorenmodus

> draft_pack(beschreibung) → Entwurf von process.yaml und Bausteinen
>
> validate_pack(pack) → mechanisch: alles verknüpft, nichts unerreichbar
>
> test_pack(pack, fall) → Probelauf auf einem historischen Fall
>
> publish_pack(pack) → neue Version freigeben

1.  Der Experte erzählt in Claude, wie er einen Prozess im Kopf strukturiert, etwa einen aws-Preseed-Antrag.

2.  Die KI erzeugt daraus einen Entwurf der Rezeptdatei und der Bausteine.

3.  validate_pack prüft mechanisch, ob jeder genannte Baustein existiert, jeder Zielzustand definiert ist und jedes Gate mindestens eine Entscheidung hat.

4.  test_pack lässt den Entwurf gegen einen historischen Fall laufen; der Experte sieht, was herauskommt, und korrigiert.

5.  Erst mit seiner Freigabe entsteht über publish_pack eine neue Version.

Der Experte schreibt dabei keine Zeile YAML, und trotzdem entscheidet am Ende er, nicht die KI.

## 6.2 Nebenbei: Korrekturen am Gate

Die größte Quelle für Expertise ist die tägliche Arbeit. Jede Korrektur im Cockpit wird mit Vorschlag, Entscheidung, Begründung und Person gespeichert. Das Werkzeug propose_rules fasst wiederkehrende Korrekturen zusammen und schlägt daraus Regeln vor. Der Experte nimmt an oder lehnt ab. Das Cockpit ist damit gleichzeitig Arbeitswerkzeug und Wissenssammler.

## 6.3 Später: der Builder im Browser

Eine eigene Oberfläche zum Zusammenklicken von Packs lohnt sich erst, wenn externe Fachexperten ohne unsere Begleitung Packs bauen sollen. Sie spricht dieselbe API an wie alles andere. Ein sinnvoller Zwischenschritt ist eine schreibgeschützte Ansicht, die ein Pack als Ablauf mit Gates anzeigt; sie hilft sofort im Gespräch mit Kunden und Partnern.

## 6.4 Wo die Expertise liegt

Die Packs liegen in einem Git-Repository, nicht in einer Datenbank und nicht in Claude. Jede Version ist nachvollziehbar, einschließlich wer was wann geändert hat; ein Fehler lässt sich zurückrollen; und die Expertise gehört Speedboat, unabhängig von jedem KI-Anbieter. publish_pack erzeugt technisch eine neue Version im Repository.

# 7. Wie das System besser wird

Das Modell wird nicht klüger; es lernt nichts aus unseren Fällen. Besser wird das Pack, also Bausteine und Regeln, durch eine einfache, disziplinierte Schleife.

1.  Bei Fall 3 schlägt der Generator ein KPI ohne Ausgangswert vor. Der Reviewer korrigiert am Gate und begründet: „KPI ohne Baseline“.

2.  Bei Fall 5 und 8 passiert dasselbe. Weil jede Korrektur strukturiert gespeichert ist, wird das Muster sichtbar.

3.  propose_rules schlägt vor, daraus eine Validator-Regel zu machen; der Experte stimmt zu.

4.  Die Regressionsfälle laufen durch, damit die neue Regel nichts anderes bricht.

5.  Ab Fall 9 erreicht dieser Fehler das Gate nicht mehr.

Dasselbe gilt für Ablehnungen durch den Fördergeber: Zeigt eine Begründung, dass ein Framing bei Gutachtern nicht trägt, wird es ein Eintrag auf der Verbotsliste des Kritikers.

| **Kennzahl**               | **Quelle**                                                              | **Woran man Verbesserung erkennt**                                          |
|----------------------------|-------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| Korrekturquote je Baustein | Korrektur-Log                                                           | Sinkt pro Pack-Version                                                      |
| Minuten je Gate            | Zeitstempel von request_gate und decide_gate                            | Sinkt, weil weniger zu korrigieren ist                                      |
| Rücksprünge je Fall        | Übergangsprotokoll von transition                                       | Sinken                                                                      |
| Stunden pro Fall           | Übergangsprotokoll plus Zeiterfassung, Baseline aus historischen Fällen | Sinken gegenüber der Baseline; das ist die Kennzahl für unseren Stundensatz |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong><span class="smallcaps">Warum die Architektur dafür nötig ist</span></strong></p>
<p>Heute passiert eine Korrektur in einem Chat und ist danach weg; nächste Woche macht jemand denselben Fehler. Ohne gespeicherte Korrekturen gibt es kein Muster, und ohne Muster keine Verbesserung. Fallakte, Korrektur-Log und Kern machen die Schleife erst möglich.</p></td>
</tr>
</tbody>
</table>

# 8. Wettbewerbsvorteil, ehrlich eingeordnet

Die Architektur selbst ist kein Wettbewerbsvorteil, sondern die Voraussetzung für einen. Kern, Adapter und Builder lassen sich von einem guten Team in einigen Monaten nachbauen; Werkzeuge wie Camunda, n8n oder LangGraph liefern Einzelteile bereits. Was diese Werkzeuge nicht als Paket liefern, ist die Kombination aus Gates mit Provenienz und Freeze, konfigurierbaren Domänen-Packs mit Bias und einer Lernschleife aus Gate-Korrekturen. Daraus entstehen vier Vorteile:

| **Vorteil**            | **Wie er entsteht**                                        | **Warum er schwer kopierbar ist**                                                               |
|------------------------|------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| Angesammelte Urteile   | Jede Gate-Entscheidung wird mit Begründung gespeichert     | Nach 50 Fällen wissen wir, welche Framings Gutachter durchlassen; diese Daten hat niemand sonst |
| Expertise als Vermögen | Wissen aus Köpfen wird zu versionierten Packs              | Lizenzierbar, bewertbar, unabhängig von einzelnen Personen                                      |
| Neue Domänen in Wochen | Ein Pack ist Fachwissen plus Konfiguration, keine Software | Kostenvorteil gegenüber Beratern, die jede Domäne neu aufbauen                                  |
| Prüfbares Vertrauen    | EU-Datenhaltung, Provenienz je Fakt, versiegelte Stände    | Verkaufsargument in regulierten Umfeldern wie Förderung, Einkauf, Prüfung                       |

Kein Vorteil sind die Oberfläche, der Kern-Code und die bloße Nutzung von KI. Die Positionierung nach außen lautet daher: **Wir verkaufen nicht Software, sondern kodierte Expertise, die mit jedem Fall besser wird. Die Architektur ist das, was das möglich macht.**

Das steht nicht im Widerspruch zum Verkauf von Skills. Wer Skills verkauft, braucht Versionierung, Tests und eine definierte Reihenfolge; genau das liefern Bauteil-Vertrag, Kern und Pack. Ohne sie ist ein Skill-Paket eine Prompt-Sammlung ohne Gewährleistung.

# 9. Bauplan und Etappen

| **Etappe**                      | **Inhalt**                                                                                     | **Fertig, wenn**                                                                 |
|---------------------------------|------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| 1 MVP als Pack                  | v0.4 mit process.yaml, Bauteil-Verträgen und den Kern-Skripten; FFG als erstes Pack            | Akzeptanzkriterien auf den historischen Fällen erfüllt, Aufwandsbaseline erhoben |
| 2 Kern-API mit MCP              | Kern als eigenständiger Dienst mit Fall- und Gate-Werkzeugen; Claude spricht über MCP          | Dasselbe FFG-Pack läuft ohne Änderung an den Skills über den Server              |
| 3 Lernschleife und zweites Pack | Korrektur-Log, propose_rules, Autorenmodus; zweites Pack, etwa aws Preseed oder Bid Management | Zweites Pack läuft ohne Änderung am Kern                                         |
| 4 Kundenportal                  | Schlankes Portal über die API, Begleit-KI mit eingeschränkten Rechten                          | Erster echter Kundenfall nach Datenschutzfreigabe                                |
| 5 Builder und EU-Plattform      | Builder im Browser; Adapter auf EU-Hosting umgestellt                                          | Ein Fachexperte baut ein Pack ohne uns                                           |

Der Mehraufwand in Etappe 1 liegt in der Größenordnung von drei bis fünf Personentagen und steckt in den Kern-Skripten, der process.yaml und den Bauteil-Verträgen. Die späteren Etappen werden nach Etappe 1 auf Basis gemessener Werte geschätzt, nicht vorher.

## 9.1 Zwei Tests in vier Wochen

Die offene Grundsatzfrage, wie viel Plattform Speedboat braucht, wird nicht durch weitere Dokumente geklärt, sondern durch zwei billige Tests, die parallel laufen und sich nicht ausschließen:

- **Markttest:** Findet sich in vier Wochen ein zahlender Abnehmer oder eine unterschriebene Absichtserklärung für ein Skill-Paket?

- **Modularitätstest:** Skizziert der Fachexperte in einer Stunde einen zweiten Prozess als Pack-Datei, nur mit Stationen, Gates und Bias, und reichen dafür die acht Bausteintypen?

Beide Ergebnisse sind wertvoll, auch die negativen. Gelingt der Modularitätstest nicht, haben wir für eine Stunde Aufwand gelernt, dass das Bausteinmodell noch nicht trägt.

# 10. Offene Entscheidungen

| **Frage**         | **Optionen**                                                          | **Empfehlung**                                                                 | **Entscheidet**                |
|-------------------|-----------------------------------------------------------------------|--------------------------------------------------------------------------------|--------------------------------|
| Unternehmensbild  | Beratung mit Werkzeug · Produktfirma mit Packs                        | Nach den zwei Tests aus 9.1 ausdrücklich festhalten                            | Alle drei                      |
| Runtime des Kerns | Selbst bauen · auf LangGraph oder Camunda aufsetzen                   | Vor Etappe 2 prüfen; USP liegt darüber, eine fremde Runtime kann Monate sparen | Technik mit Team               |
| Zielplattform     | Stackit · andere EU-Anbieter · EU-Region eines großen Cloud-Anbieters | Gegen die Anforderungen aus 1.2 entscheiden, nicht vorab                       | Technik mit Team               |
| Eigentum am Kern  | Gesellschaft · Lizenz an die Gesellschaft                             | Vor Beginn von Etappe 2 klären                                                 | Alle drei                      |
| Datenschutz       | Verarbeitung historischer und echter Kundendaten                      | Go-live-Kriterium; Kundenvereinbarungen prüfen                                 | Alle drei, rechtlich begleitet |
| n8n-Lizenz        | Interne Nutzung · Nutzung im Kundenprodukt                            | Vor Etappe 4 prüfen, ob eine kommerzielle Lizenz nötig ist                     | Technik                        |

# Anhang A: Glossar

| **Begriff**     | **Bedeutung**                                                                                                         |
|-----------------|-----------------------------------------------------------------------------------------------------------------------|
| Pack            | Vollständige Konfiguration einer Domäne: process.yaml, Bausteine, Bias-Profil. Zweites Pack ist zweite Datei.         |
| process.yaml    | Rezeptdatei eines Prozesses: Zustände, Gates, Pflichtbausteine, erlaubte Entscheidungen, Rücksprünge.                 |
| Baustein        | Einzelne Aufgabe als Skill-Text plus Vertrag; einer von acht Typen.                                                   |
| Bauteil-Vertrag | Festlegung von Typ, Eingabe, Ausgabeschema, Bias, model_hint, Isolation und Tests eines Bausteins.                    |
| Bias-Profil     | Perspektive, Schwellen und aktive Regeln des Kritikers; bei der FFG der Gutachter, im Einkauf der unterlegene Bieter. |
| Kern            | Domänenfreies Programm mit transition, gate_check, apply_patch und freeze; setzt die Regeln durch.                    |
| Adapter         | Austauschbare Verbindung nach außen: Modell, Zustand, Dokumente, Kommunikation.                                       |
| Fallakte        | Zustand eines Falls: Station, Fakten mit Provenienz, Red Flags, Entscheidungen, Beweisschulden.                       |
| Patch           | Änderungsvorschlag eines Bausteins, den der Kern prüft und einträgt; Bausteine schreiben nie direkt.                  |
| Freeze          | Versiegelung eines freigegebenen Stands mit Prüfsumme und neuer Version; append-only.                                 |
| MCP             | Model Context Protocol; offener Standard, über den KI-Oberflächen Werkzeuge eines Servers aufrufen.                   |
| Korrektur-Log   | Gespeicherte Gate-Korrekturen mit Vorschlag, Entscheidung, Begründung und Person; Rohstoff der Lernschleife.          |
