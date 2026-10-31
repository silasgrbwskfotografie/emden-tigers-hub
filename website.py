"""Emden Tigers: öffentliche Webseite (wird vom Server gerendert, ohne JavaScript-Pflicht).

Bekommt ausschließlich die öffentlichen Daten aus server.py (public_info, public_games, public_team,
public_sponsors) und baut daraus HTML. Kein Datenbankzugriff, keine internen Felder.
Fehlende Inhalte erscheinen als deutlich markierter Platzhalter (Klasse .ph), siehe PLATZHALTER.md.
"""
import json
from datetime import date, datetime
from html import escape
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
NAV = [("", "Start"), ("herren", "Herren"), ("jugend", "Jugend"), ("spielplan", "Spielplan"), ("sponsoren", "Sponsoren"), ("kontakt", "Kontakt")]
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
def image_meta():
    f = IMG / "bilder.json"
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def picture(name, sizes="100vw", cls="", eager=False, meta=None):
    meta = meta if meta is not None else image_meta()
    m = meta.get(name)
    widths = [w for w in IMG_WIDTHS if (IMG / f"{name}-{w}.webp").is_file()]
    if not m or not widths:
        return f'<div class="img-ph {e(cls)}">{placeholder("Foto " + name)}</div>'
    srcset = ", ".join(f"/web/assets/img/{name}-{w}.webp {w}w" for w in widths)
    mid = widths[min(1, len(widths) - 1)]
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'   # das erste große Bild sofort, alle anderen erst beim Scrollen
    return (f'<img class="{e(cls)}" src="/web/assets/img/{name}-{mid}.webp" srcset="{srcset}" sizes="{e(sizes)}" '
            f'width="{m.get("w", 1600)}" height="{m.get("h", 1067)}" alt="{e(m.get("alt", ""))}" {load} decoding="async">')


def photos(prefix):
    """Alle vorhandenen Bilder einer Gruppe (z. B. galerie-1, galerie-2 ...)."""
    return sorted((k for k in image_meta() if k.startswith(prefix)), key=lambda k: (len(k), k))


