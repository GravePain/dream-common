// The clock and the step: a fixed 20 Hz tick, an accumulator so a caller may advance by any real time, one
// seeded random stream, and every intent logged against the tick it was applied on, so a run replays exactly
// (the pattern of skyfall-blade/src/game/sim.ts, without its three.js).
//
//   const sim = createSim({ zone, cells, templates, seed: 7 });
//   sim.join('p1', { x: 0, z: 0 });
//   sim.intent('p1', { type: 'move', dir: { x: 1, z: 0 } });
//   step(sim, realDt);                 // runs as many whole ticks as realDt covers
//   sim.on('enter cell', (ev) => ...); // also 'interact', 'blocked', 'portal', 'tick'
//
// Portals: an entity with a `portal` component and a `collider` with `trigger` (on itself, or a trigger
// collider child the bridge made from its piece's meta) fires `portal { tick, uid, portal, zone, cell, x, z }`
// once when a player's capsule comes to overlap it; it re-arms when the player has left every shape of it.
//
// Systems (step 10, systems.js): after the movers move, each registered system's onTick runs in order (ai,
// stats, abilities, items); an intent movement does not take (cast, pickup, use, drop) goes to their
// onIntent; `interact` goes through the event bus (`before` hooks may veto it). `createSim({ tables, spawn,
// systems })`: the gameplay tables (systems/tables.js, defaults built in), the player respawn point (the
// bridge's `spawn`) and, optionally, the names of the systems to run (all by default; [] for none).
import { createWorld } from './world.js';
import { bindSystems, tickSystems, intentToSystems, REGISTRY } from './systems.js';
import './systems/index.js';
import { tablesOf } from './systems/tables.js';
import { aiOwns } from './systems/ai.js';
import { stat } from './systems/stats.js';
import { resolve, tooSteep, walkable, touches } from './colliders.js';
import { check, oneShot } from './intents.js';
import { yawOf, turnToward, clamp } from './math.js';

export const TICK = 1 / 20;
/** Mover tuning; npcs use their own `npc.speed` and walk only. */
export const MOVE = {
  walk: 4, run: 1.8, accel: 30, gravity: 20, snap: 0.4, turn: 12, radius: 0.35, height: 1.8, arrive: 0.25,
  // stats (systems/stats.js): pools, a full stamina bar runs 6 s and refills in 3, regeneration a second once
  // `calm` s pass without combat, and how long the death pose holds
  health: 100, stamina: 100, drain: 100 / 6, refill: 100 / 3, regen: 1, calm: 5, dying: 3,
};

