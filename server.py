"""
Emden Tigers Hub
TeamHub der Emden Tigers: Medien, Verein, Mitglieder, Finanzen mit Konten und Rechten.

Betrieb auf dem Server: siehe INSTALLATION.md (Docker Compose mit Caddy und HTTPS).
Lokal:                  python server.py   (oder Start.bat unter Windows)

Benötigt nur Python 3.10+ (keine zusätzlichen Pakete).

Konfiguration über Umgebungsvariablen:
  TMH_HOST            Adresse, an die der Server bindet (Standard 127.0.0.1, im Container 0.0.0.0)
  TMH_PORT            Port (Standard 8765)
  TMH_DATA            Datenordner (Standard: Ordner "data" neben dieser Datei)
  TMH_SERVER          1 = Serverbetrieb (kein Browser, keine Ersteinrichtung über die Webseite)
  TMH_SECURE_COOKIES  1 = Login-Cookie nur über HTTPS (hinter Caddy immer 1)
  TMH_TRUST_PROXY     1 = Client-IP aus X-Forwarded-For übernehmen (hinter Caddy)
  TMH_ADMIN_USER      Benutzername des ersten Admins
  TMH_ADMIN_PASSWORD  Passwort des ersten Admins (wird nur genutzt, solange es keinen Benutzer gibt)
  TMH_RESET_PASSWORD  1 = Passwort von TMH_ADMIN_USER beim Start auf TMH_ADMIN_PASSWORD zurücksetzen
  TMH_BACKUP_KEEP     Anzahl täglicher Sicherungen, die aufbewahrt werden (Standard 14)
"""

import base64
import contextlib
import hashlib
import hmac
import secrets
import shutil
import time
import csv
import io
import json
import mimetypes
import os
import re
import sqlite3
import sys
import threading
import uuid
import webbrowser
import zipfile
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote, parse_qs, urlencode
import urllib.request
import urllib.error

import website   # öffentliche Webseite (website.py, gleiche Ordnerebene)

VERSION = "4.0"
APP_NAME = "Emden Tigers Hub"
ENV = os.environ.get
HOST = ENV("TMH_HOST", "127.0.0.1")
PORT = int(ENV("TMH_PORT", "8765"))
SERVER_MODE = ENV("TMH_SERVER") == "1"
SECURE_COOKIES = ENV("TMH_SECURE_COOKIES") == "1"
TRUST_PROXY = ENV("TMH_TRUST_PROXY") == "1"
BACKUP_KEEP = int(ENV("TMH_BACKUP_KEEP", "14"))
SITE_URL = (ENV("SITE_URL") or "").rstrip("/")   # öffentliche Adresse, z. B. https://emdentigers.de (vorerst die Server-IP)
MAX_BODY = 300 * 1024 * 1024          # 300 MB (Backup einspielen)
MAX_JSON = 60 * 1024 * 1024           # 60 MB (Bild-Upload als Base64)
SESSION_DAYS = 30
COOKIE = "tmh_session"

BASE = Path(__file__).resolve().parent
STATIC = BASE / "static"
DATA = Path(ENV("TMH_DATA") or (BASE / "data")).resolve()
MEDIA = DATA / "media"
DB_PATH = DATA / "tigers.db"
BACKUPS = DATA / "backups"

# Mannschaften (players.team, games.team). Gleiche Liste in static/pages.js (TEAMS) und website.py.
TEAMS = ("Herren", "Next Generation")
YOUTH_TEAM = "Next Generation"   # Flag-Jugend: Spieler (Minderjährige) erscheinen nie auf der Webseite
# Anliegen im Kontaktformular der Webseite (landet als Quelle in contact_requests), wie CONTACT_TOPICS in website.py
CONTACT_TOPICS = ("Probetraining Herren", "Probetraining Jugend", "Sponsoring", "Allgemeine Frage")

# ---------------------------------------------------------------------------
# Datenbank-Schema
# Jede Tabelle: Spaltenname -> SQL-Typ. "id" wird automatisch angelegt.
# Neue Spalten können hier einfach ergänzt werden, sie werden beim Start
# automatisch zur bestehenden Datenbank hinzugefügt.
# ---------------------------------------------------------------------------
TABLES = {
    "players": {
        "kind": "TEXT DEFAULT 'Spieler'",      # Spieler / Coach / Staff
        "first_name": "TEXT",
        "last_name": "TEXT",
        "number": "TEXT",
        "position": "TEXT",
        "unit": "TEXT",                         # Offense / Defense / Special Teams / Staff
        "role": "TEXT",                         # z. B. Headcoach, OC, DC
        "rookie": "INTEGER DEFAULT 0",
        "since": "TEXT",                        # dabei seit
        "photo": "TEXT",
        "instagram": "TEXT",
        "consent": "INTEGER DEFAULT 0",         # Foto-/Veröffentlichungseinwilligung
        "active": "INTEGER DEFAULT 1",
        "nickname": "TEXT",
        "facts": "TEXT",                        # Funfacts / Football-Geschichte
        "notes": "TEXT",
        "source": "TEXT",                       # z. B. "Tabelle", wenn aus Google Sheets angelegt
        "team": "TEXT DEFAULT 'Herren'",        # Mannschaft (TEAMS)
    },
    "opponents": {
        "name": "TEXT",
        "short": "TEXT",
        "city": "TEXT",
        "logo": "TEXT",
        "instagram": "TEXT",
        "notes": "TEXT",
    },
    "games": {
        "season": "TEXT",
        "date": "TEXT",
        "time": "TEXT",
        "opponent_id": "INTEGER",
        "home": "INTEGER DEFAULT 1",
        "location": "TEXT",
        "kind": "TEXT DEFAULT 'Liga'",
        "league": "TEXT",
        "score_us": "TEXT",
        "score_them": "TEXT",
        "quarters": "TEXT",
        "sponsor_id": "INTEGER",
        "highlights": "TEXT",
        "notes": "TEXT",
        "team": "TEXT DEFAULT 'Herren'",
    },
    "sponsors": {
        "name": "TEXT",
        "package": "TEXT",
        "logo": "TEXT",
        "instagram": "TEXT",
        "website": "TEXT",
        "contact": "TEXT",
        "start": "TEXT",
        "end": "TEXT",
        "amount": "TEXT",
        "posts_agreed": "INTEGER DEFAULT 0",
        "active": "INTEGER DEFAULT 1",
        "notes": "TEXT",
        "files": "TEXT",                        # JSON-Liste [{name, path, size, added}]: Verträge, Rechnungen, Bilder
    },
    "media_team": {
        "name": "TEXT",
        "role": "TEXT",
        "phone": "TEXT",
        "instagram": "TEXT",
        "active": "INTEGER DEFAULT 1",
        "notes": "TEXT",
    },
    "assignments": {
        "game_id": "INTEGER",
        "member_id": "INTEGER",
        "task": "TEXT",
        "confirmed": "INTEGER DEFAULT 0",
        "notes": "TEXT",
    },
    "supporter_cards": {
        "season": "TEXT",
        "holder": "TEXT",
        "number": "TEXT",
        "sold_on": "TEXT",
        "price": "REAL",
        "paid": "INTEGER DEFAULT 0",
        "notes": "TEXT",
    },
    "posts": {
        "date": "TEXT",
        "time": "TEXT",
        "type": "TEXT",
        "title": "TEXT",
        "caption": "TEXT",
        "image": "TEXT",
        "status": "TEXT DEFAULT 'Idee'",       # Idee / In Arbeit / Geplant / Gepostet
        "platform": "TEXT DEFAULT 'Instagram'",
        "format": "TEXT DEFAULT 'Feed'",        # Feed / Story / Reel / Karussell
        "game_id": "INTEGER",
        "sponsor_id": "INTEGER",
        "player_id": "INTEGER",
        "posted_url": "TEXT",
        "notes": "TEXT",
        "media": "TEXT",                           # Karussell (mehrere Bilder) oder Reel (ein Video): JSON-Liste wie files
        "auto_publish": "INTEGER DEFAULT 0",       # Freigabe: zum geplanten Zeitpunkt automatisch posten
        "targets": "TEXT DEFAULT 'Facebook'",      # Facebook / Instagram / Facebook + Instagram
        "publish_state": "TEXT",                   # nur Server: läuft / gepostet / teilweise / fehler / verpasst
        "publish_log": "TEXT",                     # nur Server
        "published_at": "TEXT",                    # nur Server
    },
    "story_rules": {                            # Wiederkehrende Storys, z. B. Trainingszeiten
        "name": "TEXT",
        "weekdays": "TEXT",                        # ISO-Wochentage, z. B. 2,4 (1 = Montag)
        "time": "TEXT",                            # HH:MM
        "image": "TEXT",
        "targets": "TEXT DEFAULT 'Facebook'",
        "active": "INTEGER DEFAULT 1",
        "valid_from": "TEXT",
        "valid_until": "TEXT",
        "last_run": "TEXT",                        # nur Server: Datum der letzten Ausführung
        "last_result": "TEXT",                     # nur Server
        "notes": "TEXT",
    },
    "sheet_players": {                          # Stand der Google-Tabelle "Social Media Spieler"
        "key": "TEXT",
        "name": "TEXT",
        "number": "TEXT",
        "position": "TEXT",
        "instagram": "TEXT",
        "kind": "TEXT",                         # Spieler / Coach
        "nickname": "TEXT",
        "role": "TEXT",
        "unit": "TEXT",
        "tab": "TEXT",                          # Tabellenblatt (gid)
        "raw": "TEXT",
        "player_id": "INTEGER",
        "status": "TEXT DEFAULT 'aktiv'",       # aktiv / entfernt
        "first_seen": "TEXT",
        "last_change": "TEXT",
    },
    "sheet_log": {
        "time": "TEXT",
        "action": "TEXT",                       # neu / geändert / entfernt / wieder da
        "name": "TEXT",
        "details": "TEXT",
    },
    "members": {                                # Mitgliederverwaltung
        "first_name": "TEXT",
        "last_name": "TEXT",
        "member_type": "TEXT DEFAULT 'Spieler'",   # Spieler / Trainer / Vorstand / Helfer / Fotograf / Förderer
        "status": "TEXT DEFAULT 'Aktiv'",          # Aktiv / Passiv / Probetraining / Ausgetreten
        "birthdate": "TEXT",
        "email": "TEXT",
        "phone": "TEXT",
        "street": "TEXT",
        "zip": "TEXT",
        "city": "TEXT",
        "member_since": "TEXT",
        "exit_date": "TEXT",
        "emergency_contact": "TEXT",
        "equipment": "TEXT",
        "consent_photo": "INTEGER DEFAULT 0",
        "player_id": "INTEGER",
        "user_id": "INTEGER",
        "notes": "TEXT",
    },
    "transactions": {                           # Finanzen: Einnahmen und Ausgaben
        "date": "TEXT",
        "kind": "TEXT DEFAULT 'Ausgabe'",          # Einnahme / Ausgabe
        "category": "TEXT",
        "description": "TEXT",
        "amount": "REAL",
        "sponsor_id": "INTEGER",
        "member_id": "INTEGER",
        "receipt": "TEXT",
        "paid_by": "TEXT",
        "status": "TEXT DEFAULT 'Erledigt'",       # Offen / Erledigt
        "notes": "TEXT",
    },
    "media": {
        "path": "TEXT",
        "name": "TEXT",
        "tags": "TEXT",
        "created": "TEXT",
    },
    "magazines": {                              # Stadionheft: ein Eintrag pro Ausgabe
        "season": "TEXT",
        "number": "TEXT",                          # z. B. 1 von 4
        "title": "TEXT DEFAULT 'Tigers Inteam'",
        "game_id": "INTEGER",
        "status": "TEXT DEFAULT 'Planung'",        # Planung / In Arbeit / Im Druck / Fertig
        "deadline": "TEXT",                        # Redaktionsschluss
        "print_date": "TEXT",                      # Druckabgabe
        "pages_target": "INTEGER",
        "canva_url": "TEXT",
        "files": "TEXT",                           # JSON-Liste wie bei sponsors.files
        "notes": "TEXT",
        "sponsor_ids": "TEXT",                     # JSON-Liste der Sponsoren in diesem Heft
    },
    "magazine_pages": {                         # Beiträge eines Stadionhefts (Vorwort, Behind the Helmet, ...)
        "magazine_id": "INTEGER",
        "page": "INTEGER",
        "section": "TEXT",                         # Cover / Vorwort / Anzeige / Kader / Spielbericht ...
        "title": "TEXT",
        "owner": "TEXT",
        "status": "TEXT DEFAULT 'Offen'",          # Offen / Text da / Bilder da / Fertig in Canva
        "sponsor_id": "INTEGER",
        "player_id": "INTEGER",
        "game_id": "INTEGER",
        "opponent_id": "INTEGER",
        "text": "TEXT",
        "files": "TEXT",
        "notes": "TEXT",
        "author": "TEXT",                          # Vorwort: wer schreibt
        "role": "TEXT",                            # Vorwort: Funktion
        "image": "TEXT",
        "answers": "TEXT",                         # Behind the Helmet: JSON {Frage: Antwort}
    },
    "contact_requests": {                       # Anfragen über das Kontaktformular der Webseite
        "name": "TEXT",
        "email": "TEXT",
        "phone": "TEXT",
        "message": "TEXT",
        "source": "TEXT",                          # z. B. Probetraining
        "status": "TEXT DEFAULT 'Neu'",            # Neu / In Bearbeitung / Erledigt
        "created": "TEXT",
        "notes": "TEXT",
    },
    "apparel": {                                # Teamkleidung: ein Eintrag pro Artikel, z. B. Hoodie 2027
        "name": "TEXT",
        "description": "TEXT",
        "image": "TEXT",
        "price": "REAL",
        "deadline": "TEXT",                        # Bestellschluss (an dem Tag noch offen)
        "active": "INTEGER DEFAULT 1",
        "show_list": "INTEGER DEFAULT 1",          # Bestellungen auf der öffentlichen Seite zeigen
        "fields": "TEXT",                          # JSON-Liste [{key, label, type, options, required, internal}]
        "public_token": "TEXT",                    # geheimer Teil des Bestell-Links, nur vom Server vergeben
        "notes": "TEXT",
    },
    "apparel_orders": {
        "apparel_id": "INTEGER",
        "data": "TEXT",                            # JSON {Feld-Key: Wert}
        "quantity": "INTEGER DEFAULT 1",
        "paid": "INTEGER DEFAULT 0",
        "source": "TEXT",                          # Link / Hub
        "created": "TEXT",
        "notes": "TEXT",
        "booked_tx": "INTEGER",                    # nur Server: Buchung in den Finanzen (Sammelbuchung)
    },
}

DEFAULT_SETTINGS = {
    "club_name": "Emden Tigers",
    "club_short": "TIGERS",
    "instagram": "afc_tigers_emden",
    "color_primary": "#B3121D",
    "color_dark": "#0B0B0B",
    "color_light": "#FFFFFF",
    "logo": "",
    "crest": "",
    "home_location": "Sportplatz SV Amisia Wolthusen",
    "home_city": "Emden",
    "entry_fee": "3",
    "season": "2027",
    "card_price": "25",
    "card_share_wolthusen": "12",
    "default_hashtags": "#emdentigers #americanfootball #emden #ostfriesland",
    "training_text": "Dienstag 20:30 bis 22:00 Uhr und Donnerstag 19:00 bis 21:00 Uhr auf dem Kunstrasen Eintracht Emden, Pillauer Str. 12",
    "font_headline": "Impact, 'Arial Black', 'Franklin Gothic Heavy', sans-serif",
    "font_text": "'Segoe UI', Arial, sans-serif",
    "sheet_url": "https://docs.google.com/spreadsheets/d/1EIwh-1GKXpF9medgNQx-LT55Tm9CHcLwscDa93l6WY8/edit?usp=sharing",
    "sheet_interval": "5",
    "sheet_gids": "0",
    "sheet_update_kader": "1",
    "sheet_last_sync": "",
    "sheet_last_error": "",
    "media_tasks": "Feldrand / Live-Storys\nFotos\nMedienzelt / Livestream\nVideo / Clips",
    # Öffentliche Webseite (Einstellungen > Webseite). Leere Texte erscheinen dort als markierter Platzhalter.
    "site_hero_title": "",
    "site_hero_text": "American Football aus Emden. Wir sind die Tigers: ein Team aus Ostfriesland mit Herzblut, Teamgeist und richtig Lust auf Football.",
    "site_about": "Die Emden Tigers sind die American-Football-Sparte des SV Amisia Stern Wolthusen. Bei uns stehen Menschen aus Emden "
                  "und ganz Ostfriesland gemeinsam auf dem Feld, mit ganz unterschiedlichen Geschichten, Berufen und Erfahrungen. "
                  "Was uns verbindet, ist die Leidenschaft für den Sport und der Zusammenhalt im Team.\n\n"
                  "Neben unseren Herren spielen bei der Next Generation Kinder und Jugendliche Flag Football. Auf dem Feld geben wir alles, "
                  "daneben sind wir eine große Familie aus Spielern, Coaches, Helfern und Fans.",
    "site_training_times": "Dienstag 20:30 bis 22:00 Uhr\nDonnerstag 19:00 bis 21:00 Uhr",
    "site_training_place": "Kunstrasen Eintracht Emden JFV e. V.",
    "site_training_address": "Pillauer Str. 12, 26725 Emden",
    "site_trial_text": "Du willst Football ausprobieren? Dann komm einfach zu einem Training vorbei. Für den Anfang reichen Sportkleidung, "
                       "Fußball- oder Turnschuhe und etwas zu trinken. Am besten schreibst du uns vorher kurz über das Formular, "
                       "dann wissen wir Bescheid und nehmen dich am Platz in Empfang.",
    "site_home_address": "",
    "site_gameday_text": "An Heimspieltagen freuen wir uns über jede Unterstützung an der Seitenlinie. Bring Familie und Freunde mit, "
                         "feuer die Tigers an und erlebe American Football aus nächster Nähe. Aktuelle Infos zum Spieltag findest du vorher auf Instagram.",
    "site_card_short": "Unterstütze die Tigers eine ganze Saison lang und zeig, dass du hinter dem Team stehst.",
    "site_card_text": "Mit der Supporter Karte unterstützt du die Emden Tigers eine ganze Saison lang und zeigst, dass du hinter dem Team stehst. "
                      "Alle Infos zur Karte bekommst du bei uns über das Kontaktformular oder per Nachricht auf Instagram.",
    "site_sponsor_text": "Ohne unsere Partner wäre Football in Emden nicht möglich. Sie machen Trainingsbetrieb, Ausrüstung und Spieltage erst möglich. "
                         "Du möchtest die Tigers mit deinem Unternehmen unterstützen? Wir stellen gern ein Paket zusammen, das zu dir passt, "
                         "vom Spieltagssponsor bis zum Trikotsponsor. Schreib uns einfach über das Kontaktformular.",
    "site_contact_email": "",
    "site_youth_text": "Flag Football ist die kontaktlose Variante des American Football. Statt zu tackeln, ziehen die Spieler dem ballführenden "
                       "Gegner ein Fähnchen vom Gürtel. So lernen Kinder und Jugendliche Werfen, Fangen, Laufen und Taktik, ganz ohne harte "
                       "Zweikämpfe und ohne schwere Ausrüstung.\n\nBei der Next Generation der Emden Tigers stehen Spaß, Bewegung und Teamgeist "
                       "an erster Stelle. Vorkenntnisse braucht niemand, Mädchen und Jungen sind gleichermaßen willkommen.",
    "site_youth_ages": "",
    "site_youth_training_times": "",
    "site_youth_training_place": "",
}
SITE_TEXTS_VERSION = "1"   # erhöhen, wenn neue Standardtexte in leere Felder bestehender Server übernommen werden sollen


DB_LOCK = threading.RLock()   # exklusiv beim Einspielen eines Backups


# ---------------------------------------------------------------------------
# Bereiche und Rechte
# Stufen: 0 = kein Zugriff, 1 = Lesen, 2 = Bearbeiten. Admins dürfen alles.
# ---------------------------------------------------------------------------
AREAS = {"medien": "Medien", "verein": "Verein", "mitglieder": "Mitglieder", "finanzen": "Finanzen"}
TABLE_AREA = {
    "posts": "medien", "media": "medien", "sheet_players": "medien", "sheet_log": "medien",
    "media_team": "medien", "assignments": "medien", "magazines": "medien", "magazine_pages": "medien", "story_rules": "medien",
    "games": "verein", "opponents": "verein", "players": "verein", "sponsors": "verein",
    "members": "mitglieder", "contact_requests": "mitglieder",
    "supporter_cards": "finanzen", "transactions": "finanzen",
    "apparel": "verein", "apparel_orders": "verein",
}
# Tabellen, die mehrere Bereiche verwalten dürfen: es zählt das höchste Recht dieser Bereiche
TABLE_AREAS_ANY = {
    "apparel": ("verein", "finanzen", "medien"),
    "apparel_orders": ("verein", "finanzen", "medien"),
}
# Nachschlage-Tabellen: lesbar für alle, die irgendeinen Bereich sehen (z. B. Spielplan für Captions)
SHARED_READ = {"games", "opponents", "players", "sponsors", "media"}
# Felder, die nur mit Finanz-Leserecht sichtbar sind
FINANCE_FIELDS = {"sponsors": ("amount",)}
# Felder, die nur mit Leserecht im eigenen Bereich sichtbar sind (nicht über SHARED_READ)
AREA_FIELDS = {"sponsors": ("files",)}
# Felder, die nur der Server setzt (beim Speichern über die API verworfen)
SERVER_FIELDS = {"posts": ("publish_state", "publish_log", "published_at"), "story_rules": ("last_run", "last_result"),
                 "apparel_orders": ("booked_tx",)}
# Dateien aus data/media, die der Browser direkt anzeigen darf. Alles andere wird als Download ausgeliefert.
MEDIA_INLINE = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".mp4", ".mov", ".webm"}

