/* Highlight Desk: Videoanalyse der Emden Tigers unter /HighlightDesk
   Daten aus dem Hub (Tabellen films, film_plays, film_playlists, Bereich „analyse“). Anmeldung mit dem Hub-Konto.
   Lesen: Spieler und Coaches. Hochladen, Taggen, Playlists: Schreibrecht (Coaches). Der Server prüft jede Anfrage. */
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : ''; };
const fmtT = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const byId = (l, id) => (l || []).find(x => x.id == id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ME = null;
const S = { films: [], plays: [], lists: [], games: [], opponents: [] };

/* ---------------------------------------------------------------- Server */
async function api(path, method = 'GET', body) {
  const opt = { method, headers: { 'X-TMH': '1' } };
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch('/api/' + path, opt);
  if (r.status === 401) { ME = null; showLogin(); throw new Error('Nicht angemeldet'); }
  const d = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error((d && d.error) || 'Fehler ' + r.status); e.status = r.status; throw e; }
  return d;
}
const canEdit = () => !!ME && (ME.is_admin || (ME.perms?.analyse || 0) >= 2);
async function reload() {
  const opt = t => api(t).catch(e => (e.status === 403 ? [] : Promise.reject(e)));
  [S.films, S.plays, S.lists, S.games, S.opponents] = await Promise.all([api('films'), api('film_plays'), api('film_playlists'), opt('games'), opt('opponents')]);
  S.films.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2600); }
function modal(html) { $('#modalBox').innerHTML = html; $('#modal').hidden = false; return $('#modalBox'); }
function closeModal() { $('#modal').hidden = true; $('#modalBox').innerHTML = ''; }

/* ---------------------------------------------------------------- Highlight-Desk-Ereignisse: Name, Gruppe, Sekunden vor und nach dem Moment */
const HD = {
  run: ['Run', 'Offense', 3, 12], pass: ['Pass', 'Offense', 3, 12], defense: ['Defensiv', 'Defense', 3, 12], special: ['Special Teams', 'Special Teams', 3, 14],
  td: ['Touchdown', 'Punkte', 20, 25], fg: ['Field Goal', 'Punkte', 15, 20], pat: ['Extrapunkt', 'Punkte', 10, 12], twopt: ['2-Punkte', 'Punkte', 12, 15],
  safety: ['Safety', 'Punkte', 15, 20], bigplay: ['Big Play', 'Big Play', 12, 15],
  int: ['Interception', 'Turnover', 12, 15], fumble: ['Fumble', 'Turnover', 10, 12], turnover: ['Turnover on Downs', 'Turnover', 10, 12],
  sack: ['Sack', 'Defense', 8, 10], flag: ['Penalty Flag', 'Strafe', 8, 10], dq: ['Disqualifikation', 'Strafe', 15, 15], review: ['Challenge', 'Sonstiges', 10, 15],
  kickoff: ['Kickoff', 'Special Teams', 5, 12], punt: ['Punt', 'Special Teams', 5, 12], ret: ['Return', 'Special Teams', 8, 12],
  timeout: ['Auszeit', 'Sonstiges', 5, 5], verletzung: ['Verletzung', 'Sonstiges', 5, 10], notiz: ['Notiz', 'Sonstiges', 5, 10],
};
const GROUPS = ['Offense', 'Defense', 'Special Teams', 'Punkte', 'Big Play', 'Turnover', 'Strafe', 'Sonstiges'];
const LISTS = {
  play_type: ['Run', 'Pass', 'Screen', 'RPO', 'Play Action', 'QB Run', 'Trick Play', 'Punt', 'Field Goal', 'Kickoff', 'Extrapunkt'],
  direction: ['Links', 'Mitte', 'Rechts'], hash: ['Links', 'Mitte', 'Rechts'],
  result: ['Raumgewinn', 'Kein Raumgewinn', 'Raumverlust', 'First Down', 'Pass komplett', 'Pass unvollständig', 'Touchdown', 'Interception', 'Fumble', 'Sack', 'Strafe', 'Punt', 'Field Goal gut', 'Field Goal verschossen'],
};
const typ = p => HD[p.type] || [p.type ? p.type.charAt(0).toUpperCase() + p.type.slice(1) : 'Szene', 'Sonstiges', 5, 10];
const us = f => f.us_side === 'a' ? 'a' : 'h';
const isUs = (p, f) => !!p.side && p.side === us(f);
const sideName = (side, f) => side === 'h' ? (f.home_name || 'Heim') : side === 'a' ? (f.away_name || 'Gast') : '';
const range = p => { const [, , pre, post] = typ(p); const a = p.clip_start != null && p.clip_start !== '' ? +p.clip_start : Math.max(0, p.t - pre);
  const b = p.clip_end != null && p.clip_end !== '' ? +p.clip_end : p.t + post; return [a, Math.max(a + 1, b)]; };
const tagLine = p => [p.down && p.distance ? `${p.down}. & ${p.distance}` : p.down ? `${p.down}. Down` : '', p.formation, p.play_type,
  p.gain !== '' && p.gain != null ? `${Number(p.gain) > 0 ? '+' : ''}${p.gain} Yds` : '', p.result].filter(Boolean).join(' · ');
