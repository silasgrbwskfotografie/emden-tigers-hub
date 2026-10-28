# Änderungen

## 3.7 (28.10.2026)
- Hub als App aufs Handy: zum Startbildschirm hinzufügen, auf dem Handy Menü als Schublade mit Leiste oben
- Änderungsprotokoll (Verwaltung > Protokoll, nur Admins): wer hat wann was angelegt, geändert oder gelöscht, mit alten und neuen Werten
- Benachrichtigungen per E-Mail: jeder wählt unter „Mein Profil“ selbst (fehlgeschlagene und erfolgreiche Auto-Posts, Redaktionsschluss Stadionheft, neue Bestellungen, Bestellschluss Teamkleidung). E-Mail-Versand richtet ein Admin unter Einstellungen ein
- Teamkleidung: Bestellbestätigung mit Bestellnummer auf dem Bildschirm, Sammelbuchung „In die Finanzen übernehmen“ für bezahlte Bestellungen
- Auto-Posting: Karussell (2 bis 10 Bilder) und Reel (Video bis 40 MB) auf Facebook und Instagram

## 3.6 (28.10.2026)
- Auto-Posting mit Reitern: Kalender, Online, Statistik, Einrichtung & Storys
  - Kalender: geplante Posts (automatisch, ohne Freigabe, gepostet, Fehler) und wiederkehrende Storys pro Monat, Klick auf einen Tag plant einen Post
  - Online: aktuelle Beiträge und aktive Storys auf Facebook und Instagram mit Aufrufen, Reaktionen, Kommentaren, Geteilt, Likes, Reichweite
  - Statistik: Follower, Aufrufe, Reichweite und Interaktionen für 7 oder 28 Tage, Tagesverlauf als Diagramm mit Tabelle
  - Meta-Kennzahlen werden einzeln abgefragt (nicht mehr unterstützte werden übersprungen) und 15 Minuten zwischengespeichert
  - Seiten-Token braucht zusätzlich read_insights und instagram_manage_insights

## 3.5 (28.10.2026)
- Neu im Bereich Medien: Auto-Posting auf Facebook und Instagram
  - Posts im Postplan mit „Automatisch posten“ freigeben: Feed-Post und Story gehen zu Datum und Uhrzeit raus (Facebook, Instagram oder beides)
  - Wiederkehrende Storys, z. B. Trainingszeiten: Wochentage, Uhrzeit, eigenes Canva-Bild, Gültigkeitszeitraum, „Jetzt testen“
  - Warteschlange, Ergebnisse mit Fehlermeldung, „Jetzt posten“ und „Neu einplanen“, Hinweis in der Übersicht bei Fehlern
  - Verbindung über ein Seiten-Token (nur Admins), Seite und Instagram-Konto werden automatisch erkannt
  - Nie doppelt: verpasste Posts werden nach 24 Stunden, Storys nach 3 Stunden nicht mehr nachgeholt

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
