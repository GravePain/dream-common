// Floating windows for the Dream tools: drag by the title, resize from any edge or corner, snap to the screen
// edges and to other windows, minimise to the title, close and reopen from windowMenu(). Each window's place
// and size is remembered per app and per id in localStorage (per browser: another machine starts fresh).
//
//   const w = createWindow({ id: 'inspector', title: 'Inspector', content: el, x: 12, y: 60, w: 280, h: 400 });
//   w.body.append(...); w.show(); w.hide(); w.toggle();
//   button.onclick = (e) => windowMenu(e.currentTarget);

const SNAP = 10, MIN_W = 160, MIN_H = 60;
const all = new Map();
const stack = []; // back to front
let top = null;

const app = () => document.documentElement.dataset.app || location.pathname.split('/')[1] || 'dream';
const storeKey = (id) => `dream-ui:${app()}:win:${id}`;

function load(id) {
  try { return JSON.parse(localStorage.getItem(storeKey(id)) || 'null'); } catch { return null; }
}
function save(id, state) {
  try { localStorage.setItem(storeKey(id), JSON.stringify(state)); } catch { /* private window, storage off: nothing to remember */ }
}

/** Keep a rectangle on screen, with at least the title bar reachable. */
function clamp(r) {
  const vw = innerWidth, vh = innerHeight;
  r.w = Math.max(MIN_W, Math.min(r.w, vw));
  r.h = Math.max(MIN_H, Math.min(r.h, vh));
  r.x = Math.max(0, Math.min(r.x, vw - Math.min(r.w, 80)));
  r.y = Math.max(0, Math.min(r.y, vh - 28));
  return r;
}

/** Pull an edge to the screen edge or to another window's edge when within SNAP pixels. */
function snapRect(self, r, edges) {
  const xs = [0, innerWidth], ys = [0, innerHeight];
  for (const w of all.values()) {
    if (w === self || !w.visible) continue;
    const o = w.rect;
    xs.push(o.x, o.x + o.w);
    ys.push(o.y, o.y + o.h);
  }
  const near = (v, list) => { for (const t of list) if (Math.abs(v - t) <= SNAP) return t; return null; };
  if (edges.includes('move')) {
    const l = near(r.x, xs), rr = near(r.x + r.w, xs), t = near(r.y, ys), b = near(r.y + r.h, ys);
    if (l != null) r.x = l; else if (rr != null) r.x = rr - r.w;
    if (t != null) r.y = t; else if (b != null) r.y = b - r.h;
    return r;
  }
  if (edges.includes('e')) { const v = near(r.x + r.w, xs); if (v != null) r.w = v - r.x; }
  if (edges.includes('s')) { const v = near(r.y + r.h, ys); if (v != null) r.h = v - r.y; }
  if (edges.includes('w')) { const v = near(r.x, xs); if (v != null) { r.w += r.x - v; r.x = v; } }
  if (edges.includes('n')) { const v = near(r.y, ys); if (v != null) { r.h += r.y - v; r.y = v; } }
  return r;
}

