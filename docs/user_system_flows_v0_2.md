# User & System Flows

Reale Arbeitsabläufe, Golden Path und Exception-Szenarien als Architektur-Testkorpus

| Version    | 0.2 – konsolidierte UX-/System-Flow-Fassung mit technischem S0-Anhang                                                                                                                                        |
|------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Datum      | 30.09.2026                                                                                                                                                                                                   |
| Fokus      | FFG Basisprogramm als Referenzprozess; Architektur abstrahierbar auf weitere Expertenprozesse                                                                                                                |
| Grundlagen | Architekturvorschlag „Baukasten“ v1.0 (24.09.2026); Architektur-Besprechung vom 25.09.2026; wiederkehrende Muster aus realen Förderprojektarbeiten                                                           |
| Zweck      | Vor dem Build die reale tägliche Nutzung von Speedboat anhand konkreter User- und System-Flows validieren und den S0-Golden-Path technisch bis auf Komponenten-, State- und Write-Path-Ebene konkretisieren. |

**LEITFRAGE**

| **Kann Speedboat die tatsächliche Förderprojektarbeit – inklusive normalem Happy Path, Änderungen, Widersprüchen, Reframing und Nachreichungen – schneller, konsistenter und nachvollziehbarer abbilden als der heutige Mix aus Chat/LLM, Word, Excel, E-Mail und Drive?** |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 1. Executive Summary

Der Referenzprozess darf nicht aus theoretischen Software-Use-Cases abgeleitet werden. Er muss aus der realen Förderprojektarbeit entstehen. Der wichtigste Testfall ist deshalb ein vollständiger, realistischer „Golden Path“ – ergänzt um wiederkehrende Exception-Szenarien, die in der praktischen Projektarbeit tatsächlich auftreten.

Der Golden Path ist bewusst kein idealisierter Null-Reibungs-Fall. Auch im normalen Projekt fehlen Informationen, es gibt Rückfragen, mehrere Draft-Runden und kleinere Änderungen. Entscheidend ist, dass keine fundamentale Projektlogik kollabiert, kein Partner ausfällt und kein Förderregime gewechselt werden muss.

Die Exception-Szenarien härten anschließend die Architektur gegen die reale Projektwirklichkeit: bestehende Kundendrafts, spätere Faktenänderungen, Reframing, Partnerausfälle, geänderte Finanzierung, Förderstellenfragen, Resubmissions, widersprüchliche Datenquellen und Post-Submission-Nachweise. Anhang A übersetzt den Golden Path zusätzlich in einen technischen Referenzfluss mit Komponentenrollen, Patch/apply_patch, Impact-Logik und Dokument-Synchronisation.

## 1.1 UX-Prinzipien, die aus der realen Arbeitsweise folgen

| **Prinzip**                                 | **Konsequenz**                                                                                                                                                            |
|---------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **User arbeitet in fachlicher Sprache**     | Der User spricht mit Claude/Speedboat über Projekt, Markt, KPIs, Partner, Budget und Text – nicht über YAML, JSON, Patches oder Freeze-Kommandos.                         |
| **Nichtlinear statt Wizard-Zwang**          | Kapitel und Arbeitsschritte dürfen parallel und in wechselnder Reihenfolge bearbeitet werden. Gates blockieren nur dort, wo Abhängigkeiten wirklich relevant sind.        |
| **Nur Residual Gaps fragen**                | Vorhandene Unterlagen zuerst auswerten. Rückfragen nur zu fehlenden, widersprüchlichen oder entscheidungsrelevanten Informationen.                                        |
| **State ≠ Dokument**                        | Die Fallakte hält strukturierte Fakten, Provenienz, Entscheidungen und offene Punkte. Word-/Excel-Dokumente sind Arbeits- und Output-Artefakte.                           |
| **Änderung → Impact → Validierung**         | Neue Fakten werden nicht nur lokal geändert. Speedboat muss downstream betroffene Kapitel, KPIs, APs, Budgetlogik und bereits freigegebene Entscheidungen identifizieren. |
| **Human Gate nur für echte Entscheidungen** | Das System bereitet vor und prüft. Strategische Freigaben bleiben beim Menschen; Routinechecks sollen nicht unnötig Interaktion erzeugen.                                 |

# 2. Szenario-Portfolio

Der Testkorpus besteht aus einem Golden Path, realen Exception Paths und einer Lifecycle-Erweiterung. Die Fälle sind so gewählt, dass sie unterschiedliche Architektur-Eigenschaften prüfen – nicht bloß unterschiedliche Texte erzeugen.

| **ID** | **Szenario**                                          | **Reales Muster**                                                                 | **Primärer Architekturtest**                                 | **Prio** |
|--------|-------------------------------------------------------|-----------------------------------------------------------------------------------|--------------------------------------------------------------|----------|
| S0     | Golden Path – klassische FFG-Basisprogramm-Abwicklung | Composite Standardfall                                                            | End-to-End: Intake bis Submission                            | P0       |
| S1     | Bestehender Kundendraft statt Greenfield              | z\. B. Kunde B                                                           | Bestehende Substanz erhalten, Schwächen gezielt korrigieren  | P1       |
| S2     | Normale Informationslücke / Rückfrageschleife         | wiederkehrend                                                                     | Residual Gaps, keine Fragebogenlogik                         | P0       |
| S3     | Neuer Fakt verändert mehrere Stellen                  | z\. B. Team-/Stammdatenänderung                                                   | Change Impact über mehrere Dokumentteile                     | P0       |
| S4     | Substanzielles Reframing / Scope Change               | z\. B. F&E-Abgrenzung, Vorgängerprojekt                                           | Freeze/Change Request/Downstream Impact                      | P0       |
| S5     | Kritischer Projektpartner fällt aus                   | z\. B. Kunde C                                                           | Blockieren, Pausieren, später sauber fortsetzen              | P1       |
| S6     | Förder-/Finanzierungslogik ändert sich                | z\. B. Kunde D                                                                  | Machbarkeit statt bloßer Textanpassung                       | P1       |
| S7     | Förderstelle stellt Fragen / Hearing                  | z\. B. Kunde F                                                                      | Antworten konsistent zur Submitted Version                   | P1       |
| S8     | Ablehnung → Resubmission                              | z\. B. Kunde E                                                                    | Branching, historische Version erhalten                      | P1       |
| S9     | Widersprüchliche Datenquellen                         | verteilte Working Files, eCall/PDF-Exporte, E-Mails und nachträgliche Kundeninfos | Quellenkonflikte, Provenienz + kontextabhängige Source Rules | P0       |
| S10    | Post-Submission: Reporting / Nachweise                | z\. B. Kunde A                                                                    | Lifecycle-Kompatibilität jenseits des Schreibens             | P2       |

# 3. S0 – Golden Path: klassische FFG-Basisprogramm-Abwicklung

