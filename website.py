"""Emden Tigers: öffentliche Webseite (wird vom Server gerendert, ohne JavaScript-Pflicht).

Bekommt ausschließlich die öffentlichen Daten aus server.py (public_info, public_games, public_team,
public_sponsors) und baut daraus HTML. Kein Datenbankzugriff, keine internen Felder.
Fehlende Inhalte erscheinen als deutlich markierter Platzhalter (Klasse .ph), siehe PLATZHALTER.md.
"""
import json
import re
import threading
from datetime import date, datetime
from html import escape, unescape
from html.parser import HTMLParser
from pathlib import Path

WEB = Path(__file__).resolve().parent / "web"
IMG = WEB / "assets" / "img"
IMG_WIDTHS = (640, 1280, 1920)

# Impressum und Datenschutz: Einbindung genau wie von der IT-Recht Kanzlei vorgegeben
LEGAL = {
    "impressum": ("Impressum", '<div class="itrk-legaltext" data-itrk-legaltext-url="https://itrk.legal/1Cx1.0.1bQ7-de-iframe.html"></div> '
                               '<script src="https://www.it-recht-kanzlei.de/js/itrk-legaltext.js"></script>'),
    "datenschutz": ("Datenschutz", '<div class="itrk-legaltext" data-itrk-legaltext-url="https://itrk.legal/1Cx1.8V.1bQ7-iframe.html"></div> '
                                   '<script src="https://www.it-recht-kanzlei.de/js/itrk-legaltext.js"></script>'),
}
# Sponsor der Webseite: erscheint auf jeder Seite über dem Footer (Logo unverändert von silasgrbwskfotografie.de)
SITE_SPONSOR = {
    "name": "silasgrbwsk.fotografie",
    "logo": "sponsor/silasgrbwsk-fotografie.png",
    "text": "Sportfotografie aus Emden und Ostfriesland",
    "url": "https://silasgrbwskfotografie.de",
    "instagram": "silasgrbwsk.fotografie",
}
NAV = [("", "Start"), ("herren", "Herren"), ("jugend", "Jugend"), ("spielplan", "Spielplan"), ("news", "News"), ("sponsoren", "Sponsoren"), ("kontakt", "Kontakt")]
# Alte Adressen (erste Fassung der Webseite) leiten dauerhaft auf die neuen Seiten weiter
REDIRECTS = {"team": "/herren", "next-generation": "/jugend", "probetraining": "/kontakt"}
TEAMS = ("Herren", "Next Generation")   # wie TEAMS in server.py
YOUTH = "Next Generation"
TEAM_SLUG = {"Herren": "herren", "Next Generation": "jugend"}
# Anliegen im Kontaktformular: Wert (wie CONTACT_TOPICS in server.py), Kurzname für ?anliegen=, Beschriftung
CONTACT_TOPICS = [("Probetraining Herren", "herren", "Probetraining Herren"), ("Probetraining Jugend", "jugend", "Probetraining Jugend (Next Generation)"),
                  ("Sponsoring", "sponsoring", "Sponsoring und Supporter Karte"), ("Allgemeine Frage", "frage", "Allgemeine Frage")]
POS_NAME = {"QB": "Quarterback", "RB": "Runningback", "FB": "Fullback", "WR": "Wide Receiver", "TE": "Tight End", "OL": "Offensive Line",
            "DL": "Defensive Line", "DE": "Defensive End", "LB": "Linebacker", "CB": "Cornerback", "S": "Safety", "K": "Kicker",
            "P": "Punter", "LS": "Long Snapper", "KR/PR": "Returner", "Athlete": "Athlete"}
# Bilder, die im Hub (Webseite > Bilder) ersetzt werden können: Name -> (Bezeichnung, wo es erscheint)
IMAGE_SLOTS = {
    "hero": ("Titelbild Startseite", "Großes Bild ganz oben auf der Startseite, auch Vorschaubild beim Teilen von Links"),
    "team": ("Teamfoto", "Startseite bei „Wer wir sind“ und Titelbild der Seite Herren"),
    "spiel": ("Spielszene", "Mannschaftskarte Herren auf der Startseite und Titelbild Spielplan"),
    "training": ("Training", "Titelbild der Seite Kontakt"),
    "fans": ("Fans und Gruppenfoto", "Titelbild der Seite Sponsoren"),
    "anfahrt": ("Heimspiel Guide", "Spielplan unter „Heimspiele“: Lageplan mit Parkplatz, Eingang, Vereinsheim und Fanbereich"),
    **{f"galerie-{i}": (f"Galerie {i}", "Instagram-Raster auf der Startseite, solange Instagram nicht verbunden ist") for i in range(1, 7)},
}
# Abschnitte der Startseite in der Standard-Reihenfolge (im Hub sortier- und ausblendbar). Titelbild bleibt immer oben.
START_SECTIONS = {
    "wer": "Wer wir sind",
    "karten": "Nächste Spiele (Herren und Jugend) und Training",
    "teams": "Unsere Teams (Herren und Jugend)",
    "news": "News (die 3 neuesten Artikel)",
    "ergebnisse": "Zuletzt gespielt",
    "band": "Rotes Band „Lust auf Football?“",
    "sponsoren": "Unsere Sponsoren",
    "instagram": "Instagram",
}
# Texte, die auf der Webseite als Platzhalter erscheinen, solange sie leer sind (Checkliste im Hub)
REQUIRED_TEXTS = {
    "site_contact_email": "Kontakt-E-Mail", "site_hero_text": "Startseite: Satz unter der Überschrift", "site_about": "Startseite: Wer wir sind",
    "site_training_times": "Training Herren: Zeiten", "site_training_place": "Training Herren: Ort", "site_training_address": "Training Herren: Adresse",
    "site_trial_text": "Hinweise zum Probetraining", "site_home_address": "Spielplan: Adresse Heimspielort", "site_gameday_text": "Spielplan: Infos zum Spieltag",
    "site_card_short": "Supporter Karte: Kurztext", "site_card_text": "Supporter Karte: Text", "site_sponsor_text": "Sponsoren: Sponsor werden",
    "site_youth_text": "Jugend: Vorstellung Flag Football", "site_youth_ages": "Jugend: Alter",
    "site_youth_training_times": "Training Jugend: Zeiten", "site_youth_training_place": "Training Jugend: Ort",
}
_ctx = threading.local()   # eigene Bilder für die gerade gebaute Seite (der Server bearbeitet Anfragen parallel)
POSITIONS = ["QB", "RB", "FB", "WR", "TE", "OL", "DL", "DE", "LB", "CB", "S", "K", "P", "LS", "KR/PR", "Athlete"]
COACH_ROLES = ["Headcoach", "Offensive Coordinator", "Defensive Coordinator", "Special Teams Coordinator", "Position Coach", "Teammanager", "Physio", "Equipment"]
PACKAGES = ["Hauptsponsor", "Trikotsponsor", "Spieltagssponsor", "Supporter Karte", "Medienturm", "Partner", "Förderer"]
WD = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
WD_S = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
MON = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]


def e(t):
    return escape(str(t if t is not None else ""), quote=True)


def asset(path):
    """Link auf eine Datei unter web/assets mit Änderungsstempel, damit Browser nach Updates die neue Fassung laden."""
    f = WEB / "assets" / path
    v = int(f.stat().st_mtime) if f.is_file() else 0
    return f"/web/assets/{path}?v={v}"


def lines(t):
    return "<br>".join(e(x) for x in str(t or "").splitlines())


def placeholder(what):
    """Klar markierter Platzhalter für Inhalte, die im Hub noch fehlen."""
    return f'<span class="ph" title="Platzhalter, im Hub unter Einstellungen > Webseite pflegen">Platzhalter: {e(what)}</span>'


def text_or_ph(value, what):
    return lines(value) if (value or "").strip() else placeholder(what)


def fmt_date(d, weekday=False):
    try:
        x = date.fromisoformat(d)
    except (TypeError, ValueError):
        return ""
    return (f"{WD[x.weekday()]}, " if weekday else "") + f"{x.day:02d}.{x.month:02d}.{x.year}"


# ---------------------------------------------------------------------------
# Bilder: web/assets/img/<name>-<breite>.webp, Beschreibung in bilder.json
# ---------------------------------------------------------------------------
def image_meta(standard=False):
    """Bildbeschreibungen aus bilder.json, darüber die im Hub ersetzten Bilder (mit eigenen Dateien unter "src")."""
    f = IMG / "bilder.json"
    try:
        meta = json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        meta = {}
    if not standard:
        for slot, m in (getattr(_ctx, "images", None) or {}).items():
            if m.get("src"):
                meta[slot] = m
            elif slot in meta and m.get("alt"):   # nur der Alt-Text wurde im Hub geändert
                meta[slot] = {**meta[slot], "alt": m["alt"]}
    return meta


