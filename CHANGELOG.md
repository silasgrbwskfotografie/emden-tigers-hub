# Änderungen

## 4.1 (02.11.2026)
- News auf der Webseite: Übersicht unter /news, jeder Artikel mit eigener Adresse (/news/<nummer>-<titel>), im Menü und Footer;
  die 3 neuesten Artikel auf der Startseite (Abschnitt „News“, im Hub sortier- und ausblendbar)
  - Im Hub unter Medien > News: Überschrift, Datum, Entwurf oder Veröffentlicht, Vorspann, Text, Foto mit Bildbeschreibung, optional Mannschaft und Spiel (zeigt Paarung und Ergebnis)
  - Sichtbar erst ab dem Datum und nur als „Veröffentlicht“, interne Notizen nie öffentlich; Artikel in der Sitemap und als NewsArticle für Google
- Livescore auf der Startseite: Die Herren-Karte unter „Nächste Spiele“ zeigt während des Spiels den Spielstand statt „VS“,
  mit LIVE, Viertel oder Halbzeit und Down & Distance; danach etwa 2 Stunden „Endstand“. Aktualisiert sich alle 5 Sekunden, nur solange die Seite sichtbar ist
- Livescore für die Webseite: Highlight Desk meldet den Spielstand an den Hub, die Webseite liest ihn öffentlich
  - Einstellungen > Livescore: Token für Highlight Desk erzeugen (wird nur einmal angezeigt, im Hub nur als Hash gespeichert), Adressen für die Webseite
  - Öffentlich lesbar (nur Spielstand und Spielinfos, mit CORS, begrenzt pro Verbindung): `/public/live` und `/public/next-game`, dazu die Vollbildseite `/spielstand` (nur angemeldet)
  - Meldung nur mit Token (`/live/push`), Spieleliste für Highlight Desk (`/live/games`)
  - Beim Abpfiff trägt der Hub den Endstand ins Spiel ein (mit Eintrag im Protokoll)
  - Torschützen sind standardmäßig nicht öffentlich, einschaltbar in den Einstellungen
  - Spielplan: Knopf „Zurücksetzen“ pro Spiel (Verein bearbeiten) löscht Ergebnis und Viertel und beendet den Livescore, z. B. nach einem Test mit Highlight Desk
- Sponsorenseite: alle Sponsoren als Karten mit Logo, Paket, Webseite und Instagram; Logos füllen den Kasten (auch auf der Startseite)
- Spielkarten zeigen den vollen Vereinsnamen „Emden Tigers“
- Heimspieladresse und „Anfahrt auf der Karte“ führen zum Google-Maps-Link (im Hub unter Webseite > Texte änderbar)
- E-Mail-Versand: Verschlüsselung passend zum Port (465 SSL, 587 STARTTLS), verständliche Meldung bei abgelehnter Anmeldung, Leerzeichen im Gmail-App-Passwort werden ignoriert

## 4.0 (31.10.2026)
- Öffentliche Vereinswebseite unter `/`: Start (mit Training und Probetraining), Herren, Jugend, Spielplan, Sponsoren und Supporter Karte, Kontakt, Impressum, Datenschutz
  - Herren: Kader direkt auf der Seite nach Offense und Defense, genaue Position unter dem Namen, danach die Coaches
  - Herren oben wie bei der Jugend: Infoblöcke Training, Trainingsort, Kader, Heimspiele, darunter nächstes Spiel mit Countdown und Probetraining;
    Coaches als kompakte Querkarten
  - Kontaktformular mit Anliegen (Probetraining Herren, Probetraining Jugend, Sponsoring, Allgemeine Frage)
  - Alte Adressen /team, /next-generation und /probetraining leiten dauerhaft weiter
  - Aufbau angelehnt an silasgrbwskfotografie.de, Grafikstil der Vereinsposts (Anton, Rot und Schwarz), mobile first, ohne JavaScript-Pflicht
  - Spielplan, Kader, Coaches und Sponsoren kommen live aus dem Hub, Spielerfotos nur mit Einwilligung, Texte unter Einstellungen > Webseite
  - Lokale Schriften, keine Tracker oder Einbettungen, Fotos von silasgrbwsk.fotografie als WebP in drei Größen
  - Instagram-Raster mit den 6 neuesten Beiträgen (Handy: 3 untereinander), über die Meta-Verbindung alle 30 Minuten geholt und lokal gespeichert, ohne Verbindung eigene Fotos
  - Zwei Mannschaften: Herren und Next Generation (Flag-Jugend) mit je eigener Seite, im Spielplan getrennt
  - Spieler der Next Generation erscheinen nie öffentlich, nur Coaches und Staff
  - Alle Webseiten-Texte vorformuliert (einmalig in noch leere Felder bestehender Server übernommen)
  - Über dem Footer: Sponsor der Webseite (silasgrbwsk.fotografie), im Footer das Wappen des SV Amisia mit Link