S0 ist der zentrale Referenzfall. Er soll beweisen, dass Speedboat im normalen Projekt nicht nur kontrollierter, sondern auch schneller und angenehmer ist als die heutige Arbeitsweise. Das Szenario ist ein realistischer Composite-Case: grundsätzlich förderfähiges F&E-Projekt, normale Informationslücken, mehrere Draft-Schleifen, aber keine fundamentale Krise.

## 3.1 Ausgangslage

- Vorhanden: Pitchdeck, Website/Produktbeschreibung, Teamdaten, grober Projektumfang und erster Budgetrahmen.

- Das Vorhaben besitzt grundsätzlich plausiblen F&E-Charakter; technische Unsicherheiten sind vorhanden, aber noch nicht sauber formuliert.

- Kunde und internes Team liefern Informationen nicht vollständig in einem Zug, sondern ergänzen gezielt auf Rückfrage.

- Die finale Einreichung soll in offiziellen FFG-Artefakten bzw. den dafür relevanten Arbeitsdokumenten landen; kein Copy-Paste aus Chat-Text als Standardprozess.

- Speedboat soll bestehende Informationen wiederverwenden, statt sie in jedem Arbeitsschritt erneut abzufragen.

## 3.2 End-to-End User & System Flow

*UX-Lesart: Der User muss interne Speedboat-Begriffe wie QG, Skill, Patch oder Freeze nicht kennen. Wo der nächste fachliche Schritt aus dem aktuellen Fallstand ableitbar ist, schlägt Speedboat ihn aktiv vor oder führt vorbereitende Checks automatisch aus. Der User liefert Fachwissen, korrigiert und entscheidet; interne Prozessmechanik bleibt im Hintergrund.*

### Phase A – Intake & Eligibility

| **\#** | **User / Trigger**                                                   | **Was der User sieht**                                                                                                     | **System / Architektur**                                                                                               | **State / Ergebnis**                 |
|--------|----------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|--------------------------------------|
| 1      | User startet neuen Fall                                              | „Neues FFG-Basisprogramm-Projekt für Firma X starten.“                                                                     | Neuen Fall anlegen, Pack laden, Case-ID vergeben, Source-/Working-Struktur vorbereiten.                                | Case State v1; Status S0             |
| 2      | User stellt vorhandene Unterlagen bereit                             | Pitchdeck, technische Unterlagen, CVs/Teamdaten, ggf. Website oder ältere Projektdokumente hochladen bzw. verlinken.       | Dokumente registrieren; unveränderte Quellen erhalten; Dokumenttyp und Version erkennen.                               | Source registry + hashes             |
| 3      | System startet Intake-Analyse automatisch bzw. nach Freigabe         | Der User muss keine Felder manuell vorbefüllen; Speedboat meldet Analysefortschritt und ggf. nicht lesbare Quellen.        | Fakten extrahieren, Fundstellen zuordnen, EXISTING / TO BE DEVELOPED / UNCLEAR vorbereiten.                            | Patch candidates: Facts + provenance |
| 4      | System präsentiert Intake-Ergebnis; User prüft Auffälligkeiten       | Speedboat meldet z. B. „73 Fakten erkannt; 5 Gaps; 2 Widersprüche.“                                                        | Schema-/Provenienzcheck; Dubletten und Konflikte markieren; noch keine strategische Interpretation als Fact speichern. | Case revision +1                     |
| 5      | User beantwortet gezielte Rückfragen                                 | Nur offene, entscheidungsrelevante Punkte werden gefragt, z. B. Baseline, internes/externes Development oder Projektstart. | Antworten als CUSTOMER_CONFIRMED dem konkreten Objekt zuordnen; Konflikte auflösen oder offen halten.                  | Patch: gap resolution                |
| 6      | System schlägt Förderfähigkeits-Review vor; User/Reviewer öffnet ihn | Speedboat zeigt nur Red Flags, offene Nachweise und entscheidungsreife Punkte – nicht die gesamte Rohakte.                 | Eligibility-Regeln, Überschneidungen, Startzeitpunkt, Team-/Finanzierungsrisiken prüfen.                               | QG1 readiness report                 |
| 7      | Reviewer trifft Förderfähigkeitsentscheidung                         | Reviewer wählt GO / CONDITIONAL GO / STOP-REROUTE und begründet Abweichungen/Overrides.                                    | Pflichtchecks verifizieren; Entscheidung protokollieren; freizugebende Fact Layer markieren.                           | Fact Layer freeze                    |

Designziel: Der User soll nicht mit einem statischen Fragebogen starten. Dokumente zuerst, Rückfragen nur zu echten Gaps.

### Phase B – Funding Thesis & Framing

| **\#** | **User / Trigger**                                                            | **Was der User sieht**                                                                                                      | **System / Architektur**                                                                                | **State / Ergebnis**          |
|--------|-------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|-------------------------------|
| 8      | System schlägt nach QG1 plausible F&E-Framings vor; User öffnet den Vergleich | 2–3 klar unterscheidbare Varianten mit Problem, Forschungsfrage, Unsicherheit, Hypothese, Scope und Evidence Debt.          | Framing-Generator erhält gefreezte Facts + relevante Quellen und erzeugt echte Alternativen.            | Framing candidates            |
| 9      | User vergleicht und kommentiert die Framings                                  | User sieht Stärken, offene Evidenz und Unterschiede – ohne künstlichen Gesamtscore.                                         | Vergleichsmatrix erzeugen; Facts und Interpretation getrennt halten.                                    | Derived comparison            |
| 10     | System führt Gegenprüfung automatisch aus                                     | Speedboat zeigt pro Framing Gegenargumente, typische Ablehnungspunkte und offene Belege; User muss keinen „Critic“ starten. | Separater Critic in isoliertem Kontext; Ablehnungsmuster simulieren; keine State-Mutation durch Kritik. | Attack records                |
| 11     | User schärft die bevorzugte Variante nach                                     | „Variante B passt, aber Scope enger und technisches Risiko klarer.“                                                         | Nur betroffene Framing-Objekte überarbeiten; verifizierte Facts unverändert lassen.                     | Patch: framing candidate B v2 |
| 12     | Reviewer trifft Framing-Entscheidung                                          | Reviewer wählt APPROVED / EVIDENCE DEBT / REFRAME / STOP.                                                                   | Hard Gates prüfen; bei Freigabe Project Constitution erstellen und versiegeln.                          | Project Constitution freeze   |

Designziel: Strategische F&E-Entscheidung bewusst machen; Facts bleiben von Interpretation getrennt.

### Phase C – Technical Blueprint

