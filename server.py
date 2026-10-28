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
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote, parse_qs
import urllib.request
import urllib.error

VERSION = "3.0.1"
APP_NAME = "Emden Tigers Hub"
ENV = os.environ.get
HOST = ENV("TMH_HOST", "127.0.0.1")
PORT = int(ENV("TMH_PORT", "8765"))
SERVER_MODE = ENV("TMH_SERVER") == "1"
SECURE_COOKIES = ENV("TMH_SECURE_COOKIES") == "1"
TRUST_PROXY = ENV("TMH_TRUST_PROXY") == "1"
BACKUP_KEEP = int(ENV("TMH_BACKUP_KEEP", "14"))
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
}


DB_LOCK = threading.RLock()   # exklusiv beim Einspielen eines Backups


# ---------------------------------------------------------------------------
# Bereiche und Rechte
# Stufen: 0 = kein Zugriff, 1 = Lesen, 2 = Bearbeiten. Admins dürfen alles.
# ---------------------------------------------------------------------------
AREAS = {"medien": "Medien", "verein": "Verein", "mitglieder": "Mitglieder", "finanzen": "Finanzen"}
TABLE_AREA = {
    "posts": "medien", "media": "medien", "sheet_players": "medien", "sheet_log": "medien",
    "media_team": "medien", "assignments": "medien",
    "games": "verein", "opponents": "verein", "players": "verein", "sponsors": "verein",
    "members": "mitglieder",
    "supporter_cards": "finanzen", "transactions": "finanzen",
}
# Nachschlage-Tabellen: lesbar für alle, die irgendeinen Bereich sehen (z. B. Spielplan für Captions)
SHARED_READ = {"games", "opponents", "players", "sponsors", "media"}
# Felder, die nur mit Finanz-Leserecht sichtbar sind
FINANCE_FIELDS = {"sponsors": ("amount",)}

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
                     ("member_id", "INTEGER"), ("invite_hash", "TEXT"), ("invite_expires", "REAL")):
            if c not in ucols:
                conn.execute(f"ALTER TABLE users ADD COLUMN {c} {t}")
        if "role" in ucols:
            conn.execute("UPDATE users SET is_admin=1 WHERE role='admin' AND (is_admin IS NULL OR is_admin=0)")
        conn.execute("CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE COLLATE NOCASE, "
                     "description TEXT, sort INTEGER DEFAULT 0)")
        conn.execute("CREATE TABLE IF NOT EXISTS group_perms (group_id INTEGER, area TEXT, level INTEGER, PRIMARY KEY (group_id, area))")
        conn.execute("CREATE TABLE IF NOT EXISTS user_groups (user_id INTEGER, group_id INTEGER, PRIMARY KEY (user_id, group_id))")
        conn.execute("CREATE TABLE IF NOT EXISTS user_perms (user_id INTEGER, area TEXT, level INTEGER, PRIMARY KEY (user_id, area))")
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


