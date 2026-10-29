// Client-side prediction for Play online (game builder step 5). A second sim over the same zone input the
// server builds (sim/bridge.js), with only the local player in it: every intent the player sends is applied
// here too, with its `seq`, and the sim is stepped at 20 Hz on the client's clock, so the character moves the
// instant a key goes down. Each snapshot from the server that carries the player is folded back in:
// history up to its tick is dropped, the server's position is compared with ours at that tick, and over
// 2 cm we take the server's state there and re-run the intents after it (reconciliation). Plain JS, no DOM,
// so `node --test` runs it; Dream World's play/predict.ts binds it to three.js and the Play loop.
//
// Ticks can carry the server's numbers: `advanceTo(tick)` runs up to a server tick and `intent(i, tick)`
// applies an intent on the tick it is expected to reach the server, so the two timelines line up and a
// correction is needed only when an intent arrives a tick early or late.
//
//   const p = createPredictor({ zone, cells, templates, uid, at: { x, y, z, yaw } });
//   const seq = p.intent({ type: 'move', dir }); conn.send({ intent, seq });   // apply locally, then send
//   p.update(dt);                          // whole 20 Hz ticks on the client's clock, or p.advanceTo(tick)
//   p.reconcile(snapshot.tick, entity);    // entity: { seq, x, y, z, yaw } for this uid
//   p.state(), p.prev(), p.frac             // the last two predicted ticks and how far between them we are
import { createSim, stepOnce, checkIntent, TICK, MOVE } from '../sim/index.js';

export const HISTORY = 64;    // ticks of history kept (3.2 s)
export const TOLERANCE = 0.02; // m: closer than this to the server is agreement

const KEEP = ['x', 'y', 'z', 'yaw', 'vx', 'vy', 'vz', 'grounded', 'blocked', 'anim'];
const copy = (e) => { const s = {}; for (const k of KEEP) s[k] = e[k]; s.order = structuredClone(e.order); return s; };

