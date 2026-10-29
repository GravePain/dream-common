// One status line for every Dream tool: toast('Saved'), toast('Dream Library (5230) not reachable', { kind: 'bad', key: 'library' }).
// A toast with a key replaces the one already showing under that key, so a repeated warning never stacks up.
// `ms: 0` keeps it until it is closed (clicked) or replaced.

let box = null;
const byKey = new Map();

function host() {
  if (box && box.isConnected) return box;
  box = document.createElement('div');
  box.className = 'dream-toasts';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  document.body.append(box);
  return box;
}

/** Show a message. kind: 'info' (default) | 'good' | 'warn' | 'bad'. Returns a function that closes it. */
export function toast(text, { kind = 'info', ms = 4000, key } = {}) {
  if (key && byKey.has(key)) byKey.get(key)();
  const el = document.createElement('div');
  el.className = 'dream-toast ' + kind;
  el.textContent = text;
  host().append(el);
  let timer = 0;
  const close = () => {
    clearTimeout(timer);
    if (key && byKey.get(key) === close) byKey.delete(key);
    el.classList.add('fade');
    setTimeout(() => el.remove(), 300);
  };
  el.addEventListener('click', close);
  if (key) byKey.set(key, close);
  if (ms > 0) timer = setTimeout(close, ms);
  return close;
}

/** Close the toast showing under a key, if any (say when the library answers again). */
export function clearToast(key) {
  byKey.get(key)?.();
}

/**
 * Ask the Dream Library whether it answers (through this page's own /dl/), and toast if not.
 * Returns true when it answers. Every tool calls this once at start.
 */
export async function checkLibrary(base = `${location.origin}/dl`) {
  try {
    const r = await fetch(`${base}/api/places`, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.statusText);
    clearToast('library');
    return true;
  } catch {
    toast('Dream Library (5230) not reachable: start it first, then reload.', { kind: 'bad', ms: 0, key: 'library' });
    return false;
  }
}