# ---------------------------------------------------------------------------
# Rahmen: Kopf, Navigation, Fußzeile
# ---------------------------------------------------------------------------
def layout(slug, title, description, body, info, extra_head=""):
    club = info.get("club_name") or "Emden Tigers"
    nav = "".join(f'<a href="/{s}" class="{"active" if s == slug else ""}">{e(l)}</a>' for s, l in NAV)
    ig = (info.get("instagram") or "").lstrip("@")
    mail = (info.get("site_contact_email") or "").strip()
    og_img = "/web/assets/img/hero-1280.webp" if (IMG / "hero-1280.webp").is_file() else "/static/logo.png"
    return f"""<!doctype html>
<html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title + " | " + club if title else club + " | American Football in Emden")}</title>
<meta name="description" content="{e(description)}">
<meta property="og:title" content="{e(title or club)}"><meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{og_img}"><meta property="og:type" content="website">
<meta name="theme-color" content="#0B0B0B">
<link rel="icon" href="/static/icon.png">
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
<main>{body}</main>
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
    <div><h4>Verein</h4><p><a href="/herren">Herren</a><br><a href="/jugend">Jugend</a><br><a href="/spielplan">Spielplan</a><br><a href="/sponsoren">Sponsoren</a><br><a href="/kontakt">Kontakt</a></p></div>
    <div><h4>Rechtliches</h4><p><a href="/impressum">Impressum</a><br><a href="/datenschutz">Datenschutz</a><br><a class="members" href="/hub">Mitgliederbereich</a></p></div>
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


def game_card(g, info, big=False):
    club = info.get("club_short") or "Tigers"
    o = (g.get("opponent") or {}).get("name") or "Gegner offen"
    home = g["home"]
    teams = f"{e(club)} <span>vs</span> {e(o)}" if home else f"{e(o)} <span>vs</span> {e(club)}"
    result = ""
    if g["score_us"] is not None:
        us, them = int(float(g["score_us"])), int(float(g["score_them"]))
        cls = "win" if us > them else "loss" if us < them else "draw"
        result = f'<div class="result {cls}">{us}:{them}</div>'
    logo = (g.get("opponent") or {}).get("logo")
    return f"""<article class="game {'big' if big else ''} {'home' if home else 'away'}">
      <div class="g-date"><b>{e(fmt_date(g['date'], True))}</b>{f'<span>{e(g["time"])} Uhr</span>' if g['time'] else ''}</div>
      <div class="g-teams">{f'<img src="{e(logo)}" alt="" loading="lazy" width="48" height="48">' if logo else ''}<h3>{teams}</h3></div>
      <div class="g-meta">{f'<span class="tag team">{e(g["team"])}</span>' if g.get("team", "Herren") != "Herren" else ''}<span class="tag">{'Heimspiel' if home else 'Auswärts'}</span>{f'<span>{e(g["league"] or g["kind"])}</span>' if (g["league"] or g["kind"]) else ''}
        {f'<span>{e(g["location"])}</span>' if g['location'] else ''}</div>{result}</article>"""


def roster(players):
    """Spieler nach Offense, Defense, Special Teams, Two-Way; innerhalb nach Position und Rückennummer."""
    key = lambda p: (POSITIONS.index(p["position"]) if p["position"] in POSITIONS else 99, int(p["number"]) if str(p["number"]).isdigit() else 999)
    units = []
    for u, label in (("Offense", "Offense"), ("Defense", "Defense"), ("Special Teams", "Special Teams"), ("Two-Way", "Two-Way"), ("", "Team")):
        ps = sorted((p for p in players if (p["unit"] or "") == u), key=key)
        if ps:
            units.append((label, ps))
    return units


def person_card(p, coach=False):
    name = f"{p['first_name']} {p['last_name']}".strip()
    img = (f'<img src="{e(p["photo"])}" alt="{e(name)}" loading="lazy" decoding="async">' if p["photo"]
           else '<div class="no-photo"><img src="/static/logo.png" alt="" loading="lazy"></div>')
    sub = e(p["role"] or p["kind"]) if coach else e(POS_NAME.get(p["position"], p["position"]))
    num = "" if coach or not p["number"] else f'<span class="num">#{e(p["number"])}</span>'
    return f'<article class="person">{img}{num}<h3>{e(name)}</h3><p>{sub}</p></article>'


def coaches_of(team, which):
    return sorted([p for p in team if p["kind"] != "Spieler" and p.get("team", "Herren") == which],
                  key=lambda p: COACH_ROLES.index(p["role"]) if p["role"] in COACH_ROLES else 99)


def herren_training_cards(info):
    addr = info.get("site_training_address")
    return f"""<div class="card"><p class="eyebrow">Training Herren</p><h3>Tackle Football</h3><p class="big-lines">{text_or_ph(info.get("site_training_times"), "Trainingszeiten")}</p></div>
  <div class="card"><p class="eyebrow">Trainingsort Herren</p><h3>{text_or_ph(info.get("site_training_place"), "Trainingsort")}</h3>
    <p>{text_or_ph(addr, "Adresse")}</p>
    {f'<a class="more" href="https://www.openstreetmap.org/search?query={e(addr)}" target="_blank" rel="noopener">Anfahrt auf der Karte</a>' if addr else ''}</div>"""


def youth_training_card(info):
    place = info.get("site_youth_training_place")
    return f"""<div class="card"><p class="eyebrow">Training Jugend</p><h3>Flag Football</h3>
    <p class="big-lines">{text_or_ph(info.get("site_youth_training_times"), "Trainingszeiten Next Generation")}</p>
    <p>{text_or_ph(place, "Trainingsort Next Generation")}</p>
    {f'<a class="more" href="https://www.openstreetmap.org/search?query={e(place)}" target="_blank" rel="noopener">Anfahrt auf der Karte</a>' if place else ''}</div>"""


def team_games(info, games, team, title="Nächste Spiele"):
    today = date.today().isoformat()
    up = [g for g in games if g.get("team", "Herren") == team and g["date"] >= today][:4]
    slug = TEAM_SLUG[team]
    return (f'''<section class="wrap reveal">{section_head("Spielplan", title, f'<a class="more" href="/spielplan#{slug}">Ganzer Spielplan</a>')}
  <div class="games">{"".join(game_card(g, info) for g in up)}</div></section>''' if up else '')


# ---------------------------------------------------------------------------
# Seiten
# ---------------------------------------------------------------------------
def page_start(info, games, team, sponsors, insta):
    meta = image_meta()
    ng = next_game(games)
    played = [g for g in games if g["score_us"] is not None][-3:][::-1]
    ig = e(info.get("instagram") or "afc_tigers_emden")
    # Neueste Beiträge aus der Meta-Verbindung, ohne Verbindung die eigenen Galerie-Fotos
    tiles = ([f'<a href="{e(i["url"])}" target="_blank" rel="noopener"><img src="{e(i["image"])}" alt="{e(i["alt"])}" loading="lazy" decoding="async"></a>' for i in insta]
             or [f'<a href="https://www.instagram.com/{ig}/" target="_blank" rel="noopener">{picture(k, "(min-width: 700px) 33vw, 100vw", meta=meta)}</a>' for k in photos("galerie-")[:6]])
    days = (date.fromisoformat(ng["date"]) - date.today()).days if ng else None
    next_html = (f"""<p class="eyebrow">Nächstes Spiel</p>{game_card(ng, info, big=True)}
        <p class="countdown"><b>{'Heute' if days == 0 else days}</b>{'' if days == 0 else (' Tag' if days == 1 else ' Tage')}{' bis zum Kickoff' if days else ' ist Gameday'}</p>"""
                 if ng else f'<p class="eyebrow">Nächstes Spiel</p><h3>Termine folgen</h3><p>Der Spielplan der Saison {e(info.get("season"))} steht bald hier.</p>')
    body = f"""