| **\#** | **User / Trigger**                                                         | **Was der User sieht**                                                                                                                                       | **System / Architektur**                                                                                                                                                                          | **State / Ergebnis**         |
|--------|----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------|
| 13     | System leitet technische Ziele ab; User prüft/ergänzt sie                  | Speedboat schlägt 3–8 technologische Fähigkeiten/Ziele vor und erklärt die Ableitung aus der Constitution.                                                   | Objectives aus Constitution ableiten; Softwaremodule nicht als Entwicklungsziele behandeln.                                                                                                       | Patch candidates: objectives |
| 14     | System schlägt KPIs vor und markiert fehlende Baselines; User prüft        | User sieht Target, vorhandene Baseline/Quelle und klar markierte Lücken.                                                                                     | Kein Target ohne Baseline oder expliziten BASELINE_TO_ESTABLISH-/TBD-Status; Provenienz je KPI.                                                                                                   | KPI inventory                |
| 15     | System stellt gezielte technische Rückfrage; User beantwortet sie          | Z. B. „Welche Erkennungsrate erreicht das heutige System im vergleichbaren Testsetting?“                                                                     | Antwort exakt dem betroffenen KPI/Baseline-Objekt zuordnen; keine globale Freitextablage.                                                                                                         | Patch: baseline              |
| 16     | System schlägt technische Risiken und Lösungsräume vor; User prüft/ergänzt | Speedboat leitet aus Objectives, Baselines, KPIs und technischen Antworten potenzielle Unsicherheiten/Risiken ab und schlägt plausible Lösungsvarianten vor. | Risk/Uncertainty Generator erzeugt PROPOSED Risk- und SolutionVariant-Objekte; technische vs. kommerzielle/organisatorische Risiken trennen; mehrere Lösungswege erzwingen, wo fachlich sinnvoll. | Risk/solution objects        |
| 17     | System schlägt Validierungsketten vor; User prüft/ergänzt                  | Je kritischem Risiko: Hypothese → Experiment → Datensatz/Szenario → Metrik → Schwelle → Interpretation.                                                      | Traceability prüfen; fehlende Verbindungen und nicht prüfbare Risiken markieren.                                                                                                                  | Experiment chains            |
| 18     | System meldet QG3-Readiness; User/Reviewer öffnet den Review               | Speedboat zeigt verbleibende technische Exceptions und offene Evidence Debt.                                                                                 | Semantischer Critic + deterministische Checks auf Baselines, Referenzen, Scope und Waisenobjekte.                                                                                                 | QG3 readiness report         |
| 19     | Reviewer entscheidet über Technical Blueprint                              | Reviewer genehmigt oder schickt einzelne Punkte gezielt zurück.                                                                                              | Bei Freigabe Blueprint freeze; offene Evidence Debt bleibt sichtbar und referenziert.                                                                                                             | Technical Blueprint freeze   |

Designziel: Kein KPI ohne Baseline; jedes technische Risiko muss in eine prüfbare Experiment-/Validierungskette führen.

### Phase D – Application Content & Economics

| **\#** | **User / Trigger**                                                                           | **Was der User sieht**                                                                                                                                      | **System / Architektur**                                                                                                        | **State / Ergebnis**             |
|--------|----------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|----------------------------------|
| 20     | User wählt Markt/Verwertung als nächsten Workstream oder fordert Marktbeschreibung an        | „Erstelle die Marktbeschreibung auf Basis des aktuellen Projektstands.“ Speedboat kann diesen Schritt vorschlagen, erzwingt aber keine lineare Reihenfolge. | Vorhandene Markt-Facts + externe Research-Quellen + Uservorgaben laden; fehlende Marktfragen identifizieren.                    | Market research patch candidates |
| 21     | User liest und prüft Marktdraft                                                              | Marktdefinition, Segmente, TAM/SAM/SOM soweit belastbar, Treiber, Quellen und offene Punkte.                                                                | Draft aus State + Quellen erzeugen; Claims mit Provenienz verknüpfen.                                                           | Working section draft v1         |
| 22     | User korrigiert in fachlicher Sprache                                                        | „Industriekunden stärker; Österreich nicht separat; TAM vorsichtiger.“                                                                                      | Änderungsvorschläge auf Case State/Working Draft abbilden; lokale Korrektur nicht automatisch als globale Lernregel übernehmen. | Patch + draft v2                 |
| 23     | User öffnet weitere Kapitel/Workstreams in sinnvoller Reihenfolge                            | Markt, SoTA, Neuheit, Verwertung etc. können parallel bearbeitet werden; Speedboat weist nur auf echte Abhängigkeiten hin.                                  | Dependency-Graph statt linearem Wizard; benötigte Inputs und Gate-Abhängigkeiten prüfen.                                        | Parallel workstreams             |
| 24     | System bereitet AP-/Ressourcen-/Budgetstruktur vor; User liefert/prüft Fach- und Kostendaten | User sieht vorgeschlagene AP-Struktur sowie offene Ressourcen-, Zeit- und Budgetfragen.                                                                     | Traceability von Objectives/Risks zu APs; Budget-/Ressourcenchecks; fehlende Daten gezielt nachfordern.                         | AP & budget objects              |

Designziel: Kapitel können parallel entstehen. Der Prozess erzwingt Abhängigkeiten und Qualitätskriterien, nicht künstliche Reihenfolgen.

### Phase E – Assembly, Review & Submission

| **\#** | **User / Trigger**                                                         | **Was der User sieht**                                                                                       | **System / Architektur**                                                                                              | **State / Ergebnis**            |
|--------|----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|---------------------------------|
| 25     | User fordert Gesamtantrag an oder System meldet Assembly-Readiness         | „Bitte Projektbeschreibung erstellen.“                                                                       | Freigegebene Objekte auf FFG-Template mappen; Working Documents aus Template erzeugen/aktualisieren.                  | Project description draft v1    |
| 26     | Kunde/User reviewt den Working Draft                                       | Kunde kommentiert Text, ergänzt Formulierungen oder korrigiert Fakten im abgestimmten Arbeitskanal.          | Änderungen erfassen und klassifizieren: redaktionell vs. materiell; materielle Änderungen für Impact Check vormerken. | Review changeset                |
| 27     | System führt Impact-/Konsistenzprüfung aus; User prüft nur Konflikte       | User sieht betroffene Stellen, widersprüchliche Angaben und Entscheidungen, die neu bestätigt werden müssen. | Cross-document consistency, Source Rules, Freeze-Impacts und offene Evidenz prüfen.                                   | Final issue list                |
| 28     | User/Reviewer löst verbleibende Punkte                                     | Nur tatsächliche Restentscheidungen und fachliche Korrekturen werden bearbeitet.                             | Akzeptierte Patches anwenden; Working Documents konsistent regenerieren.                                              | Final case revision             |
| 29     | System meldet Submission-Readiness; Reviewer führt Final QA/Freigabe durch | Vollständigkeits- und Formcheck mit wenigen verbleibenden Exceptions.                                        | Konsistenz, Zeichenlimits/Formanforderungen, Quellen-/Versionscheck; Freigabe protokollieren.                         | Submission readiness            |
| 30     | User erzeugt nach Freigabe das Submission-Paket                            | Finale Projektbeschreibung und weitere erforderliche Outputs; eCall-Übertragung kann folgen.                 | Finale Version einfrieren; Submitted-Version unveränderlich referenzieren und spätere Änderungen branchen.            | Submission freeze / branch root |