const items = l => { try { const v = JSON.parse(l.items || '[]'); return Array.isArray(v) ? v.filter(x => x && x.play) : []; } catch { return []; } };
const meta = f => { try { return JSON.parse(f.meta || '{}') || {}; } catch { return {}; } };
const colors = f => { const m = meta(f), ok = c => /^#[0-9a-f]{3,8}$/i.test(c || ''); return `--home:${ok(m.home_color) ? m.home_color : '#c8202f'};--away:${ok(m.away_color) ? m.away_color : '#1470b8'}`; };
const videoUrl = f => f && f.upload_state === 'fertig' ? `/api/film/${f.id}/video` : '';

/* ---------------------------------------------------------------- Anmeldung */
function showLogin(msg = '') {
  $('#tabs').hidden = true; $('#who').innerHTML = '';
  $('#app').innerHTML = `<div class="card login"><h1>Anmelden</h1><p class="muted small">Mit deinem Konto aus dem Emden Tigers Hub.</p>
    <form id="lf"><label>Benutzername<input name="username" autocomplete="username" required autofocus></label>
      <label>Passwort<input name="password" type="password" autocomplete="current-password" required></label>
      <div class="err" id="lerr">${esc(msg)}</div><button class="pri">Anmelden</button></form>
    <p class="small muted"><a href="/passwort-vergessen">Passwort vergessen?</a></p></div>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const r = await fetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TMH': '1' }, body: JSON.stringify(fd) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) start(); else $('#lerr').textContent = d.error || 'Anmeldung fehlgeschlagen';
  };
}
async function start() {
  try { ME = await api('me'); } catch { return; }
  $('#who').innerHTML = `<span>${esc(ME.display_name || ME.username)}</span><a href="#" id="logout">Abmelden</a>`;
  $('#logout').onclick = async e => { e.preventDefault(); await fetch('/auth/logout', { method: 'POST', headers: { 'X-TMH': '1' } }); ME = null; showLogin(); };
  if (!ME.is_admin && !(ME.perms?.analyse >= 1)) {
    $('#app').innerHTML = `<div class="card login"><h1>Kein Zugriff</h1><p class="muted">Highlight Desk ist für Spieler und Coaches der Emden Tigers. Für dein Konto ist es noch nicht freigeschaltet. Wende dich an einen Admin.</p></div>`;
    return;
  }
  $('#tabs').hidden = false;
  route();
}

/* ---------------------------------------------------------------- Router */
let leave = null;   // Aufräumen der vorherigen Ansicht (Tastatur, Video)
async function route() {
  if (!ME) return;
  if (leave) { leave(); leave = null; }
  document.body.classList.remove('cinema');
  const [page, id] = location.hash.replace(/^#\/?/, '').split('/');
  $$('#tabs a').forEach(a => a.classList.toggle('cur', a.dataset.tab === ({ spiel: 'spiele', '': 'spiele', playlist: 'playlists' }[page] ?? page)));
  const app = $('#app');
  try {
    await reload();
    if (page === 'spiel' && id) return gameView(app, +id);
    if (page === 'playlist' && id) return playlistView(app, +id);
    if (page === 'statistik') return statsView(app);
    if (page === 'playlists') return listsView(app);
    return gamesView(app);
  } catch (e) { if (e.message !== 'Nicht angemeldet') app.innerHTML = `<div class="card">Fehler: ${esc(e.message)}</div>`; }
}
window.addEventListener('hashchange', route);
$('#themeBtn').onclick = () => { const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('hd-theme', t); } catch { /* egal */ } };
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal' && !$('#modalBox [data-busy]')) closeModal(); });

/* ---------------------------------------------------------------- Spiele */
function scoreBox(f) {
  const n = S.plays.filter(p => p.film_id == f.id).length, m = meta(f);
  return `<div class="meta">${esc([fmtDate(f.date), m.competition].filter(Boolean).join(' · ') || 'Spiel')}</div>
    <div class="score"><div class="t">${esc(f.home_name || 'Heim')}</div><div class="g">${esc(f.result || 'vs')}</div><div class="t a">${esc(f.away_name || 'Gast')}</div></div>
    <div class="stripe"></div><div class="row small muted">${n} Spielzüge · ${f.upload_state === 'fertig' ? '<span class="badge ok">Video bereit</span>' : f.upload_state === 'läuft' ? '<span class="badge warn">Upload nicht fertig</span>' : '<span class="badge">ohne Video</span>'}</div>`;
}
function gamesView(app) {
  app.innerHTML = `<div class="page-head"><div><h1>Spiele</h1><div class="muted small">Spielfilm aus Highlight Desk, für Spieler und Coaches der Emden Tigers</div></div>
      ${canEdit() ? '<button class="pri" id="newGame">+ Spiel hochladen</button>' : ''}</div>
    <div class="games">${S.films.map(f => `<a class="game" href="#/spiel/${f.id}" style="${colors(f).replace(/--home/, '--h').replace(/--away/, '--a')}">${scoreBox(f)}</a>`).join('')
      || '<div class="card muted">Noch keine Spiele. Ein Coach lädt das Viewer-Paket aus Highlight Desk hoch: das Spielvideo und die Datei .hdspiel.</div>'}</div>`;
  if ($('#newGame')) $('#newGame').onclick = () => uploadDialog();
}

/* ---------------------------------------------------------------- Hochladen */
const gameLabel = g => { const o = byId(S.opponents, g.opponent_id) || {}; return `${fmtDate(g.date)} ${+g.home ? 'vs' : '@'} ${o.name || 'TBA'}`; };
function filmForm(f = {}) {
  return `<div class="form">
    <label class="full">Titel<input id="f_title" value="${esc(f.title || '')}" placeholder="z. B. Emden Tigers gegen Delmenhorst Bulldogs"></label>
    <label>Spiel aus dem Spielplan<select id="f_game"><option value="">(keins)</option>${S.games.map(g => `<option value="${g.id}" ${g.id == f.game_id ? 'selected' : ''}>${esc(gameLabel(g))}</option>`).join('')}</select></label>
    <label>Datum<input id="f_date" type="date" value="${esc(f.date || '')}"></label>
    <label>Die Tigers sind im Video<select id="f_side"><option value="h" ${us(f) === 'h' ? 'selected' : ''}>Heim</option><option value="a" ${us(f) === 'a' ? 'selected' : ''}>Gast</option></select></label>
    <label>Ergebnis<input id="f_result" value="${esc(f.result || '')}" placeholder="z. B. 21:14"></label>
    <label class="full">Notizen für das Team<textarea id="f_notes" rows="2">${esc(f.notes || '')}</textarea></label></div>`;
}
const readFilm = box => ({ title: $('#f_title', box).value.trim(), game_id: $('#f_game', box).value ? +$('#f_game', box).value : null, date: $('#f_date', box).value,
  us_side: $('#f_side', box).value, result: $('#f_result', box).value.trim(), notes: $('#f_notes', box).value });
function uploadDialog(film) {
  const isNew = !film;
  const box = modal(`<h2>${isNew ? 'Spiel hochladen' : 'Video oder Spielzüge ersetzen'}</h2>
    <p class="muted small">In Highlight Desk unter Einstellungen > System > „Spiel für den Viewer“ das Paket erstellen und entpacken. Darin liegen das Spielvideo (MP4) und die Datei .hdspiel mit allen Markierungen.</p>
    <div class="form"><label class="full">Datei .hdspiel (Spielzüge)<input type="file" id="u_hd" accept=".hdspiel,.json,application/json"></label>
      <label class="full">Spielvideo (MP4)<input type="file" id="u_vid" accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov"></label></div>
    ${isNew ? filmForm({ us_side: 'h' }) : ''}
    <div id="u_prog" hidden><div class="prog"><span></span></div><div class="small muted" id="u_txt"></div></div>
    <div class="foot-btns"><span class="small muted">Während des Uploads diese Seite offen lassen.</span><div class="row"><button id="u_cancel">Abbrechen</button><button class="pri" id="u_go">Hochladen</button></div></div>`);
  let cancelled = false;
  $('#u_cancel', box).onclick = () => { cancelled = true; window.onbeforeunload = null; closeModal(); };
  if (isNew) {
    $('#f_game', box).onchange = () => { const g = byId(S.games, $('#f_game', box).value); if (!g) return; const o = byId(S.opponents, g.opponent_id) || {};
      $('#f_side', box).value = +g.home ? 'h' : 'a'; if (!$('#f_date', box).value) $('#f_date', box).value = g.date || '';
      if (!$('#f_title', box).value) $('#f_title', box).value = +g.home ? `Emden Tigers gegen ${o.name || 'Gegner'}` : `${o.name || 'Gegner'} gegen Emden Tigers`; };
    $('#u_hd', box).onchange = async () => { try { const d = JSON.parse(await $('#u_hd', box).files[0].text());
      if (!$('#f_title', box).value && d.titel) $('#f_title', box).value = d.titel; if (!$('#f_date', box).value && d.datum) $('#f_date', box).value = d.datum;
      if (!$('#f_result', box).value && d.ergebnis) $('#f_result', box).value = d.ergebnis; } catch { toast('Die .hdspiel-Datei ist nicht lesbar.'); } };
  }
  $('#u_go', box).onclick = async () => {
    const hdFile = $('#u_hd', box).files[0], vid = $('#u_vid', box).files[0];
    if (!hdFile && !vid) return alert('Bitte die .hdspiel-Datei und/oder das Video wählen.');
    let hd = null;
    if (hdFile) { try { hd = JSON.parse(await hdFile.text()); } catch { return alert('Die .hdspiel-Datei ist nicht lesbar.'); } }
    const status = (t, pct) => { $('#u_txt', box).textContent = t; if (pct != null) $('.prog span', box).style.width = pct + '%'; };
    $('#u_go', box).disabled = true; $('#u_prog', box).hidden = false; box.setAttribute('data-busy', '');
    window.onbeforeunload = () => 'Der Upload läuft noch.';
    try {
      const f = isNew ? await api('films', 'POST', readFilm(box)) : film;
      if (hd) { status('Spielzüge werden eingelesen ...', 2); const r = await api(`film/${f.id}/import`, 'POST', { hdspiel: hd }); status(`${r.added} neue und ${r.updated} aktualisierte Spielzüge.`, 5); }
      if (vid) await uploadVideo(f.id, vid, status, () => cancelled);
      window.onbeforeunload = null; closeModal(); toast('Spiel gespeichert');
      if (location.hash === `#/spiel/${f.id}`) route(); else location.hash = `#/spiel/${f.id}`;
    } catch (e) { window.onbeforeunload = null; box.removeAttribute('data-busy'); $('#u_go', box).disabled = false; status('Fehler: ' + e.message); }
  };
}
async function uploadVideo(fid, file, status, isCancelled) {
  const CH = 32 * 1024 * 1024, ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.mp4'])[0].toLowerCase(), t0 = Date.now();
  let off = 0, tries = 0;
  while (off < file.size) {
    if (isCancelled()) throw new Error('Abgebrochen');
    try {
      const r = await fetch(`/api/film/${fid}/chunk?offset=${off}&total=${file.size}&ext=${encodeURIComponent(ext)}`,
        { method: 'POST', headers: { 'X-TMH': '1', 'Content-Type': 'application/octet-stream' }, body: file.slice(off, Math.min(file.size, off + CH)) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409 && d.next != null) { off = d.next; continue; }
      if (!r.ok) throw Object.assign(new Error(d.error || 'Fehler ' + r.status), { fatal: r.status < 500 || r.status === 507 });
      off = d.next; tries = 0;
      status(`Video: ${Math.round(off / 1048576)} von ${Math.round(file.size / 1048576)} MB (${(off / 1048576 / Math.max(1, (Date.now() - t0) / 1000)).toFixed(1)} MB/s)`, 5 + 95 * off / file.size);
    } catch (e) {
      if (e.fatal || ++tries > 5) throw e;
      status(`Verbindung unterbrochen, neuer Versuch ${tries} von 5 ...`); await sleep(2000 * tries);
    }
  }
}

/* ---------------------------------------------------------------- Player mit Zeitleiste, Zeichnen, Zoom, A-B-Schleife */
function player(el, marks) {
  el.innerHTML = `<div class="stage" id="stage"><div class="zoomer" id="zoomer"><video id="v" preload="metadata" playsinline></video><canvas id="cv"></canvas></div>
      <div class="novid" id="novid" hidden>Für dieses Spiel ist noch kein Video hochgeladen.</div></div>
    <div class="bar" id="bar"><div class="tr"></div><div id="marks"></div><div class="rg" id="rg" hidden></div><div class="ab" id="abA" hidden></div><div class="ab" id="abB" hidden></div><div class="ph" id="ph"></div></div>
    <div class="times"><span id="tcur">0:00</span><span id="tinfo"></span><span id="tdur">0:00</span></div>
    <div class="ctrl">
      <button class="sm" data-c="prev" title="Vorheriger Spielzug (P)">⏮</button>
      <button class="sm" data-c="back" title="5 Sekunden zurück (Pfeil links)">−5 s</button>
      <button class="sm" data-c="fb" title="Ein Bild zurück (Komma)">‹ Bild</button>
      <button class="pri" data-c="play" title="Abspielen oder Pause (Leertaste)">▶</button>
      <button class="sm" data-c="ff" title="Ein Bild vor (Punkt)">Bild ›</button>
      <button class="sm" data-c="fwd" title="5 Sekunden vor (Pfeil rechts)">+5 s</button>
      <button class="sm" data-c="next" title="Nächster Spielzug (N)">⏭</button>
      <select data-c="rate" title="Tempo">${[0.25, 0.5, 0.75, 1, 1.5, 2].map(r => `<option value="${r}" ${r === 1 ? 'selected' : ''}>${String(r).replace('.', ',')}x</option>`).join('')}</select>
      <span class="sp"></span>
      <button class="sm" data-c="a" title="Schleife Anfang (I)">A</button><button class="sm" data-c="b" title="Schleife Ende (O)">B</button>
      <label><input type="checkbox" data-c="loop"> Schleife</label>
      <label><input type="checkbox" data-c="auto" checked> Weiter zum nächsten</label>
      <button class="sm" data-c="cinema" title="Großes Bild">Groß</button><button class="sm" data-c="full" title="Vollbild">Vollbild</button>
    </div>
    <div class="draw">
      <span class="small muted">Zeichnen</span>
      ${[['none', 'Zeiger'], ['pen', 'Stift'], ['line', 'Linie'], ['arrow', 'Pfeil'], ['circle', 'Kreis']].map(([k, l]) => `<button class="sm ${k === 'none' ? 'on' : ''}" data-tool="${k}">${l}</button>`).join('')}
      ${['#f2b705', '#e5384a', '#ffffff', '#19b45a', '#1470b8'].map((c, i) => `<button class="col ${i ? '' : 'on'}" data-color="${c}" style="background:${c}" title="Farbe"></button>`).join('')}
      <button class="sm" data-c="clear">Löschen</button>
      <span class="sp"></span>
      <span class="small muted">Zoom</span>${[1, 1.5, 2, 3].map(z => `<button class="sm ${z === 1 ? 'on' : ''}" data-zoom="${z}">${String(z).replace('.', ',')}x</button>`).join('')}
      <button class="sm" data-c="shot" title="Aktuelles Bild mit Zeichnung speichern">Bild speichern</button>
    </div>`;
  const v = $('#v', el), cv = $('#cv', el), ctx = cv.getContext('2d'), stage = $('#stage', el), zoomer = $('#zoomer', el), bar = $('#bar', el);
  const st = { range: null, onEnd: null, src: '', A: null, B: null, tool: 'none', color: '#f2b705', shapes: [], cur: null, zoom: 1, pan: [0, 0], drag: null };
  const btn = c => $(`[data-c="${c}"]`, el);
  const P = { video: v, onPrev: null, onNext: null, marks: marks || [] };

  const fit = () => { const r = stage.getBoundingClientRect(); cv.width = Math.round(r.width * devicePixelRatio); cv.height = Math.round(r.height * devicePixelRatio); paint(); };
  const ro = new ResizeObserver(fit); ro.observe(stage);
  const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  const paint = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    const W = cv.width, H = cv.height, lw = Math.max(3, W / 300);
    [...st.shapes, st.cur].filter(Boolean).forEach(s => {
      ctx.strokeStyle = ctx.fillStyle = s.color; ctx.lineWidth = lw; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath();
      const [x1, y1] = [s.pts[0][0] * W, s.pts[0][1] * H], [x2, y2] = [s.pts.at(-1)[0] * W, s.pts.at(-1)[1] * H];
      if (s.tool === 'pen') { s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H))); ctx.stroke(); }
      else if (s.tool === 'circle') { ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        if (s.tool === 'arrow') { const a = Math.atan2(y2 - y1, x2 - x1), h = lw * 5; ctx.beginPath(); ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - h * Math.cos(a - .45), y2 - h * Math.sin(a - .45)); ctx.lineTo(x2 - h * Math.cos(a + .45), y2 - h * Math.sin(a + .45)); ctx.closePath(); ctx.fill(); } }
    });
  };
  const applyZoom = () => {
    const r = stage.getBoundingClientRect(), z = st.zoom;
    st.pan[0] = Math.min(0, Math.max(r.width * (1 - z), st.pan[0])); st.pan[1] = Math.min(0, Math.max(r.height * (1 - z), st.pan[1]));
    zoomer.style.transform = `translate(${st.pan[0]}px, ${st.pan[1]}px) scale(${z})`;
    stage.style.cursor = st.tool !== 'none' ? 'crosshair' : z > 1 ? 'grab' : 'default';
  };
  stage.addEventListener('pointerdown', e => {
    if (!P.src) return;
    stage.setPointerCapture(e.pointerId);
    if (st.tool !== 'none') { v.pause(); st.cur = { tool: st.tool, color: st.color, pts: [pt(e)] }; return; }
    if (st.zoom > 1) st.drag = [e.clientX - st.pan[0], e.clientY - st.pan[1]]; else act.play();
  });
  stage.addEventListener('pointermove', e => {
    if (st.cur) { if (st.cur.tool === 'pen') st.cur.pts.push(pt(e)); else st.cur.pts[1] = pt(e); paint(); }
    else if (st.drag) { st.pan = [e.clientX - st.drag[0], e.clientY - st.drag[1]]; applyZoom(); }
  });
  stage.addEventListener('pointerup', () => { if (st.cur && st.cur.pts.length > 1) st.shapes.push(st.cur); st.cur = null; st.drag = null; paint(); });

  // Zeitleiste mit Markierungen aller (gefilterten) Spielzüge
  const drawMarks = () => {
    const d = v.duration || 0;
    $('#marks', el).innerHTML = d ? P.marks.map(m => `<div class="mk ${m.side || 'n'}" style="left:${100 * m.t / d}%" title="${esc(m.label)}"></div>`).join('') : '';
    ['A', 'B'].forEach(k => { const x = $('#ab' + k, el); x.hidden = st[k] == null || !d; if (d && st[k] != null) x.style.left = 100 * st[k] / d + '%'; });
    const rg = $('#rg', el); rg.hidden = !st.range || !d;
    if (st.range && d) { rg.style.left = 100 * st.range[0] / d + '%'; rg.style.width = 100 * (st.range[1] - st.range[0]) / d + '%'; }
  };
  P.setMarks = m => { P.marks = m; drawMarks(); };
  const seekBar = e => { const r = bar.getBoundingClientRect(); if (v.duration) v.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * v.duration; };
  bar.addEventListener('pointerdown', e => { bar.setPointerCapture(e.pointerId); seekBar(e); bar.onpointermove = seekBar; });
  bar.addEventListener('pointerup', () => { bar.onpointermove = null; });

  v.addEventListener('loadedmetadata', () => { $('#tdur', el).textContent = fmtT(v.duration); drawMarks(); });
  v.addEventListener('timeupdate', () => {
    $('#tcur', el).textContent = fmtT(v.currentTime);
    if (v.duration) $('#ph', el).style.left = 100 * v.currentTime / v.duration + '%';
    if (btn('loop').checked && st.A != null && st.B != null && st.B > st.A) { if (v.currentTime >= st.B || v.currentTime < st.A - 1) v.currentTime = st.A; return; }
    if (st.range && v.currentTime >= st.range[1]) {
      if (btn('loop').checked) { v.currentTime = st.range[0]; return; }
      const cb = st.onEnd; st.range = null; drawMarks();
      if (btn('auto').checked && cb) cb(); else v.pause();
    }
  });
  v.addEventListener('play', () => { btn('play').textContent = '⏸'; st.shapes = []; paint(); });
  v.addEventListener('pause', () => { btn('play').textContent = '▶'; });

  const act = {
    play: () => (v.paused ? v.play().catch(() => {}) : v.pause()), back: () => { v.currentTime -= 5; }, fwd: () => { v.currentTime += 5; },
    fb: () => { v.pause(); v.currentTime = Math.max(0, v.currentTime - 1 / 30); }, ff: () => { v.pause(); v.currentTime += 1 / 30; },
    prev: () => P.onPrev && P.onPrev(), next: () => P.onNext && P.onNext(),
    a: () => { st.A = v.currentTime; if (st.B != null && st.B <= st.A) st.B = null; drawMarks(); toast('Schleife Anfang ' + fmtT(st.A)); },
    b: () => { if (st.A == null || v.currentTime <= st.A) return toast('Erst den Anfang (A) setzen'); st.B = v.currentTime; btn('loop').checked = true; drawMarks(); toast('Schleife ' + fmtT(st.A) + ' bis ' + fmtT(st.B)); },
    clear: () => { st.shapes = []; paint(); },
    cinema: () => { document.body.classList.toggle('cinema'); setTimeout(fit, 50); },
    full: () => (stage.requestFullscreen ? stage.requestFullscreen() : null),
    shot: () => {   // Videobild in Originalgröße plus Zeichnung als PNG
      if (!v.videoWidth) return;
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
      const g = c.getContext('2d'); g.drawImage(v, 0, 0, c.width, c.height);
      const r = stage.getBoundingClientRect(), s = Math.min(r.width / c.width, r.height / c.height), ox = (r.width - c.width * s) / 2, oy = (r.height - c.height * s) / 2;
      g.drawImage(cv, ox * devicePixelRatio, oy * devicePixelRatio, c.width * s * devicePixelRatio, c.height * s * devicePixelRatio, 0, 0, c.width, c.height);
      const a = document.createElement('a'); a.download = `highlight-desk-${fmtT(v.currentTime).replace(/:/g, '-')}.png`; a.href = c.toDataURL('image/png'); a.click();
    },
  };
  $$('button[data-c]', el).forEach(b => b.onclick = () => act[b.dataset.c]());
  btn('rate').onchange = () => { v.playbackRate = +btn('rate').value; };
  btn('loop').onchange = () => { if (!btn('loop').checked) { st.A = st.B = null; drawMarks(); } };
  $$('[data-tool]', el).forEach(b => b.onclick = () => { st.tool = b.dataset.tool; $$('[data-tool]', el).forEach(x => x.classList.toggle('on', x === b)); applyZoom(); });
  $$('[data-color]', el).forEach(b => b.onclick = () => { st.color = b.dataset.color; $$('[data-color]', el).forEach(x => x.classList.toggle('on', x === b)); });
  $$('[data-zoom]', el).forEach(b => b.onclick = () => { const r = stage.getBoundingClientRect(), z = +b.dataset.zoom;
    st.pan = [r.width * (1 - z) / 2, r.height * (1 - z) / 2]; st.zoom = z; $$('[data-zoom]', el).forEach(x => x.classList.toggle('on', x === b)); applyZoom(); });

  P.load = src => { if (P.src === src) return; P.src = src; $('#novid', el).hidden = !!src; v.hidden = !src; if (src) { v.src = src; v.load(); } else v.removeAttribute('src'); };
  P.play = (r, onEnd, info) => {
    st.range = r; st.onEnd = onEnd; st.A = st.B = null; $('#tinfo', el).textContent = info || ''; drawMarks();
    const go = () => { v.currentTime = r[0]; v.playbackRate = +btn('rate').value; v.play().catch(() => {}); };
    if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
  };
  P.time = () => v.currentTime;
  const keys = e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || !$('#modal').hidden) return;
    const k = { ' ': 'play', ArrowLeft: 'back', ArrowRight: 'fwd', ',': 'fb', '.': 'ff', n: 'next', p: 'prev', i: 'a', o: 'b', f: 'cinema' }[e.key];
    if (k) { e.preventDefault(); act[k](); }
  };
  window.addEventListener('keydown', keys);
  P.destroy = () => { window.removeEventListener('keydown', keys); ro.disconnect(); v.pause(); v.removeAttribute('src'); v.load(); };
  return P;
}