AUTH_TABLES = ("users", "sessions", "groups", "group_perms", "user_groups", "user_perms")


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

    def send_file(self, path: Path, download_name=None):
        if not path.is_file():
            return self.send_error(404)
        ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("text/") or ctype.endswith("javascript") else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        if download_name:
            self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
        self.end_headers()
        self.wfile.write(data)

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

    def redirect(self, to):
        self.send_response(302)
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
        if method == "GET" and p in (["static", "style.css"], ["static", "logo.png"], ["static", "icon.png"]):
            return self.serve_under(STATIC, p[1:])
        if head == "login" and method == "GET":
            if self.current_user():
                return self.redirect("/")
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

        # Ab hier nur mit Anmeldung
        user = self.current_user()
        if not user:
            if head == "api":
                return self.send_json({"error": "Nicht angemeldet"}, 401)
            return self.redirect("/login")

        if method != "GET" and self.headers.get("X-TMH") != "1":
            return self.send_json({"error": "Ungültige Anfrage"}, 403)

        if not p:
            return self.send_file(STATIC / "index.html")
        if head == "static" and method == "GET":
            return self.serve_under(STATIC, p[1:])
        if head == "media" and method == "GET":
            return self.serve_under(MEDIA, p[1:])
        if head == "api":
            return self.api(method, p[1:], user)
        return self.send_error(404)

    def serve_under(self, root: Path, rest):
        target = (root / "/".join(rest)).resolve()
        if root.resolve() not in target.parents and target != root.resolve():
            return self.send_error(403)
        return self.send_file(target)

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
                        conn.execute("UPDATE users SET pw_hash=? WHERE id=?", (hash_pw(data["new"]), user["id"]))
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
                    return self.send_json(restore_backup(self.read_body()))
                except ValueError as e:
                    return self.send_json({"error": str(e)}, 400)
            if name in ("backup", "export", "backups"):
                if not admin:
                    return self.deny("Nur für Admins.")
                if name == "backups" and method == "GET":
                    files = sorted(BACKUPS.glob("*.db"), reverse=True)
                    return self.send_json([{"name": f.name, "size": f.stat().st_size} for f in files])
                if name == "backup" and method == "GET":
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

            if name in TABLES:
                area = TABLE_AREA.get(name)
                if method == "GET":
                    if not (can(area, 1) or (name in SHARED_READ and any_read)):
                        return self.deny()
                elif name == "media" and method == "POST":
                    return self.deny()
                elif not can(area, 2):
                    return self.deny(f"Für den Bereich {AREAS.get(area, area)} hast du nur Leserechte.")
                rid = int(p[1]) if len(p) > 1 else None
                return self.api_table(method, name, rid, perms)

            return self.send_json({"error": "Unbekannter Pfad"}, 404)
        except PayloadTooLarge:
            raise
        except Exception as e:  # noqa
            print("Fehler:", repr(e))
            return self.send_json({"error": str(e)}, 500)

    # -- Eigenes Profil ---------------------------------------------------
    PROFILE_FIELDS = ("email", "phone", "street", "zip", "city", "emergency_contact", "consent_photo")

    def api_profile(self, method, user):
        with db() as conn:
            if method == "PUT":
                data = self.read_json()
                if "display_name" in data:
                    conn.execute("UPDATE users SET display_name=? WHERE id=?", ((data["display_name"] or "").strip()[:80] or user["username"], user["id"]))
                if user["member_id"]:
                    vals = clean_values("members", {k: v for k, v in data.items() if k in self.PROFILE_FIELDS})
                    if vals:
                        vals["updated_at"] = datetime.now().isoformat(timespec="seconds")
                        conn.execute(f"UPDATE members SET {', '.join(f'{k}=?' for k in vals)} WHERE id=?", [*vals.values(), user["member_id"]])
            u = conn.execute("SELECT username, display_name, email FROM users WHERE id=?", (user["id"],)).fetchone()
            m = conn.execute("SELECT * FROM members WHERE id=?", (user["member_id"],)).fetchone() if user["member_id"] else None
            pl = None
            if m and m["player_id"]:
                pl = conn.execute("SELECT number, position, unit, role, kind FROM players WHERE id=?", (m["player_id"],)).fetchone()
            return self.send_json({"account": row_dict(u), "member": row_dict(m) if m else None, "player": row_dict(pl) if pl else None})

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
        hide = FINANCE_FIELDS.get(table, ()) if perms is not None and perms.get("finanzen", 0) < 1 else ()

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
                for f in hide:
                    vals.pop(f, None)
                vals["created_at"] = now
                vals["updated_at"] = now
                cols = ", ".join(f'"{k}"' for k in vals)
                qs = ", ".join("?" for _ in vals)
                cur = conn.execute(f'INSERT INTO "{table}" ({cols}) VALUES ({qs})', list(vals.values()))
                r = conn.execute(f'SELECT * FROM "{table}" WHERE id=?', (cur.lastrowid,)).fetchone()
                return self.send_json(out(r), 201)

            if method == "PUT" and rid is not None:
                vals = clean_values(table, self.read_json())
                for f in hide:
                    vals.pop(f, None)
                vals["updated_at"] = now
                sets = ", ".join(f'"{k}"=?' for k in vals)
                conn.execute(f'UPDATE "{table}" SET {sets} WHERE id=?', list(vals.values()) + [rid])
                r = conn.execute(f'SELECT * FROM "{table}" WHERE id=?', (rid,)).fetchone()
                return self.send_json(out(r) if r else None)

            if method == "DELETE" and rid is not None:
                conn.execute(f'DELETE FROM "{table}" WHERE id=?', (rid,))
                if table == "games":
                    conn.execute("DELETE FROM assignments WHERE game_id=?", (rid,))
                if table == "media_team":
                    conn.execute("DELETE FROM assignments WHERE member_id=?", (rid,))
                if table == "members":
                    conn.execute("UPDATE users SET member_id=NULL WHERE member_id=?", (rid,))
                return self.send_json({"ok": True})

        return self.send_json({"error": "Methode nicht erlaubt"}, 405)

    def api_settings(self, method):
        with db() as conn:
            if method == "PUT":
                data = self.read_json()
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
        ext = mimetypes.guess_extension(mime) or Path(name).suffix or ".bin"
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
                for t in ("sessions", "users", "user_groups", "user_perms"):
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

LOGIN_PAGE = (AUTH_PAGE.replace("%%ACTION%%", "/auth/login").replace("%%NEXT%%", "/").replace("%%BODY%%", """
  <div class="field"><label for="u">Benutzername</label><input class="input" id="u" name="username" autocomplete="username" required autofocus></div>
  <div class="field"><label for="p">Passwort</label><input class="input" id="p" name="password" type="password" autocomplete="current-password" required></div>
  <button class="btn primary">Anmelden</button>"""))

SETUP_PAGE = (AUTH_PAGE.replace("%%ACTION%%", "/auth/setup").replace("%%NEXT%%", "/login").replace("%%BODY%%", """
  <p class="muted" style="margin-top:0">Ersteinrichtung: Lege deinen Admin-Zugang an.</p>
  <div class="field"><label for="u">Benutzername</label><input class="input" id="u" name="username" autocomplete="username" required autofocus></div>
  <div class="field"><label for="p">Passwort (mind. 10 Zeichen)</label><input class="input" id="p" name="password" type="password" autocomplete="new-password" required></div>
  <div class="field"><label for="p2">Passwort wiederholen</label><input class="input" id="p2" name="password2" type="password" autocomplete="new-password" required></div>
  <button class="btn primary">Zugang anlegen</button>"""))

INVITE_PAGE = (AUTH_PAGE.replace("%%ACTION%%", "/auth/invite").replace("%%NEXT%%", "/#/profile").replace("%%BODY%%", """
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
    for fn in (sync_loop, backup_loop, cleanup_loop):
        threading.Thread(target=fn, daemon=True).start()
    if not SERVER_MODE and "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