def picture(name, sizes="100vw", cls="", eager=False, meta=None):
    meta = meta if meta is not None else image_meta()
    m = meta.get(name)
    if m and m.get("src"):   # im Hub ersetztes Bild
        files = sorted(m["src"].items())
    else:
        files = [(w, f"/web/assets/img/{name}-{w}.webp") for w in IMG_WIDTHS if (IMG / f"{name}-{w}.webp").is_file()]
    widths = [w for w, _ in files]
    if not m or not widths:
        return f'<div class="img-ph {e(cls)}">{placeholder("Foto " + name)}</div>'
    srcset = ", ".join(f"{e(u)} {w}w" for w, u in files)
    mid = files[min(1, len(files) - 1)][1]
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'   # das erste große Bild sofort, alle anderen erst beim Scrollen
    return (f'<img class="{e(cls)}" src="{e(mid)}" srcset="{srcset}" sizes="{e(sizes)}" '
            f'width="{m.get("w", 1600)}" height="{m.get("h", 1067)}" alt="{e(m.get("alt", ""))}" {load} decoding="async">')


def photos(prefix):
    """Alle vorhandenen Bilder einer Gruppe (z. B. galerie-1, galerie-2 ...)."""
    return sorted((k for k in image_meta() if k.startswith(prefix)), key=lambda k: (len(k), k))


# ---------------------------------------------------------------------------
# Rahmen: Kopf, Navigation, Fußzeile
# ---------------------------------------------------------------------------
def structured_head(slug, info):
    """canonical-Link, Verein als SportsTeam und die kommenden Spiele als SportsEvent (Startseite, Spielplan, Herren, Jugend)."""
    base = getattr(_ctx, "base", "")
    if not base or slug not in PAGES:
        return ""
    out = [f'<link rel="canonical" href="{e(base)}/{e(slug)}">', jsonld(org_ld(info, base))]
    team = {"herren": "Herren", "jugend": YOUTH}.get(slug)
    if slug in ("", "spielplan") or team:
        today = date.today().isoformat()
        upcoming = [g for g in getattr(_ctx, "games", []) if g["date"] >= today and (not team or g.get("team", "Herren") == team)][:12]
        events = [x for x in (game_ld(g, info, base) for g in upcoming) if x]
        if events:
            out.append(jsonld(events if len(events) > 1 else events[0]))
    return "\n".join(out)


def notice_bar(info):
    """Hinweis-Leiste oben (im Hub unter Webseite > Hinweis), nur bis einschließlich zum eingestellten Datum."""
    text, link, until = (info.get("site_notice_text") or "").strip(), (info.get("site_notice_link") or "").strip(), info.get("site_notice_until") or ""
    if not text or (until and until < date.today().isoformat()):
        return ""
    ok = link.startswith("/") and not link.startswith("//") or link.startswith(("https://", "http://"))
    target = "" if link.startswith("/") else ' target="_blank" rel="noopener"'
    more = f' <a href="{e(link)}"{target}>Mehr erfahren</a>' if ok else ""
    return f'<div class="notice"><p>{e(text)}{more}</p></div>'


def layout(slug, title, description, body, info, extra_head=""):
    club = info.get("club_name") or "Emden Tigers"
    nav = "".join(f'<a href="/{s}" class="{"active" if s == slug else ""}">{e(l)}</a>' for s, l in NAV)
    shop = (info.get("site_shop_url") or "").strip()
    shop = shop if shop.startswith("https://") and not any(c in shop for c in ' "<>') else ""
    if shop:   # Fanshop als externer Link, im Menü rot hervorgehoben
        nav += f'<a href="{e(shop)}" class="shop" target="_blank" rel="noopener">Fanshop</a>'
    ig = (info.get("instagram") or "").lstrip("@")
    mail = (info.get("site_contact_email") or "").strip()
    hero = image_meta().get("hero") or {}
    og_img = ((hero.get("src") or {}).get(1280) or ("/web/assets/img/hero-1280.webp" if (IMG / "hero-1280.webp").is_file() else "/static/logo.png"))
    return f"""<!doctype html>
<html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title + " | " + club if title else club + " | American Football in Emden")}</title>
<meta name="description" content="{e(description)}">
<meta property="og:title" content="{e(title or club)}"><meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{og_img}"><meta property="og:type" content="website">
<meta name="theme-color" content="#0B0B0B">
<link rel="icon" href="/static/icon.png">
{structured_head(slug, info)}
<link rel="preload" href="/web/assets/fonts/Anton-Regular.ttf" as="font" type="font/ttf" crossorigin>
<link rel="stylesheet" href="{asset('site.css')}">
<script>if (location.hash.indexOf('#/') === 0) location.replace('/hub' + location.hash);</script>
{extra_head}
</head><body class="page-{e(slug or 'start')}">
<header class="site-head">
  <a class="brand" href="/" aria-label="{e(club)} Startseite"><img src="/static/logo.png" alt="{e(club)} Logo" width="444" height="276"><span>{e(club)}</span></a>
  <input type="checkbox" id="menu" class="menu-toggle" aria-label="Menü öffnen">
  <label for="menu" class="menu-btn" aria-hidden="true"><span></span><span></span><span></span></label>
  <nav class="site-nav">{nav}</nav>
</header>
<main>{notice_bar(info)}{body}</main>
<aside class="site-sponsor" aria-label="Sponsor der Webseite">
  <p class="eyebrow">Diese Webseite wird gesponsert von</p>
  <a class="sp-logo" href="{SITE_SPONSOR['url']}" target="_blank" rel="noopener sponsored"><img src="{asset(SITE_SPONSOR['logo'])}" alt="{e(SITE_SPONSOR['name'])} Logo" width="500" height="150" loading="lazy"></a>
  <p>{e(SITE_SPONSOR['text'])}. Teamfotograf der Emden Tigers.</p>
  <p class="sp-links"><a href="{SITE_SPONSOR['url']}" target="_blank" rel="noopener sponsored">Zur Webseite</a>
    <a href="https://www.instagram.com/{SITE_SPONSOR['instagram']}/" target="_blank" rel="noopener">Instagram @{e(SITE_SPONSOR['instagram'])}</a></p>
</aside>
<footer class="site-foot">
  <div class="foot-grid">
    <div><img class="foot-logo" src="/static/logo.png" alt="" width="444" height="276">
      <p><b>{e(club)}</b><br>American Football in Emden<br>Sparte des SV Amisia Stern Wolthusen</p>
      <a class="crest" href="https://www.amisia-stern.de" target="_blank" rel="noopener" title="SV Amisia Stern Wolthusen"><img src="{asset('verein/amisia-wappen.svg')}" alt="Wappen SV Amisia Stern Wolthusen" width="816" height="917" loading="lazy"></a></div>
    <div><h4>Kontakt</h4>
      <p>{f'<a href="mailto:{e(mail)}">{e(mail)}</a>' if mail else placeholder("Kontakt-E-Mail")}<br>
      <a href="/kontakt#formular">Kontaktformular</a></p>
      {f'<p><a href="https://www.instagram.com/{e(ig)}/" rel="noopener" target="_blank">Instagram @{e(ig)}</a></p>' if ig else ''}</div>
    <div><h4>Verein</h4><p><a href="/herren">Herren</a><br><a href="/jugend">Jugend</a><br><a href="/spielplan">Spielplan</a><br><a href="/news">News</a><br><a href="/sponsoren">Sponsoren</a><br><a href="/kontakt">Kontakt</a>{f'<br><a href="{e(shop)}" target="_blank" rel="noopener">Fanshop</a>' if shop else ''}</p></div>
    <div><h4>Rechtliches</h4><p><a href="/impressum">Impressum</a><br><a href="/datenschutz">Datenschutz</a><br><a class="members" href="/hub">Mitgliederbereich</a><br><a href="/HighlightDesk">Highlight Desk</a></p></div>
  </div>
  <p class="copy">© {datetime.now().year} {e(club)}. Fotos: silasgrbwsk.fotografie</p>
</footer>
<script src="{asset('site.js')}" defer></script>
</body></html>"""


def section_head(eyebrow, title, more=""):
    return f'<div class="sec-head"><p class="eyebrow">{e(eyebrow)}</p><h2>{e(title)}</h2>{more}</div>'


# ---------------------------------------------------------------------------
# Bausteine
# ---------------------------------------------------------------------------
def next_game(games):
    today = date.today().isoformat()
    return next((g for g in games if g["date"] >= today), None)


