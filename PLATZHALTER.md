# Offene Platzhalter der Webseite

Stand: Version 4.0. Alles, was hier steht, erscheint auf der Webseite als **gelb markierter Platzhalter** oder muss geprüft werden.
Die meisten Texte pflegst du im Hub unter **Verwaltung > Einstellungen > Webseite**, ohne Code.

## Fehlt noch (bitte liefern oder im Hub eintragen)

| Wo auf der Webseite | Was fehlt | Wo pflegen |
|---|---|---|
| Footer, jede Seite | Kontakt-E-Mail des Vereins | Einstellungen > Webseite > Kontakt-E-Mail |
| Spielplan, Heimspiele | Adresse des Heimspielorts (für „Anfahrt“) | Einstellungen > Webseite |
| Next Generation, Probetraining | Trainingszeiten der Flag-Jugend | Einstellungen > Webseite > Next Generation |
| Next Generation, Probetraining | Trainingsort der Flag-Jugend mit Adresse | Einstellungen > Webseite > Next Generation |
| Next Generation | Altersgruppen (z. B. 8 bis 15 Jahre) | Einstellungen > Webseite > Next Generation |

## Von Claude geschrieben (bitte gegenlesen)

Alle übrigen Texte hat Claude formuliert, ohne Fakten wie Gründungsjahr, Liga, Erfolge oder Preise zu erfinden.
Sie stehen als Standardtexte in `server.py` (`DEFAULT_SETTINGS`, `site_*`) und lassen sich unter Einstellungen > Webseite ändern:
Einleitung und „Wer wir sind“ auf der Startseite, Probetraining, Spieltag, Supporter Karte, Sponsor werden, Vorstellung Flag Football.
Feste Texte im Code (`website.py`): Mannschaftskarten auf der Startseite, Einleitung auf Team und Probetraining, Eltern-Hinweis und Kurzinfos auf der Next-Generation-Seite.
Bitte besonders prüfen: „Für den Anfang reichen Sportkleidung, Fußball- oder Turnschuhe“ (Probetraining) und „Sportkleidung und Flaggengürtel“ (Next Generation, stellt der Verein die Gürtel?).

## Bitte prüfen (aus bestehenden Hub-Daten übernommen)

- **Preis Supporter Karte**: kommt aus Einstellungen > „Preis Supporter Karte“ (derzeit 25 €). Gilt der Preis für 2027?
- **Saison**: kommt aus Einstellungen > „Aktuelle Saison“ (derzeit 2027).
- **Heimspielort und Eintritt**: aus Einstellungen („Sportplatz SV Amisia Wolthusen“, 3 €).
- **Trainingszeiten und Trainingsort**: aus dem Auftrag vorbelegt (Di 20:30 bis 22:00, Do 19:00 bis 21:00, Kunstrasen Eintracht Emden JFV e. V., Pillauer Str. 12, 26725 Emden). Änderbar unter Einstellungen > Webseite.
- **Spielplan, Kader, Coaches, Sponsoren**: kommen live aus dem Hub. Auf der Testumgebung stehen Testdaten.
- **Mannschaften**: im Hub bei Kader und Spielplan das Feld „Mannschaft“ (Herren oder Next Generation). Bestehende Einträge stehen auf Herren.
  Spieler der Next Generation erscheinen nie auf der Webseite (Schutz Minderjähriger), nur deren Coaches und Staff.
- **Spielerfotos** erscheinen nur, wenn im Hub bei „Kader & Staff“ die Foto-Einwilligung angehakt ist. Alle anderen bekommen das Tiger-Logo.
- **Fotos der Webseite**: 11 Fotos aus dem pCloud-Ordner (Hildesheim, Bremen, Trainingslager). Bitte prüfen, ob alle abgebildeten Personen damit einverstanden sind. Austausch: neue Datei unter gleichem Namen in `web/assets/img/` (siehe `bilder.json`).
- **Domain**: noch keine. Siehe INSTALLATION.md > „Webseite, Domain und HTTPS“.