DEFAULT_GROUPS = [
    ("Vorstand", "Vorstand und Abteilungsleitung", {"medien": 2, "verein": 2, "mitglieder": 2, "finanzen": 2}),
    ("Trainer", "Coaching Staff", {"medien": 1, "verein": 2, "mitglieder": 1, "finanzen": 0}),
    ("Media Team", "Social Media, Livestream, Design", {"medien": 2, "verein": 1, "mitglieder": 0, "finanzen": 0}),
    ("Fotografen", "Fotos und Videos", {"medien": 2, "verein": 1, "mitglieder": 0, "finanzen": 0}),
    ("Helfer", "Helfer am Spieltag", {"medien": 0, "verein": 1, "mitglieder": 0, "finanzen": 0}),
    ("Spieler", "Alle Spieler", {"medien": 0, "verein": 1, "mitglieder": 0, "finanzen": 0}),
]


@contextlib.contextmanager
def db():
    """Verbindung öffnen, am Ende committen (bzw. bei Fehler zurückrollen) und schließen."""
    with DB_LOCK:
        conn = sqlite3.connect(DB_PATH, timeout=15)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 15000")
        try:
            with conn:
                yield conn
        finally:
            conn.close()


def init_db():
    DATA.mkdir(parents=True, exist_ok=True)
    MEDIA.mkdir(exist_ok=True)
    BACKUPS.mkdir(exist_ok=True)
    with db() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        # Benutzer und Sitzungen: bewusst NICHT in TABLES, damit sie nie über die allgemeine API erreichbar sind
        conn.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE COLLATE NOCASE, "
                     "pw_hash TEXT, role TEXT DEFAULT 'user', created_at TEXT, last_login TEXT)")
        conn.execute("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER, expires REAL, "
                     "created_at TEXT, ip TEXT, user_agent TEXT)")
        ucols = {r["name"] for r in conn.execute("PRAGMA table_info(users)")}
        for c, t in (("display_name", "TEXT"), ("email", "TEXT"), ("is_admin", "INTEGER DEFAULT 0"), ("active", "INTEGER DEFAULT 1"),
                     ("member_id", "INTEGER"), ("invite_hash", "TEXT"), ("invite_expires", "REAL"), ("notify", "TEXT"),
                     ("reset_hash", "TEXT"), ("reset_expires", "REAL")):
            if c not in ucols:
                conn.execute(f"ALTER TABLE users ADD COLUMN {c} {t}")
        if "role" in ucols:
            conn.execute("UPDATE users SET is_admin=1 WHERE role='admin' AND (is_admin IS NULL OR is_admin=0)")
        conn.execute("CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE COLLATE NOCASE, "
                     "description TEXT, sort INTEGER DEFAULT 0)")
        conn.execute("CREATE TABLE IF NOT EXISTS group_perms (group_id INTEGER, area TEXT, level INTEGER, PRIMARY KEY (group_id, area))")
        conn.execute("CREATE TABLE IF NOT EXISTS user_groups (user_id INTEGER, group_id INTEGER, PRIMARY KEY (user_id, group_id))")
        conn.execute("CREATE TABLE IF NOT EXISTS user_perms (user_id INTEGER, area TEXT, level INTEGER, PRIMARY KEY (user_id, area))")
        # Zugangsdaten für Facebook/Instagram: nie über die API lesbar, nicht im Backup-Download
        conn.execute("CREATE TABLE IF NOT EXISTS secrets (key TEXT PRIMARY KEY, value TEXT)")
        # Änderungsprotokoll: nur für Admins lesbar, nicht über die allgemeine API
        conn.execute("CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT, user_id INTEGER, user_name TEXT, "
                     "action TEXT, table_name TEXT, record_id INTEGER, label TEXT, details TEXT)")
        conn.execute("CREATE INDEX IF NOT EXISTS audit_time ON audit_log (time)")
        # Bereits verschickte Erinnerungen (jede nur einmal)
        conn.execute("CREATE TABLE IF NOT EXISTS notify_sent (key TEXT PRIMARY KEY, time TEXT)")
        if conn.execute("SELECT COUNT(*) FROM groups").fetchone()[0] == 0:
            for i, (name, desc, perms) in enumerate(DEFAULT_GROUPS):
                gid = conn.execute("INSERT INTO groups (name, description, sort) VALUES (?, ?, ?)", (name, desc, i)).lastrowid
                for area, lvl in perms.items():
                    conn.execute("INSERT INTO group_perms (group_id, area, level) VALUES (?, ?, ?)", (gid, area, lvl))
        for table, cols in TABLES.items():
            col_sql = ", ".join(f'"{c}" {t}' for c, t in cols.items())
            conn.execute(
                f'CREATE TABLE IF NOT EXISTS "{table}" '
                f"(id INTEGER PRIMARY KEY AUTOINCREMENT, {col_sql}, "
                f"created_at TEXT, updated_at TEXT)"
            )
            existing = {r["name"] for r in conn.execute(f'PRAGMA table_info("{table}")')}
            for c, t in cols.items():
                if c not in existing:
                    conn.execute(f'ALTER TABLE "{table}" ADD COLUMN "{c}" {t}')
        conn.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
        for k, v in DEFAULT_SETTINGS.items():
            conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v))
        # Webseiten-Texte: neue Standardtexte einmalig in noch leere Felder übernehmen (eigene Texte bleiben unberührt)
        if get_setting(conn, "site_texts_version") != SITE_TEXTS_VERSION:
            for k, v in DEFAULT_SETTINGS.items():
                if k.startswith("site_") and v:
                    conn.execute("UPDATE settings SET value=? WHERE key=? AND TRIM(IFNULL(value,''))=''", (v, k))
            set_setting(conn, "site_texts_version", SITE_TEXTS_VERSION)
        # Coaches-Blatt gibt es nicht mehr: alles steht im Blatt "Spieler"
        conn.execute("UPDATE settings SET value='0' WHERE key='sheet_gids' AND value='0,1'")


def row_dict(r):
    return {k: r[k] for k in r.keys()}


def clean_values(table, data):
    cols = TABLES[table]
    out = {}
    for k, v in data.items():
        if k not in cols:
            continue
        if isinstance(v, bool):
            v = int(v)
        if v == "" and ("INTEGER" in cols[k] or "REAL" in cols[k]):
            v = None
        out[k] = v
    return out


# ---------------------------------------------------------------------------
# Benutzer, Passwörter, Sitzungen
# ---------------------------------------------------------------------------
def hash_pw(pw):
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(pw.encode("utf-8"), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${h.hex()}"


def check_pw(pw, stored):
    try:
        algo, salt, h = (stored or "").split("$")
        if algo != "scrypt":
            return False
        calc = hashlib.scrypt(pw.encode("utf-8"), salt=bytes.fromhex(salt), n=2 ** 14, r=8, p=1, dklen=32)
        return hmac.compare_digest(calc.hex(), h)
    except Exception:  # noqa
        return False


def pw_problem(pw):
    if len(pw or "") < 10:
        return "Das Passwort muss mindestens 10 Zeichen lang sein."
    return ""


def token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def user_count():
    with db() as conn:
        return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]


def check_username(username):
    username = (username or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9._@-]{2,40}", username):
        raise ValueError("Benutzername: 2 bis 40 Zeichen, nur Buchstaben, Zahlen und . _ - @")
    return username


def create_user(username, password=None, is_admin=False, display_name="", email="", member_id=None):
    """Legt ein Konto an. Ohne Passwort entsteht ein Einladungslink (Rückgabe: Token)."""
    username = check_username(username)
    if password is not None:
        prob = pw_problem(password)
        if prob:
            raise ValueError(prob)
    now = datetime.now().isoformat(timespec="seconds")
    invite = None if password is not None else secrets.token_urlsafe(24)
    with db() as conn:
        if conn.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone():
            raise ValueError("Diesen Benutzernamen gibt es schon.")
        uid = conn.execute(
            "INSERT INTO users (username, pw_hash, is_admin, active, display_name, email, member_id, invite_hash, invite_expires, created_at) "
            "VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)",
            (username, hash_pw(password) if password is not None else "", 1 if is_admin else 0, display_name or username,
             email or "", member_id, token_hash(invite) if invite else None,
             time.time() + INVITE_DAYS * 86400 if invite else None, now)).lastrowid
        if member_id:
            conn.execute("UPDATE members SET user_id=? WHERE id=?", (uid, member_id))
    return uid, invite


INVITE_DAYS = 14


def new_invite(conn, uid):
    tok = secrets.token_urlsafe(24)
    conn.execute("UPDATE users SET invite_hash=?, invite_expires=? WHERE id=?", (token_hash(tok), time.time() + INVITE_DAYS * 86400, uid))
    return tok


def effective_perms(conn, user):
    """Rechte je Bereich: Ausnahme der Person, sonst das Maximum ihrer Gruppen."""
    if user.get("is_admin"):
        return {a: 2 for a in AREAS}
    perms = {a: 0 for a in AREAS}
    for r in conn.execute("SELECT gp.area, MAX(gp.level) AS lvl FROM user_groups ug JOIN group_perms gp ON gp.group_id = ug.group_id "
                          "WHERE ug.user_id=? GROUP BY gp.area", (user["id"],)):
        if r["area"] in perms:
            perms[r["area"]] = int(r["lvl"] or 0)
    for r in conn.execute("SELECT area, level FROM user_perms WHERE user_id=?", (user["id"],)):
        if r["area"] in perms and r["level"] is not None:
            perms[r["area"]] = int(r["level"])
    return perms


def admin_count(conn):
    return conn.execute("SELECT COUNT(*) FROM users WHERE is_admin=1 AND active=1").fetchone()[0]


def bootstrap_admin():
    user = (ENV("TMH_ADMIN_USER") or "").strip()
    pw = ENV("TMH_ADMIN_PASSWORD") or ""
    if not user or not pw:
        return
    with db() as conn:
        row = conn.execute("SELECT id FROM users WHERE username=?", (user,)).fetchone()
        if row and ENV("TMH_RESET_PASSWORD") == "1":
            conn.execute("UPDATE users SET pw_hash=?, is_admin=1, active=1 WHERE id=?", (hash_pw(pw), row["id"]))
            conn.execute("DELETE FROM sessions WHERE user_id=?", (row["id"],))
            print(f"Passwort für {user} wurde zurückgesetzt.")
            return
        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
            return
    try:
        create_user(user, pw, is_admin=True)
        print(f"Admin-Benutzer {user} wurde angelegt.")
    except ValueError as e:
        print("Admin-Benutzer konnte nicht angelegt werden:", e)


FAILED_LOGINS = {}
FAILED_LOCK = threading.Lock()


def login_blocked(ip):
    with FAILED_LOCK:
        now = time.time()
        hits = [t for t in FAILED_LOGINS.get(ip, []) if now - t < 600]
        FAILED_LOGINS[ip] = hits
        return len(hits) >= 8


def login_failed(ip):
    with FAILED_LOCK:
        FAILED_LOGINS.setdefault(ip, []).append(time.time())


# ---------------------------------------------------------------------------
# Passwort vergessen: Link per E-Mail (60 Minuten gültig, nur einmal, nur der Hash wird gespeichert)
# ---------------------------------------------------------------------------
RESET_MINUTES = 60
RESET_HITS = {}          # "ip:..." bzw. "user:..." -> Zeitpunkte der Anfragen
RESET_LIMITS = {"ip": 10, "user": 3}   # pro Stunde


def reset_rate_ok(kind, key):
    with FAILED_LOCK:
        now = time.time()
        k = f"{kind}:{key}"
        hits = [t for t in RESET_HITS.get(k, []) if now - t < 3600]
        ok = len(hits) < RESET_LIMITS[kind]
        if ok:
            hits.append(now)
        RESET_HITS[k] = hits
        return ok


def account_email(conn, u):
    """E-Mail des Kontos, sonst die des verknüpften Mitglieds."""
    if u["email"]:
        return u["email"]
    if u["member_id"]:
        m = conn.execute("SELECT email FROM members WHERE id=?", (u["member_id"],)).fetchone()
        return (m["email"] or "").strip() if m else ""
    return ""


def request_password_reset(login, base_url):
    """Sucht das Konto zu Benutzername oder E-Mail und schickt den Link. Gibt nach außen nie preis, ob es das Konto gibt."""
    login = (login or "").strip()
    if not login:
        return
    with db() as conn:
        u = conn.execute("SELECT * FROM users WHERE active=1 AND username=? COLLATE NOCASE", (login,)).fetchone()
        if not u and "@" in login:
            u = conn.execute("SELECT * FROM users WHERE active=1 AND lower(email)=lower(?)", (login,)).fetchone() or conn.execute(
                "SELECT u.* FROM users u JOIN members m ON m.id = u.member_id WHERE u.active=1 AND lower(m.email)=lower(?)", (login,)).fetchone()
        if not u:
            return
        email = account_email(conn, u)
        if not email or not reset_rate_ok("user", u["id"]):
            return
        tok = secrets.token_urlsafe(32)
        conn.execute("UPDATE users SET reset_hash=?, reset_expires=? WHERE id=?", (token_hash(tok), time.time() + RESET_MINUTES * 60, u["id"]))
        audit(conn, "Passwort vergessen", "Link angefordert", "users", u["id"], u["display_name"] or u["username"])
    cfg = smtp_config()
    if not cfg["smtp_host"]:
        return
    link = f"{cfg['hub_url'] or base_url}/passwort-neu/{tok}"
    body = (f"Hallo {u['display_name'] or u['username']},\n\nfür dein Konto im Emden Tigers Hub (Benutzername: {u['username']}) wurde ein neues Passwort angefordert.\n"
            f"Über diesen Link legst du es fest. Er gilt {RESET_MINUTES} Minuten und funktioniert nur einmal:\n\n{link}\n\n"
            "Wenn du das nicht warst, ignoriere diese Mail einfach. Dein bisheriges Passwort bleibt dann gültig.")
    threading.Thread(target=lambda: send_mail(cfg, email, "Tigers Hub: Passwort zurücksetzen", body, footer=False), daemon=True).start()


# ---------------------------------------------------------------------------
# Teamkleidung: öffentlicher Bestell-Link (ohne Anmeldung)
# ---------------------------------------------------------------------------
ORDER_HITS = {}          # IP -> Zeitpunkte der letzten öffentlichen Bestellungen
ORDER_LIMIT = 60         # Versuche pro Stunde und IP (großzügig, weil ein Team oft über dasselbe WLAN bestellt)
AP_FIELD_TYPES = {"text", "number", "select", "check"}


def order_rate_ok(ip):
    with FAILED_LOCK:
        now = time.time()
        hits = [t for t in ORDER_HITS.get(ip, []) if now - t < 3600]
        ok = len(hits) < ORDER_LIMIT
        if ok:
            hits.append(now)
        ORDER_HITS[ip] = hits
        return ok


def apparel_fields(a):
    try:
        fields = json.loads(a["fields"] or "[]")
    except ValueError:
        return []
    return [f for f in fields if isinstance(f, dict) and f.get("key") and f.get("type") in AP_FIELD_TYPES]


def apparel_open(a):
    return bool(a["active"]) and (not a["deadline"] or datetime.now().strftime("%Y-%m-%d") <= a["deadline"])


def clean_order(fields, data, qty):
    """Prüft eine Bestellung vom öffentlichen Link. Liefert (werte, menge, fehler)."""
    if not isinstance(data, dict):
        return None, None, "Ungültige Bestellung."
    out = {}
    for f in fields:
        label, t, v = f.get("label") or "Feld", f["type"], data.get(f["key"])
        if t == "check":
            v = 1 if v in (True, 1, "1", "true", "on") else 0
        else:
            v = str(v if v is not None else "").strip()[:200]
            if t == "select" and v and v not in (f.get("options") or []):
                return None, None, f"Ungültige Auswahl bei {label}."
            if t == "number" and v and not re.fullmatch(r"\d{1,6}", v):
                return None, None, f"{label}: bitte nur Ziffern eintragen."
        if f.get("required") and not v:
            return None, None, f"Bitte {label} ausfüllen."
        out[f["key"]] = v
    try:
        qty = int(qty)
    except (TypeError, ValueError):
        qty = 0
    if not 1 <= qty <= 20:
        return None, None, "Die Menge muss zwischen 1 und 20 liegen."
    return out, qty, None


# ---------------------------------------------------------------------------
# Automatisch posten: Facebook-Seite und Instagram über die Meta Graph API
# Das Seiten-Token liegt in der Tabelle secrets (nie über die API lesbar, nicht im Backup-Download).
# Instagram holt Bilder selbst ab, dafür gibt es signierte Links /teilen/<sig>/<datei> (nur Bilder).
# ---------------------------------------------------------------------------
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("image/webp", ".webp")   # fehlt in manchen Systemen (Webseite, Instagram-Bilder)
GRAPH = ENV("TMH_GRAPH_URL") or "https://graph.facebook.com/v26.0"   # Variable nur für lokale Tests mit einem Test-Server
SOCIAL_LOCK = threading.Lock()
POST_LATE_HOURS = 24        # freigegebene Posts, die länger überfällig sind, werden nicht mehr nachgeholt
STORY_LATE_MINUTES = 180    # Story-Regeln: so lange nach der geplanten Uhrzeit wird noch gepostet (z. B. nach Neustart)
SHARE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
VIDEO_EXT = {".mp4", ".mov"}


class GraphError(Exception):
    pass


def secret_get(conn, key):
    r = conn.execute("SELECT value FROM secrets WHERE key=?", (key,)).fetchone()
    return r["value"] if r and r["value"] is not None else ""


def secret_set(conn, key, value):
    conn.execute("INSERT OR REPLACE INTO secrets (key, value) VALUES (?, ?)", (key, value))


def social_config():
    with db() as conn:
        cfg = {k: secret_get(conn, k) for k in ("fb_token", "fb_page_id", "fb_page_name", "ig_user_id", "ig_username", "public_url", "share_key")}
        if not cfg["share_key"]:
            cfg["share_key"] = secrets.token_hex(32)
            secret_set(conn, "share_key", cfg["share_key"])
    cfg["public_url"] = (cfg["public_url"] or SITE_URL).rstrip("/")
    return cfg


# ---------------------------------------------------------------------------
# Öffentliche Daten für die Webseite (/api/public und die Seiten unter /).
# Nur hier definierte Felder gehen raus, jede Antwort wird Feld für Feld neu gebaut.
# Nie: Finanzen, Mitglieder, Kontakte, Konten, Notizen, interne Dateien.
# ---------------------------------------------------------------------------
PUBLIC_SETTINGS = ("club_name", "club_short", "season", "instagram", "home_location", "home_city", "entry_fee", "card_price", "training_text",
                   *(k for k in DEFAULT_SETTINGS if k.startswith("site_")))


def public_image(path, key):
    """Signierter Link auf ein einzelnes Bild aus data/media (sonst leer)."""
    name = (path or "").rsplit("/", 1)[-1]
    if not (path or "").startswith("/media/") or Path(name).suffix.lower() not in IMAGE_EXT or not (MEDIA / name).is_file():
        return ""
    return f"/teilen/{share_sig(key, name)}/{name}"


def public_info():
    with db() as conn:
        return {k: get_setting(conn, k) for k in PUBLIC_SETTINGS}


def public_games():
    key = social_config()["share_key"]
    with db() as conn:
        home_loc = get_setting(conn, "home_location")
        opp = {r["id"]: r for r in conn.execute("SELECT * FROM opponents")}
        spon = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM sponsors WHERE active=1")}
        rows = conn.execute("SELECT * FROM games WHERE IFNULL(date,'') != '' ORDER BY date, time").fetchall()
    out = []
    for g in rows:
        o = opp.get(g["opponent_id"])
        played = g["score_us"] not in (None, "") and g["score_them"] not in (None, "")
        out.append({
            "team": g["team"] if g["team"] in TEAMS else "Herren", "season": g["season"] or "", "date": g["date"], "time": g["time"] or "", "home": bool(g["home"]), "kind": g["kind"] or "",
            "league": g["league"] or "", "location": g["location"] or (home_loc if g["home"] else ""),
            "opponent": {"name": o["name"] or "", "short": o["short"] or "", "city": o["city"] or "", "logo": public_image(o["logo"], key)} if o else None,
            "score_us": g["score_us"] if played else None, "score_them": g["score_them"] if played else None,
            "sponsor": spon.get(g["sponsor_id"], ""),
        })
    return out


def public_team():
    """Alle aktiven Spieler und Coaches; Foto nur mit Einwilligung (players.consent).
    Next Generation (Kinder und Jugendliche): nur Coaches und Staff, keine Spieler."""
    key = social_config()["share_key"]
    with db() as conn:
        rows = conn.execute("SELECT * FROM players WHERE active=1").fetchall()
    out = []
    for p in rows:
        team = p["team"] if p["team"] in TEAMS else "Herren"
        if team == YOUTH_TEAM and (p["kind"] or "Spieler") == "Spieler":
            continue
        out.append({
            "team": team, "kind": p["kind"] or "Spieler", "first_name": p["first_name"] or "", "last_name": p["last_name"] or "",
            "number": p["number"] or "", "position": p["position"] or "", "unit": p["unit"] or "", "role": p["role"] or "",
            "photo": public_image(p["photo"], key) if p["consent"] else "",
        })
    return out


def public_sponsors():
    key = social_config()["share_key"]
    with db() as conn:
        rows = conn.execute("SELECT * FROM sponsors WHERE active=1 ORDER BY name COLLATE NOCASE").fetchall()
    out = []
    for s in rows:
        web = (s["website"] or "").strip()
        if web and not web.startswith(("http://", "https://")):
            web = "https://" + web
        out.append({"name": s["name"] or "", "package": s["package"] or "", "website": web if re.fullmatch(r"https?://[^\s\"'<>]+", web) else "",
                    "instagram": (s["instagram"] or "").strip().lstrip("@"), "logo": public_image(s["logo"], key)})
    return out


def share_sig(key, name):
    return hmac.new(key.encode(), name.encode(), hashlib.sha256).hexdigest()[:40]