- Neu im Hub unter Medien: Webseite
  - Übersicht mit Checkliste (fehlende Texte, Spieler ohne Foto-Einwilligung, Gegner und Sponsoren ohne Logo, Instagram nicht verbunden)
  - Texte nach Seiten sortiert, Bilder ersetzen (der Browser erzeugt WebP in drei Größen) mit Alt-Text, zurück zum Standardbild
  - Aufbau der Startseite: Abschnitte sortieren und ausblenden
  - Hinweis-Leiste oben auf jeder Seite mit Link und Ablaufdatum
- Startseite: „Nächste Spiele“ über die volle Breite, Herren und Jugend nebeneinander mit Countdown, darunter Training beider Teams; Titelbild eckig, Supporter Karte oben entfernt
- Spiele zeigen beide Mannschaften mit Logo und Namen (Gegner ohne Logo mit Initialen), Ergebnis in der Reihenfolge der Logos
- Kontaktseite neu: Formular mit Anliegen als Auswahlkacheln, daneben E-Mail, Instagram, Trainingszeiten und Heimspielort
- Herren: Coaches vor dem Kader
- Google: Verein als SportsTeam und kommende Spiele als SportsEvent (strukturierte Daten), canonical-Link, sitemap.xml und robots.txt
- Supporter Karte online bestellen unter /supporter-karte (ohne Anmeldung): im Hub unter Finanzen > Supporter Karte öffnen oder schließen, Link kopieren;
  Bestellungen erscheinen als „Online“ und unbezahlt mit Kontakt, Benachrichtigung „Neue Online-Bestellung“ und Bestätigungsmail an den Besteller
- Fanshop (tigers-emden.fan12.de) als roter Knopf im Menü und im Footer, Link im Hub unter Webseite > Texte > Allgemein
- Spielplan im Hub: Feld Livestream-Link, auf der Webseite als Knopf „Livestream“ bei kommenden Spielen (nur https-Links)
- Spielplan: Adresse des Heimspielorts (Folkmar-Allena-Straße 13, 26725 Emden-Wolthusen) und Heimspiel Guide mit Lageplan (im Hub austauschbar)
  - Vorschau als Handy, Tablet oder Desktop
- Hub zieht nach `/hub` (nur mit Login), Weiterleitungen, App, Mails und alte Lesezeichen angepasst
- Kader und Spielplan: Feld „Mannschaft“ mit Filter (Herren, Next Generation)
- Öffentliche Schnittstelle `/api/public` mit festen Feldern, Anfragen aus dem Kontaktformular unter Mitglieder > Anfragen (mit Benachrichtigung)
- Domain nur noch über `DOMAIN` in der `.env`, HTTPS mit Let's Encrypt als vorbereiteter Schritt in INSTALLATION.md

## 3.9 (28.10.2026)
- „Passwort vergessen?“ auf der Anmeldeseite: Link per E-Mail (60 Minuten und nur einmal gültig), danach direkt angemeldet, alle anderen Anmeldungen beendet, Info-Mail über die Änderung
- Schutz: keine Auskunft, ob ein Konto existiert, Begrenzung pro Verbindung und Konto, gespeichert wird nur ein Hash des Links
- Mein Profil: E-Mail-Adresse des Kontos direkt bei „Konto“ (für Passwort vergessen und Benachrichtigungen)

## 3.8 (28.10.2026)
- Serverumzug unter Einstellungen: Komplett-Export und -Import mit allem (Vereinsdaten, Bilder, Videos, Konten, Gruppen, Rechte, Facebook-Verbindung, E-Mail-Versand, Protokoll)
  - Umzugsdatei mit Passwort verschlüsselt, nur einmal herunterladbar, falsches Passwort oder beschädigte Datei werden vor dem Ersetzen erkannt
  - Import ersetzt alles, vorher automatische Sicherung des bisherigen Stands
- Uploads bis 2 GB über Caddy, `update.sh` startet Caddy neu, wenn sich das Caddyfile ändert

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
