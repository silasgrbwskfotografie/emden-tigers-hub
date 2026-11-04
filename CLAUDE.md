# Emden Tigers Hub

TeamHub der **Emden Tigers** (American Football, Emden, Sparte des SV Amisia Stern Wolthusen).
Web-App für Medien, Verein, Mitglieder und Finanzen mit Konten, Gruppen und Rechten.
Betreiber und Hauptnutzer: Silas (Admin). Sprache der Oberfläche und Texte: **Deutsch**.

## Aufbau

- `server.py`: der komplette Server in **Python 3 Standardbibliothek** (keine pip-Pakete). `http.server` + `sqlite3`.
  - `TABLES`: Schema der Fachtabellen. Neue Spalten hier eintragen, `init_db()` ergänzt sie beim Start automatisch (Migration per `ALTER TABLE`).
  - Konten/Rechte liegen bewusst **nicht** in `TABLES` (nicht über die generische API erreichbar): `users`, `sessions`, `groups`, `group_perms`, `user_groups`, `user_perms`.
  - Generische REST-API: `GET/POST /api/<tabelle>`, `GET/PUT/DELETE /api/<tabelle>/<id>`.
  - Spezielle Endpunkte: `/api/me`, `/api/profile`, `/api/admin/users|groups`, `/api/dashboard`, `/api/upload`, `/api/sheet-sync`, `/api/backup`, `/api/restore`, `/api/backups`, `/api/settings`, `/healthz`.
  - Anmeldung: `/login`, `/setup` (nur lokal ohne Benutzer), `/invite/<token>`, `POST /auth/login|logout|setup|invite`.
- **Öffentliche Webseite unter `/`**, Hub unter **`/hub`** (nur mit Login). `website.py` baut die Seiten serverseitig aus den öffentlichen Daten
  (`public_info`, `public_games`, `public_team`, `public_sponsors` in server.py), ohne Datenbankzugriff. `web/assets/`: `site.css`, `site.js`,
  Schriften (Anton, Karla, OFL, lokal), Fotos als WebP in 640/1280/1920 mit `bilder.json` (Alt-Texte). Seitentexte: Einstellungen `site_*`.
  Öffentliche Schnittstelle `/api/public/<info|spielplan|team|sponsoren>`: nur lesen, jede Antwort Feld für Feld gebaut (Whitelist).
  Neue öffentliche Felder nur dort ergänzen, nie Datenbankzeilen durchreichen. Kontaktformular `POST /kontakt` -> Tabelle `contact_requests`.
  Instagram-Raster: `insta_refresh` holt die neuesten Beiträge über die Meta-Verbindung (alle 30 Minuten, im Hintergrund), speichert die Bilder in `data/instagram`,
  ausgeliefert unter `/web/insta/<datei>`. Nur Bild, Permalink (nur instagram.com) und erste Caption-Zeile als Alt-Text, Besucher laden nichts von Meta.
  Supporter Karte online: `/supporter-karte` (Seite) und `POST /supporter-karte` (`public_card_order`): nur wenn `site_card_order_open` = "1",
  nur feste Felder, Anzahl 1 bis 5, verstecktes Feld, Begrenzung pro IP; legt `supporter_cards` mit `source='Online'`, `paid=0` an. Schalter `/api/cards/online` (Finanzen 2).
  Google: `structured_head` in website.py (canonical, `org_ld` SportsTeam, `game_ld` SportsEvent mit Zeitzone `berlin_offset`), `/sitemap.xml` und `/robots.txt`
  ohne Sitzung; absolute Adressen aus `SITE_URL` (sonst Host-Header über `base_url`). Neue öffentliche Seiten auch in `website.sitemap` eintragen.
  Livestream: `games.stream_url`, öffentlich nur als geprüfter https-Link (`public_games` -> `stream`).
  Livescore auf Startseite und Herrenseite: `next_game_card(..., live=True)` (nur Herren, höchstens eine Karte pro Seite) baut leere Plätze, `site.js` liest `/public/live` alle 5 Sekunden
  (nur sichtbarer Tab, nur `textContent`, Reihenfolge nach den Logos der Karte, nur passendes Spiel per `data-game`), Hub-Adresse `HUB_URL` in site.js (leer = gleiche Adresse).
  News: Tabelle `articles` (Bereich Medien, Hub-Seite `#/news`), öffentlich nur über `public_articles` (Status „Veröffentlicht“, Datum erreicht, ohne `notes`).
  Seiten `/news` (`page_news`) und `/news/<id>-<titel>` (`page_article`, falsche Schreibweise per 301 auf `article_slug`), die 3 neuesten im Startseiten-Abschnitt `news`.
  Text als Absätze über `paragraphs()`; mit `articles.format` = „HTML“ nur über `clean_html()` (Whitelist: p, h2 bis h4, strong, em, u, Listen, a mit geprüftem href, blockquote, br, hr; keine Attribute, Skripte, Bilder, Einbettungen). Neue Startseiten-Abschnitte setzt `web_layout` an ihren Standardplatz.
  Mannschaften: `TEAMS` (Herren, Next Generation) in server.py, website.py und pages.js gleich halten. `players.team`, `games.team`.
  Spieler der Next Generation (Minderjährige) gibt `public_team` nie aus, nur deren Coaches und Staff.
  Seiten: Start (mit Training, Probetraining und den 3 neuesten News), Herren (oben Infoblöcke mit Training und `next_game_card`, Kader nach Offense/Defense mit `player_card`: Foto nur mit Einwilligung, Position unter dem Namen; dann Coaches mit `coach_card`), Jugend, Spielplan, Sponsoren, Kontakt.
  Kontaktformular mit Anliegen `CONTACT_TOPICS` (server.py und website.py gleich halten), Vorauswahl per `/kontakt?anliegen=herren|jugend|sponsoring|frage`.
  Standardtexte `site_*` in `DEFAULT_SETTINGS`; neue Texte für bestehende Server: `SITE_TEXTS_VERSION` erhöhen (füllt nur leere Felder).
  Webseite im Hub (`#/website`, Bereich Medien: Lesen 1, Ändern 2): `/api/website` (GET Übersicht mit Checkliste, PUT `texts` nur `site_*` und `layout`),
  `/api/website/image/<slot>` (POST WebP-Dateien vom Browser, nur `website.IMAGE_SLOTS`, Prüfung auf RIFF/WEBP, PUT Alt-Text, DELETE = Standardbild).
  Eigene Bilder in `data/site`, ausgeliefert unter `/web/site/<datei>.webp`; Beschreibung und Aufbau in den Einstellungen `web_images`, `web_layout` (nicht öffentlich).
  Abschnitte der Startseite: `website.START_SECTIONS`. Öffentliche Seiten senden `X-Frame-Options: SAMEORIGIN` (Vorschau im Hub), alles andere `DENY`.
  Fehlende Inhalte als `placeholder()` (gelb markiert) und in `PLATZHALTER.md` eintragen, nie erfinden.