def game_card(g, info, big=False, live=False, own=False):
    """Spielkarte. live: Plätze für den Livescore (site.js). own: die Karte selbst trägt data-live (Spielplan, Listen)."""
    club = info.get("club_name") or "Emden Tigers"
    o = (g.get("opponent") or {}).get("name") or "Gegner offen"
    home = g["home"]
    opp_logo = (g.get("opponent") or {}).get("logo")
    initials = "".join(w[0] for w in o.split()[:2]).upper() if g.get("opponent") else "?"
    # Beide Mannschaften mit Logo und Name; Heimmannschaft links
    us_t = f'<div class="team"><span class="t-logo"><img src="/static/logo.png" alt="" width="444" height="276" loading="lazy"></span><b>{e(club)}</b></div>'
    them_t = (f'<div class="team"><span class="t-logo">' + (f'<img src="{e(opp_logo)}" alt="" loading="lazy">' if opp_logo else f'<i>{e(initials)}</i>')
              + f'</span><b>{e(o)}</b></div>')
    mid = "<span class='vs'>vs</span>"
    if live:   # Livescore (site.js): Spielstand statt "vs", links immer die Heimmannschaft
        mid = ("<div class='g-mid'><span class='vs'>vs</span><span class='g-score' hidden aria-live='polite' aria-atomic='true'>"
               "<b data-s='l'>0</b><i>:</i><b data-s='r'>0</b></span></div>")
    teams = f"{us_t}{mid}{them_t}" if home else f"{them_t}{mid}{us_t}"
    result = ""
    if g["score_us"] is not None:
        us, them = int(float(g["score_us"])), int(float(g["score_them"]))
        cls = "win" if us > them else "loss" if us < them else "draw"
        left, right = (us, them) if g["home"] else (them, us)   # Ergebnis in derselben Reihenfolge wie die Logos
        result = f'<div class="result {cls}">{left}:{right}</div>'
    attrs = f' data-live data-game="{g.get("id") or ""}" data-home="{1 if home else 0}"' if live and own and g["score_us"] is None else ""
    return f"""<article class="game {'big' if big else ''} {'home' if home else 'away'}"{attrs}>
      <div class="g-date"><b>{e(fmt_date(g['date'], True))}</b>{f'<span>{e(g["time"])} Uhr</span>' if g['time'] else ''}</div>
      {'<div class="live-chips" hidden><span class="chip live" data-l="state">Live</span><span class="chip" data-l="period" hidden></span><span class="chip dim" data-l="down" hidden></span><span class="chip stale" data-l="stale" hidden>Live Ticker pausiert</span></div>' if live else ''}
      <div class="g-teams">{teams}</div>
      <div class="g-row"><div class="g-meta">{f'<span class="tag team">{e(g["team"])}</span>' if g.get("team", "Herren") != "Herren" else ''}<span class="tag">{'Heimspiel' if home else 'Auswärts'}</span>{f'<span>{e(g["league"] or g["kind"])}</span>' if (g["league"] or g["kind"]) else ''}
        {f'<span>{e(g["location"])}</span>' if g['location'] else ''}</div>
      {f'<a class="stream" href="{e(g["stream"])}" target="_blank" rel="noopener">Livestream</a>' if g.get("stream") and g["score_us"] is None else ''}</div>{result}</article>"""


def roster(players):
    """Spieler nach Offense, Defense, Special Teams, Two-Way; innerhalb nach Position und Rückennummer."""
    key = lambda p: (POSITIONS.index(p["position"]) if p["position"] in POSITIONS else 99, int(p["number"]) if str(p["number"]).isdigit() else 999)
    units = []
    for u, label in (("Offense", "Offense"), ("Defense", "Defense"), ("Special Teams", "Special Teams"), ("Two-Way", "Two-Way"), ("", "Team")):
        ps = sorted((p for p in players if (p["unit"] or "") == u), key=key)
        if ps:
            units.append((label, ps))
    return units


def coaches_of(team, which):
    return sorted([p for p in team if p["kind"] != "Spieler" and p.get("team", "Herren") == which],
                  key=lambda p: COACH_ROLES.index(p["role"]) if p["role"] in COACH_ROLES else 99)


def home_maps_url(info):
    """Karten-Link zum Heimspielort: eigener Link aus dem Hub (nur https), sonst Suche auf OpenStreetMap."""
    url = (info.get("site_home_maps_url") or "").strip()
    if url.startswith("https://") and not any(c in url for c in ' "<>'):
        return url
    q = info.get("site_home_address") or info.get("home_location") or ""
    return f"https://www.openstreetmap.org/search?query={q}" if q else ""


def training_card(times, place, address, sport, ph):
    """Trainingskarte der Mannschaftsseiten: jede Zeile aus dem Hub als Termin (Tag fett, Uhrzeit daneben), darunter Ort mit Karte."""
    rows = []
    for line in str(times or "").splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r"(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)s?\b[,:]?\s*(.*)", line)
        day, rest = (m.group(1), m.group(2)) if m else ("", line)
        rows.append(f'<li><b>{e(day)}</b><span>{e(rest)}</span></li>' if day else f'<li class="wide"><span>{e(rest)}</span></li>')
    when = f'<ul class="tr-times">{"".join(rows)}</ul>' if rows else f"<p>{placeholder(ph + ': Trainingszeiten')}</p>"
    q = address or place
    where = (f'<p class="tr-where"><b>{e(place) if place else placeholder(ph + ": Trainingsort")}</b>{"<br>" + e(address) if address else ""}</p>'
             + (f'<a class="more" href="https://www.openstreetmap.org/search?query={e(q)}" target="_blank" rel="noopener">Anfahrt auf der Karte</a>' if q else ""))
    return f"""<div class="card tr-card"><p class="eyebrow">Training {e(sport)}</p><h3>Trainingszeiten</h3>{when}
    <div class="tr-place"><p class="eyebrow">Trainingsort</p>{where}</div></div>"""


def youth_training_card(info):
    return training_card(info.get("site_youth_training_times"), info.get("site_youth_training_place"), "", "Flag Football", "Next Generation")


def team_games(info, games, team, title="Nächste Spiele", skip=0, always=False):
    """Kommende Spiele einer Mannschaft. always: Abschnitt auch ohne Termine zeigen (mit Hinweis)."""
    today = date.today().isoformat()
    up = [g for g in games if g.get("team", "Herren") == team and g["date"] >= today][skip:skip + 4]   # skip: oben schon gezeigt
    slug = TEAM_SLUG[team]
    if not up and not always:
        return ""
    inner = (f'<div class="games">{"".join(game_card(g, info, live=team == "Herren", own=True) for g in up)}</div>' if up
             else '<div class="card next none"><p class="ng-none"><b>Termine folgen</b><span>Die nächsten Spieltage stehen hier, sobald sie feststehen.</span></p></div>')
    return f'''<section class="wrap reveal">{section_head("Spielplan", title, f'<a class="more" href="/spielplan#{slug}">Ganzer Spielplan</a>')}
  {inner}</section>'''


