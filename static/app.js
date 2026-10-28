/* Emden Tigers Hub: Kernfunktionen (API, Router, Formulare, Hilfen) */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const App = {
  settings: {},
  cache: {},
  pages: {},
};

/* ---------- API ---------- */
async function api(path, method = 'GET', body) {
  const opt = { method, headers: { 'X-TMH': '1' } };
  if (body !== undefined) {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(body);
  }
  const r = await fetch('/api/' + path, opt);
  if (r.status === 401) { location.href = '/login'; throw new Error('Nicht angemeldet'); }
  const data = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error((data && data.error) || 'Fehler ' + r.status); e.status = r.status; throw e; }
  return data;
}

async function load(table, force = false) {
  if (!force && App.cache[table]) return App.cache[table];
  try { App.cache[table] = await api(table); }
  catch (e) { if (e.status === 403) App.cache[table] = []; else throw e; }  // kein Leserecht: leer behandeln
  return App.cache[table];
}
function invalidate(...tables) { tables.forEach(t => delete App.cache[t]); }
async function loadAll(...tables) { return Promise.all(tables.map(t => load(t))); }

const APP_VERSION = '3.3';
async function checkVersion() {
  try {
    const info = await api('');
    if (info.version !== APP_VERSION) {
      document.body.insertAdjacentHTML('afterbegin', `<div style="position:fixed;top:0;left:0;right:0;z-index:100;background:#a86400;color:#fff;padding:12px 20px;font-weight:600">
        Es läuft noch die alte Programmversion ${esc(info.version || '')}. Bitte alle schwarzen Tigers-Media-Hub-Fenster schließen
        (oder im Task-Manager alle python.exe beenden) und Start.bat neu starten.</div>`);
    }
  } catch (e) { /* ignorieren */ }
}

/* ---------- Rechte ---------- */
const PAGE_AREA = {
  posts: 'medien', social: 'medien', media: 'medien', team: 'medien', magazine: 'medien',
  games: 'verein', players: 'verein', opponents: 'verein', sponsors: 'verein',
  members: 'mitglieder', finance: 'finanzen', cards: 'finanzen',
  accounts: 'admin', groups: 'admin', settings: 'admin',
};
function can(area, lvl = 1) {
  const me = App.me; if (!me) return false;
  if (area === 'admin') return !!me.is_admin;
  return (me.perms?.[area] || 0) >= lvl;
}
function applyPermissions() {
  $$('#nav [data-area]').forEach(el => { el.style.display = can(el.dataset.area) ? '' : 'none'; });
  $$('#nav .nav-group[data-group]').forEach(g => {
    const items = $$(`#nav a[data-area="${g.dataset.group}"]`);
    g.style.display = items.some(a => a.style.display !== 'none') ? '' : 'none';
  });
  document.body.toggleAttribute('data-mw', can('medien', 2));
  document.body.toggleAttribute('data-vw', can('verein', 2));
}
function renderSideFoot() {
  const me = App.me;
  $('#sideFoot').innerHTML = `<a href="#/profile" class="me-link"><b>${esc(me.display_name || me.username)}</b><span>${me.is_admin ? 'Admin' : esc((me.groups || []).join(', ') || 'Mein Profil')}</span></a><button id="logoutBtn">Abmelden</button>`;
  $('#logoutBtn').onclick = async () => { await fetch('/auth/logout', { method: 'POST', headers: { 'X-TMH': '1' } }); location.href = '/login'; };
}

async function loadSettings() {
  App.settings = await api('settings');
  applyBranding();
}

function applyBranding() {
  const s = App.settings;
  document.documentElement.style.setProperty('--red', s.color_primary || '#B3121D');
  $('#brandName').textContent = s.club_name || 'Emden Tigers';
  const mark = $('#brandMark');
  mark.innerHTML = `<img src="${s.logo || '/static/logo.png'}" alt="Emden Tigers">`;
  $('#brandVer').textContent = 'v' + APP_VERSION;
}

async function uploadDataUrl(dataUrl, name, library = true, tags = '') {
  const res = await api('upload', 'POST', { data: dataUrl, name, library, tags });
  invalidate('media');
  return res.path;
}