Designziel: Das Word-/Template-Artefakt ist Output/Arbeitsfläche; die strukturierte Fallakte bleibt kanonische Projektwahrheit.

## 3.3 Konkretes UX-Beispiel: Erstellung der Marktbeschreibung

| **User**      | „Bitte erstelle die Marktbeschreibung. Fokus DACH, primär Industriekunden.“                                                                                                       |
|---------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Speedboat** | „Ich habe 3 belastbare Marktquellen gefunden. Für die Marktdefinition fehlt nur noch, ob die Schweiz in Phase 1 aktiv adressiert wird. Soll ich sie als sekundären Markt führen?“ |
| **User**      | „Ja, sekundär. TAM bitte konservativer darstellen.“                                                                                                                               |
| **Speedboat** | „Marktbeschreibung v2 ist aktualisiert. Geändert: Marktgeografie, Segmentgewichtung und TAM-Formulierung. Quellen bleiben unverändert. Wettbewerbsabgrenzung ist noch offen.“     |

Im Hintergrund: Research-/Generator-Block → Patch-Vorschlag → Validierung → Case State → aktualisierter Working Draft. Der User sieht weder Patch noch JSON.

## 3.4 Acceptance Criteria für S0

| **ID**       | **Kriterium**                    | **Bestanden, wenn …**                                                                                                           |
|--------------|----------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| **AC-S0-01** | **Keine redundanten Rückfragen** | Information, die bereits in verifizierten Quellen oder im bestätigten State liegt, wird nicht erneut abgefragt.                 |
| **AC-S0-02** | **Provenienz**                   | Materielle Fakten und Markt-/Technik-Claims besitzen Quelle oder expliziten Status.                                             |
| **AC-S0-03** | **Nichtlinearität**              | Markt, SoTA, Verwertung und andere Kapitel können parallel bearbeitet werden, sofern Gate-Abhängigkeiten nicht verletzt werden. |
| **AC-S0-04** | **Kein Copy-Paste-Zwang**        | Die offiziellen/arbeitsrelevanten Dokumente werden aus dem freigegebenen State erzeugt bzw. aktualisiert.                       |
| **AC-S0-05** | **Review-Effizienz**             | QG1–QG3 zeigen primär Exceptions und entscheidungsreife Punkte, nicht die gesamte Rohakte.                                      |
| **AC-S0-06** | **Änderungsklassifikation**      | Redaktionelle Änderungen bleiben leichtgewichtig; materielle Änderungen lösen Impact Checks aus.                                |
| **AC-S0-07** | **Konsistenz**                   | Bestätigte Facts werden über Kapitel und Dokumente hinweg konsistent wiederverwendet.                                           |
| **AC-S0-08** | **Freeze/Branch**                | Submitted/Frozen Stände bleiben unverändert; spätere Änderungen erzeugen neue Revision/Branch.                                  |

# 4. Reale Exception Paths

Die folgenden Szenarien sind nicht als Randfälle zu behandeln, sondern als wiederkehrende Muster aus der realen Förderprojektarbeit. Sie testen vor allem Change Impact, Versionierung, Source of Truth und die Fähigkeit, einen Fall nach Störungen kontrolliert weiterzuführen.

### S1 – Bestehender Kundendraft

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Auslöser:</strong> Kunde liefert bereits einen umfangreichen Antrag oder eine weit fortgeschrittene Projektbeschreibung.</p>
<p><strong>Erwartetes Verhalten:</strong> Struktur/Facts/KPIs/Risiken extrahieren; bestehende Substanz erhalten; problematische Stellen markieren; nur gezielt neu schreiben.</p>
<p><strong>Bestanden, wenn:</strong> Speedboat nicht reflexartig alles neu generiert und Änderungen nachvollziehbar auf den Existing Draft zurückgeführt werden können.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### S2 – Normale Informationslücke

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Auslöser:</strong> Baseline, technischer Parameter, Partnerrolle oder Finanzierungsdetail fehlt.</p>
<p><strong>Erwartetes Verhalten:</strong> genau die fehlende Information fragen; Antwort an das konkrete Objekt binden; Folgefragen nur bei echtem Bedarf.</p>
<p><strong>Bestanden, wenn:</strong> kein statischer Großfragebogen und keine wiederholte Abfrage bereits vorhandener Information entsteht.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### S3 – Ein neuer Fakt betrifft mehrere Stellen

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Auslöser:</strong> Team, Projektstart, Zielmarkt, Partner, Technologieparameter o. Ä. ändert sich.</p>
<p><strong>Erwartetes Verhalten:</strong> Fact-Änderung aufnehmen → Impact Graph → betroffene Kapitel/Objekte/Dokumente anzeigen → konsistent aktualisieren.</p>
<p><strong>Bestanden, wenn:</strong> keine stillen Inkonsistenzen zwischen Kapiteln zurückbleiben.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### S4 – Reframing / Scope Change

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Auslöser:</strong> neue technische Erkenntnis macht das freigegebene Framing oder den Scope unplausibel.</p>
<p><strong>Erwartetes Verhalten:</strong> Change Request; Impact auf Constitution, Objectives, KPIs, Risks, Experimente, APs und Budget; bewusster Rücksprung.</p>
<p><strong>Bestanden, wenn:</strong> eingefrorene Grundlagen nicht still überschrieben werden.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### S5 – Kritischer Partner fällt aus

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Auslöser:</strong> Umsetzungspartner oder Pilotpartner steht nicht mehr zur Verfügung.</p>
<p><strong>Erwartetes Verhalten:</strong> betroffene APs/Ressourcen/Budget/Förderfähigkeit identifizieren; Case ggf. BLOCKED setzen; später mit Ersatzpartner fortsetzen.</p>
<p><strong>Bestanden, wenn:</strong> System nicht einfach mit veralteter Partnerannahme weiterarbeitet.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### S6 – Förder-/Finanzierungslogik ändert sich

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Auslöser:</strong> Förderquote, Instrument, Eigenmittelanforderung oder Finanzierungsvoraussetzung ändert sich.</p>
<p><strong>Erwartetes Verhalten:</strong> Machbarkeits-/Financing-Impact berechnen; Scope-/Ressourcen-/Budgetoptionen aufzeigen.</p>
<p><strong>Bestanden, wenn:</strong> Änderung nicht als bloße Textkorrektur behandelt wird.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### S7 – Förderstelle stellt Fragen / Hearing

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Auslöser:</strong> Nach Submission kommen technische oder wirtschaftliche Rückfragen.</p>
<p><strong>Erwartetes Verhalten:</strong> Fragen auf Frozen Submitted State mappen; Antwortentwurf mit Quellen/Claims; Widersprüche zur Einreichung markieren.</p>
<p><strong>Bestanden, wenn:</strong> Antworten konsistent zur tatsächlich eingereichten Version bleiben.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### S8 – Ablehnung → Resubmission

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Auslöser:</strong> Förderentscheidung negativ; Wiedereinreichung mit geändertem Scope/Budget/Framing.</p>
<p><strong>Erwartetes Verhalten:</strong> Submitted v1 unverändert erhalten; Feedback strukturieren; Resubmission-Branch erzeugen; gezielt Änderungen ableiten.</p>
<p><strong>Bestanden, wenn:</strong> Historie und Lernpunkte nachvollziehbar bleiben.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### S9 – Widersprüchliche Datenquellen

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>Auslöser: Informationen zum selben Projekt liegen in mehreren, nicht zwingend synchronen Quellen – z. B. Working Files auf lokalen/Cloud-Laufwerken, unterschiedliche Dokumentversionen, eCall, PDF-Exporte, E-Mails oder nachträglich bestätigte Kundeninformationen – und enthalten unterschiedliche bzw. unterschiedlich aktuelle Werte/Aussagen.<br />
<br />
Erwartetes Verhalten: Speedboat registriert Quelle, Version/Zeitpunkt und Provenienz; unterscheidet zwischen „was wurde eingereicht?“ und „was gilt aktuell im Working State?“; wendet kontextabhängige Source Rules an und fragt den User, wenn Aktualität oder Verbindlichkeit nicht eindeutig ableitbar ist. Konflikte bleiben nachvollziehbar erhalten.<br />
<br />
Beispiel: Working File und PDF-Export enthalten 18 Monate Projektlaufzeit; eine neuere Kunden-E-Mail bestätigt 24 Monate. Für die historische Submitted-Version bleiben 18 Monate maßgeblich; für den aktuellen Working State kann 24 Monate als CUSTOMER_CONFIRMED übernommen werden – mit anschließendem Impact Check auf APs, Budget und betroffene Kapitel.<br />
<br />
Bestanden, wenn: keine zufällige oder „mehrheitliche“ Wahrheit entsteht und der User nachvollziehen kann, welcher Wert in welchem Kontext warum kanonisch ist.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### S10 – Post-Submission Reporting / Nachweise

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Auslöser:</strong> Personalkosten, Timesheets, Sachkosten oder Belege müssen nachgewiesen werden.</p>
<p><strong>Erwartetes Verhalten:</strong> Approved State mit Ist-Daten vergleichen; Abweichungen/Feiertage/Stundensätze/Beleglogik prüfen.</p>
<p><strong>Bestanden, wenn:</strong> derselbe Case State jenseits des Grant Writings weiterverwendbar ist.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 5. Architektur-Anforderungen, die aus den Szenarien folgen

