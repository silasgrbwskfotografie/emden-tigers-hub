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
- `FINANCE_FIELDS`: Felder, die nur mit Finanz-Leserecht ausgeliefert werden (z. B. `sponsors.amount`).
- **Der Server prüft jede Anfrage.** Das Frontend blendet nur aus (CSS: `.pp` braucht Medien-Schreibrecht, `.vw` Verein-Schreibrecht, `body[data-ro]` = Lesemodus, `.keep` bleibt im Lesemodus sichtbar).
- Neue Tabelle: in `TABLES` und `TABLE_AREA` eintragen, Seite in `pages.js`, Menüpunkt in `index.html` mit `data-area`, Eintrag in `PAGE_AREA`.

## Sicherheit (nicht aufweichen)

- Alles außer `/login`, `/setup`, `/invite`, `/healthz`, `style.css`, `logo.png`, `icon.png` braucht eine Sitzung.
- Schreibende Anfragen brauchen den Header `X-TMH: 1` (CSRF-Schutz). `api()` in app.js setzt ihn.
- Passwörter: scrypt. Sitzungen: Token-Hash in `sessions`, Cookie HttpOnly, SameSite=Lax, Secure auf dem Server.
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

Rechte immer mit mehreren Testkonten prüfen (Admin, Spieler, Media Team, Helfer mit Ausnahme): sichtbare Menüpunkte, Knöpfe, und dass der Server verbotene Aktionen mit 403 ablehnt.

## Ausliefern

1. Version in `server.py` und `static/app.js` hochzählen, Änderung in `CHANGELOG.md` eintragen.
2. Commit und Push auf `main`.
3. Auf dem Server: `cd /opt/EmdenTigersHub && sudo bash update.sh` (Sicherung, `git pull`, Neustart, Healthcheck).

Datenbank-Änderungen nur **additiv** (neue Tabellen/Spalten). Nie Spalten umbenennen oder löschen, sonst geht der Update-Pfad bestehender Server kaputt.
