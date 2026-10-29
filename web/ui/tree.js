// A hierarchy tree for the Dream tools: expand and collapse, select (click, Ctrl+click adds, Shift+click a
// range), rename with F2 or a double-click on the name, drag to reparent or reorder, an eye to hide and show,
// and a search box. It owns no data: the app hands it nodes and hears back through callbacks.
//
//   const tree = createTree({
//     items: () => [{ id: 'g1', label: 'Rocks', children: [{ id: 'o4', label: 'Boulder', visible: true }] }],
//     onSelect: (ids) => ..., onRename: (id, name) => ..., onMove: (ids, { parent, before }) => ...,
//     onVisible: (id, on) => ..., onActivate: (id) => frame(id),
//   });
//   panel.append(tree.el); tree.refresh(); tree.select(['o4']);
//
// A node: { id, label, sub?, icon?, children?, open?, visible? (undefined: no eye), selectable = true,
// draggable = true, drop = true (takes children), rename = true }. onMove's `parent` is a node id or null (a
// root), `before` the sibling it lands in front of or null (the end).

export function createTree({ items, onSelect, onRename, onMove, onVisible, onActivate, search = true, empty = 'Nothing here yet.' }) {
  const el = document.createElement('div');
  el.className = 'dt-tree dream-ui';
  el.innerHTML = `${search ? '<input class="dt-search" type="search" placeholder="Search" spellcheck="false">' : ''}<div class="dt-rows" tabindex="0"></div>`;
  const rows = el.querySelector('.dt-rows'), find = el.querySelector('.dt-search');
  const st = { selected: new Set(), anchor: null, open: new Map(), query: '', flat: [], byId: new Map(), parentOf: new Map(), drag: null };

  // ---- drawing ----
  function refresh() {
    const roots = items() ?? [];
    st.byId.clear(); st.parentOf.clear(); st.flat = [];
    const index = (list, parent) => { for (const n of list) { st.byId.set(n.id, n); st.parentOf.set(n.id, parent); if (n.children) index(n.children, n.id); } };
    index(roots, null);
    for (const id of [...st.selected]) if (!st.byId.has(id)) st.selected.delete(id);
    const q = st.query.toLowerCase();
    const matches = (n) => !q || n.label.toLowerCase().includes(q) || (n.children ?? []).some(matches);
    rows.replaceChildren();
    const draw = (list, depth) => {
      for (const n of list) {
        if (!matches(n)) continue;
        const kids = n.children ?? [];
        const open = q ? true : st.open.get(n.id) ?? n.open ?? false;
        st.flat.push(n.id);
        rows.append(row(n, depth, kids.length > 0, open));
        if (kids.length && open) draw(kids, depth + 1);
      }
    };
    draw(roots, 0);
    if (!st.flat.length) rows.innerHTML = `<p class="dt-empty">${q ? 'Nothing matches.' : empty}</p>`;
  }

  function row(n, depth, hasKids, open) {
    const r = document.createElement('div');
    r.className = 'dt-row' + (st.selected.has(n.id) ? ' sel' : '') + (n.selectable === false ? ' folder' : '') + (n.visible === false ? ' hid' : '');
    r.dataset.id = n.id;
    r.style.paddingLeft = 4 + depth * 14 + 'px';
    r.draggable = n.draggable !== false;
    const tw = document.createElement('span');
    tw.className = 'dt-twist' + (hasKids ? (open ? ' open' : '') : ' none');
    tw.onclick = (e) => { e.stopPropagation(); st.open.set(n.id, !open); refresh(); };
    const icon = document.createElement('span');
    icon.className = 'dt-icon';
    icon.textContent = n.icon ?? '';
    const name = document.createElement('span');
    name.className = 'dt-name';
    name.textContent = n.label;
    r.append(tw, icon, name);
    if (n.sub) { const s = document.createElement('span'); s.className = 'dt-sub'; s.textContent = n.sub; r.append(s); }
    if (n.visible !== undefined) {
      const eye = document.createElement('button');
      eye.className = 'dt-eye';
      eye.title = n.visible ? 'Hide' : 'Show';
      eye.textContent = n.visible ? '\u{1F441}' : '–';
      eye.onclick = (e) => { e.stopPropagation(); onVisible?.(n.id, !n.visible); };
      r.append(eye);
    }
    return r;
  }

  // ---- selection ----
  function setSelection(ids, notify = true) {
    st.selected = new Set(ids.filter((id) => st.byId.get(id)?.selectable !== false));
    for (const r of rows.querySelectorAll('.dt-row')) r.classList.toggle('sel', st.selected.has(r.dataset.id));
    if (notify) onSelect?.([...st.selected]);
  }
  rows.addEventListener('click', (e) => {
    const r = e.target.closest('.dt-row');
    if (!r) { if (e.target === rows) setSelection([]); return; }
    const id = r.dataset.id, n = st.byId.get(id);
    rows.focus();
    if (n.selectable === false) { st.open.set(id, !(st.open.get(id) ?? n.open ?? false)); refresh(); return; }
    if (e.shiftKey && st.anchor && st.flat.includes(st.anchor)) {
      const a = st.flat.indexOf(st.anchor), b = st.flat.indexOf(id);
      const range = st.flat.slice(Math.min(a, b), Math.max(a, b) + 1);
      setSelection(e.ctrlKey || e.metaKey ? [...st.selected, ...range] : range);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(st.selected);
      next.has(id) ? next.delete(id) : next.add(id);
      st.anchor = id;
      setSelection([...next]);
      return;
    }
    st.anchor = id;
    setSelection([id]);
  });
  rows.addEventListener('dblclick', (e) => {
    const r = e.target.closest('.dt-row');
    if (!r) return;
    if (e.target.closest('.dt-name') && st.byId.get(r.dataset.id)?.rename !== false && onRename) rename(r.dataset.id);
    else onActivate?.(r.dataset.id);
  });

  // ---- rename ----
  function rename(id) {
    const n = st.byId.get(id), r = rows.querySelector(`.dt-row[data-id="${CSS.escape(id)}"]`);
    if (!n || !r || n.rename === false || !onRename) return;
    const name = r.querySelector('.dt-name'), input = document.createElement('input');
    input.type = 'text';
    input.className = 'dt-rename';
    input.value = n.label;
    name.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (keep) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (keep && v && v !== n.label) onRename(id, v);
      refresh();
      rows.focus();
    };
    input.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); };
    input.onblur = () => finish(true);
  }
  rows.addEventListener('keydown', (e) => {
    if (e.target !== rows) return;
    if (e.key === 'F2' && st.selected.size) { e.preventDefault(); rename([...st.selected].pop()); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const cur = st.flat.indexOf([...st.selected].pop()), next = st.flat[Math.max(0, Math.min(st.flat.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (next) { st.anchor = next; setSelection([next]); }
    }
  });

  // ---- drag to reparent or reorder ----
  const clearMarks = () => rows.querySelectorAll('.dt-row.over, .dt-row.above, .dt-row.below').forEach((r) => r.classList.remove('over', 'above', 'below'));
  const ancestors = (id) => { const out = []; for (let p = st.parentOf.get(id); p != null; p = st.parentOf.get(p)) out.push(p); return out; };
  rows.addEventListener('dragstart', (e) => {
    const r = e.target.closest('.dt-row');
    if (!r) return;
    const id = r.dataset.id;
    if (!st.selected.has(id)) setSelection([id]);
    st.drag = [...st.selected].filter((x) => st.byId.get(x)?.draggable !== false);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', st.drag.join(','));
  });
  function where(e) {
    const r = e.target.closest('.dt-row');
    if (!r) return { parent: null, before: null, row: null };
    const id = r.dataset.id, n = st.byId.get(id), box = r.getBoundingClientRect(), y = (e.clientY - box.top) / box.height;
    if (st.drag?.includes(id) || st.drag?.some((d) => ancestors(id).includes(d))) return null; // never into itself
    if (n.drop !== false && y > 0.25 && y < 0.75) return { parent: id, before: null, row: r, mark: 'over' };
    const parent = st.parentOf.get(id) ?? null;
    if (parent != null && st.byId.get(parent)?.selectable === false && n.drop === false) return { parent, before: null, row: r, mark: 'over' };
    const sibs = (parent == null ? items() : st.byId.get(parent).children ?? []).map((s) => s.id);
    if (y <= 0.5) return { parent, before: id, row: r, mark: 'above' };
    return { parent, before: sibs[sibs.indexOf(id) + 1] ?? null, row: r, mark: 'below' };
  }
  rows.addEventListener('dragover', (e) => {
    if (!st.drag) return;
    const w = where(e);
    clearMarks();
    if (!w) return;
    e.preventDefault();
    w.row?.classList.add(w.mark);
  });
  rows.addEventListener('dragleave', (e) => { if (!rows.contains(e.relatedTarget)) clearMarks(); });
  rows.addEventListener('drop', (e) => {
    const w = st.drag && where(e), ids = st.drag;
    clearMarks();
    st.drag = null;
    if (!w) return;
    e.preventDefault();
    if (w.parent != null) st.open.set(w.parent, true);
    onMove?.(ids, { parent: w.parent, before: w.before });
  });
  rows.addEventListener('dragend', () => { st.drag = null; clearMarks(); });

  find?.addEventListener('input', () => { st.query = find.value.trim(); refresh(); });

  return {
    el,
    refresh,
    /** Select ids (without calling onSelect), opening their parents so they show. */
    select(ids) {
      for (const id of ids) for (const p of ancestors(id)) st.open.set(p, true);
      st.selected = new Set(ids);
      st.anchor = ids[ids.length - 1] ?? null;
      refresh();
      rows.querySelector('.dt-row.sel')?.scrollIntoView({ block: 'nearest' });
    },
    get selection() { return [...st.selected]; },
    expand(id, open = true) { st.open.set(id, open); refresh(); },
    rename,
  };
}