# ---------------------------------------------------------------------------
# Seiten
# ---------------------------------------------------------------------------
def page_start(info, games, team, sponsors, insta, layout_order=None, articles=()):
    meta = image_meta()
    played = [g for g in games if g["score_us"] is not None][-3:][::-1]
    ig = e(info.get("instagram") or "afc_tigers_emden")
    # Neueste Beiträge aus der Meta-Verbindung, ohne Verbindung die eigenen Galerie-Fotos
    tiles = ([f'<a href="{e(i["url"])}" target="_blank" rel="noopener"><img src="{e(i["image"])}" alt="{e(i["alt"])}" loading="lazy" decoding="async"></a>' for i in insta]
             or [f'<a href="https://www.instagram.com/{ig}/" target="_blank" rel="noopener">{picture(k, "(min-width: 700px) 33vw, 100vw", meta=meta)}</a>' for k in photos("galerie-")[:6]])
    hero = f"""
<section class="hero">
  {picture("hero", "100vw", "hero-img", eager=True, meta=meta)}
  <div class="hero-text">
    <p class="eyebrow light">American Football in Emden</p>
    <h1>{e(info.get("site_hero_title") or info.get("club_name") or "Emden Tigers")}</h1>
    <p class="lead">{text_or_ph(info.get("site_hero_text"), "kurzer Einleitungssatz unter der Überschrift")}</p>
    <div class="btns"><a class="btn red" href="/kontakt#formular">Probetraining</a><a class="btn ghost" href="/spielplan">Spielplan</a></div>
  </div>
</section>"""
    order = [k for k, visible in (layout_order or [[k, True] for k in START_SECTIONS]) if visible and k in START_SECTIONS]
    sec = {}
    # Nächste Spiele über die volle Breite, Herren und Jugend nebeneinander; darunter das Training beider Teams
    sec["karten"] = f"""<section class="games-band"><div class="wrap">
  <div class="sec-head"><p class="eyebrow">Gameday</p><h2>Nächste Spiele</h2><a class="more" href="/spielplan">Ganzer Spielplan</a></div>
  <div class="gameday">
    <div class="next-games">{next_game_card(info, games, "Herren", "Herren", live=True)}{next_game_card(info, games, YOUTH, "Jugend")}</div>
    <div class="card train-card"><p class="eyebrow">Training</p><h3>Komm vorbei</h3>
      <div class="tr-block"><p class="tr-team">Herren <span>Tackle Football</span></p><p>{text_or_ph(info.get("site_training_times"), "Trainingszeiten Herren")}</p>
        <p class="small">{text_or_ph(info.get("site_training_place"), "Trainingsort Herren")}</p>
        <a class="more" href="/herren#training">Mehr zu den Herren</a></div>
      <div class="tr-block"><p class="tr-team">Jugend <span>Flag Football</span></p><p>{text_or_ph(info.get("site_youth_training_times"), "Trainingszeiten Jugend")}</p>
        <p class="small">{text_or_ph(info.get("site_youth_training_place"), "Trainingsort Jugend")}</p>
        <a class="more" href="/jugend#training">Mehr zur Jugend</a></div>
      <a class="btn red train-btn" href="/kontakt#formular">Probetraining anfragen</a></div>
  </div>
</div></section>"""
    # Abschnitte in wechselnden Farben (tone white / dark, sonst Seitengrau), damit die Startseite nicht eintönig wirkt
    sec["wer"] = f"""<section class="tone white"><div class="split wrap reveal">
  <div class="split-img">{picture("team", "(min-width: 900px) 50vw, 100vw", meta=meta)}</div>
  <div class="split-text"><p class="eyebrow">Wer wir sind</p><h2>{e(info.get("club_name") or "Emden Tigers")}</h2>
    <p>{text_or_ph(info.get("site_about"), "Vereinsvorstellung (ein bis zwei Absätze)")}</p>
    <a class="btn dark" href="/herren">Zum Kader</a></div>
</div></section>"""
    sec["teams"] = f"""<section class="tone dark"><div class="wrap reveal">{section_head("Mannschaften", "Unsere Teams")}
  <div class="teams">
    <a class="team-card" href="/herren">{picture("spiel", "(min-width: 700px) 50vw, 100vw", meta=meta)}
      <div><p class="eyebrow light">Tackle Football</p><h3>Herren</h3><p>Unser Tackle-Football-Team: volle Ausrüstung, volle Leidenschaft.</p><span class="more">Kader und Coaches</span></div></a>
    <a class="team-card youth" href="/jugend"><div class="team-logo"><img src="/static/logo.png" alt="" width="444" height="276" loading="lazy"></div>
      <div><p class="eyebrow light">Flag Football</p><h3>Next Generation</h3><p>Unsere Jugend: kontaktloser Football für Kinder und Jugendliche.</p><span class="more">Zur Jugend</span></div></a>
  </div>
</div></section>"""
    sec["news"] = (f'''<section class="tone white"><div class="wrap reveal">{section_head("Aktuelles", "News", '<a class="more" href="/news">Alle News</a>')}
  <div class="news-grid">{"".join(news_card(a) for a in articles[:3])}</div></div></section>''' if articles else '')
    sec["ergebnisse"] = (f'''<section class="wrap reveal">{section_head("Ergebnisse", "Zuletzt gespielt", '<a class="more" href="/spielplan">Ganzer Spielplan</a>')}
  <div class="games">{"".join(game_card(g, info) for g in played)}</div></section>''' if played else '')
    sec["band"] = """<section class="band reveal">
  <div class="wrap band-in"><div><p class="eyebrow light">Probetraining</p><h2>Lust auf Football?</h2>
    <p>Komm zu einem Training vorbei oder schreib uns vorher eine Nachricht.</p></div>
    <a class="btn red" href="/kontakt#formular">Jetzt anfragen</a></div>
</section>"""
    sec["sponsoren"] = (f'''<section class="wrap reveal">{section_head("Partner", "Unsere Sponsoren", '<a class="more" href="/sponsoren">Alle Sponsoren</a>')}
  <div class="logos">{"".join(sponsor_tile(s) for s in sponsors[:8])}</div></section>''' if sponsors else '')
    sec["instagram"] = f"""<section class="tone dark"><div class="wrap reveal">{section_head("Instagram", "@" + ig)}
  <div class="insta">{"".join(tiles[:6]) or placeholder("Fotos für das Raster")}</div>
  <p class="center"><a class="btn red" href="https://www.instagram.com/{ig}/" target="_blank" rel="noopener">Folge uns auf Instagram</a></p>
</div></section>"""
    body = hero + "\n".join(sec[k] for k in order)
    return layout("", "", "Die Emden Tigers sind die American-Football-Sparte des SV Amisia Stern Wolthusen in Emden. Training, Herren, Jugend, Spielplan und Sponsoren.", body, info)


def player_card(p):
    """Spielerkarte: Foto (nur mit Einwilligung) oder Tiger-Logo, Rückennummer, darunter Name und Position."""
    name = f"{p['first_name']} {p['last_name']}".strip()
    img = (f'<img src="{e(p["photo"])}" alt="{e(name)}" loading="lazy" decoding="async">' if p["photo"]
           else '<div class="no-photo"><img src="/static/logo.png" alt="" loading="lazy"></div>')
    num = f'<span class="num">#{e(p["number"])}</span>' if p["number"] else ""
    return f'<article class="person">{img}{num}<h3>{e(name)}</h3><p>{e(POS_NAME.get(p["position"], p["position"]))}</p></article>'


def next_game_card(info, games, team, label="Nächstes Spiel", live=False):
    """Schwarze Karte „Nächstes Spiel“ einer Mannschaft mit Countdown, Spieltagssponsor und Livestream.
    live: Platz für den Livescore (site.js liest /public/live und blendet Spielstand, Chips und Punkte ein)."""
    ng = next_game([g for g in games if g.get("team", "Herren") == team])
    if not ng:   # ohne Termin nur eine schmale Zeile
        return (f'<div class="card next none"><p class="eyebrow">{e(label)}</p>'
                f'<p class="ng-none"><b>Termine folgen</b><span>Der nächste Termin steht hier, sobald er feststeht.</span></p></div>')
    days = (date.fromisoformat(ng["date"]) - date.today()).days
    when = "<b>Heute</b> ist Gameday" if days == 0 else f"<b>{days}</b>{' Tag' if days == 1 else ' Tage'} bis zum Kickoff"
    extra = f'<p class="g-sponsor">Spieltag präsentiert von {e(ng["sponsor"])}</p>' if ng.get("sponsor") else ""
    foot = f'<div class="g-foot"><p class="countdown">{when}</p>{extra}</div>'
    if live:
        return (f'<div class="card next" data-live data-game="{ng.get("id") or ""}" data-home="{1 if ng["home"] else 0}">'
                f'<p class="eyebrow">{e(label)}</p>{game_card(ng, info, big=True, live=True)}{foot}</div>')
    return f'<div class="card next"><p class="eyebrow">{e(label)}</p>{game_card(ng, info, big=True)}{foot}</div>'


def coach_card(p):
    """Kompakte Querkarte für Coaches und Staff."""
    name = f"{p['first_name']} {p['last_name']}".strip()
    img = (f'<img src="{e(p["photo"])}" alt="{e(name)}" loading="lazy" decoding="async">' if p["photo"]
           else '<img class="logo" src="/static/logo.png" alt="" loading="lazy">')
    return f'<article class="coach"><div class="c-img">{img}</div><div><h4>{e(name)}</h4><p>{e(p["role"] or p["kind"])}</p></div></article>'


def page_herren(info, team, games):
    players = [p for p in team if p["kind"] == "Spieler" and p.get("team", "Herren") == "Herren"]
    coaches = coaches_of(team, "Herren")
    units = roster(players)
    kader = "".join(f'<h3 class="unit">{e(u)}</h3><div class="people">' + "".join(player_card(p) for p in ps) + "</div>" for u, ps in units)
    addr = info.get("site_training_address")
    body = f"""<section class="page-hero team-hero">{picture("team", "100vw", "hero-img", eager=True)}<div class="hero-text"><p class="eyebrow light">Tackle Football</p><h1>Herren</h1>
  <p class="lead">Volle Ausrüstung, volle Leidenschaft: unser Team für echten American Football.</p>
  <div class="btns"><a class="btn red" href="/kontakt?anliegen=herren#formular">Probetraining anfragen</a><a class="btn ghost" href="/spielplan#herren">Spielplan</a></div></div></section>
<section class="split wrap reveal team-intro" id="training">
  <div class="split-text"><p class="eyebrow">Unser Team</p><h2>Die Herren der Tigers</h2>
    <p>Hinter jedem Spielzug steckt ein ganzes Team. Bei den Herren spielen Footballer aus Emden und ganz Ostfriesland Tackle Football mit voller Ausrüstung.
    Manche spielen seit Jahren Football, andere haben erst bei uns angefangen. Neue Spieler sind jederzeit willkommen: Komm einfach zum Probetraining.</p></div>
  {training_card(info.get("site_training_times"), info.get("site_training_place"), addr, "Tackle Football", "Herren")}
</section>
<section class="wrap split-info top-info">
  {next_game_card(info, games, "Herren", live=True)}
  <div class="card"><p class="eyebrow">Probetraining</p><h3>Werde Teil der Tigers</h3>
    <p>{text_or_ph(info.get("site_trial_text"), "Hinweise zum Probetraining")}</p>
    <a class="btn red" href="/kontakt?anliegen=herren#formular" style="margin-top:12px">Probetraining anfragen</a></div>
</section>
<section class="wrap" id="coaches">{section_head("Coaching Staff", "Coaches")}
  {f'<div class="coaches">{"".join(coach_card(p) for p in coaches)}</div>' if coaches else '<p>Die Coaches werden bald hier vorgestellt.</p>'}</section>
{f'''<section class="wrap" id="kader">{section_head("Kader", "Saison " + (info.get("season") or ""))}{kader}
  <p class="small muted">Fotos zeigen wir nur mit Einverständnis der Spieler.</p></section>''' if kader else ''}
{team_games(info, games, "Herren", "Weitere Spiele", skip=1)}"""
    return layout("herren", "Herren", "Kader, Coaches und Training der Herrenmannschaft der Emden Tigers.", body, info)


