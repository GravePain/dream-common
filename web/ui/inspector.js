// Inspector rows for the Dream tools, drawn from a field list: the same { key, label, type, min, max, step,
// options, default } shapes as dream-common/web/schema, so a component's fields render with no second
// description. Numbers drag-scrub (drag the label left / right; Shift for fine, Ctrl for coarse).
//
//   const panel = fields(COMPONENTS.light, entity.components.light, (path, value, done) => { ... });
//   section.append(panel.el);  panel.set(newValue);   // update the shown values without rebuilding
//   const box = section('Light', { onRemove: () => ..., open: true });
//
// Field types: number / int (scrub; `slider: true` draws a slider when it has min and max), string, bool
// (toggle), enum (select), color, vector3 (or any object whose fields are x, y, z / x, z numbers), object
// (a nested group), anything else (array, map, any) as JSON text. `onChange(path, value, done)`: `done` is
// false while a scrub or slider is moving and true when it lets go, so the app makes one undo step.

const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const fmt = (v, step) => { const d = step >= 1 ? 0 : Math.min(4, Math.max(0, -Math.floor(Math.log10(step ?? 0.01)))); return (+v).toFixed(d).replace(/\.?0+$/, '') || '0'; };
const clampTo = (f, v) => { if (f.min !== undefined) v = Math.max(f.min, v); if (f.max !== undefined) v = Math.min(f.max, v); return f.type === 'int' ? Math.round(v) : v; };
const isVector = (f) => f.type === 'vector3' || (f.type === 'object' && f.fields?.length >= 2 && f.fields.length <= 3 && f.fields.every((g, i) => (g.type === 'number' || g.type === 'int') && g.key === ['x', f.fields.length === 2 ? 'z' : 'y', 'z'][i]));

/** A number box whose label drag-scrubs it. `onChange(v, done)`. Returns { el (the input), grip, set(v) }. */
export function numberInput(f, value, onChange, grip = null) {
  const input = make('input');
  input.type = 'number';
  input.step = String(f.step ?? (f.type === 'int' ? 1 : 0.01));
  if (f.min !== undefined) input.min = String(f.min);
  if (f.max !== undefined) input.max = String(f.max);
  const set = (v) => { if (document.activeElement !== input) input.value = v === undefined || v === null ? '' : fmt(v, f.step ?? 0.01); };
  set(value ?? f.default);
  input.onchange = () => { if (input.value !== '' && Number.isFinite(+input.value)) { const v = clampTo(f, +input.value); onChange(v, true); set(v); } };
  input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); e.stopPropagation(); };
  if (grip) {
    grip.classList.add('di-scrub');
    grip.title = (grip.title ? grip.title + '\n' : '') + 'Drag left or right (Shift fine, Ctrl coarse)';
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      const x0 = e.clientX, v0 = +input.value || 0, step = f.step ?? (f.type === 'int' ? 1 : 0.01);
      let moved = false, last = v0;
      const move = (m) => {
        const k = m.shiftKey ? 0.1 : m.ctrlKey ? 10 : 1, dx = m.clientX - x0;
        if (Math.abs(dx) < 2 && !moved) return;
        moved = true;
        last = clampTo(f, v0 + Math.round(dx / 3) * step * k);
        input.value = fmt(last, step);
        onChange(last, false);
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
        if (moved) onChange(last, true);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });
  }
  return { el: input, grip, set };
}

/** One labelled row: label on the left, control(s) on the right. */
export function row(label, ...controls) {
  const r = make('div', 'di-row');
  const l = make('label', 'di-label', label);
  const c = make('div', 'di-ctl');
  c.append(...controls);
  r.append(l, c);
  return r;
}

/** A collapsible section with a title (and a remove button when `onRemove` is given). Returns { el, body }. */
export function section(title, { open = true, onRemove = null, sub = '' } = {}) {
  const el = make('div', 'di-section' + (open ? ' open' : ''));
  const head = make('div', 'di-head');
  const tw = make('span', 'di-twist');
  const t = make('span', 'di-title', title);
  head.append(tw, t);
  if (sub) head.append(make('span', 'di-sub', sub));
  if (onRemove) {
    const x = make('button', 'di-remove', '✕');
    x.title = `Remove ${title}`;
    x.onclick = (e) => { e.stopPropagation(); onRemove(); };
    head.append(x);
  }
  head.onclick = () => el.classList.toggle('open');
  const body = make('div', 'di-body');
  el.append(head, body);
  return { el, body };
}

/**
 * Rows for a field list over `value`. `onChange(path, v, done)`, path like "size.x". Returns { el, set(value) }
 * where set() puts new values in the rows without rebuilding them (a field being typed in is left alone).
 */
