// The Dream Library panel: any dream module imports this from its own /common/ (dream-common/web) and
// gets the same browser — places (folders), search, kinds, tags, versions — docked on the right of its page.
//
//   const { createLibrary, fileUrl } = await import(`${location.origin}/common/library.js`);
//   const library = createLibrary({ onOpenModel, onOpenPalette, onOpenGenerator });
//
// Everything it draws is prefixed "dl-" so it can't clash with the host page. Models, palettes and
// generators are handed to the host to open; sounds preview on click, images open in a tab.

// the Library's API, always through the page's own origin (/dl/ is proxied to port 5230 by every Dream server)
export const BASE = `${location.origin}/dl`;
const KIND_ICON = { effect: '✺', scene: '⛰', zone: '▦', model: '◆', character: '☺', texture: '▦', sprite: '◩', image: '▣', audio: '♪', synth: '∿', clip: '▥', package: '▤', palette: '◐', generator: '⚙' };
const KIND_NAME = { all: 'All', scene: 'Scenes', zone: 'Zones', effect: 'Effects', model: 'Models', texture: 'Textures', sprite: 'Sprites', ui: 'Game UI', generator: 'Gens', palette: 'Palettes', image: 'Images', audio: 'Sounds', synth: 'Synths', clip: 'Clips', package: 'Packs' };

export const fileUrl = (place, p) => `${BASE}/api/file?place=${encodeURIComponent(place)}&path=${encodeURIComponent(p)}`;

/**
 * The one way to read the library's listing, shared by every tool: every existing place (or the ones
 * given, by slug or id), each item tagged with its place. `kind` is one kind or a list ("model" or ["model", "image"]).
 * Each item carries `place` (the place's id, i.e. its index, as tools have always used it), `placeId`
 * (its stable slug, "creations") and `placeName`; the server accepts either as place=.
 * Resolves to { places, items, truncated } where truncated names the places whose listing was cut short.
 * Throws when the library is not reachable.
 */
const wrapped = (r) => (Array.isArray(r) ? { items: r, truncated: false } : r);