<section class="hero">
  {picture("hero", "100vw", "hero-img", eager=True, meta=meta)}
  <div class="hero-text">
    <p class="eyebrow light">American Football in Emden</p>
    <h1>{e(info.get("site_hero_title") or info.get("club_name") or "Emden Tigers")}</h1>
    <p class="lead">{text_or_ph(info.get("site_hero_text"), "kurzer Einleitungssatz unter der Überschrift")}</p>
    <div class="btns"><a class="btn red" href="#training">Probetraining</a><a class="btn ghost" href="/spielplan">Spielplan</a></div>
  </div>
</section>
<section class="cards wrap">
  <div class="card next">{next_html}</div>
  <div class="card"><p class="eyebrow">Training Herren</p><h3>Komm vorbei</h3><p>{text_or_ph(info.get("site_training_times"), "Trainingszeiten")}</p>
    <p class="small">{text_or_ph(info.get("site_training_place"), "Trainingsort")}</p><a class="more" href="#training">Alle Infos zum Training</a></div>
  <div class="card"><p class="eyebrow">Supporter Karte {e(info.get("season"))}</p><h3>Sei dabei</h3>
    <p>{text_or_ph(info.get("site_card_short"), "Kurztext Supporter Karte")}</p><a class="more" href="/sponsoren#supporter-karte">Mehr erfahren</a></div>
</section>
<section class="split wrap reveal">
  <div class="split-img">{picture("team", "(min-width: 900px) 50vw, 100vw", meta=meta)}</div>
  <div class="split-text"><p class="eyebrow">Wer wir sind</p><h2>{e(info.get("club_name") or "Emden Tigers")}</h2>
    <p>{text_or_ph(info.get("site_about"), "Vereinsvorstellung (ein bis zwei Absätze)")}</p>
    <a class="btn dark" href="/herren">Zum Kader</a></div>
</section>
<section class="wrap reveal">{section_head("Mannschaften", "Unsere Teams")}
  <div class="teams">
    <a class="team-card" href="/herren">{picture("spiel", "(min-width: 700px) 50vw, 100vw", meta=meta)}
      <div><p class="eyebrow light">Tackle Football</p><h3>Herren</h3><p>Unser Tackle-Football-Team: volle Ausrüstung, volle Leidenschaft.</p><span class="more">Kader und Coaches</span></div></a>
    <a class="team-card youth" href="/jugend"><div class="team-logo"><img src="/static/logo.png" alt="" width="444" height="276" loading="lazy"></div>
      <div><p class="eyebrow light">Flag Football</p><h3>Next Generation</h3><p>Unsere Jugend: kontaktloser Football für Kinder und Jugendliche.</p><span class="more">Zur Jugend</span></div></a>
  </div>