def graph(method, path, params=None, token=None, files=None):
    """Aufruf der Graph API. files: {feld: (dateiname, bytes, mime)} wird als multipart gesendet."""
    url = f"{GRAPH}/{path.lstrip('/')}"
    params = {k: v for k, v in (params or {}).items() if v is not None}
    if token:
        params["access_token"] = token
    if method == "GET":
        req = urllib.request.Request(url + "?" + urlencode(params))
    elif files:
        b = uuid.uuid4().hex
        body = io.BytesIO()
        for k, v in params.items():
            body.write(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n'.encode() + str(v).encode() + b"\r\n")
        for k, (fname, data, mime) in files.items():
            body.write(f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{fname}"\r\nContent-Type: {mime}\r\n\r\n'.encode())
            body.write(data + b"\r\n")
        body.write(f"--{b}--\r\n".encode())
        req = urllib.request.Request(url, data=body.getvalue(), method="POST", headers={"Content-Type": f"multipart/form-data; boundary={b}"})
    else:
        req = urllib.request.Request(url, data=urlencode(params).encode(), method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read().decode("utf-8")).get("error", {}).get("message")
        except ValueError:
            msg = None
        raise GraphError(msg or f"Meta antwortet mit Fehler {e.code}")
    except urllib.error.URLError as e:
        raise GraphError(f"Keine Verbindung zu Meta ({e.reason})")


def social_connect(token, public_url):
    """Prüft das Seiten-Token und liest Seite und verknüpftes Instagram-Konto aus."""
    me = graph("GET", "me", {"fields": "id,name"}, token)
    page = graph("GET", me["id"], {"fields": "id,name,instagram_business_account{id,username}"}, token)
    ig = page.get("instagram_business_account") or {}
    with db() as conn:
        secret_set(conn, "fb_token", token)
        secret_set(conn, "fb_page_id", page["id"])
        secret_set(conn, "fb_page_name", page.get("name", ""))
        secret_set(conn, "ig_user_id", ig.get("id", ""))
        secret_set(conn, "ig_username", ig.get("username", ""))
        secret_set(conn, "public_url", (public_url or "").strip().rstrip("/"))
    return {"page": page.get("name", ""), "instagram": ig.get("username", "")}


def media_bytes(path):
    """/media/datei.png -> (name, bytes, mime) oder Fehler."""
    name = (path or "").rsplit("/", 1)[-1]
    f = MEDIA / name
    if not path or not path.startswith("/media/") or not f.is_file():
        raise GraphError("Das Bild wurde nicht gefunden.")
    return name, f.read_bytes(), mimetypes.guess_type(name)[0] or "application/octet-stream"


def check_media(kind, image, media):
    """Prüft, ob die Dateien zum Format passen. kind: feed / story / carousel / reel."""
    ext = lambda p: Path(p or "").suffix.lower()
    if kind == "story" and not image:
        raise GraphError("Für eine Story wird ein Bild gebraucht.")
    if kind == "carousel":
        imgs = [m for m in media if ext(m) in IMAGE_EXT]
        if not 2 <= len(imgs) <= 10 or len(imgs) != len(media):
            raise GraphError("Ein Karussell braucht 2 bis 10 Bilder (JPG oder PNG), keine anderen Dateien.")
    if kind == "reel":
        if len(media) != 1 or ext(media[0]) not in VIDEO_EXT:
            raise GraphError("Ein Reel braucht genau ein Video (MP4 oder MOV).")


def publish_facebook(cfg, kind, image, media, text):
    page, tok = cfg["fb_page_id"], cfg["fb_token"]
    if kind == "story":
        up = graph("POST", f"{page}/photos", {"published": "false"}, tok, {"source": media_bytes(image)})
        res = graph("POST", f"{page}/photo_stories", {"photo_id": up["id"]}, tok)
        return res.get("post_id") or res.get("id") or ""
    if kind == "carousel":   # Beitrag mit mehreren Bildern: erst unveröffentlicht hochladen, dann gemeinsam posten
        ids = [graph("POST", f"{page}/photos", {"published": "false"}, tok, {"source": media_bytes(m)})["id"] for m in media]
        params = {"message": text or "", **{f"attached_media[{i}]": json.dumps({"media_fbid": pid}) for i, pid in enumerate(ids)}}
        return graph("POST", f"{page}/feed", params, tok).get("id", "")
    if kind == "reel":       # Reels-API: Start, Video hochladen, Veröffentlichen
        name, data, _ = media_bytes(media[0])
        start = graph("POST", f"{page}/video_reels", {"upload_phase": "start"}, tok)
        req = urllib.request.Request(start["upload_url"], data=data, method="POST",
                                     headers={"Authorization": f"OAuth {tok}", "offset": "0", "file_size": str(len(data))})
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                json.loads(r.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            raise GraphError(f"Video-Upload fehlgeschlagen ({e.code})")
        except urllib.error.URLError as e:
            raise GraphError(f"Video-Upload fehlgeschlagen ({e.reason})")
        graph("POST", f"{page}/video_reels", {"upload_phase": "finish", "video_id": start["video_id"],
                                               "video_state": "PUBLISHED", "description": text or ""}, tok)
        return start["video_id"]
    if image:
        res = graph("POST", f"{page}/photos", {"caption": text or "", "published": "true"}, tok, {"source": media_bytes(image)})
        return res.get("post_id") or res.get("id") or ""
    return graph("POST", f"{page}/feed", {"message": text or ""}, tok).get("id", "")


def ig_wait(cfg, box_id, tries=20, delay=3):
    """Instagram verarbeitet Bilder/Videos erst, danach kann veröffentlicht werden."""
    for _ in range(tries):
        st = graph("GET", box_id, {"fields": "status_code"}, cfg["fb_token"]).get("status_code")
        if st == "FINISHED":
            return
        if st in ("ERROR", "EXPIRED"):
            raise GraphError("Instagram konnte die Datei nicht verarbeiten (JPG im Format 4:5, Storys 9:16, Reels MP4 hochkant klappen am sichersten).")
        time.sleep(delay)
    raise GraphError("Instagram hat die Datei nicht rechtzeitig verarbeitet. Bitte später „Jetzt posten“ versuchen.")


def publish_instagram(cfg, kind, image, media, text):
    if not cfg["ig_user_id"]:
        raise GraphError("Mit der Facebook-Seite ist kein Instagram-Business-Konto verknüpft.")
    if kind in ("feed", "story") and not image:
        raise GraphError("Instagram braucht ein Bild.")
    if not cfg["public_url"].startswith("https://"):
        raise GraphError("Für Instagram fehlt die öffentliche https-Adresse des Hubs (Auto-Posting > Verbindung).")
    ig, tok = cfg["ig_user_id"], cfg["fb_token"]

    def url(path):
        name = media_bytes(path)[0]
        if Path(name).suffix.lower() not in SHARE_EXT:
            raise GraphError("Instagram kann dieses Dateiformat nicht verarbeiten (Bilder JPG oder PNG, Videos MP4).")
        return f"{cfg['public_url']}/teilen/{share_sig(cfg['share_key'], name)}/{name}"

    if kind == "carousel":
        children = []
        for m in media:
            child = graph("POST", f"{ig}/media", {"image_url": url(m), "is_carousel_item": "true"}, tok)
            ig_wait(cfg, child["id"])
            children.append(child["id"])
        box = graph("POST", f"{ig}/media", {"media_type": "CAROUSEL", "children": ",".join(children), "caption": text or ""}, tok)
        ig_wait(cfg, box["id"])
    elif kind == "reel":
        box = graph("POST", f"{ig}/media", {"media_type": "REELS", "video_url": url(media[0]), "caption": text or ""}, tok)
        ig_wait(cfg, box["id"], tries=40, delay=10)   # Videos brauchen länger
    else:
        params = {"image_url": url(image), "media_type": "STORIES"} if kind == "story" else {"image_url": url(image), "caption": text or ""}
        box = graph("POST", f"{ig}/media", params, tok)
        ig_wait(cfg, box["id"])
    return graph("POST", f"{ig}/media_publish", {"creation_id": box["id"]}, tok).get("id", "")


def social_publish(cfg, kind, image, media, text, targets):
    """Postet auf alle Ziele. Liefert (zustand, protokoll, facebook_id)."""
    t = (targets or "Facebook").lower()
    jobs = [("Facebook", publish_facebook)] if "facebook" in t else []
    jobs += [("Instagram", publish_instagram)] if "instagram" in t else []
    if not jobs:
        return "fehler", "Kein Ziel ausgewählt.", ""
    try:
        check_media(kind, image, media)
    except GraphError as e:
        return "fehler", f"{datetime.now():%d.%m.%Y %H:%M} {e}", ""
    ok, log, fb_id = 0, [], ""
    for label, fn in jobs:
        try:
            rid = fn(cfg, kind, image, media, text)
            ok += 1
            log.append(f"{label}: gepostet")
            if label == "Facebook":
                fb_id = rid
        except GraphError as e:
            log.append(f"{label}: {e}")
        except Exception as e:  # noqa
            log.append(f"{label}: unerwarteter Fehler ({e})")
    state = "gepostet" if ok == len(jobs) else "teilweise" if ok else "fehler"
    return state, f"{datetime.now():%d.%m.%Y %H:%M} " + " | ".join(log), fb_id


POST_KIND = {"Feed": "feed", "Story": "story", "Karussell": "carousel", "Reel": "reel"}


def post_media(post):
    try:
        items = json.loads(post["media"] or "[]")
    except ValueError:
        items = []
    return [i["path"] for i in items if isinstance(i, dict) and i.get("path")]


def publish_post(cfg, post):
    fmt = post["format"] or "Feed"
    state, log, fb_id = social_publish(cfg, POST_KIND.get(fmt, "feed"), post["image"], post_media(post), post["caption"], post["targets"])
    now = datetime.now().isoformat(timespec="seconds")
    with db() as conn:
        conn.execute("UPDATE posts SET publish_state=?, publish_log=?, published_at=?, updated_at=? WHERE id=?",
                     (state, log, now if state != "fehler" else None, now, post["id"]))
        if state != "fehler":
            conn.execute("UPDATE posts SET status='Gepostet' WHERE id=?", (post["id"],))
            if fb_id and fmt != "Story":
                link = f"https://www.facebook.com/reel/{fb_id}" if fmt == "Reel" else f"https://www.facebook.com/{fb_id}"
                conn.execute("UPDATE posts SET posted_url=? WHERE id=? AND IFNULL(posted_url,'')=''", (link, post["id"]))
    return state, log


def publish_rule(cfg, rule):
    state, log, _ = social_publish(cfg, "story", rule["image"], [], "", rule["targets"])
    with db() as conn:
        conn.execute("UPDATE story_rules SET last_result=? WHERE id=?", (log, rule["id"]))
    return state, log


def social_tick():
    """Einmal pro Minute: fällige freigegebene Posts und Story-Regeln veröffentlichen (höchstens einmal)."""
    cfg = social_config()
    if not cfg["fb_token"]:
        return
    now = datetime.now()
    today, hm = now.strftime("%Y-%m-%d"), now.strftime("%H:%M")
    claimed_posts, claimed_rules, missed_posts, missed_rules = [], [], [], []
    with db() as conn:
        due = conn.execute("SELECT * FROM posts WHERE auto_publish=1 AND IFNULL(publish_state,'')='' AND IFNULL(date,'')!='' "
                           "AND (date < ? OR (date = ? AND IFNULL(NULLIF(time,''),'00:00') <= ?))", (today, today, hm)).fetchall()
        for p in due:
            planned = datetime.strptime(f"{p['date']} {(p['time'] or '00:00')[:5]}", "%Y-%m-%d %H:%M")
            if (now - planned).total_seconds() > POST_LATE_HOURS * 3600:
                log = f"{now:%d.%m.%Y %H:%M} Nicht gepostet: Zeitpunkt lag mehr als {POST_LATE_HOURS} Stunden zurück."
                conn.execute("UPDATE posts SET publish_state='verpasst', publish_log=? WHERE id=?", (log, p["id"]))
                missed_posts.append((p, log))
                continue
            # zuerst als „läuft“ markieren, damit ein Post auch bei Fehlern nie doppelt rausgeht
            if conn.execute("UPDATE posts SET publish_state='läuft' WHERE id=? AND IFNULL(publish_state,'')=''", (p["id"],)).rowcount:
                claimed_posts.append(p)
        wd = str(now.isoweekday())
        for r in conn.execute("SELECT * FROM story_rules WHERE active=1 AND IFNULL(last_run,'') != ?", (today,)).fetchall():
            if wd not in (r["weekdays"] or "").split(",") or not r["time"] or r["time"][:5] > hm:
                continue
            if (r["valid_from"] and today < r["valid_from"]) or (r["valid_until"] and today > r["valid_until"]):
                continue
            late = (now - datetime.strptime(f"{today} {r['time'][:5]}", "%Y-%m-%d %H:%M")).total_seconds() / 60
            if not conn.execute("UPDATE story_rules SET last_run=? WHERE id=? AND IFNULL(last_run,'') != ?", (today, r["id"], today)).rowcount:
                continue
            if late > STORY_LATE_MINUTES:
                log = f"{now:%d.%m.%Y %H:%M} Ausgelassen: der Hub lief zur geplanten Zeit nicht."
                conn.execute("UPDATE story_rules SET last_result=? WHERE id=?", (log, r["id"]))
                missed_rules.append((r, log))
                continue
            claimed_rules.append(r)
    for p, log in missed_posts:
        notify_publish("Post", p["title"] or p["type"] or "Post", "verpasst", log)
    for r, log in missed_rules:
        notify_publish("Story", r["name"] or "Story", "verpasst", log)
    for p in claimed_posts:
        state, log = publish_post(cfg, p)
        with db() as conn:
            audit(conn, "Auto-Posting", f"automatisch: {state}", "posts", p["id"], p["title"] or "", {"Ergebnis": log})
        notify_publish("Post", p["title"] or p["type"] or "Post", state, log)
    for r in claimed_rules:
        state, log = publish_rule(cfg, r)
        with db() as conn:
            audit(conn, "Auto-Posting", f"automatisch: {state}", "story_rules", r["id"], r["name"] or "", {"Ergebnis": log})
        notify_publish("Story", r["name"] or "Story", state, log)


# ---- Statistik und Beiträge, die online sind (nur lesen, 15 Minuten zwischengespeichert) ----
SOCIAL_CACHE = {}           # schlüssel -> (zeitpunkt, daten)
SOCIAL_CACHE_SECONDS = 900
# Meta ändert Kennzahlen regelmäßig: jede wird einzeln abgefragt, fehlende werden übersprungen und gemeldet
FB_PAGE_METRICS = [("page_media_view", "Aufrufe"), ("page_total_media_view_unique", "Erreichte Personen"),
                   ("page_post_engagements", "Interaktionen mit Beiträgen")]
IG_ACCOUNT_METRICS = [("views", "Aufrufe"), ("reach", "Erreichte Konten"), ("accounts_engaged", "Konten mit Interaktion"),
                      ("total_interactions", "Interaktionen"), ("profile_links_taps", "Klicks auf Profil-Links")]


def social_cached(key, refresh, fn):
    hit = SOCIAL_CACHE.get(key)
    if hit and not refresh and time.time() - hit[0] < SOCIAL_CACHE_SECONDS:
        return hit[1]
    if hit and refresh and time.time() - hit[0] < 60:   # höchstens einmal pro Minute neu laden
        return hit[1]
    data = fn()
    data["fetched_at"] = datetime.now().isoformat(timespec="seconds")
    SOCIAL_CACHE[key] = (time.time(), data)
    return data


def graph_try(errors, label, *args, **kw):
    try:
        return graph(*args, **kw)
    except GraphError as e:
        errors.append(f"{label}: {e}")
        return None


def social_insights(cfg, days):
    until = int(time.time())
    since = until - days * 86400
    tok, errors = cfg["fb_token"], []
    fb = {"metrics": [], "followers": None}
    page = graph_try(errors, "Facebook-Seite", "GET", cfg["fb_page_id"], {"fields": "followers_count,fan_count"}, tok) or {}
    fb["followers"] = page.get("followers_count", page.get("fan_count"))
    for key, label in FB_PAGE_METRICS:
        r = graph_try(errors, f"Facebook {label}", "GET", f"{cfg['fb_page_id']}/insights", {"metric": key, "period": "day", "since": since, "until": until}, tok)
        vals = ((r or {}).get("data") or [{}])[0].get("values") or []
        if r is not None:
            series = [{"date": (v.get("end_time") or "")[:10], "value": v.get("value") if isinstance(v.get("value"), (int, float)) else 0} for v in vals]
            fb["metrics"].append({"key": key, "label": label, "value": sum(s["value"] for s in series), "series": series})
    ig = None
    if cfg["ig_user_id"]:
        ig = {"metrics": [], "followers": None}
        acc = graph_try(errors, "Instagram-Konto", "GET", cfg["ig_user_id"], {"fields": "followers_count,media_count"}, tok) or {}
        ig["followers"], ig["media_count"] = acc.get("followers_count"), acc.get("media_count")
        ig_since = until - min(days, 30) * 86400   # Instagram erlaubt höchstens 30 Tage
        for key, label in IG_ACCOUNT_METRICS:
            r = graph_try(errors, f"Instagram {label}", "GET", f"{cfg['ig_user_id']}/insights",
                          {"metric": key, "period": "day", "metric_type": "total_value", "since": ig_since, "until": until}, tok)
            if r is not None:
                tv = ((r.get("data") or [{}])[0].get("total_value") or {}).get("value")
                ig["metrics"].append({"key": key, "label": label, "value": tv or 0, "series": []})
        r = graph_try(errors, "Instagram Verlauf", "GET", f"{cfg['ig_user_id']}/insights",
                      {"metric": "reach", "period": "day", "metric_type": "time_series", "since": ig_since, "until": until}, tok)
        series = [{"date": (v.get("end_time") or "")[:10], "value": v.get("value") or 0} for v in (((r or {}).get("data") or [{}])[0].get("values") or [])]
        for m in ig["metrics"]:
            if m["key"] == "reach":
                m["series"] = series
    return {"days": days, "facebook": fb, "instagram": ig, "errors": errors}


def social_online(cfg):
    tok, errors = cfg["fb_token"], []
    out = {"facebook": [], "facebook_stories": [], "instagram": [], "instagram_stories": [], "errors": errors}
    r = graph_try(errors, "Facebook-Beiträge", "GET", f"{cfg['fb_page_id']}/published_posts", {
        "fields": "id,message,created_time,full_picture,permalink_url,status_type,shares,"
                  "reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)", "limit": 20}, tok)
    for p in (r or {}).get("data", []):
        item = {"id": p["id"], "text": p.get("message", ""), "created": p.get("created_time", ""), "image": p.get("full_picture", ""),
                "url": p.get("permalink_url", ""), "reactions": ((p.get("reactions") or {}).get("summary") or {}).get("total_count", 0),
                "comments": ((p.get("comments") or {}).get("summary") or {}).get("total_count", 0),
                "shares": (p.get("shares") or {}).get("count", 0), "views": None}
        ins = graph_try([], "", "GET", f"{p['id']}/insights", {"metric": "post_media_view"}, tok)
        vals = ((ins or {}).get("data") or [{}])[0].get("values") or []
        if vals:
            item["views"] = vals[-1].get("value")
        out["facebook"].append(item)
    st = graph_try(errors, "Facebook-Storys", "GET", f"{cfg['fb_page_id']}/stories", {}, tok)
    for s in (st or {}).get("data", []):
        if (s.get("status") or "").upper() in ("", "PUBLISHED"):
            out["facebook_stories"].append({"id": s.get("post_id") or s.get("id"), "created": s.get("creation_time", ""),
                                            "url": s.get("url", ""), "type": s.get("media_type", "")})
    if cfg["ig_user_id"]:
        fields = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count"
        r = graph_try(errors, "Instagram-Beiträge", "GET", f"{cfg['ig_user_id']}/media", {"fields": fields, "limit": 20}, tok)
        for m in (r or {}).get("data", []):
            item = {"id": m["id"], "text": m.get("caption", ""), "created": m.get("timestamp", ""), "image": m.get("thumbnail_url") or m.get("media_url", ""),
                    "url": m.get("permalink", ""), "type": m.get("media_product_type") or m.get("media_type", ""),
                    "likes": m.get("like_count", 0), "comments": m.get("comments_count", 0), "views": None, "reach": None}
            ins = graph_try([], "", "GET", f"{m['id']}/insights", {"metric": "views,reach"}, tok)
            for d in (ins or {}).get("data", []):
                item[d.get("name")] = ((d.get("values") or [{}])[0]).get("value", (d.get("total_value") or {}).get("value"))
            out["instagram"].append(item)
        r = graph_try(errors, "Instagram-Storys", "GET", f"{cfg['ig_user_id']}/stories", {"fields": fields}, tok)
        for m in (r or {}).get("data", []):
            item = {"id": m["id"], "created": m.get("timestamp", ""), "image": m.get("thumbnail_url") or m.get("media_url", ""),
                    "url": m.get("permalink", ""), "views": None, "reach": None}
            ins = graph_try([], "", "GET", f"{m['id']}/insights", {"metric": "views,reach"}, tok)
            for d in (ins or {}).get("data", []):
                item[d.get("name")] = ((d.get("values") or [{}])[0]).get("value", (d.get("total_value") or {}).get("value"))
            out["instagram_stories"].append(item)
    return out


# Neueste Instagram-Beiträge für die Webseite: der Server holt sie über die Meta-Verbindung
# und speichert die Bilder lokal (data/instagram), Besucher laden nichts von Meta.
INSTA_DIR = DATA / "instagram"
INSTA_FEED = DATA / "instagram.json"
INSTA_REFRESH_SECONDS = 1800
INSTA_LOCK = threading.Lock()
INSTA_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def insta_refresh():
    if not INSTA_LOCK.acquire(blocking=False):
        return
    try:
        cfg = social_config()
        if not (cfg["fb_token"] and cfg["ig_user_id"]):
            return
        r = graph("GET", f"{cfg['ig_user_id']}/media", {"fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp", "limit": 12}, cfg["fb_token"])
        INSTA_DIR.mkdir(parents=True, exist_ok=True)
        items = []
        for m in r.get("data", []):
            mid, src, link = str(m.get("id", "")), m.get("thumbnail_url") or m.get("media_url") or "", m.get("permalink") or ""
            if not mid.isalnum() or not src or not link.startswith(("https://www.instagram.com/", "https://instagram.com/")):
                continue
            old = next(INSTA_DIR.glob(mid + ".*"), None)
            if old is None:
                try:
                    with urllib.request.urlopen(src, timeout=30) as resp:
                        ext = INSTA_TYPES.get((resp.headers.get("Content-Type") or "").split(";")[0].strip())
                        data = resp.read(8_000_001)
                except (urllib.error.URLError, OSError, ValueError):
                    continue
                if not ext or len(data) > 8_000_000:
                    continue
                old = INSTA_DIR / (mid + ext)
                old.write_bytes(data)
            caption = " ".join((m.get("caption") or "").split("\n")[0].split())
            items.append({"image": f"/web/insta/{old.name}", "url": link, "alt": caption[:120] or "Instagram-Beitrag der Emden Tigers"})
            if len(items) == 6:
                break
        keep = {i["image"].rsplit("/", 1)[-1] for i in items}
        for f in INSTA_DIR.iterdir():
            if f.name not in keep:
                f.unlink(missing_ok=True)
        INSTA_FEED.write_text(json.dumps({"fetched": time.time(), "items": items}), encoding="utf-8")
    except (GraphError, OSError, ValueError) as e:
        print("Instagram für die Webseite nicht geladen:", e)
        try:   # nicht bei jedem Seitenaufruf neu versuchen
            INSTA_FEED.write_text(json.dumps({**public_instagram_raw(), "fetched": time.time()}), encoding="utf-8")
        except OSError:
            pass
    finally:
        INSTA_LOCK.release()


def public_instagram_raw():
    try:
        return json.loads(INSTA_FEED.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"fetched": 0, "items": []}


def public_instagram():
    """Bis zu 6 neueste Instagram-Bilder (lokal gespeichert), veraltet: im Hintergrund neu laden."""
    feed = public_instagram_raw()
    if time.time() - feed.get("fetched", 0) > INSTA_REFRESH_SECONDS:
        threading.Thread(target=insta_refresh, daemon=True).start()
    return [{"image": i["image"], "url": i["url"], "alt": i["alt"]} for i in feed.get("items", []) if (INSTA_DIR / i["image"].rsplit("/", 1)[-1]).is_file()]


# ---------------------------------------------------------------------------
# E-Mail-Benachrichtigungen. Jeder wählt unter „Mein Profil“, was er bekommt (users.notify),
# angeboten wird nur, wofür er Leserechte hat. SMTP-Zugang in secrets (Passwort nie über die API lesbar).
# ---------------------------------------------------------------------------
APPAREL_ANY = ("verein", "finanzen", "medien")
NOTIFY_KINDS = {
    "post_failed": ("Auto-Posting hat nicht geklappt", ("medien",)),
    "post_done": ("Ein Post wurde automatisch veröffentlicht", ("medien",)),
    "magazine_deadline": ("Stadionheft: Redaktionsschluss naht (7, 3, 1 Tag vorher und am Tag)", ("medien",)),
    "apparel_orders": ("Teamkleidung: neue Bestellungen (höchstens einmal pro Stunde gesammelt)", APPAREL_ANY),
    "apparel_deadline": ("Teamkleidung: Bestellschluss naht und Zusammenfassung danach", APPAREL_ANY),
    "contact_request": ("Neue Anfrage über das Kontaktformular der Webseite", ("mitglieder",)),
}
SMTP_KEYS = ("smtp_host", "smtp_port", "smtp_security", "smtp_user", "smtp_from", "hub_url")
NOTIFY_HOUR = 8   # Erinnerungen frühestens ab 8 Uhr
NOTIFY_INTERVAL = int(ENV("TMH_NOTIFY_INTERVAL") or 300)   # Sekunden zwischen zwei Durchläufen (Variable nur für Tests)
DIGEST_SECONDS = int(ENV("TMH_DIGEST_SECONDS") or 3600)    # neue Bestellungen höchstens so oft gesammelt melden


def notify_allowed(perms, kind):
    return any(perms.get(a, 0) >= 1 for a in NOTIFY_KINDS[kind][1])


def smtp_config():
    with db() as conn:
        cfg = {k: secret_get(conn, k) for k in (*SMTP_KEYS, "smtp_password", "public_url")}
    cfg["hub_url"] = (cfg["hub_url"] or SITE_URL or cfg["public_url"] or "").rstrip("/")
    return cfg


def send_mail(cfg, to, subject, body, footer=True):
    """Schickt eine Klartext-Mail. Liefert None oder eine Fehlermeldung."""
    import smtplib
    import ssl
    from email.message import EmailMessage
    msg = EmailMessage()
    msg["From"] = cfg["smtp_from"] or cfg["smtp_user"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body + ((f"\n\nZum Hub: {cfg['hub_url']}/hub" if cfg["hub_url"] else "") +
                            "\n\nWelche Nachrichten du bekommst, stellst du im Hub unter „Mein Profil“ ein." if footer else ""))
    try:
        port = int(cfg["smtp_port"] or (465 if cfg["smtp_security"] == "ssl" else 587))
        ctx = ssl.create_default_context()
        if cfg["smtp_security"] == "ssl":
            s = smtplib.SMTP_SSL(cfg["smtp_host"], port, timeout=30, context=ctx)
        else:
            s = smtplib.SMTP(cfg["smtp_host"], port, timeout=30)
            if cfg["smtp_security"] != "none":
                s.starttls(context=ctx)
        with s:
            if cfg["smtp_user"]:
                s.login(cfg["smtp_user"], cfg["smtp_password"])
            s.send_message(msg)
        return None
    except Exception as e:  # noqa
        return f"{type(e).__name__}: {e}"


def notify(kind, subject, body, once_key=None):
    """Mail an alle, die diese Nachricht abonniert haben und die Rechte dafür haben. once_key: nur einmal verschicken."""
    cfg = smtp_config()
    if not cfg["smtp_host"]:
        return
    with db() as conn:
        if once_key:
            if conn.execute("SELECT 1 FROM notify_sent WHERE key=?", (once_key,)).fetchone():
                return
            conn.execute("INSERT INTO notify_sent (key, time) VALUES (?, ?)", (once_key, datetime.now().isoformat(timespec="seconds")))
        users = conn.execute("SELECT id, is_admin, email, notify FROM users WHERE active=1 AND IFNULL(email,'') != ''").fetchall()
        to = []
        for u in users:
            try:
                kinds = json.loads(u["notify"] or "[]")
            except ValueError:
                kinds = []
            if kind in kinds and notify_allowed(effective_perms(conn, row_dict(u)), kind):
                to.append(u["email"])
    errors = [e for e in (send_mail(cfg, addr, f"Tigers Hub: {subject}", body) for addr in to) if e]   # einzeln, keine fremden Adressen sichtbar
    with db() as conn:
        secret_set(conn, "smtp_last_error", f"{datetime.now():%d.%m.%Y %H:%M} {errors[0]}" if errors else "")


def notify_async(*args, **kw):
    threading.Thread(target=lambda: notify(*args, **kw), daemon=True).start()


def notify_publish(kind_label, title, state, log):
    if state in ("fehler", "teilweise", "verpasst"):
        notify_async("post_failed", f"{kind_label} „{title}“ hat nicht geklappt", f"{kind_label}: {title}\n{log}\n\nIm Hub unter Medien > Auto-Posting kannst du es erneut versuchen.")
    elif state == "gepostet":
        notify_async("post_done", f"{kind_label} „{title}“ ist online", f"{kind_label}: {title}\n{log}")


MAG_SECTIONS_NEEDED = ("Vorwort", "Behind the Helmet", "Spielbericht", "Schiedsrichter", "Fan-Info", "Jugend", "Rückseite")


def notify_tick():
    """Erinnerungen (einmal pro Stichtag) und gesammelte neue Bestellungen."""
    now = datetime.now()
    today = now.date()
    if now.hour >= NOTIFY_HOUR:
        with db() as conn:
            mags = conn.execute("SELECT * FROM magazines WHERE IFNULL(status,'') != 'Fertig' AND IFNULL(deadline,'') != ''").fetchall()
            mag_open = {}
            for m in mags:
                have = {r["section"] for r in conn.execute("SELECT DISTINCT section FROM magazine_pages WHERE magazine_id=?", (m["id"],))}
                miss = [s for s in MAG_SECTIONS_NEEDED if s not in have]
                if not (m["sponsor_ids"] or "").strip("[] "):
                    miss.insert(0, "Sponsoren")
                if not m["game_id"]:
                    miss.append("Heimspiel")
                mag_open[m["id"]] = miss
            apparel = conn.execute("SELECT * FROM apparel WHERE IFNULL(deadline,'') != ''").fetchall()
            counts = {r["apparel_id"]: (r["n"], r["pcs"]) for r in conn.execute(
                "SELECT apparel_id, COUNT(*) AS n, SUM(IFNULL(quantity,1)) AS pcs FROM apparel_orders GROUP BY apparel_id")}
        for m in mags:
            d = (datetime.strptime(m["deadline"], "%Y-%m-%d").date() - today).days
            label = " ".join(x for x in (m["title"], m["number"], m["season"]) if x)
            if d in (7, 3, 1, 0) and mag_open[m["id"]]:
                when = "heute" if d == 0 else "morgen" if d == 1 else f"in {d} Tagen"
                notify("magazine_deadline", f"Stadionheft {label}: Redaktionsschluss {when}",
                       f"Redaktionsschluss für „{label}“ ist {when} ({m['deadline'][8:]}.{m['deadline'][5:7]}.).\nNoch offen: {', '.join(mag_open[m['id']])}",
                       once_key=f"mag:{m['id']}:{m['deadline']}:{d}")
        for a in apparel:
            d = (datetime.strptime(a["deadline"], "%Y-%m-%d").date() - today).days
            n, pcs = counts.get(a["id"], (0, 0))
            if d in (3, 1) and a["active"]:
                notify("apparel_deadline", f"{a['name']}: Bestellschluss in {d} Tag{'en' if d > 1 else ''}",
                       f"Bestellschluss für „{a['name']}“ ist am {a['deadline'][8:]}.{a['deadline'][5:7]}.\nBisher: {n} Bestellungen, {pcs or 0} Stück.",
                       once_key=f"app:{a['id']}:{a['deadline']}:{d}")
            if d == -1:
                notify("apparel_deadline", f"{a['name']}: Bestellschluss vorbei",
                       f"Für „{a['name']}“ ist der Bestellschluss vorbei.\nErgebnis: {n} Bestellungen, {pcs or 0} Stück.\n"
                       "Die Zusammenfassung für den Lieferanten steht im Hub unter Teamkleidung.",
                       once_key=f"app:{a['id']}:{a['deadline']}:done")
    # Neue Bestellungen über den Link: höchstens einmal pro Stunde gesammelt
    with db() as conn:
        if not secret_get(conn, "notify_last_order"):   # erster Lauf: nur ab jetzt melden, nicht alle alten Bestellungen
            secret_set(conn, "notify_last_order", str(conn.execute("SELECT IFNULL(MAX(id), 0) FROM apparel_orders").fetchone()[0]))
            return
        last_id = int(secret_get(conn, "notify_last_order") or 0)
        last_time = float(secret_get(conn, "notify_last_digest") or 0)
        if time.time() - last_time < DIGEST_SECONDS:
            return
        rows = conn.execute("SELECT o.id, o.quantity, a.name FROM apparel_orders o JOIN apparel a ON a.id = o.apparel_id "
                            "WHERE o.id > ? AND o.source='Link' ORDER BY o.id", (last_id,)).fetchall()
        if not rows:
            return
        secret_set(conn, "notify_last_order", str(rows[-1]["id"]))
        secret_set(conn, "notify_last_digest", str(time.time()))
    per = {}
    for r in rows:
        n, pcs = per.get(r["name"], (0, 0))
        per[r["name"]] = (n + 1, pcs + (r["quantity"] or 1))
    notify("apparel_orders", f"{len(rows)} neue Bestellung{'en' if len(rows) > 1 else ''}",
           "Neu über den Bestell-Link:\n" + "\n".join(f"{k}: {n} Bestellung{'en' if n > 1 else ''}, {p} Stück" for k, (n, p) in per.items()))


def notify_loop():
    while True:
        try:
            notify_tick()
        except Exception as e:  # noqa
            print("Benachrichtigungen fehlgeschlagen:", e)
        threading.Event().wait(NOTIFY_INTERVAL)


def social_loop():
    while True:
        try:
            with SOCIAL_LOCK:
                social_tick()
        except Exception as e:  # noqa
            print("Auto-Posting fehlgeschlagen:", e)
        threading.Event().wait(60)


# ---------------------------------------------------------------------------
# Sicherungen
# ---------------------------------------------------------------------------
def db_snapshot(target: Path):
    """Konsistente Kopie der Datenbank (auch während des Betriebs)."""
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(".tmp")
    tmp.unlink(missing_ok=True)
    with db() as src:
        dst = sqlite3.connect(tmp)
        try:
            src.backup(dst)
        finally:
            dst.close()
    os.replace(tmp, target)
    return target


def daily_backup():
    name = BACKUPS / f"tigers-{datetime.now():%Y-%m-%d}.db"
    if not name.exists():
        db_snapshot(name)
        print("Tägliche Sicherung erstellt:", name.name)
    olds = sorted(BACKUPS.glob("tigers-????-??-??.db"))
    for f in olds[:-BACKUP_KEEP] if BACKUP_KEEP > 0 else []:
        f.unlink(missing_ok=True)


def backup_loop():
    while True:
        try:
            daily_backup()
        except Exception as e:  # noqa
            print("Sicherung fehlgeschlagen:", e)
        threading.Event().wait(3600)


AUTH_TABLES = ("users", "sessions", "groups", "group_perms", "user_groups", "user_perms", "secrets", "audit_log")


# ---------------------------------------------------------------------------
# Änderungsprotokoll
# ---------------------------------------------------------------------------
AUDIT_SKIP = {"updated_at", "created_at", "public_token"}
AUDIT_KEEP_DAYS = 400
LABEL_KEYS = ("title", "name", "description", "holder", "section", "author", "date")


def audit_short(v):
    s = "" if v is None else str(v)
    return s if len(s) <= 120 else s[:117] + "..."


def audit_label(row):
    d = row_dict(row) if row is not None and not isinstance(row, dict) else (row or {})
    if d.get("first_name") or d.get("last_name"):
        return f"{d.get('first_name') or ''} {d.get('last_name') or ''}".strip()
    return next((audit_short(d[k]) for k in LABEL_KEYS if d.get(k)), "")


def audit(conn, user, action, table="", rid=None, label="", details=None):
    """user: angemeldeter Benutzer (dict) oder ein Name wie „Bestell-Link“ für Aktionen ohne Login."""
    if isinstance(user, dict):
        uid, name = user.get("id"), user.get("display_name") or user.get("username") or "?"
    else:
        uid, name = None, user or "System"
    conn.execute("INSERT INTO audit_log (time, user_id, user_name, action, table_name, record_id, label, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                 (datetime.now().isoformat(timespec="seconds"), uid, name, action, table, rid, (label or "")[:120],
                  json.dumps(details, ensure_ascii=False)[:6000] if details else ""))


def restore_backup(raw: bytes):
    """Spielt ein Backup-ZIP (aus "Backup herunterladen") oder eine tigers.db ein.
    Benutzer und Sitzungen des Servers bleiben erhalten."""
    db_bytes, media = None, {}
    if raw[:16] == b"SQLite format 3\x00":
        db_bytes = raw
    else:
        try:
            z = zipfile.ZipFile(io.BytesIO(raw))
        except zipfile.BadZipFile:
            raise ValueError("Das ist weder ein Backup-ZIP noch eine Datenbankdatei.")
        for info in z.infolist():
            n = info.filename.replace("\\", "/")
            if n.endswith("tigers.db") and db_bytes is None:
                db_bytes = z.read(info)
            elif "/media/" in "/" + n and not n.endswith("/"):
                base = n.rsplit("/", 1)[-1]
                if re.fullmatch(r"[A-Za-z0-9._-]{1,120}", base):
                    media[base] = info
        if db_bytes is None:
            raise ValueError("Im ZIP wurde keine tigers.db gefunden.")
        if db_bytes[:16] != b"SQLite format 3\x00":
            raise ValueError("Die tigers.db im ZIP ist keine gültige Datenbank.")

    stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    db_snapshot(BACKUPS / f"vor-wiederherstellung-{stamp}.db")
    new_path = DATA / "_restore.db"
    new_path.write_bytes(db_bytes)
    # Gültigkeit prüfen
    test = sqlite3.connect(new_path)
    try:
        if test.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("Die Datenbank im Backup ist beschädigt.")
    finally:
        test.close()

    with SYNC_LOCK, DB_LOCK:
        keep = {}
        with db() as conn:
            for t in AUTH_TABLES:
                keep[t] = [dict(r) for r in conn.execute(f"SELECT * FROM {t}")]
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        for suffix in ("-wal", "-shm"):
            Path(str(DB_PATH) + suffix).unlink(missing_ok=True)
        os.replace(new_path, DB_PATH)
        init_db()
        with db() as conn:
            for t in AUTH_TABLES:
                conn.execute(f"DELETE FROM {t}")
                cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({t})")}
                for row in keep[t]:
                    row = {k: v for k, v in row.items() if k in cols}
                    conn.execute(f"INSERT INTO {t} ({', '.join(row)}) VALUES ({', '.join('?' for _ in row)})", list(row.values()))
    count = 0
    if media:
        z = zipfile.ZipFile(io.BytesIO(raw))
        for base, info in media.items():
            target = MEDIA / base
            if not target.exists():
                target.write_bytes(z.read(info))
                count += 1
    return {"ok": True, "media": count}


# ---------------------------------------------------------------------------
# Serverumzug: Komplett-Export und -Import. Enthält ALLES (Konten, Gruppen, Rechte, Zugangsdaten,
# Protokoll, Vereinsdaten, Bilder), nur Sitzungen nicht. Die Datei ist mit einem Passwort verschlüsselt,
# nur mit der Standardbibliothek: Schlüssel per scrypt, Schlüsselstrom per SHAKE-256, Echtheit per
# HMAC-SHA256 über die ganze Datei (erst prüfen, dann entschlüsseln).
# Aufbau: MAGIC | Salz 16 | Nonce 16 | verschlüsseltes ZIP | HMAC 32
# ---------------------------------------------------------------------------
MIGRATE_MAGIC = b"TIGERSHUB-UMZUG-1\n"
MIGRATE_MAX = 2 * 1024 ** 3        # 2 GB
MIGRATE_CHUNK = 1024 * 1024


def migrate_keys(password, salt):
    k = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2 ** 15, r=8, p=1, maxmem=128 * 1024 * 1024, dklen=64)
    return k[:32], k[32:]


def migrate_xor(data, key, nonce, index):
    stream = hashlib.shake_256(key + nonce + index.to_bytes(8, "big")).digest(len(data))
    return (int.from_bytes(data, "big") ^ int.from_bytes(stream, "big")).to_bytes(len(data), "big")


def migrate_encrypt(src: Path, dst: Path, password):
    salt, nonce = os.urandom(16), os.urandom(16)
    enc_key, mac_key = migrate_keys(password, salt)
    mac = hmac.new(mac_key, digestmod=hashlib.sha256)
    with open(src, "rb") as fi, open(dst, "wb") as fo:
        head = MIGRATE_MAGIC + salt + nonce
        fo.write(head)
        mac.update(head)
        i = 0
        while block := fi.read(MIGRATE_CHUNK):
            c = migrate_xor(block, enc_key, nonce, i)
            fo.write(c)
            mac.update(c)
            i += 1
        fo.write(mac.digest())


def migrate_decrypt(src: Path, dst: Path, password):
    size = src.stat().st_size
    hl = len(MIGRATE_MAGIC) + 32
    with open(src, "rb") as fi:
        head = fi.read(hl)
        if size < hl + 32 or not head.startswith(MIGRATE_MAGIC):
            raise ValueError("Das ist keine Umzugsdatei des Hubs.")
        salt, nonce = head[len(MIGRATE_MAGIC):len(MIGRATE_MAGIC) + 16], head[len(MIGRATE_MAGIC) + 16:]
        enc_key, mac_key = migrate_keys(password, salt)
        mac = hmac.new(mac_key, head, hashlib.sha256)
        left = size - hl - 32
        while left > 0:
            block = fi.read(min(MIGRATE_CHUNK, left))
            mac.update(block)
            left -= len(block)
        if not hmac.compare_digest(mac.digest(), fi.read(32)):
            raise ValueError("Das Passwort ist falsch oder die Datei ist beschädigt.")
        fi.seek(hl)
        left, i = size - hl - 32, 0
        with open(dst, "wb") as fo:
            while left > 0:
                block = fi.read(min(MIGRATE_CHUNK, left))
                fo.write(migrate_xor(block, enc_key, nonce, i))
                left -= len(block)
                i += 1


def migrate_export(password) -> Path:
    """Baut die verschlüsselte Umzugsdatei und liefert ihren Pfad (wird nach dem Herunterladen gelöscht)."""
    stamp = secrets.token_hex(16)
    tmpdb, tmpzip, out = DATA / f"_umzug_{stamp}.db", DATA / f"_umzug_{stamp}.zip", DATA / f"_umzug_{stamp}.tigers"
    try:
        db_snapshot(tmpdb)
        c = sqlite3.connect(tmpdb)
        try:
            c.execute("DELETE FROM sessions")   # Anmeldungen ziehen nicht mit um
            c.commit()
            users = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        finally:
            c.close()
        files = [f for f in MEDIA.iterdir() if f.is_file()]
        with zipfile.ZipFile(tmpzip, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("umzug.json", json.dumps({"app": APP_NAME, "version": VERSION, "created": datetime.now().isoformat(timespec="seconds"),
                                                 "users": users, "media": len(files)}, ensure_ascii=False))
            z.write(tmpdb, "data/tigers.db")
            for f in files:   # Bilder und Videos sind schon komprimiert
                z.write(f, f"data/media/{f.name}", compress_type=zipfile.ZIP_STORED)
        migrate_encrypt(tmpzip, out, password)
        return out
    finally:
        tmpdb.unlink(missing_ok=True)
        tmpzip.unlink(missing_ok=True)


def version_tuple(v):
    return tuple(int(x) for x in re.findall(r"\d+", v or "0"))


def migrate_import(src: Path, password):
    """Ersetzt den kompletten Stand durch die Umzugsdatei. Vorher wird der eigene Stand gesichert."""
    tmpzip, newdb = DATA / "_umzug_import.zip", DATA / "_umzug_import.db"
    try:
        migrate_decrypt(src, tmpzip, password)
        try:
            z = zipfile.ZipFile(tmpzip)
        except zipfile.BadZipFile:
            raise ValueError("Die Umzugsdatei ist beschädigt.")
        with z:
            meta = json.loads(z.read("umzug.json").decode("utf-8"))
            if version_tuple(meta.get("version")) > version_tuple(VERSION):
                raise ValueError(f"Die Datei stammt von Version {meta.get('version')}. Bitte diesen Hub zuerst auf mindestens diese Version bringen.")
            newdb.write_bytes(z.read("data/tigers.db"))
            test = sqlite3.connect(newdb)
            try:
                if test.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise ValueError("Die Datenbank in der Umzugsdatei ist beschädigt.")
            finally:
                test.close()
            db_snapshot(BACKUPS / f"vor-umzug-import-{datetime.now():%Y-%m-%d_%H%M%S}.db")
            with SYNC_LOCK, DB_LOCK, SOCIAL_LOCK:
                with db() as conn:
                    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                for suffix in ("-wal", "-shm"):
                    Path(str(DB_PATH) + suffix).unlink(missing_ok=True)
                os.replace(newdb, DB_PATH)
                init_db()
            count = 0
            for info in z.infolist():
                n = info.filename
                base = n.rsplit("/", 1)[-1]
                if n.startswith("data/media/") and re.fullmatch(r"[A-Za-z0-9._-]{1,120}", base):
                    with z.open(info) as fi, open(MEDIA / base, "wb") as fo:
                        shutil.copyfileobj(fi, fo, MIGRATE_CHUNK)
                    count += 1
        SOCIAL_CACHE.clear()
        return {"ok": True, "version": meta.get("version"), "created": meta.get("created"), "users": meta.get("users"), "media": count}
    finally:
        tmpzip.unlink(missing_ok=True)
        newdb.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Google-Tabelle "Social Media Spieler" einlesen
# Die Tabelle muss für "Jeder mit dem Link" freigegeben sein.
# ---------------------------------------------------------------------------
SYNC_LOCK = threading.RLock()

UNIT_BY_POS = {
    "QB": "Offense", "RB": "Offense", "FB": "Offense", "WR": "Offense", "TE": "Offense", "OL": "Offense",
    "C": "Offense", "G": "Offense", "OT": "Offense",
    "DL": "Defense", "DE": "Defense", "DT": "Defense", "NT": "Defense", "LB": "Defense", "MLB": "Defense",
    "OLB": "Defense", "CB": "Defense", "S": "Defense", "FS": "Defense", "SS": "Defense", "DB": "Defense",
    "K": "Special Teams", "P": "Special Teams", "LS": "Special Teams",
}


def get_setting(conn, key):
    r = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return r["value"] if r else DEFAULT_SETTINGS.get(key, "")


def set_setting(conn, key, value):
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(value)))


