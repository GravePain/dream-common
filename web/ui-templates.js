// Game UI from Dream Paint, for the game HUD and any page: a piece is "<name>.ui.json" in the Dream Library
// with its sprite sheet "<name>.ui.json.png" beside it (dream-paint/README.md has the JSON shape).
//
//   import { loadUi, nineSlice, slotRect, fillBar, putInSlot } from `${location.origin}/common/ui-templates.js`;
//   const { ui } = await loadUi(place, 'UI/Inventory.ui.json');
//   nineSlice(panel, ui, { scale: 3, size: true }); // border-image from the nine-slice insets
//   slotRect(ui, 'cell 0', 3);                       // { x, y, w, h } in CSS pixels at that scale
//   fillBar(barEl, ui, 0.6, { scale: 3 });           // a bar's frame with its fill cut to 60 %
//
// Everything is drawn pixel-crisp (image-rendering: pixelated); use whole-number scales.

import { fileUrl } from './resolve.js';

const loadImage = (src) => new Promise((ok, fail) => {
  const im = new Image();
  im.onload = () => ok(im);
  im.onerror = () => fail(new Error('could not load ' + src));
  im.src = src;
});

/**
 * A UI piece from the library: its JSON and its sheet. `place` is a place id or index, `path` the
 * ".ui.json" file. Resolves to { ui, image }; the image also rides on ui.image (not part of the JSON).
 */
export async function loadUi(place, path) {
  const r = await fetch(fileUrl(place, path));
  if (!r.ok) throw new Error(`no UI piece at ${path} (${r.status})`);
  const ui = await r.json();
  if (ui.format !== 'dream-ui') throw new Error(`${path} is not a Dream UI piece`);
  const image = await loadImage(fileUrl(place, path + (ui.sheet?.file ?? '.png')));
  return { ui: useUi(ui, image), image };
}

/** A UI piece from JSON and an image already in hand (a game bundle, a test). */
export function useUi(ui, image) {
  Object.defineProperty(ui, 'image', { value: image, enumerable: false, writable: true, configurable: true });
  return ui;
}

const cuts = new WeakMap();
const firstState = (ui) => Object.keys(ui.states ?? { normal: 0 })[0];
/** A data URL of one state of the sheet ("normal", "hover", "pressed"; "empty", "full" for a bar). Cached. */
export function stateUrl(ui, state = firstState(ui)) {
  if (!ui.image) throw new Error('load the piece with loadUi (or useUi) first');
  let m = cuts.get(ui);
  if (!m) cuts.set(ui, (m = new Map()));
  if (!m.has(state)) {
    const r = ui.states?.[state];
    if (!r) throw new Error(`${ui.name ?? ui.template} has no state "${state}"`);
    const c = document.createElement('canvas');
    c.width = r.w; c.height = r.h;
    c.getContext('2d').drawImage(ui.image, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    m.set(state, c.toDataURL('image/png'));
  }
  return m.get(state);
}

/**
 * Nine-slices one state of the piece onto an element at `scale` CSS pixels per sheet pixel.
 * With a size (`size: true` for the frame's own size times scale, or `width`/`height` in CSS pixels) the
 * slices are drawn into one crisp background at that size. Without one, or with `css: true`, it sets
 * the element's border-image from the insets instead, which follows the element's size but can show
 * faint seams at the slice lines. With no insets (an icon) the state is the background, stretched.
 */
export function nineSlice(el, ui, { scale = 1, state = firstState(ui), size = false, width = null, height = null, css = false } = {}) {
  const s = ui.slice ?? { top: 0, right: 0, bottom: 0, left: 0 }, url = stateUrl(ui, state);
  el.style.imageRendering = 'pixelated';
  el.style.boxSizing = 'border-box';
  if (size || width || height) { el.style.width = (width ?? ui.size.w * scale) + 'px'; el.style.height = (height ?? ui.size.h * scale) + 'px'; }
  if (!css && (size || width || height)) {
    // the default: the nine pieces drawn into one picture at the element's size, whole pixels only, so the
    // seams between slices never blur (border-image can show a faint line there at x2 and x3)
    el.style.borderImage = 'none';
    el.style.background = `url("${sliced(ui, state, scale, width ?? ui.size.w * scale, height ?? ui.size.h * scale)}") 0 0 / 100% 100% no-repeat`;
    return el;
  }
  if (!(s.top || s.right || s.bottom || s.left)) {
    el.style.borderImage = 'none';
    el.style.background = `url("${url}") 0 0 / 100% 100% no-repeat`;
    return el;
  }
  el.style.borderStyle = 'solid';
  el.style.borderWidth = `${s.top * scale}px ${s.right * scale}px ${s.bottom * scale}px ${s.left * scale}px`;
  el.style.borderImage = `url("${url}") ${s.top} ${s.right} ${s.bottom} ${s.left} fill / ${s.top * scale}px ${s.right * scale}px ${s.bottom * scale}px ${s.left * scale}px stretch`;
  return el;
}

/** One state nine-sliced to W x H CSS pixels at `scale` (corners and edges keep their pixel size times scale). Cached. */
function sliced(ui, state, scale, W, H) {
  const key = `9|${state}|${scale}|${W}|${H}`;
  let m = cuts.get(ui);
  if (!m) cuts.set(ui, (m = new Map()));
  if (m.has(key)) return m.get(key);
  const st = ui.states[state], s = ui.slice ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const c = document.createElement('canvas');
  c.width = Math.round(W); c.height = Math.round(H);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  // source columns and rows of the sheet, and where they land
  const sx = [0, s.left, st.w - s.right, st.w], sy = [0, s.top, st.h - s.bottom, st.h];
  const dx = [0, s.left * scale, c.width - s.right * scale, c.width], dy = [0, s.top * scale, c.height - s.bottom * scale, c.height];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const w = sx[i + 1] - sx[i], h = sy[j + 1] - sy[j], tw = dx[i + 1] - dx[i], th = dy[j + 1] - dy[j];
    if (w > 0 && h > 0 && tw > 0 && th > 0) g.drawImage(ui.image, st.x + sx[i], st.y + sy[j], w, h, dx[i], dy[j], tw, th);
  }
  const url = c.toDataURL('image/png');
  m.set(key, url);
  return url;
}