/** Small fast seeded PRNG (mulberry32), returning [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A sim over a zone: { world, tick, seed, random, log, join, leave, intent, on, off }. Step it with step(). */
export function createSim({ zone, cells, templates, seed = 1, tables = {}, spawn = null, systems = null } = {}) {
  const world = createWorld({ zone, cells, templates });
  const listeners = new Map();
  const sim = {
    world, seed, random: rng(seed), tick: 0, acc: 0, log: [], pending: [],
    /** Ask for a player at (x, z) next tick (logged, so a replay joins it too). */
    join: (uid, at = {}) => { sim.pending.push({ uid, join: { x: at.x ?? 0, z: at.z ?? 0, yaw: at.yaw ?? 0, ...(at.inventory ? { inventory: at.inventory } : {}) } }); },
    leave: (uid) => { sim.pending.push({ uid, leave: true }); },
    /** Queue an intent for the next tick; returns false (and drops it) when it is malformed. */
    intent: (uid, i) => { const c = check(i); if (c) sim.pending.push({ uid, intent: c }); return !!c; },
    on: (type, cb) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(cb); return () => sim.off(type, cb); },
    off: (type, cb) => listeners.get(type)?.delete(cb),
    emit: (type, ev) => { for (const cb of listeners.get(type) ?? []) cb(ev); },
    players: () => [...world.entities.values()].filter((e) => e.kind === 'player').sort(byUid),
    npcs: () => [...sim.world.entities.values()].filter((e) => e.kind === 'npc').sort(byUid),
    portals: [],
    tables: tablesOf(tables), spawn, dt: TICK,
    /** the zone's npc records, for a respawn */
    records: new Map(),
    move: (e, dx, dz, speed) => moveBody(sim, e, dx, dz, speed),
    wander: (e) => moveNpc(sim, e),
    /** Put an npc back from its record (a respawn): a mover again, its systems told. */
    addNpc: (rec) => { const e = sim.world.addEntity(rec); makeNpc(e); for (const s of sim.systems) s.onJoin?.(sim, e); return e; },
  };
  // portals and their trigger shapes, in uid order
  for (const e of [...world.entities.values()].sort(byUid)) {
    if (!e.components.portal) continue;
    const shapes = [...world.entities.values()].filter((c) => (c === e || c.parent === e.uid) && c.components.collider?.trigger).sort(byUid);
    if (shapes.length) sim.portals.push({ uid: e.uid, portal: e.components.portal, shapes });
  }
  // npcs that move become movers (wander, patrol, follow, flee, and any hostile); stationary ones stand
  for (const e of world.entities.values()) makeNpc(e);
  for (const c of Array.isArray(cells) ? cells : Object.values(cells ?? {})) for (const rec of c.entities ?? []) if (world.get(rec.uid)?.kind === 'npc') sim.records.set(rec.uid, structuredClone(rec));
  bindSystems(sim, REGISTRY, systems);
  return sim;
}

function makeNpc(e) {
  const npc = e.components.npc;
  if (npc && (npc.mode === 'wander' || npc.mode === 'patrol' || aiOwns(e))) {
    Object.assign(e, { dynamic: true, kind: 'npc', vx: 0, vz: 0, vy: 0, grounded: true, blocked: null, ai: { target: null, wait: 0, leg: 0 } });
    e.home = npc.home ?? e.components.animal?.home ?? { x: e.x, z: e.z };
  }
}

const byUid = (a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0);

/** Advance by real time `dt` (seconds): runs every whole tick it covers and keeps the rest. Returns ticks run. */
export function step(sim, dt = TICK) {
  sim.acc += dt;
  let n = 0;
  while (sim.acc >= TICK - 1e-9) { sim.acc -= TICK; stepOnce(sim); n++; }
  return n;
}

/** One fixed tick: apply queued intents (logging them), then move every player and npc. */
export function stepOnce(sim) {
  const { world } = sim;
  for (const p of sim.pending) applyEntry(sim, p);
  sim.pending = [];
  for (const e of sim.players()) { movePlayer(sim, e); if (sim.portals.length && !e.dead) portals(sim, e); }
  for (const e of sim.npcs()) if (!aiOwns(e)) moveNpc(sim, e);
  tickSystems(sim);
  sim.emit('tick', { tick: sim.tick });
  sim.tick++;
}

function applyEntry(sim, p) {
  const { world } = sim;
  sim.log.push({ tick: sim.tick, ...structuredClone(p) });
  if (p.join) {
    if (world.get(p.uid)) return;
    const e = world.addEntity({ uid: p.uid, template: 'player', transform: { x: p.join.x, z: p.join.z, rotY: p.join.yaw }, components: {} },
      { dynamic: true, kind: 'player', vx: 0, vz: 0, vy: 0, grounded: true, blocked: null, order: { type: 'stop' } });
    for (const s of sim.systems) s.onJoin?.(sim, e, p.join);
    return;
  }
  if (p.leave) { world.removeEntity(p.uid); return; }
  const e = world.get(p.uid);
  if (!e || e.kind !== 'player') return;
  const i = p.intent;
  if (i.type === 'face') { if (!e.dead) e.yaw = i.yaw; }
  else if (i.type === 'interact') { if (!e.dead) interact(sim, e, i.uid); }
  else if (oneShot(i)) intentToSystems(sim, e, i);
  if (!oneShot(i) && !e.dead) e.order = i;
}

