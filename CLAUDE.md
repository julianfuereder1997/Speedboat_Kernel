# Speedboat – Regeln für die Arbeit in diesem Repository

- Nur apply_patch verändert die Fallakte. Bausteine liefern Vorschläge.
- Jede Änderung hat Revision und Audit-Eintrag.
- Eingefrorene Objekte werden nie direkt geändert, nur per Change Request.
- Gate-Entscheidungen trifft nur ein Mensch mit Reviewer-Rolle.
- Jeder Baustein erhält nur die Eingaben aus seinem Vertrag; der Kern
  baut den Kontext, nicht das Modell.
- Kritiker-Läufe sind eigene Läufe mit eigener run_id.
- Was sich je Domäne ändert, steht in packs/, nie in packages/core.
- In packages/core stehen keine Domänenbegriffe (z. B. FFG, Förder,
  QG1, Constitution, Framing, Antrag).
- Vor jeder Änderung: erst Diagnose, dann Code nach Freigabe.
- Keine Kundendaten im Repository.