function fileToDataUrl(file) {
  return new Promise((ok, err) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.onerror = err;
    fr.readAsDataURL(file);
  });
}

/* Große Fotos vor dem Speichern verkleinern (längste Seite max. 2400 px) */
async function shrinkImage(file, max = 2400) {
  const url = await fileToDataUrl(file);
  if (!/^data:image\/(jpeg|png|webp)/.test(url)) return url;
  const img = await loadImage(url);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  if (scale >= 1 && file.size < 3_000_000) return url;
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
}

async function uploadFile(file, tags = '') {
  const data = await shrinkImage(file);
  return uploadDataUrl(data, file.name, true, tags);
}

const imgCache = {};
function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (imgCache[src]) return imgCache[src];
  imgCache[src] = new Promise(ok => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = src;
  });
  return imgCache[src];
}

/* ---------- Helfer ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WD_S = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MON_S = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function parseDate(d) { if (!d) return null; const [y, m, t] = d.split('-').map(Number); return new Date(y, m - 1, t); }
function fmtDate(d, withWd = false) {
  const x = parseDate(d); if (!x) return '';
  const s = `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.${x.getFullYear()}`;
  return withWd ? `${WD[x.getDay()]}, ${s}` : s;
}
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function addDays(d, n) { const x = parseDate(d); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
function daysUntil(d) { const x = parseDate(d); if (!x) return null; const t = parseDate(todayStr()); return Math.round((x - t) / 86400000); }
function eur(n) { return (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }); }
function handle(h) { h = (h || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, ''); return h ? '@' + h : ''; }
function fullName(p) { return p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : ''; }
function byId(list, id) { return (list || []).find(x => x.id == id); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('In die Zwischenablage kopiert');
}

/* Gedankenstriche vermeiden (Wunsch: wirkt sonst nach KI) */
function noDashes(text) {
  return String(text || '')
    .replace(/\s+[–—]\s+/g, ', ')
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1:$2')
    .replace(/[–—]/g, '-');
}
function hasDashes(text) { return /[–—]/.test(text || ''); }