/* ---------------------------------------------------------------- Spiel ansehen, filtern, taggen */
function gameView(app, fid) {
  const f = byId(S.films, fid);
  if (!f) { app.innerHTML = '<div class="card">Dieses Spiel gibt es nicht mehr. <a href="#/">Zu den Spielen</a></div>'; return; }
  let plays = S.plays.filter(p => p.film_id == fid).sort((a, b) => a.t - b.t);
  const F = { q: '', side: '', group: '', type: '', down: '', player: '', text: '' };
  let cur = null, tab = 'tag';
  app.innerHTML = `<div style="${colors(f)}">
    <div class="head">${scoreBox(f)}${f.notes ? `<div class="small" style="margin-top:8px">${esc(f.notes)}</div>` : ''}
      <div class="tools"><a href="#/"><button class="sm">← Alle Spiele</button></a>${canEdit() ? '<button class="sm" id="edit">Bearbeiten</button><button class="sm" id="repl">Video oder Spielzüge ersetzen</button><button class="sm red" id="del">Spiel löschen</button>' : ''}</div></div>
    <div class="grid">
      <div class="coll card"><h2>Spielzüge</h2><div id="filters"></div><div class="small muted" id="cnt" style="margin-top:8px"></div><div class="clips" id="clips"></div></div>
      <div class="colm card" id="pl"></div>
      <div class="colr card"><div class="seg"><button class="sm on" data-tab="tag">Spielzug</button><button class="sm" data-tab="stats">Statistik</button></div><div id="side"></div></div>
    </div></div>`;
  const P = player($('#pl', app));
  leave = () => P.destroy();
  P.load(videoUrl(f));
  const list = () => plays.filter(p => {
    const [, g] = typ(p);
    return (!F.q || p.quarter === F.q) && (!F.side || (F.side === 'us' ? isUs(p, f) : p.side && !isUs(p, f))) && (!F.group || g === F.group) && (!F.type || p.type === F.type)
      && (!F.down || String(p.down) === F.down) && (!F.player || (p.player || '').toLowerCase().includes(F.player.toLowerCase()))
      && (!F.text || [p.note, p.formation, p.play_type, p.result, p.personnel].join(' ').toLowerCase().includes(F.text.toLowerCase()));
  });
  const select = (p, autoplay = true) => {
    cur = p;
    $$('.clip', app).forEach(x => x.classList.toggle('sel', p && x.dataset.id == p.id));
    $(`.clip[data-id="${p?.id}"]`, app)?.scrollIntoView({ block: 'nearest' });
    if (p && autoplay) P.play(range(p), () => { const l = list(), i = l.indexOf(p); if (l[i + 1]) select(l[i + 1]); }, `${p.quarter || ''} ${typ(p)[0]}`);
    if (tab === 'tag') drawSide();
  };
  P.onNext = () => { const l = list(), i = l.indexOf(cur); select(l[Math.min(l.length - 1, i + 1)] || l[0]); };
  P.onPrev = () => { const l = list(), i = l.indexOf(cur); select(l[Math.max(0, i - 1)] || l[0]); };
  const opt = (vals, sel, all) => `<option value="">${all}</option>` + vals.map(([v, l]) => `<option value="${esc(v)}" ${String(sel) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const drawFilters = () => {
    const qs = [...new Set(plays.map(p => p.quarter).filter(Boolean))].sort(), ts = [...new Set(plays.map(p => p.type).filter(Boolean))];
    $('#filters', app).innerHTML = `<div class="filters">
      <select data-f="q">${opt(qs.map(q => [q, q]), F.q, 'Alle Viertel')}</select>
      <select data-f="side">${opt([['us', 'Tigers'], ['them', 'Gegner']], F.side, 'Beide Teams')}</select>
      <select data-f="group">${opt(GROUPS.map(g => [g, g]), F.group, 'Alle Arten')}</select>
      <select data-f="type">${opt(ts.map(t => [t, typ({ type: t })[0]]), F.type, 'Alle Ereignisse')}</select>
      <select data-f="down">${opt([1, 2, 3, 4].map(d => [String(d), d + '. Down']), F.down, 'Alle Downs')}</select>
      <input data-f="player" placeholder="Spieler" value="${esc(F.player)}">
      <input data-f="text" placeholder="Formation, Notiz ..." value="${esc(F.text)}" style="grid-column:1/-1"></div>`;
    $$('[data-f]', app).forEach(el => { el[el.tagName === 'INPUT' ? 'oninput' : 'onchange'] = () => { F[el.dataset.f] = el.value; drawList(); }; });
  };
  const drawList = () => {
    const l = list();
    $('#cnt', app).innerHTML = `${l.length} von ${plays.length} ${l.length ? '<button class="sm" id="all">Alle abspielen</button>' : ''}
      ${canEdit() && l.length ? '<button class="sm" id="tolist">Als Playlist</button>' : ''}${canEdit() ? '<button class="sm" id="add">+ Spielzug hier</button>' : ''}`;
    $('#clips', app).innerHTML = l.map(p => { const [lab] = typ(p);
      return `<button class="clip ${p.side || ''} ${cur && cur.id === p.id ? 'sel' : ''}" data-id="${p.id}"><span class="m">${esc(p.quarter || '')}<br>${fmtT(p.t)}</span>
        <span class="e">${esc(lab)} ${p.side ? `<span class="badge ${p.side === 'h' ? 'home' : 'away'}">${esc(isUs(p, f) ? 'Tigers' : sideName(p.side, f))}</span>` : ''}</span>
        <span class="st">${p.score ? `<span class="badge">${esc(p.score)}</span>` : ''}</span>
        <span class="s">${esc([p.player, tagLine(p), p.note].filter(Boolean).join(' · ')) || '&nbsp;'}</span></button>`; }).join('') || '<div class="muted small">Keine Spielzüge für diese Auswahl.</div>';
    $$('.clip', app).forEach(b => b.onclick = () => select(byId(plays, b.dataset.id)));
    P.setMarks(l.map(p => ({ t: p.t, side: p.side, label: `${typ(p)[0]} ${fmtT(p.t)}` })));
    if ($('#all', app)) $('#all', app).onclick = () => select(l[0]);
    if ($('#tolist', app)) $('#tolist', app).onclick = () => toPlaylist(l.map(p => p.id));
    if ($('#add', app)) $('#add', app).onclick = async () => {
      const p = await api('film_plays', 'POST', { film_id: fid, t: Math.round(P.time() * 10) / 10, type: 'run', side: us(f), quarter: quarterAt(f, P.time()) });
      plays.push(p); plays.sort((a, b) => a.t - b.t); drawFilters(); drawList(); tab = 'tag'; select(p, false); toast('Spielzug angelegt, jetzt taggen');
    };
  };
  const drawSide = () => {
    $$('[data-tab]', app).forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const box = $('#side', app);
    if (tab === 'stats') { box.innerHTML = statsHtml(plays, [f]); return; }
    if (!cur) { box.innerHTML = '<div class="muted small">Spielzug links wählen. Mit <kbd>N</kbd> und <kbd>P</kbd> springst du weiter, mit <kbd>Leertaste</kbd> Pause, <kbd>I</kbd> und <kbd>O</kbd> setzen eine Schleife.</div>'; return; }
    const p = cur, ed = canEdit(), dis = ed ? '' : 'disabled';
    const vals = k => [...new Set([...(LISTS[k] || []), ...S.plays.map(x => x[k]).filter(Boolean)])];
    const inp = (k, label, dl, type = 'text') => `<label>${label}<input data-k="${k}" type="${type}" value="${esc(p[k] ?? '')}" ${dl ? `list="dl_${k}"` : ''} ${dis}></label>`;
    box.innerHTML = `<div class="tag-head"><b>${esc(typ(p)[0])} · ${esc(p.quarter || '')} ${fmtT(p.t)}</b>
        <span class="row"><button class="sm" id="again">Nochmal</button>${ed ? '<button class="sm" id="pl1">+ Playlist</button>' : ''}</span></div>
      <div class="tag-grid">
        <label>Ereignis<select data-k="type" ${dis}>${Object.entries(HD).map(([k, v]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${esc(v[0])}</option>`).join('')}${p.type && !HD[p.type] ? `<option selected>${esc(p.type)}</option>` : ''}</select></label>
        <label>Team<select data-k="side" ${dis}><option value="">offen</option><option value="h" ${p.side === 'h' ? 'selected' : ''}>${esc(sideName('h', f))}</option><option value="a" ${p.side === 'a' ? 'selected' : ''}>${esc(sideName('a', f))}</option></select></label>
        <label>Down<select data-k="down" ${dis}><option value=""></option>${[1, 2, 3, 4].map(d => `<option ${String(p.down) === String(d) ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        ${inp('distance', 'Distance (Yds)', false, 'number')}${inp('yardline', 'Yardline')}${inp('hash', 'Hash', true)}
        ${inp('formation', 'Formation', true)}${inp('personnel', 'Personnel', true)}${inp('play_type', 'Play Type', true)}${inp('direction', 'Richtung', true)}
        ${inp('gain', 'Raumgewinn (Yds)', false, 'number')}${inp('result', 'Ergebnis', true)}${inp('player', 'Spieler', true)}${inp('quarter', 'Viertel')}
        <label class="full">Notiz für das Team<textarea data-k="note" rows="3" ${dis}>${esc(p.note || '')}</textarea></label></div>
      ${['hash', 'formation', 'personnel', 'play_type', 'direction', 'result', 'player'].map(k => `<datalist id="dl_${k}">${vals(k).map(x => `<option value="${esc(x)}">`).join('')}</datalist>`).join('')}
      ${ed ? `<div class="row" style="margin-top:10px"><button class="sm" id="cs">Start hier</button><button class="sm" id="ce">Ende hier</button>
        <span class="small muted">Ausschnitt ${fmtT(range(p)[0])} bis ${fmtT(range(p)[1])}</span></div>
        <div class="foot-btns"><button class="sm red" id="pdel">Löschen</button><button class="pri" id="save">Speichern</button></div>` : ''}`;
    $('#again', box).onclick = () => select(p);
    if ($('#pl1', box)) $('#pl1', box).onclick = () => toPlaylist([p.id]);
    if (!ed) return;
    const save = async extra => {
      const v = Object.fromEntries($$('[data-k]', box).map(el => [el.dataset.k, el.value]));
      ['distance', 'gain'].forEach(k => { if (v[k] === '') v[k] = null; });
      Object.assign(p, await api(`film_plays/${p.id}`, 'PUT', { ...v, ...(extra || {}) }));
      const i = S.plays.findIndex(x => x.id === p.id); if (i >= 0) S.plays[i] = p;
      drawFilters(); drawList(); select(p, false); toast('Gespeichert');
    };
    $('#save', box).onclick = () => save();
    $('#cs', box).onclick = () => save({ clip_start: Math.round(P.time() * 10) / 10 });
    $('#ce', box).onclick = () => save({ clip_end: Math.round(P.time() * 10) / 10 });
    $('#pdel', box).onclick = async () => { if (!confirm('Diesen Spielzug löschen?')) return; await api(`film_plays/${p.id}`, 'DELETE');
      plays = plays.filter(x => x.id !== p.id); cur = null; drawFilters(); drawList(); drawSide(); };
    $$('input[data-k]', box).forEach(el => el.onkeydown = e => { if (e.key === 'Enter') save(); });
  };
  $$('[data-tab]', app).forEach(b => b.onclick = () => { tab = b.dataset.tab; drawSide(); });
  if ($('#edit', app)) $('#edit', app).onclick = () => {
    const box = modal(`<h2>Spiel bearbeiten</h2>${filmForm(f)}<div class="foot-btns"><span></span><div class="row"><button id="c">Abbrechen</button><button class="pri" id="s">Speichern</button></div></div>`);
    $('#c', box).onclick = closeModal;
    $('#s', box).onclick = async () => { await api(`films/${fid}`, 'PUT', readFilm(box)); closeModal(); route(); };
  };
  if ($('#repl', app)) $('#repl', app).onclick = () => uploadDialog(f);
  if ($('#del', app)) $('#del', app).onclick = async () => {
    if (!confirm(`Spiel „${f.title || ''}“ mit Video und allen ${plays.length} Spielzügen löschen?`)) return;
    P.destroy(); await api(`films/${fid}`, 'DELETE'); toast('Gelöscht'); location.hash = '#/';
  };
  drawFilters(); drawList(); drawSide();
}
function quarterAt(f, t) {
  const n = { '1. Viertel': 'Q1', '2. Viertel': 'Q2', '3. Viertel': 'Q3', '4. Viertel': 'Q4' };
  let q = ''; (meta(f).sections || []).filter(s => typeof s.start === 'number').sort((a, b) => a.start - b.start).forEach(s => { if (t >= s.start && n[s.name]) q = n[s.name]; });
  return q;
}

/* ---------------------------------------------------------------- Playlists */
function toPlaylist(ids) {
  const box = modal(`<h2>Zur Playlist hinzufügen</h2><p class="muted small">${ids.length} Spielzug${ids.length === 1 ? '' : 'e'}</p>
    <div class="form"><label class="full">Playlist<select id="sel"><option value="">Neue Playlist</option>${S.lists.map(l => `<option value="${l.id}">${esc(l.title)}</option>`).join('')}</select></label>
      <label class="full" id="nt">Name<input id="title" placeholder="z. B. O-Line Woche 3"></label><label class="full" id="nd">Beschreibung (optional)<input id="desc"></label></div>
    <div class="foot-btns"><span></span><div class="row"><button id="c">Abbrechen</button><button class="pri" id="s">Speichern</button></div></div>`);
  const sel = $('#sel', box), sync = () => { $('#nt', box).hidden = $('#nd', box).hidden = !!sel.value; };
  sel.onchange = sync; sync(); $('#c', box).onclick = closeModal;
  $('#s', box).onclick = async () => {
    if (sel.value) { const l = byId(S.lists, sel.value), have = items(l), known = new Set(have.map(x => x.play));
      await api(`film_playlists/${l.id}`, 'PUT', { items: JSON.stringify([...have, ...ids.filter(i => !known.has(i)).map(play => ({ play, comment: '' }))]) }); }
    else { const title = $('#title', box).value.trim(); if (!title) return alert('Bitte einen Namen eingeben.');
      await api('film_playlists', 'POST', { title, description: $('#desc', box).value.trim(), items: JSON.stringify(ids.map(play => ({ play, comment: '' }))) }); }
    S.lists = await api('film_playlists'); closeModal(); toast('Playlist gespeichert');
  };
}
function listsView(app) {
  app.innerHTML = `<div class="page-head"><div><h1>Playlists</h1><div class="muted small">Zusammengestellte Spielzüge mit Hinweisen der Coaches</div></div></div>
    <div class="lists">${S.lists.map(l => `<a class="card" href="#/playlist/${l.id}"><b>${esc(l.title || 'Playlist')}</b>
      <div class="small muted">${items(l).length} Spielzüge${l.description ? ' · ' + esc(l.description) : ''}</div></a>`).join('')
      || '<div class="card muted">Noch keine Playlists. Coaches legen sie in einem Spiel an (Spielzug wählen, „+ Playlist“, oder gefilterte Spielzüge „Als Playlist“).</div>'}</div>`;
}
function playlistView(app, lid) {
  const l = byId(S.lists, lid);
  if (!l) { app.innerHTML = '<div class="card">Diese Playlist gibt es nicht mehr. <a href="#/playlists">Zu den Playlists</a></div>'; return; }
  let its = items(l).filter(x => byId(S.plays, x.play)), cur = 0;
  const ed = canEdit();
  app.innerHTML = `<div class="page-head"><div><h1>${esc(l.title)}</h1><div class="muted small">${its.length} Spielzüge${l.description ? ' · ' + esc(l.description) : ''}</div></div>
      <div class="row"><a href="#/playlists"><button class="sm">← Playlists</button></a>${ed ? '<button class="sm" id="ren">Umbenennen</button><button class="sm red" id="del">Löschen</button>' : ''}</div></div>
    <div class="grid"><div class="coll card"><h2>Reihenfolge</h2><div class="clips" id="clips"></div></div><div class="colm card" id="pl"></div><div class="colr card" id="note"></div></div>`;
  const P = player($('#pl', app));
  leave = () => P.destroy();
  const play = i => {
    if (!its[i]) return; cur = i;
    const p = byId(S.plays, its[i].play), f = byId(S.films, p.film_id);
    P.load(videoUrl(f)); P.play(range(p), () => play(cur + 1), `${i + 1} von ${its.length}`); draw();
  };
  P.onNext = () => play(Math.min(its.length - 1, cur + 1)); P.onPrev = () => play(Math.max(0, cur - 1));
  const save = async () => { await api(`film_playlists/${lid}`, 'PUT', { items: JSON.stringify(its) }); S.lists = await api('film_playlists'); };
  const draw = () => {
    $('#clips', app).innerHTML = its.map((x, i) => { const p = byId(S.plays, x.play), f = byId(S.films, p.film_id) || {};
      return `<div class="clip ${p.side || ''} ${i === cur ? 'sel' : ''}" data-i="${i}" role="button" tabindex="0"><span class="m">${i + 1}.</span>
        <span class="e">${esc(typ(p)[0])} <span class="small muted">${esc(p.quarter || '')} ${fmtT(p.t)}</span></span>
        <span class="st">${ed ? `<button class="sm" data-up="${i}" ${i ? '' : 'disabled'} title="Nach oben">↑</button><button class="sm" data-rm="${i}" title="Entfernen">✕</button>` : ''}</span>
        <span class="s">${esc(f.title || '')}${x.comment ? ' · 💬 ' + esc(x.comment) : ''}</span></div>`; }).join('') || '<div class="muted small">Die Playlist ist leer.</div>';
    $$('.clip', app).forEach(el => el.onclick = e => { if (!e.target.closest('button')) play(+el.dataset.i); });
    $$('[data-up]', app).forEach(b => b.onclick = async () => { const i = +b.dataset.up; [its[i - 1], its[i]] = [its[i], its[i - 1]]; await save(); draw(); });
    $$('[data-rm]', app).forEach(b => b.onclick = async () => { its.splice(+b.dataset.rm, 1); cur = Math.min(cur, its.length - 1); await save(); draw(); });
    const x = its[cur], p = x && byId(S.plays, x.play);
    $('#note', app).innerHTML = x ? `<h2>Hinweis zu Spielzug ${cur + 1}</h2><div class="small muted" style="margin-bottom:8px">${esc([typ(p)[0], tagLine(p), p.player].filter(Boolean).join(' · '))}</div>
      ${ed ? `<textarea id="c" rows="4" placeholder="z. B. Auf die Füße des Right Tackle achten">${esc(x.comment || '')}</textarea><div class="foot-btns"><span></span><button class="pri" id="cs">Hinweis speichern</button></div>`
        : `<p>${x.comment ? esc(x.comment) : '<span class="muted">Kein Hinweis.</span>'}</p>`}` : '';
    if ($('#cs', app)) $('#cs', app).onclick = async () => { its[cur].comment = $('#c', app).value.trim(); await save(); draw(); toast('Gespeichert'); };
  };
  if ($('#ren', app)) $('#ren', app).onclick = () => {
    const box = modal(`<h2>Playlist bearbeiten</h2><div class="form"><label class="full">Name<input id="t" value="${esc(l.title || '')}"></label>
      <label class="full">Beschreibung<input id="d" value="${esc(l.description || '')}"></label></div><div class="foot-btns"><span></span><div class="row"><button id="c">Abbrechen</button><button class="pri" id="s">Speichern</button></div></div>`);
    $('#c', box).onclick = closeModal;
    $('#s', box).onclick = async () => { await api(`film_playlists/${lid}`, 'PUT', { title: $('#t', box).value.trim(), description: $('#d', box).value.trim() }); closeModal(); route(); };
  };
  if ($('#del', app)) $('#del', app).onclick = async () => { if (!confirm('Playlist löschen? Die Spielzüge bleiben erhalten.')) return; await api(`film_playlists/${lid}`, 'DELETE'); location.hash = '#/playlists'; };
  draw();
  if (its.length) P.load(videoUrl(byId(S.films, byId(S.plays, its[0].play).film_id)));
}

/* ---------------------------------------------------------------- Statistik und Tendenzen */
function statsHtml(plays, films) {
  const film = p => films.find(f => f.id == p.film_id) || {};
  const ours = plays.filter(p => isUs(p, film(p))), theirs = plays.filter(p => p.side && !isUs(p, film(p)));
  const cnt = (l, fn) => l.filter(fn).length, pct = (a, b) => (b ? Math.round(100 * a / b) : 0);
  const avg = l => { const g = l.filter(p => p.gain !== null && p.gain !== undefined && String(p.gain).trim() !== '').map(p => +p.gain).filter(x => !isNaN(x));
    return g.length ? (g.reduce((s, x) => s + x, 0) / g.length).toFixed(1).replace('.', ',') : '-'; };
  const isRun = p => p.type === 'run' || /run/i.test(p.play_type || ''), isPass = p => p.type === 'pass' || /pass|screen|play action/i.test(p.play_type || '');
  const off = l => l.filter(p => isRun(p) || isPass(p)), ou = off(ours), ot = off(theirs);
  const bar = (a, b) => { const t = a + b; return t ? `<div class="st-bar"><span class="run" style="width:${pct(a, t)}%">Run ${pct(a, t)}%</span><span class="pass" style="width:${pct(b, t)}%">Pass ${pct(b, t)}%</span></div>` : '<div class="small muted">keine Daten</div>'; };
  const dist = p => { const d = +p.distance; return p.distance === '' || p.distance == null || isNaN(d) ? '' : d <= 3 ? 'kurz (1 bis 3)' : d <= 6 ? 'mittel (4 bis 6)' : 'lang (7+)'; };
  const rows = Object.keys(HD).map(k => [HD[k][0], cnt(ours, p => p.type === k), cnt(theirs, p => p.type === k)]).filter(r => r[1] || r[2]);
  const pl = {}; plays.forEach(p => (p.player || '').split(' / ').map(x => x.trim()).filter(Boolean).forEach(n => { pl[n] = pl[n] || {}; pl[n][typ(p)[0]] = (pl[n][typ(p)[0]] || 0) + 1; }));
  const tagged = ou.some(p => p.down);
  const tend = (l, label) => l.length ? `<tr><td>${label}</td><td class="n">${l.length}</td><td class="n">${pct(cnt(l, isRun), l.length)}%</td><td class="n">${pct(cnt(l, isPass), l.length)}%</td><td class="n">${avg(l)}</td></tr>` : '';
  return `<div class="st">
    <div class="st-cards"><div><b>${ou.length}</b><span>Run und Pass Tigers</span></div><div><b>${pct(cnt(ou, isRun), ou.length)}%</b><span>Run-Anteil</span></div>
      <div><b>${avg(ou.filter(isRun))}</b><span>Ø Yards Run</span></div><div><b>${avg(ou.filter(isPass))}</b><span>Ø Yards Pass</span></div></div>
    <h3>Run oder Pass</h3><div class="small">Tigers</div>${bar(cnt(ou, isRun), cnt(ou, isPass))}<div class="small">Gegner</div>${bar(cnt(ot, isRun), cnt(ot, isPass))}
    <h3>Tigers je Viertel</h3>${['Q1', 'Q2', 'Q3', 'Q4'].map(q => { const l = ou.filter(p => p.quarter === q); return `<div class="small">${q} · ${l.length} Spielzüge</div>${bar(cnt(l, isRun), cnt(l, isPass))}`; }).join('')}
    <h3>Tendenzen nach Down und Distance</h3>${tagged ? `<table class="st-table"><thead><tr><th>Situation</th><th>Plays</th><th>Run</th><th>Pass</th><th>Ø Yds</th></tr></thead><tbody>
      ${[1, 2, 3, 4].map(d => tend(ou.filter(p => String(p.down) === String(d)), d + '. Down')).join('')}
      ${['kurz (1 bis 3)', 'mittel (4 bis 6)', 'lang (7+)'].map(b => tend(ou.filter(p => dist(p) === b), 'Distance ' + b)).join('')}
      ${[3].map(d => tend(ou.filter(p => String(p.down) === '3' && dist(p) === 'lang (7+)'), '3rd and long')).join('')}</tbody></table>`
      : '<div class="small muted">Erscheint, sobald Down und Distance nachgetaggt sind.</div>'}
    <h3>Ereignisse</h3><table class="st-table"><thead><tr><th>Ereignis</th><th>Tigers</th><th>Gegner</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(r[0])}</td><td class="n">${r[1]}</td><td class="n">${r[2]}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">keine Daten</td></tr>'}</tbody></table>
    <h3>Spieler</h3><table class="st-table"><thead><tr><th>Spieler</th><th>Ereignisse</th></tr></thead><tbody>
      ${Object.entries(pl).sort((a, b) => Object.values(b[1]).reduce((s, x) => s + x, 0) - Object.values(a[1]).reduce((s, x) => s + x, 0))
        .map(([n, t]) => `<tr><td>${esc(n)}</td><td class="small">${Object.entries(t).map(([k, v]) => `${esc(k)} ${v}`).join(', ')}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Noch keine Spieler zugeordnet.</td></tr>'}</tbody></table></div>`;
}
function statsView(app) {
  const years = [...new Set(S.films.map(f => (f.date || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  let year = years[0] || '';
  const draw = () => {
    const fs = S.films.filter(f => !year || (f.date || '').startsWith(year)), ids = new Set(fs.map(f => f.id));
    app.innerHTML = `<div class="page-head"><div><h1>Statistik</h1><div class="muted small">${fs.length} Spiele${year ? ' im Jahr ' + year : ''}</div></div>
      <div class="row">${years.map(y => `<button class="sm ${y === year ? 'on' : ''}" data-y="${y}">${y}</button>`).join('')}<button class="sm ${!year ? 'on' : ''}" data-y="">Alle</button></div></div>
      <div class="card">${statsHtml(S.plays.filter(p => ids.has(p.film_id)), fs)}</div>`;
    $$('[data-y]', app).forEach(b => b.onclick = () => { year = b.dataset.y; draw(); });
  };
  draw();
}

start();