def page_schedule(info, games):
    today = date.today().isoformat()
    meta = image_meta()
    g = meta.get("anfahrt") or {}
    # Lageplan zum Vergrößern: größte vorhandene Fassung (eigenes Bild aus dem Hub oder Standard)
    guide_full = (max(g["src"].items())[1] if g.get("src") else
                  next((f"/web/assets/img/anfahrt-{w}.webp" for w in sorted(IMG_WIDTHS, reverse=True) if (IMG / f"anfahrt-{w}.webp").is_file()), "")) if g else ""
    def season_block(gs, s):
        gs = [g for g in gs if g["season"] == s]
        up = [g for g in gs if g["date"] >= today]
        done = [g for g in gs if g["date"] < today][::-1]
        return (f'<h3 class="unit">Saison {e(s)}</h3>'
                + (f'<h4 class="pos">Kommende Spiele</h4><div class="games">{"".join(game_card(g, info, live=g.get("team", "Herren") == "Herren", own=True) for g in up)}</div>' if up else '')
                + (f'<h4 class="pos">Ergebnisse</h4><div class="games">{"".join(game_card(g, info) for g in done)}</div>' if done else ''))
    def team_block(t):
        gs = [g for g in games if g.get("team", "Herren") == t]
        seasons = sorted({g["season"] for g in gs if g["season"]}, reverse=True)
        empty = ('<p>Der Spielplan der Herren folgt in Kürze.</p>' if t == "Herren"
                 else '<p>Turniere und Spieltage der Next Generation stehen hier, sobald sie feststehen.</p>')
        return (f'<section class="wrap" id="{TEAM_SLUG[t]}">{section_head("Spielplan", "Herren" if t == "Herren" else "Jugend: Next Generation")}'
                + ("".join(season_block(gs, s) for s in seasons) or empty) + '</section>')
    loc = info.get("home_location") or ""
    maps = home_maps_url(info)
    body = f"""<section class="page-hero">{picture("spiel", "100vw", "hero-img", eager=True)}<div class="hero-text"><p class="eyebrow light">Saison {e(info.get("season"))}</p><h1>Spielplan</h1></div></section>
{"".join(team_block(t) for t in TEAMS)}
<section class="wrap split-info">
  <div class="card"><p class="eyebrow">Heimspiele</p><h3>{e(loc) or placeholder("Heimspielort")}</h3>
    <p>{f"Eintritt: {e(info.get('entry_fee'))} €" if info.get("entry_fee") else placeholder("Eintritt")}</p>
    <p>{f'<a href="{e(maps)}" target="_blank" rel="noopener">{e(info["site_home_address"])}</a>' if info.get("site_home_address") and maps else text_or_ph(info.get("site_home_address"), "Adresse des Heimspielorts")}</p>
    {f'<a class="more" href="{e(maps)}" target="_blank" rel="noopener">Anfahrt auf der Karte</a>' if maps else ''}</div>
  <div class="card"><p class="eyebrow">Gut zu wissen</p><h3>Am Spieltag</h3><p>{text_or_ph(info.get("site_gameday_text"), "Infos zum Spieltag (Parken, Essen, Kinder)")}</p></div>
</section>
{f'''<section class="wrap guide" id="anfahrt">{section_head("Heimspiel Guide", "So findest du uns")}
  <a href="{e(guide_full)}" target="_blank" rel="noopener" title="Lageplan groß öffnen">{picture("anfahrt", "(min-width: 1200px) 1160px, 100vw", "guide-img", meta=meta)}</a></section>''' if guide_full else ''}"""
    return layout("spielplan", "Spielplan", "Spielplan, Ergebnisse und Heimspiele der Emden Tigers.", body, info)


def page_contact(info, sent=None, preselect=""):
    form_msg = {"ok": '<p class="msg ok">Danke! Deine Nachricht ist angekommen, wir melden uns bei dir.</p>',
                "fehler": '<p class="msg err">Das hat nicht geklappt. Bitte prüfe deine Angaben und versuche es noch einmal.</p>'}.get(sent, "")
    pick = next((v for v, short, _ in CONTACT_TOPICS if short == preselect), CONTACT_TOPICS[0][0])
    mail = (info.get("site_contact_email") or "").strip()
    ig = (info.get("instagram") or "").lstrip("@")
    ig = ig or "afc_tigers_emden"
    hints = {"Probetraining Herren": "Tackle Football, einfach mal mittrainieren", "Probetraining Jugend": "Flag Football für Kinder und Jugendliche",
             "Sponsoring": "Partner werden oder Supporter Karte", "Allgemeine Frage": "Alles andere rund um den Verein"}
    topics = "".join(f'<label class="topic"><input type="radio" name="anliegen" value="{e(v)}" {"checked" if v == pick else ""}>'
                     f'<span><b>{e(label)}</b><small>{e(hints.get(v, ""))}</small></span></label>' for v, _, label in CONTACT_TOPICS)
    home_addr = info.get("site_home_address")
    maps = home_maps_url(info)
    body =f"""<section class="page-hero">{picture("training", "100vw", "hero-img", eager=True)}<div class="hero-text"><p class="eyebrow light">Kontakt</p><h1>Schreib uns</h1>
  <p class="lead">Probetraining, Sponsoring oder eine Frage zum Verein: Wir melden uns so schnell wie möglich bei dir.</p></div></section>
<section class="wrap contact-wrap" id="formular">
  <div class="contact-main">{section_head("Kontaktformular", "Deine Nachricht")}
    {form_msg}
    <form class="contact" method="post" action="/kontakt">
      <fieldset class="topics"><legend>Worum geht es?</legend>{topics}</fieldset>
      <div class="row2"><label>Name<input name="name" required maxlength="100" autocomplete="name"></label>
        <label>Telefon (optional)<input name="phone" maxlength="40" autocomplete="tel"></label></div>
      <label>E-Mail<input name="email" type="email" maxlength="150" autocomplete="email"></label>
      <label>Nachricht<textarea name="message" rows="6" required maxlength="3000" placeholder="Erzähl uns kurz, worum es geht."></textarea></label>
      <label class="hp" aria-hidden="true">Bitte leer lassen<input name="website" tabindex="-1" autocomplete="off"></label>
      <label class="check"><input type="checkbox" name="consent" value="1" required> Ich bin einverstanden, dass meine Angaben zur Beantwortung meiner Anfrage gespeichert werden. Mehr in der <a href="/datenschutz">Datenschutzerklärung</a>.</label>
      <p class="small muted">E-Mail oder Telefon reicht. Für die Jugend melden sich bitte die Eltern bei uns.</p>
      <button class="btn red" type="submit">Nachricht senden</button>
    </form></div>
  <aside class="contact-side">
    <div class="side-box dark"><p class="eyebrow">Direkt</p>
      <p><b>E-Mail</b><br>{f'<a href="mailto:{e(mail)}">{e(mail)}</a>' if mail else placeholder("Kontakt-E-Mail")}</p>
      <p><b>Instagram</b><br><a href="https://www.instagram.com/{e(ig)}/" target="_blank" rel="noopener">@{e(ig)}</a><br><span class="small">Aktuelles, Spieltage und Einblicke ins Training</span></p></div>
    <div class="side-box"><p class="eyebrow">Training</p>
      <p><b>Herren</b><br>{text_or_ph(info.get("site_training_times"), "Trainingszeiten Herren")}<br><span class="small">{text_or_ph(info.get("site_training_place"), "Trainingsort")}</span></p>
      <p><b>Jugend</b><br>{text_or_ph(info.get("site_youth_training_times"), "Trainingszeiten Jugend")}</p></div>
    <div class="side-box"><p class="eyebrow">Heimspiele</p>
      <p><b>{e(info.get("home_location") or "")}</b>{f'<br><a href="{e(maps)}" target="_blank" rel="noopener">{e(home_addr)}</a>' if home_addr and maps else ("<br>" + e(home_addr) if home_addr else "")}</p>
      {f'<a class="more" href="{e(maps)}" target="_blank" rel="noopener">Anfahrt auf der Karte</a><br>' if maps else ''}
      <a class="more" href="/spielplan#anfahrt">Heimspiel Guide</a></div>
  </aside>
</section>"""
    return layout("kontakt", "Kontakt", "Kontakt zu den Emden Tigers: Probetraining für Herren und Jugend, Sponsoring und Fragen zum Verein.", body, info)