/* ---------- Modal & Formulare ---------- */
function openModal(html) {
  $('#modalBox').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modalBox').innerHTML = ''; }
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function confirmBox(text) { return window.confirm(text); }

/*
  Feldtypen: text, number, date, time, textarea, select, check, image, file, files, ref, url
  { key, label, type, options, ref:{table, label:fn}, full, hint, show:fn(values) }
  files: mehrere beliebige Dateien, gespeichert als JSON-Liste [{name, path, size, added}]
*/
function parseFiles(v) {
  try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}
function fmtSize(n) {
  n = Number(n) || 0;
  return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
}
const INLINE_EXT = /\.(png|jpe?g|gif|webp|pdf)$/i;
function fieldHtml(f, val) {
  const id = 'f_' + f.key;
  const v = val ?? f.default ?? '';
  const cls = 'field' + (f.full || f.type === 'textarea' ? ' full' : '');
  let input = '';
  switch (f.type) {
    case 'textarea':
      input = `<textarea id="${id}" name="${f.key}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`; break;
    case 'select':
      input = `<select id="${id}" name="${f.key}">${(f.options || []).map(o => `<option ${o == v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; break;
    case 'ref': {
      const list = App.cache[f.ref.table] || [];
      input = `<select id="${id}" name="${f.key}" data-num="1"><option value="">(keine Auswahl)</option>${list.map(o => `<option value="${o.id}" ${o.id == v ? 'selected' : ''}>${esc(f.ref.label(o))}</option>`).join('')}</select>`; break;
    }
    case 'check':
      return `<div class="${cls}" data-fkey="${f.key}"><label>&nbsp;</label><label class="check"><input type="checkbox" id="${id}" name="${f.key}" ${Number(v) ? 'checked' : ''}> ${esc(f.label)}</label>${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
    case 'file':
      input = `<div class="img-field"><a id="${id}_link" class="btn sm" target="_blank" rel="noopener" ${v ? `href="${esc(v)}"` : 'style="display:none"'}>Ansehen</a>
        <input type="hidden" id="${id}" name="${f.key}" value="${esc(v)}">
        <input type="file" id="${id}_file" accept="image/*,application/pdf" hidden>
        <div class="btn-row"><button type="button" class="btn sm" data-filepick="${f.key}">Datei wählen</button>
        <button type="button" class="btn sm ghost" data-fileclear="${f.key}">Entfernen</button></div></div>`; break;
    case 'files':
      input = `<div class="files-field" data-filesbox="${f.key}">
        <input type="hidden" id="${id}" name="${f.key}" value="${esc(JSON.stringify(parseFiles(v)))}">
        <ul class="file-list" id="${id}_list"></ul>
        <input type="file" id="${id}_file" multiple hidden>
        <div class="btn-row"><button type="button" class="btn sm" data-filesadd="${f.key}">Dateien hinzufügen</button>
        <span class="hint">oder hierher ziehen, max. 25 MB pro Datei</span></div></div>`; break;
    case 'image':
      input = `<div class="img-field"><img id="${id}_prev" ${v ? `src="${esc(v)}"` : 'style="opacity:.3"'} alt="">
        <input type="hidden" id="${id}" name="${f.key}" value="${esc(v)}">
        <div class="btn-row"><button type="button" class="btn sm" data-imgpick="${f.key}">Bild wählen</button>
        <button type="button" class="btn sm ghost" data-imgclear="${f.key}">Entfernen</button></div></div>`; break;
    default:
      input = `<input type="${f.type || 'text'}" id="${id}" name="${f.key}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.type === 'number' ? 'step="any"' : ''} ${f.list ? `list="${id}_dl"` : ''}>`
        + (f.list ? `<datalist id="${id}_dl">${f.list.map(o => `<option value="${esc(o)}">`).join('')}</datalist>` : '');
  }
  return `<div class="${cls}" data-fkey="${f.key}"><label for="${id}">${esc(f.label)}</label>${input}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
}

function readForm(root, fields) {
  const out = {};
  fields.forEach(f => {
    const el = $('#f_' + f.key, root);
    if (!el) return;
    if (f.type === 'check') out[f.key] = el.checked ? 1 : 0;
    else if (f.type === 'ref') out[f.key] = el.value ? Number(el.value) : null;
    else out[f.key] = el.value;
  });
  return out;
}

function bindFileFields(root) {
  $$('[data-filepick]', root).forEach(b => {
    const key = b.dataset.filepick, inp = $('#f_' + key + '_file', root);
    b.onclick = () => inp.click();
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      if (f.size > 25 * 1024 * 1024) return alert('Die Datei ist zu groß (max. 25 MB).');
      toast('Lade hoch ...');
      const data = f.type.startsWith('image/') ? await shrinkImage(f) : await fileToDataUrl(f);
      const path = await uploadDataUrl(data, f.name, false);
      $('#f_' + key, root).value = path;
      const l = $('#f_' + key + '_link', root); l.href = path; l.style.display = '';
      toast('Hochgeladen');
    };
  });
  $$('[data-fileclear]', root).forEach(b => b.onclick = () => {
    const key = b.dataset.fileclear;
    $('#f_' + key, root).value = ''; $('#f_' + key + '_link', root).style.display = 'none';
  });
  $$('[data-filesbox]', root).forEach(box => {
    const key = box.dataset.filesbox, hidden = $('#f_' + key, root), inp = $('#f_' + key + '_file', root);
    const draw = () => {
      const list = parseFiles(hidden.value);
      $('#f_' + key + '_list', root).innerHTML = list.map((x, i) => `<li>
        <a href="${esc(x.path)}" target="_blank" rel="noopener" ${INLINE_EXT.test(x.path) ? '' : `download="${esc(x.name)}"`}>${esc(x.name)}</a>
        <span class="muted small">${fmtSize(x.size)}${x.added ? ', ' + fmtDate(x.added) : ''}</span>
        ${hidden.disabled ? '' : `<button type="button" class="btn sm ghost" data-filesrm="${i}">Entfernen</button>`}</li>`).join('')
        || '<li class="muted small">Noch keine Dateien</li>';
      $$('[data-filesrm]', box).forEach(b => b.onclick = () => {
        const l = parseFiles(hidden.value); l.splice(Number(b.dataset.filesrm), 1);
        hidden.value = JSON.stringify(l); draw();
      });
    };
    const add = async files => {
      for (const f of files) {
        if (f.size > 25 * 1024 * 1024) { alert(`${f.name} ist zu groß (max. 25 MB).`); continue; }
        toast(`Lade ${f.name} hoch ...`);
        try {
          const path = await uploadDataUrl(await fileToDataUrl(f), f.name, false);
          const l = parseFiles(hidden.value); l.push({ name: f.name, path, size: f.size, added: todayStr() });
          hidden.value = JSON.stringify(l); draw();
        } catch (e) { alert(`${f.name} konnte nicht hochgeladen werden: ${e.message}`); }
      }
      toast('Hochgeladen. Zum Übernehmen speichern.');
    };
    $('[data-filesadd]', box).onclick = () => inp.click();
    inp.onchange = () => { add([...inp.files]); inp.value = ''; };
    box.ondragover = e => { if (hidden.disabled) return; e.preventDefault(); box.classList.add('over'); };
    box.ondragleave = () => box.classList.remove('over');
    box.ondrop = e => { e.preventDefault(); box.classList.remove('over'); if (!hidden.disabled) add([...e.dataTransfer.files]); };
    box.redraw = draw;  // nach Änderung von außen (z. B. Dateien vom Sponsor übernehmen)
    draw();
  });
}

function bindImageFields(root) {
  bindFileFields(root);
  $$('[data-imgpick]', root).forEach(b => b.onclick = async () => {
    const key = b.dataset.imgpick;
    const path = await pickImage();
    if (path) {
      const inp = $('#f_' + key, root); inp.value = path;
      const p = $('#f_' + key + '_prev', root); p.src = path; p.style.opacity = 1;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  $$('[data-imgclear]', root).forEach(b => b.onclick = () => {
    const key = b.dataset.imgclear;
    const inp = $('#f_' + key, root); inp.value = '';
    const p = $('#f_' + key + '_prev', root); p.removeAttribute('src'); p.style.opacity = .3;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/* Bildauswahl: aus Mediathek oder neu hochladen. Liefert Pfad oder null. */
function pickImage() {
  return new Promise(async resolve => {
    const media = await load('media', true);
    const layer = document.createElement('div');
    layer.className = 'modal';
    layer.style.zIndex = 70;
    layer.innerHTML = `<div class="modal-box" style="width:min(900px,100%)">
      <h2>Bild wählen</h2>
      <div class="dropzone" id="pk_drop">Bild hierher ziehen oder <button class="btn sm" id="pk_up">Datei hochladen</button>
        <input type="file" id="pk_file" accept="image/*" multiple hidden></div>
      <input class="input" id="pk_q" placeholder="Mediathek durchsuchen (Name, Tags)" style="margin-bottom:10px">
      <div class="media-grid" id="pk_grid" style="max-height:52vh;overflow:auto"></div>
      <div class="modal-foot"><span class="hint">Tipp: Spielfotos in der Mediathek mit Tags versehen, z. B. Spielname oder Spieler.</span><button class="btn" id="pk_cancel">Abbrechen</button></div>
    </div>`;
    document.body.appendChild(layer);
    const done = v => { layer.remove(); resolve(v); };
    const render = () => {
      const q = $('#pk_q', layer).value.toLowerCase();
      const items = [...media].reverse().filter(m => !q || (m.name + ' ' + (m.tags || '')).toLowerCase().includes(q));
      $('#pk_grid', layer).innerHTML = items.length ? items.map(m => `<figure data-p="${esc(m.path)}"><img loading="lazy" src="${esc(m.path)}"><figcaption>${esc(m.tags || m.name)}</figcaption></figure>`).join('') : '<div class="empty">Noch keine Bilder in der Mediathek</div>';
      $$('figure', layer).forEach(f => f.onclick = () => done(f.dataset.p));
    };
    const handleFiles = async files => {
      let last = null;
      for (const f of files) last = await uploadFile(f);
      if (last) done(last);
    };
    $('#pk_q', layer).oninput = render;
    $('#pk_cancel', layer).onclick = () => done(null);
    $('#pk_up', layer).onclick = () => $('#pk_file', layer).click();
    $('#pk_file', layer).onchange = e => handleFiles([...e.target.files]);
    const dz = $('#pk_drop', layer);
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
    dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); handleFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))); };
    layer.addEventListener('mousedown', e => { if (e.target === layer) done(null); });
    render();
  });
}

/* Generisches Bearbeiten-Formular für eine Tabelle */
async function editRecord(table, fields, record = {}, opts = {}) {
  const refs = [...new Set(fields.filter(f => f.type === 'ref').map(f => f.ref.table))];
  await loadAll(...refs);
  const isNew = !record.id;
  const ro = !!App.readOnly && !opts.allowWrite;
  openModal(`
    <h2>${esc(isNew ? (opts.newTitle || 'Neu anlegen') : (opts.editTitle || 'Bearbeiten'))}</h2>
    <form class="form" id="recForm" onsubmit="return false">${fields.map(f => fieldHtml(f, record[f.key])).join('')}</form>
    <div class="modal-foot">
      <div>${!isNew && !ro ? '<button class="btn danger" id="recDel">Löschen</button>' : ''}</div>
      <div class="btn-row"><button class="btn" id="recCancel">${ro ? 'Schließen' : 'Abbrechen'}</button>${ro ? '' : '<button class="btn primary" id="recSave">Speichern</button>'}</div>
    </div>`);
  const box = $('#modalBox');
  if (ro) { $$('input, select, textarea', $('#recForm')).forEach(el => el.disabled = true); $$('#recForm .btn').forEach(b => b.style.display = 'none'); }
  bindImageFields(box);
  const applyShow = () => {
    const vals = readForm(box, fields);
    fields.forEach(f => { if (f.show) { const el = $(`[data-fkey="${f.key}"]`, box) || $('#f_' + f.key, box)?.closest('.field'); if (el) el.style.display = f.show(vals) ? '' : 'none'; } });
  };
  box.addEventListener('change', applyShow); applyShow();
  if (opts.onOpen) opts.onOpen(box);
  return new Promise(resolve => {
    $('#recCancel').onclick = () => { closeModal(); resolve(null); };
    if (ro) return;
    $('#recSave').onclick = async () => {
      const vals = { ...(opts.fixed || {}), ...readForm(box, fields) };
      if (opts.beforeSave) opts.beforeSave(vals);
      try {
        const saved = isNew ? await api(table, 'POST', vals) : await api(`${table}/${record.id}`, 'PUT', vals);
        invalidate(table); closeModal(); toast('Gespeichert'); resolve(saved);
      } catch (e) { alert('Speichern fehlgeschlagen: ' + e.message); }
    };
    if (!isNew) $('#recDel').onclick = async () => {
      if (!confirmBox('Wirklich löschen?')) return;
      await api(`${table}/${record.id}`, 'DELETE');
      invalidate(table, 'assignments'); closeModal(); toast('Gelöscht'); resolve({ deleted: true });
    };
  });
}

/* ---------- Router ---------- */
async function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, ...args] = hash.split('/');
  const name = page || 'dashboard';
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.page === name));
  let fn = App.pages[name] || App.pages.dashboard;
  const view = $('#view');
  const area = PAGE_AREA[name];
  App.readOnly = false;
  if (area && !can(area)) {
    fn = v => { v.innerHTML = `<div class="card empty"><h2>Kein Zugriff</h2>Für diesen Bereich hast du keine Rechte. Wende dich an den Vorstand oder Admin.</div>`; };
  } else if (area && area !== 'admin' && !can(area, 2)) {
    App.readOnly = true;
  }
  document.body.toggleAttribute('data-ro', App.readOnly);
  try { await fn(view, args); }
  catch (e) { view.innerHTML = `<div class="card">Fehler: ${esc(e.message)}</div>`; console.error(e); }
  $('#main').scrollTop = 0;
}
window.addEventListener('hashchange', route);
function go(h) { if (location.hash === h) route(); else location.hash = h; }

/* Start erfolgt am Ende von pages.js */