| **ID** | **Anforderung**                            | **Getestet durch** | **Konsequenz**                                                                                                                                               |
|--------|--------------------------------------------|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| AR-01  | Dependency-Graph statt starrem Wizard      | S0, S2–S4          | Schritte/Kapitel parallel möglich; Gates prüfen echte Vorbedingungen.                                                                                        |
| AR-02  | Patch-basierter State Write                | S0–S9              | Blocks schreiben nicht direkt; akzeptierte Änderungen sind versioniert und prüfbar.                                                                          |
| AR-03  | Change Impact Graph                        | S3, S4, S6         | Änderung eines Facts identifiziert downstream betroffene Objekte und Working Documents.                                                                      |
| AR-04  | Kontextabhängige Source Rules & Provenienz | S0, S1, S7, S9     | Kanonischer Wert je Kontext mit Quelle/Fundstelle/Status; Submitted State und aktueller Working State werden getrennt behandelt; Konflikte bleiben sichtbar. |
| AR-05  | State getrennt von Working Documents       | S0–S4              | JSON/DB hält strukturierte Wahrheit; DOCX/XLSX sind Arbeits- und Output-Artefakte.                                                                           |
| AR-06  | Working-Document Revision Tracking         | S0, S3, S8         | Externe Änderungen dürfen keine neueren Stände überschreiben.                                                                                                |
| AR-07  | Freeze + Change Request + Branching        | S4, S7, S8         | Freigegebene/Submitted Stände unverändert; Änderungen erzeugen kontrollierte neue Revisionen.                                                                |
| AR-08  | Human Gate + Exception Cockpit             | S0, S4, S6, S7     | Mensch entscheidet strategische Punkte; UI zeigt primär entscheidungsreife Exceptions.                                                                       |
| AR-09  | Retry ohne Prozessverlust                  | S0, S1, S2         | Draft kann iterativ verbessert werden, ohne dass der Case State oder Kontext verloren geht.                                                                  |
| AR-10  | Lifecycle State                            | S7, S8, S10        | Submission ist nicht Ende des Cases; Rückfragen, Resubmission und Reporting bleiben am selben Fall anschlussfähig.                                           |

# 6. Empfohlene Test- und Build-Reihenfolge

Nicht alle Szenarien sollten gleichzeitig implementiert werden. Die Architektur sollte schrittweise gegen die risikoreichsten Eigenschaften getestet werden.

| **Stufe** | **Szenario**                    | **Warum jetzt?**                                                                |
|-----------|---------------------------------|---------------------------------------------------------------------------------|
| **1**     | **S0 Golden Path**              | Beweist End-to-End-Nutzbarkeit und Grundnutzen.                                 |
| **2**     | **S3 Change Impact**            | Beweist, dass Speedboat mehr kann als lineares Grant Writing.                   |
| **3**     | **S4 Reframing / Scope Change** | Beweist Freeze, Rücksprung und kontrollierte Änderung strategischer Grundlagen. |
| **4**     | **S9 Source Conflict**          | Beweist Provenienz und belastbare Source-of-Truth-Logik.                        |
| **5**     | **S1/S2/S5–S8**                 | Härtet den Kern gegen reale Projektvarianten.                                   |
| **6**     | **S10**                         | Prüft Architekturkompatibilität mit Funding Management nach der Einreichung.    |

# 7. Offene Designentscheidungen vor Implementierung

**Working-Document Loop:** Wie genau werden Word-/Excel-Artefakte gelesen, abschnittsweise aktualisiert, versioniert und gegen externe Useränderungen geschützt?

**Workflow Runtime:** Welche bestehende Engine übernimmt Retries, Queues, Trigger und Exceptions? Speedboat sollte keine eigene Workflow Engine neu erfinden.

**Semantisch vs. deterministisch:** Welche Checks sind mechanisch prüfbar und gehören in Code; welche benötigen LLM-Critic; welche bleiben Human Decision?

**Material Change Threshold:** Wann ist eine Useränderung nur redaktionell und wann muss sie einen Impact Check / Change Request auslösen?

**External Edit Policy:** Was passiert, wenn Kunde/Team außerhalb von Speedboat ein Working Document verändert? Import, Diff, Konflikt oder bewusst nicht unterstützt?

**Submission Boundary:** Welche Objekte/Dokumente werden bei Submission gefreezed und wie wird ein Resubmission-Branch angelegt?

