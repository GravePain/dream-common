// Dream audio: the one small runtime that plays Dream Sound's output, in the tool and in the game.
// Web Audio only, no dependencies. What Dream Sound previews goes through these same functions, so what
// the editor plays is what the game plays.
//
//   import * as audio from `${location.origin}/common/audio.js`;
//   const hit = await audio.loadSound('creations', 'Sounds/Hit.wav');
//   audio.play(hit, { gain: 0.8, rate: 1.1, pan: -0.3 });
//   audio.synthNote(preset, 60, 0.5);                 // a .synth.json preset, MIDI note, seconds
//   const clip = await audio.loadClip('creations', 'Clips/Beat.clip.json');
//   const h = audio.playClip(clip, { loop: true });   // h.stop()
//
// Pieces are addressed by place (its slug or index) and path, as everywhere else in the Library.
// The one AudioContext is made on the first click or key press (browsers keep audio silent until then);
// anything played before that waits for it.

const BASE = `${location.origin}/dl`;
export const fileUrl = (place, p) => `${BASE}/api/file?place=${encodeURIComponent(place)}&path=${encodeURIComponent(p)}`;

// ---------- the context ----------
let ctx = null;
/** The page's AudioContext, made on first use; resumed on the first user gesture. */
export function context() {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' });
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
const unlock = () => { context(); removeEventListener('pointerdown', unlock, true); removeEventListener('keydown', unlock, true); };
addEventListener('pointerdown', unlock, true);
addEventListener('keydown', unlock, true);

// decoding needs no running context, so it never makes the real one before a gesture
let decoder = null;
export function decode(arrayBuffer) {
  decoder ??= new OfflineAudioContext(2, 1, 48000);
  return decoder.decodeAudioData(arrayBuffer);
}

// ---------- sounds ----------
const sounds = new Map();
/** A Library sound as an AudioBuffer (cached by place and path). */
export function loadSound(place, path) {
  const key = `${place}|${path}`;
  if (!sounds.has(key)) {
    sounds.set(key, fetch(fileUrl(place, path)).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.arrayBuffer();
    }).then(decode).catch((e) => { sounds.delete(key); throw e; }));
  }
  return sounds.get(key);
}

/**
 * Play an AudioBuffer. { gain = 1, rate = 1, pan = 0, when (context time, default now), ctx, dest, chain }.
 * `chain` is a filter chain (see applyChain). Returns the source node (call .stop() to cut it).
 */
export function play(buffer, { gain = 1, rate = 1, pan = 0, when, ctx: c = context(), dest = c.destination, chain = null } = {}) {
  const t = when ?? c.currentTime;
  const out = c.createGain();
  out.gain.value = gain;
  let tail = out;
  if (pan) { const p = c.createStereoPanner(); p.pan.value = pan; out.connect(p); tail = p; }
  tail.connect(dest);
  const { source } = applyChain(c, buffer, chain ?? [], { when: t, dest: out, rate });
  source.start(t);
  return source;
}

// ---------- filters ----------
/** The filters Dream Sound offers, with their parameters' defaults. Order in a chain is the signal order. */
export const FILTERS = {
  lowpass: { freq: 2000, q: 0.7 },
  highpass: { freq: 200, q: 0.7 },
  echo: { time: 0.25, feedback: 0.35, mix: 0.35 },
  reverb: { seconds: 1.8, decay: 3, mix: 0.3 },
  gate: { threshold: -40, hold: 0.05 },
  gain: { db: 0 },
  pitch: { rate: 1 },
};

const impulses = new WeakMap();
/** A reverb impulse made from seeded noise with an exponential tail (no file needed). */
function impulse(c, seconds, decay) {
  let byCtx = impulses.get(c);
  if (!byCtx) impulses.set(c, (byCtx = new Map()));
  const key = `${seconds}|${decay}`;
  if (byCtx.has(key)) return byCtx.get(key);
  const n = Math.max(1, Math.round(c.sampleRate * seconds)), b = c.createBuffer(2, n, c.sampleRate);
  const rng = mulberry32(1234);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (rng() * 2 - 1) * Math.pow(1 - i / n, decay);
  }
  byCtx.set(key, b);
  return b;
}

/** Gain points for a gate: closed where the buffer's level stays under the threshold (dB) for longer than `hold`. */
function gatePoints(buffer, threshold, hold) {
  const d = buffer.getChannelData(0), win = Math.max(1, Math.round(buffer.sampleRate * 0.01)), lim = Math.pow(10, threshold / 20);
  const pts = [];
  let open = null, quiet = 0;
  for (let i = 0; i < d.length; i += win) {
    let peak = 0;
    for (let k = i; k < Math.min(d.length, i + win); k++) peak = Math.max(peak, Math.abs(d[k]));
    const loud = peak >= lim, t = i / buffer.sampleRate;
    quiet = loud ? 0 : quiet + win / buffer.sampleRate;
    const want = loud || quiet < hold;
    if (want !== open) { pts.push([t, want ? 1 : 0]); open = want; }
  }
  return pts;
}