- `static/`: Frontend des Hubs ohne Build-Schritt (Vanilla JS, eine Seite mit Hash-Router, ausgeliefert unter `/hub`).
  - `app.js`: API-Helfer, Router, Formular-Generator (`editRecord`, `fieldHtml`), Rechte-Hilfen (`can`, `PAGE_AREA`, `applyPermissions`).
  - `pages.js`: alle Seiten (`App.pages.<name>`), Feld-Definitionen `F.<tabelle>`.
  - `captions.js`: Caption-Vorschläge aus den Vereinsdaten.
  - `style.css`, `logo.png` (Vereinslogo, **nicht verändern**), `icon.png`.
- Betrieb: `Dockerfile` (kopiert `server.py`, `website.py`, `static/`, `web/`), `docker-compose.yml` (Hub + Caddy mit HTTPS), `Caddyfile`, `.env` (nicht im Repo), `setup.sh` (Ersteinrichtung), `update.sh` (Update per Git).
- Daten zur Laufzeit in `data/` (nicht im Repo): `tigers.db`, `media/`, `backups/`.

## Rechte-Modell

- Bereiche: `medien`, `verein`, `mitglieder`, `finanzen` (`AREAS` in server.py, `AREA_SHORT`/`PAGE_AREA` im Frontend).
- Stufen: 0 = kein Zugriff, 1 = Lesen, 2 = Bearbeiten. Admin (`users.is_admin`) darf alles.
- Effektives Recht = Ausnahme der Person (`user_perms`) falls gesetzt, sonst Maximum der Gruppen (`effective_perms`).
- `TABLE_AREA` ordnet jede Tabelle einem Bereich zu. `SHARED_READ`: Nachschlage-Tabellen, lesbar für alle mit irgendeinem Leserecht.
- `TABLE_AREAS_ANY`: Tabellen, die mehrere Bereiche verwalten dürfen (Teamkleidung: Verein, Finanzen, Medien). Im Frontend `'verein|finanzen|medien'` in `PAGE_AREA`/`data-area`, `can()` versteht `|`, CSS-Klasse `.aw`.
- `FINANCE_FIELDS`: Felder, die nur mit Finanz-Leserecht ausgeliefert werden (z. B. `sponsors.amount`).
- **Der Server prüft jede Anfrage.** Das Frontend blendet nur aus (CSS: `.pp` braucht Medien-Schreibrecht, `.vw` Verein-Schreibrecht, `body[data-ro]` = Lesemodus, `.keep` bleibt im Lesemodus sichtbar).
- Neue Tabelle: in `TABLES` und `TABLE_AREA` eintragen, Seite in `pages.js`, Menüpunkt in `index.html` mit `data-area`, Eintrag in `PAGE_AREA`.