export function createWindow({ id, title = id, content, x = 40, y = 40, w = 300, h = 360, open = true, closable = true, onShow, onHide, parent = document.body }) {
  if (all.has(id)) return all.get(id);
  const el = document.createElement('div');
  el.className = 'dw-win dream-ui';
  el.dataset.win = id;
  el.innerHTML = `<div class="dw-title"><span class="dw-name"></span><button class="dw-min" title="Minimise">&#8211;</button>${closable ? '<button class="dw-close" title="Close">&#10005;</button>' : ''}</div><div class="dw-body"></div>`;
  for (const e of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
    const g = document.createElement('div');
    g.className = 'dw-edge dw-grip ' + e;
    g.dataset.edge = e;
    el.append(g);
  }
  const titleBar = el.querySelector('.dw-title'), body = el.querySelector('.dw-body');
  el.querySelector('.dw-name').textContent = title;
  if (content) body.append(content);

  const saved = load(id);
  const win = {
    id, el, body, title,
    rect: clamp(saved?.rect ?? { x, y, w, h }),
    visible: saved?.visible ?? open,
    minimised: saved?.minimised ?? false,
    show() { win.visible = true; apply(); front(); persist(); onShow?.(win); },
    hide() { win.visible = false; apply(); persist(); onHide?.(win); },
    toggle() { win.visible ? win.hide() : win.show(); },
    setTitle(t) { win.title = t; el.querySelector('.dw-name').textContent = t; },
    minimise(on = !win.minimised) { win.minimised = on; apply(); persist(); },
    destroy() { el.remove(); all.delete(id); if (stack.includes(win)) stack.splice(stack.indexOf(win), 1); },
  };

  function apply() {
    const r = win.rect;
    el.style.left = r.x + 'px';
    el.style.top = r.y + 'px';
    el.style.width = r.w + 'px';
    el.style.height = r.h + 'px';
    el.style.display = win.visible ? '' : 'none';
    el.classList.toggle('min', win.minimised);
  }
  const persist = () => save(id, { rect: win.rect, visible: win.visible, minimised: win.minimised });
  function front() {
    if (top && top !== win) top.el.classList.remove('front');
    top = win;
    el.classList.add('front');
    // stack by z-index, not by moving the element: moving it between pointerdown and click loses the click
    stack.splice(stack.indexOf(win) >>> 0, stack.includes(win) ? 1 : 0);
    stack.push(win);
    stack.forEach((w, i) => { w.el.style.zIndex = String(20 + i); });
  }

  // drag (title) and resize (edges), one pointer at a time
  el.addEventListener('pointerdown', (e) => {
    if (top !== win) front();
    const edge = e.target.closest('.dw-edge')?.dataset.edge;
    const onTitle = !edge && e.target.closest('.dw-title') && !e.target.closest('button');
    if (!edge && !onTitle) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const start = { ...win.rect }, sx = e.clientX, sy = e.clientY;
    const move = (m) => {
      const dx = m.clientX - sx, dy = m.clientY - sy, r = { ...start };
      if (onTitle) { r.x += dx; r.y += dy; }
      else {
        if (edge.includes('e')) r.w = Math.max(MIN_W, start.w + dx);
        if (edge.includes('s')) r.h = Math.max(MIN_H, start.h + dy);
        if (edge.includes('w')) { r.w = Math.max(MIN_W, start.w - dx); r.x = start.x + start.w - r.w; }
        if (edge.includes('n')) { r.h = Math.max(MIN_H, start.h - dy); r.y = start.y + start.h - r.h; }
      }
      win.rect = clamp(m.altKey ? r : snapRect(win, r, onTitle ? ['move'] : edge.split('')));
      apply();
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      persist();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
  titleBar.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) win.minimise(); });
  el.querySelector('.dw-min').addEventListener('click', () => win.minimise());
  el.querySelector('.dw-close')?.addEventListener('click', () => win.hide());

  all.set(id, win);
  parent.append(el);
  apply();
  if (win.visible) front();
  return win;
}

/** Every window made on this page, by id. */
export const windows = () => [...all.values()];

/** A small menu under `anchor` listing every window, ticked when open; clicking toggles it. */
export function windowMenu(anchor) {
  document.querySelector('.dw-menu')?.remove();
  const m = document.createElement('div');
  m.className = 'dw-menu dream-ui';
  for (const w of all.values()) {
    const b = document.createElement('button');
    b.className = w.visible ? 'open' : 'shut';
    b.textContent = w.title;
    b.onclick = () => { w.toggle(); m.remove(); };
    m.append(b);
  }
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.min(r.left, innerWidth - 180) + 'px';
  m.style.top = r.bottom + 4 + 'px';
  document.body.append(m);
  setTimeout(() => addEventListener('pointerdown', function off(e) {
    if (!m.contains(e.target)) { m.remove(); removeEventListener('pointerdown', off); }
  }));
  return m;
}

// windows stay reachable when the browser shrinks
addEventListener('resize', () => {
  for (const w of all.values()) {
    w.rect = clamp(w.rect);
    w.el.style.left = w.rect.x + 'px';
    w.el.style.top = w.rect.y + 'px';
    w.el.style.width = w.rect.w + 'px';
    w.el.style.height = w.rect.h + 'px';
  }
});
