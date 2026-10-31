# Offene Platzhalter der Webseite

Stand: Version 4.0. Alles, was hier steht, erscheint auf der Webseite als **gelb markierter Platzhalter** oder muss geprüft werden.
Texte, Bilder und Aufbau pflegst du im Hub unter **Medien > Webseite**, ohne Code. Die Übersicht dort zeigt auch, was noch fehlt.

## Fehlt noch (bitte liefern oder im Hub eintragen)

| Wo auf der Webseite | Was fehlt | Wo pflegen |
|---|---|---|
| Footer, jede Seite | Kontakt-E-Mail des Vereins | Medien > Webseite > Texte (Allgemein) |
| Spielplan, Heimspiele | Adresse des Heimspielorts (für „Anfahrt“) | Medien > Webseite > Texte |
| Start (Training), Jugend | Trainingszeiten der Flag-Jugend | Medien > Webseite > Texte (Jugend) |
| Start (Training), Jugend | Trainingsort der Flag-Jugend mit Adresse | Medien > Webseite > Texte (Jugend) |
| Jugend | Altersgruppen (z. B. 8 bis 15 Jahre) | Medien > Webseite > Texte (Jugend) |

## Von Claude geschrieben (bitte gegenlesen)

Alle übrigen Texte hat Claude formuliert, ohne Fakten wie Gründungsjahr, Liga, Erfolge oder Preise zu erfinden.
Sie stehen als Standardtexte in `server.py` (`DEFAULT_SETTINGS`, `site_*`) und lassen sich unter Medien > Webseite > Texte ändern:
Einleitung und „Wer wir sind“ auf der Startseite, Hinweise zum Probetraining, Spieltag, Supporter Karte, Sponsor werden, Vorstellung Flag Football.
Feste Texte im Code (`website.py`): Mannschaftskarten und Abschnitt Training auf der Startseite, Einleitungen auf Herren und Kontakt, Eltern-Hinweis und Kurzinfos auf der Jugendseite.
Bitte besonders prüfen: „Für den Anfang reichen Sportkleidung, Fußball- oder Turnschuhe“ (Startseite, Training) und „Sportkleidung und Flaggengürtel“ (Jugend, stellt der Verein die Gürtel?).

## Bitte prüfen (aus bestehenden Hub-Daten übernommen)

- **Preis Supporter Karte**: kommt aus Einstellungen > „Preis Supporter Karte“ (derzeit 25 €). Gilt der Preis für 2027?
- **Saison**: kommt aus Einstellungen > „Aktuelle Saison“ (derzeit 2027).
- **Heimspielort und Eintritt**: aus Einstellungen („Sportplatz SV Amisia Wolthusen“, 3 €).
- **Trainingszeiten und Trainingsort**: aus dem Auftrag vorbelegt (Di 20:30 bis 22:00, Do 19:00 bis 21:00, Kunstrasen Eintracht Emden JFV e. V., Pillauer Str. 12, 26725 Emden). Änderbar unter Medien > Webseite > Texte.
- **Spielplan, Kader, Coaches, Sponsoren**: kommen live aus dem Hub. Auf der Testumgebung stehen Testdaten.
- **Mannschaften**: im Hub bei Kader und Spielplan das Feld „Mannschaft“ (Herren oder Next Generation). Bestehende Einträge stehen auf Herren.
  Spieler der Next Generation erscheinen nie auf der Webseite (Schutz Minderjähriger), nur deren Coaches und Staff.
- **Spielerfotos** erscheinen nur, wenn im Hub bei „Kader & Staff“ die Foto-Einwilligung angehakt ist. Alle anderen bekommen das Tiger-Logo.
- **Fotos der Webseite**: 11 Fotos aus dem pCloud-Ordner (Hildesheim, Bremen, Trainingslager). Bitte prüfen, ob alle abgebildeten Personen damit einverstanden sind. Austausch: im Hub unter Medien > Webseite > Bilder (mit Alt-Text).
- **Domain**: noch keine. Siehe INSTALLATION.md > „Webseite, Domain und HTTPS“.