export function fields(list, value = {}, onChange = () => {}, { prefix = '' } = {}) {
  const el = make('div', 'di-fields');
  const syncs = [];
  for (const f of list) {
    const path = prefix + f.key, v = value?.[f.key];
    const at = (o) => o?.[f.key];
    if (f.type === 'number' || f.type === 'int') {
      if (f.slider && f.min !== undefined && f.max !== undefined) {
        const s = make('input');
        Object.assign(s, { type: 'range', min: f.min, max: f.max, step: f.step ?? 0.01 });
        const out = make('span', 'di-val');
        const set = (x) => { s.value = String(x ?? f.default ?? f.min); out.textContent = fmt(+s.value, f.step ?? 0.01); };
        set(v);
        s.oninput = () => { out.textContent = fmt(+s.value, f.step ?? 0.01); onChange(path, clampTo(f, +s.value), false); };
        s.onchange = () => onChange(path, clampTo(f, +s.value), true);
        el.append(row(f.label ?? f.key, s, out));
        syncs.push((o) => set(at(o)));
      } else {
        const r = row(f.label ?? f.key);
        const n = numberInput(f, v, (x, done) => onChange(path, x, done), r.querySelector('.di-label'));
        r.querySelector('.di-ctl').append(n.el);
        el.append(r);
        syncs.push((o) => n.set(at(o)));
      }
    } else if (isVector(f)) {
      const keys = f.fields ? f.fields.map((g) => g.key) : ['x', 'y', 'z'];
      const r = row(f.label ?? f.key);
      r.classList.add('di-vec');
      const parts = keys.map((k) => {
        const sub = f.fields?.find((g) => g.key === k) ?? { key: k, type: 'number', step: f.step ?? 0.01 };
        const tag = make('span', 'di-axis ' + k, k.toUpperCase());
        const n = numberInput(sub, v?.[k], (x, done) => onChange(`${path}.${k}`, x, done), tag);
        r.querySelector('.di-ctl').append(tag, n.el);
        return [k, n];
      });
      el.append(r);
      syncs.push((o) => { for (const [k, n] of parts) n.set(at(o)?.[k]); });
    } else if (f.type === 'bool') {
      const c = make('input');
      c.type = 'checkbox';
      c.checked = !!(v ?? f.default);
      c.onchange = () => onChange(path, c.checked, true);
      el.append(row(f.label ?? f.key, c));
      syncs.push((o) => { c.checked = !!(at(o) ?? f.default); });
    } else if (f.type === 'enum') {
      const s = make('select');
      for (const o of f.options) s.append(new Option(String(o), String(o)));
      s.value = String(v ?? f.default ?? f.options[0]);
      s.onchange = () => onChange(path, f.options.find((o) => String(o) === s.value), true);
      el.append(row(f.label ?? f.key, s));
      syncs.push((o) => { s.value = String(at(o) ?? f.default ?? f.options[0]); });
    } else if (f.type === 'color') {
      const c = make('input');
      c.type = 'color';
      c.value = v ?? f.default ?? '#ffffff';
      c.oninput = () => onChange(path, c.value, false);
      c.onchange = () => onChange(path, c.value, true);
      el.append(row(f.label ?? f.key, c));
      syncs.push((o) => { c.value = at(o) ?? f.default ?? '#ffffff'; });
    } else if (f.type === 'string') {
      const t = make('input');
      t.type = 'text';
      t.value = v ?? f.default ?? '';
      t.onchange = () => onChange(path, t.value, true);
      t.onkeydown = (e) => { if (e.key === 'Enter') t.blur(); e.stopPropagation(); };
      el.append(row(f.label ?? f.key, t));
      syncs.push((o) => { if (document.activeElement !== t) t.value = at(o) ?? f.default ?? ''; });
    } else if (f.type === 'object' && f.fields) {
      const group = make('div', 'di-group');
      group.append(make('div', 'di-grouphead', f.label ?? f.key));
      const inner = fields(f.fields, v ?? {}, onChange, { prefix: path + '.' });
      group.append(inner.el);
      el.append(group);
      syncs.push((o) => inner.set(at(o) ?? {}));
    } else {
      const t = make('textarea', 'di-json');
      t.rows = 2;
      t.spellcheck = false;
      const show = (x) => { if (document.activeElement !== t) t.value = x === undefined ? '' : JSON.stringify(x); };
      show(v);
      t.onchange = () => { try { onChange(path, t.value.trim() ? JSON.parse(t.value) : undefined, true); t.classList.remove('bad'); } catch { t.classList.add('bad'); } };
      t.onkeydown = (e) => e.stopPropagation();
      el.append(row(f.label ?? f.key, t));
      syncs.push((o) => show(at(o)));
    }
  }
  return { el, set: (o) => { for (const s of syncs) s(o); } };
}

/** A "+ Add" button that opens a list of names; `pick(name)`. `names()` is read each time it opens. */
export function addMenu(label, names, pick) {
  const wrap = make('div', 'di-add');
  const b = make('button', '', label);
  b.onclick = () => {
    wrap.querySelector('.di-addlist')?.remove();
    const list = make('div', 'di-addlist');
    const all = names();
    if (!all.length) list.append(make('div', 'di-none', 'Nothing more to add.'));
    for (const n of all) {
      const it = make('button', '', n);
      it.onclick = () => { list.remove(); pick(n); };
      list.append(it);
    }
    wrap.append(list);
    setTimeout(() => addEventListener('pointerdown', function off(e) { if (!wrap.contains(e.target)) { list.remove(); removeEventListener('pointerdown', off); } }));
  };
  wrap.append(b);
  return wrap;
}