def sheet_base(url):
    url = (url or "").strip()
    if url.startswith("file://"):
        return url, None
    m = re.search(r"/spreadsheets/d/([A-Za-z0-9_-]+)", url)
    if not m:
        raise ValueError("Das ist kein Link zu einer Google-Tabelle.")
    return m.group(1), re.search(r"[#&?]gid=(\d+)", url)


def fetch_csv(url, gid):
    """Liest ein Tabellenblatt als CSV. Für Tests: file://pfad.csv (gid wird an den Dateinamen gehängt)."""
    sid, _ = sheet_base(url)
    if sid.startswith("file://") and SERVER_MODE:
        raise ValueError("Im Serverbetrieb sind nur Google-Tabellen erlaubt.")
    if sid.startswith("file://"):
        path = Path(sid[7:])
        if str(gid) != "0":
            path = path.with_name(f"{path.stem}_{gid}{path.suffix}")
        if not path.exists():
            return None
        text = path.read_text(encoding="utf-8-sig")
    else:
        src = f"https://docs.google.com/spreadsheets/d/{sid}/export?format=csv&gid={gid}"
        req = urllib.request.Request(src, headers={"User-Agent": "EmdenTigersHub"})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                ctype = resp.headers.get("Content-Type", "")
                data = resp.read()
        except Exception:
            if str(gid) != "0":
                return None  # Zusatzblatt nicht erreichbar, wird übersprungen
            raise
        if "text/html" in ctype:
            if str(gid) != "0":
                return None
            raise ValueError("Kein Zugriff auf die Tabelle. Bitte in Google Sheets auf "
                             "Freigeben > Jeder mit dem Link > Betrachter stellen.")
        text = data.decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(text)))
    return rows


