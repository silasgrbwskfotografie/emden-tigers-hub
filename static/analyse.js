/* Emden Tigers Hub: Videoanalyse (Bereich Analyse)
   Spielfilm aus Highlight Desk (.hdspiel + Video) ansehen, filtern, nachtaggen, Statistik und Playlists.
   Lesen: alle mit Leserecht Analyse (Spieler, Coaches). Hochladen, Taggen, Playlists: Schreibrecht Analyse (Coaches). */

// Ereignisse aus Highlight Desk (tagger.html, Football): Beschriftung, Gruppe, Sekunden vor und nach dem Moment
const HD_TYPES = {
  run: ['Run', 'Offense', 3, 12], pass: ['Pass', 'Offense', 3, 12], defense: ['Defense', 'Defense', 3, 12], special: ['Special Teams', 'Special Teams', 3, 14],
  td: ['Touchdown', 'Punkte', 20, 25], fg: ['Field Goal', 'Punkte', 15, 20], pat: ['Extrapunkt', 'Punkte', 10, 12], twopt: ['2-Punkte', 'Punkte', 12, 15],
  safety: ['Safety', 'Punkte', 15, 20], bigplay: ['Big Play', 'Big Play', 12, 15],
  int: ['Interception', 'Turnover', 12, 15], fumble: ['Fumble', 'Turnover', 10, 12], turnover: ['Turnover on Downs', 'Turnover', 10, 12],
  sack: ['Sack', 'Defense', 8, 10], flag: ['Strafe', 'Strafe', 8, 10], dq: ['Disqualifikation', 'Strafe', 15, 15], review: ['Challenge', 'Sonstiges', 10, 15],
  kickoff: ['Kickoff', 'Special Teams', 5, 12], punt: ['Punt', 'Special Teams', 5, 12], ret: ['Return', 'Special Teams', 8, 12],
  timeout: ['Auszeit', 'Sonstiges', 5, 5], verletzung: ['Verletzung', 'Sonstiges', 5, 10], notiz: ['Notiz', 'Sonstiges', 5, 10],
};
const FILM_GROUPS = ['Offense', 'Defense', 'Special Teams', 'Punkte', 'Big Play', 'Turnover', 'Strafe', 'Sonstiges'];
const TAG_LISTS = {
  play_type: ['Run', 'Pass', 'Screen', 'RPO', 'Play Action', 'QB Run', 'Trick Play', 'Punt', 'Field Goal', 'Kickoff', 'Extrapunkt'],
  direction: ['Links', 'Mitte', 'Rechts'],
  hash: ['Links', 'Mitte', 'Rechts'],
  result: ['Raumgewinn', 'Kein Raumgewinn', 'Raumverlust', 'First Down', 'Pass komplett', 'Pass unvollständig', 'Touchdown', 'Interception', 'Fumble', 'Sack', 'Strafe', 'Punt', 'Field Goal gut', 'Field Goal verschossen'],
};
const FILM_CHUNK = 32 * 1024 * 1024;   // Upload in Stücken (der Server nimmt höchstens 64 MB pro Stück)

const hdType = p => HD_TYPES[p.type] || [p.type ? p.type.charAt(0).toUpperCase() + p.type.slice(1) : 'Szene', 'Sonstiges', 5, 10];
const isUs = (p, f) => p.side && p.side === (f.us_side || 'h');
const teamName = (p, f) => !p.side ? '' : isUs(p, f) ? 'Tigers' : ((f.us_side || 'h') === 'h' ? f.away_name : f.home_name) || 'Gegner';
const clipRange = p => { const [, , pre, post] = hdType(p); const a = p.clip_start != null && p.clip_start !== '' ? Number(p.clip_start) : Math.max(0, p.t - pre);
  const b = p.clip_end != null && p.clip_end !== '' ? Number(p.clip_end) : p.t + post; return [a, Math.max(a + 1, b)]; };
const fmtT = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const playLine = p => [p.down && p.distance ? `${p.down}. & ${p.distance}` : p.down ? `${p.down}. Down` : '', p.play_type, p.gain !== '' && p.gain != null ? `${Number(p.gain) > 0 ? '+' : ''}${p.gain} Yds` : '', p.result].filter(Boolean).join(' · ');
const parseItems = s => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v.filter(x => x && x.play) : []; } catch { return []; } };
const canTag = () => can('analyse', 2);

async function filmData(force = false) {
  const [films, plays, lists] = await Promise.all([load('films', force), load('film_plays', force), load('film_playlists', force)]);
  return { films: [...films].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id), plays, lists };
}

/* ---------------------------------------------------------------- Seite */
App.pages.analyse = async (view, args) => {
  const [sub, id] = args;
  if (sub === 'film' && id) return filmView(view, Number(id));
  if (sub === 'playlist' && id) return playlistView(view, Number(id));
  if (sub === 'statistik') return seasonStats(view);
  return filmOverview(view);
};

function analyseTabs(active) {
  const t = [['', 'Spiele'], ['statistik', 'Statistik Saison']];
  return `<div class="toolbar">${t.map(([k, l]) => `<a class="btn sm keep ${k === active ? 'dark' : ''}" href="#/analyse${k ? '/' + k : ''}">${l}</a>`).join('')}</div>`;
}