/**
 * Wire `buffer` through a filter chain ([{ type: 'lowpass', freq, q }, …]) into `dest`, on any context
 * (live or offline). Returns { source, duration }: start the source yourself at `when`; duration includes
 * echo and reverb tails.
 */
export function applyChain(c, buffer, chain, { when = 0, dest = c.destination, rate = 1 } = {}) {
  const source = c.createBufferSource();
  source.buffer = buffer;
  let r = rate, tail = 0;
  for (const f of chain) if (f.type === 'pitch') r *= f.rate ?? 1;
  source.playbackRate.value = r;
  let node = source;
  const link = (n) => { node.connect(n); node = n; return n; };
  const mixed = (wet, mix) => {
    // dry + wet into one gain
    const sum = c.createGain(), dry = c.createGain(), w = c.createGain();
    dry.gain.value = 1 - mix * 0.5;
    w.gain.value = mix;
    node.connect(dry); dry.connect(sum);
    node.connect(wet.input); wet.output.connect(w); w.connect(sum);
    node = sum;
  };
  for (const f of chain) {
    const p = { ...FILTERS[f.type], ...f };
    if (f.type === 'lowpass' || f.type === 'highpass') {
      const b = c.createBiquadFilter();
      b.type = f.type; b.frequency.value = p.freq; b.Q.value = p.q;
      link(b);
    } else if (f.type === 'gain') {
      const g = c.createGain();
      g.gain.value = Math.pow(10, p.db / 20);
      link(g);
    } else if (f.type === 'gate') {
      const g = c.createGain();
      g.gain.setValueAtTime(0, when);
      for (const [t, v] of gatePoints(buffer, p.threshold, p.hold)) g.gain.setTargetAtTime(v, when + t / r, 0.004);
      link(g);
    } else if (f.type === 'echo') {
      const d = c.createDelay(4), fb = c.createGain();
      d.delayTime.value = p.time; fb.gain.value = Math.min(0.95, p.feedback);
      d.connect(fb); fb.connect(d);
      mixed({ input: d, output: d }, p.mix);
      tail += p.time * Math.log(0.001) / Math.log(Math.max(0.01, Math.min(0.95, p.feedback)));
    } else if (f.type === 'reverb') {
      const cv = c.createConvolver();
      cv.buffer = impulse(c, p.seconds, p.decay);
      mixed({ input: cv, output: cv }, p.mix);
      tail += p.seconds;
    }
  }
  node.connect(dest);
  return { source, duration: buffer.duration / r + Math.min(tail, 8) };
}

// ---------- the synth ----------
/** A plain starting preset; a .synth.json holds the same fields. */
export const DEFAULT_SYNTH = {
  format: 'dream-synth', name: 'Init', osc: 'saw', gain: 0.5,
  amp: { a: 0.01, d: 0.2, s: 0.6, r: 0.3 },
  filter: { type: 'lowpass', cutoff: 1200, q: 2, env: 2, a: 0.01, d: 0.3, s: 0.2, r: 0.3 },
  lfo: { target: 'off', rate: 5, depth: 20 },
};
export const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);

const noises = new WeakMap();
function noiseBuffer(c) {
  if (!noises.has(c)) {
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0), rng = mulberry32(99);
    for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1;
    noises.set(c, b);
  }
  return noises.get(c);
}

/** Hold a target value with an ADSR from t: rise to peak, fall to sustain, release from tOff. */
function adsr(param, t, tOff, { a, d, s, r }, base, peak) {
  param.setValueAtTime(base, t);
  param.linearRampToValueAtTime(peak, t + Math.max(0.001, a));
  param.setTargetAtTime(base + (peak - base) * s, t + a, Math.max(0.001, d) / 3);
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(tOff);
  else param.setValueAtTime(base + (peak - base) * s, tOff);
  param.setTargetAtTime(base, tOff, Math.max(0.001, r) / 3);
}

/**
 * Play one note of a synth preset: MIDI `note`, held for `duration` seconds (plus release).
 * { when, ctx, dest, velocity = 1 }. Works on an OfflineAudioContext too (that is how notes render).
 * Returns the time the note has died away.
 */