def map_columns(header):
    cols = {}
    for i, h in enumerate(header):
        k = h.strip().lower()
        def put(key):
            if key not in cols:
                cols[key] = i
        if "instagram" in k:
            put("instagram")
        elif "nummer" in k or "number" in k or k in ("#", "nr", "nr.", "trikot"):
            put("number")
        elif "position" in k:
            put("position")
        elif "funktion" in k or "rolle" in k:
            put("role")
        elif "bereich" in k or "unit" in k:
            put("area")
        elif "einwilligung" in k or "zustimmung" in k:
            put("consent")
        elif "name" in k:
            put("name")
    return cols


COACH_WORDS = ("coach", "coordinator", "koordinator", "trainer")
COACH_CODES = {"HC", "OC", "DC", "STC", "DLC", "OLC", "LBC", "DBC", "QBC", "WRC", "RBC", "TEC", "CT", "AT"}


def clean_handle(h):
    h = (h or "").strip()
    h = re.sub(r"^https?://(www\.)?instagram\.com/", "", h)
    return h.strip("/").lstrip("@").split("?")[0].strip()


def pos_short(p):
    m = re.search(r"\(([A-Za-z/]{1,6})\)", p or "")
    if m:
        return m.group(1).upper()
    p = (p or "").strip()
    return p.upper() if 0 < len(p) <= 4 else p


def strip_code(p):
    return re.sub(r"\s*\([^)]*\)\s*$", "", (p or "")).strip()


def is_coach_position(p):
    low = (p or "").lower()
    return pos_short(p) in COACH_CODES or any(w in low for w in COACH_WORDS)


def split_nick(name):
    """'Mahmoud El Sirri (Machi)' -> ('Mahmoud El Sirri', 'Machi')"""
    name = re.sub(r"\s+", " ", (name or "").strip())
    m = re.search(r"\s*[(\"„“']([^)\"“”']+)[)\"“”']\s*", name)
    if m:
        return (name[:m.start()] + " " + name[m.end():]).strip(), m.group(1).strip()
    return name, ""


def norm_key(name):
    return re.sub(r"\s+", " ", (name or "").strip().lower())


def yes(v):
    return (v or "").strip().lower() in ("ja", "yes", "x", "true", "wahr", "1", "✓", "✔")


def read_all_tabs(url, gids):
    """Liest alle Blätter und führt Personen über den Namen zusammen."""
    people, order, headers = {}, [], {}
    for gid in gids:
        rows = fetch_csv(url, gid)
        if not rows:
            continue
        header, data = rows[0], rows[1:]
        cols = map_columns(header)
        if "name" not in cols:
            continue
        coach_tab = "role" in cols and "position" not in cols
        headers[str(gid)] = header
        for r in data:
            get = lambda k: r[cols[k]].strip() if k in cols and cols[k] < len(r) else ""
            name, nick = split_nick(get("name"))
            if not name:
                continue
            key = norm_key(name)
            pos = get("position")
            if coach_tab:
                role = get("role")
                area = get("area")
                v = {"kind": "Coach", "position": role, "role": role + (f" | {area}" if area and area.lower() != "gesamt" else ""),
                     "number": "", "unit": area}
            elif is_coach_position(pos):
                v = {"kind": "Coach", "position": pos, "role": strip_code(pos), "number": get("number"), "unit": ""}
            else:
                short = pos_short(pos)
                v = {"kind": "Spieler", "position": pos, "role": "", "number": get("number"), "unit": UNIT_BY_POS.get(short, "")}
            v.update({"name": name, "nickname": nick, "instagram": clean_handle(get("instagram")), "tab": str(gid),
                      "consent": get("consent") if "consent" in cols else None,
                      "raw": dict(zip(header, r))})
            if key in people:
                # gleiche Person in mehreren Blättern: Coaches-Blatt hat Vorrang für die Funktion, leere Felder auffüllen
                old = people[key]
                for k2, val in v.items():
                    if k2 == "raw":
                        old["raw"].update(val)
                    elif val and (not old.get(k2) or (coach_tab and k2 in ("kind", "role", "position", "unit"))):
                        old[k2] = val
            else:
                people[key] = v
                order.append(key)
    return [(k, people[k]) for k in order], headers


FIELDS = (("name", "Name"), ("nickname", "Spitzname"), ("kind", "Art"), ("number", "Nummer"), ("position", "Position"), ("role", "Funktion"), ("instagram", "Instagram"))