# 8. Entscheidungsregel für den Architektur-Prototyp

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>GO zum Build, wenn S0 als vollständiger User/System-Flow verständlich ist und die Architektur S3, S4 und S9 ohne Sonderlogik im Core abbilden kann.</strong></p>
<p><strong>STOP/REWORK, wenn ein zweites reales Szenario nur durch FFG-spezifische Sonderregeln im Core, direkte Dokumentüberschreibung oder manuelle Kontextrekonstruktion lösbar ist.</strong></p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# Anhang A – S0 Technical System Flow

Dieser Anhang übersetzt den S0-Golden-Path in einen technischen Referenzfluss. Er legt Verantwortlichkeiten und Datenbewegungen fest, ohne eine konkrete Workflow-Runtime oder Cloud-Plattform vorwegzunehmen. Ziel ist, dass aus dem fachlichen User Flow eine implementierbare MVP-Spezifikation entsteht.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Technisches Zielbild</strong></p>
<p>Der User arbeitet in fachlicher Sprache in Claude bzw. einer austauschbaren UI. MCP stellt Tools/Schnittstellen bereit, orchestriert aber nicht selbst. Die eigentliche Ablaufsteuerung liegt hinter der Schnittstelle in Speedboat API/Core plus einer geeigneten Workflow-Runtime. Skills/Blocks leisten semantische Arbeit; sie schlagen strukturierte Änderungen vor. Nur der Core darf den kanonischen Case State mutieren.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## A.1 Komponenten und Verantwortlichkeiten

| **Komponente**                 | **Verantwortung**                                                                                    | **Nicht ihre Aufgabe**                                                   |
|--------------------------------|------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------|
| Claude / UI                    | Dialog, fachliche Userführung, Anzeige von Drafts, Fragen und Konflikten; Auswahl passender Tools.   | Nicht kanonischer State; keine versteckten Direktwrites in project.json. |
| MCP Layer                      | Standardisierte Tool-Schnittstelle zwischen Claude/UI und Speedboat-Funktionen.                      | Keine Workflow-Engine und keine fachliche Orchestrierung per se.         |
| Speedboat API / Core           | Autorisierung, State-Zugriff, Revisionen, apply_patch, Gate-/Freeze-Operationen, Invarianten, Audit. | Keine generische Textgenerierung und kein Fachwissen im Hardcode.        |
| Workflow Runtime               | Retries, Queues, Trigger, Long-running Jobs, Abhängigkeiten/Parallelität. Implementierung offen.     | Nicht Speedboat-spezifische Fachlogik neu erfinden.                      |
| Process Pack / Skills / Blocks | Domänenspezifische Extraktion, Generatoren, Critics, Validators, QG-Regeln und Mappings.             | Dürfen den kanonischen State nicht direkt überschreiben.                 |
| Model Adapter                  | LLM-Aufrufe inkl. Modellrouting, strukturierte Outputs, isolierte Critic-Kontexte.                   | Keine Persistenzhoheit.                                                  |
| State Adapter                  | Case State laden/speichern; im MVP z. B. project.json, später DB möglich.                            | Keine fachliche Bewertung.                                               |
| Document Adapter               | Source/Working/Frozen Documents lesen, schreiben, versionieren, exportieren.                         | Dokument nicht mit Case State gleichsetzen.                              |
| Source/Research Adapter        | Externe/verbundene Quellen lesen, Quellenmetadaten und Fundstellen liefern.                          | Nicht selbst bestimmen, welche Aussage kanonisch wird.                   |

## A.2 Kanonischer End-to-End Write Path

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>User / Reviewer<br />
↓ fachliche Eingabe / Entscheidung<br />
Claude / UI<br />
↓ MCP Tool Call<br />
Speedboat API<br />
↓ Workflow Runtime / Process Pack<br />
Skill / Block / Critic / Validator<br />
↓ strukturierter Output<br />
proposed Patch / Draft / Issue<br />
↓<br />
Core: apply_patch / gate_check / freeze<br />
↓<br />
Case State (revisioniert) + Audit<br />
↓<br />
Document Adapter → Working Document / Frozen Output<br />
↓<br />
Claude / UI zeigt Ergebnis, offene Punkte oder Konflikt</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Wichtig: Nicht jede Block-Ausgabe ist automatisch ein Patch. Ein Generator kann z. B. zunächst nur einen Draft liefern. Ein Patch ist nur dann erforderlich, wenn dauerhafte strukturierte Fallinformation oder eine Entscheidung in den Case State übernommen werden soll.

## A.3 Fallakte / Case State als technische SSOT

Die Fallakte ist technisch die persistente, strukturierte Repräsentation eines konkreten Falls. Im MVP kann sie als schema-validiertes JSON-Objekt gespeichert werden; später kann derselbe logische State in einer Datenbank liegen. Dokumente sind Quellen bzw. Arbeits-/Output-Artefakte und werden nur referenziert.

| **State-Bereich**   | **Beispiele**                                                                                  |
|---------------------|------------------------------------------------------------------------------------------------|
| Case Metadata       | case_id, process/pack version, lifecycle status, revision                                      |
| Fact Layer          | Wert, Einheit, Quelle/Fundstelle, Provenienzstatus, Gültigkeit/Stand                           |
| Fachliche Objekte   | Framing, Objectives, KPIs, Technical Risks, Solution Variants, Experiments, APs, Budgetobjekte |
| Decision State      | Gate-Entscheidungen, Evidence Debt, Red Flags, Reviewer/Override                               |
| Change/Audit        | Patch IDs, Change Requests, Impact Findings, Revisionen, Zeitstempel                           |
| Document References | source_documents, working_documents, frozen_outputs inkl. Dokumentrevision/Hash                |

## A.4 Patch und apply_patch

Ein Patch ist ein strukturiertes Änderungsobjekt – typischerweise JSON – das eine gewünschte Änderung am Case State beschreibt. Ein Skill/Block schlägt den Patch vor; er schreibt nicht selbst in die Fallakte.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>{<br />
"patch_id": "p-0042",<br />
"case_id": "CASE-123",<br />
"base_revision": 41,<br />
"changes": [{<br />
"op": "replace",<br />
"path": "/project/duration_months",<br />
"old_value": 18,<br />
"new_value": 24,<br />
"provenance": "CUSTOMER_CONFIRMED"<br />
}]<br />
}</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

apply_patch ist dagegen eine deterministische Core-Funktion bzw. ein Core-Service. Sie entscheidet nicht frei semantisch, ob „24 Monate sinnvoll“ sind, sondern prüft technische und konfigurierte Invarianten, bevor der State mutiert.