def page_jugend(info, team, games):
    coaches = coaches_of(team, YOUTH)
    ages = info.get("site_youth_ages")
    body = f"""<section class="page-hero youth-hero"><div class="hero-text"><p class="eyebrow light">Jugend der Emden Tigers</p><h1>Next Generation</h1>
  <p class="lead">Flag Football ohne Tackling: schnell, fair und mit ganz viel Spaß.</p>
  <div class="btns"><a class="btn red" href="/kontakt?anliegen=jugend#formular">Probetraining anfragen</a></div></div></section>
<section class="split wrap reveal team-intro" id="training">
  <div class="split-text"><p class="eyebrow">Unser Team</p><h2>Die Next Generation</h2>
    <p>Die Next Generation ist die Jugend der Emden Tigers. Hier spielen Kinder und Jugendliche Flag Football, die kontaktlose Variante des American Football.
    Vorkenntnisse braucht niemand, Mädchen und Jungen trainieren zusammen.{f" Alter: {e(ages)}." if ages else ""}</p>
    <p>Ihr Kind möchte reinschnuppern? Schreiben Sie uns kurz über das Formular, wir melden uns mit allen Infos zum ersten Training.
    Bitte Sportkleidung, Turnschuhe und etwas zu trinken mitbringen.</p>
    <a class="btn red" href="/kontakt?anliegen=jugend#formular">Probetraining anfragen</a></div>
  {youth_training_card(info)}
</section>
<section class="wrap flag" id="flag-football">{section_head("Flag Football", "Was ist Flag Football?")}
  <div class="flag-grid">
    <div class="flag-text">{paragraphs(info.get("site_youth_text")) or f"<p>{placeholder('Vorstellung Flag Football und Next Generation')}</p>"}</div>
    <div class="card flag-rules"><p class="eyebrow">So funktioniert es</p><h3>Die Grundregeln</h3>
      <ol>
        <li><b>Punkte machen</b><span>Wie beim großen Football: Wer den Ball in die gegnerische Endzone trägt oder dort fängt, erzielt einen Touchdown.</span></li>
        <li><b>Flagge statt Tackling</b><span>Alle tragen einen Gürtel mit Flaggen. Zieht ein Verteidiger dem Ballträger eine Flagge ab, ist der Spielzug vorbei.</span></li>
        <li><b>Kein Körperkontakt</b><span>Tackeln, Blocken und Umstoßen sind verboten. Es zählen Schnelligkeit, gutes Werfen und Fangen und kluge Spielzüge.</span></li>
        <li><b>Kleine Teams</b><span>Gespielt wird meist fünf gegen fünf auf einem kleineren Feld. So ist jeder ständig am Ball.</span></li>
        <li><b>Jeder kann alles</b><span>Es gibt keine reinen Blocker. Alle dürfen laufen, werfen und fangen, das macht das Spiel abwechslungsreich.</span></li>
      </ol></div>
  </div>
  <div class="facts flag-facts">
    <div><b>Kontaktlos</b><span>Flagge ziehen statt tackeln</span></div>
    <div><b>Wenig Ausrüstung</b><span>Sportkleidung und Flaggengürtel</span></div>
    <div><b>Für alle</b><span>Mädchen und Jungen zusammen</span></div>
    <div><b>Alter</b><span>{e(ages) if ages else placeholder("Altersgruppen")}</span></div>
  </div>
</section>
<section class="wrap" id="coaches">{section_head("Coaching Staff", "Coaches")}
  {f'<div class="coaches">{"".join(coach_card(p) for p in coaches)}</div>' if coaches else '<p>Die Coaches der Next Generation werden bald hier vorgestellt.</p>'}
  <p class="small muted">Zum Schutz der Kinder und Jugendlichen zeigen wir die Spielerinnen und Spieler der Jugend nicht auf der Webseite.</p></section>
{team_games(info, games, YOUTH, "Nächste Spieltage", always=True)}"""
    return layout("jugend", "Jugend", "Next Generation: die Flag-Football-Jugend der Emden Tigers. Kontaktloser Football für Kinder und Jugendliche in Emden.", body, info)


def sponsor_tile(s):
    inner = (f'<img src="{e(s["logo"])}" alt="{e(s["name"])}" loading="lazy">' if s["logo"] else f'<span>{e(s["name"])}</span>')
    return (f'<a class="logo-tile" href="{e(s["website"])}" target="_blank" rel="noopener sponsored">{inner}</a>' if s["website"]
            else f'<div class="logo-tile">{inner}</div>')


def sponsor_card(s):
    """Sponsor auf der Sponsorenseite: Logo, Name, Paket aus dem Hub, Webseite und Instagram falls vorhanden."""
    logo = (f'<img src="{e(s["logo"])}" alt="{e(s["name"])}" loading="lazy">' if s["logo"] else f'<span>{e(s["name"])}</span>')
    links = []
    if s["website"]:
        links.append(f'<a href="{e(s["website"])}" target="_blank" rel="noopener sponsored">Webseite</a>')
    insta = s.get("instagram") or ""
    if re.fullmatch(r"[A-Za-z0-9._]{1,30}", insta):
        links.append(f'<a href="https://www.instagram.com/{e(insta)}/" target="_blank" rel="noopener">@{e(insta)}</a>')
    return (f'<article class="sponsor-card"><div class="logo-tile">{logo}</div><h3>{e(s["name"])}</h3>'
            + (f'<p class="pkg">{e(s["package"])}</p>' if s["package"] else '')
            + (f'<p class="sc-links">{"".join(links)}</p>' if links else '') + '</article>')


def page_sponsors(info, sponsors):
    body = f"""<section class="page-hero">{picture("fans", "100vw", "hero-img", eager=True)}<div class="hero-text"><p class="eyebrow light">Partner</p><h1>Sponsoren</h1></div></section>
<section class="wrap">{f'<div class="sponsor-grid">{"".join(sponsor_card(s) for s in sorted(sponsors, key=lambda s: PACKAGES.index(s["package"]) if s["package"] in PACKAGES else 99))}</div>' if sponsors
   else '<p>Unsere Sponsoren stellen wir bald hier vor.</p>'}
  <p>{text_or_ph(info.get("site_sponsor_text"), "Text: Sponsor werden (Ansprechpartner, Möglichkeiten)")}</p>
  <div class="btns"><a class="btn red" href="/kontakt?anliegen=sponsoring#formular">Sponsor werden</a></div></section>
<section class="band" id="supporter-karte"><div class="wrap band-in"><div><p class="eyebrow light">Supporter Karte {e(info.get("season"))}</p>
  <h2>{f"{e(info.get('card_price'))} € für die ganze Saison" if info.get("card_price") else placeholder("Preis")}</h2>
  <p>{text_or_ph(info.get("site_card_text"), "Leistungen der Supporter Karte und wo man sie bekommt")}</p></div>
  {'<a class="btn red" href="/supporter-karte#bestellen">Jetzt bestellen</a>' if info.get("site_card_order_open") == "1" else ''}</div></section>"""
    return layout("sponsoren", "Sponsoren", "Sponsoren und Supporter Karte der Emden Tigers.", body, info)


