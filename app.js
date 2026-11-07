'use strict';

/* ---------- Archivio locale ---------- */
const APP_VERSION = '1.2.1';      // aggiornata da scripts/release.sh
const KEY = 'biblioteca.v1';      // chiave dei dati: NON cambiarla mai (la compatibilità passa dalle migrazioni)
const META_KEY = 'biblioteca.meta';
let books = [];

/* Migrazioni dello schema dati.
   Regola di compatibilità: i campi esistenti non si rinominano né si eliminano; i nuovi campi si aggiungono
   con un valore predefinito. Per ogni modifica di struttura si aumenta SCHEMA e si aggiunge qui una funzione. */
const SCHEMA = 1;
const MIGRATIONS = {
  // 2: (list) => list.map(b => ({ ...b, nuovoCampo: '' })),
};
function migrate(list, from) {
  for (let v = from + 1; v <= SCHEMA; v++) if (MIGRATIONS[v]) list = MIGRATIONS[v](list);
  return list;
}
/* Impostazioni del dispositivo (non fanno parte dei dati dei libri né dei backup) */
const SETTINGS_KEY = 'biblioteca.settings';
function readSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; }
}
function writeSettings(patch) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(Object.assign(readSettings(), patch))); } catch (e) {}
}
const gKey = () => { const k = (readSettings().googleKey || '').trim(); return k ? '&key=' + encodeURIComponent(k) : ''; };

function readMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) { return {}; }
}

function load() {
  try { books = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { books = []; }
  const from = readMeta().schema || 1;
  if (from > SCHEMA) {
    // dati scritti da una versione più recente: li lascio intatti e non sovrascrivo nulla
    readOnlyData = true;
    return;
  }
  if (from < SCHEMA) {
    // copia di sicurezza prima di migrare
    try { localStorage.setItem(KEY + '.backup-schema' + from, localStorage.getItem(KEY) || '[]'); } catch (e) {}
    books = migrate(books, from);
    save();
  }
}
let readOnlyData = false;
function save() {
  if (readOnlyData) { toast('Dati di una versione più recente: aggiorna l\'app per modificarli'); return; }
  try {
    localStorage.setItem(KEY, JSON.stringify(books));
    localStorage.setItem(META_KEY, JSON.stringify({ schema: SCHEMA, app: APP_VERSION }));
  } catch (e) { toast('Impossibile salvare: spazio esaurito o dati bloccati dal browser'); }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Utilità ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const splitList = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
/* Codici ISSN (periodici e collane a uscita periodica): EAN-13 che inizia per 977 */
function issnCheck(d7) {
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += (+d7[i]) * (8 - i);
  const r = sum % 11, c = r === 0 ? 0 : 11 - r;
  return c === 10 ? 'X' : String(c);
}
function issnFromEan(ean) {
  const d = ean.slice(3, 10);
  return d.slice(0, 4) + '-' + d.slice(4) + issnCheck(d);
}
function issnValid(raw) {
  const s = cleanIsbn(raw);
  if (!/^\d{7}[\dX]$/.test(s) || issnCheck(s.slice(0, 7)) !== s[7]) return null;
  return s.slice(0, 4) + '-' + s.slice(4);
}
/** Riconosce ISBN (libri) e ISSN (collane e periodici). */
function parseCode(raw) {
  const s = cleanIsbn(raw);
  const isbn = toIsbn13(s);
  if (isbn) return { type: 'isbn', isbn };
  if (s.length === 13 && /^977/.test(s) && isbn13Valid(s)) return { type: 'issn', issn: issnFromEan(s), ean: s };
  if (s.length === 8) { const i = issnValid(s); if (i) return { type: 'issn', issn: i, ean: '' }; }
  return null;
}
const STATUS = { 'da-leggere': 'Da leggere', 'in-lettura': 'In lettura', 'letto': 'Letto' };
const PRIO = { alta: 'Alta', media: 'Media', bassa: 'Bassa' };

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}

/* ISBN */
function cleanIsbn(s) { return String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase(); }
function isbn10to13(i10) {
  const core = '978' + i10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += (+core[i]) * (i % 2 ? 3 : 1);
  return core + ((10 - (sum % 10)) % 10);
}
function isbn13Valid(s) {
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += (+s[i]) * (i % 2 ? 3 : 1);
  return ((10 - (sum % 10)) % 10) === +s[12];
}
function isbn10Valid(s) {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (s[i] === 'X' ? 10 : +s[i]) * (10 - i);
  return sum % 11 === 0;
}
/** Restituisce un ISBN-13 valido oppure null. */
function toIsbn13(raw) {
  const s = cleanIsbn(raw);
  if (s.length === 13 && isbn13Valid(s) && /^97[89]/.test(s)) return s;
  if (s.length === 10 && isbn10Valid(s)) return isbn10to13(s);
  return null;
}

/* ---------- Ricerca dettagli ---------- */
function mapGoogle(v, isbn) {
  const info = v.volumeInfo || {};
  const ids = info.industryIdentifiers || [];
  const id13 = (ids.find(i => i.type === 'ISBN_13') || {}).identifier;
  const id10 = (ids.find(i => i.type === 'ISBN_10') || {}).identifier;
  let cover = (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) || '';
  cover = cover.replace(/^http:/, 'https:').replace('&edge=curl', '');
  return {
    isbn: isbn || id13 || (id10 ? isbn10to13(id10) : ''),
    title: [info.title, info.subtitle].filter(Boolean).join(': '),
    authors: info.authors || [],
    publisher: info.publisher || '',
    year: (info.publishedDate || '').slice(0, 4),
    pages: info.pageCount || '',
    categories: (info.categories || []).flatMap(c => c.split('/').map(x => x.trim())).filter((x, i, a) => x && a.indexOf(x) === i),
    description: info.description || '',
    cover
  };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchJson(url, retry = 0) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (r.status === 429 && retry < 1) { clearTimeout(t); await sleep(1500); return fetchJson(url, retry + 1); }
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return await r.json();
  } finally { clearTimeout(t); }
}