export async function listLibrary({ kind = null, places = null } = {}) {
  const get = async (url) => {
    const r = await fetch(BASE + url);
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
    return r.json();
  };
  const all = await get('/api/places');
  const want = places ? all.filter((p) => places.includes(p.slug) || places.includes(p.id)) : all.filter((p) => p.exists);
  const kinds = kind ? (Array.isArray(kind) ? kind : [kind]).join(',') : '';
  // an older Library (not restarted since slugs) has no slug and answers a plain array
  const lists = await Promise.all(want.map((p) => get(`/api/list?wrap=1&place=${encodeURIComponent(p.slug ?? p.id)}${kinds ? `&kind=${encodeURIComponent(kinds)}` : ''}`).then(wrapped).catch(() => ({ items: [], truncated: false }))));
  const items = [], truncated = [];
  lists.forEach((l, k) => {
    const p = want[k];
    if (l.truncated) truncated.push(p.slug ?? p.id);
    // place stays the index the tools have always used (links, saved records); placeId is the stable id
    for (const it of l.items) if (!kinds || kinds.split(',').includes(it.kind)) items.push({ ...it, place: p.id, placeId: p.slug, placeName: p.name });
  });
  return { places: all, items, truncated };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function mountPanel({ full = false } = {}) {
  if (!document.querySelector('link[data-dl]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('library.css', import.meta.url).href;
    css.dataset.dl = '';
    document.head.append(css);
  }
  const root = document.createElement('div');
  root.className = 'dl-panel' + (full ? ' dl-full' : '');
  root.innerHTML = `
    <div class="dl-head"><b>Dream Library</b> <span class="dl-count"></span> <button class="dl-import" title="Import photos as references (or drop them on the library). Location data is removed.">+ Photos</button> <button class="dl-refresh" title="Re-read the folder">↻</button></div>
    <div class="dl-label">Places <button class="dl-add" title="Point the library at another folder">+ Add folder</button></div>
    <div class="dl-places"></div>
    <input class="dl-search" type="search" placeholder="Search names and tags" spellcheck="false">
    <div class="dl-kinds"></div>
    <div class="dl-tags"></div>
    <div class="dl-items"></div>`;
  document.body.append(root);
  let toggle = null, win = null;
  const isOpen = () => document.body.classList.contains('dl-open');
  const setOpen = (on) => {
    document.body.classList.toggle('dl-open', on);
    win?.[on ? 'show' : 'hide']();
  };
  if (!full) {
    toggle = document.createElement('button');
    toggle.className = 'dl-toggle';
    toggle.textContent = 'Library';
    toggle.title = 'Library (L)';
    toggle.onclick = () => setOpen(!isOpen());
    document.body.append(toggle);
    // a floating, resizable window like every other Dream panel; the docked panel stays as the fallback
    import('./ui/window.js').then(({ createWindow }) => {
      const w = Math.min(460, innerWidth - 24);
      win = createWindow({
        id: 'library', title: 'Dream Library', content: root, open: false,
        x: Math.max(8, innerWidth - w - 12), y: 44, w, h: Math.max(320, innerHeight - 100),
        onShow: () => document.body.classList.add('dl-open'),
        onHide: () => document.body.classList.remove('dl-open'),
      });
      root.classList.add('dl-in-window');
      toggle.classList.add('in-win');
      document.body.classList.toggle('dl-open', win.visible);
    }).catch(() => {});
  }
  const q = (c) => root.querySelector('.dl-' + c);
  return { root, toggle, q, isOpen, setOpen };
}

export function createLibrary({ onOpenEffect = null, onOpenScene = null, onOpenZone = null, onOpenUi = null, onOpenSound = null, onOpenSynth = null, onOpenClip = null, onOpenModel = () => {}, onOpenPalette = () => {}, onOpenGenerator = () => {}, onOpenImage = null, full = false } = {}) {
  const problems = new Map(); // generator files that failed to load, by place:path
  const st = { places: [], place: null, items: [], kind: 'all', tags: new Set(), search: '', online: false };
  const { q, isOpen, setOpen } = mountPanel({ full });
  // st.place is the place's id (its index), as the hosts have always been handed it; requests use its slug
  const savePlace = () => (st.places.find((p) => p.save) ?? st.places[0])?.id ?? 0;
  const current = () => st.places.find((p) => p.id === st.place);
  let audio = null, playing = null;

  async function json(url, opts) {
    const r = await fetch(BASE + url, opts);
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.error || r.statusText);
    return b;
  }
  const post = (url, body) => json(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  async function loadPlaces() {
    try {
      st.places = await json('/api/places');
      st.online = true;
      if (!st.places.some((p) => p.id === st.place)) st.place = savePlace();
    } catch {
      st.online = false;
    }
    renderPlaces();
    if (st.online) await loadItems();
    else q('items').innerHTML = `<p class="dl-hint">The Dream Library isn't answering at ${esc(BASE)}. Start it with <code>node server.mjs</code> in the dream-library folder.</p>`;
    document.body.classList.toggle('dl-online', st.online);
  }

  async function loadItems() {
    q('items').innerHTML = '<p class="dl-hint">Reading…</p>';
    try {
      const r = wrapped(await json(`/api/list?wrap=1&place=${encodeURIComponent(current()?.slug ?? st.place)}`));
      st.items = r.items;
      st.truncated = r.truncated;
    } catch (e) {
      st.items = [];
      q('items').innerHTML = `<p class="dl-hint">${esc(e.message)}</p>`;
      return;
    }
    renderTags();
    renderItems();
  }

  function renderPlaces() {
    const box = q('places');
    box.innerHTML = '';
    st.places.forEach((p) => {
      const b = document.createElement('button');
      b.className = 'dl-place' + (p.id === st.place ? ' on' : '') + (p.exists ? '' : ' missing');
      b.innerHTML = `<span>${p.save ? '★ ' : ''}${esc(p.name)}${p.readonly ? ' 🔒' : ''}</span>`;
      b.title = p.path + (p.save ? '\nSaves go here' : '') + (p.readonly ? '\nRead only' : '') + (p.exists ? '' : '\n(not created yet)');
      b.onclick = () => { st.place = p.id; st.tags.clear(); renderPlaces(); loadItems(); };
      if (!p.save) {
        const x = document.createElement('i');
        x.textContent = '×';
        x.title = 'Remove this place (the folder is not touched)';
        x.onclick = async (e) => {
          e.stopPropagation();
          if (!confirm(`Remove "${p.name}" from the library? The folder and its files stay as they are.`)) return;
          await json(`/api/places?place=${encodeURIComponent(p.slug)}`, { method: 'DELETE' });
          if (st.place === p.id) st.place = savePlace();
          loadPlaces();
        };
        b.append(x);
      }
      box.append(b);
    });
  }

  function renderTags() {
    const counts = new Map();
    for (const it of st.items) for (const t of it.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    const box = q('tags');
    box.innerHTML = '';
    for (const [t, n] of [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
      const b = document.createElement('button');
      b.className = 'dl-tag' + (st.tags.has(t) ? ' on' : '');
      b.innerHTML = `${esc(t)} <i>${n}</i>`;
      b.onclick = () => { st.tags.has(t) ? st.tags.delete(t) : st.tags.add(t); renderTags(); renderItems(); };
      box.append(b);
    }
  }

  function visible() {
    const words = st.search.toLowerCase().split(/\s+/).filter(Boolean);
    return st.items
      .filter((it) => st.kind === 'all' || it.kind === st.kind || (st.kind === 'model' && it.kind === 'character'))
      .filter((it) => [...st.tags].every((t) => it.tags.includes(t)))
      .filter((it) => {
        const hay = `${it.name} ${it.path} ${it.tags.join(' ')} ${it.meta.generator ?? ''}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => b.mtime - a.mtime);
  }

  function renderItems() {
    const box = q('items'), list = visible();
    box.innerHTML = list.length ? '' : `<p class="dl-hint">${st.items.length ? 'Nothing matches.' : 'Empty. Save a piece and it lands here.'}</p>`;
    q('count').textContent = `${list.length} of ${st.items.length}${st.truncated ? '+ (list cut short)' : ''}`;
    for (const it of list) {
      const card = document.createElement('div');
      card.className = `dl-item ${it.kind}`;
      const art = document.createElement('div');
      art.className = 'dl-art';
      if (it.thumb) art.style.backgroundImage = `url("${fileUrl(st.place, it.path + '.thumb.png')}&v=${it.mtime}")`;
      else if (it.kind === 'image' || it.kind === 'texture') art.style.backgroundImage = `url("${fileUrl(st.place, it.path)}")`;
      else if (it.kind === 'ui' && it.parts?.includes('.png')) art.style.backgroundImage = `url("${fileUrl(st.place, it.path + '.png')}&v=${it.mtime}")`; // the sheet beside the .ui.json
      else if (it.kind === 'palette') art.innerHTML = Object.values(it.palette.roles).map((c) => `<span style="background:${esc(c)}"></span>`).join('');
      else art.textContent = KIND_ICON[it.kind] ?? '◆';
      const name = document.createElement('div');
      name.className = 'dl-name';
      name.textContent = it.name;
      name.title = it.path + (it.parts?.length ? `\n+ ${it.parts.join(', ')}` : '');
      const tags = document.createElement('div');
      tags.className = 'dl-tagline';
      const problem = problems.get(`${st.place}:${it.path}`);
      tags.textContent = problem ? '⚠ ' + problem : [it.meta.version > 1 ? `v${it.meta.version}` : '', ...it.tags].filter(Boolean).join(' · ');
      card.append(art, name, tags);
      if (!current()?.readonly) {
        const edit = document.createElement('button');
        edit.className = 'dl-edit';
        edit.textContent = '✎';
        edit.title = 'Edit tags';
        edit.onclick = (e) => { e.stopPropagation(); editTags(it); };
        card.append(edit);
      }
      card.onclick = () => open(it, card);
      box.append(card);
    }
  }

  async function editTags(it) {
    const next = prompt(`Tags for "${it.name}" (comma separated):`, it.tags.join(', '));
    if (next === null) return;
    const r = await post('/api/meta', { place: st.place, path: it.path, tags: next.split(',') });
    it.tags = r.meta.tags;
    it.meta = r.meta;
    renderTags();
    renderItems();
  }

  function open(it, card) {
    const url = fileUrl(st.place, it.path);
    if (it.kind === 'palette') return onOpenPalette({ ...it.palette, name: it.name, path: it.path });
    if (it.kind === 'generator') return onOpenGenerator({ ...it, place: st.place });
    // scenes are Dream World worlds: a host that opens them gets them, anywhere else they open in Dream World
    if (it.kind === 'scene') return onOpenScene ? onOpenScene({ url, item: it, place: st.place }) : window.open(`${location.protocol}//${location.hostname}:5240/?scene=${encodeURIComponent(it.place ?? st.place)}|${encodeURIComponent(it.path)}`, '_blank');
    // zones (a Dream World map split into cells, docs/zone-format.md) open in Dream World the same way
    if (it.kind === 'zone') return onOpenZone ? onOpenZone({ url, item: it, place: st.place }) : window.open(`${location.protocol}//${location.hostname}:5240/?zone=${encodeURIComponent(it.place ?? st.place)}|${encodeURIComponent(it.path)}`, '_blank');
    // game UI pieces open in Dream Paint with their guides, unless the host opens them itself
    if (it.kind === 'ui') return onOpenUi ? onOpenUi({ url, item: it, place: st.place }) : window.open(`${location.protocol}//${location.hostname}:5250/?ui=${encodeURIComponent(it.place ?? st.place)}|${encodeURIComponent(it.path)}`, '_blank');
    // effects open in Dream Effects, unless the host opens them itself
    if (it.kind === 'effect') return onOpenEffect ? onOpenEffect({ url, item: it, place: st.place }) : window.open(`${location.protocol}//${location.hostname}:5260/?fx=${encodeURIComponent(it.place ?? st.place)}|${encodeURIComponent(it.path)}`, '_blank');
    // Dream Sound's pieces open there unless the host opens them itself; sounds open there only when the host asks (else they preview)
    const inSound = (k) => window.open(`${location.protocol}//${location.hostname}:5310/?${k}=${encodeURIComponent(it.place ?? st.place)}|${encodeURIComponent(it.path)}`, '_blank');
    if (it.kind === 'synth') return onOpenSynth ? onOpenSynth({ url, item: it, place: st.place }) : inSound('synth');
    if (it.kind === 'clip') return onOpenClip ? onOpenClip({ url, item: it, place: st.place }) : inSound('clip');
    if (it.kind === 'audio' && onOpenSound) return onOpenSound({ url, item: it, place: st.place });
    if (it.kind === 'model' || it.kind === 'character') {
      if (!/\.(glb|gltf)$/i.test(it.path)) return alert('Dream modules open .glb and .gltf models. Other formats are listed so you can find them.');
      onOpenModel({ url, item: it, place: st.place });
    } else if (it.kind === 'audio') {
      // click to preview, click again to stop (Ableton style)
      if (audio) audio.pause();
      document.querySelectorAll('.dl-item.playing').forEach((c) => c.classList.remove('playing'));
      if (playing === it.path) { playing = null; return; }
      audio = new Audio(url);
      audio.play();
      playing = it.path;
      card.classList.add('playing');
      audio.onended = () => { card.classList.remove('playing'); playing = null; };
    } else if (it.kind === 'sprite' && !onOpenImage) {
      // sprites keep their layers: anywhere but a painting host, they open in Dream Paint
      window.open(`${location.protocol}//${location.hostname}:5250/?sprite=${encodeURIComponent(it.place ?? st.place)}|${encodeURIComponent(it.path)}`, '_blank');
    } else if (it.kind === 'image' || it.kind === 'texture' || it.kind === 'sprite') {
      // a host that can open images (a texture's recipe in Dream Forge) gets them; otherwise a new tab
      if (onOpenImage) onOpenImage({ url, item: it, place: st.place });
      else window.open(url, '_blank');
    }
    else alert(`${it.path}\n\nPackages are listed so you can find them; open them in Unity.`);
  }

  // ---------- wiring ----------
  const kinds = q('kinds');
  for (const k of Object.keys(KIND_NAME)) {
    const b = document.createElement('button');
    b.textContent = KIND_NAME[k];
    b.dataset.kind = k;
    b.className = k === st.kind ? 'on' : '';
    b.onclick = () => { st.kind = k; for (const c of kinds.children) c.classList.toggle('on', c.dataset.kind === k); renderItems(); };
    kinds.append(b);
  }
  q('search').oninput = (e) => { st.search = e.target.value; renderItems(); };
  q('refresh').onclick = () => loadItems();
  q('add').onclick = async () => {
    const p = prompt('Folder to add, as the library machine sees it (e.g. D:\\Public\\Unity Used Assets):');
    if (!p) return;
    const name = prompt('Name for this place:', p.split(/[\\/]/).filter(Boolean).pop());
    try {
      await post('/api/places', { path: p, name });
      loadPlaces();
    } catch (e) { alert(e.message); }
  };

  // ---------- importing photos ----------
  // Photos come in as references: redrawn at most 4096 pixels across and saved as fresh JPEGs, which
  // leaves behind everything else in the file (GPS location, camera serial numbers, dates).
  async function importPhotos(files) {
    files = [...files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    if (!st.online) return alert('The Dream Library is not reachable.');
    const folder = prompt(`Import ${files.length} photo${files.length > 1 ? 's' : ''} into which folder?`, 'References')?.trim();
    if (!folder) return;
    const tagText = prompt('Tags for them (comma separated):', 'reference');
    if (tagText === null) return;
    const tags = [...new Set(['reference', ...tagText.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)])];
    const count = q('count'), was = count.textContent;
    let done = 0;
    for (const f of files) {
      count.textContent = `importing ${++done} of ${files.length}…`;
      try {
        const bmp = await createImageBitmap(f); // turned upright from the camera's orientation flag
        const k = Math.min(1, 4096 / Math.max(bmp.width, bmp.height));
        const draw = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h); return c; };
        const full = draw(Math.round(bmp.width * k), Math.round(bmp.height * k));
        const tk = 256 / Math.max(bmp.width, bmp.height), thumb = draw(Math.round(bmp.width * tk), Math.round(bmp.height * tk));
        const b64 = (c, type, quality) => c.toDataURL(type, quality).split(',')[1];
        await post('/api/save', {
          name: f.name.replace(/\.[^.]+$/, ''), ext: '.jpg', folder,
          data: b64(full, 'image/jpeg', 0.92), thumb: b64(thumb, 'image/png'),
          meta: { kind: 'image', tags, w: full.width, h: full.height, imported: f.name },
        });
      } catch (e) { alert(`Could not import ${f.name}: ${e.message}`); }
    }
    count.textContent = was;
    st.place = savePlace();
    renderPlaces();
    loadItems();
  }
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = 'image/*';
  picker.multiple = true;
  picker.onchange = () => { importPhotos(picker.files); picker.value = ''; };
  q('import').onclick = () => picker.click();
  const panel = q('items').parentElement;
  panel.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); panel.classList.add('dl-drop'); } });
  panel.addEventListener('dragleave', () => panel.classList.remove('dl-drop'));
  panel.addEventListener('drop', (e) => { if (!e.dataTransfer?.files.length) return; e.preventDefault(); panel.classList.remove('dl-drop'); importPhotos(e.dataTransfer.files); });

  // calls that need the places wait for this first read
  const ready = loadPlaces();
  const listAll = async (kind) => {
    await ready;
    if (!st.online) return [];
    return (await listLibrary({ kind }).catch(() => ({ items: [] }))).items;
  };
  return {
    BASE,
    ready,
    get online() { return st.online; },
    toggle: () => setOpen(!isOpen()),
    show: () => setOpen(true),
    /** After a save: show the save place and its new item. */
    async refreshSaved() { st.place = savePlace(); renderPlaces(); await loadItems(); },
    refreshIfShowing(place) { if (st.place === place || current()?.slug === place) loadItems(); },
    /** All tags in the current place, for suggestions. */
    tags: () => [...new Set(st.items.flatMap((i) => i.tags))],
    /** Every item of a kind across all places (e.g. "generator", "model", "image"). */
    all: listAll,
    generators: () => listAll('generator'),
    async palettes() {
      return (await listAll('palette')).map((i) => ({ ...i.palette, name: i.name, tags: i.tags, path: i.path, place: i.place }));
    },
    flag(it, message) { problems.set(`${it.place}:${it.path}`, message); },
    versions: (place, p) => json(`/api/versions?place=${encodeURIComponent(place)}&path=${encodeURIComponent(p)}`),
    async find(place, p) { return (await json(`/api/list?place=${encodeURIComponent(place)}`)).find((i) => i.path === p); },
    /** Save a piece: { name, ext?, data (base64), parts?, thumb?, meta, folder?, overwrite? }. */
    save: (body) => post('/api/save', body),
    savePalette: (body) => post('/api/save-palette', body),
    setMeta: (body) => post('/api/meta', body),
  };
}