## Sicherheit (nicht aufweichen)

- Ohne Sitzung erreichbar: die Webseite (`/`, `/herren`, `/jugend`, `/spielplan`, `/news`, `/news/<artikel>`, `/sponsoren`, `/kontakt`, `/supporter-karte` (auch POST), `/impressum`, `/datenschutz`, alte Adressen `/team`, `/next-generation`, `/probetraining` als 301 in `website.REDIRECTS`, `/web/assets/...`, `/web/insta/...`, `/web/site/...`, `/sitemap.xml`, `/robots.txt`, `/api/public/...`, `POST /kontakt`),
  Livescore `/public/live`, `/public/next-game`, `/live/push` und `/live/games` (nur mit Token; `/spielstand` nur mit Sitzung),
  `/login`, `/setup`, `/invite`, `/passwort-vergessen`, `/passwort-neu`, `/healthz`, `/bestellen`, `/teilen`, `/manifest.webmanifest`, `/sw.js`, `style.css`, `logo.png`, `icon.png`, `icon-192.png`, `icon-512.png`.
  Alles unter `/hub`, `/static`, `/media` und `/api` (außer `/api/public`) braucht eine Sitzung.
- Webseite: keine externen Schriften, Tracker oder Einbettungen. Einzige Ausnahme sind die Rechtstexte der IT-Recht Kanzlei auf `/impressum` und `/datenschutz`.
  Spielerfotos nur mit `players.consent`. Domain/Basisadresse nur über `DOMAIN` in der `.env` (daraus `SITE_URL`).
- `sw.js` speichert bewusst nichts zwischen (keine Vereinsdaten offline auf dem Handy).
- Änderungsprotokoll `audit_log` (nicht in `TABLES`, nur `/api/admin/log`, nicht im Backup-Download). `api_table` schreibt bei jedem Anlegen, Ändern, Löschen mit; neue Sonderaktionen mit `audit(...)` ergänzen.
- Serverumzug (`/api/migrate`, nur Admins): Komplett-Export inkl. Konten, `secrets` und Protokoll, ohne Sitzungen, verschlüsselt mit Passwort
  (scrypt, SHAKE-256-Schlüsselstrom, HMAC-SHA256, erst prüfen, dann entschlüsseln). Import ersetzt alles. Neue Tabellen landen automatisch mit drin.
- E-Mail: SMTP-Zugang in `secrets`, Passwort nie über die API. `notify(kind, ...)` schickt nur an Abonnenten mit passendem Leserecht (`NOTIFY_KINDS`), jede Mail einzeln.
- `/teilen/<sig>/<datei>`: einzelne Bilder aus `data/media` für Instagram (Meta holt Bilder selbst ab). Nur mit HMAC-Signatur (`share_sig`, Schlüssel `share_key` in `secrets`), nur Bildendungen (`SHARE_EXT`).
- Auto-Posting: Seiten-Token und Schlüssel in der Tabelle `secrets` (nicht in `TABLES`, nicht über die API lesbar, aus dem Backup-Download entfernt, beim Restore behalten). Verbindung einrichten nur Admins (`/api/social/connection`).
  `social_loop` postet nur freigegebene Posts (`auto_publish`) und Story-Regeln, markiert vorher `publish_state='läuft'` (nie doppelt). `SERVER_FIELDS` setzt nur der Server.