/** A named slot's rectangle in frame pixels times `scale` ({ x, y, w, h }), or null when there is none. */
export function slotRect(ui, name, scale = 1) {
  const s = ui.slots?.find((sl) => sl.name === name);
  return s ? { x: s.x * scale, y: s.y * scale, w: s.w * scale, h: s.h * scale } : null;
}

/** Makes `el` the containing block for slot children (it may not be in the page yet, so its inline style decides). */
function positioned(el) {
  const p = el.style.position || (el.isConnected ? getComputedStyle(el).position : '');
  if (!['relative', 'absolute', 'fixed', 'sticky'].includes(p)) el.style.position = 'relative';
}

/** Every slot's name, in order ("cell 0", "cell 1", …). */
export const slotNames = (ui) => (ui.slots ?? []).map((s) => s.name);

/** Places `child` absolutely over slot `name` of `el` (measured from the frame's outer corner, borders included). */
export function putInSlot(el, ui, name, child, scale = 1) {
  const r = slotRect(ui, name, scale);
  if (!r) throw new Error(`no slot "${name}"`);
  positioned(el);
  // read from the inline style: the element may not be in the page yet (computed style is empty then)
  const bl = parseFloat(el.style.borderLeftWidth) || 0, bt = parseFloat(el.style.borderTopWidth) || 0;
  Object.assign(child.style, { position: 'absolute', left: r.x - bl + 'px', top: r.y - bt + 'px', width: r.w + 'px', height: r.h + 'px', boxSizing: 'border-box' });
  el.append(child);
  return child;
}

/**
 * A bar at `fraction` (0..1): `el` shows the "empty" state at the frame's size and a child shows the
 * "full" state's fill rect cut to the fraction in the bar's direction (right, left, up, down), in whole
 * sheet pixels. Call again to change it; the child is reused.
 */
export function fillBar(el, ui, fraction, { scale = 1 } = {}) {
  const f = ui.fill ?? slotRect(ui, 'fill') ?? { x: 0, y: 0, w: ui.size.w, h: ui.size.h };
  const dir = ui.fill?.direction ?? 'right', k = Math.max(0, Math.min(1, +fraction || 0));
  const states = Object.keys(ui.states ?? {}), empty = states.includes('empty') ? 'empty' : states[0], full = states.includes('full') ? 'full' : states[0];
  positioned(el);
  Object.assign(el.style, { imageRendering: 'pixelated', width: ui.size.w * scale + 'px', height: ui.size.h * scale + 'px', background: `url("${stateUrl(ui, empty)}") 0 0 / 100% 100% no-repeat`, overflow: 'hidden', boxSizing: 'border-box' });
  let bar = el.querySelector(':scope > .ui-fill');
  if (!bar) { bar = document.createElement('div'); bar.className = 'ui-fill'; el.append(bar); }
  const horiz = dir === 'right' || dir === 'left', px = Math.round((horiz ? f.w : f.h) * k);
  const w = horiz ? px : f.w, h = horiz ? f.h : px;
  const x = dir === 'left' ? f.x + f.w - px : f.x, y = dir === 'up' ? f.y + f.h - px : f.y;
  Object.assign(bar.style, {
    position: 'absolute', imageRendering: 'pixelated', left: x * scale + 'px', top: y * scale + 'px', width: w * scale + 'px', height: h * scale + 'px',
    background: `url("${stateUrl(ui, full)}") ${-x * scale}px ${-y * scale}px / ${ui.size.w * scale}px ${ui.size.h * scale}px no-repeat`,
  });
  el.dataset.fraction = k;
  return el;
}