| **Prüfung**                | **Technischer Zweck**                                                        | **Typisches Resultat**                             |
|----------------------------|------------------------------------------------------------------------------|----------------------------------------------------|
| base_revision              | Verhindert Überschreiben eines inzwischen neueren Case State.                | Stale revision → REJECTED / erneuter Merge nötig   |
| Schema / Typen             | Pfad, Datentyp, Pflichtfelder und Objektstruktur müssen gültig sein.         | Ungültig → REJECTED                                |
| Identity / Permission      | Nur authentisierte Rolle darf den betroffenen Case/Objekttyp ändern.         | Nicht erlaubt → REJECTED                           |
| Freeze / Protected Objects | Gefreezte Grundlagen dürfen nicht still verändert werden.                    | Material change → REVIEW_REQUIRED / Change Request |
| Configured Invariants      | Mechanisch prüfbare Grenzen/Abhängigkeiten, z. B. zulässige Statusübergänge. | Verstoß → REJECTED oder REVIEW_REQUIRED            |
| Audit + Revision           | Akzeptierte Mutation protokollieren und revision erhöhen.                    | APPLIED; revision n → n+1                          |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Drei Ergebnisse statt bloß Ja/Nein</strong></p>
<p>APPLIED = technisch zulässige Änderung wurde persistiert. REVIEW_REQUIRED = Änderung betrifft geschützte/freigegebene Inhalte oder benötigt bewusste fachliche Entscheidung; daraus entsteht ein Issue/Change Request. REJECTED = Mutation ist technisch unzulässig, z. B. veraltete Revision, Schemafehler oder fehlende Berechtigung.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## A.5 Material Change und Downstream Impact

„Änderung → Impact → Validierung“ ist ein eigener Mechanismus neben apply_patch. apply_patch schützt den Write Path; die Impact Analysis ermittelt, welche abhängigen Objekte und Dokumentstellen durch eine materielle Änderung möglicherweise ungültig werden.

| **Beispieländerung**            | **Direkter State-Change** | **Downstream zu prüfen**                                                      |
|---------------------------------|---------------------------|-------------------------------------------------------------------------------|
| Projektlaufzeit 18 → 24 Monate  | project.duration_months   | AP-Zeiträume, Personalkosten, Budgettimeline, Projekttext, ggf. Fördergrenzen |
| Zielmarkt DACH → EU             | market.geography          | Marktgröße, Wettbewerb, Verwertung, Internationalisierung, Quellen            |
| Technische Baseline 82 % → 75 % | kpi.baseline              | Target Gap, Risiko, Experimentdesign, AP-Aufwand, Claims im Antrag            |
| Partner fällt aus               | partner.status            | AP-Verantwortung, externe Kosten, Ressourcen, Deliverables, Einreichfähigkeit |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Frozen-Objekt-Sonderfall</strong></p>
<p>Ist die betroffene Grundlage bereits gefreezt, wird sie nicht direkt mutiert. Speedboat erzeugt einen Change Request, führt die Impact Analysis gegen den Frozen State aus und lässt Reviewer/User bewusst entscheiden, ob der Freeze geöffnet bzw. ein neuer Branch erzeugt wird.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## A.6 S0 – acht technische Schlüsselabläufe

| **\#** | **Flow**                           | **LLM / semantisch**                                                                                | **Deterministischer Core**                                                    | **Adapter / persistentes Ergebnis**                         |
|--------|------------------------------------|-----------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|-------------------------------------------------------------|
| T1     | Case Creation & Bootstrap          | Intent „neuer FFG-Fall“ verstehen; Metadaten ggf. aus Userinput ableiten.                           | Case-ID, Rollen, Pack/Process-Version, initiale Revision erzeugen.            | State/Drive: Case State v1, Source-/Working-Referenzen.     |
| T2     | Source Ingestion & Fact Extraction | Dokumenttyp verstehen; Facts/Claims/Fundstellen extrahieren; Unsicherheit markieren.                | Schema/Provenienz prüfen; zulässige Fact-Patches anwenden.                    | Document/Source Adapter; Source Registry + Facts im State.  |
| T3     | Residual Gap Q&A                   | Aus offenen Gaps gezielte fachliche Frage formulieren; Antwort interpretieren.                      | Antwort an konkretes Objekt binden; Revision/Provenienz prüfen.               | Patch → Case State; offene Gaps reduzieren.                 |
| T4     | Gate & Freeze                      | Critic/Validator bereitet Exceptions, Evidence Debt und Argumente vor.                              | gate_check, Reviewer-Entscheidung, Freeze-Record mit Revision/Versionen/Hash. | Frozen Fact Layer / Constitution / Blueprint.               |
| T5     | Technical Blueprint                | Objectives, KPIs, Risks, Variants, Experiments aus freigegebenem Kontext vorschlagen.               | Objekt-Schemata, Traceability und zulässige State Writes prüfen.              | Technical objects + QG3 readiness.                          |
| T6     | Research & Market Draft            | Research, Quellenbewertung, Marktstruktur und Draft erzeugen.                                       | Neue dauerhafte Facts nur via Patch; Provenienz/Revision prüfen.              | Research sources + Working Section Draft.                   |
| T7     | User Revision & Impact             | Userkorrektur semantisch als redaktionell vs. materiell klassifizieren; Impact-Hypothesen erzeugen. | apply_patch bzw. Change Request; Dependency/Impact-Regeln auswerten.          | Neue Case Revision + markierte betroffene Dokumentstellen.  |
| T8     | Assembly & Submission              | Freigegebene State-Objekte in Abschnittstexte übertragen; keine neuen Fakten erfinden.              | Mapping-/Completeness-/Length-Checks; Submission Freeze.                      | Working DOCX/XLSX → frozen submitted outputs + branch root. |

## A.7 Detailsequenz – Marktbeschreibung

| **\#** | **Technischer Schritt**                                                                                                                    | **Ergebnis**                                      |
|--------|--------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------|
| 1      | User: „Bitte Marktbeschreibung erstellen; Fokus DACH, primär Industriekunden.“                                                             | Fachlicher Intent + User Constraint               |
| 2      | Claude/UI ruft über MCP z. B. get_case / start_market_workstream auf.                                                                      | Tool Request; Case-ID aus authentisiertem Kontext |
| 3      | API lädt aktuellen Case State, Pack-Version, Markt-Facts und Dokumentreferenzen.                                                           | Konsistenter Ausgangskontext                      |
| 4      | Workflow Runtime startet Market Context Extractor / Research / Generator; unabhängiger Critic kann separat folgen.                         | Semantische Work Units                            |
| 5      | Research Adapter liefert Quellen + Metadaten/Fundstellen; Block bewertet Verwendbarkeit und offene Evidenz.                                | Research source set                               |
| 6      | Generator erstellt Draft und ggf. neue strukturierte Fact-Vorschläge (z. B. geography, segment definition, market size).                   | Draft + proposed patches                          |
| 7      | apply_patch prüft nur dauerhafte State-Änderungen; Draft kann auch ohne State-Mutation vorliegen.                                          | Case revision ggf. +1                             |
| 8      | Critic prüft Plausibilität, Quellenabdeckung, TAM/SAM/SOM-Logik und Widersprüche semantisch.                                               | Issues / Evidence Debt                            |
| 9      | Document Adapter schreibt/aktualisiert den Marktabschnitt im Working Document und speichert document_revision + last_synced_case_revision. | Working section draft v1                          |
| 10     | Claude/UI zeigt Draft, Quellen und offene Punkte. User: „TAM konservativer, Industriekunden stärker.“                                      | Review Input                                      |
| 11     | System klassifiziert Änderung: redaktionell oder materiell. Materielle Fact-Änderung → Patch/Impact; reine Formulierung → Draft-Update.    | Draft v2 + ggf. Case revision                     |
| 12     | User erhält aktualisierte Fassung; offene Wettbewerbs-/Evidence-Punkte bleiben sichtbar.                                                   | Abgestimmter Working Draft                        |

