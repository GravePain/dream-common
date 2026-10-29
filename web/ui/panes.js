// A tool's panels as floating windows, in one call: every `.pane` in #wins (markup the page keeps hidden)
// moves into a window, and the top bar gets the app's name, the portal link and a Window menu. The controls
// keep their ids, so the page's own script finds them as before.
//
//   <div id="wins" hidden><div class="pane" id="w-base" data-title="Base">…</div></div>
//   await mountPanes({ app: 'Dream Characters', layout: { 'w-base': [12, 44, 290, 300] } });
//
// layout: pane id → [left, top, width, height]; a negative left counts from the right edge (-12 = 12 px in).
import { createWindow } from './window.js';
import { createMenubar } from './menubar.js';

export function mountPanes({ app, layout = {}, portalPort = 5170, extraMenus = [] }) {
  const made = new Map();
  for (const pane of document.querySelectorAll('#wins > .pane')) {
    let [x, y, w, h] = layout[pane.id] ?? [12, 44, 300, 360];
    if (x < 0) x = Math.max(12, innerWidth - w + x);
    const win = createWindow({ id: pane.id.replace(/^w-/, ''), title: pane.dataset.title, content: pane, x, y, w, h });
    for (const c of pane.classList) if (c.endsWith('-win')) win.el.classList.add(c);
    made.set(pane.id, win);
  }
  createMenubar({
    app,
    portal: `${location.protocol}//${location.hostname}:${portalPort}/`,
    menus: [...extraMenus, { label: 'Window', items: 'windows' }],
  });
  return made;
}