def sync_sheet():
    """Liest die Tabelle ein, gleicht Änderungen ab und überträgt sie in den Kader."""
    with SYNC_LOCK:
        now = datetime.now().isoformat(timespec="seconds")
        with db() as conn:
            url = get_setting(conn, "sheet_url")
            update_kader = get_setting(conn, "sheet_update_kader") == "1"
            gids = [g.strip() for g in (get_setting(conn, "sheet_gids") or "0").split(",") if g.strip()]
        try:
            people, headers = read_all_tabs(url, gids)
            if not headers:
                raise ValueError("Kein Tabellenblatt mit einer Spalte \"Name\" gefunden.")
        except Exception as e:  # noqa
            with db() as conn:
                set_setting(conn, "sheet_last_error", f"{datetime.now():%d.%m.%Y %H:%M}: {e}")
            return {"ok": False, "error": str(e)}

        summary = {"ok": True, "neu": 0, "geändert": 0, "entfernt": 0, "gesamt": len(people),
                   "spieler": sum(1 for _, v in people if v["kind"] == "Spieler"),
                   "coaches": sum(1 for _, v in people if v["kind"] == "Coach")}
        seen = set()
        with db() as conn:
            log = lambda action, name, details="": conn.execute(
                "INSERT INTO sheet_log (time, action, name, details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (now, action, name, details, now, now))
            for key, v in people:
                seen.add(key)
                raw = json.dumps(v["raw"], ensure_ascii=False)
                old = conn.execute("SELECT * FROM sheet_players WHERE key=?", (key,)).fetchone()
                if not old and v["nickname"]:
                    # ältere Version hatte den Spitznamen noch im Namen
                    old = conn.execute("SELECT * FROM sheet_players WHERE key=?", (norm_key(f"{v['name']} ({v['nickname']})"),)).fetchone()
                    if old:
                        conn.execute("UPDATE sheet_players SET key=? WHERE id=?", (key, old["id"]))
                cols = ("name", "nickname", "kind", "number", "position", "role", "unit", "instagram", "tab")
                if not old:
                    conn.execute(
                        f"INSERT INTO sheet_players ({', '.join(cols)}, key, raw, status, first_seen, last_change, created_at, updated_at) "
                        f"VALUES ({', '.join('?' for _ in cols)}, ?, ?, 'aktiv', ?, ?, ?, ?)",
                        (*[v[c] for c in cols], key, raw, now, now, now, now))
                    summary["neu"] += 1
                    log("neu", v["name"], ", ".join(f"{lbl}: {v[k]}" for k, lbl in FIELDS[1:] if v[k]))
                else:
                    diffs = [f"{lbl}: {old[k] or '(leer)'} auf {v[k] or '(leer)'}" for k, lbl in FIELDS
                             if (old[k] or "") != (v[k] or "")
                             and not (k in ("kind", "role", "nickname") and not old[k] and (v["kind"] == "Spieler" or k == "nickname"))]
                    if old["status"] == "entfernt":
                        log("wieder da", v["name"])
                    if diffs:
                        summary["geändert"] += 1
                        log("geändert", v["name"], "; ".join(diffs))
                    stamp = now if (diffs or old["status"] == "entfernt") else old["last_change"]
                    conn.execute(
                        f"UPDATE sheet_players SET {', '.join(f'{c}=?' for c in cols)}, raw=?, status='aktiv', last_change=?, updated_at=? WHERE id=?",
                        (*[v[c] for c in cols], raw, stamp, now, old["id"]))

            for sp in conn.execute("SELECT * FROM sheet_players WHERE status='aktiv'").fetchall():
                if sp["key"] not in seen:
                    conn.execute("UPDATE sheet_players SET status='entfernt', last_change=?, updated_at=? WHERE id=?", (now, now, sp["id"]))
                    summary["entfernt"] += 1
                    log("entfernt", sp["name"], "nicht mehr in der Tabelle")

            if update_kader:
                players = conn.execute("SELECT * FROM players").fetchall()
                by_name = {norm_key(f"{p['first_name'] or ''} {p['last_name'] or ''}"): p for p in players}
                by_id = {p["id"]: p for p in players}
                by_ig = {(p["instagram"] or "").lower(): p for p in players if p["instagram"]}
                consent = {k: v["consent"] for k, v in people}
                for sp in conn.execute("SELECT * FROM sheet_players WHERE status='aktiv'").fetchall():
                    p = (by_id.get(sp["player_id"]) or by_name.get(sp["key"])
                         or (by_ig.get(sp["instagram"].lower()) if sp["instagram"] else None))
                    first, _, last = sp["name"].strip().partition(" ")
                    coach = sp["kind"] == "Coach"
                    want = {
                        "kind": sp["kind"] or "Spieler",
                        "first_name": first, "last_name": last,
                        "number": "" if coach else (sp["number"] or ""),
                        "position": "" if coach else pos_short(sp["position"]),
                        "role": sp["role"] if coach else (p["role"] if p else ""),
                        "unit": "" if coach else (sp["unit"] or (p["unit"] if p else "")),
                        "instagram": sp["instagram"] or "",
                    }
                    if sp["nickname"]:
                        want["nickname"] = sp["nickname"]
                    c = consent.get(sp["key"])
                    if c is not None:
                        want["consent"] = 1 if yes(c) else 0
                    if not p:
                        want.update({"active": 1, "source": "Tabelle", "created_at": now, "updated_at": now})
                        want.setdefault("consent", 0)
                        cur = conn.execute(f"INSERT INTO players ({', '.join(want)}) VALUES ({', '.join('?' for _ in want)})", list(want.values()))
                        conn.execute("UPDATE sheet_players SET player_id=? WHERE id=?", (cur.lastrowid, sp["id"]))
                    else:
                        if norm_key(f"{p['first_name'] or ''} {p['last_name'] or ''}") == sp["key"]:
                            want.pop("first_name"); want.pop("last_name")  # Schreibweise im Kader behalten
                        upd = {k: val for k, val in want.items() if (p[k] if p[k] is not None else "") != val}
                        if upd:
                            upd["updated_at"] = now
                            conn.execute(f"UPDATE players SET {', '.join(f'{k}=?' for k in upd)} WHERE id=?", [*upd.values(), p["id"]])
                        if sp["player_id"] != p["id"]:
                            conn.execute("UPDATE sheet_players SET player_id=? WHERE id=?", (p["id"], sp["id"]))

            set_setting(conn, "sheet_last_sync", now)
            set_setting(conn, "sheet_last_error", "")
            set_setting(conn, "sheet_columns", json.dumps(headers, ensure_ascii=False))
        return summary


def sync_loop():
    while True:
        minutes = 5
        try:
            with db() as conn:
                minutes = max(1, int(float(get_setting(conn, "sheet_interval") or 5)))
                active = bool(get_setting(conn, "sheet_url"))
            if active:
                sync_sheet()
        except Exception as e:  # noqa
            print("Tabellen-Abgleich fehlgeschlagen:", e)
        threading.Event().wait(minutes * 60)


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------
class PayloadTooLarge(Exception):
    pass


class Handler(BaseHTTPRequestHandler):
    server_version = "EmdenTigersHub/" + VERSION

    def log_message(self, fmt, *args):  # ruhige Konsole
        if "--verbose" in sys.argv:
            super().log_message(fmt, *args)

    # -- Antworten --------------------------------------------------------
    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path: Path, download_name=None, cache=False):
        if not path.is_file():
            return self.send_error(404)
        ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("text/") or ctype.endswith("javascript") else ""))
        self.send_header("Content-Length", str(len(data)))
        # Schriften und Bilder der Webseite eine Woche im Browser behalten, alles andere immer frisch prüfen
        self.send_header("Cache-Control", "public, max-age=604800" if cache else "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        if download_name:
            self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
        self.end_headers()
        self.wfile.write(data)

    def send_stream(self, path: Path, download_name):
        """Große Datei in Stücken senden (nicht komplett in den Speicher laden)."""
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(path.stat().st_size))
        self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        with open(path, "rb") as f:
            shutil.copyfileobj(f, self.wfile, MIGRATE_CHUNK)

    def save_body(self, target: Path, limit):
        """Großen Upload direkt in eine Datei schreiben."""
        length = int(self.headers.get("Content-Length") or 0)
        if length > limit:
            raise PayloadTooLarge()
        left = length
        with open(target, "wb") as f:
            while left > 0:
                block = self.rfile.read(min(MIGRATE_CHUNK, left))
                if not block:
                    break
                f.write(block)
                left -= len(block)

    def read_body(self, limit=MAX_BODY):
        length = int(self.headers.get("Content-Length") or 0)
        if length > limit:
            raise PayloadTooLarge()
        return self.rfile.read(length) if length else b""

    def read_json(self):
        raw = self.read_body(MAX_JSON)
        return json.loads(raw.decode("utf-8")) if raw else {}

    def parts(self):
        return [unquote(p) for p in urlparse(self.path).path.strip("/").split("/") if p]

    def redirect(self, to, status=302):
        self.send_response(status)
        self.send_header("Location", to)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def send_html(self, html, status=200, headers=None):
        body = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # Grundlegende Sicherheits-Header (Caddy ergänzt HSTS)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "same-origin")
        super().end_headers()

    # -- Anfragende Person ------------------------------------------------
    def client_ip(self):
        if TRUST_PROXY:
            fwd = self.headers.get("X-Forwarded-For", "")
            if fwd:
                return fwd.split(",")[0].strip()
        return self.client_address[0]

    def is_local_direct(self):
        return (self.client_address[0] in ("127.0.0.1", "::1")
                and not self.headers.get("X-Forwarded-For") and not SERVER_MODE)

    def session_token(self):
        for part in (self.headers.get("Cookie") or "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == COOKIE:
                return v
        return ""

    def current_user(self):
        if hasattr(self, "_user"):
            return self._user
        self._user = None
        tok = self.session_token()
        if tok:
            with db() as conn:
                r = conn.execute("SELECT u.id, u.username, u.display_name, u.is_admin, u.active, u.member_id, s.expires "
                                 "FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash=?", (token_hash(tok),)).fetchone()
                if r and r["expires"] > time.time() and r["active"]:
                    u = {"id": r["id"], "username": r["username"], "display_name": r["display_name"] or r["username"],
                         "is_admin": bool(r["is_admin"]), "member_id": r["member_id"]}
                    u["perms"] = effective_perms(conn, u)
                    self._user = u
                elif r:
                    conn.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(tok),))
        return self._user

    def cookie_header(self, value, max_age):
        parts = [f"{COOKIE}={value}", "Path=/", "HttpOnly", "SameSite=Lax", f"Max-Age={max_age}"]
        if SECURE_COOKIES:
            parts.append("Secure")
        return "; ".join(parts)

    def start_session(self, user_id):
        tok = secrets.token_urlsafe(32)
        now = datetime.now().isoformat(timespec="seconds")
        with db() as conn:
            conn.execute("DELETE FROM sessions WHERE expires < ?", (time.time(),))
            conn.execute("INSERT INTO sessions (token_hash, user_id, expires, created_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
                         (token_hash(tok), user_id, time.time() + SESSION_DAYS * 86400, now, self.client_ip(),
                          (self.headers.get("User-Agent") or "")[:200]))
            conn.execute("UPDATE users SET last_login=? WHERE id=?", (now, user_id))
        return tok

    # -- Routing ----------------------------------------------------------
    def do_GET(self):
        self.handle_request("GET")

    def do_POST(self):
        self.handle_request("POST")

    def do_PUT(self):
        self.handle_request("PUT")

    def do_DELETE(self):
        self.handle_request("DELETE")

    def handle_request(self, method):
        try:
            self.route(method)
        except PayloadTooLarge:
            self.send_json({"error": "Datei zu groß"}, 413)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def route(self, method):
        p = self.parts()
        head = p[0] if p else ""

        # Öffentlich erreichbar
        if method == "GET" and head == "healthz":
            return self.send_json({"ok": True, "version": VERSION})
        if method == "GET" and p in (["static", "style.css"], ["static", "logo.png"], ["static", "icon.png"],
                                     ["static", "icon-192.png"], ["static", "icon-512.png"]):
            return self.serve_under(STATIC, p[1:])
        if method == "GET" and p in (["manifest.webmanifest"], ["sw.js"]):   # App auf dem Startbildschirm
            return self.send_file(STATIC / p[0])
        if head == "login" and method == "GET":
            if self.current_user():
                return self.redirect("/hub")
            if user_count() == 0:
                return self.redirect("/setup")
            return self.send_html(LOGIN_PAGE)
        if head == "setup" and method == "GET":
            if user_count() > 0:
                return self.redirect("/login")
            return self.send_html(SETUP_PAGE if self.is_local_direct() else NO_USER_PAGE)
        if head == "invite" and method == "GET" and len(p) == 2:
            with db() as conn:
                u = conn.execute("SELECT username, display_name FROM users WHERE invite_hash=? AND invite_expires > ? AND active=1",
                                 (token_hash(p[1]), time.time())).fetchone()
            if not u:
                return self.send_html(INVALID_INVITE_PAGE, 404)
            return self.send_html(INVITE_PAGE.replace("%%NAME%%", html_esc(u["display_name"] or u["username"]))
                                  .replace("%%USER%%", html_esc(u["username"])).replace("%%TOKEN%%", html_esc(p[1])))
        if head == "auth":
            return self.api_auth(method, p[1:])
        if head == "passwort-vergessen" and method == "GET":
            return self.send_html(FORGOT_SENT_PAGE if p[1:] == ["gesendet"] else FORGOT_PAGE)
        if head == "passwort-neu" and method == "GET" and len(p) == 2:
            with db() as conn:
                u = conn.execute("SELECT username, display_name FROM users WHERE reset_hash=? AND reset_expires > ? AND active=1",
                                 (token_hash(p[1]), time.time())).fetchone()
            if not u:
                return self.send_html(INVALID_RESET_PAGE, 404)
            return self.send_html(RESET_PAGE.replace("%%NAME%%", html_esc(u["display_name"] or u["username"]))
                                  .replace("%%USER%%", html_esc(u["username"])).replace("%%TOKEN%%", html_esc(p[1])))
        if head == "bestellen":
            return self.public_order(method, p[1:])
        if head == "teilen" and method == "GET" and len(p) == 3:
            # Bild für Instagram: nur mit gültiger Signatur, nur Bilddateien
            name = p[2]
            if re.fullmatch(r"[A-Za-z0-9._-]{1,120}", name) and Path(name).suffix.lower() in SHARE_EXT \
                    and hmac.compare_digest(p[1], share_sig(social_config()["share_key"], name)):
                return self.serve_under(MEDIA, [name], inline=MEDIA_INLINE)
            return self.send_error(404)
        if head == "api" and p[1:2] == ["public"]:
            return self.api_public(method, p[2:])
        if head == "kontakt" and method == "POST":
            return self.public_contact()
        # Öffentliche Webseite: Seiten, Dateien unter /web/assets, sonst 404-Seite (Hub-Pfade brauchen weiter Login)
        if method == "GET" and len(p) == 1 and head in website.REDIRECTS:   # alte Adressen der ersten Fassung
            q = urlparse(self.path).query
            return self.redirect(website.REDIRECTS[head] + ("?" + q if q else ""), 301)
        if method == "GET" and (not p or (len(p) == 1 and head in website.PAGES)):
            return self.send_site(head)
        if method == "GET" and p[:2] == ["web", "assets"]:
            return self.serve_under(website.WEB / "assets", p[2:], cache=True)
        if method == "GET" and p[:2] == ["web", "insta"] and len(p) == 3:
            return self.serve_under(INSTA_DIR, p[2:], cache=True)
        if method == "GET" and head not in ("hub", "static", "media", "api"):
            return self.send_site("404", 404)

        # Ab hier nur mit Anmeldung
        user = self.current_user()
        if not user:
            if head == "api":
                return self.send_json({"error": "Nicht angemeldet"}, 401)
            return self.redirect("/login")

        if method != "GET" and self.headers.get("X-TMH") != "1":
            return self.send_json({"error": "Ungültige Anfrage"}, 403)

        if p == ["hub"] and method == "GET":   # der Hub (Mitgliederbereich)
            return self.send_file(STATIC / "index.html")
        if head == "static" and method == "GET":
            return self.serve_under(STATIC, p[1:])
        if head == "media" and method == "GET":
            return self.serve_under(MEDIA, p[1:], inline=MEDIA_INLINE)
        if head == "api":
            return self.api(method, p[1:], user)
        return self.send_error(404)

    def serve_under(self, root: Path, rest, inline=None, cache=False):
        target = (root / "/".join(rest)).resolve()
        if root.resolve() not in target.parents and target != root.resolve():
            return self.send_error(403)
        # Hochgeladene Dokumente (HTML, SVG, Office ...) nie im Hub-Kontext öffnen, sondern herunterladen
        download = target.name if inline is not None and target.suffix.lower() not in inline else None
        return self.send_file(target, download, cache)

    def send_site(self, slug, status=200):
        """Seite der öffentlichen Webseite aus den öffentlichen Daten bauen."""
        data = {"info": public_info(), "games": public_games(), "team": public_team(), "sponsors": public_sponsors(),
                "instagram": public_instagram() if slug == "" else []}
        q = parse_qs(urlparse(self.path).query)
        sent = (q.get("gesendet") or [None])[0]
        data["preselect"] = (q.get("anliegen") or [""])[0]   # Vorauswahl im Kontaktformular (website.py prüft den Wert)
        return self.send_html(website.render(slug, data, sent), status)

    # -- Anmeldung --------------------------------------------------------
    def api_auth(self, method, p):
        name = p[0] if p else ""
        if method != "POST" or self.headers.get("X-TMH") != "1":
            return self.send_json({"error": "Ungültige Anfrage"}, 403)
        if name == "login":
            ip = self.client_ip()
            if login_blocked(ip):
                return self.send_json({"error": "Zu viele Fehlversuche. Bitte in 10 Minuten erneut versuchen."}, 429)
            data = self.read_json()
            with db() as conn:
                u = conn.execute("SELECT * FROM users WHERE username=?", ((data.get("username") or "").strip(),)).fetchone()
            if not u or not u["active"] or not check_pw(data.get("password") or "", u["pw_hash"]):
                login_failed(ip)
                time.sleep(0.6)
                return self.send_json({"error": "Benutzername oder Passwort falsch."}, 401)
            tok = self.start_session(u["id"])
            body = json.dumps({"ok": True}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Set-Cookie", self.cookie_header(tok, SESSION_DAYS * 86400))
            self.end_headers()
            self.wfile.write(body)
            return
        if name == "logout":
            tok = self.session_token()
            if tok:
                with db() as conn:
                    conn.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(tok),))
            body = b'{"ok": true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Set-Cookie", self.cookie_header("", 0))
            self.end_headers()
            self.wfile.write(body)
            return
        if name == "invite":
            data = self.read_json()
            tok = data.get("token") or ""
            with db() as conn:
                u = conn.execute("SELECT * FROM users WHERE invite_hash=? AND invite_expires > ? AND active=1",
                                 (token_hash(tok), time.time())).fetchone()
            if not u:
                return self.send_json({"error": "Der Einladungslink ist ungültig oder abgelaufen."}, 400)
            prob = pw_problem(data.get("password") or "")
            if prob:
                return self.send_json({"error": prob}, 400)
            with db() as conn:
                conn.execute("UPDATE users SET pw_hash=?, invite_hash=NULL, invite_expires=NULL WHERE id=?", (hash_pw(data["password"]), u["id"]))
                conn.execute("DELETE FROM sessions WHERE user_id=?", (u["id"],))
            tok2 = self.start_session(u["id"])
            body = json.dumps({"ok": True}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Set-Cookie", self.cookie_header(tok2, SESSION_DAYS * 86400))
            self.end_headers()
            self.wfile.write(body)
            return
        if name == "forgot":
            # Immer dieselbe Antwort, egal ob es das Konto gibt (keine Auskunft über Konten)
            if reset_rate_ok("ip", self.client_ip()):
                request_password_reset(self.read_json().get("login"), self.base_url())
            time.sleep(0.4)
            return self.send_json({"ok": True})
        if name == "reset":
            data = self.read_json()
            tok = data.get("token") or ""
            with db() as conn:
                u = conn.execute("SELECT * FROM users WHERE reset_hash=? AND reset_expires > ? AND active=1", (token_hash(tok), time.time())).fetchone()
            if not u:
                return self.send_json({"error": "Der Link ist ungültig oder abgelaufen. Bitte unter „Passwort vergessen“ einen neuen anfordern."}, 400)
            prob = pw_problem(data.get("password") or "")
            if prob:
                return self.send_json({"error": prob}, 400)
            with db() as conn:
                conn.execute("UPDATE users SET pw_hash=?, reset_hash=NULL, reset_expires=NULL, invite_hash=NULL, invite_expires=NULL WHERE id=?",
                             (hash_pw(data["password"]), u["id"]))
                conn.execute("DELETE FROM sessions WHERE user_id=?", (u["id"],))   # überall abmelden
                audit(conn, "Passwort vergessen", "Passwort per Link neu gesetzt", "users", u["id"], u["display_name"] or u["username"])
                email = account_email(conn, u)
            cfg = smtp_config()
            if email and cfg["smtp_host"]:
                body = (f"Hallo {u['display_name'] or u['username']},\n\ndas Passwort für dein Konto im Emden Tigers Hub (Benutzername: {u['username']}) "
                        f"wurde gerade über „Passwort vergessen“ geändert ({datetime.now():%d.%m.%Y %H:%M}).\n\n"
                        "Warst du das nicht? Dann melde dich bitte sofort beim Vorstand bzw. Admin.")
                threading.Thread(target=lambda: send_mail(cfg, email, "Tigers Hub: Dein Passwort wurde geändert", body, footer=False), daemon=True).start()
            tok2 = self.start_session(u["id"])
            body = json.dumps({"ok": True}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Set-Cookie", self.cookie_header(tok2, SESSION_DAYS * 86400))
            self.end_headers()
            self.wfile.write(body)
            return
        if name == "setup":
            if user_count() > 0 or not self.is_local_direct():
                return self.send_json({"error": "Ersteinrichtung nicht möglich."}, 403)
            data = self.read_json()
            try:
                create_user(data.get("username"), data.get("password") or "", is_admin=True)
            except ValueError as e:
                return self.send_json({"error": str(e)}, 400)
            return self.send_json({"ok": True})
        return self.send_json({"error": "Unbekannter Pfad"}, 404)

    # -- Öffentliche Schnittstelle für die Webseite (ohne Login, nur lesen) --
    def api_public(self, method, p):
        what = p[0] if p else ""
        if method != "GET" or len(p) != 1:
            return self.send_json({"error": "Nicht gefunden"}, 404)
        fn = {"info": public_info, "spielplan": public_games, "team": public_team, "sponsoren": public_sponsors}.get(what)
        if not fn:
            return self.send_json({"error": "Nicht gefunden"}, 404)
        body = json.dumps(fn(), ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=300")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    # -- Kontaktformular der Webseite (ohne Login, funktioniert ohne JavaScript) --
    def public_contact(self):
        back = lambda res: self.redirect(f"/kontakt?gesendet={res}#formular")
        try:
            raw = self.read_body(20000).decode("utf-8")
        except (PayloadTooLarge, UnicodeDecodeError):
            return back("fehler")
        f = {k: (v[0] or "").strip() for k, v in parse_qs(raw).items()}
        if f.get("website"):                       # verstecktes Feld: nur Bots füllen es aus, still verwerfen
            return back("ok")
        if not reset_rate_ok("ip", "kontakt:" + self.client_ip()):
            return back("fehler")
        name, email, phone, msg = f.get("name", "")[:100], f.get("email", "")[:150], f.get("phone", "")[:40], f.get("message", "")[:3000]
        source = f.get("anliegen") if f.get("anliegen") in CONTACT_TOPICS else "Webseite"
        if not name or not msg or f.get("consent") != "1" or not (email or phone):
            return back("fehler")
        if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            return back("fehler")
        now = datetime.now().isoformat(timespec="seconds")
        with db() as conn:
            cur = conn.execute("INSERT INTO contact_requests (name, email, phone, message, source, status, created, created_at, updated_at) "
                               "VALUES (?, ?, ?, ?, ?, 'Neu', ?, ?, ?)", (name, email, phone, msg, source, now, now, now))
            audit(conn, "Webseite", "neu", "contact_requests", cur.lastrowid, name)
            to = get_setting(conn, "site_contact_email")
        text = f"Neue Anfrage über die Webseite ({source})\n\nName: {name}\nE-Mail: {email or '-'}\nTelefon: {phone or '-'}\n\n{msg}"
        cfg = smtp_config()
        if to and cfg["smtp_host"]:
            threading.Thread(target=lambda: send_mail(cfg, to, f"Webseite: Anfrage von {name}", text, footer=False), daemon=True).start()
        notify_async("contact_request", f"Neue Anfrage von {name}", text + "\n\nIm Hub unter Mitglieder > Anfragen.")
        return back("ok")

    # -- Öffentlicher Bestell-Link (Teamkleidung) -------------------------
    # Nur über den geheimen Link erreichbar. Liefert ausschließlich: Infos zum Artikel, die Bestellfelder,
    # die öffentliche Liste (ohne interne Felder, ohne „bezahlt“) und nimmt neue Bestellungen an.
    def public_order(self, method, p):
        tok = p[0] if p else ""
        a = None
        if re.fullmatch(r"[A-Za-z0-9_-]{16,64}", tok):
            with db() as conn:
                a = conn.execute("SELECT * FROM apparel WHERE public_token=?", (tok,)).fetchone()
        sub = p[1] if len(p) > 1 else ""
        if not a or len(p) > 2:
            if method == "GET" and sub == "":
                return self.send_html(ORDER_INVALID_PAGE, 404)
            return self.send_json({"error": "Dieser Bestell-Link ist ungültig."}, 404)
        fields = apparel_fields(a)
        if method == "GET" and sub == "":
            return self.send_file(STATIC / "order.html")
        if method == "GET" and sub == "bild":
            img = a["image"] or ""
            if not img.startswith("/media/"):
                return self.send_error(404)
            return self.serve_under(MEDIA, [img.rsplit("/", 1)[-1]], inline=MEDIA_INLINE)
        if sub != "daten":
            return self.send_error(404)
        if method == "GET":
            orders, rows = [], []
            with db() as conn:
                club = get_setting(conn, "club_name") or APP_NAME
                if a["show_list"]:
                    rows = conn.execute("SELECT data, quantity FROM apparel_orders WHERE apparel_id=? ORDER BY id", (a["id"],)).fetchall()
            if rows:
                public = [f["key"] for f in fields if not f.get("internal")]
                for r in rows:
                    try:
                        d = json.loads(r["data"] or "{}")
                    except ValueError:
                        d = {}
                    orders.append({"data": {k: d.get(k, "") for k in public}, "quantity": r["quantity"] or 1})
            return self.send_json({
                "name": a["name"], "description": a["description"] or "", "image": bool(a["image"]),
                "price": a["price"], "deadline": a["deadline"] or "", "open": apparel_open(a), "show_list": bool(a["show_list"]),
                "fields": [{k: f.get(k) for k in ("key", "label", "type", "options", "required", "internal")} for f in fields],
                "orders": orders, "club": club,
            })
        if method == "POST":
            if self.headers.get("X-TMH") != "1":
                return self.send_json({"error": "Ungültige Anfrage"}, 403)
            if not apparel_open(a):
                return self.send_json({"error": "Für diesen Artikel ist der Bestellschluss vorbei."}, 400)
            if not order_rate_ok(self.client_ip()):
                return self.send_json({"error": "Zu viele Bestellungen in kurzer Zeit. Bitte später erneut versuchen."}, 429)
            try:
                data = json.loads(self.read_body(20000).decode("utf-8") or "{}")
            except ValueError:
                return self.send_json({"error": "Ungültige Bestellung."}, 400)
            vals, qty, err = clean_order(fields, data.get("data"), data.get("quantity", 1))
            if err:
                return self.send_json({"error": err}, 400)
            now = datetime.now().isoformat(timespec="seconds")
            with db() as conn:
                cur = conn.execute("INSERT INTO apparel_orders (apparel_id, data, quantity, paid, source, created, created_at, updated_at) "
                                   "VALUES (?, ?, ?, 0, 'Link', ?, ?, ?)", (a["id"], json.dumps(vals, ensure_ascii=False), qty, now, now, now))
                audit(conn, "Bestell-Link", "neu", "apparel_orders", cur.lastrowid, a["name"], {**vals, "Menge": qty})
            return self.send_json({"ok": True, "number": cur.lastrowid})
        return self.send_json({"error": "Methode nicht erlaubt"}, 405)

    # -- API --------------------------------------------------------------
    def deny(self, msg="Dafür fehlen dir die Rechte."):
        return self.send_json({"error": msg}, 403)

    def base_url(self):
        host = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or f"127.0.0.1:{PORT}"
        proto = self.headers.get("X-Forwarded-Proto") if TRUST_PROXY else None
        return f"{proto or ('https' if SECURE_COOKIES else 'http')}://{host}"

    def api(self, method, p, user):
        try:
            if not p:
                return self.send_json({"app": APP_NAME, "version": VERSION})
            name = p[0]
            self.user = user   # für das Änderungsprotokoll
            perms = user["perms"]
            admin = user["is_admin"]
            can = lambda area, lvl=1: perms.get(area, 0) >= lvl
            any_read = any(v >= 1 for v in perms.values())
            any_write = any(v >= 2 for v in perms.values())

            # --- eigenes Konto und Profil (alle)
            if name == "me":
                if method == "GET":
                    with db() as conn:
                        groups = [r["name"] for r in conn.execute(
                            "SELECT g.name FROM user_groups ug JOIN groups g ON g.id = ug.group_id WHERE ug.user_id=? ORDER BY g.sort, g.name", (user["id"],))]
                    return self.send_json({**user, "groups": groups, "areas": AREAS, "server": SERVER_MODE, "data": str(DATA) if admin else ""})
                if method == "PUT" and len(p) > 1 and p[1] == "password":
                    data = self.read_json()
                    with db() as conn:
                        u = conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
                    if not check_pw(data.get("old") or "", u["pw_hash"]):
                        return self.send_json({"error": "Das bisherige Passwort stimmt nicht."}, 400)
                    prob = pw_problem(data.get("new") or "")
                    if prob:
                        return self.send_json({"error": prob}, 400)
                    with db() as conn:
                        conn.execute("UPDATE users SET pw_hash=?, reset_hash=NULL, reset_expires=NULL WHERE id=?", (hash_pw(data["new"]), user["id"]))
                        conn.execute("DELETE FROM sessions WHERE user_id=? AND token_hash != ?", (user["id"], token_hash(self.session_token())))
                    return self.send_json({"ok": True})
            if name == "profile":
                return self.api_profile(method, user)

            # --- Verwaltung (nur Admins)
            if name == "admin":
                if not admin:
                    return self.deny("Nur für Admins.")
                return self.api_admin(method, p[1:], user)
            if name == "restore" and method == "POST":
                if not admin:
                    return self.deny("Nur für Admins.")
                try:
                    res = restore_backup(self.read_body())
                    with db() as conn:
                        audit(conn, user, "Backup eingespielt", "backup", None, f"{res.get('media', 0)} neue Bilder")
                    return self.send_json(res)
                except ValueError as e:
                    return self.send_json({"error": str(e)}, 400)
            if name in ("backup", "export", "backups"):
                if not admin:
                    return self.deny("Nur für Admins.")
                if name == "backups" and method == "GET":
                    files = sorted(BACKUPS.glob("*.db"), reverse=True)
                    return self.send_json([{"name": f.name, "size": f.stat().st_size} for f in files])
                if name == "backup" and method == "GET":
                    with db() as conn:
                        audit(conn, user, "Backup heruntergeladen", "backup")
                    return self.api_backup()
                if name == "export" and method == "GET":
                    return self.api_export()

            if name == "settings":
                if method != "GET" and not admin:
                    return self.deny("Nur Admins können Einstellungen ändern.")
                return self.api_settings(method)
            if name == "dashboard" and method == "GET":
                return self.api_dashboard(perms)
            if name == "upload" and method == "POST":
                if not any_write:
                    return self.deny()
                return self.api_upload(library=can("medien", 2))
            if name == "sheet-sync" and method == "POST":
                if not can("medien", 2):
                    return self.deny()
                return self.send_json(sync_sheet())

            if name == "social":
                return self.api_social(method, p[1:], user, can)
            if name == "notify":
                return self.api_notify(method, p[1:], user)
            if name == "migrate":
                if not admin:
                    return self.deny("Nur für Admins.")
                return self.api_migrate(method, p[1:], user)

            if name == "apparel" and method == "POST" and len(p) == 3 and p[2] == "book":
                # Sammelbuchung: alle bezahlten, noch nicht gebuchten Bestellungen als eine Einnahme
                if not can("finanzen", 2):
                    return self.deny("Für Buchungen braucht es Bearbeiten-Rechte bei Finanzen.")
                with db() as conn:
                    a = conn.execute("SELECT * FROM apparel WHERE id=?", (int(p[1]),)).fetchone()
                    if not a:
                        return self.send_json({"error": "Artikel nicht gefunden."}, 404)
                    if not a["price"]:
                        return self.send_json({"error": "Für den Artikel ist kein Preis eingetragen."}, 400)
                    rows = conn.execute("SELECT id, quantity FROM apparel_orders WHERE apparel_id=? AND paid=1 AND booked_tx IS NULL", (a["id"],)).fetchall()
                    if not rows:
                        return self.send_json({"error": "Es gibt keine neuen bezahlten Bestellungen."}, 400)
                    pcs = sum(r["quantity"] or 1 for r in rows)
                    now = datetime.now().isoformat(timespec="seconds")
                    vals = {"date": now[:10], "kind": "Einnahme", "category": "Teamkleidung",
                            "description": f"{a['name']}: {len(rows)} Bestellung{'en' if len(rows) > 1 else ''}, {pcs} Stück",
                            "amount": round(a["price"] * pcs, 2), "status": "Erledigt", "paid_by": "Besteller",
                            "notes": "Bestellnummern: " + ", ".join(f"#{r['id']}" for r in rows), "created_at": now, "updated_at": now}
                    cur = conn.execute(f"INSERT INTO transactions ({', '.join(vals)}) VALUES ({', '.join('?' for _ in vals)})", list(vals.values()))
                    conn.execute(f"UPDATE apparel_orders SET booked_tx=? WHERE id IN ({', '.join('?' for _ in rows)})", [cur.lastrowid, *[r["id"] for r in rows]])
                    audit(conn, user, "neu", "transactions", cur.lastrowid, vals["description"], {"Betrag": vals["amount"], "Bestellungen": vals["notes"]})
                return self.send_json({"ok": True, "transaction_id": cur.lastrowid, "amount": vals["amount"], "orders": len(rows)})

            if name == "apparel" and method == "POST" and len(p) == 3 and p[2] == "new-link":
                if max(perms.get(a, 0) for a in TABLE_AREAS_ANY["apparel"]) < 2:
                    return self.deny()
                with db() as conn:
                    conn.execute("UPDATE apparel SET public_token=? WHERE id=?", (secrets.token_urlsafe(18), int(p[1])))
                    a = conn.execute("SELECT name FROM apparel WHERE id=?", (int(p[1]),)).fetchone()
                    audit(conn, user, "neuer Bestell-Link", "apparel", int(p[1]), a["name"] if a else "")
                return self.send_json({"ok": True})

            if name in TABLES:
                area = TABLE_AREA.get(name)
                lvl = max(perms.get(a, 0) for a in TABLE_AREAS_ANY.get(name, (area,)))
                if method == "GET":
                    if not (lvl >= 1 or (name in SHARED_READ and any_read)):
                        return self.deny()
                elif name == "media" and method == "POST":
                    return self.deny()
                elif lvl < 2:
                    return self.deny(f"Für den Bereich {AREAS.get(area, area)} hast du nur Leserechte.")
                rid = int(p[1]) if len(p) > 1 else None
                return self.api_table(method, name, rid, perms)

            return self.send_json({"error": "Unbekannter Pfad"}, 404)
        except PayloadTooLarge:
            raise
        except Exception as e:  # noqa
            print("Fehler:", repr(e))
            return self.send_json({"error": str(e)}, 500)

    # -- Serverumzug (nur Admins) ------------------------------------------
    def api_migrate(self, method, p, user):
        sub = p[0] if p else ""
        if method == "POST" and sub == "export":
            pw = self.read_json().get("password") or ""
            if len(pw) < 10:
                return self.send_json({"error": "Das Passwort für die Umzugsdatei braucht mindestens 10 Zeichen."}, 400)
            with db() as conn:   # vorher protokollieren, damit der Eintrag mit umzieht
                audit(conn, user, "Komplett-Export erstellt", "backup", None, "Serverumzug")
            path = migrate_export(pw)
            return self.send_json({"download": f"/api/migrate/download/{path.stem[len('_umzug_'):]}", "size": path.stat().st_size})
        if method == "GET" and sub == "download" and len(p) == 2 and re.fullmatch(r"[0-9a-f]{32}", p[1]):
            path = DATA / f"_umzug_{p[1]}.tigers"
            if not path.is_file():
                return self.send_json({"error": "Die Umzugsdatei ist nicht mehr da. Bitte neu erstellen."}, 404)
            try:
                return self.send_stream(path, f"EmdenTigersHub-Umzug-{datetime.now():%Y-%m-%d}.tigers")
            finally:
                path.unlink(missing_ok=True)   # nur einmal herunterladbar
        if method == "POST" and sub == "import":
            try:
                pw = base64.b64decode(self.headers.get("X-Umzug-Passwort") or "").decode("utf-8")
            except ValueError:
                pw = ""
            if not pw:
                return self.send_json({"error": "Bitte das Passwort der Umzugsdatei angeben."}, 400)
            upload = DATA / f"_umzug_upload_{secrets.token_hex(8)}.tigers"
            try:
                self.save_body(upload, MIGRATE_MAX)
                res = migrate_import(upload, pw)
            except ValueError as e:
                return self.send_json({"error": str(e)}, 400)
            finally:
                upload.unlink(missing_ok=True)
            with db() as conn:
                audit(conn, user, "Komplett-Import eingespielt", "backup", None, "Serverumzug", res)
            return self.send_json(res)
        return self.send_json({"error": "Unbekannter Pfad"}, 404)

    # -- E-Mail-Versand (nur Admins) ---------------------------------------
    def api_notify(self, method, p, user):
        if not user["is_admin"]:
            return self.deny("Nur Admins können den E-Mail-Versand einrichten.")
        sub = p[0] if p else ""
        if method == "GET" and not sub:
            with db() as conn:
                cfg = {k: secret_get(conn, k) for k in SMTP_KEYS}
                cfg["password_set"] = bool(secret_get(conn, "smtp_password"))
                cfg["last_error"] = secret_get(conn, "smtp_last_error")
            return self.send_json(cfg)
        if method == "PUT" and not sub:
            data = self.read_json()
            with db() as conn:
                for k in SMTP_KEYS:
                    if k in data:
                        secret_set(conn, k, str(data[k] or "").strip())
                if (data.get("smtp_password") or "").strip():
                    secret_set(conn, "smtp_password", data["smtp_password"].strip())
                audit(conn, user, "geändert", "settings", None, "E-Mail-Versand", {k: audit_short(data.get(k)) for k in SMTP_KEYS if k in data})
            return self.send_json({"ok": True})
        if method == "POST" and sub == "test":
            to = (self.read_json().get("to") or "").strip()
            if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", to):
                return self.send_json({"error": "Bitte eine gültige E-Mail-Adresse angeben."}, 400)
            cfg = smtp_config()
            if not cfg["smtp_host"]:
                return self.send_json({"error": "Es ist noch kein Mailserver eingetragen."}, 400)
            err = send_mail(cfg, to, "Tigers Hub: Test-Nachricht", "Der E-Mail-Versand des Emden Tigers Hub funktioniert.")
            if err:
                return self.send_json({"error": f"Versand fehlgeschlagen: {err}"}, 400)
            return self.send_json({"ok": True})
        return self.send_json({"error": "Unbekannter Pfad"}, 404)

    # -- Auto-Posting (Facebook/Instagram) ---------------------------------
    def api_social(self, method, p, user, can):
        sub = p[0] if p else ""
        if method == "GET" and not sub:
            if not can("medien", 1):
                return self.deny()
            cfg = social_config()
            return self.send_json({"connected": bool(cfg["fb_token"]), "page": cfg["fb_page_name"], "instagram": cfg["ig_username"],
                                   "public_url": cfg["public_url"], "is_admin": bool(user["is_admin"])})
        if method == "GET" and sub in ("insights", "online"):
            if not can("medien", 1):
                return self.deny()
            cfg = social_config()
            if not cfg["fb_token"]:
                return self.send_json({"error": "Es ist noch keine Facebook-Seite verbunden."}, 400)
            q = parse_qs(urlparse(self.path).query)
            refresh = (q.get("refresh") or [""])[0] == "1"
            if sub == "insights":
                days = 7 if (q.get("days") or ["28"])[0] == "7" else 28
                return self.send_json(social_cached(f"insights{days}", refresh, lambda: social_insights(cfg, days)))
            return self.send_json(social_cached("online", refresh, lambda: social_online(cfg)))
        if sub == "connection":
            if not user["is_admin"]:
                return self.deny("Nur Admins können die Verbindung einrichten.")
            SOCIAL_CACHE.clear()
            if method == "DELETE":
                with db() as conn:
                    for k in ("fb_token", "fb_page_id", "fb_page_name", "ig_user_id", "ig_username"):
                        secret_set(conn, k, "")
                    audit(conn, user, "Verbindung getrennt", "social", None, "Facebook/Instagram")
                return self.send_json({"ok": True})
            if method == "PUT":
                data = self.read_json()
                token = (data.get("token") or "").strip() or social_config()["fb_token"]
                if not token:
                    return self.send_json({"error": "Bitte das Seiten-Token eintragen."}, 400)
                try:
                    res = social_connect(token, data.get("public_url"))
                    with db() as conn:
                        audit(conn, user, "verbunden", "social", None, "Facebook/Instagram", res)
                    return self.send_json(res)
                except GraphError as e:
                    return self.send_json({"error": f"Verbindung fehlgeschlagen: {e}"}, 400)
                except (KeyError, TypeError):
                    return self.send_json({"error": "Das Token gehört zu keiner Facebook-Seite. Bitte ein Seiten-Token verwenden."}, 400)
        if sub == "publish" and method == "POST":
            if not can("medien", 2):
                return self.deny()
            data = self.read_json()
            cfg = social_config()
            if not cfg["fb_token"]:
                return self.send_json({"error": "Es ist noch keine Facebook-Seite verbunden."}, 400)
            with SOCIAL_LOCK, db() as conn:
                if data.get("post_id"):
                    row = conn.execute("SELECT * FROM posts WHERE id=?", (int(data["post_id"]),)).fetchone()
                    if not row:
                        return self.send_json({"error": "Post nicht gefunden."}, 404)
                    if row["publish_state"] in ("gepostet", "läuft") and not data.get("again"):
                        return self.send_json({"error": "Dieser Post ist schon gepostet."}, 400)
                    conn.execute("UPDATE posts SET publish_state='läuft' WHERE id=?", (row["id"],))
                elif data.get("rule_id"):
                    row = conn.execute("SELECT * FROM story_rules WHERE id=?", (int(data["rule_id"]),)).fetchone()
                    if not row:
                        return self.send_json({"error": "Regel nicht gefunden."}, 404)
                else:
                    return self.send_json({"error": "Nichts ausgewählt."}, 400)
            with SOCIAL_LOCK:
                state, log = publish_post(cfg, row) if data.get("post_id") else publish_rule(cfg, row)
            with db() as conn:
                audit(conn, user, "jetzt gepostet", "posts" if data.get("post_id") else "story_rules", row["id"],
                      row["title"] if data.get("post_id") else row["name"], {"Ergebnis": log})
            return self.send_json({"state": state, "log": log})
        if sub == "reset" and method == "POST":
            # Post nach Fehler oder verpasstem Termin wieder einplanen
            if not can("medien", 2):
                return self.deny()
            with db() as conn:
                conn.execute("UPDATE posts SET publish_state=NULL WHERE id=? AND publish_state IN ('fehler', 'verpasst', 'teilweise', 'läuft')",
                             (int(self.read_json().get("post_id") or 0),))
            return self.send_json({"ok": True})
        return self.send_json({"error": "Unbekannter Pfad"}, 404)

    # -- Eigenes Profil ---------------------------------------------------
    PROFILE_FIELDS = ("email", "phone", "street", "zip", "city", "emergency_contact", "consent_photo")

    def api_profile(self, method, user):
        with db() as conn:
            if method == "PUT":
                data = self.read_json()
                if "display_name" in data:
                    conn.execute("UPDATE users SET display_name=? WHERE id=?", ((data["display_name"] or "").strip()[:80] or user["username"], user["id"]))
                if "account_email" in data or "notify_email" in data:
                    # E-Mail des Kontos: für Benachrichtigungen und „Passwort vergessen“
                    email = (data.get("account_email", data.get("notify_email")) or "").strip()
                    if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
                        return self.send_json({"error": "Bitte eine gültige E-Mail-Adresse angeben."}, 400)
                    conn.execute("UPDATE users SET email=? WHERE id=?", (email, user["id"]))
                if "notify" in data:
                    kinds = [k for k in (data["notify"] or []) if k in NOTIFY_KINDS and notify_allowed(user["perms"], k)]
                    conn.execute("UPDATE users SET notify=? WHERE id=?", (json.dumps(kinds), user["id"]))
                if user["member_id"]:
                    vals = clean_values("members", {k: v for k, v in data.items() if k in self.PROFILE_FIELDS})
                    if vals:
                        vals["updated_at"] = datetime.now().isoformat(timespec="seconds")
                        conn.execute(f"UPDATE members SET {', '.join(f'{k}=?' for k in vals)} WHERE id=?", [*vals.values(), user["member_id"]])
            u = conn.execute("SELECT username, display_name, email, notify FROM users WHERE id=?", (user["id"],)).fetchone()
            m = conn.execute("SELECT * FROM members WHERE id=?", (user["member_id"],)).fetchone() if user["member_id"] else None
            pl = None
            if m and m["player_id"]:
                pl = conn.execute("SELECT number, position, unit, role, kind FROM players WHERE id=?", (m["player_id"],)).fetchone()
            kinds = [{"key": k, "label": v[0]} for k, v in NOTIFY_KINDS.items() if notify_allowed(user["perms"], k)]
            mail_ready = bool(secret_get(conn, "smtp_host"))
            return self.send_json({"account": row_dict(u), "member": row_dict(m) if m else None, "player": row_dict(pl) if pl else None,
                                   "notify_kinds": kinds, "mail_ready": mail_ready})

    # -- Konten, Gruppen, Rechte ------------------------------------------
    def user_payload(self, conn, uid):
        u = conn.execute("SELECT id, username, display_name, email, is_admin, active, member_id, created_at, last_login, "
                         "invite_expires, pw_hash != '' AS has_pw FROM users WHERE id=?", (uid,)).fetchone()
        d = row_dict(u)
        d["is_admin"] = bool(d["is_admin"])
        d["groups"] = [r["group_id"] for r in conn.execute("SELECT group_id FROM user_groups WHERE user_id=?", (uid,))]
        d["overrides"] = {r["area"]: r["level"] for r in conn.execute("SELECT area, level FROM user_perms WHERE user_id=?", (uid,))}
        d["effective"] = effective_perms(conn, {"id": uid, "is_admin": d["is_admin"]})
        d["invite_open"] = bool(d.pop("invite_expires") or 0) and not d["has_pw"]
        return d

    def save_user_links(self, conn, uid, data):
        if "groups" in data:
            conn.execute("DELETE FROM user_groups WHERE user_id=?", (uid,))
            for gid in data["groups"] or []:
                conn.execute("INSERT OR IGNORE INTO user_groups (user_id, group_id) VALUES (?, ?)", (uid, int(gid)))
        if "overrides" in data:
            conn.execute("DELETE FROM user_perms WHERE user_id=?", (uid,))
            for area, lvl in (data["overrides"] or {}).items():
                if area in AREAS and lvl not in (None, "") and int(lvl) in (0, 1, 2):
                    conn.execute("INSERT INTO user_perms (user_id, area, level) VALUES (?, ?, ?)", (uid, area, int(lvl)))
        if "member_id" in data:
            mid = data["member_id"] or None
            conn.execute("UPDATE members SET user_id=NULL WHERE user_id=?", (uid,))
            conn.execute("UPDATE users SET member_id=? WHERE id=?", (mid, uid))
            if mid:
                conn.execute("UPDATE users SET member_id=NULL WHERE member_id=? AND id != ?", (mid, uid))
                conn.execute("UPDATE members SET user_id=? WHERE id=?", (uid, mid))

    def api_admin(self, method, p, me):
        what = p[0] if p else ""
        rid = int(p[1]) if len(p) > 1 and p[1].isdigit() else None
        sub = p[2] if len(p) > 2 else ""

        if what == "log" and method == "GET":
            q = parse_qs(urlparse(self.path).query)
            limit = min(1000, max(50, int((q.get("limit") or ["300"])[0] or 300)))
            with db() as conn:
                rows = conn.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
            return self.send_json([row_dict(r) for r in rows])
        if method != "GET" and what in ("users", "groups"):
            name = None
            with db() as conn:
                if rid and what == "users":
                    u = conn.execute("SELECT username, display_name FROM users WHERE id=?", (rid,)).fetchone()
                    name = u and (u["display_name"] or u["username"])
                elif rid:
                    g = conn.execute("SELECT name FROM groups WHERE id=?", (rid,)).fetchone()
                    name = g and g["name"]
                act = {"POST": "neu", "PUT": "geändert", "DELETE": "gelöscht"}.get(method, method)
                audit(conn, me, f"{act}{' (' + sub + ')' if sub else ''}", what, rid, name or "")

        if what == "users":
            if method == "GET":
                with db() as conn:
                    ids = [r["id"] for r in conn.execute("SELECT id FROM users ORDER BY COALESCE(display_name, username) COLLATE NOCASE")]
                    return self.send_json([self.user_payload(conn, i) for i in ids])
            if method == "POST" and rid is None:
                data = self.read_json()
                try:
                    uid, tok = create_user(data.get("username"), None, bool(data.get("is_admin")), data.get("display_name") or "",
                                           data.get("email") or "", data.get("member_id") or None)
                except ValueError as e:
                    return self.send_json({"error": str(e)}, 400)
                with db() as conn:
                    self.save_user_links(conn, uid, {k: v for k, v in data.items() if k in ("groups", "overrides")})
                    return self.send_json({"user": self.user_payload(conn, uid), "invite": f"{self.base_url()}/invite/{tok}"}, 201)
            if method == "POST" and rid and sub == "invite":
                with db() as conn:
                    if not conn.execute("SELECT 1 FROM users WHERE id=?", (rid,)).fetchone():
                        return self.send_json({"error": "Konto nicht gefunden"}, 404)
                    tok = new_invite(conn, rid)
                return self.send_json({"invite": f"{self.base_url()}/invite/{tok}", "days": INVITE_DAYS})
            if method == "PUT" and rid:
                data = self.read_json()
                with db() as conn:
                    u = conn.execute("SELECT * FROM users WHERE id=?", (rid,)).fetchone()
                    if not u:
                        return self.send_json({"error": "Konto nicht gefunden"}, 404)
                    is_admin = bool(data.get("is_admin", u["is_admin"]))
                    active = bool(data.get("active", u["active"]))
                    if rid == me["id"] and (not is_admin or not active):
                        return self.send_json({"error": "Du kannst dir die Admin-Rechte nicht selbst entziehen oder dich deaktivieren."}, 400)
                    if "username" in data and data["username"] != u["username"]:
                        try:
                            name = check_username(data["username"])
                        except ValueError as e:
                            return self.send_json({"error": str(e)}, 400)
                        if conn.execute("SELECT 1 FROM users WHERE username=? AND id != ?", (name, rid)).fetchone():
                            return self.send_json({"error": "Diesen Benutzernamen gibt es schon."}, 400)
                        conn.execute("UPDATE users SET username=? WHERE id=?", (name, rid))
                    conn.execute("UPDATE users SET display_name=?, email=?, is_admin=?, active=? WHERE id=?",
                                 ((data.get("display_name") or u["display_name"] or u["username"]).strip()[:80],
                                  (data.get("email") if "email" in data else u["email"]) or "", 1 if is_admin else 0, 1 if active else 0, rid))
                    if not active:
                        conn.execute("DELETE FROM sessions WHERE user_id=?", (rid,))
                    self.save_user_links(conn, rid, data)
                    return self.send_json(self.user_payload(conn, rid))
            if method == "DELETE" and rid:
                if rid == me["id"]:
                    return self.send_json({"error": "Du kannst dich nicht selbst löschen."}, 400)
                with db() as conn:
                    for t in ("sessions", "user_groups", "user_perms"):
                        conn.execute(f"DELETE FROM {t} WHERE user_id=?", (rid,))
                    conn.execute("UPDATE members SET user_id=NULL WHERE user_id=?", (rid,))
                    conn.execute("DELETE FROM users WHERE id=?", (rid,))
                return self.send_json({"ok": True})

        if what == "groups":
            with db() as conn:
                if method == "GET":
                    out = []
                    for g in conn.execute("SELECT * FROM groups ORDER BY sort, name"):
                        d = row_dict(g)
                        d["perms"] = {a: 0 for a in AREAS}
                        for r in conn.execute("SELECT area, level FROM group_perms WHERE group_id=?", (g["id"],)):
                            d["perms"][r["area"]] = r["level"]
                        d["members"] = conn.execute("SELECT COUNT(*) FROM user_groups WHERE group_id=?", (g["id"],)).fetchone()[0]
                        out.append(d)
                    return self.send_json(out)
                if method in ("POST", "PUT"):
                    data = self.read_json()
                    name = (data.get("name") or "").strip()[:40]
                    if not name:
                        return self.send_json({"error": "Bitte einen Namen angeben."}, 400)
                    if conn.execute("SELECT 1 FROM groups WHERE name=? AND id != ?", (name, rid or 0)).fetchone():
                        return self.send_json({"error": "Diese Gruppe gibt es schon."}, 400)
                    if method == "POST":
                        sort = conn.execute("SELECT COALESCE(MAX(sort), 0) + 1 FROM groups").fetchone()[0]
                        rid = conn.execute("INSERT INTO groups (name, description, sort) VALUES (?, ?, ?)",
                                           (name, data.get("description") or "", sort)).lastrowid
                    else:
                        conn.execute("UPDATE groups SET name=?, description=? WHERE id=?", (name, data.get("description") or "", rid))
                    for area in AREAS:
                        lvl = int((data.get("perms") or {}).get(area, 0) or 0)
                        conn.execute("INSERT OR REPLACE INTO group_perms (group_id, area, level) VALUES (?, ?, ?)", (rid, area, max(0, min(2, lvl))))
                    return self.send_json({"ok": True, "id": rid})
                if method == "DELETE" and rid:
                    conn.execute("DELETE FROM user_groups WHERE group_id=?", (rid,))
                    conn.execute("DELETE FROM group_perms WHERE group_id=?", (rid,))
                    conn.execute("DELETE FROM groups WHERE id=?", (rid,))
                    return self.send_json({"ok": True})
        return self.send_json({"error": "Unbekannter Pfad"}, 404)

    def api_table(self, method, table, rid, perms=None):
        now = datetime.now().isoformat(timespec="seconds")
        hide = ()
        if perms is not None:
            if perms.get("finanzen", 0) < 1:
                hide += FINANCE_FIELDS.get(table, ())
            if perms.get(TABLE_AREA.get(table), 0) < 1:
                hide += AREA_FIELDS.get(table, ())

        def out(r):
            d = row_dict(r)
            for f in hide:
                d.pop(f, None)
            return d

        with db() as conn:
            if method == "GET":
                if rid is None:
                    rows = conn.execute(f'SELECT * FROM "{table}" ORDER BY id').fetchall()
                    return self.send_json([out(r) for r in rows])
                r = conn.execute(f'SELECT * FROM "{table}" WHERE id=?', (rid,)).fetchone()
                return self.send_json(out(r) if r else None, 200 if r else 404)

            if method == "POST":
                vals = clean_values(table, self.read_json())
                for f in hide + SERVER_FIELDS.get(table, ()):
                    vals.pop(f, None)
                if table == "apparel":
                    vals["public_token"] = secrets.token_urlsafe(18)
                vals["created_at"] = now
                vals["updated_at"] = now
                cols = ", ".join(f'"{k}"' for k in vals)
                qs = ", ".join("?" for _ in vals)
                cur = conn.execute(f'INSERT INTO "{table}" ({cols}) VALUES ({qs})', list(vals.values()))
                r = conn.execute(f'SELECT * FROM "{table}" WHERE id=?', (cur.lastrowid,)).fetchone()
                audit(conn, getattr(self, "user", None), "neu", table, cur.lastrowid, audit_label(r),
                      {k: audit_short(v) for k, v in vals.items() if k not in AUDIT_SKIP and v not in (None, "")})
                return self.send_json(out(r), 201)

            if method == "PUT" and rid is not None:
                vals = clean_values(table, self.read_json())
                for f in hide + SERVER_FIELDS.get(table, ()):
                    vals.pop(f, None)
                vals.pop("public_token", None)   # neuer Link nur über /api/apparel/<id>/new-link
                vals["updated_at"] = now
                old = conn.execute(f'SELECT * FROM "{table}" WHERE id=?', (rid,)).fetchone()
                if table == "apparel_orders" and old and old["booked_tx"] and "paid" in vals and int(vals["paid"] or 0) != int(old["paid"] or 0):
                    return self.send_json({"error": "Diese Bestellung ist schon in den Finanzen gebucht, „bezahlt“ lässt sich nicht mehr ändern."}, 400)
                sets = ", ".join(f'"{k}"=?' for k in vals)
                conn.execute(f'UPDATE "{table}" SET {sets} WHERE id=?', list(vals.values()) + [rid])
                r = conn.execute(f'SELECT * FROM "{table}" WHERE id=?', (rid,)).fetchone()
                if old:
                    changes = {k: [audit_short(old[k]), audit_short(v)] for k, v in vals.items()
                               if k not in AUDIT_SKIP and str(old[k] if old[k] is not None else "") != str(v if v is not None else "")}
                    if changes:
                        audit(conn, getattr(self, "user", None), "geändert", table, rid, audit_label(r), changes)
                return self.send_json(out(r) if r else None)

            if method == "DELETE" and rid is not None:
                old = conn.execute(f'SELECT * FROM "{table}" WHERE id=?', (rid,)).fetchone()
                if old:
                    audit(conn, getattr(self, "user", None), "gelöscht", table, rid, audit_label(old),
                          {k: audit_short(v) for k, v in row_dict(old).items() if k not in AUDIT_SKIP and v not in (None, "")})
                conn.execute(f'DELETE FROM "{table}" WHERE id=?', (rid,))
                if table == "games":
                    conn.execute("DELETE FROM assignments WHERE game_id=?", (rid,))
                if table == "media_team":
                    conn.execute("DELETE FROM assignments WHERE member_id=?", (rid,))
                if table == "members":
                    conn.execute("UPDATE users SET member_id=NULL WHERE member_id=?", (rid,))
                if table == "magazines":
                    conn.execute("DELETE FROM magazine_pages WHERE magazine_id=?", (rid,))
                if table == "apparel":
                    conn.execute("DELETE FROM apparel_orders WHERE apparel_id=?", (rid,))
                return self.send_json({"ok": True})

        return self.send_json({"error": "Methode nicht erlaubt"}, 405)

    def api_settings(self, method):
        with db() as conn:
            if method == "PUT":
                data = self.read_json()
                old = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings")}
                changes = {k: [audit_short(old.get(k)), audit_short(v)] for k, v in data.items()
                           if k not in ("sheet_last_sync", "sheet_last_error", "sheet_columns") and str(old.get(k) or "") != str(v or "")}
                if changes:
                    audit(conn, getattr(self, "user", None), "geändert", "settings", None, "Einstellungen", changes)
                for k, v in data.items():
                    if k in ("sheet_last_sync", "sheet_last_error", "sheet_columns"):
                        continue
                    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, str(v)))
            rows = conn.execute("SELECT key, value FROM settings").fetchall()
            return self.send_json({r["key"]: r["value"] for r in rows})

    def api_upload(self, library=True):
        data = self.read_json()
        raw = data.get("data", "")
        name = data.get("name") or "bild.png"
        m = re.match(r"^data:([\w/+.-]+);base64,(.*)$", raw, re.S)
        if not m:
            return self.send_json({"error": "Ungültige Datei"}, 400)
        mime, b64 = m.groups()
        suffix = Path(name).suffix.lower()
        if not re.fullmatch(r"\.[a-z0-9]{1,8}", suffix):
            suffix = ""
        # Unbekannte Typen (z. B. .pages, .indd) behalten ihre Endung statt .bin
        ext = (mimetypes.guess_extension(mime) if mime != "application/octet-stream" else None) or suffix or ".bin"
        if ext == ".jpe":
            ext = ".jpg"
        safe = re.sub(r"[^A-Za-z0-9_-]+", "-", Path(name).stem)[:40].strip("-") or "datei"
        fname = f"{datetime.now():%Y%m%d-%H%M%S}-{safe}-{uuid.uuid4().hex[:6]}{ext}"
        (MEDIA / fname).write_bytes(base64.b64decode(b64))
        path = f"/media/{fname}"
        if data.get("library", True) and library:
            with db() as conn:
                conn.execute(
                    "INSERT INTO media (path, name, tags, created, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (path, name, data.get("tags", ""), datetime.now().isoformat(timespec="seconds"),
                     datetime.now().isoformat(timespec="seconds"), datetime.now().isoformat(timespec="seconds")),
                )
        return self.send_json({"path": path})

    def api_backup(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            # konsistente Kopie der Datenbank
            tmp = db_snapshot(DATA / "_backup_tmp.db")
            # Zugangsdaten gehören nicht in ein heruntergeladenes Backup
            c = sqlite3.connect(tmp)
            try:
                for t in ("sessions", "users", "user_groups", "user_perms", "secrets", "audit_log"):
                    c.execute(f"DELETE FROM {t}")
                c.commit()
                c.execute("VACUUM")
            finally:
                c.close()
            z.write(tmp, "data/tigers.db")
            tmp.unlink(missing_ok=True)
            for f in MEDIA.iterdir():
                if f.is_file():
                    z.write(f, f"data/media/{f.name}")
        data = buf.getvalue()
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Content-Disposition",
                         f'attachment; filename="EmdenTigersHub-Backup-{datetime.now():%Y-%m-%d}.zip"')
        self.end_headers()
        self.wfile.write(data)

    def api_export(self):
        out = {}
        with db() as conn:
            for t in TABLES:
                out[t] = [row_dict(r) for r in conn.execute(f'SELECT * FROM "{t}"')]
            out["settings"] = {r["key"]: r["value"] for r in conn.execute("SELECT * FROM settings")}
        return self.send_json(out)

    def api_dashboard(self, perms):
        today = datetime.now().strftime("%Y-%m-%d")
        with db() as conn:
            q = lambda sql, a=(): [row_dict(r) for r in conn.execute(sql, a)]
            res = {
                "today": today,
                "next_games": q("SELECT * FROM games WHERE date >= ? ORDER BY date, time LIMIT 4", (today,)),
                "last_game": (q("SELECT * FROM games WHERE date < ? ORDER BY date DESC, time DESC LIMIT 1", (today,)) or [None])[0],
                "upcoming_posts": q("SELECT * FROM posts WHERE date >= ? AND status != 'Gepostet' ORDER BY date, time LIMIT 12", (today,)),
                "overdue_posts": q("SELECT * FROM posts WHERE date < ? AND status != 'Gepostet' AND status != 'Idee' ORDER BY date", (today,)),
                "counts": {
                    "players": conn.execute("SELECT COUNT(*) FROM players WHERE active=1 AND kind='Spieler'").fetchone()[0],
                    "staff": conn.execute("SELECT COUNT(*) FROM players WHERE active=1 AND kind!='Spieler'").fetchone()[0],
                    "no_consent": conn.execute("SELECT COUNT(*) FROM players WHERE active=1 AND (consent IS NULL OR consent=0)").fetchone()[0],
                    "sponsors": conn.execute("SELECT COUNT(*) FROM sponsors WHERE active=1").fetchone()[0],
                    "posts_done": conn.execute("SELECT COUNT(*) FROM posts WHERE status='Gepostet'").fetchone()[0],
                    "members": conn.execute("SELECT COUNT(*) FROM members WHERE status IN ('Aktiv', 'Probetraining')").fetchone()[0],
                },
            }
            if perms.get("finanzen", 0) >= 1:
                y = today[:4]
                inc = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE kind='Einnahme' AND substr(date, 1, 4)=?", (y,)).fetchone()[0]
                exp = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE kind='Ausgabe' AND substr(date, 1, 4)=?", (y,)).fetchone()[0]
                res["finance"] = {"year": y, "income": inc, "expense": exp,
                                  "open": conn.execute("SELECT COUNT(*) FROM transactions WHERE status='Offen'").fetchone()[0]}
        if perms.get("medien", 0) < 1:
            res["upcoming_posts"], res["overdue_posts"] = [], []
            res["counts"].pop("posts_done", None)
        if perms.get("mitglieder", 0) < 1:
            res["counts"].pop("members", None)
        return self.send_json(res)


