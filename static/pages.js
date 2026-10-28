/* Emden Tigers Hub: Seiten */

/* ---------- Feld-Definitionen ---------- */
const POSITIONS = ['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'DL', 'DE', 'LB', 'CB', 'S', 'K', 'P', 'LS', 'KR/PR', 'Athlete'];
const POST_TYPES = ['Gameday', 'Ergebnis', 'Spielervorstellung', 'Sponsor', 'Spielplan', 'Training & Behind the Scenes', 'Verein & Community', 'Saisonabschluss', 'Sonstiges'];
const POST_STATUS = ['Idee', 'In Arbeit', 'Geplant', 'Gepostet'];
const SPONSOR_PACKAGES = ['Hauptsponsor', 'Trikotsponsor', 'Spieltagssponsor', 'Supporter Karte', 'Medienturm', 'Partner', 'Förderer'];

const oppLabel = o => o.name || '';
const sponsorLabel = s => s.name || '';
const playerLabel = p => [p.number ? '#' + p.number : '', fullName(p), p.kind !== 'Spieler' ? '(' + (p.role || p.kind) + ')' : ''].filter(Boolean).join(' ');
const gameLabel = g => `${fmtDate(g.date)} ${Number(g.home) ? 'vs' : '@'} ${byId(App.cache.opponents, g.opponent_id)?.name || 'TBA'}`;

const F = {
  players: [
    { key: 'kind', label: 'Art', type: 'select', options: ['Spieler', 'Coach', 'Staff'] },
    { key: 'active', label: 'Aktiv im Team', type: 'check', default: 1 },
    { key: 'first_name', label: 'Vorname' },
    { key: 'last_name', label: 'Nachname' },
    { key: 'number', label: 'Rückennummer', show: v => v.kind === 'Spieler' },
    { key: 'position', label: 'Position', list: POSITIONS, show: v => v.kind === 'Spieler' },
    { key: 'unit', label: 'Unit', type: 'select', options: ['', 'Offense', 'Defense', 'Special Teams', 'Two-Way'], show: v => v.kind === 'Spieler' },
    { key: 'rookie', label: 'Rookie', type: 'check', show: v => v.kind === 'Spieler' },
    { key: 'role', label: 'Rolle', list: ['Headcoach', 'Offensive Coordinator', 'Defensive Coordinator', 'Special Teams Coordinator', 'Position Coach', 'Teammanager', 'Physio', 'Equipment'], show: v => v.kind !== 'Spieler' },
    { key: 'since', label: 'Dabei seit', placeholder: 'z. B. 2023' },
    { key: 'instagram', label: 'Instagram', placeholder: '@handle' },
    { key: 'consent', label: 'Einwilligung Foto & Social Media liegt vor', type: 'check', hint: 'Ohne Einwilligung warnt der Hub bei Posts.' },
    { key: 'photo', label: 'Foto', type: 'image', full: true },
    { key: 'facts', label: 'Infos für Posts (Football-Geschichte, Funfacts)', type: 'textarea' },
    { key: 'notes', label: 'Interne Notizen', type: 'textarea', rows: 2 },
  ],
  opponents: [
    { key: 'name', label: 'Name', full: true },
    { key: 'short', label: 'Kurzname', placeholder: 'z. B. Wolves' },
    { key: 'city', label: 'Stadt' },
    { key: 'instagram', label: 'Instagram', placeholder: '@handle' },
    { key: 'logo', label: 'Logo', type: 'image' },
    { key: 'notes', label: 'Notizen', type: 'textarea', rows: 2 },
  ],
  games: () => [
    { key: 'season', label: 'Saison', default: App.settings.season },
    { key: 'kind', label: 'Art', type: 'select', options: ['Liga', 'Freundschaftsspiel', 'Turnier', 'Playoff', 'Sonstiges'] },
    { key: 'date', label: 'Datum', type: 'date' },
    { key: 'time', label: 'Kickoff', type: 'time' },
    { key: 'opponent_id', label: 'Gegner', type: 'ref', ref: { table: 'opponents', label: oppLabel }, hint: 'Neue Gegner unter „Gegner“ anlegen.' },
    { key: 'home', label: 'Heimspiel', type: 'check', default: 1 },
    { key: 'location', label: 'Spielort', hint: 'Leer lassen bei Heimspielen für den Standard-Ort.' },
    { key: 'league', label: 'Liga' },
    { key: 'sponsor_id', label: 'Spieltagssponsor', type: 'ref', ref: { table: 'sponsors', label: sponsorLabel } },
    { key: 'score_us', label: 'Punkte Tigers', type: 'number' },
    { key: 'score_them', label: 'Punkte Gegner', type: 'number' },
    { key: 'quarters', label: 'Viertel', placeholder: '7:0, 14:7, 0:7, 7:0' },
    { key: 'highlights', label: 'Highlights / Spielbericht-Notizen', type: 'textarea' },
    { key: 'notes', label: 'Interne Notizen', type: 'textarea', rows: 2 },
  ],
  sponsors: [
    { key: 'name', label: 'Name' },
    { key: 'package', label: 'Paket', list: SPONSOR_PACKAGES },
    { key: 'instagram', label: 'Instagram', placeholder: '@handle' },
    { key: 'website', label: 'Website' },
    { key: 'contact', label: 'Ansprechpartner' },
    { key: 'amount', label: 'Betrag / Leistung', placeholder: 'z. B. 500 € oder Gerüst', show: () => can('finanzen') },
    { key: 'start', label: 'Beginn', type: 'date' },
    { key: 'end', label: 'Ende', type: 'date' },
    { key: 'posts_agreed', label: 'Vereinbarte Posts', type: 'number', hint: 'Der Hub zählt gepostete Beiträge mit diesem Sponsor mit.' },
    { key: 'active', label: 'Aktiv', type: 'check', default: 1 },
    { key: 'logo', label: 'Logo', type: 'image', full: true },
    { key: 'notes', label: 'Vereinbarungen / Notizen', type: 'textarea' },
  ],
  media_team: () => [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Hauptaufgabe', list: (App.settings.media_tasks || '').split('\n').filter(Boolean) },
    { key: 'phone', label: 'Telefon' },
    { key: 'instagram', label: 'Instagram', placeholder: '@handle' },
    { key: 'active', label: 'Aktiv', type: 'check', default: 1 },
    { key: 'notes', label: 'Notizen', type: 'textarea', rows: 2 },
  ],
  supporter_cards: () => [
    { key: 'season', label: 'Saison', default: App.settings.season },
    { key: 'number', label: 'Kartennummer' },
    { key: 'holder', label: 'Inhaber', full: true },
    { key: 'sold_on', label: 'Verkauft am', type: 'date', default: todayStr() },
    { key: 'price', label: 'Preis (€)', type: 'number', default: App.settings.card_price },
    { key: 'paid', label: 'Bezahlt', type: 'check' },
    { key: 'notes', label: 'Notizen', type: 'textarea', rows: 2 },
  ],
  posts: [
    { key: 'date', label: 'Datum', type: 'date', default: todayStr() },
    { key: 'time', label: 'Uhrzeit', type: 'time' },
    { key: 'type', label: 'Art', type: 'select', options: POST_TYPES },
    { key: 'status', label: 'Status', type: 'select', options: POST_STATUS },
    { key: 'format', label: 'Format', type: 'select', options: ['Feed', 'Karussell', 'Story', 'Reel'] },
    { key: 'title', label: 'Titel (intern)' },
    { key: 'caption', label: 'Caption', type: 'textarea', rows: 10 },
    { key: 'image', label: 'Fertige Grafik aus Canva (optional)', type: 'image', full: true, hint: 'Export aus Canva hier ablegen, dann liegt alles an einem Ort.' },
    { key: 'game_id', label: 'Spiel', type: 'ref', ref: { table: 'games', label: gameLabel } },
    { key: 'sponsor_id', label: 'Sponsor', type: 'ref', ref: { table: 'sponsors', label: sponsorLabel } },
    { key: 'player_id', label: 'Spieler / Coach', type: 'ref', ref: { table: 'players', label: playerLabel } },
    { key: 'posted_url', label: 'Link zum Post' },
    { key: 'notes', label: 'Notizen', type: 'textarea', rows: 2 },
  ],
};

function statusBadge(st) {
  const cls = { 'Gepostet': 'ok', 'Geplant': 'red', 'In Arbeit': 'warn' }[st] || '';
  return `<span class="badge ${cls}">${esc(st || 'Idee')}</span>`;
}

function dateBox(d) {
  const x = parseDate(d);
  if (!x) return '<div class="date-box"><b>?</b><span>offen</span></div>';
  return `<div class="date-box"><b>${x.getDate()}</b><span>${MON_S[x.getMonth()]} ${WD_S[x.getDay()]}</span></div>`;
}

function mediaTasks() { return (App.settings.media_tasks || '').split('\n').map(t => t.trim()).filter(Boolean); }

/* ====================================================================== */
App.pages.dashboard = async (view) => {
  const [dash] = await Promise.all([api('dashboard'), loadAll('opponents', 'sponsors', 'posts', 'assignments', 'media_team', 'players', 'games')]);
  const s = App.settings;
  const me = App.me;
  const next = dash.next_games[0];
  const opp = next ? byId(App.cache.opponents, next.opponent_id) : null;
  const tasks = mediaTasks();
  const medien = can('medien'), mw = can('medien', 2), vw = can('verein', 2);

  const checks = !medien ? '' : dash.next_games.slice(0, 3).map(g => {
    const o = byId(App.cache.opponents, g.opponent_id);
    const posts = App.cache.posts.filter(p => p.game_id == g.id);
    const has = t => posts.find(p => p.type === t);
    const asg = App.cache.assignments.filter(a => a.game_id == g.id && a.member_id);
    const items = [
      { label: 'Gameday-Ankündigung', ok: has('Gameday'), act: `<button class="btn sm pp" onclick="planPost({type:'Gameday',game_id:${g.id}})">Planen</button>` },
      { label: 'Media Team eingeteilt', ok: tasks.length && asg.length >= tasks.length, part: asg.length > 0, act: `<button class="btn sm pp" onclick="assignGame(${g.id})">Einteilen</button>`, extra: `${asg.length}/${tasks.length}` },
      { label: 'Spieltagssponsor', ok: !!g.sponsor_id, act: `<button class="btn sm vw" onclick="editGame(${g.id})">Eintragen</button>` },
      { label: 'Endstand-Post', ok: has('Ergebnis'), act: `<button class="btn sm pp" onclick="planPost({type:'Ergebnis',game_id:${g.id}})">Planen</button>`, later: true },
    ];
    return `<div class="card"><h3>${fmtDate(g.date, true)} ${Number(g.home) ? 'vs' : '@'} ${esc(o?.name || 'TBA')}</h3>
      ${items.map(i => `<div class="check-row"><span class="dot ${i.ok ? 'ok' : i.part ? 'warn' : i.later ? '' : 'red'}"></span><span style="flex:1">${i.label}${i.extra ? ` <span class="muted small">${i.extra}</span>` : ''}</span>${i.ok ? '<span class="badge ok">erledigt</span>' : i.act}</div>`).join('')}
    </div>`;
  }).join('');

  // Hinweise je nach Rechten
  const notes = [];
  const lg = dash.last_game;
  if (vw && lg && (lg.score_us === null || lg.score_us === '')) notes.push(`Ergebnis vom ${fmtDate(lg.date)} fehlt noch. <button class="vw btn sm" onclick="editGame(${lg.id})">Eintragen</button>`);
  if (mw && lg && !App.cache.posts.find(p => p.game_id == lg.id && p.type === 'Ergebnis')) notes.push(`Kein Endstand-Post für das Spiel am ${fmtDate(lg.date)}. <button class="pp btn sm" onclick="planPost({type:'Ergebnis',game_id:${lg.id}})">Planen</button>`);
  if (vw && dash.counts.no_consent) notes.push(`${dash.counts.no_consent} aktive Personen ohne hinterlegte Foto-Einwilligung. <a class="btn sm" href="#/players">Ansehen</a>`);
  if (medien) dash.overdue_posts.forEach(p => notes.push(`Post „${esc(p.title || p.type)}“ war für ${fmtDate(p.date)} geplant und ist noch nicht als gepostet markiert. <a class="btn sm" href="#/posts">Postplan</a>`));
  if (mw) App.cache.sponsors.filter(sp => Number(sp.active) && Number(sp.posts_agreed)).forEach(sp => {
    const done = App.cache.posts.filter(p => p.sponsor_id == sp.id && p.status === 'Gepostet').length;
    if (done < Number(sp.posts_agreed)) notes.push(`${esc(sp.name)}: ${done} von ${sp.posts_agreed} vereinbarten Posts erledigt. <button class="pp btn sm" onclick="planPost({type:'Sponsor',sponsor_id:${sp.id}})">Planen</button>`);
  });
  if (dash.finance?.open) notes.push(`${dash.finance.open} offene Buchung(en) in den Finanzen. <a class="btn sm" href="#/finance">Ansehen</a>`);
  if (me.member_id === null && !me.is_admin) notes.push('Dein Zugang ist noch keinem Mitgliedsprofil zugeordnet. Das macht der Admin unter Konten.');

  const team = [
    ['Aktive Spieler', dash.counts.players], ['Coaches &amp; Staff', dash.counts.staff],
    ['Aktive Sponsoren', dash.counts.sponsors],
    dash.counts.members !== undefined ? ['Mitglieder (aktiv)', dash.counts.members] : null,
    dash.counts.posts_done !== undefined ? ['Gepostete Beiträge', dash.counts.posts_done] : null,
  ].filter(Boolean);

  view.innerHTML = `
    <div class="page-head"><h1>Hallo ${esc((me.display_name || me.username).split(' ')[0])}<small>${fmtDate(dash.today, true)}${me.groups?.length ? ' | ' + esc(me.groups.join(', ')) : ''}</small></h1>
      <div class="btn-row">${mw ? '<button class="pp btn primary" onclick="planPost()">+ Post planen</button>' : ''}${vw ? '<button class="vw btn" onclick="editGame()">+ Spiel</button>' : ''}</div></div>
    <div class="grid g3" style="margin-bottom:16px">
      <div class="card next-game" style="grid-column:span 2">
        ${next ? `<div class="small" style="letter-spacing:2px;text-transform:uppercase;color:#bbb">Nächstes Spiel</div>
          <div class="vs">${esc(s.club_short || 'Tigers')} ${Number(next.home) ? 'vs' : '@'} ${esc(opp?.name || 'TBA')}</div>
          <div class="meta">${fmtDate(next.date, true)}${next.time ? ' | Kickoff ' + next.time + ' Uhr' : ''} | ${esc(next.location || (Number(next.home) ? s.home_location : ''))}</div>
          <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:18px;gap:12px;flex-wrap:wrap">
            <div><div class="countdown">${daysUntil(next.date) === 0 ? 'HEUTE' : daysUntil(next.date)}</div><div class="small" style="color:#bbb">${daysUntil(next.date) === 0 ? 'Gameday!' : daysUntil(next.date) === 1 ? 'Tag bis Kickoff' : 'Tage bis Kickoff'}</div></div>
            ${medien ? `<div class="btn-row"><button class="btn" onclick="copyGameInfo(${next.id})">Infos für Canva kopieren</button>${mw ? `<button class="pp btn" onclick="planPost({type:'Gameday',game_id:${next.id}})">Gameday-Post planen</button>` : ''}</div>` : ''}</div>`
          : `<div class="vs">Kein Spiel geplant</div><div class="meta">Die Termine der Saison stehen im Spielplan.</div>${vw ? '<div style="margin-top:16px"><button class="vw btn" onclick="editGame()">Spiel anlegen</button></div>' : ''}`}
      </div>
      <div class="card"><h2>Team</h2>${team.map(([l, v]) => `<div class="sum-row"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
    </div>
    ${dash.finance ? `<div class="grid g4" style="margin-bottom:16px">
        <div class="card stat"><span>Einnahmen ${dash.finance.year}</span><b>${eur(dash.finance.income)}</b></div>
        <div class="card stat"><span>Ausgaben ${dash.finance.year}</span><b>${eur(dash.finance.expense)}</b></div>
        <div class="card stat"><span>Saldo ${dash.finance.year}</span><b style="color:${dash.finance.income - dash.finance.expense < 0 ? 'var(--red)' : 'var(--ok)'}">${eur(dash.finance.income - dash.finance.expense)}</b></div>
        <div class="card stat"><span>Offene Buchungen</span><b>${dash.finance.open}</b></div></div>` : ''}
    ${checks ? `<h2 style="margin-top:8px">Content-Check für die nächsten Spiele</h2><div class="grid g3" style="margin-bottom:16px">${checks}</div>` : ''}
    <div class="grid g2">
      ${medien ? `<div class="card"><h2>Anstehende Posts</h2>
        ${dash.upcoming_posts.length ? `<div class="list">${dash.upcoming_posts.map(p => `<div class="list-item">${dateBox(p.date)}<div class="grow"><b>${esc(p.title || p.type)}</b><div class="muted small">${esc(p.type || '')}${p.time ? ' | ' + p.time + ' Uhr' : ''}</div></div>${statusBadge(p.status)}</div>`).join('')}</div>` : '<div class="muted">Noch nichts geplant.</div>'}
      </div>` : `<div class="card"><h2>Nächste Spiele</h2>
        ${dash.next_games.length ? `<div class="list">${dash.next_games.map(g => `<div class="list-item">${dateBox(g.date)}<div class="grow"><b>${Number(g.home) ? 'vs' : '@'} ${esc(byId(App.cache.opponents, g.opponent_id)?.name || 'TBA')}</b><div class="muted small">${g.time ? 'Kickoff ' + g.time + ' Uhr | ' : ''}${esc(g.location || (Number(g.home) ? s.home_location : ''))}</div></div></div>`).join('')}</div>` : '<div class="muted">Keine Spiele eingetragen.</div>'}
      </div>`}
      <div class="card"><h2>Hinweise</h2>
        ${notes.length ? `<div class="list">${notes.map(n => `<div class="list-item"><span class="dot warn"></span><div class="grow">${n}</div></div>`).join('')}</div>` : '<div class="muted">Alles im grünen Bereich. 🐯</div>'}
      </div>
    </div>`;
};

/* ====================================================================== */
/* Postplan */
App.pages.posts = async (view) => {
  await loadAll('posts', 'games', 'opponents', 'sponsors', 'players');
  let filter = App._postFilter || 'offen';
  const draw = () => {
    App._postFilter = filter;
    let list = [...App.cache.posts].sort((a, b) => ((a.date || '9') + (a.time || '')).localeCompare((b.date || '9') + (b.time || '')));
    if (filter === 'offen') list = list.filter(p => p.status !== 'Gepostet');
    else if (filter !== 'alle') list = list.filter(p => p.status === filter);
    const groups = {};
    list.forEach(p => { const d = parseDate(p.date); const k = d ? `${MON[d.getMonth()]} ${d.getFullYear()}` : 'Ohne Datum'; (groups[k] = groups[k] || []).push(p); });
    view.innerHTML = `
      <div class="page-head"><h1>Postplan<small>${App.cache.posts.length} Beiträge insgesamt</small></h1>
        <div class="btn-row"><button class="btn primary" id="p_new">+ Post planen</button></div></div>
      <div class="toolbar">${['offen', ...POST_STATUS, 'alle'].map(f => `<button class="btn sm ${f === filter ? 'dark' : ''}" data-f="${f}">${f === 'offen' ? 'Offen' : f === 'alle' ? 'Alle' : f}</button>`).join('')}</div>
      ${list.length ? Object.entries(groups).map(([m, ps]) => `<div class="month"><h3>${m}</h3>${ps.map(p => `
        <div class="post-row">
          ${p.image ? `<img src="${esc(p.image)}">` : '<img>'}
          ${dateBox(p.date)}
          <div style="min-width:0"><div class="t">${esc(p.title || p.type || 'Post')}</div><div class="c">${esc((p.caption || '').split('\n')[0])}</div>
            <div class="small muted">${esc(p.type || '')} | ${esc(p.format || 'Feed')}${p.time ? ' | ' + p.time + ' Uhr' : ''}</div></div>
          <select class="input" data-st="${p.id}" style="width:auto">${POST_STATUS.map(s => `<option ${s === (p.status || 'Idee') ? 'selected' : ''}>${s}</option>`).join('')}</select>
          <div class="btn-row">
            <button class="btn sm" data-copy="${p.id}" title="Caption kopieren">Caption</button>
            ${p.image ? `<a class="btn sm" href="${esc(p.image)}" download>Bild</a>` : ''}
            <button class="btn sm ghost" data-edit="${p.id}">Bearbeiten</button>
          </div>
        </div>`).join('')}</div>`).join('') : '<div class="card empty">Keine Beiträge in dieser Ansicht.</div>'}`;
    $$('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; draw(); });
    $$('[data-st]').forEach(sel => sel.onchange = async () => { await api('posts/' + sel.dataset.st, 'PUT', { status: sel.value }); invalidate('posts'); await load('posts'); toast('Status: ' + sel.value); draw(); });
    $$('[data-copy]').forEach(b => b.onclick = () => copyText(byId(App.cache.posts, b.dataset.copy).caption || ''));
    $$('[data-edit]').forEach(b => b.onclick = () => planPost(byId(App.cache.posts, b.dataset.edit)));
    $('#p_new').onclick = () => planPost();
  };
  draw();
};

/* ====================================================================== */
/* Mediathek */
App.pages.media = async (view) => {
  const media = await load('media', true);
  view.innerHTML = `
    <div class="page-head"><h1>Mediathek<small>${media.length} Dateien</small></h1></div>
    <div class="dropzone" id="m_drop">Fotos hierher ziehen oder <button class="btn sm" id="m_up">Dateien wählen</button>
      <input type="file" id="m_file" accept="image/*" multiple hidden>
      <div style="margin-top:10px"><input class="input" id="m_tags" placeholder="Tags für den Upload, z. B. Gameday Wolves 2027" style="max-width:420px"></div></div>
    <div class="toolbar"><input class="input" id="m_q" placeholder="Suchen" style="max-width:300px"></div>
    <div class="media-grid" id="m_grid"></div>`;
  const grid = () => {
    const q = $('#m_q').value.toLowerCase();
    const items = [...media].reverse().filter(m => !q || (m.name + ' ' + (m.tags || '')).toLowerCase().includes(q));
    $('#m_grid').innerHTML = items.map(m => `<figure data-id="${m.id}"><img loading="lazy" src="${esc(m.path)}"><figcaption>${esc(m.tags || m.name)}</figcaption><button class="btn sm del" data-del="${m.id}">✕</button></figure>`).join('') || '<div class="empty">Noch keine Bilder</div>';
    $$('[data-del]').forEach(b => b.onclick = async e => { e.stopPropagation(); if (!confirmBox('Aus der Mediathek entfernen?')) return; await api('media/' + b.dataset.del, 'DELETE'); invalidate('media'); App.pages.media(view); });
    $$('figure[data-id]').forEach(f => f.onclick = async () => {
      const m = byId(media, f.dataset.id);
      const r = await editRecord('media', [{ key: 'tags', label: 'Tags', full: true }, { key: 'name', label: 'Dateiname', full: true }], m, { editTitle: 'Bild' , onOpen: box => box.insertAdjacentHTML('afterbegin', `<img src="${esc(m.path)}" style="max-width:100%;max-height:340px;border-radius:8px;margin-bottom:12px;display:block">`) });
      if (r) App.pages.media(view);
    });
  };
  const up = async files => {
    const tags = $('#m_tags').value;
    toast(`Lade ${files.length} Datei(en) hoch ...`);
    for (const f of files) await uploadFile(f, tags);
    invalidate('media'); App.pages.media(view);
  };
  $('#m_q').oninput = grid;
  $('#m_up').onclick = () => $('#m_file').click();
  $('#m_file').onchange = e => up([...e.target.files]);
  const dz = $('#m_drop');
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
  dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); up([...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))); };
  grid();
};

/* ====================================================================== */
/* Spielplan */
async function editGame(id) {
  await loadAll('games', 'opponents', 'sponsors');
  const rec = id ? byId(App.cache.games, id) : {};
  const r = await editRecord('games', F.games(), rec, { newTitle: 'Neues Spiel', editTitle: 'Spiel bearbeiten' });
  if (r) route();
}

async function assignGame(gameId) {
  await loadAll('media_team', 'assignments', 'games', 'opponents');
  const g = byId(App.cache.games, gameId);
  const tasks = mediaTasks();
  const team = App.cache.media_team.filter(m => Number(m.active));
  const cur = App.cache.assignments.filter(a => a.game_id == gameId);
  openModal(`<h2>Media Team: ${esc(gameLabel(g))}</h2>
    ${!team.length ? '<div class="warnline" style="margin-bottom:10px">Noch keine Mitglieder im Media Team angelegt.</div>' : ''}
    <table><thead><tr><th>Aufgabe</th><th>Wer</th><th>Zugesagt</th></tr></thead><tbody>
    ${tasks.map((t, i) => { const a = cur.find(x => x.task === t) || {}; return `<tr><td><b>${esc(t)}</b></td>
      <td><select class="input" id="as_m_${i}"><option value="">(offen)</option>${team.map(m => `<option value="${m.id}" ${m.id == a.member_id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></td>
      <td><input type="checkbox" id="as_c_${i}" ${Number(a.confirmed) ? 'checked' : ''} style="accent-color:var(--red);width:18px;height:18px"></td></tr>`; }).join('')}
    </tbody></table>
    <div class="hint" style="margin-top:8px">Aufgaben änderst du unter Einstellungen.</div>
    <div class="modal-foot"><button class="btn" id="as_copy">Als Nachricht kopieren</button><div class="btn-row"><button class="btn" onclick="closeModal()">Abbrechen</button><button class="btn primary" id="as_save">Speichern</button></div></div>`);
  const collectA = () => tasks.map((t, i) => ({ task: t, member_id: $('#as_m_' + i).value ? Number($('#as_m_' + i).value) : null, confirmed: $('#as_c_' + i).checked ? 1 : 0 }));
  $('#as_copy').onclick = () => {
    const lines = collectA().map(a => `${a.task}: ${byId(team, a.member_id)?.name || 'noch offen'}`);
    copyText(noDashes(`🐯 Media Team Einteilung ${fmtDate(g.date, true)} ${Number(g.home) ? 'gegen' : 'bei'} ${byId(App.cache.opponents, g.opponent_id)?.name || 'TBA'}${g.time ? ', Kickoff ' + g.time + ' Uhr' : ''}\n\n${lines.join('\n')}\n\nBitte kurz bestätigen 👍`));
  };
  $('#as_save').onclick = async () => {
    for (const a of cur) await api('assignments/' + a.id, 'DELETE');
    for (const a of collectA()) if (a.member_id) await api('assignments', 'POST', { ...a, game_id: gameId });
    invalidate('assignments'); closeModal(); toast('Einteilung gespeichert'); route();
  };
}

App.pages.games = async (view) => {
  await loadAll('games', 'opponents', 'sponsors', 'assignments', 'posts');
  const seasons = [...new Set([App.settings.season, ...App.cache.games.map(g => g.season)].filter(Boolean))].sort().reverse();
  let season = App._season || App.settings.season;
  const tasks = mediaTasks();
  const draw = () => {
    App._season = season;
    const list = App.cache.games.filter(g => season === 'alle' || (g.season || '') == season).sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')));
    view.innerHTML = `
      <div class="page-head"><h1>Spielplan<small>${list.length} Spiele</small></h1>
        <div class="btn-row"><button class="btn keep" onclick="exportGamesCsv()">CSV für Canva</button><button class="vw btn primary" onclick="editGame()">+ Spiel</button></div></div>
      <div class="toolbar">${[...seasons, 'alle'].map(s => `<button class="btn sm ${s == season ? 'dark' : ''}" data-s="${esc(s)}">${s === 'alle' ? 'Alle' : 'Saison ' + esc(s)}</button>`).join('')}</div>
      <div class="table-wrap"><table><thead><tr><th>Datum</th><th></th><th>Gegner</th><th>Ort</th><th>Ergebnis</th><th>Sponsor</th><th>Media Team</th><th>Posts</th><th></th></tr></thead><tbody>
      ${list.map(g => {
        const o = byId(App.cache.opponents, g.opponent_id) || {};
        const sp = byId(App.cache.sponsors, g.sponsor_id);
        const asg = App.cache.assignments.filter(a => a.game_id == g.id && a.member_id).length;
        const posts = App.cache.posts.filter(p => p.game_id == g.id);
        const res = resultOf(g.score_us ?? '', g.score_them ?? '');
        return `<tr>
          <td style="white-space:nowrap"><b>${fmtDate(g.date)}</b><div class="muted small">${g.date ? WD[parseDate(g.date).getDay()] : ''}${g.time ? ', ' + g.time + ' Uhr' : ''}</div></td>
          <td>${o.logo ? `<img class="thumb logo" src="${esc(o.logo)}">` : ''}</td>
          <td><b>${Number(g.home) ? 'vs' : '@'} ${esc(o.name || 'TBA')}</b><div class="muted small">${esc(g.kind || '')}${g.league ? ' | ' + esc(g.league) : ''}</div></td>
          <td>${Number(g.home) ? '<span class="badge red">Heim</span>' : '<span class="badge">Auswärts</span>'}<div class="muted small">${esc(g.location || (Number(g.home) ? App.settings.home_location : ''))}</div></td>
          <td>${g.score_us !== null && g.score_us !== '' ? `<b>${g.score_us}:${g.score_them}</b> <span class="badge ${res === 'SIEG' ? 'ok' : res === 'NIEDERLAGE' ? '' : 'warn'}">${res.charAt(0) + res.slice(1).toLowerCase()}</span>` : '<span class="muted">offen</span>'}</td>
          <td>${sp ? esc(sp.name) : '<span class="muted">keiner</span>'}</td>
          <td><button class="pp btn sm" onclick="assignGame(${g.id})">${asg}/${tasks.length}</button></td>
          <td>${posts.length ? posts.map(p => statusBadge(p.type)).join(' ') : '<span class="muted small">keine</span>'}</td>
          <td class="actions"><button class="btn sm keep" onclick="copyGameInfo(${g.id})">Infos kopieren</button> <button class="pp btn sm" onclick="planPost({type:'Gameday',game_id:${g.id}})">Gameday</button> <button class="pp btn sm" onclick="planPost({type:'Ergebnis',game_id:${g.id}})">Endstand</button> <button class="vw btn sm ghost" onclick="editGame(${g.id})">Bearbeiten</button></td>
        </tr>`; }).join('') || '<tr><td colspan="9" class="empty">Noch keine Spiele in dieser Saison.</td></tr>'}
      </tbody></table></div>`;
    $$('[data-s]').forEach(b => b.onclick = () => { season = b.dataset.s; draw(); });
  };
  draw();
};

/* ====================================================================== */
/* Kader */
App.pages.players = async (view) => {
  await load('players');
  let unit = App._unit || 'Alle', q = '', showInactive = false;
  const draw = () => {
    App._unit = unit;
    let list = App.cache.players.filter(p => showInactive || Number(p.active));
    if (unit === 'Coaches & Staff') list = list.filter(p => p.kind !== 'Spieler');
    else if (unit === 'Rookies') list = list.filter(p => p.kind === 'Spieler' && Number(p.rookie));
    else if (unit !== 'Alle') list = list.filter(p => p.kind === 'Spieler' && (p.unit === unit || (unit !== 'Special Teams' && p.unit === 'Two-Way')));
    if (q) list = list.filter(p => (fullName(p) + ' ' + p.number + ' ' + p.position + ' ' + p.role).toLowerCase().includes(q));
    list.sort((a, b) => (a.kind === 'Spieler') - (b.kind === 'Spieler') || (Number(a.number) || 999) - (Number(b.number) || 999) || fullName(a).localeCompare(fullName(b)));
    const total = App.cache.players.filter(p => Number(p.active) && p.kind === 'Spieler').length;
    view.innerHTML = `
      <div class="page-head"><h1>Kader &amp; Staff<small>${total} aktive Spieler</small></h1>
        <div class="btn-row"><button class="btn keep" id="k_csv" title="Aktuelle Ansicht als CSV für Canva-Massenerstellung">CSV für Canva</button><button class="btn primary" id="k_new">+ Person</button></div></div>
      <div class="toolbar">${['Alle', 'Offense', 'Defense', 'Special Teams', 'Rookies', 'Coaches & Staff'].map(u => `<button class="btn sm ${u === unit ? 'dark' : ''}" data-u="${u}">${u}</button>`).join('')}
        <input class="input" id="k_q" placeholder="Suchen" value="${esc(q)}" style="max-width:220px">
        <label class="check small"><input type="checkbox" id="k_in" ${showInactive ? 'checked' : ''}> inaktive zeigen</label></div>
      <div class="table-wrap"><table><thead><tr><th></th><th>#</th><th>Name</th><th>Position / Rolle</th><th>Unit</th><th>Instagram</th><th>Einwilligung</th><th></th></tr></thead><tbody>
      ${list.map(p => `<tr style="${Number(p.active) ? '' : 'opacity:.5'}">
        <td>${p.photo ? `<img class="thumb" src="${esc(p.photo)}">` : '<div class="thumb"></div>'}</td>
        <td><b>${esc(p.number || '')}</b></td>
        <td><b>${esc(fullName(p))}</b> ${p.source === 'Tabelle' ? '<span class="badge" title="Automatisch aus der Google-Tabelle angelegt">Tabelle</span>' : ''} ${Number(p.rookie) ? '<span class="badge warn">Rookie</span>' : ''} ${p.kind !== 'Spieler' ? `<span class="badge dark">${esc(p.kind)}</span>` : ''}</td>
        <td>${esc(p.kind === 'Spieler' ? p.position || '' : p.role || '')}</td>
        <td>${esc(p.kind === 'Spieler' ? p.unit || '' : '')}</td>
        <td class="small">${esc(handle(p.instagram))}</td>
        <td>${Number(p.consent) ? '<span class="badge ok">ja</span>' : '<span class="badge warn">fehlt</span>'}</td>
        <td class="actions"><button class="pp btn sm" onclick="planPost({type:'Spielervorstellung',player_id:${p.id}})">Post planen</button> <button class="btn sm ghost" data-e="${p.id}">Bearbeiten</button></td>
      </tr>`).join('') || '<tr><td colspan="8" class="empty">Noch niemand eingetragen.</td></tr>'}
      </tbody></table></div>`;
    $$('[data-u]').forEach(b => b.onclick = () => { unit = b.dataset.u; draw(); });
    $('#k_q').oninput = e => { q = e.target.value.toLowerCase(); const pos = e.target.selectionStart; draw(); const el = $('#k_q'); el.focus(); el.setSelectionRange(pos, pos); };
    $('#k_in').onchange = e => { showInactive = e.target.checked; draw(); };
    const edit = async rec => { const r = await editRecord('players', F.players, rec, { newTitle: 'Neue Person', editTitle: 'Person bearbeiten' }); if (r) { await load('players'); draw(); } };
    $('#k_new').onclick = () => edit({ kind: 'Spieler', active: 1 });
    $$('[data-e]').forEach(b => b.onclick = () => edit(byId(App.cache.players, b.dataset.e)));
    $('#k_csv').onclick = () => {
      const ps = list.filter(p => p.kind === 'Spieler' ? Number(p.consent) : true);
      downloadCsv('kader-canva.csv', ['Nummer', 'Vorname', 'Nachname', 'Name', 'Position', 'Unit', 'Rolle', 'Rookie', 'Dabei seit', 'Instagram'],
        ps.map(p => [p.number, p.first_name, p.last_name, fullName(p), p.position, p.unit, p.kind === 'Spieler' ? '' : (p.role || p.kind), Number(p.rookie) ? 'Rookie' : '', p.since, handle(p.instagram)]));
      if (ps.length < list.length) toast(`${list.length - ps.length} Spieler ohne Einwilligung nicht exportiert`);
    };
  };
  draw();
};

/* ====================================================================== */
/* Einfache Listen-Seiten */
function simpleList({ table, title, sub, fields, columns, newTitle, newRecord = {}, extraHead = '', sort }) {
  return async (view) => {
    const list = [...await load(table, true)];
    if (sort) list.sort(sort);
    const fl = typeof fields === 'function' ? fields() : fields;
    view.innerHTML = `
      <div class="page-head"><h1>${title}<small>${typeof sub === 'function' ? sub(list) : list.length + ' Einträge'}</small></h1>
        <div class="btn-row"><button class="btn primary" id="sl_new">+ ${newTitle}</button></div></div>
      ${extraHead ? await extraHead(list) : ''}
      <div class="table-wrap"><table><thead><tr>${columns.map(c => `<th>${c.label}</th>`).join('')}<th></th></tr></thead><tbody>
      ${list.map(r => `<tr>${columns.map(c => `<td>${c.html(r)}</td>`).join('')}<td class="actions">${c_actions(table, r)}<button class="btn sm ghost" data-e="${r.id}">Bearbeiten</button></td></tr>`).join('')
        || `<tr><td colspan="${columns.length + 1}" class="empty">Noch nichts eingetragen.</td></tr>`}
      </tbody></table></div>`;
    const edit = async rec => { const r = await editRecord(table, fl, rec, { newTitle, editTitle: 'Bearbeiten' }); if (r) route(); };
    $('#sl_new').onclick = () => edit({ ...newRecord });
    $$('[data-e]').forEach(b => b.onclick = () => edit(byId(list, b.dataset.e)));
  };
}
function c_actions(table, r) {
  if (table === 'sponsors') return `<button class="pp btn sm" onclick="planPost({type:'Sponsor',sponsor_id:${r.id}})">Post planen</button> `;
  return '';
}

App.pages.opponents = simpleList({
  table: 'opponents', title: 'Gegner', fields: F.opponents, newTitle: 'Gegner',
  sort: (a, b) => (a.name || '').localeCompare(b.name || ''),
  columns: [
    { label: '', html: r => r.logo ? `<img class="thumb logo" src="${esc(r.logo)}">` : '<div class="thumb"></div>' },
    { label: 'Name', html: r => `<b>${esc(r.name)}</b>${r.short ? `<div class="muted small">${esc(r.short)}</div>` : ''}` },
    { label: 'Stadt', html: r => esc(r.city || '') },
    { label: 'Instagram', html: r => esc(handle(r.instagram)) },
  ],
});

App.pages.sponsors = async (view) => {
  await load('posts', true);
  return simpleList({
    table: 'sponsors', title: 'Sponsoren', fields: F.sponsors, newTitle: 'Sponsor', newRecord: { active: 1 },
    sub: l => `${l.filter(s => Number(s.active)).length} aktiv`,
    sort: (a, b) => Number(b.active) - Number(a.active) || (a.name || '').localeCompare(b.name || ''),
    columns: [
      { label: '', html: r => r.logo ? `<img class="thumb logo" src="${esc(r.logo)}">` : '<div class="thumb"></div>' },
      { label: 'Name', html: r => `<b style="${Number(r.active) ? '' : 'opacity:.5'}">${esc(r.name)}</b>${r.contact ? `<div class="muted small">${esc(r.contact)}</div>` : ''}` },
      { label: 'Paket', html: r => r.package ? `<span class="badge">${esc(r.package)}</span>` : '' },
      ...(can('finanzen') ? [{ label: 'Leistung', html: r => esc(r.amount || '') }] : []),
      { label: 'Laufzeit', html: r => [fmtDate(r.start), fmtDate(r.end)].filter(Boolean).join(' bis ') },
      { label: 'Posts', html: r => { const done = App.cache.posts.filter(p => p.sponsor_id == r.id && p.status === 'Gepostet').length; const ag = Number(r.posts_agreed) || 0; return ag ? `<span class="badge ${done >= ag ? 'ok' : 'warn'}">${done}/${ag}</span>` : `<span class="muted small">${done} gepostet</span>`; } },
      { label: 'Instagram', html: r => esc(handle(r.instagram)) },
    ],
  })(view);
};

App.pages.team = async (view) => {
  await loadAll('games', 'opponents', 'assignments');
  return simpleList({
    table: 'media_team', title: 'Media Team', fields: F.media_team, newTitle: 'Mitglied', newRecord: { active: 1 },
    sub: l => `${l.filter(m => Number(m.active)).length} aktiv`,
    sort: (a, b) => Number(b.active) - Number(a.active) || (a.name || '').localeCompare(b.name || ''),
    extraHead: async () => {
      const today = todayStr();
      const next = App.cache.games.filter(g => g.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
      if (!next.length) return '';
      return `<h2>Einteilung kommende Spiele</h2><div class="grid g4" style="margin-bottom:20px">${next.map(g => {
        const asg = App.cache.assignments.filter(a => a.game_id == g.id && a.member_id).length;
        return `<div class="card"><b>${fmtDate(g.date)}</b><div class="muted small" style="margin-bottom:8px">${Number(g.home) ? 'vs' : '@'} ${esc(byId(App.cache.opponents, g.opponent_id)?.name || 'TBA')}</div>
          <button class="btn sm ${asg >= mediaTasks().length ? '' : 'primary'}" onclick="assignGame(${g.id})">${asg}/${mediaTasks().length} eingeteilt</button></div>`;
      }).join('')}</div>`;
    },
    columns: [
      { label: 'Name', html: r => `<b style="${Number(r.active) ? '' : 'opacity:.5'}">${esc(r.name)}</b>` },
      { label: 'Hauptaufgabe', html: r => esc(r.role || '') },
      { label: 'Telefon', html: r => esc(r.phone || '') },
      { label: 'Instagram', html: r => esc(handle(r.instagram)) },
      { label: 'Einsätze', html: r => App.cache.assignments.filter(a => a.member_id == r.id).length },
    ],
  })(view);
};

App.pages.cards = async (view) => {
  const s = App.settings;
  return simpleList({
    table: 'supporter_cards', title: 'Supporter Karte', fields: F.supporter_cards, newTitle: 'Karte verkauft',
    newRecord: { season: s.season, price: s.card_price, sold_on: todayStr() },
    sort: (a, b) => (b.sold_on || '').localeCompare(a.sold_on || ''),
    sub: l => `${l.length} Karten verkauft`,
    extraHead: async list => {
      const seasons = [...new Set(list.map(c => c.season).filter(Boolean))].sort().reverse();
      return `<div class="grid g${Math.min(Math.max(seasons.length, 1), 3)}" style="margin-bottom:20px">${(seasons.length ? seasons : [s.season]).map(se => {
        const cs = list.filter(c => c.season == se);
        const sum = cs.reduce((a, c) => a + (Number(c.price) || 0), 0);
        const paid = cs.filter(c => Number(c.paid)).reduce((a, c) => a + (Number(c.price) || 0), 0);
        const wol = cs.length * (Number(s.card_share_wolthusen) || 0);
        return `<div class="card"><h2>Saison ${esc(se)}</h2>
          <div class="sum-row"><span>Verkaufte Karten</span><b>${cs.length}</b></div>
          <div class="sum-row"><span>Umsatz</span><b>${eur(sum)}</b></div>
          <div class="sum-row"><span>Davon bezahlt</span><b>${eur(paid)}</b></div>
          <div class="sum-row"><span>Anteil Eintritt Wolthusen (${eur(s.card_share_wolthusen)} je Karte)</span><b>${eur(wol)}</b></div>
          <div class="sum-row"><span>Sponsorengeld Tigers</span><b style="color:var(--red)">${eur(sum - wol)}</b></div></div>`;
      }).join('')}</div>`;
    },
    columns: [
      { label: 'Nr.', html: r => esc(r.number || '') },
      { label: 'Inhaber', html: r => `<b>${esc(r.holder || '')}</b>` },
      { label: 'Saison', html: r => esc(r.season || '') },
      { label: 'Verkauft', html: r => fmtDate(r.sold_on) },
      { label: 'Preis', html: r => eur(r.price) },
      { label: 'Bezahlt', html: r => Number(r.paid) ? '<span class="badge ok">ja</span>' : '<span class="badge warn">offen</span>' },
    ],
  })(view);
};

/* ====================================================================== */
/* Einstellungen */
App.pages.settings = async (view) => {
  const s = App.settings;
  const fields = [
    { key: 'club_name', label: 'Vereinsname' },
    { key: 'club_short', label: 'Kurzname', hint: 'z. B. TIGERS' },
    { key: 'instagram', label: 'Instagram-Account des Vereins', hint: 'Wird in Captions nie selbst markiert.' },
    { key: 'season', label: 'Aktuelle Saison' },
    { key: 'logo', label: 'Anderes Logo verwenden (optional)', type: 'image', hint: 'Leer lassen für das Tigers-Logo.' },
    { key: 'sheet_url', label: 'Google-Tabelle „Social Media Spieler“', full: true, hint: 'Freigabe: Jeder mit dem Link, Betrachter. Gelesen wird das erste Tabellenblatt bzw. das im Link (gid).' },
    { key: 'sheet_interval', label: 'Tabelle einlesen alle ... Minuten', type: 'number' },
    { key: 'sheet_gids', label: 'Tabellenblätter (gid, mit Komma)', hint: 'Standard 0 = Blatt Spieler (Spieler und Coaches). Weitere Blätter mit Komma, die gid steht im Link hinter #gid=' },
    { key: 'sheet_update_kader', label: 'Änderungen automatisch in den Kader übernehmen', type: 'check' },
    { key: 'color_primary', label: 'Akzentfarbe der Oberfläche', type: 'color' },
    { key: 'home_location', label: 'Heimspielort' },
    { key: 'entry_fee', label: 'Eintritt Heimspiel (€)', type: 'number' },
    { key: 'card_price', label: 'Preis Supporter Karte (€)', type: 'number' },
    { key: 'card_share_wolthusen', label: 'Anteil Eintritt an Wolthusen je Karte (€)', type: 'number' },
    { key: 'default_hashtags', label: 'Standard-Hashtags', full: true, hint: 'Pro Caption werden maximal 5 Hashtags genutzt.' },
    { key: 'training_text', label: 'Trainingszeiten (für Probetraining-Hinweise)', type: 'textarea', rows: 2 },
    { key: 'media_tasks', label: 'Aufgaben im Media Team pro Spiel (eine pro Zeile)', type: 'textarea', rows: 4 },
  ];
  view.innerHTML = `
    <div class="page-head"><h1>Einstellungen<small>Vereinsdaten, Standardwerte, Datensicherung</small></h1>
      <div class="btn-row"><a class="btn" href="#/accounts">Konten</a><a class="btn" href="#/groups">Gruppen &amp; Rechte</a></div></div>
    <div class="card" style="margin-bottom:16px"><form class="form" id="st_form" onsubmit="return false">${fields.map(f => fieldHtml(f, s[f.key])).join('')}</form>
      <div class="btn-row" style="margin-top:16px"><button class="btn primary" id="st_save">Speichern</button></div></div>
    <div class="card"><h2>Datensicherung</h2>
      <p class="muted">Der Server legt jede Nacht automatisch eine Sicherung der Datenbank an. Das Backup-ZIP enthält alle Daten und Bilder, aber keine Passwörter.</p>
      <div class="btn-row"><a class="btn dark" href="/api/backup">Backup herunterladen (ZIP)</a><a class="btn" href="/api/export" download="emden-tigers-hub-export.json">Daten als JSON</a>
        <button class="btn" id="rs_btn">Backup einspielen</button><input type="file" id="rs_file" accept=".zip,.db" hidden></div>
      <div class="hint" style="margin-top:8px">Einspielen ersetzt alle Vereinsdaten durch das Backup (z. B. aus einer älteren Version). Vorher wird automatisch eine Sicherung angelegt. Konten, Gruppen und Rechte bleiben erhalten.</div>
      <div id="bk_list" class="small muted" style="margin-top:10px"></div></div>`;
  $$('input[name="color_primary"]').forEach(i => i.type = 'color');
  bindImageFields($('#st_form'));
  $('#st_save').onclick = async () => {
    App.settings = await api('settings', 'PUT', readForm($('#st_form'), fields));
    applyBranding(); toast('Einstellungen gespeichert');
  };
  $('#rs_btn').onclick = () => $('#rs_file').click();
  $('#rs_file').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!confirmBox(`„${f.name}“ einspielen? Alle aktuellen Vereinsdaten werden durch das Backup ersetzt.`)) return;
    toast('Spiele Backup ein ...');
    const r = await fetch('/api/restore', { method: 'POST', headers: { 'X-TMH': '1', 'Content-Type': 'application/octet-stream' }, body: f });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return alert('Einspielen fehlgeschlagen: ' + (d.error || r.status));
    App.cache = {}; await loadSettings();
    alert(`Backup eingespielt. ${d.media} Bilder übernommen.`); route();
  };
  api('backups').then(list => { const el = $('#bk_list'); if (el && list.length) el.innerHTML = 'Automatische Sicherungen auf dem Server: ' + list.slice(0, 5).map(b => esc(b.name)).join(', ') + (list.length > 5 ? ' ...' : ''); }).catch(() => {});
};

/* ====================================================================== */
/* Social Media Spieler (aus der Google-Tabelle) */
App.pages.social = async (view, args) => {
  const render = async (msg) => {
    App.settings = await api('settings');
    const [rows, log, players] = await Promise.all([api('sheet_players'), api('sheet_log'), load('players', true)]);
    const s = App.settings;
    let filter = App._socialFilter || 'Alle';
    const all = rows.filter(r => r.status === 'aktiv').sort((a, b) => ((a.kind === 'Coach') - (b.kind === 'Coach')) || (Number(a.number) || 999) - (Number(b.number) || 999) || a.name.localeCompare(b.name));
    const active = filter === 'Alle' ? all : all.filter(r => (r.kind || 'Spieler') === filter);
    const removed = rows.filter(r => r.status === 'entfernt');
    const recent = r => r.last_change && (Date.now() - new Date(r.last_change)) < 7 * 864e5;
    const tag = r => r.first_seen === r.last_change ? '<span class="badge ok">neu</span>' : '<span class="badge warn">geändert</span>';
    const noIg = all.filter(r => !r.instagram).length;
    const last = s.sheet_last_sync ? new Date(s.sheet_last_sync) : null;
    view.innerHTML = `
      <div class="page-head"><h1>Social Media Spieler<small>Aus der Google-Tabelle, wird alle ${esc(s.sheet_interval || 5)} Minuten automatisch eingelesen</small></h1>
        <div class="btn-row">
          ${s.sheet_url ? `<a class="btn keep" href="${esc(s.sheet_url)}" target="_blank" rel="noopener">Tabelle öffnen</a>` : ''}
          <button class="btn keep" id="so_copy">Alle @Namen kopieren</button>
          <button class="btn primary" id="so_sync">Jetzt einlesen</button></div></div>
      ${s.sheet_last_error ? `<div class="card" style="border-color:#e0a020;background:var(--warn-soft);margin-bottom:16px"><b>Einlesen fehlgeschlagen</b><div class="small">${esc(s.sheet_last_error)}</div></div>` : ''}
      ${msg ? `<div class="card" style="margin-bottom:16px">${msg}</div>` : ''}
      <div class="grid g4" style="margin-bottom:16px">
        <div class="card stat"><span>Spieler</span><b>${all.filter(r => r.kind !== 'Coach').length}</b></div>
        <div class="card stat"><span>Coaches</span><b>${all.filter(r => r.kind === 'Coach').length}</b></div>
        <div class="card stat"><span>Ohne Instagram</span><b>${noIg}</b></div>
        <div class="card stat"><span>Zuletzt eingelesen</span><b style="font-size:20px">${last ? last.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'noch nie'}</b></div>
      </div>
      <div class="toolbar">${['Alle', 'Spieler', 'Coach'].map(f => `<button class="btn sm ${f === filter ? 'dark' : ''}" data-sf="${f}">${f === 'Coach' ? 'Coaches' : f}</button>`).join('')}</div>
      <div class="table-wrap" style="margin-bottom:20px"><table><thead><tr><th>#</th><th>Name</th><th>Art</th><th>Position / Funktion</th><th>Instagram</th><th>Kader</th><th>Letzte Änderung</th></tr></thead><tbody>
      ${active.map(r => { const p = byId(players, r.player_id); return `<tr>
        <td><b>${esc(r.number)}</b></td>
        <td><b>${esc(r.name)}</b></td>
        <td>${r.kind === 'Coach' ? '<span class="badge dark">Coach</span>' : '<span class="badge">Spieler</span>'}</td>
        <td>${esc(r.kind === 'Coach' ? (r.role || r.position) : r.position)}</td>
        <td>${r.instagram ? `<a href="https://instagram.com/${encodeURIComponent(r.instagram)}" target="_blank" rel="noopener">@${esc(r.instagram)}</a>` : '<span class="badge warn">fehlt</span>'}</td>
        <td>${p ? `<span class="badge ok">verknüpft</span> ${Number(p.consent) ? '' : '<span class="badge warn" title="Im Kader ist keine Foto-Einwilligung hinterlegt">Einwilligung fehlt</span>'}` : '<span class="badge">nicht im Kader</span>'}</td>
        <td>${recent(r) ? tag(r) + ' ' : ''}<span class="muted small">${r.last_change ? new Date(r.last_change).toLocaleDateString('de-DE') : ''}</span></td>
      </tr>`; }).join('') || `<tr><td colspan="7" class="empty">${s.sheet_last_sync ? 'Die Tabelle ist leer.' : 'Noch nicht eingelesen. Klick auf „Jetzt einlesen“.'}</td></tr>`}
      </tbody></table></div>
      <div class="grid g2">
        <div class="card"><h2>Änderungsprotokoll</h2>
          ${log.length ? `<div class="list">${[...log].reverse().slice(0, 40).map(l => `<div class="list-item"><span class="badge ${l.action === 'neu' ? 'ok' : l.action === 'entfernt' ? 'red' : 'warn'}">${esc(l.action)}</span><div class="grow"><b>${esc(l.name)}</b><div class="muted small">${esc(l.details || '')}</div></div><span class="muted small">${new Date(l.time).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>`).join('')}</div>` : '<div class="muted">Noch keine Änderungen.</div>'}
        </div>
        <div class="card"><h2>Nicht mehr in der Tabelle</h2>
          ${removed.length ? `<div class="list">${removed.map(r => `<div class="list-item"><div class="grow"><b>${esc(r.name)}</b><div class="muted small">${esc([r.number ? '#' + r.number : '', r.position].filter(Boolean).join(' | '))}</div></div><span class="muted small">seit ${new Date(r.last_change).toLocaleDateString('de-DE')}</span></div>`).join('')}</div>
            <div class="hint" style="margin-top:8px">Im Kader bleiben sie erhalten. Dort bei Bedarf auf „inaktiv“ setzen.</div>` : '<div class="muted">Niemand.</div>'}
        </div>
      </div>`;
    $('#so_sync').onclick = async () => {
      $('#so_sync').disabled = true; $('#so_sync').textContent = 'Lese ein ...';
      const r = await api('sheet-sync', 'POST');
      invalidate('players');
      render(r.ok ? `Eingelesen: ${r.spieler} Spieler und ${r.coaches} Coaches, ${r.neu} neu, ${r['geändert']} geändert, ${r.entfernt} entfernt.` : '');
    };
    $$('[data-sf]').forEach(b => b.onclick = () => { App._socialFilter = b.dataset.sf; render(); });
    $('#so_copy').onclick = () => copyText(active.filter(r => r.instagram).map(r => '@' + r.instagram).join(' '));
  };
  await render();
  // beim Öffnen direkt einmal abgleichen, ohne zu warten
  if (!args.length && can('medien', 2)) api('sheet-sync', 'POST').catch(() => ({ ok: false })).then(r => { if (location.hash.startsWith('#/social') && r.ok && (r.neu || r['geändert'] || r.entfernt)) { invalidate('players'); render(`Neu eingelesen: ${r.neu} neu, ${r['geändert']} geändert, ${r.entfernt} entfernt.`); } else if (location.hash.startsWith('#/social') && !r.ok) render(); });
};

/* ---------- Post planen (Grafik kommt aus Canva) ---------- */
async function planPost(rec = {}) {
  await loadAll('games', 'opponents', 'sponsors', 'players', 'posts');
  const r = { status: 'Idee', format: 'Feed', time: '18:00', ...rec };
  if (!rec.id) {
    const g = byId(App.cache.games, r.game_id);
    if (!r.date) {
      if (g && r.type === 'Gameday') r.date = addDays(g.date, -2) < todayStr() ? g.date : addDays(g.date, -2);
      else if (g) r.date = g.date;
      else r.date = todayStr();
    }
    if (r.type === 'Ergebnis') r.time = '20:00';
    if (!r.title) {
      const p = byId(App.cache.players, r.player_id), sp = byId(App.cache.sponsors, r.sponsor_id);
      r.title = g ? `${r.type}: ${gameLabel(g)}` : p ? `${r.type}: ${fullName(p)}` : sp ? `${r.type}: ${sp.name}` : (r.type || '');
    }
    if (g && !r.sponsor_id && g.sponsor_id) r.sponsor_id = g.sponsor_id;
    if (!r.caption && r.type) r.caption = suggestCaption(r);
  }
  const saved = await editRecord('posts', F.posts, r, {
    newTitle: 'Post planen', editTitle: 'Post bearbeiten',
    onOpen: box => {
      const cap = $('#f_caption', box);
      cap.closest('.field').insertAdjacentHTML('beforeend', `<div class="btn-row" style="margin-top:6px">
        <button type="button" class="btn sm" id="pp_sug">Caption-Vorschlag aus den Daten</button>
        <button type="button" class="btn sm ghost" id="pp_copy">Kopieren</button>
        <span class="muted small" id="pp_info"></span></div><div id="pp_warn"></div>`);
      const check = () => {
        const v = cap.value, tags = (v.match(/#[\wÄÖÜäöüß]+/g) || []).length;
        $('#pp_info', box).textContent = `${v.length} Zeichen | ${tags} Hashtags`;
        const w = [];
        if (hasDashes(v)) w.push('Enthält Gedankenstriche. <button type="button" class="btn sm" id="pp_fix">Entfernen</button>');
        if (tags > 5) w.push('Mehr als 5 Hashtags.');
        if (/\[[^\]]+\]/.test(v)) w.push('Noch Platzhalter in eckigen Klammern drin.');
        const pl = byId(App.cache.players, $('#f_player_id', box).value);
        if (pl && !Number(pl.consent)) w.push('Für diese Person ist keine Foto-Einwilligung hinterlegt.');
        $('#pp_warn', box).innerHTML = w.map(x => `<div class="warnline">⚠ ${x}</div>`).join('');
        const fx = $('#pp_fix', box); if (fx) fx.onclick = () => { cap.value = noDashes(cap.value); check(); };
      };
      $('#pp_sug', box).onclick = () => {
        if (cap.value.trim() && !confirmBox('Aktuelle Caption durch einen Vorschlag ersetzen?')) return;
        cap.value = suggestCaption(readForm(box, F.posts)); check();
      };
      $('#pp_copy', box).onclick = () => copyText(cap.value);
      cap.addEventListener('input', check); box.addEventListener('change', check); check();
    },
  });
  if (saved) route();
}

async function copyGameInfo(id) {
  await loadAll('games', 'opponents', 'sponsors');
  copyText(noDashes(gameInfoText(byId(App.cache.games, id))));
}

async function exportGamesCsv() {
  await loadAll('games', 'opponents', 'sponsors');
  const season = App._season || App.settings.season;
  const list = App.cache.games.filter(g => season === 'alle' || (g.season || '') == season)
    .sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')));
  downloadCsv(`spielplan-${season}-canva.csv`,
    ['Datum', 'Datum kurz', 'Wochentag', 'Kickoff', 'Gegner', 'Heim/Auswärts', 'Spielort', 'Art', 'Ergebnis', 'Sponsor'],
    list.map(g => {
      const d = parseDate(g.date), o = byId(App.cache.opponents, g.opponent_id), home = Number(g.home);
      return [fmtDate(g.date), d ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.` : '', d ? WD[d.getDay()] : '',
        g.time ? g.time + ' Uhr' : '', o?.name || 'TBA', home ? 'Heim' : 'Auswärts', g.location || (home ? App.settings.home_location : ''), g.kind || '',
        g.score_us !== null && g.score_us !== '' ? `${g.score_us}:${g.score_them}` : '', byId(App.cache.sponsors, g.sponsor_id)?.name || ''];
    }));
}

/* ====================================================================== */
/* Rechte-Hilfen */
const LEVELS = ['Kein Zugriff', 'Lesen', 'Bearbeiten'];
const AREA_SHORT = { medien: 'Medien', verein: 'Verein', mitglieder: 'Mitglieder', finanzen: 'Finanzen' };
function levelBadge(l) {
  return l >= 2 ? '<span class="badge ok">Bearbeiten</span>' : l === 1 ? '<span class="badge">Lesen</span>' : '<span class="badge muted-badge">kein Zugriff</span>';
}
function permChips(perms) {
  return Object.keys(AREA_SHORT).map(a => `<span class="perm-chip lvl${perms[a] || 0}" title="${AREA_SHORT[a]}: ${LEVELS[perms[a] || 0]}">${AREA_SHORT[a]}</span>`).join('');
}
function slug(t) {
  return (t || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 40);
}

/* ====================================================================== */
/* Mein Profil (alle) */
App.pages.profile = async (view) => {
  const prof = await api('profile');
  const me = App.me, m = prof.member, pl = prof.player;
  view.innerHTML = `
    <div class="page-head"><h1>Mein Profil<small>${esc(prof.account.username)}${me.is_admin ? ' | Admin' : ''}</small></h1></div>
    <div class="grid g2" style="margin-bottom:16px">
      <div class="card"><h2>Konto</h2>
        <div class="form">
          <div class="field full"><label>Anzeigename</label><input class="input" id="pf_dn" value="${esc(prof.account.display_name || '')}"></div>
        </div>
        <div class="btn-row" style="margin-top:10px"><button class="btn" id="pf_dn_save">Speichern</button></div>
        <h3 style="margin-top:22px">Passwort ändern</h3>
        <form class="form" id="pw_form" onsubmit="return false">
          <input type="text" autocomplete="username" value="${esc(prof.account.username)}" hidden>
          <div class="field full"><label>Bisheriges Passwort</label><input class="input" type="password" id="pw_old" autocomplete="current-password"></div>
          <div class="field"><label>Neues Passwort</label><input class="input" type="password" id="pw_new" autocomplete="new-password"></div>
          <div class="field"><label>Wiederholen</label><input class="input" type="password" id="pw_new2" autocomplete="new-password"></div>
        </form>
        <div class="btn-row" style="margin-top:10px"><button class="btn" id="pw_save">Passwort ändern</button></div>
      </div>
      <div class="card"><h2>Meine Rechte</h2>
        <p class="muted">${me.is_admin ? 'Als Admin darfst du alles.' : me.groups.length ? 'Gruppen: <b>' + esc(me.groups.join(', ')) + '</b>' : 'Du bist noch keiner Gruppe zugeordnet.'}</p>
        <div class="list">${Object.entries(AREA_SHORT).map(([a, l]) => `<div class="list-item"><div class="grow">${l}</div>${levelBadge(me.perms[a] || 0)}</div>`).join('')}</div>
        ${pl ? `<h3 style="margin-top:18px">Im Kader</h3><div class="muted">${esc([pl.number ? '#' + pl.number : '', pl.kind === 'Spieler' ? [pl.position, pl.unit].filter(Boolean).join(' | ') : pl.role].filter(Boolean).join(' | '))}</div>` : ''}
      </div>
    </div>
    <div class="card"><h2>Meine Daten</h2>
      ${m ? `<form class="form" id="pf_form" onsubmit="return false">
          <div class="field"><label>Name</label><input class="input" value="${esc(fullName(m))}" disabled></div>
          <div class="field"><label>Mitglied seit</label><input class="input" value="${esc(fmtDate(m.member_since) || '')}" disabled></div>
          <div class="field"><label>E-Mail</label><input class="input" id="pf_email" type="text" value="${esc(m.email || '')}"></div>
          <div class="field"><label>Telefon</label><input class="input" id="pf_phone" value="${esc(m.phone || '')}"></div>
          <div class="field full"><label>Straße und Hausnummer</label><input class="input" id="pf_street" value="${esc(m.street || '')}"></div>
          <div class="field"><label>PLZ</label><input class="input" id="pf_zip" value="${esc(m.zip || '')}"></div>
          <div class="field"><label>Ort</label><input class="input" id="pf_city" value="${esc(m.city || '')}"></div>
          <div class="field full"><label>Notfallkontakt (Name und Telefon)</label><input class="input" id="pf_emergency" value="${esc(m.emergency_contact || '')}"></div>
          <div class="field full"><label class="check"><input type="checkbox" id="pf_consent" ${Number(m.consent_photo) ? 'checked' : ''}> Ich bin einverstanden, dass Fotos und Videos von mir auf den Kanälen der Emden Tigers veröffentlicht werden.</label>
            <div class="hint">Du kannst die Einwilligung jederzeit hier widerrufen.</div></div>
        </form>
        <div class="btn-row" style="margin-top:12px"><button class="btn primary" id="pf_save">Daten speichern</button></div>`
      : '<div class="muted">Dein Zugang ist noch keinem Mitgliedsprofil zugeordnet. Das macht der Admin unter Konten.</div>'}
    </div>`;
  $('#pf_dn_save').onclick = async () => { await api('profile', 'PUT', { display_name: $('#pf_dn').value }); App.me = await api('me'); renderSideFoot(); toast('Gespeichert'); };
  $('#pw_save').onclick = async () => {
    if ($('#pw_new').value !== $('#pw_new2').value) return alert('Die neuen Passwörter stimmen nicht überein.');
    try { await api('me/password', 'PUT', { old: $('#pw_old').value, new: $('#pw_new').value }); toast('Passwort geändert'); $('#pw_form').reset(); }
    catch (e) { alert(e.message); }
  };
  if (m) $('#pf_save').onclick = async () => {
    await api('profile', 'PUT', {
      email: $('#pf_email').value, phone: $('#pf_phone').value, street: $('#pf_street').value, zip: $('#pf_zip').value,
      city: $('#pf_city').value, emergency_contact: $('#pf_emergency').value, consent_photo: $('#pf_consent').checked ? 1 : 0,
    });
    toast('Deine Daten wurden gespeichert');
  };
};

/* ====================================================================== */
/* Mitglieder */
const MEMBER_TYPES = ['Spieler', 'Trainer', 'Vorstand', 'Helfer', 'Fotograf', 'Förderer', 'Sonstige'];
const MEMBER_STATUS = ['Aktiv', 'Probetraining', 'Passiv', 'Ausgetreten'];
F.members = [
  { key: 'first_name', label: 'Vorname' },
  { key: 'last_name', label: 'Nachname' },
  { key: 'member_type', label: 'Art', type: 'select', options: MEMBER_TYPES },
  { key: 'status', label: 'Status', type: 'select', options: MEMBER_STATUS },
  { key: 'birthdate', label: 'Geburtsdatum', type: 'date' },
  { key: 'member_since', label: 'Mitglied seit', type: 'date' },
  { key: 'email', label: 'E-Mail' },
  { key: 'phone', label: 'Telefon' },
  { key: 'street', label: 'Straße und Hausnummer', full: true },
  { key: 'zip', label: 'PLZ' },
  { key: 'city', label: 'Ort' },
  { key: 'emergency_contact', label: 'Notfallkontakt', full: true },
  { key: 'player_id', label: 'Im Kader', type: 'ref', ref: { table: 'players', label: playerLabel } },
  { key: 'exit_date', label: 'Ausgetreten am', type: 'date', show: v => v.status === 'Ausgetreten' },
  { key: 'consent_photo', label: 'Foto-Einwilligung liegt vor', type: 'check' },
  { key: 'equipment', label: 'Ausrüstung (Helm, Pads, Trikot)', type: 'textarea', rows: 2 },
  { key: 'notes', label: 'Notizen', type: 'textarea', rows: 2 },
];

App.pages.members = async (view) => {
  await loadAll('members', 'players');
  const users = App.me.is_admin ? await api('admin/users') : [];
  let st = App._mStatus || 'aktiv', type = App._mType || 'Alle', q = '';
  const draw = () => {
    App._mStatus = st; App._mType = type;
    let list = [...App.cache.members];
    if (st === 'aktiv') list = list.filter(m => m.status !== 'Ausgetreten');
    else if (st !== 'alle') list = list.filter(m => m.status === st);
    if (type !== 'Alle') list = list.filter(m => m.member_type === type);
    if (q) list = list.filter(m => (fullName(m) + ' ' + (m.email || '') + ' ' + (m.phone || '')).toLowerCase().includes(q));
    list.sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '') || (a.first_name || '').localeCompare(b.first_name || ''));
    const counts = MEMBER_STATUS.map(s => [s, App.cache.members.filter(m => m.status === s).length]);
    const userOf = m => users.find(u => u.member_id == m.id);
    view.innerHTML = `
      <div class="page-head"><h1>Mitglieder<small>${counts.filter(c => c[1]).map(c => `${c[1]} ${c[0].toLowerCase()}`).join(', ') || 'noch keine Einträge'}</small></h1>
        <div class="btn-row"><button class="btn keep" id="m_csv">CSV exportieren</button><button class="btn" id="m_import">Aus Kader übernehmen</button><button class="btn primary" id="m_new">+ Mitglied</button></div></div>
      <div class="toolbar">
        ${[['aktiv', 'Aktuelle'], ...MEMBER_STATUS.map(s => [s, s]), ['alle', 'Alle']].map(([k, l]) => `<button class="btn sm ${k === st ? 'dark' : ''}" data-ms="${k}">${l}</button>`).join('')}
        <select class="input" id="m_type" style="width:auto">${['Alle', ...MEMBER_TYPES].map(t => `<option ${t === type ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <input class="input" id="m_q" placeholder="Suchen" style="max-width:220px" value="${esc(q)}">
      </div>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Art</th><th>Status</th><th>Telefon</th><th>E-Mail</th><th>Mitglied seit</th><th>Foto</th>${App.me.is_admin ? '<th>Zugang</th>' : ''}<th></th></tr></thead><tbody>
      ${list.map(m => { const u = userOf(m); return `<tr style="${m.status === 'Ausgetreten' ? 'opacity:.55' : ''}">
        <td><b>${esc(fullName(m))}</b>${m.player_id ? ' <span class="badge" title="Im Kader">Kader</span>' : ''}</td>
        <td>${esc(m.member_type || '')}</td>
        <td><span class="badge ${m.status === 'Aktiv' ? 'ok' : m.status === 'Probetraining' ? 'warn' : ''}">${esc(m.status || '')}</span></td>
        <td class="small">${m.phone ? `<a href="tel:${esc(m.phone.replace(/\s/g, ''))}">${esc(m.phone)}</a>` : ''}</td>
        <td class="small">${m.email ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : ''}</td>
        <td class="small">${fmtDate(m.member_since)}</td>
        <td>${Number(m.consent_photo) ? '<span class="badge ok">ja</span>' : '<span class="badge warn">fehlt</span>'}</td>
        ${App.me.is_admin ? `<td>${u ? `<span class="badge ${u.invite_open ? 'warn' : 'ok'}">${u.invite_open ? 'eingeladen' : esc(u.username)}</span>` : `<button class="btn sm keep" data-acc="${m.id}">Zugang anlegen</button>`}</td>` : ''}
        <td class="actions"><button class="btn sm ghost" data-e="${m.id}">Bearbeiten</button></td></tr>`; }).join('')
        || `<tr><td colspan="9" class="empty">Keine Mitglieder in dieser Ansicht.</td></tr>`}
      </tbody></table></div>`;
    $$('[data-ms]').forEach(b => b.onclick = () => { st = b.dataset.ms; draw(); });
    $('#m_type').onchange = e => { type = e.target.value; draw(); };
    $('#m_q').oninput = e => { q = e.target.value.toLowerCase(); const pos = e.target.selectionStart; draw(); const el = $('#m_q'); el.focus(); el.setSelectionRange(pos, pos); };
    const edit = async rec => { const r = await editRecord('members', F.members, rec, { newTitle: 'Neues Mitglied', editTitle: 'Mitglied bearbeiten' }); if (r) { await load('members', true); draw(); } };
    $('#m_new').onclick = () => edit({ status: 'Aktiv', member_type: 'Spieler', member_since: todayStr() });
    $$('[data-e]').forEach(b => b.onclick = () => edit(byId(App.cache.members, b.dataset.e)));
    $$('[data-acc]').forEach(b => b.onclick = () => accountDialog(null, byId(App.cache.members, b.dataset.acc)));
    $('#m_csv').onclick = () => downloadCsv(`mitglieder-${todayStr()}.csv`,
      ['Vorname', 'Nachname', 'Art', 'Status', 'Geburtsdatum', 'E-Mail', 'Telefon', 'Straße', 'PLZ', 'Ort', 'Mitglied seit', 'Foto-Einwilligung'],
      list.map(m => [m.first_name, m.last_name, m.member_type, m.status, fmtDate(m.birthdate), m.email, m.phone, m.street, m.zip, m.city, fmtDate(m.member_since), Number(m.consent_photo) ? 'ja' : 'nein']));
    $('#m_import').onclick = async () => {
      const linked = new Set(App.cache.members.map(m => String(m.player_id)));
      const todo = App.cache.players.filter(p => Number(p.active) && !linked.has(String(p.id)));
      if (!todo.length) return toast('Alle aktiven Kader-Personen sind schon Mitglieder');
      if (!confirmBox(`${todo.length} Personen aus dem Kader als Mitglieder anlegen?`)) return;
      for (const p of todo) await api('members', 'POST', {
        first_name: p.first_name, last_name: p.last_name, player_id: p.id, status: 'Aktiv', consent_photo: Number(p.consent) ? 1 : 0,
        member_type: p.kind === 'Spieler' ? 'Spieler' : 'Trainer',
      });
      await load('members', true); toast(`${todo.length} Mitglieder angelegt`); draw();
    };
  };
  draw();
};

/* ====================================================================== */
/* Finanzen */
const TX_CATEGORIES = ['Sponsoring', 'Supporter Karte', 'Spenden', 'Mitgliedsbeiträge', 'Eintritt', 'Verkauf / Merch', 'Ausrüstung', 'Platz / Halle',
  'Schiedsrichter', 'Verband / Liga', 'Fahrtkosten', 'Medien / Technik', 'Veranstaltungen', 'Versicherung', 'Sonstiges'];
F.transactions = [
  { key: 'date', label: 'Datum', type: 'date', default: todayStr() },
  { key: 'kind', label: 'Art', type: 'select', options: ['Ausgabe', 'Einnahme'] },
  { key: 'amount', label: 'Betrag (€)', type: 'number' },
  { key: 'category', label: 'Kategorie', list: TX_CATEGORIES },
  { key: 'description', label: 'Beschreibung', full: true },
  { key: 'status', label: 'Status', type: 'select', options: ['Erledigt', 'Offen'], hint: 'Offen = noch nicht bezahlt bzw. noch nicht eingegangen' },
  { key: 'paid_by', label: 'Bezahlt von / an' },
  { key: 'sponsor_id', label: 'Sponsor', type: 'ref', ref: { table: 'sponsors', label: sponsorLabel } },
  { key: 'member_id', label: 'Mitglied', type: 'ref', ref: { table: 'members', label: m => fullName(m) } },
  { key: 'receipt', label: 'Beleg (Foto oder PDF)', type: 'file', full: true },
  { key: 'notes', label: 'Notizen', type: 'textarea', rows: 2 },
];

App.pages.finance = async (view) => {
  await loadAll('transactions', 'sponsors', 'members', 'supporter_cards');
  const years = [...new Set([String(new Date().getFullYear()), ...App.cache.transactions.map(t => (t.date || '').slice(0, 4)).filter(Boolean)])].sort().reverse();
  let year = App._finYear || years[0], kind = 'Alle', cat = 'Alle';
  const draw = () => {
    App._finYear = year;
    const inYear = App.cache.transactions.filter(t => year === 'alle' || (t.date || '').startsWith(year));
    let list = inYear;
    if (kind !== 'Alle') list = list.filter(t => t.kind === kind || (kind === 'Offen' && t.status === 'Offen'));
    if (cat !== 'Alle') list = list.filter(t => t.category === cat);
    list = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);
    const sum = (arr, k) => arr.filter(t => t.kind === k).reduce((a, t) => a + (Number(t.amount) || 0), 0);
    const inc = sum(inYear, 'Einnahme'), exp = sum(inYear, 'Ausgabe');
    const cats = {};
    inYear.forEach(t => { const k = (t.category || 'Ohne Kategorie'); cats[k] = cats[k] || { inc: 0, exp: 0 }; cats[k][t.kind === 'Einnahme' ? 'inc' : 'exp'] += Number(t.amount) || 0; });
    const cards = App.cache.supporter_cards.filter(c => year === 'alle' || c.season == year);
    const cardSum = cards.reduce((a, c) => a + (Number(c.price) || 0), 0);
    const sponsorSum = App.cache.sponsors.filter(s => Number(s.active)).reduce((a, s) => a + (parseFloat(String(s.amount || '').replace(/\./g, '').replace(',', '.')) || 0), 0);
    view.innerHTML = `
      <div class="page-head"><h1>Finanzen<small>Einnahmen und Ausgaben ${year === 'alle' ? 'gesamt' : year}</small></h1>
        <div class="btn-row"><button class="btn keep" id="f_csv">CSV exportieren</button><button class="btn primary" id="f_new">+ Buchung</button></div></div>
      <div class="toolbar">${[...years, 'alle'].map(y => `<button class="btn sm ${y === year ? 'dark' : ''}" data-y="${y}">${y === 'alle' ? 'Alle Jahre' : y}</button>`).join('')}</div>
      <div class="grid g4" style="margin-bottom:16px">
        <div class="card stat"><span>Einnahmen</span><b style="color:var(--ok)">${eur(inc)}</b></div>
        <div class="card stat"><span>Ausgaben</span><b>${eur(exp)}</b></div>
        <div class="card stat"><span>Saldo</span><b style="color:${inc - exp < 0 ? 'var(--red)' : 'var(--ok)'}">${eur(inc - exp)}</b></div>
        <div class="card stat"><span>Offen</span><b>${inYear.filter(t => t.status === 'Offen').length}</b></div>
      </div>
      <div class="grid g2" style="margin-bottom:16px">
        <div class="card"><h2>Nach Kategorie</h2>
          ${Object.keys(cats).length ? Object.entries(cats).sort((a, b) => (b[1].inc + b[1].exp) - (a[1].inc + a[1].exp)).map(([k, v]) =>
            `<div class="sum-row"><span>${esc(k)}</span><span>${v.inc ? `<b style="color:var(--ok)">+${eur(v.inc)}</b> ` : ''}${v.exp ? `<b>-${eur(v.exp)}</b>` : ''}</span></div>`).join('') : '<div class="muted">Noch keine Buchungen.</div>'}
        </div>
        <div class="card"><h2>Weitere Quellen</h2>
          <div class="sum-row"><span>Supporter Karten ${year === 'alle' ? '' : year} (${cards.length} Stück)</span><b>${eur(cardSum)}</b></div>
          <div class="sum-row"><span>Davon Anteil Wolthusen</span><b>${eur(cards.length * (Number(App.settings.card_share_wolthusen) || 0))}</b></div>
          <div class="sum-row"><span>Vereinbarte Beträge aktiver Sponsoren</span><b>${eur(sponsorSum)}</b></div>
          <div class="hint" style="margin-top:8px">Diese Werte sind nur zur Übersicht. Tatsächliche Zahlungseingänge bitte als Buchung erfassen.</div>
        </div>
      </div>
      <div class="toolbar">
        ${['Alle', 'Einnahme', 'Ausgabe', 'Offen'].map(k => `<button class="btn sm ${k === kind ? 'dark' : ''}" data-k="${k}">${k === 'Alle' ? 'Alle' : k === 'Offen' ? 'Offen' : k + 'n'}</button>`).join('')}
        <select class="input" id="f_cat" style="width:auto">${['Alle', ...new Set([...TX_CATEGORIES, ...App.cache.transactions.map(t => t.category).filter(Boolean)])].map(c => `<option ${c === cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Datum</th><th>Beschreibung</th><th>Kategorie</th><th>Bezahlt von / an</th><th style="text-align:right">Betrag</th><th>Status</th><th>Beleg</th><th></th></tr></thead><tbody>
      ${list.map(t => `<tr>
        <td class="small" style="white-space:nowrap">${fmtDate(t.date)}</td>
        <td><b>${esc(t.description || '')}</b>${t.sponsor_id ? `<div class="muted small">${esc(byId(App.cache.sponsors, t.sponsor_id)?.name || '')}</div>` : ''}</td>
        <td class="small">${esc(t.category || '')}</td>
        <td class="small">${esc(t.paid_by || (t.member_id ? fullName(byId(App.cache.members, t.member_id)) : ''))}</td>
        <td style="text-align:right;white-space:nowrap"><b style="color:${t.kind === 'Einnahme' ? 'var(--ok)' : 'inherit'}">${t.kind === 'Einnahme' ? '+' : '-'}${eur(t.amount)}</b></td>
        <td>${t.status === 'Offen' ? '<span class="badge warn">offen</span>' : '<span class="badge ok">erledigt</span>'}</td>
        <td>${t.receipt ? `<a class="btn sm keep" href="${esc(t.receipt)}" target="_blank" rel="noopener">Ansehen</a>` : ''}</td>
        <td class="actions"><button class="btn sm ghost" data-e="${t.id}">Bearbeiten</button></td></tr>`).join('')
        || '<tr><td colspan="8" class="empty">Keine Buchungen in dieser Ansicht.</td></tr>'}
      </tbody></table></div>`;
    $$('[data-y]').forEach(b => b.onclick = () => { year = b.dataset.y; draw(); });
    $$('[data-k]').forEach(b => b.onclick = () => { kind = b.dataset.k; draw(); });
    $('#f_cat').onchange = e => { cat = e.target.value; draw(); };
    const edit = async rec => { const r = await editRecord('transactions', F.transactions, rec, { newTitle: 'Neue Buchung', editTitle: 'Buchung bearbeiten' }); if (r) { await load('transactions', true); draw(); } };
    $('#f_new').onclick = () => edit({ date: todayStr(), kind: 'Ausgabe', status: 'Erledigt' });
    $$('[data-e]').forEach(b => b.onclick = () => edit(byId(App.cache.transactions, b.dataset.e)));
    $('#f_csv').onclick = () => downloadCsv(`buchungen-${year}.csv`, ['Datum', 'Art', 'Betrag', 'Kategorie', 'Beschreibung', 'Bezahlt von / an', 'Status', 'Beleg'],
      list.map(t => [fmtDate(t.date), t.kind, String(Number(t.amount) || 0).replace('.', ','), t.category, t.description, t.paid_by, t.status, t.receipt ? location.origin + t.receipt : '']));
  };
  draw();
};

/* ====================================================================== */
/* Verwaltung: Konten */
async function accountDialog(user, member) {
  const [groups, members] = await Promise.all([api('admin/groups'), load('members', true).catch(() => [])]);
  const isNew = !user;
  const u = user || {
    username: member ? slug(`${member.first_name || ''} ${member.last_name || ''}`) : '', display_name: member ? fullName(member) : '',
    email: member?.email || '', member_id: member?.id || null, is_admin: false, active: 1, overrides: {},
    groups: member ? groups.filter(g => g.name.toLowerCase().startsWith((member.member_type || '').toLowerCase().slice(0, 5))).map(g => g.id) : [],
  };
  openModal(`
    <h2>${isNew ? 'Neuer Zugang' : 'Zugang bearbeiten'}</h2>
    <div class="form">
      <div class="field"><label>Anzeigename</label><input class="input" id="ac_dn" value="${esc(u.display_name || '')}"></div>
      <div class="field"><label>Benutzername (für die Anmeldung)</label><input class="input" id="ac_un" value="${esc(u.username || '')}" autocomplete="off"></div>
      <div class="field"><label>E-Mail (optional)</label><input class="input" id="ac_em" value="${esc(u.email || '')}"></div>
      <div class="field"><label>Mitgliedsprofil</label><select class="input" id="ac_mem"><option value="">(keins)</option>
        ${members.sort((a, b) => fullName(a).localeCompare(fullName(b))).map(m => `<option value="${m.id}" ${m.id == u.member_id ? 'selected' : ''}>${esc(fullName(m))}</option>`).join('')}</select></div>
      <div class="field full"><label>Gruppen</label><div class="chk-grid">
        ${groups.map(g => `<label class="check"><input type="checkbox" class="ac_g" value="${g.id}" ${u.groups.includes(g.id) ? 'checked' : ''}> ${esc(g.name)}</label>`).join('')}</div></div>
      <div class="field full"><label>Rechte pro Bereich</label>
        <table class="perm-table"><thead><tr><th>Bereich</th><th>Aus Gruppen</th><th>Ausnahme für diese Person</th><th>Ergebnis</th></tr></thead><tbody>
        ${Object.entries(AREA_SHORT).map(([a, l]) => `<tr><td><b>${l}</b></td><td id="ac_gl_${a}"></td>
          <td><select class="input" id="ac_ov_${a}"><option value="">wie Gruppe</option>${LEVELS.map((t, i) => `<option value="${i}" ${u.overrides[a] === i ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
          <td id="ac_ef_${a}"></td></tr>`).join('')}
        </tbody></table></div>
      <div class="field"><label class="check"><input type="checkbox" id="ac_admin" ${u.is_admin ? 'checked' : ''}> Admin (darf alles, inkl. Konten und Einstellungen)</label></div>
      <div class="field"><label class="check"><input type="checkbox" id="ac_active" ${Number(u.active) ? 'checked' : ''}> Zugang aktiv</label></div>
    </div>
    <div class="modal-foot">
      <div class="btn-row">${!isNew ? '<button class="btn danger" id="ac_del">Löschen</button><button class="btn" id="ac_inv">Neuer Einladungslink</button>' : ''}</div>
      <div class="btn-row"><button class="btn" onclick="closeModal()">Abbrechen</button><button class="btn primary" id="ac_save">${isNew ? 'Anlegen und Link erzeugen' : 'Speichern'}</button></div>
    </div>`);
  const box = $('#modalBox');
  const calc = () => {
    const gsel = $$('.ac_g', box).filter(c => c.checked).map(c => Number(c.value));
    const admin = $('#ac_admin', box).checked;
    Object.keys(AREA_SHORT).forEach(a => {
      const gl = Math.max(0, ...groups.filter(g => gsel.includes(g.id)).map(g => g.perms[a] || 0));
      const ov = $(`#ac_ov_${a}`, box).value;
      const ef = admin ? 2 : ov === '' ? gl : Number(ov);
      $(`#ac_gl_${a}`, box).innerHTML = `<span class="muted small">${LEVELS[gl]}</span>`;
      $(`#ac_ef_${a}`, box).innerHTML = levelBadge(ef);
    });
  };
  box.addEventListener('change', calc); calc();
  const collect = () => {
    const overrides = {};
    Object.keys(AREA_SHORT).forEach(a => { const v = $(`#ac_ov_${a}`, box).value; if (v !== '') overrides[a] = Number(v); });
    return {
      display_name: $('#ac_dn', box).value, username: $('#ac_un', box).value.trim(), email: $('#ac_em', box).value,
      member_id: $('#ac_mem', box).value ? Number($('#ac_mem', box).value) : null,
      groups: $$('.ac_g', box).filter(c => c.checked).map(c => Number(c.value)), overrides,
      is_admin: $('#ac_admin', box).checked, active: $('#ac_active', box).checked,
    };
  };
  $('#ac_save', box).onclick = async () => {
    try {
      if (isNew) {
        const r = await api('admin/users', 'POST', collect());
        showInvite(r.user.display_name, r.user.username, r.invite);
      } else {
        await api('admin/users/' + u.id, 'PUT', collect());
        closeModal(); toast('Gespeichert');
      }
      invalidate('members'); route();
    } catch (e) { alert(e.message); }
  };
  if (!isNew) {
    $('#ac_inv', box).onclick = async () => { const r = await api(`admin/users/${u.id}/invite`, 'POST'); showInvite(u.display_name, u.username, r.invite); };
    $('#ac_del', box).onclick = async () => {
      if (!confirmBox(`Zugang von ${u.display_name || u.username} löschen? Das Mitgliedsprofil bleibt erhalten.`)) return;
      try { await api('admin/users/' + u.id, 'DELETE'); closeModal(); toast('Zugang gelöscht'); route(); } catch (e) { alert(e.message); }
    };
  }
}

function showInvite(name, username, link) {
  const text = noDashes(`Hallo ${(name || '').split(' ')[0]}, hier ist dein Zugang zum Emden Tigers Hub 🐯\n\nBenutzername: ${username}\nPasswort festlegen: ${link}\n\nDer Link ist 14 Tage gültig.`);
  openModal(`<h2>Einladungslink</h2>
    <p>Schick diesen Link an <b>${esc(name || username)}</b>. Damit legt die Person ihr Passwort selbst fest. Der Link ist 14 Tage gültig und funktioniert nur einmal.</p>
    <textarea class="input" id="inv_txt" rows="7" style="width:100%">${esc(text)}</textarea>
    <div class="modal-foot"><div class="btn-row"><button class="btn" id="inv_link">Nur Link kopieren</button>
      <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">Per WhatsApp senden</a></div>
      <div class="btn-row"><button class="btn primary" id="inv_copy">Nachricht kopieren</button><button class="btn" onclick="closeModal()">Fertig</button></div></div>`);
  $('#inv_copy').onclick = () => copyText($('#inv_txt').value);
  $('#inv_link').onclick = () => copyText(link);
}

App.pages.accounts = async (view) => {
  const [users, groups] = await Promise.all([api('admin/users'), api('admin/groups'), load('members', true).catch(() => [])]);
  const gname = id => groups.find(g => g.id === id)?.name || '';
  const status = u => !Number(u.active) ? '<span class="badge">deaktiviert</span>' : u.invite_open ? '<span class="badge warn">Einladung offen</span>' : '<span class="badge ok">aktiv</span>';
  view.innerHTML = `
    <div class="page-head"><h1>Konten<small>${users.length} Zugänge</small></h1>
      <div class="btn-row"><a class="btn" href="#/groups">Gruppen &amp; Rechte</a><button class="btn primary" id="ac_new">+ Zugang</button></div></div>
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Benutzername</th><th>Gruppen</th><th>Rechte</th><th>Status</th><th>Zuletzt angemeldet</th><th></th></tr></thead><tbody>
    ${users.map(u => `<tr style="${Number(u.active) ? '' : 'opacity:.55'}">
      <td><b>${esc(u.display_name || u.username)}</b> ${u.is_admin ? '<span class="badge dark">Admin</span>' : ''}${u.member_id ? `<div class="muted small">Mitglied: ${esc(fullName(byId(App.cache.members, u.member_id)))}</div>` : ''}</td>
      <td class="small">${esc(u.username)}</td>
      <td>${u.groups.map(id => `<span class="badge">${esc(gname(id))}</span>`).join(' ') || '<span class="muted small">keine</span>'}${Object.keys(u.overrides).length ? ' <span class="badge warn" title="Hat Ausnahmen">Ausnahme</span>' : ''}</td>
      <td style="white-space:nowrap">${permChips(u.effective)}</td>
      <td>${status(u)}</td>
      <td class="small muted">${u.last_login ? new Date(u.last_login).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'nie'}</td>
      <td class="actions"><button class="btn sm ghost" data-e="${u.id}">Bearbeiten</button></td></tr>`).join('')}
    </tbody></table></div>
    <div class="hint" style="margin-top:10px">Neue Zugänge bekommen einen Einladungslink, mit dem sie ihr Passwort selbst festlegen. Zugänge für Mitglieder legst du am schnellsten unter Mitglieder mit „Zugang anlegen“ an.</div>`;
  $('#ac_new').onclick = () => accountDialog(null, null);
  $$('[data-e]').forEach(b => b.onclick = () => accountDialog(users.find(u => u.id == b.dataset.e)));
};

/* ====================================================================== */
/* Verwaltung: Gruppen und Rechte */
App.pages.groups = async (view) => {
  const groups = await api('admin/groups');
  view.innerHTML = `
    <div class="page-head"><h1>Gruppen &amp; Rechte<small>Was jede Gruppe in welchem Bereich darf</small></h1>
      <div class="btn-row"><a class="btn" href="#/accounts">Konten</a><button class="btn primary" id="g_new">+ Gruppe</button></div></div>
    <div class="table-wrap"><table class="perm-matrix"><thead><tr><th>Gruppe</th>${Object.values(AREA_SHORT).map(l => `<th>${l}</th>`).join('')}<th>Personen</th><th></th></tr></thead><tbody>
    ${groups.map(g => `<tr data-g="${g.id}">
      <td><input class="input g_name" value="${esc(g.name)}" style="font-weight:600"><input class="input g_desc small" value="${esc(g.description || '')}" placeholder="Beschreibung" style="margin-top:4px"></td>
      ${Object.keys(AREA_SHORT).map(a => `<td><select class="input g_lvl lvl${g.perms[a] || 0}" data-a="${a}">${LEVELS.map((t, i) => `<option value="${i}" ${(g.perms[a] || 0) === i ? 'selected' : ''}>${t}</option>`).join('')}</select></td>`).join('')}
      <td>${g.members}</td>
      <td class="actions"><button class="btn sm ghost danger" data-del="${g.id}">Löschen</button></td></tr>`).join('')}
    </tbody></table></div>
    <div class="card" style="margin-top:16px"><h2>So funktionieren die Rechte</h2>
      <div class="small" style="line-height:1.6">
        <b>Lesen</b> heißt ansehen, <b>Bearbeiten</b> heißt anlegen, ändern und löschen. Wer in mehreren Gruppen ist, bekommt pro Bereich das höchste Recht.
        Unter <a href="#/accounts">Konten</a> kannst du für einzelne Personen Ausnahmen festlegen, die das Gruppenrecht ersetzen. Admins dürfen immer alles.<br>
        <b>Medien:</b> Postplan, Social Media Spieler, Mediathek, Media Team &nbsp;|&nbsp; <b>Verein:</b> Spielplan, Kader, Gegner, Sponsoren &nbsp;|&nbsp;
        <b>Mitglieder:</b> Mitgliederliste mit Kontaktdaten &nbsp;|&nbsp; <b>Finanzen:</b> Buchungen, Supporter Karte, Sponsorenbeträge.<br>
        Spielplan, Kader, Gegner und Sponsoren (ohne Beträge) können alle sehen, die mindestens einen Bereich lesen dürfen, damit z. B. das Media Team Spiele für Posts auswählen kann.
        Sein eigenes Profil kann jeder selbst pflegen.
      </div></div>`;
  const save = async tr => {
    const perms = {}; $$('.g_lvl', tr).forEach(s => { perms[s.dataset.a] = Number(s.value); s.className = `input g_lvl lvl${s.value}`; });
    try { await api('admin/groups/' + tr.dataset.g, 'PUT', { name: $('.g_name', tr).value, description: $('.g_desc', tr).value, perms }); toast('Gespeichert'); }
    catch (e) { alert(e.message); }
  };
  $$('tr[data-g]').forEach(tr => tr.addEventListener('change', () => save(tr)));
  $$('[data-del]').forEach(b => b.onclick = async () => {
    const g = groups.find(x => x.id == b.dataset.del);
    if (!confirmBox(`Gruppe „${g.name}“ löschen?${g.members ? ` ${g.members} Personen verlieren damit die Rechte dieser Gruppe.` : ''}`)) return;
    await api('admin/groups/' + g.id, 'DELETE'); route();
  });
  $('#g_new').onclick = async () => {
    const name = prompt('Name der neuen Gruppe:'); if (!name) return;
    try { await api('admin/groups', 'POST', { name, perms: {} }); route(); } catch (e) { alert(e.message); }
  };
};

/* ---------- Start ---------- */
(async () => {
  await loadSettings();
  try { App.me = await api('me'); } catch { return; }
  renderSideFoot();
  applyPermissions();
  checkVersion();
  route();
})();