export function synthNote(preset, note, duration, { when, ctx: c = context(), dest = c.destination, velocity = 1 } = {}) {
  const p = { ...DEFAULT_SYNTH, ...preset };
  const amp = { ...DEFAULT_SYNTH.amp, ...p.amp }, flt = { ...DEFAULT_SYNTH.filter, ...p.filter }, lfo = { ...DEFAULT_SYNTH.lfo, ...p.lfo };
  const t = when ?? c.currentTime, tOff = t + Math.max(0.01, duration), end = tOff + amp.r * 4 + 0.05;
  let src;
  if (p.osc === 'noise') {
    src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.loop = true;
  } else {
    src = c.createOscillator();
    src.type = ['sine', 'square', 'sawtooth', 'triangle'].includes(p.osc) ? p.osc : p.osc === 'saw' ? 'sawtooth' : 'sine';
    src.frequency.value = midiHz(note);
  }
  const f = c.createBiquadFilter();
  f.type = flt.type || 'lowpass';
  f.Q.value = flt.q;
  // the filter envelope opens the cutoff by `env` octaves at its peak
  adsr(f.frequency, t, tOff, flt, flt.cutoff, Math.min(20000, flt.cutoff * Math.pow(2, flt.env)));
  const g = c.createGain();
  adsr(g.gain, t, tOff, amp, 0, p.gain * velocity);
  src.connect(f); f.connect(g); g.connect(dest);
  if (lfo.target !== 'off') {
    const o = c.createOscillator(), depth = c.createGain();
    o.frequency.value = lfo.rate;
    depth.gain.value = lfo.target === 'filter' ? lfo.depth * 12 : lfo.depth; // cents: filter wobbles wider
    o.connect(depth);
    depth.connect(lfo.target === 'filter' ? f.detune : src.detune);
    o.start(t); o.stop(end);
  }
  src.start(t);
  src.stop(end);
  return end;
}

// ---------- clips ----------
/**
 * A clip (.clip.json): { format: 'dream-clip', name, tempo, swing (0..1), steps,
 *   rows: [{ name, sound: { place, path }, gain, rate } | { name, synth: <preset>, note, gain }],
 *   notes: [{ r: row, s: step, len: steps (1), vel (1) }] }.
 * A step is a sixteenth note. Its render sits beside it as "<name>.clip.json.wav".
 */
export async function loadClip(place, path) {
  const def = await (await fetch(fileUrl(place, path))).json();
  if (def?.format !== 'dream-clip') throw new Error(`${path} is not a clip`);
  return prepareClip(def, { rendered: { place, path: path + '.wav' } });
}

/** Load the sounds a clip's rows use. Rows whose sound will not load stay silent. */
export async function prepareClip(def, { rendered = null } = {}) {
  const buffers = await Promise.all(def.rows.map((row) => (row.sound ? loadSound(row.sound.place, row.sound.path).catch(() => null) : null)));
  return { def, buffers, rendered };
}

export const stepTime = (tempo) => 60 / tempo / 4;
const swung = (s, step, swing) => (s % 2 ? swing * step / 3 : 0);

/** Schedule notes of a prepared clip that start in steps [from, to) with step 0 at t0. */
function scheduleSteps(c, clip, t0, from, to, dest, tempo) {
  const { def, buffers } = clip, step = stepTime(tempo);
  for (const n of def.notes) {
    if (n.s < from || n.s >= to) continue;
    const row = def.rows[n.r];
    if (!row) continue;
    const t = t0 + n.s * step + swung(n.s, step, def.swing ?? 0), vel = n.vel ?? 1;
    if (row.synth) synthNote(row.synth, row.note ?? 60, (n.len ?? 1) * step * 0.95, { when: t, ctx: c, dest, velocity: vel * (row.gain ?? 1) });
    else if (buffers[n.r]) play(buffers[n.r], { when: t, ctx: c, dest, gain: vel * (row.gain ?? 1), rate: row.rate ?? 1 });
  }
}

/** Every note of a clip on any context (offline for renders). Returns the clip's length in seconds, tails left out. */
export function scheduleClip(c, clip, { when = 0, dest = c.destination, tempo } = {}) {
  const tp = tempo ?? clip.def.tempo ?? 120;
  scheduleSteps(c, clip, when, 0, clip.def.steps, dest, tp);
  return clip.def.steps * stepTime(tp);
}

/**
 * Play a prepared clip (from loadClip or prepareClip). { loop = false, tempo, gain = 1, onStep(step) }.
 * Steps are scheduled a little ahead on the audio clock, so timing holds while the page is busy.
 * Returns { stop() }.
 */
export function playClip(clip, { loop = false, tempo, gain = 1, onStep = null } = {}) {
  const c = context(), out = c.createGain();
  out.gain.value = gain;
  out.connect(c.destination);
  const tp = tempo ?? clip.def.tempo ?? 120, step = stepTime(tp), steps = clip.def.steps;
  let t0 = c.currentTime + 0.06, next = 0, stopped = false, shown = -1;
  const tick = () => {
    if (stopped) return;
    const horizon = c.currentTime + 0.12;
    while (t0 + next * step < horizon) {
      if (next >= steps) {
        if (!loop) { if (c.currentTime > t0 + steps * step + 2) stop(); break; }
        t0 += steps * step; next = 0;
      }
      scheduleSteps(c, clip, t0, next, next + 1, out, tp);
      next++;
    }
    if (onStep) {
      const s = Math.floor((c.currentTime - t0) / step);
      if (s !== shown && s >= 0 && s < steps) onStep((shown = s));
    }
  };
  const timer = setInterval(tick, 20);
  tick();
  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    out.gain.setTargetAtTime(0, c.currentTime, 0.02);
    setTimeout(() => out.disconnect(), 300);
    onStep?.(-1);
  }
  return { stop, get playing() { return !stopped; } };
}

// ---------- seeded randomness (the note dice use it too) ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
