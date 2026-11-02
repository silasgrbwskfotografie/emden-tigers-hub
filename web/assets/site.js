/* Emden Tigers Webseite: nur kleine Extras, die Seite funktioniert auch ohne JavaScript. */
document.documentElement.classList.add('js');

// Abschnitte beim Scrollen sanft einblenden
const items = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -10% 0px' });
  items.forEach(el => io.observe(el));
} else {
  items.forEach(el => el.classList.add('in'));
}

// Handy-Menü nach dem Antippen eines Links schließen
document.querySelectorAll('.site-nav a').forEach(a => a.addEventListener('click', () => { document.getElementById('menu').checked = false; }));

// Livescore auf der Herren-Karte der Startseite (Daten vom Hub, nur lesen).
// Adresse des Hubs: leer = dieselbe Adresse wie die Webseite. Für einen anderen Server z. B. 'https://hub.emdentigers.de'.
const HUB_URL = '';
const LIVE_EVERY = 5000;          // alle 5 Sekunden, nur solange die Seite sichtbar ist
const FINAL_SHOW = 2 * 3600;      // Endstand etwa 2 Stunden zeigen

const liveCard = document.querySelector('[data-live]');
if (liveCard && window.fetch) {
  const q = sel => liveCard.querySelector(sel);
  const el = {
    vs: q('.vs'), score: q('.g-score'), left: q('[data-s="l"]'), right: q('[data-s="r"]'),
    chips: q('.live-chips'), state: q('[data-l="state"]'), period: q('[data-l="period"]'), down: q('[data-l="down"]'), stale: q('[data-l="stale"]'),
    countdown: q('.countdown'),
  };
  const cardGame = Number(liveCard.dataset.game) || 0;
  let lastScore = null, timer = null;

  const show = (node, on) => { if (node && node.hidden === on) node.hidden = !on; };
  const setText = (node, text) => { if (node && node.textContent !== text) node.textContent = text; };

  const render = d => {
    let state = 'normal';
    const sameGame = !d || !d.game || !cardGame || d.game.id === cardGame;
    if (d && sameGame && (d.status === 'live' || d.status === 'half')) state = d.status;
    else if (d && sameGame && d.status === 'final' && d.updated && d.now - d.updated < FINAL_SHOW) state = 'final';
    const on = state !== 'normal';
    liveCard.classList.toggle('is-live', on);
    show(el.vs, !on); show(el.score, on); show(el.chips, on); show(el.countdown, !on);
    if (!on) { lastScore = null; return; }

    // Spielstand in der Reihenfolge der Logos auf der Karte, score_us gehört immer den Tigers
    const home = liveCard.dataset.home === '1';
    const us = Number(d.score_us) || 0, them = Number(d.score_them) || 0;
    const l = String(home ? us : them), r = String(home ? them : us);
    const now = l + ':' + r;
    setText(el.left, l); setText(el.right, r);
    el.score.setAttribute('aria-label', `Spielstand Tigers ${us}, ${d.them_name || 'Gegner'} ${them}`);
    if (lastScore !== null && lastScore !== now) {   // kurz hervorheben
      el.score.classList.remove('flash'); void el.score.offsetWidth; el.score.classList.add('flash');
    }
    lastScore = now;

    setText(el.state, state === 'final' ? 'Endstand' : 'Live');
    el.state.classList.toggle('final', state === 'final');
    const period = state === 'half' ? 'Halbzeit' : state === 'live' ? (d.period || '') : '';
    setText(el.period, period); show(el.period, !!period);
    const down = state === 'live' ? (d.down || '') : '';
    setText(el.down, down); show(el.down, !!down);
    show(el.stale, !!d.stale && state !== 'final');
  };

  let seq = 0;
  const poll = async () => {
    clearTimeout(timer);
    const mine = ++seq;   // überholt eine ältere Antwort eine neuere, zählt nur die neueste Abfrage
    try {
      const r = await fetch(HUB_URL + '/public/live', { cache: 'no-store' });
      const d = r.ok ? await r.json() : null;
      if (d && mine === seq) render(d);
    } catch (e) { /* Netzfehler: still weiter versuchen, letzter Stand bleibt stehen */ }
    if (mine === seq && !document.hidden) timer = setTimeout(poll, LIVE_EVERY);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else poll(); });
  poll();
}
