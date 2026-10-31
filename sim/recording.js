// Recordings: what a room did, kept so it can be run again (testing layer 3 of the game builder plan). A recording is
// the sim's input and its intent log, with a digest of every mover at set ticks. Running it again on a fresh sim
// must give the same digests; the first that differs names the tick and the entity, so a change to the sim that alters
// how the game plays shows up as a failed replay. Plain JS, no DOM, no Node.
//
//   { header: { format, version, zone, built, seed, input: { zone, cells, templates, spawn }, tables }, log: [...], checks: [{ tick, movers: { uid: digest } }] }
import { createSim, stepOnce } from './tick.js';

export const FORMAT = 'dream-replay', VERSION = 1;
/** Ticks between digests: once a second at 20 Hz. */
export const CHECK_EVERY = 20;

const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const n = (v) => (typeof v === 'number' ? +v.toFixed(4) : v ?? null);
const wornOf = (w) => Object.keys(w ?? {}).sort().map((k) => [k, w[k]]);
/** What a digest covers, for one mover: where it is, its health and stamina, whether it is dead, what it carries. */
export const moverState = (e) => [n(e.x), n(e.y), n(e.z), n(e.yaw), e.anim ?? null, n(e.stats?.health), n(e.stats?.stamina), !!e.dead, e.inventory ? e.inventory.slots : null, wornOf(e.inventory?.worn)];
/** { uid: digest } for every mover in the sim, in uid order. */
export function digests(sim) {
  const out = {};
  for (const e of [...sim.world.entities.values()].filter((x) => x.dynamic).sort((a, b) => (a.uid < b.uid ? -1 : 1))) out[e.uid] = fnv(JSON.stringify(moverState(e)));
  return out;
}

/** The sim a recording's header describes, fresh. */
export const simOf = (header) => createSim({ ...header.input, seed: header.seed, tables: header.tables });

/** Run the log, calling `at(tick, sim)` once per tick after it ran; stops when `at` answers false. */
function run(rec, at) {
  const sim = simOf(rec.header), last = rec.checks.at(-1)?.tick ?? rec.log.at(-1)?.tick ?? 0;
  let k = 0;
  for (let t = 0; t <= last; t++) {
    while (k < rec.log.length && rec.log[k].tick === t) { const { tick, ...p } = rec.log[k++]; sim.pending.push(p); }
    stepOnce(sim);
    if (at(t, sim) === false) break;
  }
  return sim;
}

/**
 * Run a recording again and compare. { ok: true, ticks, checks } or { ok: false, tick, uid, why }: the first tick whose
 * digests differ, the entity, and what happened to it.
 */
export function verifyRecording(rec) {
  const want = new Map(rec.checks.map((c) => [c.tick, c.movers]));
  let bad = null;
  run(rec, (t, sim) => {
    const w = want.get(t);
    if (!w) return true;
    const got = digests(sim);
    for (const uid of new Set([...Object.keys(w), ...Object.keys(got)])) {
      if (w[uid] === got[uid]) continue;
      bad = { ok: false, tick: t, uid, why: !(uid in got) ? 'it is gone in the replay' : !(uid in w) ? 'it was not in the recording' : `it differs: now ${JSON.stringify(moverState(sim.world.get(uid)))}` };
      return false;
    }
    return true;
  });
  return bad ?? { ok: true, ticks: rec.checks.at(-1)?.tick ?? 0, checks: rec.checks.length };
}

/** The same recording with its digests taken again: after a deliberate change to the sim. */
export function rechecked(rec) {
  const checks = [];
  const every = new Set(rec.checks.map((c) => c.tick));
  run(rec, (t, sim) => { if (every.has(t)) checks.push({ tick: t, movers: digests(sim) }); return true; });
  return { ...rec, checks };
}

/** A recording from its JSON Lines text: the header, then { log: [...] } and { check: {...} } lines, then perhaps { end }. */
export function parseRecording(text) {
  const rec = { header: null, log: [], checks: [], end: null };
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const v = JSON.parse(line);
    if (v.format === FORMAT) rec.header = v;
    else if (v.log) rec.log.push(...v.log);
    else if (v.check) rec.checks.push(v.check);
    else if (v.end) rec.end = v.end;
  }
  if (!rec.header) throw new Error('not a recording: no header');
  // whatever ran after the last digest proves nothing
  const last = rec.checks.at(-1)?.tick ?? -1;
  rec.log = rec.log.filter((l) => l.tick <= last);
  return rec;
}
/** A recording back as JSON Lines. */
export const recordingText = (rec) => [JSON.stringify(rec.header), JSON.stringify({ log: rec.log }), ...rec.checks.map((check) => JSON.stringify({ check })), ...(rec.end ? [JSON.stringify({ end: rec.end })] : [])].join('\n') + '\n';
