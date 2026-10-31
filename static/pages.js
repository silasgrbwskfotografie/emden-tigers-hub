/* Emden Tigers Hub: Seiten */

/* ---------- Feld-Definitionen ---------- */
const POSITIONS = ['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'DL', 'DE', 'LB', 'CB', 'S', 'K', 'P', 'LS', 'KR/PR', 'Athlete'];
const POST_TYPES = ['Gameday', 'Ergebnis', 'Spielervorstellung', 'Sponsor', 'Spielplan', 'Training & Behind the Scenes', 'Verein & Community', 'Saisonabschluss', 'Sonstiges'];
const POST_STATUS = ['Idee', 'In Arbeit', 'Geplant', 'Gepostet'];
const SOCIAL_TARGETS = ['Facebook', 'Instagram', 'Facebook + Instagram'];
// Zustand beim automatischen Posten (setzt nur der Server): [Text, Badge-Klasse]
const PUBLISH_STATE = { '': ['Auto: wartet', 'red'], 'läuft': ['Auto: läuft', 'warn'], gepostet: ['Auto: gepostet', 'ok'],
  teilweise: ['Auto: teilweise', 'warn'], fehler: ['Auto: Fehler', 'warn'], verpasst: ['Auto: verpasst', 'warn'] };
const publishBadge = p => Number(p.auto_publish) || p.publish_state ? `<span class="badge ${PUBLISH_STATE[p.publish_state || '']?.[1] || ''}" title="${esc(p.publish_log || '')}">${PUBLISH_STATE[p.publish_state || '']?.[0] || esc(p.publish_state)}</span>` : '';
const TEAMS = ['Herren', 'Next Generation'];   // gleiche Liste in server.py (TEAMS)
const teamOf = r => TEAMS.includes(r.team) ? r.team : 'Herren';
const teamBadge = r => teamOf(r) !== 'Herren' ? `<span class="badge red">${esc(teamOf(r))}</span>` : '';
const teamBar = (cur, attr) => TEAMS.length > 1 ? ['Alle Mannschaften', ...TEAMS].map(t => `<button class="btn sm ${t === cur ? 'dark' : ''}" ${attr}="${esc(t)}">${esc(t)}</button>`).join('') : '';
const SPONSOR_PACKAGES =['Hauptsponsor', 'Trikotsponsor', 'Spieltagssponsor', 'Supporter Karte', 'Medienturm', 'Partner', 'Förderer'];

const oppLabel = o => o.name || '';
const sponsorLabel = s => s.name || '';
const playerLabel = p => [p.number ? '#' + p.number : '', fullName(p), p.kind !== 'Spieler' ? '(' + (p.role || p.kind) + ')' : ''].filter(Boolean).join(' ');
const gameLabel = g => `${fmtDate(g.date)} ${Number(g.home) ? 'vs' : '@'} ${byId(App.cache.opponents, g.opponent_id)?.name || 'TBA'}`;

const F = {
  players: [
    { key: 'kind', label: 'Art', type: 'select', options: ['Spieler', 'Coach', 'Staff'] },
    { key: 'team', label: 'Mannschaft', type: 'select', options: TEAMS, default: 'Herren', hint: 'Spieler der Next Generation erscheinen nie auf der Webseite, nur Coaches und Staff.' },
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
    { key: 'team', label: 'Mannschaft', type: 'select', options: TEAMS, default: 'Herren' },
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
    { key: 'files', label: 'Dateien', type: 'files', full: true, hint: 'Verträge, Rechnungen, Bilder, Druckdaten. Sichtbar für alle, die Sponsoren sehen dürfen.' },
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
    { key: 'media', label: 'Bilder fürs Karussell (2 bis 10) bzw. Video fürs Reel', type: 'files', full: true, maxMb: 40,
      accept: 'image/jpeg,image/png,video/mp4,video/quicktime', show: v => ['Karussell', 'Reel'].includes(v.format),
      hint: 'Karussell: JPG oder PNG in der gewünschten Reihenfolge. Reel: ein Video als MP4 im Hochformat, höchstens 40 MB.' },
    { key: 'auto_publish', label: 'Automatisch posten (Freigabe)', type: 'check', hint: 'Geht zu Datum und Uhrzeit oben automatisch raus: Feed-Post, Story, Karussell oder Reel.' },
    { key: 'targets', label: 'Posten auf', type: 'select', options: SOCIAL_TARGETS, show: v => Number(v.auto_publish) },
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
  const [dash] = await Promise.all([api('dashboard'), loadAll('opponents', 'sponsors', 'posts', 'assignments', 'media_team', 'players', 'games'),
    load('magazines', true), load('magazine_pages', true)]);
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
  if (medien) App.cache.posts.filter(p => ['fehler', 'teilweise', 'verpasst'].includes(p.publish_state) && (p.date || '') >= addDays(todayStr(), -7))
    .forEach(p => notes.push(`Automatisch posten hat bei „${esc(p.title || p.type || 'Post')}“ nicht geklappt: ${esc(p.publish_log || p.publish_state)} <a class="btn sm" href="#/autopost">Auto-Posting</a>`));
  if (medien) dash.overdue_posts.forEach(p => notes.push(`Post „${esc(p.title || p.type)}“ war für ${fmtDate(p.date)} geplant und ist noch nicht als gepostet markiert. <a class="btn sm" href="#/posts">Postplan</a>`));
  if (mw) App.cache.sponsors.filter(sp => Number(sp.active) && Number(sp.posts_agreed)).forEach(sp => {
    const done = App.cache.posts.filter(p => p.sponsor_id == sp.id && p.status === 'Gepostet').length;
    if (done < Number(sp.posts_agreed)) notes.push(`${esc(sp.name)}: ${done} von ${sp.posts_agreed} vereinbarten Posts erledigt. <button class="pp btn sm" onclick="planPost({type:'Sponsor',sponsor_id:${sp.id}})">Planen</button>`);
  });
  if (medien) App.cache.magazines.filter(m => m.status !== 'Fertig' && m.deadline).forEach(m => {
    const d = daysUntil(m.deadline), open = magChecklist(m).filter(c => !c[1]).map(c => c[0]);
    if (d <= 14 && open.length) notes.push(`Stadionheft „${esc(magLabel(m))}“: ${d < 0 ? 'Redaktionsschluss war am' : 'Redaktionsschluss am'} ${fmtDate(m.deadline)}, noch offen: ${esc(open.join(', '))}. <a class="btn sm" href="#/magazine/${m.id}">Ansehen</a>`);
  });
  if (can('mitglieder')) {
    const reqs = (await load('contact_requests', true)).filter(r => r.status === 'Neu').length;
    if (reqs) notes.push(`${reqs} neue Anfrage${reqs > 1 ? 'n' : ''} über die Webseite. <a class="btn sm" href="#/contacts">Ansehen</a>`);
  }
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
            <div class="small muted">${esc(p.type || '')} | ${esc(p.format || 'Feed')}${p.time ? ' | ' + p.time + ' Uhr' : ''} ${publishBadge(p)}</div></div>
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
/* Auto-Posting: Verbindung zu Facebook/Instagram, Warteschlange, wiederkehrende Storys */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];   // ISO: 1 = Montag
const ruleDays = r => (r.weekdays || '').split(',').filter(Boolean).map(d => WD_S[Number(d) % 7]).join(', ');
const postWhen = p => `${p.date || ''} ${p.time || '00:00'}`;

F.story_rules = () => [
  { key: 'name', label: 'Bezeichnung', placeholder: 'z. B. Training heute', full: true },
  ...WEEKDAYS.map(n => ({ key: 'wd' + n, label: WD[n % 7], type: 'check' })),
  { key: 'time', label: 'Uhrzeit', type: 'time' },
  { key: 'targets', label: 'Posten auf', type: 'select', options: SOCIAL_TARGETS },
  { key: 'image', label: 'Story-Bild aus Canva', type: 'image', full: true, hint: 'Hochformat 1080 x 1920. Für Instagram am besten als JPG exportieren.' },
  { key: 'active', label: 'Aktiv', type: 'check', default: 1 },
  { key: 'valid_from', label: 'Gültig ab', type: 'date' },
  { key: 'valid_until', label: 'Gültig bis', type: 'date', hint: 'z. B. Saisonende oder Beginn der Winterpause' },
  { key: 'notes', label: 'Notizen', type: 'textarea', rows: 2 },
];

function editStoryRule(rec) {
  const r = { ...rec }, days = (r.weekdays || '').split(',');
  WEEKDAYS.forEach(n => { r['wd' + n] = days.includes(String(n)) ? 1 : 0; });
  return editRecord('story_rules', F.story_rules(), r, {
    newTitle: 'Neue Story-Regel', editTitle: 'Story-Regel',
    beforeSave: v => { v.weekdays = WEEKDAYS.filter(n => Number(v['wd' + n])).join(','); WEEKDAYS.forEach(n => delete v['wd' + n]); },
  });
}

const AO_TABS = [['kalender', 'Kalender'], ['online', 'Online'], ['statistik', 'Statistik'], ['einrichtung', 'Einrichtung & Storys']];
const fmtNum = n => n === null || n === undefined ? '-' : Number(n).toLocaleString('de-DE');
const fmtStamp = s => s ? new Date(s).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

function aoHead(social, tab) {
  return `<div class="page-head"><h1>Auto-Posting<small>${social.connected ? `verbunden mit ${esc(social.page)}${social.instagram ? ' und Instagram @' + esc(social.instagram) : ', ohne Instagram'}` : 'noch nicht verbunden'}</small></h1>
      <div class="btn-row"><a class="btn keep" href="#/posts">Zum Postplan</a></div></div>
    <div class="toolbar">${AO_TABS.map(([k, l]) => `<a class="btn sm ${k === tab ? 'dark' : ''}" href="#/autopost/${k}">${l}</a>`).join('')}</div>`;
}

App.pages.autopost = async (view, args) => {
  const social = await api('social');
  const tab = AO_TABS.some(t => t[0] === args[0]) ? args[0] : 'kalender';
  if (tab === 'einrichtung') return autopostSetup(view, social);
  if (tab !== 'kalender' && !social.connected) {
    view.innerHTML = `${aoHead(social, tab)}<div class="card empty">Es ist noch keine Facebook-Seite verbunden. <a href="#/autopost/einrichtung">Zur Einrichtung</a></div>`;
    return;
  }
  if (tab === 'kalender') return autopostCalendar(view, social);
  if (tab === 'online') return autopostOnline(view, social, false);
  return autopostStats(view, social, args[1] === '7' ? 7 : 28, false);
};

/* Kalender: geplante Posts aus dem Postplan und die wiederkehrenden Storys */
async function autopostCalendar(view, social) {
  await Promise.all([load('posts', true), load('story_rules', true)]);
  const month = App._aoMonth || todayStr().slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const start = (new Date(y, m - 1, 1).getDay() + 6) % 7, days = new Date(y, m, 0).getDate();
  const pad = n => String(n).padStart(2, '0');
  const cells = [...Array(start).fill(null), ...Array.from({ length: days }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  const postCls = p => p.publish_state === 'gepostet' || p.status === 'Gepostet' ? 'ok' : ['fehler', 'verpasst', 'teilweise'].includes(p.publish_state) ? 'err' : Number(p.auto_publish) ? 'auto' : 'plan';
  const rulesOn = ds => App.cache.story_rules.filter(r => Number(r.active) && (r.weekdays || '').split(',').includes(String(parseDate(ds).getDay() || 7))
    && (!r.valid_from || ds >= r.valid_from) && (!r.valid_until || ds <= r.valid_until));
  const today = todayStr();
  view.innerHTML = `${aoHead(social, 'kalender')}
    <div class="mag-sec-head"><div class="btn-row"><button class="btn sm" data-mon="-1">‹</button><h2 style="margin:0 6px;min-width:150px;text-align:center">${MON[m - 1]} ${y}</h2><button class="btn sm" data-mon="1">›</button><button class="btn sm ghost" data-mon="0">Heute</button></div>
      <button class="pp btn primary" id="cal_new">+ Post planen</button></div>
    <div class="cal-wrap"><div class="cal">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<div class="cal-h">${d}</div>`).join('')}
      ${cells.map(ds => !ds ? '<div class="cal-d empty"></div>' : `<div class="cal-d ${ds === today ? 'today' : ''} ${ds < today ? 'past' : ''}" data-day="${ds}"><span class="cal-n">${Number(ds.slice(8))}</span>
        ${App.cache.posts.filter(p => p.date === ds).sort((a, b) => (a.time || '').localeCompare(b.time || '')).map(p => `<div class="cal-item ${postCls(p)}" data-post="${p.id}" title="${esc((p.status || 'Idee') + (p.publish_log ? ' | ' + p.publish_log : ''))}">${p.time ? esc(p.time) + ' ' : ''}${p.format === 'Story' ? 'Story: ' : ''}${esc(p.title || p.type || 'Post')}</div>`).join('')}
        ${rulesOn(ds).map(r => `<div class="cal-item story" data-rule="${r.id}" title="Wiederkehrende Story, ${esc(r.targets || 'Facebook')}">${esc(r.time || '')} Story: ${esc(r.name || '')}</div>`).join('')}</div>`).join('')}</div></div>
    <div class="cal-legend small muted"><span class="cal-item auto">automatisch geplant</span><span class="cal-item plan">geplant, ohne Freigabe</span><span class="cal-item ok">gepostet</span><span class="cal-item err">nicht geklappt</span><span class="cal-item story">wiederkehrende Story</span></div>`;
  $$('[data-mon]', view).forEach(b => b.onclick = () => {
    const d = Number(b.dataset.mon), nd = new Date(y, m - 1 + d, 1);
    App._aoMonth = d ? `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}` : todayStr().slice(0, 7);
    autopostCalendar(view, social);
  });
  $('#cal_new').onclick = () => planPost({ auto_publish: 1 });
  $$('[data-post]', view).forEach(el => el.onclick = e => { e.stopPropagation(); planPost(byId(App.cache.posts, el.dataset.post)); });
  $$('[data-rule]', view).forEach(el => el.onclick = async e => { e.stopPropagation(); if (await editStoryRule(byId(App.cache.story_rules, el.dataset.rule))) route(); });
  $$('[data-day]', view).forEach(el => el.onclick = () => { if (can('medien', 2) && el.dataset.day >= today) planPost({ date: el.dataset.day, auto_publish: 1 }); });
}

/* Was ist gerade online: Beiträge und aktive Storys auf Facebook und Instagram */
async function autopostOnline(view, social, refresh) {
  view.innerHTML = `${aoHead(social, 'online')}<div class="card empty">Lade Beiträge von Meta ...</div>`;
  let d;
  try { d = await api('social/online' + (refresh ? '?refresh=1' : '')); }
  catch (e) { view.innerHTML = `${aoHead(social, 'online')}<div class="card empty">${esc(e.message)}</div>`; return; }
  const card = (p, stats) => `<a class="card on-card" href="${esc(p.url || '#')}" target="_blank" rel="noopener">
      ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="on-noimg">kein Bild</div>'}
      <div class="small muted">${fmtStamp(p.created)}${p.type ? ' | ' + esc(String(p.type).toLowerCase()) : ''}</div>
      ${p.text ? `<div class="on-text">${esc(p.text)}</div>` : ''}
      <div class="on-stats">${stats.filter(([, v]) => v !== null && v !== undefined).map(([l, v]) => `<span><b>${fmtNum(v)}</b> ${l}</span>`).join('')}</div></a>`;
  const grid = (list, stats, empty) => list.length ? `<div class="on-grid">${list.map(p => card(p, stats(p))).join('')}</div>` : `<div class="muted">${empty}</div>`;
  view.innerHTML = `${aoHead(social, 'online')}
    <div class="mag-sec-head"><span class="small muted">Stand ${fmtStamp(d.fetched_at)}. Meta liefert Zahlen teils mit Verzögerung.</span><button class="btn sm" id="ao_refresh">Aktualisieren</button></div>
    <section class="card mag-sec"><h2>Facebook: aktive Storys</h2>${grid(d.facebook_stories, () => [], 'Gerade keine aktive Story.')}</section>
    <section class="card mag-sec"><h2>Facebook: Beiträge</h2>${grid(d.facebook, p => [['Aufrufe', p.views], ['Reaktionen', p.reactions], ['Kommentare', p.comments], ['Geteilt', p.shares]], 'Keine Beiträge gefunden.')}</section>
    ${social.instagram ? `<section class="card mag-sec"><h2>Instagram: aktive Storys</h2>${grid(d.instagram_stories, p => [['Aufrufe', p.views], ['Erreicht', p.reach]], 'Gerade keine aktive Story.')}</section>
    <section class="card mag-sec"><h2>Instagram: Beiträge</h2>${grid(d.instagram, p => [['Aufrufe', p.views], ['Erreicht', p.reach], ['Likes', p.likes], ['Kommentare', p.comments]], 'Keine Beiträge gefunden.')}</section>` : ''}
    ${d.errors.length ? `<div class="card small"><b>Nicht alles konnte geladen werden</b><div class="muted">${d.errors.map(esc).join('<br>')}</div>
      <div class="muted" style="margin-top:6px">Meist fehlt im Seiten-Token eine Berechtigung (read_insights, instagram_manage_insights). Dann das Token neu erzeugen und unter Einrichtung eintragen.</div></div>` : ''}`;
  $('#ao_refresh').onclick = () => autopostOnline(view, social, true);
}

/* Säulendiagramm für einen Verlauf: eine Reihe, Tooltip beim Überfahren, Tabelle als Alternative */
function barChart(series, unit) {
  if (!series.length) return '<div class="muted small">Für diesen Zeitraum liefert Meta keinen Tagesverlauf.</div>';
  const W = 640, H = 150, max = Math.max(1, ...series.map(s => s.value)), step = W / series.length, bw = Math.max(2, step - 2);
  const bars = series.map((s, i) => {
    const h = Math.max(s.value ? 2 : 0, Math.round(s.value / max * (H - 6))), x = i * step, yy = H - h, r = Math.min(4, bw / 2, h);
    const tip = `${fmtDate(s.date)}: ${fmtNum(s.value)} ${unit}`;
    return `<g class="bar" data-tip="${esc(tip)}"><rect x="${x}" y="0" width="${step}" height="${H}" fill="transparent"/>
      ${h ? `<path d="M${x},${H} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${H} Z" fill="var(--red)"/>` : ''}</g>`;
  }).join('');
  return `<div class="chart"><div class="chart-tip" hidden></div>
    <svg viewBox="0 0 ${W} ${H + 18}" preserveAspectRatio="none" role="img" aria-label="${esc(unit)} pro Tag">
      <line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="var(--line)" stroke-width="1"/>${bars}</svg>
    <div class="chart-axis small muted"><span>${fmtDate(series[0].date)}</span><span>höchster Tag: ${fmtNum(max)}</span><span>${fmtDate(series[series.length - 1].date)}</span></div>
    <details class="small"><summary>Werte als Tabelle</summary><table>${series.map(s => `<tr><td>${fmtDate(s.date)}</td><td style="text-align:right">${fmtNum(s.value)}</td></tr>`).join('')}</table></details></div>`;
}

function bindCharts(root) {
  $$('.chart', root).forEach(c => {
    const tip = $('.chart-tip', c);
    $$('.bar', c).forEach(b => {
      b.onmouseenter = e => { tip.textContent = b.dataset.tip; tip.hidden = false; };
      b.onmousemove = e => { const r = c.getBoundingClientRect(); tip.style.left = Math.min(e.clientX - r.left + 10, r.width - 160) + 'px'; tip.style.top = (e.clientY - r.top - 30) + 'px'; };
      b.onmouseleave = () => { tip.hidden = true; };
    });
  });
}

/* Statistik: Kennzahlen der Seite und des Instagram-Kontos für 7 oder 28 Tage */
async function autopostStats(view, social, days, refresh) {
  view.innerHTML = `${aoHead(social, 'statistik')}<div class="card empty">Lade Statistik von Meta ...</div>`;
  let d;
  try { d = await api(`social/insights?days=${days}${refresh ? '&refresh=1' : ''}`); }
  catch (e) { view.innerHTML = `${aoHead(social, 'statistik')}<div class="card empty">${esc(e.message)}</div>`; return; }
  const block = (title, data, chartKey, chartUnit, igNote) => {
    if (!data) return '';
    const tiles = [['Follower', data.followers], ...data.metrics.map(m => [m.label, m.value])];
    const ch = data.metrics.find(mm => mm.key === chartKey);
    return `<section class="card mag-sec"><h2>${title}</h2>
      <div class="grid g4" style="margin-bottom:14px">${tiles.map(([l, v]) => `<div class="stat-tile"><span>${esc(l)}</span><b>${fmtNum(v)}</b></div>`).join('')}</div>
      ${ch ? `<h3 style="margin:0 0 6px">${esc(ch.label)} pro Tag</h3>${barChart(ch.series, chartUnit)}` : ''}${igNote || ''}</section>`;
  };
  view.innerHTML = `${aoHead(social, 'statistik')}
    <div class="mag-sec-head"><div class="btn-row">${[7, 28].map(n => `<a class="btn sm ${n === days ? 'dark' : ''}" href="#/autopost/statistik/${n}">Letzte ${n} Tage</a>`).join('')}</div>
      <div class="btn-row"><span class="small muted">Stand ${fmtStamp(d.fetched_at)}</span><button class="btn sm" id="ao_refresh">Aktualisieren</button></div></div>
    ${block(`Facebook: ${esc(social.page)}`, d.facebook, 'page_media_view', 'Aufrufe')}
    ${block(`Instagram: @${esc(social.instagram || '')}`, d.instagram, 'reach', 'erreichte Konten',
      days > 30 ? '' : '<div class="small muted" style="margin-top:8px">Instagram liefert Werte bis zu 48 Stunden verzögert. Follower erst ab 100 Followern.</div>')}
    ${d.errors.length ? `<div class="card small"><b>Nicht alle Kennzahlen verfügbar</b><div class="muted">${d.errors.map(esc).join('<br>')}</div>
      <div class="muted" style="margin-top:6px">Meta ändert Kennzahlen regelmäßig. Fehlt eine Berechtigung (read_insights, instagram_manage_insights), das Seiten-Token neu erzeugen.</div></div>` : ''}`;
  bindCharts(view);
  $('#ao_refresh').onclick = () => autopostStats(view, social, days, true);
}

async function autopostSetup(view, social) {
  await Promise.all([load('posts', true), load('story_rules', true)]);
  const now = `${todayStr()} ${new Date().toTimeString().slice(0, 5)}`;
  const queue = App.cache.posts.filter(p => Number(p.auto_publish) && !p.publish_state).sort((a, b) => postWhen(a).localeCompare(postWhen(b)));
  const results = App.cache.posts.filter(p => p.publish_state).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '') || b.id - a.id).slice(0, 15);
  const rules = [...App.cache.story_rules].sort((a, b) => Number(b.active) - Number(a.active) || (a.time || '').localeCompare(b.time || ''));
  const steps = `<ol class="small" style="margin:8px 0 0 18px;padding:0">
    <li>Auf <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com</a> eine App vom Typ „Business“ anlegen. Du musst Admin der Facebook-Seite sein.</li>
    <li>Im <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener">Graph API Explorer</a> die App wählen und diese Berechtigungen anhaken: pages_show_list, pages_read_engagement, pages_manage_posts, read_insights, für Instagram zusätzlich instagram_basic, instagram_content_publish und instagram_manage_insights. Dann „Generate Access Token“.</li>
    <li>Das Token im <a href="https://developers.facebook.com/tools/debug/accesstoken" target="_blank" rel="noopener">Access Token Debugger</a> verlängern („Extend Access Token“).</li>
    <li>Mit dem verlängerten Token im Explorer <code>me/accounts</code> abrufen und dort das <b>access_token eurer Seite</b> kopieren. Dieses Seiten-Token läuft nicht ab.</li>
    <li>Hier einfügen und „Verbinden“. Der Hub erkennt Seite und verknüpftes Instagram-Konto selbst.</li></ol>
    <div class="small muted" style="margin-top:6px">Instagram geht nur mit einem Business- oder Creator-Konto, das mit der Facebook-Seite verknüpft ist, und nur auf dem Server mit Domain: Instagram holt die Bilder selbst über die öffentliche Adresse ab.</div>`;

  view.innerHTML = `${aoHead(social, 'einrichtung')}
    <div class="card" style="margin-bottom:16px"><h2>Verbindung</h2>
      ${social.connected ? `<div class="check-row"><span class="dot ok"></span><span style="flex:1">Facebook-Seite <b>${esc(social.page)}</b></span></div>
        <div class="check-row"><span class="dot ${social.instagram ? 'ok' : ''}"></span><span style="flex:1">${social.instagram ? `Instagram <b>@${esc(social.instagram)}</b>` : 'Kein Instagram-Konto mit der Seite verknüpft'}</span></div>
        <div class="check-row"><span class="dot ${(social.public_url || '').startsWith('https://') ? 'ok' : ''}"></span><span style="flex:1">Öffentliche Adresse für Instagram: ${social.public_url ? esc(social.public_url) : '<span class="muted">nicht eingetragen</span>'}</span></div>`
        : '<div class="muted">Es ist noch keine Facebook-Seite verbunden. Bis dahin postet der Hub nichts.</div>'}
      ${social.is_admin ? `<details style="margin-top:12px" ${social.connected ? '' : 'open'}><summary><b>${social.connected ? 'Verbindung ändern' : 'Verbindung einrichten'}</b></summary>${steps}
        <div class="form" style="margin-top:12px">
          <div class="field full"><label for="ao_token">Seiten-Token</label><input class="input" id="ao_token" type="password" autocomplete="off" placeholder="${social.connected ? 'hinterlegt, nur zum Ändern neu eintragen' : 'EAA...'}"></div>
          <div class="field full"><label for="ao_url">Öffentliche Adresse des Hubs (für Instagram)</label><input class="input" id="ao_url" value="${esc(social.public_url || '')}" placeholder="z. B. https://hub.emdentigers.de"></div></div>
        <div class="btn-row" style="margin-top:10px"><button class="btn primary" id="ao_connect">Verbinden und prüfen</button>${social.connected ? '<button class="btn ghost" id="ao_disconnect">Verbindung trennen</button>' : ''}</div></details>`
        : social.connected ? '' : '<div class="small muted" style="margin-top:6px">Die Verbindung richtet ein Admin ein.</div>'}
    </div>
    <div class="card" style="margin-bottom:16px"><div class="mag-sec-head"><h2>Wiederkehrende Storys</h2><button class="pp btn sm primary" id="ao_rule">+ Story-Regel</button></div>
      ${rules.length ? `<div class="table-wrap" style="border:0"><table><thead><tr><th></th><th>Bezeichnung</th><th>Tage</th><th>Uhrzeit</th><th>Ziel</th><th>Zuletzt</th><th></th></tr></thead><tbody>
        ${rules.map(r => `<tr style="${Number(r.active) ? '' : 'opacity:.5'}"><td>${r.image ? `<img class="thumb" src="${esc(r.image)}">` : '<div class="thumb"></div>'}</td>
          <td><b>${esc(r.name || 'Story')}</b>${Number(r.active) ? '' : ' <span class="badge">pausiert</span>'}${r.valid_until ? `<div class="muted small">bis ${fmtDate(r.valid_until)}</div>` : ''}${r.image ? '' : '<div class="warnline">Bild fehlt</div>'}</td>
          <td>${esc(ruleDays(r)) || '<span class="warnline">kein Tag</span>'}</td><td>${esc(r.time || '')}</td><td>${esc(r.targets || 'Facebook')}</td>
          <td class="small">${esc(r.last_result || 'noch nie')}</td>
          <td class="actions"><button class="pp btn sm" data-test="${r.id}">Jetzt testen</button> <button class="btn sm ghost keep" data-rule="${r.id}">${can('medien', 2) ? 'Bearbeiten' : 'Ansehen'}</button></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="muted">Noch keine Regel. Beispiel: „Training heute“ jeden Dienstag und Donnerstag um 12:00 Uhr mit eurem Canva-Story-Bild.</div>'}
      <div class="small muted" style="margin-top:8px">Läuft der Hub zur geplanten Uhrzeit nicht, holt er die Story bis zu 3 Stunden später nach, danach fällt sie für den Tag aus.</div></div>
    <div class="grid g2">
      <div class="card"><h2>Warteschlange</h2>
        ${queue.length ? `<div class="list">${queue.map(p => `<div class="list-item">${dateBox(p.date)}<div class="grow"><b>${esc(p.title || p.type || 'Post')}</b>
          <div class="muted small">${p.time ? p.time + ' Uhr | ' : ''}${esc(p.format || 'Feed')} | ${esc(p.targets || 'Facebook')}${postWhen(p) <= now ? ' | <b>jetzt fällig</b>' : ''}</div>
          ${!p.image && (p.format === 'Story' || /instagram/i.test(p.targets)) ? '<div class="warnline">Bild fehlt</div>' : ''}</div>
          <button class="btn sm ghost keep" data-post="${p.id}">Ansehen</button></div>`).join('')}</div>`
          : '<div class="muted">Keine freigegebenen Posts. Im Postplan beim Post „Automatisch posten“ anhaken.</div>'}</div>
      <div class="card"><h2>Zuletzt</h2>
        ${results.length ? `<div class="list">${results.map(p => `<div class="list-item"><div class="grow"><b>${esc(p.title || p.type || 'Post')}</b> ${publishBadge(p)}
          <div class="muted small">${esc(p.publish_log || '')}</div></div>
          <div class="btn-row">${['fehler', 'teilweise', 'verpasst'].includes(p.publish_state) ? `<button class="pp btn sm" data-now="${p.id}">Jetzt posten</button><button class="pp btn sm ghost" data-reset="${p.id}">Neu einplanen</button>` : ''}
          <button class="btn sm ghost keep" data-post="${p.id}">Ansehen</button></div></div>`).join('')}</div>` : '<div class="muted">Noch nichts automatisch gepostet.</div>'}</div>
    </div>`;

  const run = async (body, question) => {
    if (!confirmBox(question)) return;
    toast('Wird gepostet ...');
    try { const r = await api('social/publish', 'POST', body); alert(r.log); } catch (e) { alert(e.message); }
    route();
  };
  $('#ao_rule').onclick = async () => {
    const days = WD.map((d, i) => (App.settings.training_text || '').includes(d) ? (i || 7) : 0).filter(Boolean);
    if (await editStoryRule({ name: 'Training heute', time: '12:00', targets: 'Facebook', active: 1, weekdays: days.join(',') })) route();
  };
  $$('[data-rule]', view).forEach(b => b.onclick = async () => { if (await editStoryRule(byId(rules, b.dataset.rule))) route(); });
  $$('[data-test]', view).forEach(b => b.onclick = () => run({ rule_id: Number(b.dataset.test) }, 'Diese Story jetzt sofort posten? Sie erscheint wirklich auf der Seite.'));
  $$('[data-now]', view).forEach(b => b.onclick = () => run({ post_id: Number(b.dataset.now), again: true }, 'Diesen Post jetzt sofort posten?'));
  $$('[data-reset]', view).forEach(b => b.onclick = async () => { await api('social/reset', 'POST', { post_id: Number(b.dataset.reset) }); toast('Wieder eingeplant'); route(); });
  $$('[data-post]', view).forEach(b => b.onclick = () => planPost(byId(App.cache.posts, b.dataset.post)));
  if ($('#ao_connect')) $('#ao_connect').onclick = async () => {
    try {
      const r = await api('social/connection', 'PUT', { token: $('#ao_token').value.trim(), public_url: $('#ao_url').value.trim() });
      toast(`Verbunden mit ${r.page}${r.instagram ? ' und @' + r.instagram : ''}`); route();
    } catch (e) { alert(e.message); }
  };
  if ($('#ao_disconnect')) $('#ao_disconnect').onclick = async () => {
    if (!confirmBox('Verbindung trennen? Danach postet der Hub nichts mehr automatisch.')) return;
    await api('social/connection', 'DELETE'); toast('Verbindung getrennt'); route();
  };
}

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
  let season = App._season || App.settings.season, team = App._gteam || 'Alle Mannschaften';
  const tasks = mediaTasks();
  const draw = () => {
    App._season = season; App._gteam = team;
    const list = App.cache.games.filter(g => (season === 'alle' || (g.season || '') == season) && (team === 'Alle Mannschaften' || teamOf(g) === team)).sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')));
    view.innerHTML = `
      <div class="page-head"><h1>Spielplan<small>${list.length} Spiele</small></h1>
        <div class="btn-row"><button class="btn keep" onclick="exportGamesCsv()">CSV für Canva</button><button class="vw btn primary" onclick="editGame()">+ Spiel</button></div></div>
      <div class="toolbar">${[...seasons, 'alle'].map(s => `<button class="btn sm ${s == season ? 'dark' : ''}" data-s="${esc(s)}">${s === 'alle' ? 'Alle' : 'Saison ' + esc(s)}</button>`).join('')}</div>
      <div class="toolbar">${teamBar(team, 'data-t')}</div>
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
          <td><b>${Number(g.home) ? 'vs' : '@'} ${esc(o.name || 'TBA')}</b><div class="muted small">${esc(g.kind || '')}${g.league ? ' | ' + esc(g.league) : ''}</div>${teamBadge(g)}</td>
          <td>${Number(g.home) ? '<span class="badge red">Heim</span>' : '<span class="badge">Auswärts</span>'}<div class="muted small">${esc(g.location || (Number(g.home) ? App.settings.home_location : ''))}</div></td>
          <td>${g.score_us !== null && g.score_us !== '' ? `<b>${g.score_us}:${g.score_them}</b> <span class="badge ${res === 'SIEG' ? 'ok' : res === 'NIEDERLAGE' ? '' : 'warn'}">${res.charAt(0) + res.slice(1).toLowerCase()}</span>` : '<span class="muted">offen</span>'}</td>
          <td>${sp ? esc(sp.name) : '<span class="muted">keiner</span>'}</td>
          <td><button class="pp btn sm" onclick="assignGame(${g.id})">${asg}/${tasks.length}</button></td>
          <td>${posts.length ? posts.map(p => statusBadge(p.type)).join(' ') : '<span class="muted small">keine</span>'}</td>
          <td class="actions"><button class="btn sm keep" onclick="copyGameInfo(${g.id})">Infos kopieren</button> <button class="pp btn sm" onclick="planPost({type:'Gameday',game_id:${g.id}})">Gameday</button> <button class="pp btn sm" onclick="planPost({type:'Ergebnis',game_id:${g.id}})">Endstand</button> <button class="vw btn sm ghost" onclick="editGame(${g.id})">Bearbeiten</button></td>
        </tr>`; }).join('') || '<tr><td colspan="9" class="empty">Noch keine Spiele in dieser Saison.</td></tr>'}
      </tbody></table></div>`;
    $$('[data-s]').forEach(b => b.onclick = () => { season = b.dataset.s; draw(); });
    $$('[data-t]').forEach(b => b.onclick = () => { team = b.dataset.t; draw(); });
  };
  draw();
};

/* ====================================================================== */
/* Kader */
App.pages.players = async (view) => {
  await load('players');
  let unit = App._unit || 'Alle', team = App._kteam || 'Alle Mannschaften', q = '', showInactive = false;
  const draw = () => {
    App._unit = unit; App._kteam = team;
    let list = App.cache.players.filter(p => (showInactive || Number(p.active)) && (team === 'Alle Mannschaften' || teamOf(p) === team));
    if (unit === 'Coaches & Staff') list = list.filter(p => p.kind !== 'Spieler');
    else if (unit === 'Rookies') list = list.filter(p => p.kind === 'Spieler' && Number(p.rookie));
    else if (unit !== 'Alle') list = list.filter(p => p.kind === 'Spieler' && (p.unit === unit || (unit !== 'Special Teams' && p.unit === 'Two-Way')));
    if (q) list = list.filter(p => (fullName(p) + ' ' + p.number + ' ' + p.position + ' ' + p.role).toLowerCase().includes(q));
    list.sort((a, b) => (a.kind === 'Spieler') - (b.kind === 'Spieler') || (Number(a.number) || 999) - (Number(b.number) || 999) || fullName(a).localeCompare(fullName(b)));
    const total = App.cache.players.filter(p => Number(p.active) && p.kind === 'Spieler' && (team === 'Alle Mannschaften' || teamOf(p) === team)).length;
    view.innerHTML = `
      <div class="page-head"><h1>Kader &amp; Staff<small>${total} aktive Spieler</small></h1>
        <div class="btn-row"><button class="btn keep" id="k_csv" title="Aktuelle Ansicht als CSV für Canva-Massenerstellung">CSV für Canva</button><button class="btn primary" id="k_new">+ Person</button></div></div>
      <div class="toolbar">${teamBar(team, 'data-t')}</div>
      <div class="toolbar">${['Alle', 'Offense', 'Defense', 'Special Teams', 'Rookies', 'Coaches & Staff'].map(u => `<button class="btn sm ${u === unit ? 'dark' : ''}" data-u="${u}">${u}</button>`).join('')}
        <input class="input" id="k_q" placeholder="Suchen" value="${esc(q)}" style="max-width:220px">
        <label class="check small"><input type="checkbox" id="k_in" ${showInactive ? 'checked' : ''}> inaktive zeigen</label></div>
      <div class="table-wrap"><table><thead><tr><th></th><th>#</th><th>Name</th><th>Position / Rolle</th><th>Unit</th><th>Instagram</th><th>Einwilligung</th><th></th></tr></thead><tbody>
      ${list.map(p => `<tr style="${Number(p.active) ? '' : 'opacity:.5'}">
        <td>${p.photo ? `<img class="thumb" src="${esc(p.photo)}">` : '<div class="thumb"></div>'}</td>
        <td><b>${esc(p.number || '')}</b></td>
        <td><b>${esc(fullName(p))}</b> ${p.source === 'Tabelle' ? '<span class="badge" title="Automatisch aus der Google-Tabelle angelegt">Tabelle</span>' : ''} ${Number(p.rookie) ? '<span class="badge warn">Rookie</span>' : ''} ${teamBadge(p)} ${p.kind !== 'Spieler' ? `<span class="badge dark">${esc(p.kind)}</span>` : ''}</td>
        <td>${esc(p.kind === 'Spieler' ? p.position || '' : p.role || '')}</td>
        <td>${esc(p.kind === 'Spieler' ? p.unit || '' : '')}</td>
        <td class="small">${esc(handle(p.instagram))}</td>
        <td>${Number(p.consent) ? '<span class="badge ok">ja</span>' : '<span class="badge warn">fehlt</span>'}</td>
        <td class="actions"><button class="pp btn sm" onclick="planPost({type:'Spielervorstellung',player_id:${p.id}})">Post planen</button> <button class="btn sm ghost" data-e="${p.id}">Bearbeiten</button></td>
      </tr>`).join('') || '<tr><td colspan="8" class="empty">Noch niemand eingetragen.</td></tr>'}
      </tbody></table></div>`;
    $$('[data-u]').forEach(b => b.onclick = () => { unit = b.dataset.u; draw(); });
    $$('[data-t]').forEach(b => b.onclick = () => { team = b.dataset.t; draw(); });
    $('#k_q').oninput = e => { q = e.target.value.toLowerCase(); const pos = e.target.selectionStart; draw(); const el = $('#k_q'); el.focus(); el.setSelectionRange(pos, pos); };
    $('#k_in').onchange = e => { showInactive = e.target.checked; draw(); };
    const edit = async rec => { const r = await editRecord('players', F.players, rec, { newTitle: 'Neue Person', editTitle: 'Person bearbeiten' }); if (r) { await load('players'); draw(); } };
    $('#k_new').onclick = () => edit({ kind: 'Spieler', active: 1, team: TEAMS.includes(team) ? team : 'Herren' });
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
      { label: 'Dateien', html: r => { const n = parseFiles(r.files).length; return n ? `<span class="badge">${n} ${n === 1 ? 'Datei' : 'Dateien'}</span>` : ''; } },
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

/* ====================================================================== */
/* Stadionheft: alle Infos für ein Heft an einem Ort, zum Rauskopieren nach Canva (Gestaltung bleibt in Canva) */
const MAG_STATUS = ['Planung', 'In Arbeit', 'Im Druck', 'Fertig'];
// Fragebogen „Behind the Helmet“ wie im Heft 2026
const BTH_QUESTIONS = ['Was waren deine bisherigen Vereine im Football?', 'Welche Positionen würdest du sonst spielen?', 'Wie bist du zum Football gekommen?',
  'Was fasziniert dich am Football?', 'Lieblingsmannschaft in der NFL?', 'Lieblingsspieler?', 'Was würdest du jedem raten, der mit Football anfangen möchte?'];
const MAG_REFS = ['Referee', 'Umpire', 'Linesman', 'Line Judge', 'Back Judge', 'Field Judge', 'Side Judge'];
const POS_PLURAL = { QB: 'Quarterbacks', RB: 'Runningbacks', FB: 'Fullbacks', WR: 'Wide Receiver', TE: 'Tight Ends', OL: 'Offensive Line', DL: 'Defensive Line', DE: 'Defensive Ends',
  LB: 'Linebacker', CB: 'Cornerbacks', S: 'Safeties', K: 'Kicker', P: 'Punter', LS: 'Long Snapper', 'KR/PR': 'Returner', Athlete: 'Athletes' };
// Beiträge, die im Heft angelegt werden (Tabelle magazine_pages, Spalte section). reuse: wird aus dem letzten Heft übernommen
const MAG_ITEMS = {
  'Vorwort': { title: 'Vorwort', add: 'Vorwort anlegen', single: true },
  'Behind the Helmet': { title: 'Behind the Helmet', add: 'Spieler hinzufügen' },
  'Gegner': { title: 'Gegner', add: 'Eigenen Text zum Gegner', single: true },
  'Spielbericht': { title: 'Spielberichte', add: 'Spielbericht hinzufügen' },
  'Schiedsrichter': { title: 'Schiedsrichter', add: 'Crew eintragen', single: true },
  'Fan-Info': { title: 'Fan-Info', add: 'Fan-Info hinzufügen', reuse: true },
  'Jugend': { title: 'Jugend', add: 'Jugendseite anlegen', reuse: true },
  'Rückseite': { title: 'Rückseite: Join the Tigers', add: 'Rückseite anlegen', single: true, reuse: true },
};

const magLabel = m => [m.title || 'Stadionheft', m.number, m.season].filter(Boolean).join(' ');
const magItems = (id, section) => App.cache.magazine_pages.filter(p => p.magazine_id == id && (!section || p.section === section)).sort((a, b) => a.id - b.id);
const magSponsorIds = m => { try { const a = JSON.parse(m.sponsor_ids || '[]'); return Array.isArray(a) ? a.map(Number) : []; } catch { return []; } };
const magAnswers = it => { try { return JSON.parse(it.answers || '{}') || {}; } catch { return {}; } };
const magBadge = st => `<span class="badge ${{ Fertig: 'ok', 'Im Druck': 'dark', 'In Arbeit': 'warn' }[st] || ''}">${esc(st || 'Planung')}</span>`;
const magFace = (src, alt) => src ? `<img class="mag-face" src="${esc(src)}" alt="${esc(alt || '')}">` : '<div class="mag-face"></div>';
const magPlayedResult = g => g && g.score_us !== null && g.score_us !== '' && g.score_us !== undefined;

F.magazines = () => [
  { key: 'title', label: 'Titel', default: 'Tigers Inteam' },
  { key: 'number', label: 'Ausgabe', placeholder: 'z. B. 1 von 4' },
  { key: 'season', label: 'Saison', default: App.settings.season },
  { key: 'status', label: 'Status', type: 'select', options: MAG_STATUS },
  { key: 'game_id', label: 'Heimspiel', type: 'ref', ref: { table: 'games', label: gameLabel }, hint: 'Daraus kommen Gegner und Spieltag.' },
  { key: 'deadline', label: 'Redaktionsschluss', type: 'date' },
  { key: 'print_date', label: 'Druckabgabe', type: 'date' },
  { key: 'canva_url', label: 'Canva-Link', full: true },
  { key: 'files', label: 'Dateien', type: 'files', full: true, hint: 'z. B. das fertige PDF für die Druckerei' },
  { key: 'notes', label: 'Notizen', type: 'textarea', rows: 2 },
];

function magItemFields(section) {
  const notes = { key: 'notes', label: 'Interne Notizen', type: 'textarea', rows: 2 };
  switch (section) {
    case 'Vorwort': return [
      { key: 'author', label: 'Autor', list: App.cache.players.filter(p => Number(p.active)).map(fullName) },
      { key: 'role', label: 'Funktion', placeholder: 'z. B. Social Media Manager' },
      { key: 'title', label: 'Überschrift', full: true },
      { key: 'image', label: 'Foto', type: 'image', full: true },
      { key: 'text', label: 'Text', type: 'textarea', rows: 14 }, notes];
    case 'Behind the Helmet': return [
      { key: 'player_id', label: 'Spieler', type: 'ref', ref: { table: 'players', label: playerLabel } },
      { key: 'image', label: 'Foto (leer lassen für das Foto aus Kader & Staff)', type: 'image', full: true },
      ...BTH_QUESTIONS.map((q, i) => ({ key: 'q' + i, label: q, type: 'textarea', rows: 2 })), notes];
    case 'Spielbericht': return [
      { key: 'game_id', label: 'Spiel', type: 'ref', ref: { table: 'games', label: gameLabel } },
      { key: 'title', label: 'Überschrift', full: true },
      { key: 'text', label: 'Text', type: 'textarea', rows: 12, hint: 'Leer lassen: der Hub trägt Ergebnis, Viertel und Notizen aus dem Spielplan ein.' },
      { key: 'files', label: 'Fotos', type: 'files', full: true }, notes];
    case 'Schiedsrichter': return [{ key: 'text', label: 'Crew', type: 'textarea', rows: 9 }, notes];
    default: return [
      { key: 'title', label: 'Überschrift', full: true },
      { key: 'text', label: 'Text', type: 'textarea', rows: 10 },
      { key: 'files', label: 'Bilder und Dateien', type: 'files', full: true }, notes];
  }
}

/* ---------- Texte für Canva ---------- */
function magPersonLine(p) {
  return p ? [`${p.number ? '#' + p.number + ' ' : ''}${fullName(p)}`, p.kind === 'Spieler' ? [p.position, p.unit].filter(Boolean).join(', ') : (p.role || p.kind)].filter(Boolean).join(', ') : '';
}
function magGameText(g) {
  if (!g) return '';
  const o = byId(App.cache.opponents, g.opponent_id)?.name || 'TBA', club = App.settings.club_name;
  return [fmtDate(g.date, true), Number(g.home) ? `${club} vs ${o}` : `${o} vs ${club}`,
    magPlayedResult(g) ? `Endstand ${g.score_us}:${g.score_them}${g.quarters ? ' (' + g.quarters + ')' : ''}` : '', g.highlights || ''].filter(Boolean).join('\n');
}
function magCoaches() {
  const roles = F.players.find(f => f.key === 'role').list;
  return App.cache.players.filter(p => p.kind !== 'Spieler' && Number(p.active))
    .sort((a, b) => ((roles.indexOf(a.role) + 1) || 99) - ((roles.indexOf(b.role) + 1) || 99) || fullName(a).localeCompare(fullName(b)));
}
// Kader nach Unit und Position: [{ unit, groups: [{ pos, label, players }] }]
function magRoster() {
  const ps = App.cache.players.filter(p => p.kind === 'Spieler' && Number(p.active));
  return ['Offense', 'Defense', 'Special Teams', 'Two-Way', ''].map(u => {
    const byPos = {};
    ps.filter(p => (p.unit || '') === u).forEach(p => (byPos[p.position || 'Ohne Position'] ??= []).push(p));
    const groups = Object.keys(byPos).sort((a, b) => ((POSITIONS.indexOf(a) + 1) || 99) - ((POSITIONS.indexOf(b) + 1) || 99))
      .map(pos => ({ pos, label: POS_PLURAL[pos] || pos, players: byPos[pos].sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0)) }));
    return { unit: u || 'Ohne Unit', groups };
  }).filter(u => u.groups.length);
}
const magRosterText = units => units.map(u => `${u.unit}:\n` + u.groups.map(g => `${g.label}: ` +
  g.players.map(p => `${p.number ? '#' + p.number + ' ' : ''}${fullName(p)}`).join(', ')).join('\n')).join('\n\n');
function magOpponentText(m) {
  const g = byId(App.cache.games, m.game_id), o = byId(App.cache.opponents, g?.opponent_id);
  if (!o) return '';
  const past = App.cache.games.filter(x => x.opponent_id == o.id && magPlayedResult(x)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const res = x => Number(x.score_us) > Number(x.score_them) ? 'Sieg' : Number(x.score_us) < Number(x.score_them) ? 'Niederlage' : 'Unentschieden';
  return [`Zum heutigen Heimspiel begrüßen wir ${o.name}${o.city ? ' aus ' + o.city : ''}.`, o.instagram ? 'Instagram: ' + handle(o.instagram) : '', o.notes || '',
    past.length ? '\nBisherige Duelle:\n' + past.map(x => `${fmtDate(x.date)}, ${Number(x.home) ? 'Heim' : 'Auswärts'}: ${x.score_us}:${x.score_them} (${res(x)})`).join('\n') : ''].filter(Boolean).join('\n');
}
function magItemText(it) {
  if (it.section === 'Vorwort') return [it.title || 'Vorwort', [it.author, it.role].filter(Boolean).join(', '), '', it.text].filter(x => x !== undefined && x !== null).join('\n').trim();
  if (it.section === 'Behind the Helmet') {
    const a = magAnswers(it);
    return ['Behind the Helmet', magPersonLine(byId(App.cache.players, it.player_id)), '',
      ...BTH_QUESTIONS.filter(q => (a[q] || '').trim()).map(q => `${q}\n${a[q].trim()}\n`)].join('\n').trim();
  }
  return [it.title, it.text].filter(Boolean).join('\n\n');
}
function magSponsorsText(m) {
  return App.cache.sponsors.filter(s => magSponsorIds(m).includes(s.id))
    .sort((a, b) => ((SPONSOR_PACKAGES.indexOf(a.package) + 1) || 99) - ((SPONSOR_PACKAGES.indexOf(b.package) + 1) || 99) || (a.name || '').localeCompare(b.name || ''))
    .map(s => [s.name, s.package ? '(' + s.package + ')' : '', s.website || ''].filter(Boolean).join(' ')).join('\n');
}

/* Was fehlt noch? [Bereich, erledigt, Hinweis] */
function magChecklist(m) {
  const has = s => magItems(m.id, s).length > 0, sp = magSponsorIds(m).length;
  return [
    ['Sponsoren', sp > 0, sp ? `${sp} ausgewählt` : 'noch keine ausgewählt'],
    ['Vorwort', has('Vorwort')],
    ['Gegner', !!m.game_id, m.game_id ? '' : 'kein Heimspiel zugeordnet'],
    ['Behind the Helmet', has('Behind the Helmet')],
    ['Spielberichte', has('Spielbericht')],
    ['Schiedsrichter', has('Schiedsrichter')],
    ['Fan-Info', has('Fan-Info')],
    ['Jugend', has('Jugend')],
    ['Rückseite', has('Rückseite')],
  ];
}

App.pages.magazine = async (view, args) => {
  await Promise.all([load('magazines', true), load('magazine_pages', true), loadAll('games', 'opponents', 'sponsors', 'players')]);
  if (args[0]) return magazineDetail(view, Number(args[0]));
  const mags = [...App.cache.magazines].sort((a, b) => (b.season || '').localeCompare(a.season || '') || (b.deadline || '').localeCompare(a.deadline || '') || b.id - a.id);
  view.innerHTML = `
    <div class="page-head"><h1>Stadionheft<small>${mags.length} ${mags.length === 1 ? 'Ausgabe' : 'Ausgaben'}</small></h1>
      <div class="btn-row"><button class="pp btn primary" id="mg_new">+ Neues Heft</button></div></div>
    <div class="grid g3">${mags.map(m => {
      const cl = magChecklist(m), ok = cl.filter(c => c[1]).length, g = byId(App.cache.games, m.game_id), d = daysUntil(m.deadline);
      return `<a class="card mag-card" href="#/magazine/${m.id}">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><h3 style="margin:0">${esc(magLabel(m))}</h3>${magBadge(m.status)}</div>
        <div class="muted small" style="margin:4px 0 10px">${g ? esc(gameLabel(g)) : 'Kein Heimspiel zugeordnet'}</div>
        <div class="progress"><b style="width:${Math.round(ok / cl.length * 100)}%"></b></div>
        <div class="small" style="margin-top:6px">${ok} von ${cl.length} Bereichen gefüllt${m.deadline && m.status !== 'Fertig' ? ` | Redaktionsschluss ${fmtDate(m.deadline)}${d >= 0 ? ` (in ${d} Tagen)` : ' (vorbei)'}` : ''}</div>
      </a>`;
    }).join('') || '<div class="card empty" style="grid-column:1/-1">Noch kein Stadionheft angelegt. Mit „+ Neues Heft“ geht es los.</div>'}</div>`;
  $('#mg_new').onclick = async () => {
    const r = await editRecord('magazines', F.magazines(), { title: 'Tigers Inteam', season: App.settings.season, status: 'Planung' }, { newTitle: 'Neues Stadionheft' });
    if (r?.id) go(`#/magazine/${r.id}`);
  };
};

async function magazineDetail(view, id) {
  const m = byId(App.cache.magazines, id);
  if (!m) { view.innerHTML = '<div class="card empty">Dieses Heft gibt es nicht mehr. <a href="#/magazine">Zur Übersicht</a></div>'; return; }
  const mw = can('medien', 2);
  const g = byId(App.cache.games, m.game_id);
  const prev = App.cache.magazines.filter(x => x.id !== id).sort((a, b) => (b.season || '').localeCompare(a.season || '') || b.id - a.id)[0];
  const rerender = async () => { const st = $('#main').scrollTop; await Promise.all([load('magazines', true), load('magazine_pages', true)]); await magazineDetail(view, id); $('#main').scrollTop = st; };
  const copyBtn = key => `<button class="btn sm keep" data-copy="${key}">Text kopieren</button>`;
  const texts = {};   // Bereich -> Text für „Text kopieren“

  // --- Sponsoren
  const chosen = magSponsorIds(m);
  const sponsors = [...App.cache.sponsors].filter(s => Number(s.active) || chosen.includes(s.id))
    .sort((a, b) => ((SPONSOR_PACKAGES.indexOf(a.package) + 1) || 99) - ((SPONSOR_PACKAGES.indexOf(b.package) + 1) || 99) || (a.name || '').localeCompare(b.name || ''));
  texts.sponsors = magSponsorsText(m);
  const secSponsors = `<div class="mag-sponsors">${sponsors.map(s => {
    const files = parseFiles(s.files);
    return `<label class="mag-sponsor ${chosen.includes(s.id) ? 'on' : ''}"><input type="checkbox" data-sp="${s.id}" ${chosen.includes(s.id) ? 'checked' : ''} ${mw ? '' : 'disabled'}>
      ${s.logo ? `<img class="thumb logo" src="${esc(s.logo)}">` : '<div class="thumb"></div>'}
      <span><b>${esc(s.name)}</b><span class="muted small">${esc(s.package || '')}${files.length ? ` | ${files.map(f => `<a href="${esc(f.path)}" target="_blank" rel="noopener">${esc(f.name)}</a>`).join(', ')}` : ''}</span></span></label>`;
  }).join('') || '<div class="muted">Keine aktiven Sponsoren eingetragen.</div>'}</div>
    ${mw && sponsors.length ? '<div class="btn-row" style="margin-top:10px"><button class="btn sm" id="mg_spall">Alle aktiven auswählen</button></div>' : ''}`;

  // --- Trainerteam
  const coaches = magCoaches();
  texts.coaches = coaches.length ? `Coaches ${App.settings.club_name} ${m.season || ''}`.trim() + '\n\n' + coaches.map(p => `${fullName(p)}\n${p.role || p.kind}`).join('\n\n') : '';
  const secCoaches = coaches.length ? `<div class="mag-people">${coaches.map(p => `<div class="mag-person">${magFace(p.photo, fullName(p))}<b>${esc(fullName(p))}</b><span class="muted small">${esc(p.role || p.kind)}</span>${p.photo ? '' : '<span class="warnline">Foto fehlt</span>'}</div>`).join('')}</div>`
    : '<div class="muted">Unter „Kader &amp; Staff“ sind noch keine Coaches eingetragen.</div>';

  // --- Kader nach Positionen
  const roster = magRoster();
  texts.roster = roster.length ? `${App.settings.club_name} Kader ${m.season || ''}`.trim() + '\n\n' + magRosterText(roster) : '';
  roster.forEach(u => { texts['roster_' + u.unit] = magRosterText([u]); });
  const secRoster = roster.length ? `<div class="grid g3">${roster.map(u => `<div class="mag-unit"><div class="mag-unit-head"><h3>${esc(u.unit)}</h3>${copyBtn('roster_' + u.unit)}</div>
      ${u.groups.map(gr => `<div class="mag-pos"><b>${esc(gr.label)}</b> <span class="muted small">(${gr.players.length})</span><div>${gr.players.map(p => `${p.number ? '#' + esc(p.number) + ' ' : ''}${esc(fullName(p))}`).join('<br>')}</div></div>`).join('')}</div>`).join('')}</div>`
    : '<div class="muted">Unter „Kader &amp; Staff“ sind noch keine aktiven Spieler eingetragen.</div>';

  // --- Beiträge (Vorwort, Behind the Helmet, ...)
  const itemHtml = it => {
    const pl = byId(App.cache.players, it.player_id), gm = byId(App.cache.games, it.game_id), files = parseFiles(it.files);
    const img = it.image || (it.section === 'Behind the Helmet' ? pl?.photo : '');
    const head = it.section === 'Vorwort' ? [it.author, it.role].filter(Boolean).join(', ') || 'Autor fehlt'
      : it.section === 'Behind the Helmet' ? magPersonLine(pl) || 'Spieler fehlt'
      : it.section === 'Spielbericht' ? (gm ? gameLabel(gm) : 'Spiel fehlt') : '';
    const body = it.section === 'Behind the Helmet' ? `${Object.values(magAnswers(it)).filter(a => (a || '').trim()).length} von ${BTH_QUESTIONS.length} Fragen beantwortet` : (it.text || '');
    texts['item' + it.id] = magItemText(it);
    const warn = it.section === 'Behind the Helmet' && pl && !Number(pl.consent) ? '<div class="warnline">Keine Foto-Einwilligung hinterlegt</div>' : '';
    return `<div class="mag-item">${['Vorwort', 'Behind the Helmet'].includes(it.section) ? magFace(img) : ''}
      <div class="grow"><b>${esc(it.title || head || MAG_ITEMS[it.section]?.title || '')}</b>${it.title && head ? `<div class="muted small">${esc(head)}</div>` : ''}
        ${body ? `<div class="mag-text">${esc(body)}</div>` : '<div class="muted small">Noch kein Text</div>'}${warn}
        ${files.length ? `<div class="small">${files.map(f => `<a href="${esc(f.path)}" target="_blank" rel="noopener">${esc(f.name)}</a>`).join(' | ')}</div>` : ''}</div>
      <div class="btn-row">${copyBtn('item' + it.id)}<button class="btn sm ghost keep" data-item="${it.id}">${mw ? 'Bearbeiten' : 'Ansehen'}</button></div></div>`;
  };
  const itemSection = (section, extra = '') => {
    const list = magItems(id, section), cfg = MAG_ITEMS[section];
    texts['sec_' + section] = list.map(magItemText).join('\n\n\n');
    return `${extra}${list.map(itemHtml).join('')}
      ${mw && !(cfg.single && list.length) ? `<button class="btn sm" data-add="${esc(section)}">+ ${esc(cfg.add)}</button>` : ''}
      ${!list.length && !mw && !extra ? '<div class="muted">Noch nichts eingetragen.</div>' : ''}`;
  };

  // --- Gegner automatisch aus dem Heimspiel
  texts.opponent = magOpponentText(m);
  const oppAuto = texts.opponent ? `<div class="mag-text" style="margin-bottom:10px">${esc(texts.opponent)}</div>` : '<div class="muted" style="margin-bottom:10px">Dem Heft ist noch kein Heimspiel zugeordnet (Heft bearbeiten).</div>';

  // --- Spielberichte: gespielte Spiele der Saison ohne Bericht als Vorschlag
  const reported = new Set(magItems(id, 'Spielbericht').map(i => String(i.game_id)));
  const openGames = App.cache.games.filter(x => magPlayedResult(x) && (!m.season || x.season == m.season) && !reported.has(String(x.id)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const gameHint = mw && openGames.length ? `<div class="muted small" style="margin-bottom:8px">Gespielt, aber noch ohne Bericht: ${openGames.map(x => `<a href="#" data-addgame="${x.id}">${esc(gameLabel(x))}</a>`).join(', ')}</div>` : '';

  const sections = [
    ['sponsors', 'Sponsoren', secSponsors, 'sponsors'],
    ['vorwort', 'Vorwort', itemSection('Vorwort'), 'sec_Vorwort'],
    ['coaches', 'Trainerteam', secCoaches, 'coaches'],
    ['roster', 'Kader nach Positionen', secRoster, 'roster'],
    ['bth', 'Behind the Helmet', itemSection('Behind the Helmet'), 'sec_Behind the Helmet'],
    ['opponent', 'Gegner', itemSection('Gegner', oppAuto), 'opponent'],
    ['reports', 'Spielberichte', itemSection('Spielbericht', gameHint), 'sec_Spielbericht'],
    ['refs', 'Schiedsrichter', itemSection('Schiedsrichter'), 'sec_Schiedsrichter'],
    ['fan', 'Fan-Info', itemSection('Fan-Info'), 'sec_Fan-Info'],
    ['youth', 'Jugend', itemSection('Jugend'), 'sec_Jugend'],
    ['back', 'Rückseite', itemSection('Rückseite'), 'sec_Rückseite'],
  ];
  // Eigener Text zum Gegner hängt an den automatischen an
  if (texts['sec_Gegner']) texts.opponent = [texts.opponent, texts['sec_Gegner']].filter(Boolean).join('\n\n');
  texts.all = sections.map(([, title, , key]) => texts[key] ? `===== ${title} =====\n\n${texts[key]}` : '').filter(Boolean).join('\n\n\n');

  const cl = magChecklist(m), d = daysUntil(m.deadline);
  view.innerHTML = `
    <div class="page-head"><h1>${esc(magLabel(m))}<small><a href="#/magazine">Stadionheft</a> | ${g ? esc(gameLabel(g)) : 'kein Heimspiel zugeordnet'}${m.deadline ? ` | Redaktionsschluss ${fmtDate(m.deadline)}${m.status !== 'Fertig' && d !== null ? (d >= 0 ? ` (in ${d} Tagen)` : ' (vorbei)') : ''}` : ''}</small></h1>
      <div class="btn-row">${magBadge(m.status)}
        ${m.canva_url ? `<a class="btn keep" href="${esc(m.canva_url)}" target="_blank" rel="noopener">In Canva öffnen</a>` : ''}
        <button class="btn keep" data-copy="all">Alles kopieren</button>
        ${prev ? `<button class="pp btn" id="mg_prev" title="Sponsoren, Fan-Info, Jugend und Rückseite">Aus „${esc(magLabel(prev))}“ übernehmen</button>` : ''}
        <button class="pp btn" id="mg_edit">Heft bearbeiten</button></div></div>
    <div class="card mag-check">${cl.map(([name, ok, hint]) => `<span class="mag-chip ${ok ? 'ok' : ''}" title="${esc(hint || '')}"><span class="dot ${ok ? 'ok' : 'red'}"></span>${esc(name)}</span>`).join('')}</div>
    <div class="mag-nav">${sections.map(([key, title]) => `<a href="#" data-jump="${key}">${esc(title)}</a>`).join('')}</div>
    ${sections.map(([key, title, html, copyKey]) => `<section class="card mag-sec" id="mag_${key}">
      <div class="mag-sec-head"><h2>${esc(title)}</h2>${texts[copyKey] ? copyBtn(copyKey) : ''}</div>${html}</section>`).join('')}`;

  $$('[data-copy]', view).forEach(b => b.onclick = () => copyText(noDashes(texts[b.dataset.copy] || '')));
  $$('[data-jump]', view).forEach(a => a.onclick = e => { e.preventDefault(); $('#mag_' + a.dataset.jump).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $$('[data-item]', view).forEach(b => b.onclick = async () => { if (await editMagItem(m, byId(App.cache.magazine_pages, b.dataset.item))) rerender(); });
  $$('[data-add]', view).forEach(b => b.onclick = async () => { if (await editMagItem(m, { section: b.dataset.add })) rerender(); });
  $$('[data-addgame]', view).forEach(a => a.onclick = async e => { e.preventDefault(); if (await editMagItem(m, { section: 'Spielbericht', game_id: Number(a.dataset.addgame) })) rerender(); });
  const saveSponsors = async ids => { await api(`magazines/${id}`, 'PUT', { sponsor_ids: JSON.stringify(ids) }); toast('Sponsoren gespeichert'); rerender(); };
  $$('[data-sp]', view).forEach(cb => cb.onchange = () => saveSponsors($$('[data-sp]', view).filter(c => c.checked).map(c => Number(c.dataset.sp))));
  if ($('#mg_spall')) $('#mg_spall').onclick = () => saveSponsors(App.cache.sponsors.filter(s => Number(s.active)).map(s => s.id));
  $('#mg_edit').onclick = async () => {
    const r = await editRecord('magazines', F.magazines(), m, { editTitle: 'Heft bearbeiten' });
    if (r?.deleted) { invalidate('magazine_pages'); go('#/magazine'); } else if (r) rerender();
  };
  if ($('#mg_prev')) $('#mg_prev').onclick = async () => {
    const take = Object.keys(MAG_ITEMS).filter(s => MAG_ITEMS[s].reuse && !magItems(id, s).length);
    const items = magItems(prev.id).filter(i => take.includes(i.section));
    const sp = !magSponsorIds(m).length && magSponsorIds(prev).length;
    if (!items.length && !sp) return toast('Nichts zu übernehmen');
    if (!confirmBox(`Aus „${magLabel(prev)}“ übernehmen: ${[sp ? 'Sponsorenauswahl' : '', ...new Set(items.map(i => i.section))].filter(Boolean).join(', ')}?`)) return;
    if (sp) await api(`magazines/${id}`, 'PUT', { sponsor_ids: prev.sponsor_ids });
    for (const i of items) await api('magazine_pages', 'POST', { magazine_id: id, section: i.section, title: i.title, text: i.text, files: i.files, image: i.image });
    toast('Übernommen'); rerender();
  };
}

async function editMagItem(m, rec) {
  const section = rec.section, fields = magItemFields(section), isNew = !rec.id;
  rec = { ...rec };
  if (section === 'Behind the Helmet') { const a = magAnswers(rec); BTH_QUESTIONS.forEach((q, i) => { rec['q' + i] = a[q] || ''; }); }
  if (isNew && section === 'Vorwort') rec.title = 'Vorwort';
  if (isNew && section === 'Schiedsrichter') rec.text = 'Heute für uns im Einsatz:\n' + MAG_REFS.map(r => r + ': ').join('\n');
  if (isNew && section === 'Rückseite') { const s = App.settings; rec.title = 'Join the Tigers!'; rec.text = [s.training_text ? 'Training: ' + s.training_text : '', s.club_name, s.instagram ? 'Instagram: @' + s.instagram : ''].filter(Boolean).join('\n'); }
  const name = MAG_ITEMS[section]?.title || section;
  return editRecord('magazine_pages', fields, rec, {
    newTitle: name, editTitle: name, fixed: { magazine_id: m.id, section },
    beforeSave: vals => {
      if (section === 'Behind the Helmet') {
        const a = {}; BTH_QUESTIONS.forEach((q, i) => { a[q] = vals['q' + i] || ''; delete vals['q' + i]; });
        vals.answers = JSON.stringify(a);
      }
      if (section === 'Spielbericht' && !String(vals.text || '').trim()) vals.text = magGameText(byId(App.cache.games, vals.game_id));
    },
  });
}

/* ====================================================================== */
/* Teamkleidung: Artikel mit eigenen Bestellfeldern, Bestellung über einen Link ohne Anmeldung */
const AP_TYPES = [['text', 'Text'], ['number', 'Zahl'], ['select', 'Auswahl'], ['check', 'Ja/Nein']];
const AP_PRESETS = [
  { label: 'Name', type: 'text', required: true },
  { label: 'Rückennummer', type: 'number' },
  { label: 'Größe', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'], required: true },
  { label: 'Flock (Name auf dem Rücken)', type: 'text' },
  { label: 'Telefon', type: 'text', internal: true },
];
const apKey = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const apFields = a => { try { const f = JSON.parse(a.fields || '[]'); return Array.isArray(f) ? f : []; } catch { return []; } };
const apData = o => { try { return JSON.parse(o.data || '{}') || {}; } catch { return {}; } };
const apLink = a => `${location.origin}/bestellen/${a.public_token}`;
const apOpen = a => !!Number(a.active) && (!a.deadline || todayStr() <= a.deadline);
const apOrders = id => App.cache.apparel_orders.filter(o => o.apparel_id == id).sort((x, y) => x.id - y.id);
const apQty = o => Number(o.quantity) || 1;
const apValue = (f, v) => f.type === 'check' ? (Number(v) ? 'ja' : '') : String(v ?? '');

F.apparel = [
  { key: 'name', label: 'Bezeichnung', placeholder: 'z. B. Hoodie 2027', full: true },
  { key: 'price', label: 'Preis pro Stück (€)', type: 'number' },
  { key: 'deadline', label: 'Bestellschluss', type: 'date', hint: 'An diesem Tag kann noch bestellt werden.' },
  { key: 'active', label: 'Bestellungen über den Link annehmen', type: 'check', default: 1 },
  { key: 'show_list', label: 'Bisherige Bestellungen auf der Bestellseite zeigen', type: 'check', default: 1, hint: 'Interne Felder und „bezahlt“ erscheinen dort nie.' },
  { key: 'image', label: 'Bild', type: 'image', full: true },
  { key: 'description', label: 'Beschreibung für die Bestellseite', type: 'textarea', rows: 4, placeholder: 'z. B. Material, Farbe, Lieferzeit, wie bezahlt wird' },
  { key: 'notes', label: 'Interne Notizen', type: 'textarea', rows: 2 },
];

App.pages.apparel = async (view, args) => {
  await Promise.all([load('apparel', true), load('apparel_orders', true)]);
  if (args[0]) return apparelDetail(view, Number(args[0]));
  const list = [...App.cache.apparel].sort((x, y) => Number(apOpen(y)) - Number(apOpen(x)) || y.id - x.id);
  view.innerHTML = `
    <div class="page-head"><h1>Teamkleidung<small>${list.length} Artikel</small></h1>
      <div class="btn-row"><button class="aw btn primary" id="ap_new">+ Neue Klamotte</button></div></div>
    <div class="grid g3">${list.map(a => {
      const os = apOrders(a.id), pcs = os.reduce((s, o) => s + apQty(o), 0);
      return `<a class="card mag-card ap-card" href="#/apparel/${a.id}">${a.image ? `<img src="${esc(a.image)}" alt="">` : ''}
        <div style="display:flex;justify-content:space-between;gap:8px"><h3 style="margin:0">${esc(a.name || 'Ohne Namen')}</h3>${apOpen(a) ? '<span class="badge ok">offen</span>' : '<span class="badge">geschlossen</span>'}</div>
        <div class="small muted" style="margin-top:4px">${os.length} Bestellungen, ${pcs} Stück${Number(a.price) ? ' | ' + eur(a.price) : ''}${a.deadline ? ' | Bestellschluss ' + fmtDate(a.deadline) : ''}</div></a>`;
    }).join('') || '<div class="card empty" style="grid-column:1/-1">Noch keine Teamkleidung angelegt.</div>'}</div>`;
  $('#ap_new').onclick = async () => {
    const r = await editRecord('apparel', F.apparel, { active: 1, show_list: 1 }, { newTitle: 'Neue Klamotte',
      fixed: { fields: JSON.stringify(AP_PRESETS.slice(0, 3).map(f => ({ ...f, key: apKey() }))) } });
    if (r?.id) go(`#/apparel/${r.id}`);
  };
};

async function apparelDetail(view, id) {
  const a = byId(App.cache.apparel, id);
  if (!a) { view.innerHTML = '<div class="card empty">Diesen Artikel gibt es nicht mehr. <a href="#/apparel">Zur Übersicht</a></div>'; return; }
  const aw = can(APPAREL_AREAS, 2), fields = apFields(a), orders = apOrders(id), price = Number(a.price) || 0;
  const pcs = orders.reduce((s, o) => s + apQty(o), 0), openPcs = orders.filter(o => !Number(o.paid)).reduce((s, o) => s + apQty(o), 0);
  const toBook = orders.filter(o => Number(o.paid) && !o.booked_tx), toBookPcs = toBook.reduce((s, o) => s + apQty(o), 0);
  const rerender = async () => { const st = $('#main').scrollTop; await Promise.all([load('apparel', true), load('apparel_orders', true)]); await apparelDetail(view, id); $('#main').scrollTop = st; };

  // Stückzahl pro Auswahl (z. B. Größe), nach Menge gewichtet
  const summary = fields.filter(f => f.type === 'select').map(f => {
    const cnt = {};
    orders.forEach(o => { const v = apData(o)[f.key] || 'ohne Angabe'; cnt[v] = (cnt[v] || 0) + apQty(o); });
    const keys = [...(f.options || []).filter(o => cnt[o]), ...Object.keys(cnt).filter(k => !(f.options || []).includes(k))];
    return { label: f.label, items: keys.map(k => [k, cnt[k]]) };
  });
  const pub = fields.filter(f => !f.internal);
  const supplierText = [a.name, `${pcs} Stück gesamt`, ...summary.map(s => `\n${s.label}:\n` + s.items.map(([k, n]) => `${k}: ${n}`).join('\n')),
    '\nEinzelaufstellung:', ...orders.map(o => { const d = apData(o);
      return pub.filter(f => f.type === 'check' ? Number(d[f.key]) : String(d[f.key] ?? '').trim()).map(f => f.type === 'check' ? f.label : d[f.key]).join(', ') + (apQty(o) > 1 ? ` (${apQty(o)} Stück)` : ''); })].join('\n');

  view.innerHTML = `
    <div class="page-head"><h1>${esc(a.name || 'Ohne Namen')}<small><a href="#/apparel">Teamkleidung</a> | ${apOpen(a) ? 'Bestellungen offen' : 'geschlossen'}${a.deadline ? ' | Bestellschluss ' + fmtDate(a.deadline) : ''}</small></h1>
      <div class="btn-row"><button class="btn keep" id="ap_copylink">Link kopieren</button>
        <a class="btn keep" href="${esc(apLink(a))}" target="_blank" rel="noopener">Bestellseite öffnen</a>
        <button class="aw btn" id="ap_fields">Bestellfelder</button><button class="aw btn" id="ap_edit">Bearbeiten</button></div></div>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><span>Bestellungen</span><b>${orders.length}</b></div>
      <div class="card stat"><span>Stück</span><b>${pcs}</b></div>
      ${price ? `<div class="card stat"><span>Summe</span><b>${eur(price * pcs)}</b></div>
      <div class="card stat"><span>Noch nicht bezahlt</span><b style="color:${openPcs ? 'var(--red)' : 'var(--ok)'}">${eur(price * openPcs)}</b></div>` : ''}</div>
    ${price && can('finanzen', 2) ? `<div class="card" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div><b>Finanzen</b><div class="muted small">${toBook.length ? `${toBook.length} bezahlte Bestellung${toBook.length > 1 ? 'en' : ''} (${toBookPcs} Stück, ${eur(price * toBookPcs)}) noch nicht gebucht.` : 'Alle bezahlten Bestellungen sind gebucht.'}</div></div>
      ${toBook.length ? '<button class="btn primary" id="ap_book">In die Finanzen übernehmen</button>' : '<a class="btn" href="#/finance">Zu den Buchungen</a>'}</div>` : ''}
    <div class="grid g2" style="margin-bottom:16px">
      <div class="card"><h2>Bestell-Link</h2><code class="ap-link">${esc(apLink(a))}</code>
        <div class="muted small" style="margin:8px 0">Jeder mit diesem Link kann ohne Anmeldung bestellen${Number(a.show_list) ? ' und die bisherigen Bestellungen sehen (ohne interne Felder und ohne „bezahlt“)' : ''}.
          ${apOpen(a) ? '' : '<b>Zurzeit nimmt der Link keine Bestellungen an.</b>'}</div>
        <button class="aw btn sm" id="ap_newlink">Neuen Link erzeugen</button></div>
      <div class="card"><div class="mag-sec-head"><h2>Für den Lieferanten</h2><div class="btn-row"><button class="btn sm keep" id="ap_copysum">Text kopieren</button><button class="btn sm keep" id="ap_csv">CSV</button></div></div>
        ${summary.length ? summary.map(s => `<div class="sum-row"><span>${esc(s.label)}</span><span>${s.items.map(([k, n]) => `<b>${esc(k)}</b> ${n}`).join(' &nbsp; ') || '<span class="muted">noch nichts</span>'}</span></div>`).join('')
          : '<div class="muted">Mit einem Auswahlfeld (z. B. Größe) steht hier die Stückzahl pro Größe.</div>'}</div></div>
    <div class="mag-sec-head"><h2>Bestellungen</h2><button class="aw btn primary" id="ap_add">+ Bestellung</button></div>
    <div class="table-wrap"><table><thead><tr>${fields.map(f => `<th>${esc(f.label)}${f.internal ? ' <span class="muted small">(intern)</span>' : ''}</th>`).join('')}<th>Menge</th>${price ? '<th>Summe</th>' : ''}<th>Bezahlt</th><th>Eingang</th><th></th></tr></thead><tbody>
      ${orders.map(o => { const d = apData(o); return `<tr>${fields.map(f => `<td>${esc(apValue(f, d[f.key]))}</td>`).join('')}
        <td>${apQty(o)}</td>${price ? `<td>${eur(price * apQty(o))}</td>` : ''}
        <td><input type="checkbox" data-paid="${o.id}" ${Number(o.paid) ? 'checked' : ''} ${aw && !o.booked_tx ? '' : 'disabled'}>${o.booked_tx ? ' <span class="badge ok" title="In den Finanzen gebucht">gebucht</span>' : ''}</td>
        <td class="small muted">${fmtDate((o.created || o.created_at || '').slice(0, 10))}${o.source ? ' | ' + esc(o.source) : ''}</td>
        <td class="actions"><button class="btn sm ghost keep" data-o="${o.id}">${aw ? 'Bearbeiten' : 'Ansehen'}</button></td></tr>`; }).join('')
        || `<tr><td colspan="${fields.length + (price ? 6 : 5)}" class="empty">Noch keine Bestellungen.</td></tr>`}
    </tbody></table></div>`;

  $('#ap_copylink').onclick = () => copyText(apLink(a));
  if ($('#ap_book')) $('#ap_book').onclick = async () => {
    if (!confirmBox(`Eine Einnahme über ${eur(price * toBookPcs)} für ${toBook.length} bezahlte Bestellung${toBook.length > 1 ? 'en' : ''} anlegen?`)) return;
    try { const r = await api(`apparel/${id}/book`, 'POST', {}); invalidate('transactions'); toast(`Gebucht: ${eur(r.amount)}`); rerender(); }
    catch (e) { alert(e.message); }
  };
  $('#ap_copysum').onclick = () => copyText(noDashes(supplierText));
  $('#ap_csv').onclick = () => downloadCsv(`${slug(a.name || 'teamkleidung')}-bestellungen.csv`,
    [...fields.map(f => f.label), 'Menge', 'Einzelpreis', 'Summe', 'Bezahlt', 'Eingang', 'Quelle', 'Notizen'],
    orders.map(o => { const d = apData(o); return [...fields.map(f => apValue(f, d[f.key])), apQty(o), price ? String(price).replace('.', ',') : '',
      price ? String(price * apQty(o)).replace('.', ',') : '', Number(o.paid) ? 'ja' : 'nein', fmtDate((o.created || '').slice(0, 10)), o.source || '', o.notes || '']; }));
  $('#ap_newlink').onclick = async () => {
    if (!confirmBox('Neuen Bestell-Link erzeugen? Der bisherige Link funktioniert danach nicht mehr.')) return;
    await api(`apparel/${id}/new-link`, 'POST', {}); toast('Neuer Link erzeugt'); rerender();
  };
  $('#ap_edit').onclick = async () => {
    const r = await editRecord('apparel', F.apparel, a, { editTitle: 'Klamotte bearbeiten' });
    if (r?.deleted) go('#/apparel'); else if (r) rerender();
  };
  $('#ap_fields').onclick = async () => { if (await editApparelFields(a)) rerender(); };
  $('#ap_add').onclick = async () => { if (await editApparelOrder(a, { quantity: 1 })) rerender(); };
  $$('[data-o]', view).forEach(b => b.onclick = async () => { if (await editApparelOrder(a, byId(orders, b.dataset.o))) rerender(); });
  $$('[data-paid]', view).forEach(cb => cb.onchange = async () => {
    await api(`apparel_orders/${cb.dataset.paid}`, 'PUT', { paid: cb.checked ? 1 : 0 }); toast(cb.checked ? 'Als bezahlt markiert' : 'Als offen markiert'); rerender();
  });
}

function editApparelOrder(a, rec) {
  const fields = apFields(a), d = apData(rec);
  const form = [
    ...fields.map(f => ({ key: 'd_' + f.key, label: f.label + (f.internal ? ' (intern)' : ''), type: f.type === 'text' ? 'text' : f.type,
      options: f.type === 'select' ? ['', ...(f.options || [])] : undefined })),
    { key: 'quantity', label: 'Menge', type: 'number', default: 1 },
    { key: 'paid', label: 'Bezahlt', type: 'check' },
    { key: 'notes', label: 'Interne Notizen', type: 'textarea', rows: 2 },
  ];
  const r = { ...rec };
  fields.forEach(f => { r['d_' + f.key] = d[f.key] ?? ''; });
  return editRecord('apparel_orders', form, r, {
    newTitle: 'Neue Bestellung', editTitle: 'Bestellung', fixed: { apparel_id: a.id },
    beforeSave: vals => {
      const out = {};
      fields.forEach(f => { out[f.key] = vals['d_' + f.key]; delete vals['d_' + f.key]; });
      vals.data = JSON.stringify(out);
      vals.quantity = Math.max(1, Number(vals.quantity) || 1);
      if (!rec.id) { vals.source = 'Hub'; vals.created = `${todayStr()}T${new Date().toTimeString().slice(0, 8)}`; }
    },
  });
}

/* Bestellfelder bearbeiten: Bezeichnung, Typ, Auswahlwerte, Pflicht, intern. Keys bleiben stabil, damit alte Bestellungen passen. */
function editApparelFields(a) {
  const list = apFields(a).map(f => ({ ...f, options: [...(f.options || [])] }));
  return new Promise(resolve => {
    const draw = () => {
      openModal(`<h2>Bestellfelder: ${esc(a.name || '')}</h2>
        <p class="muted small">Diese Felder füllen die Besteller über den Link aus. Interne Felder (z. B. Telefon) erscheinen nicht in der öffentlichen Liste.</p>
        <div>${list.map((f, i) => `<div class="ap-frow" data-i="${i}">
          <input class="input" data-k="label" value="${esc(f.label || '')}" placeholder="Bezeichnung, z. B. Größe">
          <select class="input" data-k="type">${AP_TYPES.map(([v, l]) => `<option value="${v}" ${f.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <input class="input" data-k="options" value="${esc(f.options.join(', '))}" placeholder="Auswahl, mit Komma getrennt" style="${f.type === 'select' ? '' : 'visibility:hidden'}">
          <label class="check"><input type="checkbox" data-k="required" ${f.required ? 'checked' : ''}> Pflicht</label>
          <label class="check"><input type="checkbox" data-k="internal" ${f.internal ? 'checked' : ''}> intern</label>
          <span class="btn-row"><button type="button" class="btn sm ghost" data-up="${i}" ${i ? '' : 'disabled'} title="nach oben">↑</button><button type="button" class="btn sm ghost" data-rm="${i}">Entfernen</button></span></div>`).join('')
          || '<div class="muted">Noch keine Felder.</div>'}</div>
        <div class="btn-row" style="margin-top:10px"><button type="button" class="btn sm" id="apf_add">+ Feld</button>
          ${AP_PRESETS.map((p, i) => list.some(f => f.label === p.label) ? '' : `<button type="button" class="btn sm ghost" data-preset="${i}">+ ${esc(p.label)}</button>`).join('')}</div>
        ${apOrders(a.id).length ? '<p class="warnline">Es gibt schon Bestellungen. Entfernte Felder bleiben dort gespeichert, werden aber nicht mehr angezeigt.</p>' : ''}
        <div class="modal-foot"><div></div><div class="btn-row"><button class="btn" id="apf_cancel">Abbrechen</button><button class="btn primary" id="apf_save">Speichern</button></div></div>`);
      const box = $('#modalBox');
      $$('.ap-frow', box).forEach(row => {
        const f = list[Number(row.dataset.i)];
        $$('[data-k]', row).forEach(el => { el.oninput = el.onchange = () => {
          const k = el.dataset.k;
          if (k === 'options') f.options = el.value.split(',').map(s => s.trim()).filter(Boolean);
          else if (el.type === 'checkbox') f[k] = el.checked;
          else f[k] = el.value;
          if (k === 'type' && el === document.activeElement) draw();
        }; });
      });
      $$('[data-up]', box).forEach(b => b.onclick = () => { const i = Number(b.dataset.up); [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(); });
      $$('[data-rm]', box).forEach(b => b.onclick = () => { list.splice(Number(b.dataset.rm), 1); draw(); });
      $$('[data-preset]', box).forEach(b => b.onclick = () => { const p = AP_PRESETS[Number(b.dataset.preset)]; list.push({ ...p, options: [...(p.options || [])], key: apKey() }); draw(); });
      $('#apf_add', box).onclick = () => { list.push({ key: apKey(), label: '', type: 'text', options: [] }); draw(); };
      $('#apf_cancel', box).onclick = () => { closeModal(); resolve(false); };
      $('#apf_save', box).onclick = async () => {
        if (list.some(f => !String(f.label || '').trim())) return alert('Bitte jedem Feld eine Bezeichnung geben.');
        if (list.some(f => f.type === 'select' && !f.options.length)) return alert('Bitte bei Auswahlfeldern die Auswahl eintragen, z. B. S, M, L.');
        const clean = list.map(f => ({ key: f.key, label: f.label.trim(), type: f.type, options: f.type === 'select' ? f.options : [], required: !!f.required, internal: !!f.internal }));
        try { await api(`apparel/${a.id}`, 'PUT', { fields: JSON.stringify(clean) }); } catch (e) { return alert('Speichern fehlgeschlagen: ' + e.message); }
        closeModal(); toast('Bestellfelder gespeichert'); resolve(true);
      };
    };
    draw();
  });
}

/* ====================================================================== */
/* Anfragen über das Kontaktformular der Webseite */
const CONTACT_STATUS = ['Neu', 'In Bearbeitung', 'Erledigt'];
F.contact_requests = [
  { key: 'status', label: 'Status', type: 'select', options: CONTACT_STATUS },
  { key: 'created', label: 'Eingang', type: 'text' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'E-Mail' },
  { key: 'phone', label: 'Telefon' },
  { key: 'source', label: 'Über' },
  { key: 'message', label: 'Nachricht', type: 'textarea', rows: 6 },
  { key: 'notes', label: 'Interne Notizen', type: 'textarea', rows: 3 },
];
App.pages.contacts = simpleList({
  table: 'contact_requests', title: 'Anfragen', fields: F.contact_requests, newTitle: 'Anfrage',
  sub: l => `${l.filter(r => r.status === 'Neu').length} neu, ${l.length} insgesamt. Kommen über das Formular auf der Webseite (Probetraining).`,
  sort: (a, b) => (CONTACT_STATUS.indexOf(a.status) - CONTACT_STATUS.indexOf(b.status)) || (b.created || '').localeCompare(a.created || ''),
  columns: [
    { label: 'Eingang', html: r => `<span class="small">${fmtStamp(r.created)}</span>` },
    { label: 'Name', html: r => `<b>${esc(r.name || '')}</b><div class="muted small">${esc((r.message || '').slice(0, 90))}${(r.message || '').length > 90 ? ' ...' : ''}</div>` },
    { label: 'Kontakt', html: r => [r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : '', r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : ''].filter(Boolean).join('<br>') },
    { label: 'Status', html: r => `<span class="badge ${r.status === 'Neu' ? 'red' : r.status === 'Erledigt' ? 'ok' : 'warn'}">${esc(r.status || 'Neu')}</span>` },
  ],
});

/* ====================================================================== */
/* Änderungsprotokoll (nur Admins) */
const TABLE_NAMES = { posts: 'Postplan', games: 'Spielplan', players: 'Kader & Staff', opponents: 'Gegner', sponsors: 'Sponsoren', media: 'Mediathek',
  media_team: 'Media Team', assignments: 'Einteilung', members: 'Mitglieder', transactions: 'Buchungen', supporter_cards: 'Supporter Karte',
  magazines: 'Stadionheft', magazine_pages: 'Stadionheft-Beitrag', apparel: 'Teamkleidung', apparel_orders: 'Bestellung', story_rules: 'Story-Regel',
  settings: 'Einstellungen', social: 'Auto-Posting', users: 'Konten', groups: 'Gruppen', backup: 'Backup', sheet_players: 'Social Media Spieler',
  contact_requests: 'Anfragen' };

App.pages.log = async (view) => {
  const rows = await api('admin/log?limit=1000');
  let q = '', tbl = '', who = '';
  const tables = [...new Set(rows.map(r => r.table_name).filter(Boolean))].sort((a, b) => (TABLE_NAMES[a] || a).localeCompare(TABLE_NAMES[b] || b));
  const users = [...new Set(rows.map(r => r.user_name).filter(Boolean))].sort();
  const details = r => {
    let d; try { d = JSON.parse(r.details || 'null'); } catch { d = null; }
    if (!d || typeof d !== 'object') return '';
    return Object.entries(d).map(([k, v]) => Array.isArray(v)
      ? `<div><b>${esc(k)}</b>: <span class="muted">${esc(v[0] || 'leer')}</span> → ${esc(v[1] || 'leer')}</div>`
      : `<div><b>${esc(k)}</b>: ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</div>`).join('');
  };
  const cls = a => a.startsWith('gelöscht') ? 'red' : a.startsWith('neu') ? 'ok' : a.startsWith('geändert') ? 'warn' : '';
  const draw = () => {
    const ql = q.toLowerCase();
    const list = rows.filter(r => (!tbl || r.table_name === tbl) && (!who || r.user_name === who)
      && (!ql || [r.label, r.action, r.user_name, r.details, TABLE_NAMES[r.table_name]].join(' ').toLowerCase().includes(ql)));
    $('#lg_rows').innerHTML = list.map(r => `<tr><td class="small" style="white-space:nowrap">${fmtStamp(r.time)}</td><td>${esc(r.user_name || '')}</td>
      <td><span class="badge ${cls(r.action || '')}">${esc(r.action || '')}</span></td><td>${esc(TABLE_NAMES[r.table_name] || r.table_name || '')}</td>
      <td>${esc(r.label || '')}${r.record_id ? ` <span class="muted small">#${r.record_id}</span>` : ''}
        ${r.details ? `<details class="small"><summary>Details</summary>${details(r)}</details>` : ''}</td></tr>`).join('')
      || '<tr><td colspan="5" class="empty">Keine Einträge.</td></tr>';
    $('#lg_count').textContent = `${list.length} von ${rows.length} Einträgen`;
  };
  view.innerHTML = `
    <div class="page-head"><h1>Protokoll<small>Wer hat wann was angelegt, geändert oder gelöscht. Einträge werden nach gut einem Jahr entfernt.</small></h1></div>
    <div class="toolbar"><input class="input" id="lg_q" placeholder="Suchen (Name, Eintrag, Inhalt)" style="max-width:280px">
      <select class="input" id="lg_t"><option value="">Alle Bereiche</option>${tables.map(t => `<option value="${esc(t)}">${esc(TABLE_NAMES[t] || t)}</option>`).join('')}</select>
      <select class="input" id="lg_u"><option value="">Alle Personen</option>${users.map(u => `<option>${esc(u)}</option>`).join('')}</select>
      <span class="muted small" id="lg_count"></span></div>
    <div class="table-wrap"><table><thead><tr><th>Zeit</th><th>Wer</th><th>Aktion</th><th>Bereich</th><th>Eintrag</th></tr></thead><tbody id="lg_rows"></tbody></table></div>`;
  $('#lg_q').oninput = e => { q = e.target.value; draw(); };
  $('#lg_t').onchange = e => { tbl = e.target.value; draw(); };
  $('#lg_u').onchange = e => { who = e.target.value; draw(); };
  draw();
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
// Texte der öffentlichen Webseite (Schlüssel site_* in den Einstellungen, siehe DEFAULT_SETTINGS in server.py)
const SITE_FIELDS = [
  { key: 'site_hero_title', label: 'Startseite: große Überschrift', hint: 'Leer lassen für den Vereinsnamen.' },
  { key: 'site_contact_email', label: 'Kontakt-E-Mail', hint: 'Steht im Footer, Anfragen aus dem Kontaktformular gehen hierhin.' },
  { key: 'site_hero_text', label: 'Startseite: Satz unter der Überschrift', type: 'textarea', rows: 2 },
  { key: 'site_about', label: 'Startseite: Wer wir sind', type: 'textarea', rows: 4 },
  { key: 'site_training_times', label: 'Herren: Trainingszeiten (eine Zeile pro Termin)', type: 'textarea', rows: 3 },
  { key: 'site_training_place', label: 'Herren: Trainingsort' },
  { key: 'site_training_address', label: 'Herren: Adresse Trainingsort' },
  { key: 'site_youth_text', label: 'Next Generation: Vorstellung Flag Football', type: 'textarea', rows: 4 },
  { key: 'site_youth_ages', label: 'Next Generation: Alter', placeholder: 'z. B. 8 bis 15 Jahre' },
  { key: 'site_youth_training_times', label: 'Next Generation: Trainingszeiten (eine Zeile pro Termin)', type: 'textarea', rows: 3 },
  { key: 'site_youth_training_place', label: 'Next Generation: Trainingsort mit Adresse' },
  { key: 'site_trial_text', label: 'Probetraining: Hinweise (mitbringen, Alter, Ausrüstung)', type: 'textarea', rows: 3 },
  { key: 'site_home_address', label: 'Adresse Heimspielort' },
  { key: 'site_gameday_text', label: 'Spieltag: Infos für Zuschauer (Parken, Essen, Kinder)', type: 'textarea', rows: 3 },
  { key: 'site_card_short', label: 'Supporter Karte: Kurztext für die Startseite', type: 'textarea', rows: 2 },
  { key: 'site_card_text', label: 'Supporter Karte: Leistungen und wo es sie gibt', type: 'textarea', rows: 3 },
  { key: 'site_sponsor_text', label: 'Sponsoren: Sponsor werden (Ansprechpartner, Möglichkeiten)', type: 'textarea', rows: 3 },
];

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
    <div class="card" style="margin-bottom:16px"><h2>Webseite</h2>
      <p class="muted small">Texte der öffentlichen Webseite. Spielplan, Kader, Coaches und Sponsoren kommen automatisch aus dem Hub. Leere Felder erscheinen auf der Seite als gelb markierter Platzhalter. Keine Gedankenstriche verwenden.</p>
      <form class="form" id="site_form" onsubmit="return false">${SITE_FIELDS.map(f => fieldHtml(f, s[f.key])).join('')}</form>
      <div class="btn-row" style="margin-top:16px"><button class="btn primary" id="site_save">Webseite speichern</button><a class="btn" href="/" target="_blank" rel="noopener">Webseite ansehen</a></div></div>
    <div class="card"><h2>Datensicherung</h2>
      <p class="muted">Der Server legt jede Nacht automatisch eine Sicherung der Datenbank an. Das Backup-ZIP enthält alle Daten und Bilder, aber keine Passwörter.</p>
      <div class="btn-row"><a class="btn dark" href="/api/backup">Backup herunterladen (ZIP)</a><a class="btn" href="/api/export" download="emden-tigers-hub-export.json">Daten als JSON</a>
        <button class="btn" id="rs_btn">Backup einspielen</button><input type="file" id="rs_file" accept=".zip,.db" hidden></div>
      <div class="hint" style="margin-top:8px">Einspielen ersetzt alle Vereinsdaten durch das Backup (z. B. aus einer älteren Version). Vorher wird automatisch eine Sicherung angelegt. Konten, Gruppen und Rechte bleiben erhalten.</div>
      <div id="bk_list" class="small muted" style="margin-top:10px"></div></div>
    <div class="card" style="margin-top:16px"><h2>Serverumzug: Komplett-Export und -Import</h2>
      <p class="muted">Für den Umzug auf einen neuen Server. Die Datei enthält <b>alles</b>: Vereinsdaten, Bilder und Videos, Konten mit Passwörtern, Gruppen und Rechte,
        Facebook-Verbindung, E-Mail-Versand und das Protokoll. Sie ist mit dem Passwort verschlüsselt, das du hier festlegst. Ohne dieses Passwort lässt sie sich nicht öffnen.</p>
      <div class="grid g2">
        <div><h3>1. Auf dem alten Server exportieren</h3>
          <div class="form"><div class="field full"><label for="mg_pw1">Passwort für die Umzugsdatei (mind. 10 Zeichen)</label><input class="input" id="mg_pw1" type="password" autocomplete="new-password"></div>
            <div class="field full"><label for="mg_pw2">Passwort wiederholen</label><input class="input" id="mg_pw2" type="password" autocomplete="new-password"></div></div>
          <div class="btn-row" style="margin-top:10px"><button class="btn dark" id="mg_export">Komplett-Export herunterladen</button></div>
          <div class="hint" style="margin-top:6px">Die Datei lässt sich einmal herunterladen. Bewahre das Passwort getrennt von der Datei auf.</div></div>
        <div><h3>2. Auf dem neuen Server importieren</h3>
          <div class="form"><div class="field full"><label for="mg_file">Umzugsdatei (.tigers)</label><input class="input" id="mg_file" type="file" accept=".tigers"></div>
            <div class="field full"><label for="mg_pw3">Passwort der Umzugsdatei</label><input class="input" id="mg_pw3" type="password" autocomplete="off"></div></div>
          <div class="btn-row" style="margin-top:10px"><button class="btn danger" id="mg_import">Alles ersetzen und importieren</button></div>
          <div class="hint" style="margin-top:6px">Ersetzt den kompletten Stand dieses Hubs, auch Konten. Vorher wird automatisch eine Sicherung angelegt. Danach meldest du dich mit den Zugangsdaten des alten Servers an.</div></div>
      </div><div id="mg_status" class="small" style="margin-top:10px"></div></div>
    <div class="card" style="margin-top:16px" id="mail_card"><h2>E-Mail-Versand für Benachrichtigungen</h2><div class="muted">Lade ...</div></div>`;
  $('#mg_export').onclick = async () => {
    const pw = $('#mg_pw1').value;
    if (pw.length < 10) return alert('Das Passwort braucht mindestens 10 Zeichen.');
    if (pw !== $('#mg_pw2').value) return alert('Die Passwörter stimmen nicht überein.');
    $('#mg_status').textContent = 'Erstelle die Umzugsdatei, das kann bei vielen Bildern etwas dauern ...';
    try {
      const r = await api('migrate/export', 'POST', { password: pw });
      $('#mg_status').textContent = `Fertig (${(r.size / 1048576).toFixed(1).replace('.', ',')} MB). Der Download startet.`;
      $('#mg_pw1').value = $('#mg_pw2').value = '';
      location.href = r.download;
    } catch (e) { $('#mg_status').textContent = ''; alert(e.message); }
  };
  $('#mg_import').onclick = async () => {
    const f = $('#mg_file').files[0], pw = $('#mg_pw3').value;
    if (!f || !pw) return alert('Bitte Umzugsdatei auswählen und Passwort eingeben.');
    if (!confirmBox(`„${f.name}“ importieren? Der komplette Stand dieses Hubs wird ersetzt, auch alle Konten.`)) return;
    $('#mg_status').textContent = 'Lade hoch und prüfe die Datei ...';
    const r = await fetch('/api/migrate/import', { method: 'POST', body: f, headers: { 'X-TMH': '1', 'Content-Type': 'application/octet-stream',
      'X-Umzug-Passwort': btoa(String.fromCharCode(...new TextEncoder().encode(pw))) } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { $('#mg_status').textContent = ''; return alert('Import fehlgeschlagen: ' + (d.error || r.status)); }
    alert(`Umzug eingespielt: Stand vom ${fmtStamp(d.created)} (Version ${d.version}), ${d.users} Konten, ${d.media} Dateien.\nBitte jetzt mit den Zugangsdaten des alten Servers anmelden.`);
    location.href = '/login';
  };
  const mailCard = async () => {
    const c = await api('notify');
    $('#mail_card').innerHTML = `<h2>E-Mail-Versand für Benachrichtigungen</h2>
      <p class="muted small">Über dieses Postfach verschickt der Hub die Benachrichtigungen, die jeder unter „Mein Profil“ auswählt. Bei Gmail ein App-Passwort verwenden.</p>
      <div class="form">
        <div class="field"><label for="ml_host">Mailserver (SMTP)</label><input class="input" id="ml_host" value="${esc(c.smtp_host || '')}" placeholder="z. B. smtp.gmail.com"></div>
        <div class="field"><label for="ml_port">Port</label><input class="input" id="ml_port" value="${esc(c.smtp_port || '')}" placeholder="587"></div>
        <div class="field"><label for="ml_sec">Verschlüsselung</label><select class="input" id="ml_sec">${[['starttls', 'STARTTLS (Port 587)'], ['ssl', 'SSL/TLS (Port 465)'], ['none', 'keine']].map(([v, l]) => `<option value="${v}" ${(c.smtp_security || 'starttls') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label for="ml_user">Benutzername</label><input class="input" id="ml_user" value="${esc(c.smtp_user || '')}" autocomplete="off"></div>
        <div class="field"><label for="ml_pw">Passwort</label><input class="input" id="ml_pw" type="password" autocomplete="new-password" placeholder="${c.password_set ? 'hinterlegt, nur zum Ändern neu eintragen' : ''}"></div>
        <div class="field"><label for="ml_from">Absender</label><input class="input" id="ml_from" value="${esc(c.smtp_from || '')}" placeholder="z. B. Emden Tigers Hub &lt;hub@verein.de&gt;"></div>
        <div class="field full"><label for="ml_url">Adresse des Hubs für Links in der Mail</label><input class="input" id="ml_url" value="${esc(c.hub_url || '')}" placeholder="z. B. https://hub.emdentigers.de"></div></div>
      ${c.last_error ? `<div class="warnline" style="margin-top:8px">Letzter Fehler beim Versand: ${esc(c.last_error)}</div>` : ''}
      <div class="btn-row" style="margin-top:12px"><button class="btn primary" id="ml_save">Speichern</button>
        <input class="input" id="ml_to" placeholder="Test an E-Mail-Adresse" style="max-width:240px"><button class="btn" id="ml_test">Test-Mail senden</button></div>`;
    $('#ml_save').onclick = async () => {
      await api('notify', 'PUT', { smtp_host: $('#ml_host').value, smtp_port: $('#ml_port').value, smtp_security: $('#ml_sec').value,
        smtp_user: $('#ml_user').value, smtp_password: $('#ml_pw').value, smtp_from: $('#ml_from').value, hub_url: $('#ml_url').value });
      toast('E-Mail-Versand gespeichert'); mailCard();
    };
    $('#ml_test').onclick = async () => {
      try { await api('notify/test', 'POST', { to: $('#ml_to').value }); toast('Test-Mail verschickt'); } catch (e) { alert(e.message); }
    };
  };
  mailCard().catch(() => {});
  $$('input[name="color_primary"]').forEach(i => i.type = 'color');
  bindImageFields($('#st_form'));
  $('#st_save').onclick = async () => {
    App.settings = await api('settings', 'PUT', readForm($('#st_form'), fields));
    applyBranding(); toast('Einstellungen gespeichert');
  };
  $('#site_save').onclick = async () => {
    const vals = readForm($('#site_form'), SITE_FIELDS);
    if (Object.values(vals).some(hasDashes) && !confirmBox('In den Texten stehen Gedankenstriche. Trotzdem speichern?')) return;
    App.settings = await api('settings', 'PUT', vals); toast('Webseite gespeichert');
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
  const social = await api('social').catch(() => ({}));
  const r = { status: 'Idee', format: 'Feed', time: '18:00', targets: 'Facebook', ...rec };
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
        const f = readForm(box, F.posts);
        if (Number(f.auto_publish) && !['gepostet', 'läuft'].includes(rec.publish_state)) {
          if (!social.connected) w.push('Automatisch posten: Es ist noch keine Facebook-Seite verbunden (Auto-Posting).');
          if (!f.date || !f.time) w.push('Automatisch posten: Datum und Uhrzeit fehlen.');
          else if (new Date(`${f.date}T${f.time}`) < new Date(Date.now() - 24 * 3600 * 1000)) w.push('Automatisch posten: Der Zeitpunkt liegt mehr als 24 Stunden zurück, der Post wird nicht mehr automatisch gepostet.');
          else if (new Date(`${f.date}T${f.time}`) < new Date()) w.push('Automatisch posten: Der Zeitpunkt liegt in der Vergangenheit, der Post geht nach dem Speichern innerhalb einer Minute raus.');
          const media = parseFiles(f.media), ext = m => (m.path.split('.').pop() || '').toLowerCase();
          if (f.format === 'Karussell' && (media.length < 2 || media.length > 10 || media.some(m => !['jpg', 'jpeg', 'png', 'webp'].includes(ext(m)))))
            w.push('Automatisch posten: Ein Karussell braucht 2 bis 10 Bilder (JPG oder PNG).');
          if (f.format === 'Reel' && (media.length !== 1 || !['mp4', 'mov'].includes(ext(media[0]))))
            w.push('Automatisch posten: Ein Reel braucht genau ein Video (MP4 oder MOV).');
          if (!f.image && (f.format === 'Story' || (f.format === 'Feed' && /instagram/i.test(f.targets)))) w.push('Automatisch posten: Für Storys und Instagram wird ein Bild gebraucht.');
          if (/instagram/i.test(f.targets) && social.connected && !social.instagram) w.push('Automatisch posten: Mit der Facebook-Seite ist kein Instagram-Konto verknüpft.');        }
        $('#pp_warn', box).innerHTML = w.map(x => `<div class="warnline">⚠ ${x}</div>`).join('');
        const fx = $('#pp_fix', box); if (fx) fx.onclick = () => { cap.value = noDashes(cap.value); check(); };
      };
      $('#pp_sug', box).onclick = () => {
        if (cap.value.trim() && !confirmBox('Aktuelle Caption durch einen Vorschlag ersetzen?')) return;
        cap.value = suggestCaption(readForm(box, F.posts)); check();
      };
      $('#pp_copy', box).onclick = () => copyText(cap.value);
      if (rec.publish_state || rec.publish_log) {
        $('[data-fkey="auto_publish"]', box).insertAdjacentHTML('beforebegin', `<div class="field full"><label>Automatisch posten</label>
          <div>${publishBadge(rec)} <span class="small muted">${esc(rec.publish_log || '')}</span></div></div>`);
      }
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
          <div class="field full"><label for="pf_acc_email">E-Mail-Adresse</label><input class="input" id="pf_acc_email" type="email" value="${esc(prof.account.email || m?.email || '')}" placeholder="name@beispiel.de">
            <div class="hint">Für „Passwort vergessen“ bei der Anmeldung und für Benachrichtigungen.</div></div>
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
    </div>
    ${prof.notify_kinds.length ? `<div class="card" style="margin-top:16px"><h2>Benachrichtigungen per E-Mail</h2>
      ${prof.mail_ready ? '' : '<div class="warnline" style="margin-bottom:8px">Der E-Mail-Versand ist noch nicht eingerichtet (Admin: Einstellungen). Deine Auswahl gilt, sobald er läuft.</div>'}
      <p class="muted small">Die Mails gehen an die E-Mail-Adresse oben bei „Konto“.</p>
      <div class="form">
        ${prof.notify_kinds.map(k => `<div class="field full"><label class="check"><input type="checkbox" data-nf="${k.key}" ${(() => { try { return JSON.parse(prof.account.notify || '[]'); } catch { return []; } })().includes(k.key) ? 'checked' : ''}> ${esc(k.label)}</label></div>`).join('')}</div>
      <div class="btn-row" style="margin-top:10px"><button class="btn" id="nf_save">Benachrichtigungen speichern</button></div></div>` : ''}`;
  if ($('#nf_save')) $('#nf_save').onclick = async () => {
    try {
      if (!$('#pf_acc_email').value.trim() && $$('[data-nf]').some(c => c.checked)) return alert('Bitte oben bei „Konto“ zuerst eine E-Mail-Adresse eintragen und speichern.');
      await api('profile', 'PUT', { account_email: $('#pf_acc_email').value.trim(), notify: $$('[data-nf]').filter(c => c.checked).map(c => c.dataset.nf) });
      toast('Benachrichtigungen gespeichert');
    } catch (e) { alert(e.message); }
  };
  $('#pf_dn_save').onclick = async () => {
    try { await api('profile', 'PUT', { display_name: $('#pf_dn').value, account_email: $('#pf_acc_email').value.trim() }); }
    catch (e) { return alert(e.message); }
    App.me = await api('me'); renderSideFoot(); toast('Gespeichert');
  };
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