async function filmOverview(view) {
  await loadAll('games', 'opponents');
  const { films, plays, lists } = await filmData(true);
  const count = fid => plays.filter(p => p.film_id == fid).length;
  view.innerHTML = `
    <div class="page-head"><h1>Analyse<small>Spielfilm aus Highlight Desk, für Spieler und Coaches</small></h1>
      <div class="btn-row">${canTag() ? '<button class="btn primary keep" id="fa_new">+ Spiel hochladen</button>' : ''}</div></div>
    ${analyseTabs('')}
    <div class="film-grid">${films.map(f => `<a class="card film-card" href="#/analyse/film/${f.id}">
        <div class="fc-top"><b>${esc(f.title || 'Ohne Titel')}</b>${f.result ? `<span class="badge dark">${esc(f.result)}</span>` : ''}</div>
        <div class="muted small">${fmtDate(f.date) || 'ohne Datum'} · ${count(f.id)} Spielzüge</div>
        <div>${f.upload_state === 'fertig' ? '<span class="badge ok">Video bereit</span>' : f.upload_state === 'läuft' ? '<span class="badge warn">Upload nicht fertig</span>' : '<span class="badge">ohne Video</span>'}</div>
      </a>`).join('') || '<div class="card empty">Noch keine Spiele. Ein Coach lädt das Viewer-Paket aus Highlight Desk hoch (Video und .hdspiel).</div>'}</div>
    <h2 style="margin-top:24px">Playlists</h2>
    <div class="film-grid">${lists.map(l => `<a class="card film-card" href="#/analyse/playlist/${l.id}"><b>${esc(l.title || 'Playlist')}</b>
        <div class="muted small">${parseItems(l.items).length} Spielzüge${l.description ? ' · ' + esc(l.description.slice(0, 80)) : ''}</div></a>`).join('')
      || '<div class="muted">Noch keine Playlists. Coaches legen sie in einem Spiel aus Spielzügen an.</div>'}</div>`;
  if ($('#fa_new')) $('#fa_new').onclick = () => filmUpload();
}

/* ---------------------------------------------------------------- Hochladen und Bearbeiten */
const FILM_FIELDS = () => [
  { key: 'title', label: 'Titel', full: true, placeholder: 'z. B. Emden Tigers gegen Delmenhorst Bulldogs' },
  { key: 'game_id', label: 'Spiel aus dem Spielplan', type: 'ref', ref: { table: 'games', label: gameLabel } },
  { key: 'date', label: 'Datum', type: 'date' },
  { key: 'us_side', label: 'Die Tigers sind im Video', type: 'select', options: ['h', 'a'], hint: 'h = Heim, a = Gast (wie in Highlight Desk eingestellt).' },
  { key: 'result', label: 'Ergebnis', placeholder: 'z. B. 21:14' },
  { key: 'notes', label: 'Notizen für das Team', type: 'textarea', rows: 3 },
];

async function filmUpload(film) {
  await loadAll('games', 'opponents');
  const isNew = !film;
  openModal(`<h2>${isNew ? 'Spiel hochladen' : 'Video und Spielzüge ersetzen'}</h2>
    <p class="muted small">In Highlight Desk unter Einstellungen > System > „Spiel für den Viewer“ das Paket erstellen und entpacken. Darin liegen das Video (MP4) und die Datei .hdspiel mit allen Markierungen.</p>
    <form class="form" onsubmit="return false">
      <div class="field full"><label>Datei .hdspiel (Spielzüge)</label><input type="file" id="fu_hd" accept=".hdspiel,.json,application/json"></div>
      <div class="field full"><label>Spielvideo (MP4)</label><input type="file" id="fu_vid" accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov"></div>
      ${isNew ? FILM_FIELDS().map(f => fieldHtml(f, { us_side: 'h' }[f.key])).join('') : ''}
    </form>
    <div id="fu_prog" class="fu-prog" hidden><div class="fu-bar"><span></span></div><div class="small" id="fu_txt"></div></div>
    <div class="modal-foot"><span class="hint">Während des Uploads diese Seite offen lassen.</span><div class="btn-row"><button class="btn" id="fu_cancel">Abbrechen</button><button class="btn primary" id="fu_go">Hochladen</button></div></div>`);
  const box = $('#modalBox');
  let cancelled = false;
  $('#fu_cancel').onclick = () => { cancelled = true; closeModal(); window.onbeforeunload = null; };
  if (isNew) {
    const g = $('#f_game_id', box);
    g.onchange = () => { const x = byId(App.cache.games, g.value); if (!x) return; const o = byId(App.cache.opponents, x.opponent_id) || {};
      $('#f_us_side', box).value = Number(x.home) ? 'h' : 'a'; if (!$('#f_date', box).value) $('#f_date', box).value = x.date || '';
      if (!$('#f_title', box).value) $('#f_title', box).value = Number(x.home) ? `Emden Tigers gegen ${o.name || 'Gegner'}` : `${o.name || 'Gegner'} gegen Emden Tigers`; };
    $('#fu_hd', box).onchange = async () => { try { const d = JSON.parse(await $('#fu_hd', box).files[0].text());
      if (!$('#f_title', box).value && d.titel) $('#f_title', box).value = d.titel; if (!$('#f_date', box).value && d.datum) $('#f_date', box).value = d.datum;
      if (!$('#f_result', box).value && d.ergebnis) $('#f_result', box).value = d.ergebnis; } catch { toast('Die .hdspiel-Datei ist nicht lesbar.'); } };
  }
  $('#fu_go').onclick = async () => {
    const hdFile = $('#fu_hd', box).files[0], vid = $('#fu_vid', box).files[0];
    if (isNew && !hdFile && !vid) return alert('Bitte mindestens die .hdspiel-Datei oder das Video wählen.');
    let hd = null;
    if (hdFile) { try { hd = JSON.parse(await hdFile.text()); } catch { return alert('Die .hdspiel-Datei ist nicht lesbar.'); } }
    $('#fu_go').disabled = true; $('#fu_prog').hidden = false;
    const status = (t, pct) => { $('#fu_txt').textContent = t; if (pct != null) $('.fu-bar span', box).style.width = pct + '%'; };
    window.onbeforeunload = () => 'Der Upload läuft noch.';
    try {
      let f = film;
      if (isNew) { const vals = readForm(box, FILM_FIELDS()); f = await api('films', 'POST', vals); }
      if (hd) { status('Spielzüge werden eingelesen ...', 2); const r = await api(`film/${f.id}/import`, 'POST', { hdspiel: hd });
        status(`${r.added} neue und ${r.updated} aktualisierte Spielzüge eingelesen.`, 5); }
      if (vid) await uploadVideo(f.id, vid, status, () => cancelled);
      window.onbeforeunload = null;
      invalidate('films', 'film_plays'); closeModal(); toast('Spiel gespeichert'); go(`#/analyse/film/${f.id}`);
    } catch (e) { window.onbeforeunload = null; $('#fu_go').disabled = false; status('Fehler: ' + e.message); }
  };
}