- `/bestellen/<token>` (Teamkleidung, `public_order` in server.py) ist bewusst ohne Login erreichbar, aber nur mit dem geheimen Token des Artikels.
  Liefert nur Artikel-Infos, Bestellfelder und die öffentliche Liste (ohne interne Felder, ohne `paid`, ohne Notizen) und nimmt geprüfte Bestellungen an
  (nur definierte Felder, Längen- und Auswahlprüfung, Bestellschluss, Rate-Limit pro IP). Das Token vergibt nur der Server (`/api/apparel/<id>/new-link`).
- Livescore (`live_push`, `live_public` in server.py): Highlight Desk meldet mit `Authorization: Bearer <Token>` an `/live/push` (Token nur als Hash in `secrets.live_token_hash`, Erzeugen nur Admins unter `/api/live/token`). Öffentlich lesbar sind nur Spielstand und Spielinfos (`/public/live`, `/public/next-game`, mit CORS `*`, Rate-Limit pro IP). Alles aus der Meldung wird geprüft, gekürzt und von Markup befreit, Torschützen nur mit `live_show_players`. Die Meldung liegt nur im Speicher (`LIVE`). Beim Endstand schreibt der Hub `score_us`/`score_them` ins Spiel und ins Protokoll.
- Schreibende Anfragen brauchen den Header `X-TMH: 1` (CSRF-Schutz). `api()` in app.js setzt ihn.
- Passwörter: scrypt. Sitzungen: Token-Hash in `sessions`, Cookie HttpOnly, SameSite=Lax, Secure auf dem Server.
- Passwort vergessen (`/auth/forgot`, `/auth/reset`): immer dieselbe Antwort (keine Auskunft, ob es ein Konto gibt), Link 60 Minuten und einmal gültig,
  nur `reset_hash` gespeichert, Begrenzung pro IP und Konto, nach dem Setzen alle Sitzungen beendet und Info-Mail. Link-Adresse aus `hub_url`.
- Login-Sperre nach Fehlversuchen. Backup-Download enthält keine Konten. Restore behält Konten/Gruppen des Servers.
- `file://`-Tabellen-URLs sind im Serverbetrieb gesperrt.

## Konventionen

- Texte, Captions, Hinweise: **keine Gedankenstriche (– oder —)**, wirkt nach KI. `noDashes()` im Frontend.
- Captions: max. 5 Hashtags, eigener Account wird nie markiert, keine erfundenen Ergebnisse oder Namen.
- Vereinsdesign: Torinrot (#B3121D) und Schwarz, Tiger-Logo weiß, Logo nie verändern.
- Keine externen Abhängigkeiten ohne guten Grund (Server: nur Standardbibliothek, Frontend: kein Build).
- Versionsnummer an zwei Stellen gleich halten: `VERSION` in server.py und `APP_VERSION` in static/app.js (der Browser zeigt sonst einen Hinweis auf eine alte Version).

## Lokal starten und testen

```
TMH_PORT=8765 python3 server.py            # Browser öffnet sich, Ersteinrichtung unter /setup
TMH_SERVER=1 TMH_ADMIN_USER=admin TMH_ADMIN_PASSWORD=testpasswort1 TMH_DATA=/tmp/hub-test python3 server.py
python3 -c "import ast; ast.parse(open('server.py').read())"
node --check static/app.js static/pages.js static/captions.js
docker compose up -d --build                # kompletter Stack wie auf dem Server (braucht .env)
```

Nur für lokale Tests: `TMH_GRAPH_URL` (nachgebaute Meta-API), `TMH_NOTIFY_INTERVAL` und `TMH_DIGEST_SECONDS` (Benachrichtigungen schneller). Auf dem Server nie setzen.

Rechte immer mit mehreren Testkonten prüfen (Admin, Spieler, Media Team, Helfer mit Ausnahme): sichtbare Menüpunkte, Knöpfe, und dass der Server verbotene Aktionen mit 403 ablehnt.

## Ausliefern

1. Version in `server.py` und `static/app.js` hochzählen, Änderung in `CHANGELOG.md` eintragen.
2. Commit und Push auf `main`.
3. Auf dem Server: `cd /opt/EmdenTigersHub && sudo bash update.sh` (Sicherung, `git pull`, Neustart, Healthcheck).

Datenbank-Änderungen nur **additiv** (neue Tabellen/Spalten). Nie Spalten umbenennen oder löschen, sonst geht der Update-Pfad bestehender Server kaputt.
