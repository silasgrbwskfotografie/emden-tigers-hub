/* Emden Tigers Hub: Caption-Vorschläge aus den Vereinsdaten
   Die Grafiken entstehen in Canva, hier nur Text und Daten. */

function resultOf(us, them) {
  if (us === '' || them === '' || us == null || them == null) return '';
  us = Number(us); them = Number(them);
  return us > them ? 'SIEG' : us < them ? 'NIEDERLAGE' : 'UNENTSCHIEDEN';
}

function hashtags(specific = []) {
  const all = [...specific, ...(App.settings.default_hashtags || '').split(/\s+/)]
    .map(t => t.trim()).filter(Boolean).map(t => t.startsWith('#') ? t : '#' + t);
  const seen = new Set(); const out = [];
  all.forEach(t => { const k = t.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(t); } });
  return out.slice(0, 5).join(' ');
}

function joinTags(list) {
  const own = handle(App.settings.instagram).toLowerCase();
  return [...new Set(list.map(handle).filter(Boolean))].filter(h => h.toLowerCase() !== own).join(' ');
}

function buildCaption(parts) {
  return noDashes(parts.filter(p => p !== null && p !== undefined && String(p).trim() !== '').join('\n\n'));
}

/* Kontext zu einem Post aus den IDs zusammensuchen */
function postContext(vals) {
  const c = App.cache;
  const game = byId(c.games, vals.game_id);
  const opp = game ? byId(c.opponents, game.opponent_id) : null;
  const sponsor = byId(c.sponsors, vals.sponsor_id) || (game ? byId(c.sponsors, game.sponsor_id) : null);
  const player = byId(c.players, vals.player_id);
  const next = game ? (c.games || []).filter(x => x.date > game.date).sort((a, b) => a.date.localeCompare(b.date))[0] : null;
  return { game, opp, sponsor, player, next, nextOpp: next ? byId(c.opponents, next.opponent_id) : null };
}