async function uploadVideo(fid, file, status, isCancelled) {
  const ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.mp4'])[0].toLowerCase();
  let offset = 0, tries = 0;
  const t0 = Date.now();
  while (offset < file.size) {
    if (isCancelled()) throw new Error('Abgebrochen');
    const part = file.slice(offset, Math.min(file.size, offset + FILM_CHUNK));
    try {
      const r = await fetch(`/api/film/${fid}/chunk?offset=${offset}&total=${file.size}&ext=${encodeURIComponent(ext)}`,
        { method: 'POST', headers: { 'X-TMH': '1', 'Content-Type': 'application/octet-stream' }, body: part });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409 && d.next != null) { offset = d.next; continue; }   // Server sagt, wo es weitergeht
      if (!r.ok) throw Object.assign(new Error(d.error || 'Fehler ' + r.status), { fatal: r.status < 500 || r.status === 507 });
      offset = d.next; tries = 0;
      const mbs = offset / 1048576 / Math.max(1, (Date.now() - t0) / 1000);
      status(`Video: ${Math.round(offset / 1048576)} von ${Math.round(file.size / 1048576)} MB (${mbs.toFixed(1)} MB/s)`, 5 + 95 * offset / file.size);
    } catch (e) {
      if (e.fatal || ++tries > 5) throw e;
      status(`Verbindung unterbrochen, neuer Versuch ${tries} von 5 ...`);
      await new Promise(r => setTimeout(r, 2000 * tries));
    }
  }
}

/* ---------------------------------------------------------------- Player */
function filmPlayer(el) {
  el.innerHTML = `<div class="fp-video"><video id="fp_v" preload="metadata" playsinline></video><div class="fp-empty" id="fp_empty" hidden>Für dieses Spiel ist noch kein Video hochgeladen.</div></div>
    <div class="fp-ctrl">
      <button class="btn sm keep" data-c="prev" title="Vorheriger Spielzug (P)">⏮</button>
      <button class="btn sm keep" data-c="back" title="5 Sekunden zurück (←)">-5</button>
      <button class="btn sm keep" data-c="fb" title="Ein Bild zurück (,)">‹</button>
      <button class="btn sm keep primary" data-c="play" title="Abspielen / Pause (Leertaste)">▶</button>
      <button class="btn sm keep" data-c="ff" title="Ein Bild vor (.)">›</button>
      <button class="btn sm keep" data-c="fwd" title="5 Sekunden vor (→)">+5</button>
      <button class="btn sm keep" data-c="next" title="Nächster Spielzug (N)">⏭</button>
      <select class="input keep" data-c="rate" title="Tempo">${[0.25, 0.5, 1, 1.5, 2].map(r => `<option value="${r}" ${r === 1 ? 'selected' : ''}>${r}x</option>`).join('')}</select>
      <label class="small"><input type="checkbox" data-c="loop"> Schleife</label>
      <label class="small"><input type="checkbox" data-c="auto" checked> Weiter zum nächsten</label>
      <span class="small muted" id="fp_time">0:00</span>
      <button class="btn sm keep" data-c="full" title="Vollbild">⛶</button>
    </div>`;
  const v = $('#fp_v', el);
  const st = { range: null, onEnd: null, src: '' };
  const btn = c => $(`[data-c="${c}"]`, el);
  const P = {
    video: v, onPrev: null, onNext: null,
    load(src) { if (st.src === src) return; st.src = src; $('#fp_empty', el).hidden = !!src; v.hidden = !src; if (src) { v.src = src; v.load(); } else v.removeAttribute('src'); },
    play(range, onEnd) {   // Spielzug von a bis b abspielen
      st.range = range; st.onEnd = onEnd;
      const go = () => { v.currentTime = range[0]; v.playbackRate = Number(btn('rate').value); v.play().catch(() => {}); };
      if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
    },
    get t() { return v.currentTime; },
  };
  v.addEventListener('timeupdate', () => {
    $('#fp_time', el).textContent = fmtT(v.currentTime) + (v.duration ? ' / ' + fmtT(v.duration) : '');
    if (st.range && v.currentTime >= st.range[1]) {
      if (btn('loop').checked) { v.currentTime = st.range[0]; return; }
      const cb = st.onEnd; st.range = null;
      if (btn('auto').checked && cb) cb(); else v.pause();
    }
  });
  v.addEventListener('play', () => { btn('play').textContent = '⏸'; });
  v.addEventListener('pause', () => { btn('play').textContent = '▶'; });
  const frame = 1 / 30;
  const act = {
    play: () => (v.paused ? v.play() : v.pause()), back: () => { v.currentTime -= 5; }, fwd: () => { v.currentTime += 5; },
    fb: () => { v.pause(); v.currentTime -= frame; }, ff: () => { v.pause(); v.currentTime += frame; },
    prev: () => P.onPrev && P.onPrev(), next: () => P.onNext && P.onNext(),
    full: () => ($('.fp-video', el).requestFullscreen || (() => {})).call($('.fp-video', el)),
  };
  $$('button[data-c]', el).forEach(b => b.onclick = () => act[b.dataset.c]());
  btn('rate').onchange = () => { v.playbackRate = Number(btn('rate').value); };
  P.keys = e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    const k = { ' ': 'play', ArrowLeft: 'back', ArrowRight: 'fwd', ',': 'fb', '.': 'ff', n: 'next', p: 'prev' }[e.key];
    if (k) { e.preventDefault(); act[k](); }
  };
  return P;
}
// Tastatur nur auf der Analyse-Seite
let filmKeys = null;
window.addEventListener('keydown', e => { if (filmKeys && location.hash.startsWith('#/analyse/')) filmKeys(e); });