# ---------------------------------------------------------------------------
# Seiten für Anmeldung und Ersteinrichtung
# ---------------------------------------------------------------------------
AUTH_PAGE = """<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Emden Tigers Hub</title><link rel="icon" href="/static/icon.png"><link rel="stylesheet" href="/static/style.css">
<style>
body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0e0e0e;padding:16px}
.auth{width:min(380px,100%);background:#fff;border-radius:14px;padding:30px 28px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.auth-logo{background:#0e0e0e;border-radius:10px;display:flex;align-items:center;gap:12px;padding:14px 16px;margin:-6px -4px 22px}
.auth-logo img{height:42px}.auth-logo b{color:#fff;font-family:var(--head);text-transform:uppercase;letter-spacing:.3px}
.auth-logo span{display:block;color:#999;font-size:11px;letter-spacing:2px;text-transform:uppercase}
.auth .field{margin-bottom:12px}.auth .btn{width:100%;justify-content:center;padding:10px;margin-top:6px}
.err{color:#b00020;font-size:13px;min-height:18px;margin-top:8px}
</style></head><body>
<form class="auth" id="f" method="post" action="/auth/none">
  <div class="auth-logo"><img src="/static/logo.png" alt=""><div><b>Emden Tigers</b><span>Hub</span></div></div>
  %%BODY%%
  <div class="err" id="err"></div>
</form>
<script>
document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(document.getElementById('f')));
  if (fd.password2 !== undefined && fd.password !== fd.password2) { document.getElementById('err').textContent = 'Die Passwörter stimmen nicht überein.'; return false; }
  const r = await fetch('%%ACTION%%', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TMH': '1' }, body: JSON.stringify(fd) });
  const d = await r.json().catch(() => ({}));
  if (r.ok) location.href = '%%NEXT%%'; else document.getElementById('err').textContent = d.error || 'Fehler';
});
</script></body></html>"""