/**
 * Fire `portal` on entering a portal's trigger; re-arm once the player is out of all its shapes. A player
 * who starts inside one (joins, arrives or is put there; `inPortals` unset) is taken as already in it, so
 * the portal fires only after it has stepped out once.
 */
function portals(sim, e) {
  if (!e.inPortals) { e.inPortals = new Set(sim.portals.filter((p) => p.shapes.some((s) => touches(s, e, MOVE.radius, MOVE.height))).map((p) => p.uid)); return; }
  for (const p of sim.portals) {
    const inside = p.shapes.some((s) => touches(s, e, MOVE.radius, MOVE.height));
    if (inside && !e.inPortals.has(p.uid)) {
      e.inPortals.add(p.uid);
      const { zone, cell = null, x = 0, z = 0 } = p.portal;
      sim.emit('portal', { tick: sim.tick, uid: e.uid, portal: p.uid, zone, cell, x, z });
    } else if (!inside) e.inPortals.delete(p.uid);
  }
}

function interact(sim, e, uid) {
  const t = sim.world.get(uid), use = t?.components.interact;
  const d = t ? Math.hypot(t.x - e.x, t.z - e.z) : Infinity;
  const ok = !!use && d <= (use.range ?? 2) + MOVE.radius;
  const ev = { tick: sim.tick, uid: e.uid, target: uid, verb: use?.verb ?? null, ok, reason: ok ? null : !t ? 'missing' : !use ? 'not usable' : 'out of range' };
  if (!sim.gate('interact', ev)) { ev.ok = false; ev.reason = ev.reason ?? 'refused'; sim.emit('interact', ev); return; }
  sim.done('interact', ev);
}

function movePlayer(sim, e) {
  const o = e.order;
  let dx = 0, dz = 0, speed = 0;
  if (e.dead) { moveBody(sim, e, 0, 0, 0); return; }
  const walk = e.stats ? stat(e, 'speed') : MOVE.walk, run = o.run && !e.tired;
  if (o.type === 'move') { dx = o.dir.x; dz = o.dir.z; speed = walk * (run ? MOVE.run : 1); }
  else if (o.type === 'moveTo') {
    const rx = o.x - e.x, rz = o.z - e.z, d = Math.hypot(rx, rz);
    if (d <= MOVE.arrive) e.order = { type: 'stop' };
    else { dx = rx / d; dz = rz / d; speed = Math.min(walk * (run ? MOVE.run : 1), d / TICK); }
  }
  moveBody(sim, e, dx, dz, speed);
}

function moveNpc(sim, e) {
  const npc = e.components.npc, ai = e.ai, r = npc.radius ?? 14;
  if (ai.wait > 0) { ai.wait -= TICK; moveBody(sim, e, 0, 0, 0); return; }
  if (!ai.target) {
    if (npc.mode === 'patrol') {
      const pts = npc.points?.length ? npc.points : [0, 1, 2, 3].map((k) => ({ x: e.home.x + r * Math.cos(k * Math.PI / 2), z: e.home.z + r * Math.sin(k * Math.PI / 2) }));
      ai.target = pts[ai.leg % pts.length]; ai.leg++;
    } else {
      const a = sim.random() * Math.PI * 2, d = Math.sqrt(sim.random()) * r;
      const x = e.home.x + Math.cos(a) * d, z = e.home.z + Math.sin(a) * d;
      if (!walkable(sim.world, x, z, MOVE.radius)) { moveBody(sim, e, 0, 0, 0); return; }
      ai.target = { x, z };
    }
  }
  const rx = ai.target.x - e.x, rz = ai.target.z - e.z, d = Math.hypot(rx, rz);
  if (d <= MOVE.arrive) { ai.target = null; ai.wait = npc.mode === 'wander' ? 1 + 2 * sim.random() : 0; moveBody(sim, e, 0, 0, 0); return; }
  const was = e.blocked;
  moveBody(sim, e, rx / d, rz / d, Math.min(e.stats ? stat(e, 'speed') : npc.speed ?? 1, d / TICK));
  if (e.blocked && !was) { ai.target = null; ai.wait = 0.5; } // stuck: choose again shortly
}