</section>
<section class="wrap reveal" id="training">{section_head("Mitmachen", "Training und Probetraining")}
  <p class="intro-text">Bei den Tigers kannst du jederzeit reinschnuppern. Such dir die passende Mannschaft aus, komm zum Training und lern das Team kennen.
  Ob du schon Football gespielt hast oder den Sport erst entdecken willst: Wir freuen uns auf dich.</p>
  <div class="split-info three">{herren_training_cards(info)}{youth_training_card(info)}</div>
  <div class="trial-note">
    <p>{text_or_ph(info.get("site_trial_text"), "Hinweise zum Probetraining (was mitbringen, Alter, Ausrüstung)")}</p>
    <div class="btns"><a class="btn red" href="/kontakt?anliegen=herren#formular">Probetraining Herren anfragen</a><a class="btn dark" href="/kontakt?anliegen=jugend#formular">Probetraining Jugend anfragen</a></div>
  </div>
</section>
{f'''<section class="wrap reveal">{section_head("Ergebnisse", "Zuletzt gespielt", '<a class="more" href="/spielplan">Ganzer Spielplan</a>')}
  <div class="games">{"".join(game_card(g, info) for g in played)}</div></section>''' if played else ''}
<section class="band reveal">
  <div class="wrap band-in"><div><p class="eyebrow light">Probetraining</p><h2>Lust auf Football?</h2>
    <p>Komm zu einem Training vorbei oder schreib uns vorher eine Nachricht.</p></div>
    <a class="btn red" href="/kontakt#formular">Jetzt anfragen</a></div>
</section>
{f'''<section class="wrap reveal">{section_head("Partner", "Unsere Sponsoren", '<a class="more" href="/sponsoren">Alle Sponsoren</a>')}
  <div class="logos">{"".join(sponsor_tile(s) for s in sponsors[:8])}</div></section>''' if sponsors else ''}
<section class="wrap reveal">{section_head("Instagram", "@" + ig)}
  <div class="insta">{"".join(tiles[:6]) or placeholder("Fotos für das Raster")}</div>
  <p class="center"><a class="btn dark" href="https://www.instagram.com/{ig}/" target="_blank" rel="noopener">Folge uns auf Instagram</a></p>
</section>"""
    return layout("", "", "Die Emden Tigers sind die American-Football-Sparte des SV Amisia Stern Wolthusen in Emden. Training, Herren, Jugend, Spielplan und Sponsoren.", body, info)


def page_herren(info, team, games):
    players = [p for p in team if p["kind"] == "Spieler" and p.get("team", "Herren") == "Herren"]
    coaches = coaches_of(team, "Herren")
    kader = "".join(f'<h3 class="unit">{e(u)}</h3><div class="people">' + "".join(person_card(p) for p in ps) + '</div>' for u, ps in roster(players))
    body = f"""<section class="page-hero">{picture("team", "100vw", "hero-img", eager=True)}<div class="hero-text"><p class="eyebrow light">Tackle Football</p><h1>Herren</h1>
  <p class="lead">Volle Ausrüstung, volle Leidenschaft: unser Team für echten American Football.</p></div></section>
<section class="wrap narrow intro"><p>Hinter jedem Spielzug steckt ein ganzes Team. Hier stellen wir dir die Spieler und Coaches der Tigers vor.
  Manche spielen seit Jahren Football, andere haben erst bei uns angefangen. Alle verbindet die Leidenschaft für den Sport.</p></section>
{f'''<section class="wrap" id="kader">{section_head("Kader", "Saison " + (info.get("season") or ""))}{kader}
  <p class="small muted">Fotos zeigen wir nur mit Einverständnis der Spieler.</p></section>''' if kader else ''}