def page_card_order(info, sent=None):
    """Supporter Karte online bestellen; Formular nur, wenn im Hub geöffnet (site_card_order_open)."""
    msg = {"ok": '<p class="msg ok">Danke für deine Bestellung! Du bekommst gleich eine Bestätigung per E-Mail, wir melden uns mit allen Infos.</p>',
           "fehler": '<p class="msg err">Das hat nicht geklappt. Bitte prüfe deine Angaben und versuche es noch einmal.</p>',
           "geschlossen": '<p class="msg err">Die Online-Bestellung ist gerade geschlossen.</p>'}.get(sent, "")
    price, season = info.get("card_price"), info.get("season")
    is_open = info.get("site_card_order_open") == "1"
    form = f"""<form class="contact" method="post" action="/supporter-karte">
      <div class="row2"><label>Name (Karteninhaber)<input name="name" required maxlength="100" autocomplete="name"></label>
        <label>Anzahl Karten<select name="count">{"".join(f'<option value="{n}">{n}</option>' for n in range(1, 6))}</select></label></div>
      <div class="row2"><label>E-Mail<input name="email" type="email" required maxlength="150" autocomplete="email"></label>
        <label>Telefon (optional)<input name="phone" maxlength="40" autocomplete="tel"></label></div>
      <label>Nachricht (optional)<textarea name="message" rows="3" maxlength="1000" placeholder="z. B. weitere Namen bei mehreren Karten"></textarea></label>
      <label class="hp" aria-hidden="true">Bitte leer lassen<input name="website" tabindex="-1" autocomplete="off"></label>
      <label class="check"><input type="checkbox" name="consent" value="1" required> Ich bin einverstanden, dass meine Angaben zur Bearbeitung der Bestellung gespeichert werden. Mehr in der <a href="/datenschutz">Datenschutzerklärung</a>.</label>
      <button class="btn red" type="submit">Verbindlich bestellen</button>
    </form>""" if is_open else '<p>Die Online-Bestellung ist gerade geschlossen. Schreib uns gern über das <a href="/kontakt?anliegen=sponsoring#formular">Kontaktformular</a>.</p>'
    body = f"""<section class="page-hero">{picture("fans", "100vw", "hero-img", eager=True)}<div class="hero-text"><p class="eyebrow light">Supporter Karte {e(season)}</p><h1>Sei dabei</h1>
  <p class="lead">{f"{e(price)} € für die ganze Saison" if price else ""}</p></div></section>
<section class="wrap contact-wrap" id="bestellen">
  <div class="contact-main">{section_head("Online bestellen", "Deine Supporter Karte")}{msg}{form}</div>
  <aside class="contact-side">
    <div class="side-box dark"><p class="eyebrow">Supporter Karte {e(season)}</p><p><b class="big-price">{f"{e(price)} €" if price else placeholder("Preis")}</b><br>pro Karte und Saison</p></div>
    <div class="side-box"><p class="eyebrow">Was du bekommst</p><p>{text_or_ph(info.get("site_card_text"), "Leistungen der Supporter Karte")}</p></div>
    <div class="side-box"><p class="eyebrow">So geht es weiter</p><p>{text_or_ph(info.get("site_card_order_text"), "Hinweis zu Bezahlung und Abholung")}</p></div>
  </aside>
</section>"""
    return layout("supporter-karte", "Supporter Karte", f"Supporter Karte {season} der Emden Tigers online bestellen.", body, info)


def page_legal(slug, info):
    title, embed = LEGAL[slug]
    body = f'<section class="wrap narrow legal"><h1>{e(title)}</h1>{embed}</section>'
    return layout(slug, title, f"{title} der Emden Tigers.", body, info)


def page_404(info):
    body = '<section class="wrap narrow legal"><h1>Seite nicht gefunden</h1><p>Diese Seite gibt es nicht. <a href="/">Zur Startseite</a></p></section>'
    return layout("", "Nicht gefunden", "", body, info)


PAGES = ("", "herren", "jugend", "spielplan", "news", "sponsoren", "kontakt", "supporter-karte", "impressum", "datenschutz")


# ---------------------------------------------------------------------------
# News: Liste, Einzelartikel, Karten für die Startseite
# ---------------------------------------------------------------------------
class _HtmlFilter(HTMLParser):
    """Lässt nur einfache Textauszeichnung durch (Absätze, Überschriften, Listen, Fett, Kursiv, Links, Zitate).
    Skripte, Styles, Einbettungen, Bilder, Formulare und alle Attribute außer einem geprüften href fallen weg."""
    ALLOWED = {"p", "br", "strong", "b", "em", "i", "u", "h2", "h3", "h4", "ul", "ol", "li", "a", "blockquote", "hr"}
    VOID = {"br", "hr"}
    DROP = {"script", "style", "iframe", "object", "embed", "template", "svg", "math", "noscript", "textarea", "select", "title", "head"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.stack, self.skip = [], [], 0

    def handle_starttag(self, tag, attrs):
        if tag in self.DROP:
            self.skip += 1
            return
        if self.skip or tag not in self.ALLOWED:
            return
        if tag in self.VOID:
            self.out.append(f"<{tag}>")
            return
        extra = ""
        if tag == "a":
            href = re.sub(r"[\x00-\x20]", "", dict(attrs).get("href") or "")
            if re.match(r"(https?://|mailto:|/(?!/)|#)", href, re.I):
                ext = href.lower().startswith(("http://", "https://"))
                extra = f' href="{e(href)}"' + (' target="_blank" rel="noopener"' if ext else "")
        self.out.append(f"<{tag}{extra}>")
        self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        if tag in self.VOID and not self.skip:
            self.out.append(f"<{tag}>")

    def handle_endtag(self, tag):
        if tag in self.DROP:
            self.skip = max(0, self.skip - 1)
            return
        if self.skip or tag not in self.stack:
            return
        while self.stack:   # offene Tags bis zu diesem schließen, damit nichts aus dem Artikel herausragt
            t = self.stack.pop()
            self.out.append(f"</{t}>")
            if t == tag:
                break

    def handle_data(self, data):
        if not self.skip:
            self.out.append(e(data))

    def result(self):
        self.close()
        return "".join(self.out) + "".join(f"</{t}>" for t in reversed(self.stack))


def clean_html(t):
    """HTML aus dem Hub für die Webseite: nur erlaubte Tags, alles andere als Text oder entfernt."""
    f = _HtmlFilter()
    f.feed(str(t or ""))
    return f.result()


def render_blocks(blocks):
    """Blöcke aus dem Editor (vom Server schon geprüft). Fließtext darf einfache Auszeichnung enthalten (clean_html), sonst nur Text."""
    out = []
    for b in blocks:
        t = b["t"]
        if t == "p":
            out.append(f'<p>{clean_html(b["text"]).replace(chr(10), "<br>")}</p>')
        elif t == "h":
            out.append(f"<h2>{e(b['text'])}</h2>")
        elif t == "quote":
            out.append(f'<blockquote><p>{lines(b["text"])}</p>{f"<footer>{e(b['by'])}</footer>" if b.get("by") else ""}</blockquote>')
        elif t == "list":
            out.append("<ul>" + "".join(f"<li>{clean_html(x)}</li>" for x in b["items"]) + "</ul>")
        elif t == "highlight":
            out.append(f'<p class="art-highlight">{e(b["text"])}</p>')
        elif t == "cta":
            btn = f'<a class="btn dark" href="{e(b["link"])}">{e(b["label"] or "Mehr erfahren")}</a>' if b.get("link") else ""
            out.append(f'<aside class="art-cta"><p>{lines(b["text"])}</p>{btn}</aside>')
        elif t == "image":
            cap = f"<figcaption>{e(b['caption'])}</figcaption>" if b.get("caption") else ""
            out.append(f'<figure class="art-img"><img src="{e(b["src"])}" alt="{e(b.get("alt"))}" loading="lazy" decoding="async">{cap}</figure>')
        elif t == "note":
            out.append(f'<p class="art-note">{e(b["text"])}</p>')
    return "".join(out)


def plain_text(t, fmt="Text"):
    """Reiner Text (für Vorspann, Beschreibung bei Google): bei HTML ohne Tags."""
    if fmt not in ("HTML", "Blöcke"):
        return str(t or "")
    inline = re.sub(r"</?(strong|b|em|i|u|a)\b[^>]*>", "", clean_html(t))   # Fett, Kursiv, Links ohne Leerzeichen entfernen
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]*>", " ", inline))).strip()


def paragraphs(t):
    """Text aus dem Hub als Absätze: Leerzeile = neuer Absatz, einfacher Umbruch bleibt erhalten. Kein HTML."""
    blocks = [b.strip() for b in re.split(r"\n\s*\n", str(t or "").replace("\r", "")) if b.strip()]
    return "".join(f"<p>{lines(b)}</p>" for b in blocks)


def news_card(a):
    img = (f'<img src="{e(a["image"])}" alt="{e(a["image_alt"])}" loading="lazy" decoding="async">' if a["image"]
           else '<div class="nc-logo"><img src="/static/logo.png" alt="" loading="lazy"></div>')
    teaser = a["teaser"] or (plain_text(a["body"], a.get("format")).strip().split("\n")[0][:180] if a["body"] else "")
    return (f'<a class="news-card" href="/news/{e(a["slug"])}"><div class="nc-img">{img}</div><div class="nc-text">'
            f'<p class="nc-meta">{e(fmt_date(a["date"]))}{f" · {e(a["team"])}" if a["team"] else ""}</p>'
            f'<h3>{e(a["title"])}</h3>{f"<p>{e(teaser)}</p>" if teaser else ""}<span class="more">Weiterlesen</span></div></a>')


def page_news(info, articles):
    body = f"""<section class="page-hero">{picture("spiel", "100vw", "hero-img", eager=True)}<div class="hero-text"><p class="eyebrow light">Aktuelles</p><h1>News</h1></div></section>
<section class="wrap">{f'<div class="news-grid">{"".join(news_card(a) for a in articles)}</div>' if articles else '<p>Hier erscheinen bald die ersten Neuigkeiten aus dem Verein.</p>'}</section>"""
    return layout("news", "News", "Neuigkeiten, Spielberichte und Termine der Emden Tigers.", body, info)