LOGIN_PAGE = (AUTH_PAGE.replace("%%ACTION%%", "/auth/login").replace("%%NEXT%%", "/hub").replace("%%BODY%%", """
  <div class="field"><label for="u">Benutzername</label><input class="input" id="u" name="username" autocomplete="username" required autofocus></div>
  <div class="field"><label for="p">Passwort</label><input class="input" id="p" name="password" type="password" autocomplete="current-password" required></div>
  <button class="btn primary">Anmelden</button>
  <p class="small" style="text-align:center;margin:14px 0 0"><a href="/passwort-vergessen">Passwort vergessen?</a></p>"""))

FORGOT_PAGE = (AUTH_PAGE.replace("%%ACTION%%", "/auth/forgot").replace("%%NEXT%%", "/passwort-vergessen/gesendet").replace("%%BODY%%", """
  <p style="margin-top:0"><b>Passwort vergessen?</b></p>
  <p class="muted small">Gib deinen Benutzernamen oder deine E-Mail-Adresse ein. Du bekommst dann einen Link, mit dem du ein neues Passwort festlegst.</p>
  <div class="field"><label for="l">Benutzername oder E-Mail</label><input class="input" id="l" name="login" autocomplete="username" required autofocus></div>
  <button class="btn primary">Link schicken</button>
  <p class="small" style="text-align:center;margin:14px 0 0"><a href="/login">Zurück zur Anmeldung</a></p>"""))

FORGOT_SENT_PAGE = (AUTH_PAGE.replace("%%ACTION%%", "/").replace("%%NEXT%%", "/").replace("%%BODY%%", """
  <p style="margin-top:0"><b>Schau in dein Postfach</b></p>
  <p class="muted">Wenn es ein Konto mit diesen Angaben und einer hinterlegten E-Mail-Adresse gibt, haben wir gerade einen Link geschickt.
    Er gilt 60 Minuten. Schau auch im Spam-Ordner nach.</p>
  <p class="muted small">Keine Mail bekommen? Dann ist bei deinem Konto vermutlich keine E-Mail-Adresse hinterlegt. Bitte wende dich an den Vorstand bzw. Admin.</p>
  <p class="small" style="text-align:center;margin:14px 0 0"><a href="/login">Zurück zur Anmeldung</a></p>"""))

RESET_PAGE = (AUTH_PAGE.replace("%%ACTION%%", "/auth/reset").replace("%%NEXT%%", "/hub").replace("%%BODY%%", """
  <p style="margin-top:0">Hallo <b>%%NAME%%</b>, leg jetzt dein neues Passwort fest.</p>
  <p class="muted small">Dein Benutzername: <b>%%USER%%</b></p>
  <input type="hidden" name="token" value="%%TOKEN%%">
  <input type="text" name="username" value="%%USER%%" autocomplete="username" hidden>
  <div class="field"><label for="p">Neues Passwort (mind. 10 Zeichen)</label><input class="input" id="p" name="password" type="password" autocomplete="new-password" required autofocus></div>
  <div class="field"><label for="p2">Passwort wiederholen</label><input class="input" id="p2" name="password2" type="password" autocomplete="new-password" required></div>
  <button class="btn primary">Passwort speichern und anmelden</button>"""))

INVALID_RESET_PAGE = (AUTH_PAGE.replace("%%ACTION%%", "/").replace("%%NEXT%%", "/").replace("%%BODY%%", """
  <p>Dieser Link ist ungültig oder abgelaufen.</p>
  <p class="muted">Ein Link gilt 60 Minuten und nur einmal. <a href="/passwort-vergessen">Neuen Link anfordern</a></p>"""))

SETUP_PAGE = (AUTH_PAGE.replace("%%ACTION%%", "/auth/setup").replace("%%NEXT%%", "/login").replace("%%BODY%%", """
  <p class="muted" style="margin-top:0">Ersteinrichtung: Lege deinen Admin-Zugang an.</p>
  <div class="field"><label for="u">Benutzername</label><input class="input" id="u" name="username" autocomplete="username" required autofocus></div>
  <div class="field"><label for="p">Passwort (mind. 10 Zeichen)</label><input class="input" id="p" name="password" type="password" autocomplete="new-password" required></div>
  <div class="field"><label for="p2">Passwort wiederholen</label><input class="input" id="p2" name="password2" type="password" autocomplete="new-password" required></div>
  <button class="btn primary">Zugang anlegen</button>"""))

INVITE_PAGE = (AUTH_PAGE.replace("%%ACTION%%", "/auth/invite").replace("%%NEXT%%", "/hub#/profile").replace("%%BODY%%", """
  <p style="margin-top:0">Hallo <b>%%NAME%%</b>, willkommen im Emden Tigers Hub! Lege jetzt dein Passwort fest.</p>
  <p class="muted small">Dein Benutzername: <b>%%USER%%</b></p>
  <input type="hidden" name="token" value="%%TOKEN%%">
  <input type="text" name="username" value="%%USER%%" autocomplete="username" hidden>
  <div class="field"><label for="p">Passwort (mind. 10 Zeichen)</label><input class="input" id="p" name="password" type="password" autocomplete="new-password" required autofocus></div>
  <div class="field"><label for="p2">Passwort wiederholen</label><input class="input" id="p2" name="password2" type="password" autocomplete="new-password" required></div>
  <button class="btn primary">Passwort speichern und loslegen</button>"""))

INVALID_INVITE_PAGE = (AUTH_PAGE.replace("%%ACTION%%", "/").replace("%%NEXT%%", "/").replace("%%BODY%%", """
  <p>Dieser Einladungslink ist ungültig oder abgelaufen.</p>
  <p class="muted">Bitte frag beim Vorstand bzw. Admin nach einem neuen Link. Wenn du schon ein Passwort hast: <a href="/login">zur Anmeldung</a></p>"""))

ORDER_INVALID_PAGE = (AUTH_PAGE.replace("%%ACTION%%", "/").replace("%%NEXT%%", "/").replace("%%BODY%%", """
  <p>Dieser Bestell-Link ist ungültig.</p>
  <p class="muted">Bitte frag beim Verein nach dem aktuellen Link.</p>"""))


def html_esc(t):
    return (str(t or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;"))


NO_USER_PAGE = (AUTH_PAGE.replace("%%ACTION%%", "/").replace("%%NEXT%%", "/").replace("%%BODY%%", """
  <p>Es ist noch kein Benutzer angelegt.</p>
  <p class="muted">Bitte in der Datei <b>.env</b> auf dem Server <b>TMH_ADMIN_USER</b> und <b>TMH_ADMIN_PASSWORD</b>
  eintragen und den Hub neu starten (<code>docker compose up -d</code>).</p>"""))


def cleanup_loop():
    while True:
        try:
            with db() as conn:
                conn.execute("DELETE FROM sessions WHERE expires < ?", (time.time(),))
                conn.execute("DELETE FROM audit_log WHERE time < ?",
                             ((datetime.now() - timedelta(days=AUDIT_KEEP_DAYS)).isoformat(timespec="seconds"),))
            for f in DATA.glob("_umzug_*"):   # nicht abgeholte Umzugsdateien nach einer Stunde löschen
                if time.time() - f.stat().st_mtime > 3600:
                    f.unlink(missing_ok=True)
        except Exception:  # noqa
            pass
        threading.Event().wait(6 * 3600)


def cli():
    """Kommandozeile: python server.py adduser NAME [admin] | passwd NAME | users"""
    import getpass
    init_db()
    cmd = sys.argv[1]
    if cmd == "users":
        with db() as conn:
            for r in conn.execute("SELECT username, is_admin, active, last_login FROM users ORDER BY username"):
                print(f"{r['username']:<24} {'Admin' if r['is_admin'] else '':<6} {'' if r['active'] else 'deaktiviert':<12} "
                      f"zuletzt angemeldet: {r['last_login'] or 'nie'}")
        return
    if len(sys.argv) < 3:
        print(cli.__doc__)
        return
    name = sys.argv[2]
    pw = getpass.getpass("Neues Passwort: ")
    if pw != getpass.getpass("Wiederholen: "):
        print("Die Passwörter stimmen nicht überein.")
        sys.exit(1)
    if cmd == "adduser":
        create_user(name, pw, is_admin="admin" in sys.argv[3:])
        print("Benutzer angelegt.")
    elif cmd == "passwd":
        prob = pw_problem(pw)
        if prob:
            print(prob)
            sys.exit(1)
        with db() as conn:
            cur = conn.execute("UPDATE users SET pw_hash=?, invite_hash=NULL, active=1 WHERE username=?", (hash_pw(pw), name))
            conn.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username=?)", (name,))
        print("Passwort geändert." if cur.rowcount else "Benutzer nicht gefunden.")


def main():
    if len(sys.argv) > 1 and sys.argv[1] in ("adduser", "passwd", "users"):
        return cli()
    init_db()
    bootstrap_admin()
    try:
        httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        url = f"http://127.0.0.1:{PORT}/"
        running = ""
        try:
            with urllib.request.urlopen(url + "healthz", timeout=3) as r:
                running = json.loads(r.read().decode("utf-8")).get("version", "")
        except Exception:  # noqa
            pass
        if running == VERSION and not SERVER_MODE:
            print(f"{APP_NAME} läuft bereits. Öffne {url}")
            webbrowser.open(url)
        else:
            print("=" * 56)
            print(f"  Port {PORT} ist belegt" + (f" ({APP_NAME} {running})" if running else "") + ".")
            print("  Bitte die andere Instanz beenden und erneut starten.")
            print("=" * 56)
            sys.exit(1)
        return
    httpd.daemon_threads = True
    url = f"http://{'127.0.0.1' if HOST in ('0.0.0.0', '::') else HOST}:{PORT}/"
    print("=" * 56)
    print(f"  {APP_NAME} " + VERSION + ("  (Serverbetrieb)" if SERVER_MODE else ""))
    print(f"  Läuft unter {url}")
    print(f"  Daten: {DATA}")
    if user_count() == 0:
        print("  Noch kein Benutzer angelegt." + ("" if SERVER_MODE else " Ersteinrichtung im Browser."))
    if not SERVER_MODE:
        print("  Zum Beenden dieses Fenster schließen (oder Strg+C).")
    print("=" * 56, flush=True)
    for fn in (sync_loop, backup_loop, cleanup_loop, social_loop, notify_loop):
        threading.Thread(target=fn, daemon=True).start()
    if not SERVER_MODE and "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