<section class="wrap" id="coaches">{section_head("Coaching Staff", "Coaches")}
  <div class="people">{"".join(person_card(p, coach=True) for p in coaches) or '<p>Die Coaches werden bald hier vorgestellt.</p>'}</div></section>
{team_games(info, games, "Herren")}
<section class="wrap">{section_head("Mitmachen", "Training")}
  <div class="split-info">{herren_training_cards(info)}</div>
  <div class="btns"><a class="btn red" href="/kontakt?anliegen=herren#formular">Probetraining anfragen</a></div></section>"""
    return layout("herren", "Herren", "Kader, Coaches und Training der Herrenmannschaft der Emden Tigers.", body, info)


def page_schedule(info, games):
    today = date.today().isoformat()
    def season_block(gs, s):
        gs = [g for g in gs if g["season"] == s]
        up = [g for g in gs if g["date"] >= today]
        done = [g for g in gs if g["date"] < today][::-1]
        return (f'<h3 class="unit">Saison {e(s)}</h3>'
                + (f'<h4 class="pos">Kommende Spiele</h4><div class="games">{"".join(game_card(g, info) for g in up)}</div>' if up else '')
                + (f'<h4 class="pos">Ergebnisse</h4><div class="games">{"".join(game_card(g, info) for g in done)}</div>' if done else ''))
    def team_block(t):
        gs = [g for g in games if g.get("team", "Herren") == t]
        seasons = sorted({g["season"] for g in gs if g["season"]}, reverse=True)
        empty = ('<p>Der Spielplan der Herren folgt in Kürze.</p>' if t == "Herren"
                 else '<p>Turniere und Spieltage der Next Generation stehen hier, sobald sie feststehen.</p>')
        return (f'<section class="wrap" id="{TEAM_SLUG[t]}">{section_head("Spielplan", "Herren" if t == "Herren" else "Jugend: Next Generation")}'
                + ("".join(season_block(gs, s) for s in seasons) or empty) + '</section>')
    loc = info.get("home_location") or ""
    body = f"""<section class="page-hero">{picture("spiel", "100vw", "hero-img", eager=True)}<div class="hero-text"><p class="eyebrow light">Saison {e(info.get("season"))}</p><h1>Spielplan</h1></div></section>
{"".join(team_block(t) for t in TEAMS)}
<section class="wrap split-info">
  <div class="card"><p class="eyebrow">Heimspiele</p><h3>{e(loc) or placeholder("Heimspielort")}</h3>
    <p>{f"Eintritt: {e(info.get('entry_fee'))} €" if info.get("entry_fee") else placeholder("Eintritt")}</p>
    <p>{text_or_ph(info.get("site_home_address"), "Adresse des Heimspielorts")}</p>
    {f'<a class="more" href="https://www.openstreetmap.org/search?query={e(info.get("site_home_address") or loc)}" target="_blank" rel="noopener">Anfahrt auf der Karte</a>' if (info.get("site_home_address") or loc) else ''}</div>
  <div class="card"><p class="eyebrow">Gut zu wissen</p><h3>Am Spieltag</h3><p>{text_or_ph(info.get("site_gameday_text"), "Infos zum Spieltag (Parken, Essen, Kinder)")}</p></div>
</section>"""
    return layout("spielplan", "Spielplan", "Spielplan, Ergebnisse und Heimspiele der Emden Tigers.", body, info)


def page_contact(info, sent=None, preselect=""):
    form_msg = {"ok": '<p class="msg ok">Danke! Deine Nachricht ist angekommen, wir melden uns bei dir.</p>',
                "fehler": '<p class="msg err">Das hat nicht geklappt. Bitte prüfe deine Angaben und versuche es noch einmal.</p>'}.get(sent, "")
    pick = next((v for v, short, _ in CONTACT_TOPICS if short == preselect), CONTACT_TOPICS[0][0])
    mail = (info.get("site_contact_email") or "").strip()
    ig = (info.get("instagram") or "").lstrip("@")
    topics = "".join(f'<label><input type="radio" name="anliegen" value="{e(v)}" {"checked" if v == pick else ""}> {e(label)}</label>' for v, _, label in CONTACT_TOPICS)
    body = f"""<section class="page-hero">{picture("training", "100vw", "hero-img", eager=True)}<div class="hero-text"><p class="eyebrow light">Kontakt</p><h1>Schreib uns</h1></div></section>