def article_footer(info, a):
    """Unter jedem Artikel: Kasten zum Probetraining (Mannschaft des Artikels) und der Fotograf mit Link."""
    text = (info.get("site_news_cta_text") or "").strip()
    label = (info.get("site_news_cta_button") or "").strip() or "Zum Probetraining"
    topic = "jugend" if a.get("team") == YOUTH else "herren"
    cta = (f'<aside class="art-cta"><p>{lines(text)}</p><a class="btn dark" href="/kontakt?anliegen={topic}#formular">{e(label)}</a></aside>'
           if text else "")
    by = a.get("photo_by") or ""
    who = (f'<a href="{e(a["photo_url"])}" target="_blank" rel="noopener">{e(by)}</a>' if a.get("photo_url") else e(by)) if by else ""
    return cta + (f'<p class="art-credit">Foto: {who}</p>' if who else "")


def page_article(info, a, games):
    g = next((x for x in games if a.get("game_id") and x.get("id") == a["game_id"]), None)
    img = f'<figure class="art-img"><img src="{e(a["image"])}" alt="{e(a["image_alt"])}" decoding="async"></figure>' if a["image"] else ""
    body = f"""<article class="wrap narrow article">
  <p class="eyebrow"><a href="/news">News</a></p>
  <h1>{e(a["title"])}</h1>
  <p class="nc-meta">{e(fmt_date(a["date"], True))}{f" · {e(a['team'])}" if a["team"] else ""}</p>
  {f'<p class="lead">{e(a["teaser"])}</p>' if a["teaser"] else ""}
  {img}
  {f'<div class="art-game">{game_card(g, info)}</div>' if g else ""}
  <div class="art-body">{render_blocks(a.get("blocks") or []) if a.get("format") == "Blöcke" else clean_html(a["body"]) if a.get("format") == "HTML" else paragraphs(a["body"])}</div>
  {article_footer(info, a)}
  <p><a class="more" href="/news">Alle News</a></p>
</article>"""
    base = getattr(_ctx, "base", "")
    head = ""
    if base:
        ld = {"@context": "https://schema.org", "@type": "NewsArticle", "headline": a["title"][:110], "datePublished": a["date"],
              "url": f"{base}/news/{a['slug']}", "publisher": {"@type": "SportsTeam", "name": info.get("club_name") or "Emden Tigers", "logo": base + "/static/logo.png"},
              "image": [base + (a["image"] or "/static/logo.png")]}
        head = f'<link rel="canonical" href="{e(base)}/news/{e(a["slug"])}">' + jsonld(ld)
    desc = a["teaser"] or plain_text(a["body"], a.get("format")).strip().split("\n")[0][:160]
    return layout("news", a["title"], desc, body, info, extra_head=head)


def render(slug, data, sent=None):
    site = data.get("site") or {}
    _ctx.images = site.get("images") or {}
    _ctx.base = (data.get("base") or "").rstrip("/")   # absolute Adresse für Google (canonical, strukturierte Daten)
    _ctx.games = data.get("games") or []
    try:
        return render_page(slug, data, sent, site)
    finally:
        _ctx.images, _ctx.base, _ctx.games = {}, "", []


# ---------------------------------------------------------------------------
# Google: strukturierte Daten (schema.org als JSON-LD) und Sitemap
# ---------------------------------------------------------------------------
def berlin_offset(d):
    """Zeitzone Emden: Sommerzeit vom letzten Sonntag im März bis zum letzten Sonntag im Oktober."""
    last_sun = lambda m: max(date(d.year, m, day) for day in range(25, 32) if date(d.year, m, day).weekday() == 6)
    return "+02:00" if last_sun(3) <= d < last_sun(10) else "+01:00"


def jsonld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False).replace("</", "<\\/") + "</script>"


def org_ld(info, base):
    club = info.get("club_name") or "Emden Tigers"
    ig = (info.get("instagram") or "").lstrip("@")
    obj = {"@context": "https://schema.org", "@type": "SportsTeam", "name": club, "sport": "American Football",
           "url": base + "/", "logo": base + "/static/logo.png",
           "location": {"@type": "Place", "name": info.get("home_location") or "", "address": info.get("site_home_address") or ""},
           "parentOrganization": {"@type": "SportsOrganization", "name": "SV Amisia Stern Wolthusen", "url": "https://www.amisia-stern.de"}}
    if ig:
        obj["sameAs"] = [f"https://www.instagram.com/{ig}/"]
    return obj


def game_ld(g, info, base):
    """Spiel als SportsEvent; nur mit Datum. Ohne Uhrzeit nur das Datum (Google zeigt dann den ganzen Tag)."""
    club = info.get("club_name") or "Emden Tigers"
    try:
        d = date.fromisoformat(g["date"])
    except (TypeError, ValueError):
        return None
    t = (g.get("time") or "").strip()
    start = f"{g['date']}T{t}:00{berlin_offset(d)}" if len(t) == 5 and t[2] == ":" else g["date"]
    opp = (g.get("opponent") or {}).get("name") or ""
    us = {"@type": "SportsTeam", "name": club if g.get("team", "Herren") == "Herren" else f"{club} {g.get('team')}"}
    them = {"@type": "SportsTeam", "name": opp or "Gegner offen"}
    home, away = (us, them) if g["home"] else (them, us)
    loc = g.get("location") or (info.get("home_location") if g["home"] else "") or ""
    obj = {"@context": "https://schema.org", "@type": "SportsEvent", "name": f"{home['name']} gegen {away['name']}",
           "sport": "American Football", "startDate": start, "eventStatus": "https://schema.org/EventScheduled",
           "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode", "homeTeam": home, "awayTeam": away,
           "location": {"@type": "Place", "name": loc or "Wird noch bekannt gegeben",
                        **({"address": info.get("site_home_address")} if g["home"] and info.get("site_home_address") else {})},
           "organizer": {"@type": "SportsTeam", "name": club, "url": base + "/"}, "url": base + "/spielplan", "image": [base + "/static/logo.png"]}
    if g.get("league") or g.get("kind"):
        obj["description"] = f"{g.get('league') or g.get('kind')}, {g.get('team', 'Herren')}"
    if g.get("stream"):
        obj["eventAttendanceMode"] = "https://schema.org/MixedEventAttendanceMode"
        obj["location"] = [obj["location"], {"@type": "VirtualLocation", "url": g["stream"]}]
    return obj


def sitemap(base, articles=()):
    """sitemap.xml mit allen öffentlichen Seiten und den veröffentlichten Artikeln."""
    today = date.today().isoformat()
    pages = [("", "1.0"), ("herren", "0.8"), ("jugend", "0.8"), ("spielplan", "0.9"), ("news", "0.8"), ("sponsoren", "0.6"), ("kontakt", "0.6"),
             ("supporter-karte", "0.5"), ("impressum", "0.2"), ("datenschutz", "0.2")]
    rows = "".join(f"<url><loc>{escape(base)}/{s}</loc><lastmod>{today}</lastmod><priority>{p}</priority></url>" for s, p in pages)
    rows += "".join(f"<url><loc>{escape(base)}/news/{escape(a['slug'])}</loc><lastmod>{escape(a['date'])}</lastmod><priority>0.6</priority></url>" for a in articles)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{rows}</urlset>\n'


def robots(base):
    return ("User-agent: *\nAllow: /\nDisallow: /hub\nDisallow: /api/\nDisallow: /static/\nDisallow: /media/\nDisallow: /login\n"
            "Disallow: /bestellen/\nDisallow: /teilen/\nDisallow: /invite/\nDisallow: /passwort-\nDisallow: /public/\nDisallow: /live/\nDisallow: /HighlightDesk\n" + (f"Sitemap: {base}/sitemap.xml\n" if base else ""))


def render_page(slug, data, sent, site):
    info = data["info"]
    if slug == "":
        return page_start(info, data["games"], data["team"], data["sponsors"], data.get("instagram") or [], site.get("layout"), data.get("articles") or [])
    if slug == "news":
        return page_news(info, data.get("articles") or [])
    if slug == "news-artikel" and data.get("article"):
        return page_article(info, data["article"], data["games"])
    if slug == "herren":
        return page_herren(info, data["team"], data["games"])
    if slug == "jugend":
        return page_jugend(info, data["team"], data["games"])
    if slug == "spielplan":
        return page_schedule(info, data["games"])
    if slug == "supporter-karte":
        return page_card_order(info, sent)
    if slug == "kontakt":
        return page_contact(info, sent, data.get("preselect") or "")
    if slug == "sponsoren":
        return page_sponsors(info, data["sponsors"])
    if slug in LEGAL:
        return page_legal(slug, info)
    return page_404(info)
