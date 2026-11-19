const qs = new URLSearchParams(location.search);
let query = qs.get('q') || '';
let writer = qs.get('author') || '';
let chosen = new Set(qs.getAll('tag'));
let books = [];

const byId = id => document.getElementById(id);
const qInput = byId('q');
const writerSelect = byId('yazar');
const tagBox = byId('etiketler');
const list = byId('liste');
const sayi = byId('sayi');

function el(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readCatalog(markdown) {
  const found = new Map();
  let author = '';

  for (const line of markdown.split(/\r?\n/)) {
    const byline = line.match(/^- \*\*(.+)\*\*\s*$/);
    if (byline) {
      author = byline[1];
      continue;
    }

    const entry = line.match(/^\s+- \[([^\]]+)\]\(([^)]+)\) — etiketler:\s*(.+)$/);
    if (!entry) continue;

    const [, title, href, raw] = entry;
    const tags = [...raw.matchAll(/`([^`]+)`/g)].map(match => match[1]);
    const old = found.get(href);
    if (old) {
      tags.forEach(tag => old.tags.add(tag));
    } else {
      found.set(href, { title, author, href, tags: new Set(tags) });
    }
  }

  return [...found.values()].sort((a, b) =>
    a.author.localeCompare(b.author, 'tr') || a.title.localeCompare(b.title, 'tr'));
}

function coverPath(href) {
  return href.replace('kitaplar/', 'kapaklar/').replace(/\.pdf$/, '.jpg');
}

function entryRow(book, index) {
  const row = el('li');
  row.append(el('span', 'no', String(index + 1).padStart(3, '0')));

  const cover = el('div', 'kapak');
  const image = el('img');
  image.src = coverPath(book.href);
  image.alt = '';
  image.loading = 'lazy';
  image.onerror = () => image.remove();
  cover.append(image);

  const info = el('div', 'bilgi');
  const heading = el('h2');
  const open = el('a', '', book.title);
  open.href = book.href;
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  heading.append(open);
  info.append(heading, el('p', 'yazar', book.author), el('p', 'etiket', [...book.tags].join(' / ')));

  const actions = el('div', 'islem');
  const download = el('a', '', 'indir');
  download.href = book.href;
  download.download = decodeURIComponent(book.href.split('/').pop());
  actions.append(download);

  row.append(cover, info, actions);
  return row;
}

function matches(book) {
  const needle = query.toLocaleLowerCase('tr');
  const hay = `${book.title} ${book.author} ${[...book.tags].join(' ')}`.toLocaleLowerCase('tr');
  return (!needle || hay.includes(needle))
    && (!writer || book.author === writer)
    && [...chosen].every(tag => book.tags.has(tag));
}

function draw() {
  const shown = books.filter(matches);
  sayi.textContent = `${shown.length}/${books.length}`;

  if (!shown.length) {
    list.replaceChildren(el('li', 'bos', 'eşleşme yok.'));
    return;
  }

  list.replaceChildren(...shown.map(entryRow));
}

function buildFilters() {
  const names = [...new Set(books.map(book => book.author))].sort((a, b) => a.localeCompare(b, 'tr'));
  names.forEach(name => writerSelect.add(new Option(name, name)));
  writerSelect.value = writer;

  const counts = new Map();
  books.forEach(book => book.tags.forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));

  [...counts.keys()]
    .sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b, 'tr'))
    .forEach(tag => {
      const button = el('button', '', tag);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(chosen.has(tag)));
      button.append(el('span', '', counts.get(tag)));
      button.onclick = () => {
        if (chosen.has(tag)) chosen.delete(tag);
        else chosen.add(tag);
        button.setAttribute('aria-pressed', String(chosen.has(tag)));
        draw();
      };
      tagBox.append(button);
    });
}

qInput.value = query;
qInput.oninput = () => { query = qInput.value.trim(); draw(); };
writerSelect.onchange = () => { writer = writerSelect.value; draw(); };
byId('temizle').onclick = () => {
  query = '';
  writer = '';
  chosen.clear();
  qInput.value = '';
  writerSelect.value = '';
  tagBox.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', 'false'));
  history.replaceState(null, '', location.pathname);
  draw();
};
document.addEventListener('keydown', event => {
  if (event.key === '/' && document.activeElement !== qInput) {
    event.preventDefault();
    qInput.focus();
  }
});

fetch('README.md')
  .then(response => {
    if (!response.ok) throw new Error('README okunamadı');
    return response.text();
  })
  .then(markdown => {
    books = readCatalog(markdown);
    buildFilters();
    draw();
  })
  .catch(() => {
    sayi.textContent = 'hata';
    list.replaceChildren(el('li', 'hata', 'README.md okunamadı. Yerelde python3 -m http.server ile aç.'));
  });