<section class="wrap narrow intro"><p>Du willst zum Probetraining kommen, die Tigers als Sponsor unterstützen oder hast eine Frage zum Verein?
  Schreib uns einfach, wir melden uns so schnell wie möglich bei dir.</p></section>
<section class="wrap split-info">
  <div class="card"><p class="eyebrow">E-Mail</p><h3>Direkt schreiben</h3><p>{f'<a href="mailto:{e(mail)}">{e(mail)}</a>' if mail else placeholder("Kontakt-E-Mail")}</p></div>
  <div class="card"><p class="eyebrow">Instagram</p><h3>@{e(ig or "afc_tigers_emden")}</h3><p>Aktuelles, Spieltage und Einblicke ins Training.</p>
    <a class="more" href="https://www.instagram.com/{e(ig or "afc_tigers_emden")}/" target="_blank" rel="noopener">Zu Instagram</a></div>
</section>
<section class="wrap narrow" id="formular">{section_head("Kontaktformular", "Deine Nachricht")}
  <p>Zum Probetraining: Trainingszeiten und Ort findest du auf der <a href="/#training">Startseite</a>. Für die Jugend melden sich bitte die Eltern bei uns.</p>
  {form_msg}
  <form class="contact" method="post" action="/kontakt">
    <fieldset class="choice"><legend>Worum geht es?</legend>{topics}</fieldset>
    <label>Name<input name="name" required maxlength="100" autocomplete="name"></label>
    <label>E-Mail<input name="email" type="email" maxlength="150" autocomplete="email"></label>
    <label>Telefon (optional)<input name="phone" maxlength="40" autocomplete="tel"></label>
    <label>Nachricht<textarea name="message" rows="5" required maxlength="3000"></textarea></label>
    <label class="hp" aria-hidden="true">Bitte leer lassen<input name="website" tabindex="-1" autocomplete="off"></label>
    <label class="check"><input type="checkbox" name="consent" value="1" required> Ich bin einverstanden, dass meine Angaben zur Beantwortung meiner Anfrage gespeichert werden. Mehr in der <a href="/datenschutz">Datenschutzerklärung</a>.</label>
    <button class="btn red" type="submit">Nachricht senden</button>
  </form></section>"""
    return layout("kontakt", "Kontakt", "Kontakt zu den Emden Tigers: Probetraining für Herren und Jugend, Sponsoring und Fragen zum Verein.", body, info)


def page_jugend(info, team, games):
    coaches = coaches_of(team, YOUTH)
    ages = info.get("site_youth_ages")
    body = f"""<section class="page-hero youth-hero"><div class="hero-text"><p class="eyebrow light">Jugend der Emden Tigers</p><h1>Next Generation</h1>
  <p class="lead">Flag Football ohne Tackling: schnell, fair und mit ganz viel Spaß.</p>
  <div class="btns"><a class="btn red" href="/kontakt?anliegen=jugend#formular">Probetraining anfragen</a></div></div></section>
<section class="split wrap reveal">
  <div class="split-text"><p class="eyebrow">Flag Football</p><h2>Was ist Flag Football?</h2>
    <p>{text_or_ph(info.get("site_youth_text"), "Vorstellung Flag Football und Next Generation")}</p></div>
  <div class="facts">
    <div><b>Kontaktlos</b><span>Fähnchen ziehen statt tackeln</span></div>
    <div><b>Wenig Ausrüstung</b><span>Sportkleidung und Flaggengürtel</span></div>
    <div><b>Für alle</b><span>Mädchen und Jungen zusammen</span></div>
    <div><b>Alter</b><span>{e(ages) if ages else placeholder("Altersgruppen")}</span></div>
  </div>
</section>
<section class="wrap split-info">
  {youth_training_card(info)}
  <div class="card"><p class="eyebrow">Für Eltern</p><h3>Erst mal reinschnuppern</h3>
    <p>Ihr Kind möchte Flag Football ausprobieren? Schreiben Sie uns kurz über das Formular, wir melden uns mit allen Infos zum ersten Training.
    Bitte bringen Sie Sportkleidung, Turnschuhe und etwas zu trinken mit.</p>
    <a class="more" href="/kontakt?anliegen=jugend#formular">Zum Kontaktformular</a></div>