const CAPTIONS = {
  'Gameday'({ game: g, opp, sponsor }) {
    const s = App.settings, o = opp?.name || '[Gegner]';
    const home = g ? Number(g.home) : 1;
    const loc = g?.location || (home ? s.home_location : '');
    return buildCaption([
      `🏈 Gameday am ${g?.date ? fmtDate(g.date, true) : '[Datum]'} 🐯`,
      [home ? `Heimspiel gegen ${o}` : `Auswärtsspiel bei ${o}`, g?.time ? `Kickoff ${g.time} Uhr` : '', loc].filter(Boolean).join(' | '),
      home ? `Wir freuen uns riesig auf das Duell mit ${o}. Kommt vorbei, bringt Freunde mit und macht den Platz laut! 💪`
           : `Heute geht es für uns auf die Reise zu ${o}. Drückt uns die Daumen und feuert uns an! 🔥`,
      home ? `📍 ${loc}${g?.time ? ', Kickoff ' + g.time + ' Uhr' : ''}${s.entry_fee ? ', Eintritt ' + s.entry_fee + ' €' : ''}. Wir sehen uns am Feld!`
           : 'Live-Updates vom Spiel gibt es in unserer Story.',
      joinTags([opp?.instagram, sponsor?.instagram]),
      hashtags(['#Gameday']),
    ]);
  },

  'Ergebnis'({ game: g, opp, sponsor, next, nextOpp }) {
    const s = App.settings, o = opp?.name || '[Gegner]';
    const res = g ? resultOf(g.score_us ?? '', g.score_them ?? '') : '';
    const line = res === 'SIEG' ? `Was für ein Spiel! Wir holen den Sieg gegen ${o} 💪🔥`
      : res === 'NIEDERLAGE' ? 'Heute hat es leider nicht gereicht. Wir nehmen die Lehren mit, arbeiten weiter und kommen stärker zurück 💪'
      : res ? `Ein hart umkämpftes Spiel gegen ${o} bis zur letzten Sekunde.` : '[Kurzer Spielbericht]';
    return buildCaption([
      `🏁 Endstand vom ${g?.date ? fmtDate(g.date) : '[Datum]'} 🐯`,
      res ? `${s.club_name} ${g.score_us}:${g.score_them} ${o}${g.quarters ? ' | Viertel: ' + g.quarters : ''}` : `${s.club_name} [Ergebnis] ${o}`,
      line + (g?.highlights ? '\n\n' + g.highlights : ''),
      `Danke an alle Fans, Sponsoren und Helfer für den Support! 🙌${next ? ` Weiter geht es am ${fmtDate(next.date)}${nextOpp ? ' gegen ' + nextOpp.name : ''}.` : ''}`,
      joinTags([opp?.instagram, sponsor?.instagram]),
      hashtags(['#Gameday', res === 'SIEG' ? '#Sieg' : '']),
    ]);
  },

  'Spielervorstellung'({ player: p }) {
    const s = App.settings;
    if (!p) return buildCaption(['🐯 Spieler im Fokus', '[Spieler auswählen]', hashtags(['#Spielervorstellung'])]);
    const coach = p.kind && p.kind !== 'Spieler';
    const pos = coach ? (p.role || p.kind) : [p.position, p.unit].filter(Boolean).join(' | ');
    return buildCaption([
      `🐯 ${coach ? 'Coach' : 'Spieler'} im Fokus`,
      [p.number && !coach ? '#' + p.number : '', fullName(p), pos, Number(p.rookie) ? 'Rookie' : ''].filter(Boolean).join(' | '),
      p.facts || '[Ein paar Sätze zur Person: Football-Geschichte, Rolle im Team, Typ in der Kabine]',
      coach ? null : `Du willst auch Teil des Teams werden? Komm zum Probetraining: ${s.training_text}. Schreib uns einfach per DM!`,
      joinTags([p.instagram]),
      hashtags([coach ? '#CoachingStaff' : '#Spielervorstellung']),
    ]);
  },

  'Sponsor'({ sponsor: sp }) {
    const s = App.settings, n = sp?.name || '[Sponsor]';
    return buildCaption([
      `🤝 Danke an unseren Partner ${n} 🐯`,
      `Ein großes Dankeschön an ${n} für die Unterstützung der ${s.club_name}! Ohne Partner wie euch wäre Football in Emden nicht möglich. 💪`,
      sp?.website ? `🌐 ${sp.website.replace(/^https?:\/\//, '')}` : null,
      joinTags([sp?.instagram]),
      hashtags(['#Sponsor', '#Partner']),
    ]);
  },

  'Spielplan'() {
    const s = App.settings, c = App.cache;
    const games = (c.games || []).filter(g => (g.season || '') == s.season).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const lines = games.map(g => { const o = byId(c.opponents, g.opponent_id); return `${fmtDate(g.date)} ${Number(g.home) ? '🏠 gegen' : '🚌 bei'} ${o?.name || 'TBA'}${g.time ? ', ' + g.time + ' Uhr' : ''}`; }).join('\n');
    return buildCaption([
      `📅 Spielplan ${s.season} 🐯`,
      'Die Termine stehen! Hier sind alle Spiele der Saison:',
      lines || '[Noch keine Spiele eingetragen]',
      `Kommt zu unseren Heimspielen: ${s.home_location}${s.entry_fee ? ', Eintritt ' + s.entry_fee + ' €' : ''}. Speichert euch den Post! 📌`,
      joinTags(games.map(g => byId(c.opponents, g.opponent_id)?.instagram)),
      hashtags(['#Spielplan', '#Saison' + s.season]),
    ]);
  },
};

function suggestCaption(vals) {
  const fn = CAPTIONS[vals.type];
  if (fn) return fn(postContext(vals));
  return buildCaption(['[Opener mit Emoji]', '[Kontext]', '[Haupttext]', '[CTA]', hashtags([])]);
}

/* Spiel-Infos als Text für Canva */
function gameInfoText(g) {
  const s = App.settings;
  const o = byId(App.cache.opponents, g.opponent_id);
  const home = Number(g.home);
  return [
    `${fmtDate(g.date, true)}`,
    `${home ? s.club_name + ' vs ' + (o?.name || 'TBA') : (o?.name || 'TBA') + ' vs ' + s.club_name}`,
    g.time ? `Kickoff ${g.time} Uhr` : '',
    g.location || (home ? s.home_location : ''),
    home && s.entry_fee ? `Eintritt ${s.entry_fee} €` : '',
    g.score_us !== null && g.score_us !== '' && g.score_us !== undefined ? `Endstand ${g.score_us}:${g.score_them}${g.quarters ? ' (' + g.quarters + ')' : ''}` : '',
    g.sponsor_id ? `Präsentiert von ${byId(App.cache.sponsors, g.sponsor_id)?.name || ''}` : '',
  ].filter(Boolean).join('\n');
}

/* CSV im Format für Canva "Massenerstellung" (erste Zeile = Spaltennamen) */
function downloadCsv(filename, header, rows) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header.map(q).join(','), ...rows.map(r => r.map(q).join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename; a.click();
}