/* ---------------------------------------------------------------- Spiel ansehen, filtern, taggen */
async function filmView(view, fid) {
  await loadAll('games', 'opponents');
  const { films, plays: all, lists } = await filmData(true);
  const film = byId(films, fid);
  if (!film) { view.innerHTML = '<div class="card empty">Dieses Spiel gibt es nicht mehr. <a href="#/analyse">Zur Übersicht</a></div>'; return; }
  let plays = all.filter(p => p.film_id == fid).sort((a, b) => a.t - b.t);
  const F = { q: '', side: '', group: '', type: '', down: '', player: '', text: '' };
  let cur = null, tab = 'plays';
  view.innerHTML = `
    <div class="page-head"><h1>${esc(film.title || 'Spiel')}<small>${fmtDate(film.date) || ''}${film.result ? ' · ' + esc(film.result) : ''}</small></h1>
      <div class="btn-row"><a class="btn keep" href="#/analyse">Alle Spiele</a>${canTag() ? '<button class="btn keep" id="fv_edit">Bearbeiten</button><button class="btn keep" id="fv_up">Video oder Spielzüge ersetzen</button>' : ''}</div></div>
    ${film.notes ? `<div class="card small" style="margin-bottom:12px">${esc(film.notes)}</div>` : ''}
    <div class="film-layout">
      <div class="film-main"><div id="fv_player"></div><div id="fv_tag"></div></div>
      <div class="film-side card">
        <div class="toolbar"><button class="btn sm keep" data-tab="plays">Spielzüge</button><button class="btn sm keep" data-tab="stats">Statistik</button></div>
        <div id="fv_side"></div>
      </div>
    </div>`;
  const P = filmPlayer($('#fv_player', view));
  filmKeys = P.keys;
  P.load(film.upload_state === 'fertig' ? `/api/film/${fid}/video` : '');
  const filtered = () => plays.filter(p => {
    const [, grp] = hdType(p);
    return (!F.q || p.quarter === F.q) && (!F.side || (F.side === 'us' ? isUs(p, film) : p.side && !isUs(p, film)))
      && (!F.group || grp === F.group) && (!F.type || p.type === F.type) && (!F.down || String(p.down) === F.down)
      && (!F.player || (p.player || '').toLowerCase().includes(F.player.toLowerCase()))
      && (!F.text || [p.note, p.formation, p.play_type, p.result, p.personnel].join(' ').toLowerCase().includes(F.text.toLowerCase()));
  });
  const select = (p, autoplay = true) => {
    cur = p;
    $$('.fp-item', view).forEach(x => x.classList.toggle('on', x.dataset.id == p?.id));
    $(`.fp-item[data-id="${p?.id}"]`, view)?.scrollIntoView({ block: 'nearest' });
    if (p && autoplay) P.play(clipRange(p), () => { const l = filtered(), i = l.indexOf(p); if (l[i + 1]) select(l[i + 1]); });
    drawTag();
  };
  P.onNext = () => { const l = filtered(), i = l.indexOf(cur); select(l[Math.min(l.length - 1, i + 1)] || l[0]); };
  P.onPrev = () => { const l = filtered(), i = l.indexOf(cur); select(l[Math.max(0, i - 1)] || l[0]); };
  const opts = (vals, sel, all = 'Alle') => `<option value="">${all}</option>` + vals.map(([v, l]) => `<option value="${esc(v)}" ${String(sel) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('');

  const drawPlays = () => {
    const quarters = [...new Set(plays.map(p => p.quarter).filter(Boolean))];
    const types = [...new Set(plays.map(p => p.type).filter(Boolean))];
    const l = filtered();
    $('#fv_side', view).innerHTML = `
      <div class="fp-filters">
        <select class="input keep" data-f="q">${opts(quarters.map(q => [q, q]), F.q, 'Alle Viertel')}</select>
        <select class="input keep" data-f="side">${opts([['us', 'Tigers'], ['them', 'Gegner']], F.side, 'Beide Teams')}</select>
        <select class="input keep" data-f="group">${opts(FILM_GROUPS.map(g => [g, g]), F.group, 'Alle Arten')}</select>
        <select class="input keep" data-f="type">${opts(types.map(t => [t, hdType({ type: t })[0]]), F.type, 'Alle Ereignisse')}</select>
        <select class="input keep" data-f="down">${opts([1, 2, 3, 4].map(d => [String(d), d + '. Down']), F.down, 'Alle Downs')}</select>
        <input class="input keep" data-f="player" placeholder="Spieler" value="${esc(F.player)}">
        <input class="input keep" data-f="text" placeholder="Suche (Formation, Notiz ...)" value="${esc(F.text)}">
      </div>
      <div class="small muted" style="margin:6px 0">${l.length} von ${plays.length} Spielzügen
        ${l.length ? '<button class="btn sm keep" id="fv_playall">Alle abspielen</button>' : ''}
        ${canTag() && l.length ? '<button class="btn sm keep" id="fv_tolist">Als Playlist speichern</button>' : ''}
        ${canTag() ? '<button class="btn sm keep" id="fv_add">+ Spielzug hier</button>' : ''}</div>
      <div class="fp-list">${l.map(p => { const [lab, grp] = hdType(p); return `<div class="fp-item ${cur && cur.id === p.id ? 'on' : ''} g-${esc(grp.replace(/\s/g, ''))}" data-id="${p.id}">
          <span class="fp-t">${esc(p.quarter || '')} ${fmtT(p.t)}</span>
          <span class="fp-l"><b>${esc(lab)}</b> ${p.side ? `<span class="badge ${isUs(p, film) ? 'red' : ''}">${esc(teamName(p, film))}</span>` : ''}
            ${p.player ? `<span class="small">${esc(p.player)}</span>` : ''}<br><span class="small muted">${esc(playLine(p))}${p.note ? ' · ' + esc(p.note.slice(0, 60)) : ''}</span></span>
          ${p.score ? `<span class="badge dark">${esc(p.score)}</span>` : ''}</div>`; }).join('') || '<div class="muted small">Keine Spielzüge für diese Auswahl.</div>'}</div>`;
    $$('[data-f]', view).forEach(el => { el[el.tagName === 'INPUT' ? 'oninput' : 'onchange'] = () => { F[el.dataset.f] = el.value; if (el.tagName === 'INPUT') { const pos = el.selectionStart; drawPlays(); const n = $(`[data-f="${el.dataset.f}"]`, view); n.focus(); n.setSelectionRange(pos, pos); } else drawPlays(); }; });
    $$('.fp-item', view).forEach(x => x.onclick = () => select(byId(plays, x.dataset.id)));
    if ($('#fv_playall', view)) $('#fv_playall', view).onclick = () => select(filtered()[0]);
    if ($('#fv_tolist', view)) $('#fv_tolist', view).onclick = () => savePlaylist(filtered().map(p => ({ play: p.id, comment: '' })), lists);
    if ($('#fv_add', view)) $('#fv_add', view).onclick = async () => {
      const p = await api('film_plays', 'POST', { film_id: fid, t: Math.round(P.t * 10) / 10, type: 'run', side: film.us_side || 'h', quarter: quarterAt(film, P.t) });
      invalidate('film_plays'); plays.push(p); plays.sort((a, b) => a.t - b.t); drawPlays(); select(p, false); toast('Spielzug angelegt, jetzt taggen');
    };
  };

  const drawTag = () => {
    const box = $('#fv_tag', view);
    if (!cur) { box.innerHTML = ''; return; }
    const p = cur, [lab] = hdType(p), ed = canTag();
    const inp = (k, label, list, type = 'text') => `<label>${label}<input class="input" data-k="${k}" type="${type}" value="${esc(p[k] ?? '')}" ${list ? `list="dl_${k}"` : ''} ${ed ? '' : 'disabled'}></label>`;
    const vals = k => [...new Set([...(TAG_LISTS[k] || []), ...all.map(x => x[k]).filter(Boolean)])];
    box.innerHTML = `<div class="card fp-tag">
      <div class="fp-tag-head"><b>${esc(lab)}</b> ${p.side ? esc(teamName(p, film)) : ''} · ${esc(p.quarter || '')} ${fmtT(p.t)}${p.player ? ' · ' + esc(p.player) : ''}
        <span class="btn-row">${canTag() ? `<button class="btn sm keep" id="ft_list">+ Playlist</button>` : ''}<button class="btn sm keep" id="ft_replay">Nochmal</button></span></div>
      <div class="fp-tag-grid">
        <label>Ereignis<select class="input" data-k="type" ${ed ? '' : 'disabled'}>${Object.entries(HD_TYPES).map(([k, v]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${esc(v[0])}</option>`).join('')}${p.type && !HD_TYPES[p.type] ? `<option selected>${esc(p.type)}</option>` : ''}</select></label>
        <label>Team<select class="input" data-k="side" ${ed ? '' : 'disabled'}><option value="">offen</option><option value="${film.us_side || 'h'}" ${isUs(p, film) ? 'selected' : ''}>Tigers</option><option value="${(film.us_side || 'h') === 'h' ? 'a' : 'h'}" ${p.side && !isUs(p, film) ? 'selected' : ''}>Gegner</option></select></label>
        <label>Down<select class="input" data-k="down" ${ed ? '' : 'disabled'}><option value=""></option>${[1, 2, 3, 4].map(d => `<option ${String(p.down) === String(d) ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        ${inp('distance', 'Distance (Yds)', false, 'number')}${inp('yardline', 'Yardline', false)}${inp('hash', 'Hash', true)}
        ${inp('formation', 'Formation', true)}${inp('personnel', 'Personnel', true)}${inp('play_type', 'Play Type', true)}
        ${inp('direction', 'Richtung', true)}${inp('gain', 'Raumgewinn (Yds)', false, 'number')}${inp('result', 'Ergebnis', true)}
        ${inp('player', 'Spieler', true)}${inp('quarter', 'Viertel', false)}
        <label class="full">Notiz für das Team<textarea class="input" data-k="note" rows="2" ${ed ? '' : 'disabled'}>${esc(p.note || '')}</textarea></label>
      </div>
      ${['hash', 'formation', 'personnel', 'play_type', 'direction', 'result', 'player'].map(k => `<datalist id="dl_${k}">${vals(k).map(x => `<option value="${esc(x)}">`).join('')}</datalist>`).join('')}
      ${ed ? `<div class="btn-row" style="margin-top:8px"><button class="btn sm keep" id="ft_start">Start hier</button><button class="btn sm keep" id="ft_end">Ende hier</button>
        <span class="small muted">Ausschnitt ${fmtT(clipRange(p)[0])} bis ${fmtT(clipRange(p)[1])}</span><span style="flex:1"></span>
        <button class="btn sm keep danger" id="ft_del">Löschen</button><button class="btn sm primary keep" id="ft_save">Speichern</button></div>` : ''}</div>`;
    $('#ft_replay', box).onclick = () => select(p);
    if ($('#ft_list', box)) $('#ft_list', box).onclick = () => savePlaylist([{ play: p.id, comment: '' }], lists);
    if (!ed) return;
    const vals2 = () => Object.fromEntries($$('[data-k]', box).map(el => [el.dataset.k, el.value]));
    const save = async extra => {
      const v = { ...vals2(), ...(extra || {}) };
      ['distance', 'gain'].forEach(k => { if (v[k] === '') v[k] = null; });
      const r = await api(`film_plays/${p.id}`, 'PUT', v);
      Object.assign(p, r); invalidate('film_plays'); drawPlays(); select(p, false); toast('Gespeichert');
    };
    $('#ft_save', box).onclick = () => save();
    $('#ft_start', box).onclick = () => save({ clip_start: Math.round(P.t * 10) / 10 });
    $('#ft_end', box).onclick = () => save({ clip_end: Math.round(P.t * 10) / 10 });
    $('#ft_del', box).onclick = async () => { if (!confirmBox('Diesen Spielzug löschen?')) return; await api(`film_plays/${p.id}`, 'DELETE');
      invalidate('film_plays'); plays = plays.filter(x => x.id !== p.id); cur = null; drawPlays(); drawTag(); };
    $$('input[data-k], textarea[data-k]', box).forEach(el => el.onkeydown = e => { if (e.key === 'Enter' && el.tagName === 'INPUT') save(); });
  };

  const drawSide = () => {
    $$('[data-tab]', view).forEach(b => b.classList.toggle('dark', b.dataset.tab === tab));
    if (tab === 'plays') drawPlays(); else $('#fv_side', view).innerHTML = statsHtml(plays, [film]);
  };
  $$('[data-tab]', view).forEach(b => b.onclick = () => { tab = b.dataset.tab; drawSide(); });
  if ($('#fv_edit', view)) $('#fv_edit', view).onclick = async () => { const r = await editRecord('films', FILM_FIELDS(), film, { editTitle: 'Spiel bearbeiten' }); if (r) route(); };
  if ($('#fv_up', view)) $('#fv_up', view).onclick = () => filmUpload(film);
  drawSide();
}

function quarterAt(film, t) {
  let m = {}; try { m = JSON.parse(film.meta || '{}'); } catch { /* leer */ }
  const names = { '1. Viertel': 'Q1', '2. Viertel': 'Q2', '3. Viertel': 'Q3', '4. Viertel': 'Q4' };
  let q = '';
  (m.sections || []).filter(s => typeof s.start === 'number').sort((a, b) => a.start - b.start).forEach(s => { if (t >= s.start && names[s.name]) q = names[s.name]; });
  return q;
}

/* ---------------------------------------------------------------- Playlists */
async function savePlaylist(items, lists) {
  if (!items.length) return;
  const own = lists || App.cache.film_playlists || [];
  openModal(`<h2>Zur Playlist hinzufügen</h2><p class="muted small">${items.length} Spielzug${items.length === 1 ? '' : 'e'}</p>
    <form class="form" onsubmit="return false">
      <div class="field full"><label>Playlist</label><select class="input" id="pl_sel"><option value="">Neue Playlist</option>${own.map(l => `<option value="${l.id}">${esc(l.title)}</option>`).join('')}</select></div>
      <div class="field full" id="pl_newf"><label>Name der neuen Playlist</label><input class="input" id="pl_title" placeholder="z. B. O-Line Woche 3"></div>
      <div class="field full" id="pl_descf"><label>Beschreibung (optional)</label><input class="input" id="pl_desc"></div>
    </form>
    <div class="modal-foot"><span></span><div class="btn-row"><button class="btn" id="pl_cancel">Abbrechen</button><button class="btn primary" id="pl_ok">Speichern</button></div></div>`);
  const sel = $('#pl_sel'), sync = () => { $('#pl_newf').hidden = $('#pl_descf').hidden = !!sel.value; };
  sel.onchange = sync; sync();
  $('#pl_cancel').onclick = closeModal;
  $('#pl_ok').onclick = async () => {
    if (sel.value) {
      const l = byId(own, sel.value), have = parseItems(l.items), ids = new Set(have.map(x => x.play));
      await api(`film_playlists/${l.id}`, 'PUT', { items: JSON.stringify([...have, ...items.filter(x => !ids.has(x.play))]) });
    } else {
      const title = $('#pl_title').value.trim(); if (!title) return alert('Bitte einen Namen eingeben.');
      await api('film_playlists', 'POST', { title, description: $('#pl_desc').value.trim(), items: JSON.stringify(items) });
    }
    invalidate('film_playlists'); closeModal(); toast('Playlist gespeichert');
  };
}

async function playlistView(view, lid) {
  const { films, plays, lists } = await filmData(true);
  const list = byId(lists, lid);
  if (!list) { view.innerHTML = '<div class="card empty">Diese Playlist gibt es nicht mehr. <a href="#/analyse">Zur Übersicht</a></div>'; return; }
  let items = parseItems(list.items).filter(x => byId(plays, x.play));
  let cur = 0;
  const ed = canTag();
  view.innerHTML = `
    <div class="page-head"><h1>${esc(list.title)}<small>${items.length} Spielzüge${list.description ? ' · ' + esc(list.description) : ''}</small></h1>
      <div class="btn-row"><a class="btn keep" href="#/analyse">Alle Spiele</a>${ed ? '<button class="btn keep" id="pv_ren">Umbenennen</button><button class="btn danger keep" id="pv_del">Playlist löschen</button>' : ''}</div></div>
    <div class="film-layout"><div class="film-main"><div id="pv_player"></div><div id="pv_note"></div></div><div class="film-side card"><div id="pv_list"></div></div></div>`;
  const P = filmPlayer($('#pv_player', view));
  filmKeys = P.keys;
  const play = i => {
    if (!items[i]) return;
    cur = i;
    const p = byId(plays, items[i].play), f = byId(films, p.film_id);
    P.load(f && f.upload_state === 'fertig' ? `/api/film/${f.id}/video` : '');
    P.play(clipRange(p), () => play(cur + 1));
    draw();
  };
  P.onNext = () => play(Math.min(items.length - 1, cur + 1));
  P.onPrev = () => play(Math.max(0, cur - 1));
  const persist = async () => { await api(`film_playlists/${lid}`, 'PUT', { items: JSON.stringify(items) }); invalidate('film_playlists'); };
  const draw = () => {
    $('#pv_list', view).innerHTML = `<div class="small muted" style="margin-bottom:6px">${items.length ? '<button class="btn sm keep" id="pv_all">Von vorn abspielen</button>' : ''}</div>
      <div class="fp-list">${items.map((x, i) => { const p = byId(plays, x.play), f = byId(films, p.film_id) || {}, [lab] = hdType(p);
        return `<div class="fp-item ${i === cur ? 'on' : ''}" data-i="${i}"><span class="fp-t">${i + 1}.</span>
          <span class="fp-l"><b>${esc(lab)}</b> <span class="small">${esc(f.title || '')} · ${esc(p.quarter || '')} ${fmtT(p.t)}</span><br>
          <span class="small muted">${esc(playLine(p))}</span>${x.comment ? `<br><span class="small">💬 ${esc(x.comment)}</span>` : ''}</span>
          ${ed ? `<span class="btn-row"><button class="btn sm ghost keep" data-up="${i}" ${i ? '' : 'disabled'}>↑</button><button class="btn sm ghost keep" data-rm="${i}">✕</button></span>` : ''}</div>`; }).join('')
        || '<div class="muted small">Die Playlist ist leer.</div>'}</div>`;
    const x = items[cur];
    $('#pv_note', view).innerHTML = x ? `<div class="card fp-tag"><b>Kommentar zu Spielzug ${cur + 1}</b>
      ${ed ? `<textarea class="input" id="pv_c" rows="2" placeholder="z. B. Auf die Füße des Right Tackle achten">${esc(x.comment || '')}</textarea>
        <div class="btn-row" style="margin-top:6px"><button class="btn sm primary keep" id="pv_cs">Kommentar speichern</button></div>`
        : `<p>${x.comment ? esc(x.comment) : '<span class="muted">Kein Kommentar.</span>'}</p>`}</div>` : '';
    $$('.fp-item', view).forEach(el => el.onclick = e => { if (!e.target.closest('button')) play(Number(el.dataset.i)); });
    $$('[data-up]', view).forEach(b => b.onclick = async () => { const i = +b.dataset.up; [items[i - 1], items[i]] = [items[i], items[i - 1]]; await persist(); draw(); });
    $$('[data-rm]', view).forEach(b => b.onclick = async () => { items.splice(+b.dataset.rm, 1); cur = Math.min(cur, items.length - 1); await persist(); draw(); });
    if ($('#pv_all', view)) $('#pv_all', view).onclick = () => play(0);
    if ($('#pv_cs', view)) $('#pv_cs', view).onclick = async () => { items[cur].comment = $('#pv_c', view).value.trim(); await persist(); draw(); toast('Kommentar gespeichert'); };
  };
  if ($('#pv_ren', view)) $('#pv_ren', view).onclick = async () => { const r = await editRecord('film_playlists', [{ key: 'title', label: 'Name', full: true }, { key: 'description', label: 'Beschreibung', type: 'textarea', rows: 2 }], list, { editTitle: 'Playlist bearbeiten' }); if (r) route(); };
  if ($('#pv_del', view)) $('#pv_del', view).onclick = async () => { if (!confirmBox('Playlist löschen? Die Spielzüge selbst bleiben erhalten.')) return; await api(`film_playlists/${lid}`, 'DELETE'); invalidate('film_playlists'); go('#/analyse'); };
  draw();
  if (items.length) { const p = byId(plays, items[0].play), f = byId(films, p.film_id); P.load(f && f.upload_state === 'fertig' ? `/api/film/${f.id}/video` : ''); }
}

/* ---------------------------------------------------------------- Statistik und Tendenzen */
function statsHtml(plays, films) {
  const filmOf = p => films.find(f => f.id == p.film_id) || {};
  const us = plays.filter(p => isUs(p, filmOf(p))), them = plays.filter(p => p.side && !isUs(p, filmOf(p)));
  const cnt = (l, f) => l.filter(f).length;
  const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
  // Durchschnitt nur über Spielzüge mit eingetragenem Raumgewinn (leer zählt nicht als 0)
  const avg = l => { const g = l.filter(p => p.gain !== null && p.gain !== undefined && String(p.gain).trim() !== '').map(p => Number(p.gain)).filter(x => !isNaN(x));
    return g.length ? (g.reduce((s, x) => s + x, 0) / g.length).toFixed(1) : '-'; };
  const isRun = p => p.type === 'run' || /run/i.test(p.play_type || ''), isPass = p => p.type === 'pass' || /pass|screen|play action/i.test(p.play_type || '');
  const off = l => l.filter(p => isRun(p) || isPass(p));
  const bar = (a, b, la, lb) => { const t = a + b; return t ? `<div class="st-bar"><span class="run" style="width:${pct(a, t)}%">${la} ${pct(a, t)}%</span><span class="pass" style="width:${pct(b, t)}%">${lb} ${pct(b, t)}%</span></div>` : '<div class="small muted">keine Daten</div>'; };
  const ou = off(us), ot = off(them);
  const rows = Object.keys(HD_TYPES).map(k => [HD_TYPES[k][0], cnt(us, p => p.type === k), cnt(them, p => p.type === k)]).filter(r => r[1] || r[2]);
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const downs = [1, 2, 3, 4];
  const dist = p => { const d = Number(p.distance); return isNaN(d) || p.distance === '' || p.distance == null ? '' : d <= 3 ? 'kurz (1 bis 3)' : d <= 6 ? 'mittel (4 bis 6)' : 'lang (7+)'; };
  const players = {};
  plays.forEach(p => { if (!p.player) return; p.player.split(' / ').forEach(n => { n = n.trim(); if (!n) return; (players[n] = players[n] || {})[hdType(p)[0]] = ((players[n] || {})[hdType(p)[0]] || 0) + 1; }); });
  const tagged = ou.filter(p => p.down).length;
  return `<div class="st">
    <div class="st-cards">
      <div><b>${ou.length}</b><span>Run/Pass Tigers</span></div>
      <div><b>${pct(cnt(ou, isRun), ou.length)}%</b><span>Run-Anteil</span></div>
      <div><b>${avg(ou.filter(isRun))}</b><span>Ø Yds Run</span></div>
      <div><b>${avg(ou.filter(isPass))}</b><span>Ø Yds Pass</span></div>
    </div>
    <h4>Run oder Pass</h4>
    <div class="small">Tigers</div>${bar(cnt(ou, isRun), cnt(ou, isPass), 'Run', 'Pass')}
    <div class="small">Gegner</div>${bar(cnt(ot, isRun), cnt(ot, isPass), 'Run', 'Pass')}
    <h4>Tigers je Viertel</h4>${quarters.map(q => { const l = ou.filter(p => p.quarter === q); return `<div class="small">${q} · ${l.length} Spielzüge</div>${bar(cnt(l, isRun), cnt(l, isPass), 'Run', 'Pass')}`; }).join('')}
    <h4>Tendenzen nach Down ${tagged ? '' : '<span class="small muted">(erst nach dem Nachtaggen von Down und Distance)</span>'}</h4>
    ${tagged ? `<table class="st-table"><thead><tr><th>Down</th><th>Spielzüge</th><th>Run</th><th>Pass</th><th>Ø Yds</th></tr></thead><tbody>
      ${downs.map(d => { const l = ou.filter(p => String(p.down) === String(d)); return l.length ? `<tr><td>${d}.</td><td>${l.length}</td><td>${pct(cnt(l, isRun), l.length)}%</td><td>${pct(cnt(l, isPass), l.length)}%</td><td>${avg(l)}</td></tr>` : ''; }).join('')}
      ${['kurz (1 bis 3)', 'mittel (4 bis 6)', 'lang (7+)'].map(b => { const l = ou.filter(p => dist(p) === b); return l.length ? `<tr><td>Distance ${b}</td><td>${l.length}</td><td>${pct(cnt(l, isRun), l.length)}%</td><td>${pct(cnt(l, isPass), l.length)}%</td><td>${avg(l)}</td></tr>` : ''; }).join('')}
    </tbody></table>` : ''}
    <h4>Ereignisse</h4>
    <table class="st-table"><thead><tr><th>Ereignis</th><th>Tigers</th><th>Gegner</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">keine Daten</td></tr>'}</tbody></table>
    <h4>Spieler</h4>
    <table class="st-table"><thead><tr><th>Spieler</th><th>Ereignisse</th></tr></thead><tbody>${Object.entries(players).sort((a, b) => Object.values(b[1]).reduce((s, x) => s + x, 0) - Object.values(a[1]).reduce((s, x) => s + x, 0))
      .map(([n, t]) => `<tr><td>${esc(n)}</td><td class="small">${Object.entries(t).map(([k, v]) => `${esc(k)} ${v}`).join(', ')}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Noch keine Spieler zugeordnet.</td></tr>'}</tbody></table>
  </div>`;
}

async function seasonStats(view) {
  const { films, plays } = await filmData(true);
  const years = [...new Set(films.map(f => (f.date || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  let year = years[0] || '';
  const draw = () => {
    const fs = films.filter(f => !year || (f.date || '').startsWith(year));
    const ids = new Set(fs.map(f => f.id));
    view.innerHTML = `<div class="page-head"><h1>Statistik<small>${fs.length} Spiele${year ? ' im Jahr ' + year : ''}</small></h1></div>
      ${analyseTabs('statistik')}
      <div class="toolbar">${years.map(y => `<button class="btn sm keep ${y === year ? 'dark' : ''}" data-y="${y}">${y}</button>`).join('')}<button class="btn sm keep ${!year ? 'dark' : ''}" data-y="">Alle</button></div>
      <div class="card">${statsHtml(plays.filter(p => ids.has(p.film_id)), fs)}</div>`;
    $$('[data-y]', view).forEach(b => b.onclick = () => { year = b.dataset.y; draw(); });
  };
  draw();
}