/** The shared movement rules: accelerate toward (dir * speed), turn, slope and edge walls, colliders, gravity, ground snap. */
function moveBody(sim, e, dx, dz, speed) {
  const { world } = sim, g = world.ground, dt = TICK;
  const tx = dx * speed, tz = dz * speed;
  const ax = tx - e.vx, az = tz - e.vz, al = Math.hypot(ax, az), max = MOVE.accel * dt;
  if (al > max) { e.vx += (ax / al) * max; e.vz += (az / al) * max; } else { e.vx = tx; e.vz = tz; }
  if (speed > 0.01) e.yaw = turnToward(e.yaw, yawOf(dx, dz), MOVE.turn * dt);

  const px = e.x + e.vx * dt, pz = e.z + e.vz * dt;
  let nx = px, nz = pz, blocked = null;
  const half = world.size / 2 - MOVE.radius;
  if (Math.abs(nx) > half || Math.abs(nz) > half) { nx = clamp(nx, -half, half); nz = clamp(nz, -half, half); blocked = 'edge'; }
  if (e.grounded && tooSteep(g, e, nx, nz)) { nx = e.x; nz = e.z; e.vx = 0; e.vz = 0; blocked = 'slope'; }
  // tested from the lower of the feet and the destination's ground, so a fast step down a bank still meets a low rock
  const r = resolve(world, { x: nx, y: Math.min(e.y, g.heightAt(nx, nz)), z: nz }, MOVE.radius, MOVE.height, e.uid);
  if (r.by) { blocked = blocked ?? 'collider'; nx = r.x; nz = r.z; }
  if (blocked === 'collider' || blocked === 'edge') {
    // slide: drop the velocity into the wall (along the push-out), never faster than this tick's intended speed
    const cx = nx - px, cz = nz - pz, cl = Math.hypot(cx, cz), into = cl > 1e-9 ? (e.vx * cx + e.vz * cz) / cl : 0;
    if (into < 0) { e.vx -= (cx / cl) * into; e.vz -= (cz / cl) * into; }
    const v = Math.hypot(e.vx, e.vz); if (v > speed) { const k = v > 1e-9 ? speed / v : 0; e.vx *= k; e.vz *= k; }
  }

  const crossed = world.place(e, nx, nz);
  const floor = g.heightAt(nx, nz);
  if (e.grounded && e.vy <= 0 && e.y - floor <= MOVE.snap) { e.y = floor; e.vy = 0; }
  else {
    e.vy -= MOVE.gravity * dt; e.y += e.vy * dt;
    if (e.y <= floor) { e.y = floor; e.vy = 0; e.grounded = true; } else e.grounded = false;
  }
  const v = Math.hypot(e.vx, e.vz);
  e.anim = v > MOVE.walk * 1.2 ? 'run' : v > 0.2 ? 'walk' : 'idle';

  if (crossed) sim.emit('enter cell', { tick: sim.tick, uid: e.uid, ...crossed });
  if (blocked && blocked !== e.blocked) sim.emit('blocked', { tick: sim.tick, uid: e.uid, reason: blocked, by: r.by, x: e.x, z: e.z });
  e.blocked = blocked;
}

/** Re-run a log on a fresh sim with the same inputs: same positions after `ticks` ticks. */
export function replay(opts, log, ticks) {
  const sim = createSim(opts);
  let k = 0;
  // a replay applies the log as it was taken: intents already checked
  for (let t = 0; t < ticks; t++) {
    while (k < log.length && log[k].tick === t) { const { tick, ...p } = log[k++]; sim.pending.push(p); }
    stepOnce(sim);
  }
  return sim;
}