function errText(e) {
  if (e && e.name === 'AbortError') return 'tempo scaduto';
  if (e && e.status === 429) return 'troppe richieste (429)';
  if (e && e.status === 403) return 'chiave non valida o non autorizzata (403)';
  return (e && e.message) || 'errore di rete';
}

/** Cerca i dettagli per ISBN. Restituisce { book, errors }: errors elenca le fonti che non hanno risposto. */
async function lookupIsbn(isbn) {
  const errors = [];
  const attempt = async (label, fn) => {
    try { return await fn(); } catch (e) { errors.push(`${label}: ${errText(e)}`); return null; }
  };

  // 1) Google Books: prima con isbn:, poi come testo libero (accetto solo risultati con lo stesso ISBN)
  let book = await attempt('Google Books', async () => {
    const matches = (v) => ((v.volumeInfo || {}).industryIdentifiers || []).some(i => i.identifier === isbn || (i.type === 'ISBN_10' && isbn10to13(i.identifier) === isbn));
    const query = async (q) => (await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5${gKey()}`)).items || [];
    let items = await query('isbn:' + isbn);
    if (items.length) return mapGoogle(items.find(matches) || items[0], isbn);
    items = await query(isbn);                       // solo se la prima ricerca non ha dato nulla
    const same = items.find(matches);
    return same ? mapGoogle(same, isbn) : null;
  });
  if (book) return { book, errors };

  // 2) Open Library: API libri, poi ricerca
  book = await attempt('Open Library', async () => {
    const d = await fetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const b = d['ISBN:' + isbn];
    if (b) {
      return {
        isbn,
        title: [b.title, b.subtitle].filter(Boolean).join(': '),
        authors: (b.authors || []).map(a => a.name),
        publisher: (b.publishers || []).map(p => p.name).join(', '),
        year: ((b.publish_date || '').match(/\d{4}/) || [''])[0],
        pages: b.number_of_pages || '',
        categories: (b.subjects || []).slice(0, 3).map(s => s.name),
        description: '',
        cover: (b.cover && (b.cover.medium || b.cover.small)) || ''
      };
    }
    const s = await fetchJson(`https://openlibrary.org/search.json?isbn=${isbn}&limit=1&fields=title,subtitle,author_name,publisher,first_publish_year,number_of_pages_median,cover_i,subject`);
    const x = (s.docs || [])[0];
    if (!x) return null;
    return {
      isbn,
      title: [x.title, x.subtitle].filter(Boolean).join(': '),
      authors: x.author_name || [],
      publisher: (x.publisher || [])[0] || '',
      year: x.first_publish_year || '',
      pages: x.number_of_pages_median || '',
      categories: (x.subject || []).slice(0, 3),
      description: '',
      cover: x.cover_i ? `https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg` : ''
    };
  });
  return { book, errors };
}

async function searchTitle(q) {
  const d = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10&printType=books${gKey()}`);
  return (d.items || []).map(v => mapGoogle(v)).filter(b => b.title);
}

/* ---------- Navigazione ---------- */
const TITLES = { library: 'Biblioteca', wishlist: 'Da acquistare', scan: 'Aggiungi un libro' };
let current = 'library';

function show(view) {
  if (current === 'scan' && view !== 'scan') stopScan();
  current = view;
  $$('.view').forEach(v => v.hidden = v.id !== 'view-' + view);
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  $('#title').textContent = TITLES[view];
  try { sessionStorage.setItem('view', view); } catch (e) {}
  render();
  $('main').scrollTop = 0;
}
$$('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));

/* ---------- Elenchi ---------- */
const filters = { library: 'all', wishlist: 'all' };
let catFilter = '';

function coverHtml(b) {
  if (b.cover) return `<img class="cover" src="${esc(b.cover)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;cover ph&quot;>${esc(b.title).slice(0, 40)}</div>'">`;
  return `<div class="cover ph">${esc(b.title).slice(0, 40)}</div>`;
}

function cardHtml(b) {
  const authors = (b.authors || []).join(', ');
  let extra = '';
  if (b.list === 'library') {
    extra = `<span class="pill ${esc(b.status)}">${STATUS[b.status] || ''}</span>` +
      (b.rating ? `<span class="stars" aria-label="Voto ${b.rating} su 5">${'★'.repeat(b.rating)}${'☆'.repeat(5 - b.rating)}</span>` : '') +
      (b.shelf ? `<span>${esc(b.shelf)}</span>` : '');
  } else {
    extra = `<span class="pill ${esc(b.priority)}">Priorità ${esc(PRIO[b.priority] || '')}</span>` +
      (b.price ? `<span>${esc(b.price)} €</span>` : '') +
      (b.where ? `<span>${esc(b.where)}</span>` : '');
  }
  return `<li><button class="card" data-id="${b.id}">${coverHtml(b)}
    <span class="meta"><span class="t">${esc(b.title)}</span>
    <span class="a">${esc(authors)}</span>
    ${b.collana ? `<span class="a">${esc(b.collana)}${b.numero ? ' · n. ' + esc(b.numero) : ''}</span>` : ''}
    <span class="s">${extra}</span></span></button></li>`;
}

function renderList(list) {
  const q = norm($('#q-' + list).value.trim());
  const f = filters[list];
  let items = books.filter(b => b.list === list);
  const total = items.length;

  if (list === 'library') {
    if (f !== 'all') items = items.filter(b => b.status === f);
    if (catFilter) items = items.filter(b => (b.categories || []).includes(catFilter));
  } else if (f !== 'all') items = items.filter(b => b.priority === f);

  if (q) items = items.filter(b => norm([b.title, (b.authors || []).join(' '), b.isbn, b.issn, b.collana, b.numero, b.shelf, b.publisher, (b.categories || []).join(' '), b.notes, b.where].join(' ')).includes(q));

  if (list === 'library') {
    const s = $('#sort-library').value;
    const key = (b) => norm((b.authors || [])[0] || '');
    if (s === 'titolo') items.sort((a, b) => norm(a.title).localeCompare(norm(b.title)));
    else if (s === 'autore') items.sort((a, b) => key(a).localeCompare(key(b)) || norm(a.title).localeCompare(norm(b.title)));
    else if (s === 'collana') items.sort((a, b) => norm(a.collana || '\uffff').localeCompare(norm(b.collana || '\uffff')) || (parseFloat(a.numero) || 0) - (parseFloat(b.numero) || 0) || norm(a.title).localeCompare(norm(b.title)));
    else if (s === 'voto') items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else items.sort((a, b) => b.addedAt - a.addedAt);
  } else {
    const order = { alta: 0, media: 1, bassa: 2 };
    items.sort((a, b) => order[a.priority] - order[b.priority] || b.addedAt - a.addedAt);
  }

  $('#count-' + list).textContent = total
    ? `${items.length} ${items.length === 1 ? 'libro' : 'libri'}${items.length !== total ? ` su ${total}` : ''}`
    : '';
  $('#list-' + list).innerHTML = items.length
    ? items.map(cardHtml).join('')
    : `<li class="empty">${total ? 'Nessun risultato con questi filtri.' : (list === 'library' ? 'La biblioteca è vuota. Tocca Aggiungi e fotografa il codice a barre di un libro.' : 'Nessun libro in lista. Quando ne vedi uno interessante, scansionalo scegliendo "Da acquistare".')}</li>`;
}

function renderCats() {
  const counts = {};
  books.filter(b => b.list === 'library').forEach(b => (b.categories || []).forEach(c => counts[c] = (counts[c] || 0) + 1));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (catFilter && !counts[catFilter]) catFilter = '';
  $('#cats-library').innerHTML = top.length
    ? top.map(([c, n]) => `<button data-c="${esc(c)}" class="${c === catFilter ? 'on' : ''}">${esc(c)} (${n})</button>`).join('')
    : '';
}

function render() {
  if (current === 'library') { renderCats(); renderList('library'); }
  if (current === 'wishlist') renderList('wishlist');
}

['library', 'wishlist'].forEach(list => {
  $('#q-' + list).addEventListener('input', () => renderList(list));
  $('#chips-' + list).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    filters[list] = b.dataset.f;
    $$('#chips-' + list + ' button').forEach(x => x.classList.toggle('on', x === b));
    renderList(list);
  });
  $('#list-' + list).addEventListener('click', e => {
    const c = e.target.closest('.card'); if (!c) return;
    openBook(books.find(b => b.id === c.dataset.id));
  });
});
$('#sort-library').addEventListener('change', () => renderList('library'));
$('#cats-library').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  catFilter = catFilter === b.dataset.c ? '' : b.dataset.c;
  renderCats(); renderList('library');
});

/* ---------- Scheda libro ---------- */
const dlg = $('#dlg-book');
let editing = null; // { book, isNew }

function openBook(book, isNew = false) {
  editing = { book, isNew };
  const wish = book.list === 'wishlist';
  $('#dlg-title').textContent = isNew ? (wish ? 'Nuovo da acquistare' : 'Nuovo libro') : 'Scheda libro';
  $('#f-title').value = book.title || '';
  $('#f-authors').value = (book.authors || []).join(', ');
  $('#f-publisher').value = book.publisher || '';
  $('#f-year').value = book.year || '';
  $('#f-pages').value = book.pages || '';
  $('#f-isbn').value = book.isbn || '';
  $('#f-collana').value = book.collana || '';
  $('#f-numero').value = book.numero || '';
  $('#f-numero').placeholder = '';
  $('#f-issn').value = book.issn || '';
  $('#f-categories').value = (book.categories || []).join(', ');
  $('#f-notes').value = book.notes || '';
  $('#f-status').value = book.status || 'da-leggere';
  $('#f-rating').value = String(book.rating || 0);
  $('#f-shelf').value = book.shelf || '';
  $('#f-priority').value = book.priority || 'media';
  $('#f-price').value = book.price || '';
  $('#f-where').value = book.where || '';
  $('#grp-library').hidden = wish;
  $('#grp-wishlist').hidden = !wish;

  const img = $('#f-cover-img');
  if (book.cover) { img.src = book.cover; img.hidden = false; } else img.hidden = true;
  $('#desc-box').hidden = !book.description;
  $('#f-desc').textContent = book.description || '';

  // Datalist con generi e posizioni già usati
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  $('#dl-cats').innerHTML = uniq(books.flatMap(b => b.categories || [])).map(c => `<option value="${esc(c)}">`).join('');
  $('#dl-collane').innerHTML = uniq(books.map(b => b.collana)).map(c => `<option value="${esc(c)}">`).join('');
  $('#dl-shelves').innerHTML = uniq(books.map(b => b.shelf)).map(c => `<option value="${esc(c)}">`).join('');

  // Avviso di duplicato
  const ban = $('#dup-banner');
  const dup = isNew && book.isbn ? books.find(b => b.isbn === book.isbn) : null;
  if (dup) {
    ban.textContent = dup.list === 'library'
      ? 'Questo libro è già nella tua biblioteca.'
      : 'Questo libro è già nella tua lista da acquistare.';
    ban.hidden = false;
  } else ban.hidden = true;

  $('#book-delete').hidden = isNew;
  const mv = $('#book-move');
  if (isNew) mv.hidden = true;
  else {
    mv.hidden = false;
    mv.textContent = wish ? 'Acquistato: sposta in biblioteca' : 'Sposta in "Da acquistare"';
  }
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}

function readForm() {
  const b = editing.book;
  b.title = $('#f-title').value.trim();
  b.authors = splitList($('#f-authors').value);
  b.publisher = $('#f-publisher').value.trim();
  b.year = $('#f-year').value.trim();
  b.pages = $('#f-pages').value.trim();
  const rawIsbn = $('#f-isbn').value.trim();
  b.isbn = toIsbn13(rawIsbn) || cleanIsbn(rawIsbn);
  b.collana = $('#f-collana').value.trim();
  b.numero = $('#f-numero').value.trim();
  const rawIssn = $('#f-issn').value.trim();
  b.issn = issnValid(rawIssn) || rawIssn;
  b.categories = splitList($('#f-categories').value);
  b.notes = $('#f-notes').value.trim();
  if (b.list === 'library') {
    b.status = $('#f-status').value;
    b.rating = +$('#f-rating').value;
    b.shelf = $('#f-shelf').value.trim();
  } else {
    b.priority = $('#f-priority').value;
    b.price = $('#f-price').value.trim();
    b.where = $('#f-where').value.trim();
  }
  return b;
}

function commit(b, isNew) {
  if (isNew) books.push(b);
  save();
}

$('#form-book').addEventListener('submit', e => {
  e.preventDefault();
  const { isNew } = editing;
  const b = readForm();
  if (!b.title) { $('#f-title').focus(); return; }
  if (isNew && b.issn && b.numero && books.some(x => x.id !== b.id && x.issn === b.issn && String(x.numero) === String(b.numero)) &&
      !confirm('Questa uscita della collana è già presente. Aggiungerla comunque?')) return;
  commit(b, isNew);
  dlg.close();
  toast(isNew ? (b.list === 'library' ? 'Aggiunto alla biblioteca' : 'Aggiunto a Da acquistare') : 'Modifiche salvate');
  if (current === 'scan') {
    $('#results').innerHTML = '';
    $('#isbn-input').value = ''; $('#title-input').value = '';
    if (scanWanted) startScan(); // continua a scansionare
  } else render();
});
$('#book-close').addEventListener('click', () => dlg.close());
dlg.addEventListener('close', () => { editing = null; });

$('#book-delete').addEventListener('click', () => {
  if (!editing || editing.isNew) return;
  if (!confirm(`Eliminare "${editing.book.title}"?`)) return;
  books = books.filter(b => b.id !== editing.book.id);
  save(); dlg.close(); render(); toast('Libro eliminato');
});
$('#book-move').addEventListener('click', () => {
  if (!editing || editing.isNew) return;
  const b = readForm();
  if (b.list === 'wishlist') {
    b.list = 'library'; b.status = 'da-leggere'; b.rating = 0; b.shelf = '';
    delete b.priority; delete b.price; delete b.where;
    toast('Spostato in biblioteca');
  } else {
    b.list = 'wishlist'; b.priority = 'media'; b.price = ''; b.where = '';
    delete b.status; delete b.rating; delete b.shelf;
    toast('Spostato in Da acquistare');
  }
  save(); dlg.close(); render();
});

/* ---------- Aggiunta: destinazione, ISBN, titolo ---------- */
let dest = 'library';
$('#dest').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  dest = b.dataset.dest;
  $$('#dest button').forEach(x => x.classList.toggle('on', x === b));
});

function newBook(data) {
  const base = {
    id: uid(), list: dest, addedAt: Date.now(),
    isbn: '', issn: '', collana: '', numero: '', title: '', authors: [], publisher: '', year: '', pages: '', categories: [], description: '', cover: '', notes: ''
  };
  const b = Object.assign(base, data);
  if (dest === 'library') Object.assign(b, { status: 'da-leggere', rating: 0, shelf: '' });
  else Object.assign(b, { priority: 'media', price: '', where: '' });
  return b;
}

async function handleIsbn(isbn) {
  setMsg('Cerco i dettagli…');
  const { book, errors } = await lookupIsbn(isbn);
  if (book) { setMsg('Libro trovato'); openBook(newBook(book), true); return; }
  const limited = errors.some(e => /429|403/.test(e));
  const note = errors.length
    ? 'Servizio non raggiungibile (' + errors.join('; ') + ').' + (limited ? ' Aggiungi una chiave API di Google Books dal menu in alto a destra, oppure riprova più tardi.' : ' Controlla la connessione.') + ' Intanto puoi compilare a mano.'
    : 'ISBN ' + isbn + ' non presente nelle banche dati: compila a mano.';
  setMsg(errors.length ? 'Servizio non raggiungibile' : 'ISBN non trovato');
  openBook(newBook({ isbn }), true);
  const ban = $('#dup-banner');
  ban.textContent = note; ban.hidden = false;
}

/** Collane e periodici: non esistono schede online, si riporta quanto già inserito per la stessa collana. */
function handleSerial({ issn }) {
  const same = books.filter(b => b.issn === issn).sort((a, b) => b.addedAt - a.addedAt);
  const named = same.find(b => b.collana) || same[0];
  const data = { issn };
  if (named) {
    // Titolo, autori e anno cambiano a ogni uscita: si riportano solo i dati comuni alla collana
    Object.assign(data, { collana: named.collana || '', publisher: named.publisher || '', categories: named.categories || [] });
  }
  setMsg('Collana o periodico (ISSN ' + issn + ')');
  openBook(newBook(data), true);
  const ban = $('#dup-banner');
  ban.textContent = same.length
    ? `Collana già presente (${same.length} ${same.length === 1 ? 'uscita' : 'uscite'}): ho riportato ${named.collana ? 'collana, ' : ''}editore e generi. Inserisci titolo, autore e numero di questa uscita.${named.collana ? '' : ' Indica anche il nome della collana.'}`
    : `Codice di una collana o periodico (ISSN ${issn}): non ha una scheda online. Inserisci titolo, autore e numero. Dalla prossima uscita collana, editore e generi si compilano da soli.`;
  ban.hidden = false;
  const n = named && parseFloat(same[0].numero);
  if (n) $('#f-numero').placeholder = 'es. ' + (n + 1);
}

$('#form-isbn').addEventListener('submit', e => {
  e.preventDefault();
  const raw = $('#isbn-input').value;
  const code = parseCode(raw);
  if (!code) {
    const d = cleanIsbn(raw);
    toast(/^977/.test(d) && d.length < 13
      ? 'Codice incompleto: quello delle collane ha 13 cifre, sotto le barre (senza il supplemento a 5 cifre)'
      : 'Codice non valido. Servono 10 o 13 cifre per ISBN, 13 cifre (977…) o 8 per ISSN');
    return;
  }
  stopScan();
  code.type === 'isbn' ? handleIsbn(code.isbn) : handleSerial(code);
});

$('#form-title').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('#title-input').value.trim();
  if (!q) return;
  const ul = $('#results');
  ul.innerHTML = '<li class="empty">Ricerca in corso…</li>';
  try {
    const res = await searchTitle(q);
    window.__results = res;
    ul.innerHTML = res.length
      ? res.map((b, i) => `<li><button class="card" data-i="${i}">${coverHtml(b)}<span class="meta"><span class="t">${esc(b.title)}</span><span class="a">${esc(b.authors.join(', '))}</span><span class="s">${esc([b.publisher, b.year].filter(Boolean).join(' · '))}</span></span></button></li>`).join('')
      : '<li class="empty">Nessun risultato.</li>';
  } catch (err) {
    ul.innerHTML = `<li class="empty">Ricerca non riuscita (${esc(errText(err))}). ${err && (err.status === 429 || err.status === 403) ? 'Aggiungi una chiave API di Google Books dal menu in alto a destra.' : 'Controlla la connessione e riprova.'}</li>`;
  }
});
$('#results').addEventListener('click', e => {
  const c = e.target.closest('.card'); if (!c) return;
  stopScan();
  openBook(newBook(window.__results[+c.dataset.i]), true);
});
$('#btn-manual').addEventListener('click', () => { stopScan(); openBook(newBook({}), true); });

/* ---------- Scansione codice a barre ---------- */
let stream = null, scanWanted = false, detector = null, zxingReader = null, rafId = 0, lastCode = '', lastAt = 0, busy = false;
const video = $('#video');

function setMsg(t) { $('#cam-msg').textContent = t; }

async function startScan() {
  scanWanted = true;
  if (stream) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setMsg('Fotocamera non disponibile. Usa l\'ISBN a mano.'); return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
    });
  } catch (e) {
    scanWanted = false;
    setMsg(e && e.name === 'NotAllowedError'
      ? 'Permesso negato. Abilita la fotocamera nelle impostazioni del browser.'
      : 'Impossibile aprire la fotocamera.');
    return;
  }
  video.srcObject = stream;
  await video.play().catch(() => {});
  $('#btn-scan').textContent = 'Ferma fotocamera';
  setMsg('Inquadra il codice a barre sul retro del libro');

  // Torcia, se supportata
  const track = stream.getVideoTracks()[0];
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  $('#btn-torch').hidden = !caps.torch;

  if ('BarcodeDetector' in window) {
    try { detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] }); } catch (e) { detector = null; }
  }
  if (detector) loopNative();
  else if (window.ZXing) loopZxing();
  else setMsg('Lettore non disponibile. Usa l\'ISBN a mano.');
}

function stopScan() {
  scanWanted = false;
  cancelAnimationFrame(rafId);
  if (zxingReader) { try { zxingReader.reset(); } catch (e) {} zxingReader = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  video.srcObject = null;
  $('#btn-scan').textContent = 'Avvia fotocamera';
  $('#btn-torch').hidden = true;
  setMsg('Inquadra il codice a barre sul retro del libro');
}

async function onCode(raw) {
  const code = parseCode(raw);
  const now = Date.now();
  if (!code) return;                       // altri codici (prezzi, add-on) ignorati
  const id = code.type === 'isbn' ? code.isbn : code.ean || code.issn;
  if (busy || (id === lastCode && now - lastAt < 4000)) return;
  lastCode = id; lastAt = now; busy = true;
  if (navigator.vibrate) navigator.vibrate(60);
  const wasOn = scanWanted;
  // Metto in pausa la fotocamera mentre la scheda è aperta
  cancelAnimationFrame(rafId);
  if (zxingReader) { try { zxingReader.reset(); } catch (e) {} zxingReader = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  video.srcObject = null;
  $('#btn-scan').textContent = 'Avvia fotocamera';
  scanWanted = wasOn;                      // al salvataggio riparte da sola
  try { await (code.type === 'isbn' ? handleIsbn(code.isbn) : handleSerial(code)); } finally { busy = false; }
}

function loopNative() {
  const tick = async () => {
    if (!stream) return;
    try {
      if (video.readyState >= 2) {
        const codes = await detector.detect(video);
        if (codes.length) { onCode(codes[0].rawValue); return; }
      }
    } catch (e) {}
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function loopZxing() {
  const Z = window.ZXing;
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  zxingReader = new Z.BrowserMultiFormatReader(hints, 300);
  zxingReader.decodeFromVideoElement(video, (result) => {
    if (result) onCode(result.getText());
  }).catch(() => {});
}

$('#btn-scan').addEventListener('click', () => { stream ? stopScan() : startScan(); });
$('#btn-torch').addEventListener('click', async () => {
  const track = stream && stream.getVideoTracks()[0];
  if (!track) return;
  torchOn = !torchOn;
  try { await track.applyConstraints({ advanced: [{ torch: torchOn }] }); } catch (e) { toast('Torcia non disponibile'); }
});
let torchOn = false;
document.addEventListener('visibilitychange', () => { if (document.hidden && stream) stopScan(); });

/* ---------- Statistiche e backup ---------- */
const dlgMenu = $('#dlg-menu');
$('#btn-menu').addEventListener('click', () => {
  const lib = books.filter(b => b.list === 'library');
  const wish = books.filter(b => b.list === 'wishlist');
  const sum = wish.reduce((t, b) => t + (parseFloat(String(b.price).replace(',', '.')) || 0), 0);
  const rows = [
    ['Libri in biblioteca', lib.length],
    ['Letti', lib.filter(b => b.status === 'letto').length],
    ['In lettura', lib.filter(b => b.status === 'in-lettura').length],
    ['Da leggere', lib.filter(b => b.status === 'da-leggere').length],
    ['Da acquistare', wish.length],
    ['Spesa prevista', sum ? sum.toFixed(2).replace('.', ',') + ' €' : '—']
  ];
  rows.push(['Versione app', APP_VERSION]);
  $('#f-gkey').value = readSettings().googleKey || '';
  $('#stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  dlgMenu.showModal();
});
$('#f-gkey').addEventListener('change', () => {
  writeSettings({ googleKey: $('#f-gkey').value.trim() });
  toast($('#f-gkey').value.trim() ? 'Chiave salvata' : 'Chiave rimossa');
});
$('#menu-close').addEventListener('click', () => dlgMenu.close());

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const today = () => new Date().toISOString().slice(0, 10);

$('#btn-export').addEventListener('click', () => {
  download(`biblioteca-${today()}.json`, JSON.stringify({ app: 'biblioteca', schema: SCHEMA, appVersion: APP_VERSION, books }, null, 1), 'application/json');
});
$('#btn-csv').addEventListener('click', () => {
  const cols = ['list', 'title', 'authors', 'isbn', 'issn', 'collana', 'numero', 'publisher', 'year', 'pages', 'categories', 'status', 'rating', 'shelf', 'priority', 'price', 'where', 'notes'];
  const q = (v) => '"' + String(Array.isArray(v) ? v.join('; ') : (v ?? '')).replace(/"/g, '""') + '"';
  const csv = '﻿' + [cols.join(';'), ...books.map(b => cols.map(c => q(b[c])).join(';'))].join('\r\n');
  download(`biblioteca-${today()}.csv`, csv, 'text/csv;charset=utf-8');
});
$('#btn-import').addEventListener('click', () => $('#file-import').click());
$('#file-import').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    let incoming = Array.isArray(data) ? data : data.books;
    if (!Array.isArray(incoming)) throw new Error('formato');
    const fileSchema = (!Array.isArray(data) && (data.schema || data.version)) || 1;
    if (fileSchema > SCHEMA) { toast('Il backup viene da una versione più recente: aggiorna l\'app'); return; }
    incoming = migrate(incoming, fileSchema);
    let added = 0;
    incoming.forEach(b => {
      if (!b || !b.title) return;
      const exists = books.some(x => x.id === b.id || (b.isbn && x.isbn === b.isbn && x.list === b.list));
      if (!exists) { books.push(Object.assign({ id: uid(), addedAt: Date.now() }, b)); added++; }
    });
    save(); render();
    toast(`Importati ${added} libri`);
    dlgMenu.close();
  } catch (err) { toast('File non valido'); }
});

/* ---------- Avvio ---------- */
load();
let startView = 'library';
try { startView = sessionStorage.getItem('view') || 'library'; } catch (e) {}
show(['library', 'wishlist', 'scan'].includes(startView) ? startView : 'library');

// Richiede archiviazione persistente, per evitare che il browser cancelli i dati
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('App aggiornata. Chiudila e riaprila per usare la nuova versione.');
  });
}
