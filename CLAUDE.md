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
- `static/`: Frontend ohne Build-Schritt (Vanilla JS, eine Seite mit Hash-Router).
  - `app.js`: API-Helfer, Router, Formular-Generator (`editRecord`, `fieldHtml`), Rechte-Hilfen (`can`, `PAGE_AREA`, `applyPermissions`).
  - `pages.js`: alle Seiten (`App.pages.<name>`), Feld-Definitionen `F.<tabelle>`.
  - `captions.js`: Caption-Vorschläge aus den Vereinsdaten.
  - `style.css`, `logo.png` (Vereinslogo, **nicht verändern**), `icon.png`.
- Betrieb: `Dockerfile`, `docker-compose.yml` (Hub + Caddy mit HTTPS), `Caddyfile`, `.env` (nicht im Repo), `setup.sh` (Ersteinrichtung), `update.sh` (Update per Git).
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

- Alles außer `/login`, `/setup`, `/invite`, `/passwort-vergessen`, `/passwort-neu`, `/healthz`, `/bestellen`, `/teilen`, `/manifest.webmanifest`, `/sw.js`, `style.css`, `logo.png`, `icon.png`, `icon-192.png`, `icon-512.png` braucht eine Sitzung.
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