export function createPredictor({ zone, cells, templates, uid, at = {}, seed = 1 }) {
  const sim = createSim({ zone, cells, templates, seed });
  // npcs and other players are not predicted: they are drawn from snapshots
  for (const e of [...sim.world.entities.values()]) if (e.kind === 'npc') sim.world.removeEntity(e.uid);
  sim.join(uid, { x: at.x ?? 0, z: at.z ?? 0, yaw: at.yaw ?? 0 });
  stepOnce(sim);
  sim.log.length = 0;
  const me = () => sim.world.get(uid);
  if (Number.isFinite(at.y)) me().y = at.y;

  let seq = 0, ack = 0, offset = null, acc = 0;
  let queued = [];           // { seq, intent, tick } waiting for their tick
  let history = [];          // { tick, seq, intents, state } per tick, oldest first
  let prev = copy(me()), cur = prev;
  let seen = null;           // the server's last position of us { tick, x, z }: its velocity, for a reset

  /** Put the player back to a state (a history entry's, with the server's position). */
  function setState(s) {
    const e = me();
    for (const k of KEEP) e[k] = s[k];
    e.order = structuredClone(s.order);
    sim.world.place(e, s.x, s.z);
  }

  function runTick(intents) {
    for (const q of intents) sim.intent(uid, q.intent);
    const tick = sim.tick;
    stepOnce(sim);
    sim.log.length = 0;
    return { tick, state: copy(me()) };
  }

  function one() {
    const intents = queued.filter((q) => q.tick <= sim.tick);
    queued = queued.filter((q) => q.tick > sim.tick);
    const r = runTick(intents);
    history.push({ tick: r.tick, seq: intents.length ? intents.at(-1).seq : (history.at(-1)?.seq ?? ack), intents, state: r.state });
    if (history.length > HISTORY) history.splice(0, history.length - HISTORY);
    prev = cur; cur = r.state;
  }

  const p = {
    sim, uid,
    get seq() { return seq; },
    /** The last seq the server says it applied. */
    get ack() { return ack; },
    get history() { return history; },
    /** How far into the next tick the client clock is, 0..1. */
    get frac() { return acc / TICK; },
    /** The tick the sim runs next. */
    get tick() { return sim.tick; },
    /** A checked copy of the intent, applied locally on `tick` (default the next); returns its seq (0 when malformed). */
    intent(i, tick = sim.tick) {
      const c = checkIntent(i);
      if (!c) return 0;
      queued.push({ seq: ++seq, intent: c, tick: Math.max(tick, sim.tick) });
      return seq;
    },
    /** Advance the client's clock; runs every whole tick it covers. Returns ticks run. */
    update(dt) {
      acc += dt;
      let n = 0;
      while (acc >= TICK - 1e-9) { acc -= TICK; one(); n++; }
      return n;
    },
    /** Run every tick before `tick` (server numbering); a gap over the history skips ahead. Returns ticks run. */
    advanceTo(tick) {
      if (tick - sim.tick > HISTORY) sim.tick = tick - 1;
      let n = 0;
      while (sim.tick < tick) { one(); n++; }
      return n;
    },
    /**
     * Fold in the server's view of this player at `serverTick` ({ seq, x, y, z, yaw }). Returns null when it
     * cannot be lined up (no seq yet, or outside the history), else { error, corrected, moved }: `moved` is
     * how far the newest predicted position jumped.
     */
    reconcile(serverTick, s) {
      if (!s || !Number.isInteger(s.seq) || s.seq < 1) return null;
      const before = seen;
      seen = { tick: serverTick, x: s.x, z: s.z };
      if (s.seq > ack) {
        // the first snapshot after the server applied this seq: it ran it on serverTick, we on h.tick
        const h = history.find((x) => x.intents.some((q) => q.seq >= s.seq));
        if (h) offset = serverTick - h.tick;
        ack = s.seq;
      }
      if (offset == null) return null;
      const tick = serverTick - offset;
      const i = history.findIndex((x) => x.tick === tick);
      if (i < 0) { history = history.filter((x) => x.tick > tick); return null; }
      const h = history[i];
      // we had already applied a later intent there that the server has not had yet: it arrived later than
      // we guessed, and its own acknowledgement will line us up again; until then there is nothing to compare
      if (h.seq > s.seq) { history = history.slice(i); return null; }
      const error = Math.hypot(h.state.x - s.x, h.state.y - s.y, h.state.z - s.z);
      history = history.slice(i);
      if (error <= TOLERANCE) return { error, corrected: false, moved: 0 };
      // reconciliation: the server's state at that tick, then our intents after it again
      const was = cur, now = sim.tick, pending = sim.pending;
      sim.pending = [];
      h.state = { ...h.state, x: s.x, y: s.y, z: s.z, yaw: Number.isFinite(s.yaw) ? s.yaw : h.state.yaw };
      // the server's velocity from its last two positions (snapshots carry none), so the re-run does not
      // drift from it again while it speeds up or turns
      // (a jump faster than running is a teleport, not a velocity)
      if (before?.tick === serverTick - 1) {
        const vx = (s.x - before.x) / TICK, vz = (s.z - before.z) / TICK;
        if (Math.hypot(vx, vz) <= MOVE.walk * MOVE.run + 0.5) { h.state.vx = vx; h.state.vz = vz; }
      }
      setState(h.state);
      for (let k = 1; k < history.length; k++) {
        sim.tick = history[k].tick;
        history[k].state = runTick(history[k].intents).state;
      }
      sim.tick = now; sim.pending = pending;
      cur = history.at(-1).state;
      prev = history.length > 1 ? history.at(-2).state : cur;
      return { error, corrected: true, moved: Math.hypot(cur.x - was.x, cur.y - was.y, cur.z - was.z) };
    },
    /** Snap to a state outright (a big disagreement, or a teleport): history is dropped; `tick` renumbers the sim. */
    reset(s, tick) {
      setState({ ...copy(me()), ...s });
      if (Number.isInteger(tick)) sim.tick = tick;
      history = []; queued = []; offset = null;
      prev = cur = copy(me());
    },
    state: () => cur,
    prev: () => prev,
  };
  return p;
}