## A.8 Detailsequenz – neuer materieller Fakt

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>User: „Projektlaufzeit ist jetzt 24 statt 18 Monate.“<br />
↓<br />
Claude/Skill interpretiert → proposed Patch<br />
↓<br />
Core: revision + schema + permission + freeze check<br />
├─ nicht gefreezt → APPLIED → Case revision +1 → Impact Analysis<br />
└─ gefreezt → REVIEW_REQUIRED → Change Request → Impact Analysis<br />
↓<br />
APs / KPIs / Budget / Kapitel / Decisions betroffen?<br />
↓<br />
Claude zeigt User nur relevante Konflikte/Entscheidungen<br />
↓<br />
Freigabe → konsistente Regeneration der Working Docs</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Der User sieht dabei keine JSON-Fehlermeldung. Core-Ergebnisse werden als strukturierte Issue-Objekte an Claude/UI zurückgegeben und dort in fachliche Sprache übersetzt, z. B. „Diese Änderung betrifft vier APs und einen bereits freigegebenen Budgetstand. Change Request öffnen?“

## A.9 Working Documents und Revisionsschutz

| **Dokumentklasse** | **Rolle**                                                                           | **Technische Mindestmetadaten**                                                        |
|--------------------|-------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| Source Documents   | Unveränderte Inputs: Pitchdeck, alte Anträge, E-Mails/PDFs, technische Unterlagen.  | document_id, source_type, version/hash, timestamp, provenance/fundstellen              |
| Working Documents  | Bearbeitbare Projektbeschreibung, Organisationsbeschreibung, Budget-/Planungsfiles. | document_revision, last_synced_case_revision, editor/source, sync status               |
| Frozen Outputs     | Freigegebene bzw. tatsächlich eingereichte Stände.                                  | case_revision, pack/process/block versions, source versions, reviewer, timestamp, hash |

Externe Änderungen am Working Document dürfen nicht blind überschrieben werden. Vor einem Write vergleicht der Document Adapter die erwartete Dokumentrevision mit der aktuellen Revision/Version/Hash. Bei Abweichung entsteht ein Diff-/Merge-Konflikt statt eines stillen Overwrites.

## A.10 Fehler- und Konfliktpfade

| **Fall**                 | **Systemreaktion**                                                         | **User-Feedback**                                                                    |
|--------------------------|----------------------------------------------------------------------------|--------------------------------------------------------------------------------------|
| Stale Case Revision      | Patch nicht anwenden; aktuellen State neu laden/mergen.                    | „Der Fall wurde inzwischen geändert. Ich gleiche deine Änderung mit Revision 43 ab.“ |
| Schema-/Typfehler        | REJECTED; Block-Output korrigieren oder technischen Fehler loggen.         | Normalerweise keine technische Fehlermeldung; System versucht strukturierten Retry.  |
| Semantische Unsicherheit | Validator/Critic erzeugt Issue/Evidence Debt, nicht zwingend Patch-Reject. | „Quelle/Begründung für diesen Marktwert fehlt noch.“                                 |
| Frozen Object betroffen  | REVIEW_REQUIRED; Change Request statt Direktwrite.                         | „Die Änderung betrifft einen freigegebenen Stand und drei abhängige Bereiche.“       |
| Externer Document Edit   | Write stoppen; Dokument-Diff/Sync-Konflikt erzeugen.                       | „Das Word-Dokument wurde seit dem letzten Sync verändert. Änderungen vergleichen?“   |
| Adapter/Research-Ausfall | Workflow Retry/Queue; State bleibt unverändert bzw. Job bleibt resumable.  | „Recherche konnte nicht abgeschlossen werden; bisheriger Fallstand bleibt erhalten.“ |

## A.11 MVP-Akzeptanzkriterien und offene Implementierungsentscheidungen

- Nur der Core/State-Service mutiert den kanonischen Case State; Skills/Blocks liefern strukturierte Vorschläge.

- MCP bleibt Schnittstelle/Tool-Protokoll; Orchestrierung und Long-running Workflow laufen hinter der Schnittstelle.

- S0 funktioniert Ende-zu-Ende mit persistentem State über mehrere Sessions hinweg.

- Ein materieller Fact-Change löst Impact auf abhängige State-Objekte und Working Documents aus, ohne Frozen State still zu überschreiben.

- Working-Document-Writes sind revisionsgeschützt; externe Änderungen erzeugen Konflikt statt Overwrite.

- Ein zweiter Process Pack kann denselben Core ohne domänenspezifische Codeänderung verwenden.

- Offen vor Implementierung festzulegen: Workflow Runtime, konkretes State Backend, Dokument-Sync-Mechanik, Identity/Tenant-Modell, Research-/Source-Adapter und Definition des Material-Change-Thresholds.

# Anhang B – Begriffe im User-Flow

| **Begriff**           | **Bedeutung im Flow**                                                                                                                                                         |
|-----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Case State / Fallakte | Strukturierte Projektwahrheit: Facts, Provenienz, Entscheidungen, Gaps, Framings, KPIs, Risiken, Versionen.                                                                   |
| Patch                 | Strukturiertes Änderungsobjekt (typisch JSON), das eine gewünschte Mutation am Case State beschreibt. Ein Block schlägt es vor; apply_patch im Core prüft und persistiert es. |
| Working Document      | Bearbeitbares Arbeits-/Output-Dokument, z. B. FFG-Projektbeschreibung.docx oder Finanzplan.xlsx.                                                                              |
| Freeze                | Versiegelter, freigegebener Stand; spätere materielle Änderungen benötigen kontrollierten Change/Branch.                                                                      |
| Impact Check          | Ermittelt, welche downstream Objekte, Kapitel oder Dokumente von einer Änderung betroffen sind.                                                                               |
| Quality Gate          | Menschliche Freigabe auf Basis vorbereiteter Checks und Exceptions; keine bloße LLM-Selbsteinschätzung.                                                                       |
| apply_patch           | Deterministische Core-Funktion/Service für Revision-, Schema-, Berechtigungs-, Freeze- und Invariantenchecks; mutiert bei Erfolg den Case State und erhöht die Revision.      |
| Source Document       | Unveränderte Eingabequelle eines Falls, z. B. Pitchdeck, PDF, E-Mail oder technisches Dokument; liefert Facts/Fundstellen, ist aber nicht die Fallakte.                       |