</section>
<section class="wrap" id="coaches">{section_head("Coaching Staff", "Coaches")}
  <div class="people">{"".join(person_card(p, coach=True) for p in coaches) or '<p>Die Coaches der Next Generation werden bald hier vorgestellt.</p>'}</div>
  <p class="small muted">Zum Schutz der Kinder und Jugendlichen zeigen wir die Spielerinnen und Spieler der Jugend nicht auf der Webseite.</p></section>
{team_games(info, games, YOUTH, "Nächste Spieltage")}"""
    return layout("jugend", "Jugend", "Next Generation: die Flag-Football-Jugend der Emden Tigers. Kontaktloser Football für Kinder und Jugendliche in Emden.", body, info)


def sponsor_tile(s):
    inner = (f'<img src="{e(s["logo"])}" alt="{e(s["name"])}" loading="lazy">' if s["logo"] else f'<span>{e(s["name"])}</span>')
    return (f'<a class="logo-tile" href="{e(s["website"])}" target="_blank" rel="noopener sponsored">{inner}</a>' if s["website"]
            else f'<div class="logo-tile">{inner}</div>')


def page_sponsors(info, sponsors):
    groups = sorted({s["package"] for s in sponsors}, key=lambda p: PACKAGES.index(p) if p in PACKAGES else 99)
    body = f"""<section class="page-hero">{picture("fans", "100vw", "hero-img", eager=True)}<div class="hero-text"><p class="eyebrow light">Partner</p><h1>Sponsoren</h1></div></section>
<section class="wrap">{"".join(f'<h3 class="unit">{e(g or "Partner")}</h3><div class="logos">' + "".join(sponsor_tile(s) for s in sponsors if s["package"] == g) + '</div>' for g in groups)
   or '<p>Unsere Sponsoren stellen wir bald hier vor.</p>'}
  <p>{text_or_ph(info.get("site_sponsor_text"), "Text: Sponsor werden (Ansprechpartner, Möglichkeiten)")}</p>
  <div class="btns"><a class="btn red" href="/kontakt?anliegen=sponsoring#formular">Sponsor werden</a></div></section>
<section class="band" id="supporter-karte"><div class="wrap band-in"><div><p class="eyebrow light">Supporter Karte {e(info.get("season"))}</p>
  <h2>{f"{e(info.get('card_price'))} € für die ganze Saison" if info.get("card_price") else placeholder("Preis")}</h2>
  <p>{text_or_ph(info.get("site_card_text"), "Leistungen der Supporter Karte und wo man sie bekommt")}</p></div></div></section>"""
    return layout("sponsoren", "Sponsoren", "Sponsoren und Supporter Karte der Emden Tigers.", body, info)


def page_legal(slug, info):
    title, embed = LEGAL[slug]
    body = f'<section class="wrap narrow legal"><h1>{e(title)}</h1>{embed}</section>'
    return layout(slug, title, f"{title} der Emden Tigers.", body, info)


def page_404(info):
    body = '<section class="wrap narrow legal"><h1>Seite nicht gefunden</h1><p>Diese Seite gibt es nicht. <a href="/">Zur Startseite</a></p></section>'
    return layout("", "Nicht gefunden", "", body, info)


PAGES = ("", "herren", "jugend", "spielplan", "sponsoren", "kontakt", "impressum", "datenschutz")


def render(slug, data, sent=None):
    info = data["info"]
    if slug == "":
        return page_start(info, data["games"], data["team"], data["sponsors"], data.get("instagram") or [])
    if slug == "herren":
        return page_herren(info, data["team"], data["games"])
    if slug == "jugend":
        return page_jugend(info, data["team"], data["games"])
    if slug == "spielplan":
        return page_schedule(info, data["games"])
    if slug == "kontakt":
        return page_contact(info, sent, data.get("preselect") or "")
    if slug == "sponsoren":
        return page_sponsors(info, data["sponsors"])
    if slug in LEGAL:
        return page_legal(slug, info)
    return page_404(info)
