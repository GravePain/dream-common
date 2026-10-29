// The top bar for the Dream tools: the app's name in its accent, File / Edit / View / Window menus (or any
// others), the link back to the portal, and a slot on the right for the app's own controls.
//
//   const bar = createMenubar({ app: 'Dream World', portal: portalHref, menus: [
//     { label: 'File', items: [{ label: 'Save', key: 'Ctrl+S', run: save }, '-', { label: 'Open zone…', run: openZone }] },
//     { label: 'Window', items: 'windows' },          // every window from window.js, ticked when open
//   ] });
//   bar.slot.append(myControls);
//
// An item: { label, key? (shown only; the app binds its own keys), run, disabled?: () => bool, checked?: () => bool }.
// '-' is a separator. A menu opens on click; while one is open, hovering another opens that one.
import { windows } from './window.js';

export function createMenubar({ app, portal = null, menus = [], parent = document.body }) {
  const el = document.createElement('header');
  el.className = 'dm-bar dream-ui';
  if (portal) {
    const a = document.createElement('a');
    a.className = 'dm-portal';
    a.href = portal;
    a.title = 'Back to the portal';
    a.textContent = '← Portal';
    el.append(a);
  }
  const brand = document.createElement('span');
  brand.className = 'dream-brand dm-app';
  brand.textContent = app;
  el.append(brand);
  const heads = [];
  let openMenu = null;

  function close() {
    openMenu?.list.remove();
    openMenu?.head.classList.remove('on');
    openMenu = null;
  }
  function open(m, head) {
    close();
    const list = document.createElement('div');
    list.className = 'dm-list dream-ui';
    const items = m.items === 'windows'
      ? windows().map((w) => ({ label: w.title, run: () => (w.visible ? w.hide() : w.show()), checked: () => w.visible }))
      : typeof m.items === 'function' ? m.items() : m.items;
    for (const it of items) {
      if (it === '-') { list.append(Object.assign(document.createElement('hr'), { className: 'dm-sep' })); continue; }
      const b = document.createElement('button');
      const off = it.disabled?.() ?? false;
      b.disabled = off;
      b.className = it.checked ? (it.checked() ? 'dm-check on' : 'dm-check') : '';
      b.innerHTML = '<span class="dm-label"></span><span class="dm-key"></span>';
      b.querySelector('.dm-label').textContent = it.label;
      b.querySelector('.dm-key').textContent = it.key ?? '';
      b.onclick = () => { close(); it.run?.(); };
      list.append(b);
    }
    const r = head.getBoundingClientRect();
    list.style.left = Math.min(r.left, innerWidth - 220) + 'px';
    list.style.top = r.bottom + 2 + 'px';
    document.body.append(list);
    head.classList.add('on');
    openMenu = { list, head };
  }
  for (const m of menus) {
    const head = document.createElement('button');
    head.className = 'dm-head';
    head.textContent = m.label;
    head.onclick = () => (openMenu?.head === head ? close() : open(m, head));
    head.onpointerenter = () => { if (openMenu && openMenu.head !== head) open(m, head); };
    el.append(head);
    heads.push(head);
  }
  const slot = document.createElement('div');
  slot.className = 'dm-slot';
  el.append(slot);
  addEventListener('pointerdown', (e) => { if (openMenu && !openMenu.list.contains(e.target) && !heads.includes(e.target)) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && openMenu) { e.stopPropagation(); close(); } }, true);
  parent.prepend(el);
  return { el, slot, close };
}
