# Änderungen

## 3.4 (28.10.2026)
- Neue Seite Teamkleidung (verwalten mit Bearbeiten-Recht in Verein, Finanzen oder Medien)
  - Klamotte anlegen mit Bild, Beschreibung, Preis und Bestellschluss
  - Bestellfelder frei festlegen (Text, Zahl, Auswahl, Ja/Nein), Pflichtfelder und interne Felder, Vorlagen für Name, Rückennummer, Größe, Flock, Telefon
  - Bestell-Link ohne Anmeldung: Formular und Liste der bisherigen Bestellungen (ohne interne Felder und ohne „bezahlt“), Link jederzeit neu erzeugbar
  - Im Hub: Bestellungen bearbeiten, „bezahlt“ abhaken, Summen, Stückzahl pro Größe, Text und CSV für den Lieferanten

## 3.3 (28.10.2026)
- Stadionheft umgebaut: statt Seitenplan jetzt alle Infos für ein Heft zum Rauskopieren nach Canva
  - Sponsoren für das Heft auswählen, mit Logo und Anzeigen-Dateien
  - Trainerteam mit Foto und Kader nach Unit und Position aus „Kader & Staff“
  - Vorwort mit Autor, Funktion und Foto
  - Behind the Helmet: Fragebogen pro Spieler, Foto aus Kader & Staff, Hinweis bei fehlender Foto-Einwilligung
  - Gegner automatisch aus dem Heimspiel, Spielberichte mit Ergebnis aus dem Spielplan
  - Schiedsrichter, Fan-Info, Jugend und Rückseite; Sponsoren, Fan-Info, Jugend und Rückseite aus dem letzten Heft übernehmen
  - „Text kopieren“ pro Bereich und „Alles kopieren“ für das ganze Heft, Übersicht welche Bereiche noch fehlen

## 3.2 (28.10.2026)
- Neu im Bereich Medien: Stadionheft planen
  - Ausgaben mit Heimspiel, Redaktionsschluss, Druckabgabe, Canva-Link und fertigem PDF
  - Seitenplan als Doppelseiten wie im gedruckten Heft, mit Rubrik, Verantwortlichen, Status, Text und Dateien
  - Aufbau aus der Vorlage 2026 (36 Seiten) oder aus dem letzten Heft übernehmen
  - Texte aus dem Hub einfügen: Kader, Coaches, Gegner mit bisherigen Duellen, Spielberichte, Interview-Fragebogen, Rückseite
  - Hinweise: Seitenzahl nicht durch 4 teilbar, freie oder doppelte Seiten, Sponsoren ohne Anzeige, fehlende Foto-Einwilligung
  - Erinnerung in der Übersicht ab 14 Tagen vor Redaktionsschluss

## 3.1 (28.10.2026)
- Sponsoren: beliebige Dateien ablegen (Verträge, Rechnungen, Bilder, Druckdaten), sichtbar für alle mit Zugriff auf Sponsoren
- Versionsnummer klein oben am Logo
- Hochgeladene Dokumente, die kein Bild oder PDF sind, werden nur noch als Download ausgeliefert

## 3.0.1 (28.10.2026)
- Caddy: HTTPS funktioniert auch beim Aufruf über eine IP-Adresse (z. B. Test-VM im lokalen Netz)

## 3.0 (28.10.2026)
- Neuer Name: Emden Tigers Hub
- Konten, Gruppen und Rechte pro Bereich (Medien, Verein, Mitglieder, Finanzen), Ausnahmen pro Person
- Einladungslinks zum Festlegen des Passworts
- Neue Bereiche: Mitgliederliste, Finanzen (Buchungen mit Belegen)
- Mein Profil: eigene Kontaktdaten und Foto-Einwilligung pflegen
- Update über Git mit `update.sh`

## 2.0
- Serverbetrieb mit Login, Docker Compose, Caddy (HTTPS), tägliche Sicherung, Backup einspielen

## 1.x
- Lokale Version: Postplan, Spielplan, Kader, Sponsoren, Media Team, Supporter Karte, Abgleich mit der Google-Tabelle
