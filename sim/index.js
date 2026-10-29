// dream-common/sim: the headless game simulation. The server runs it authoritatively, the client runs it for
// prediction; nothing here imports a renderer or reads the window. README.md has the rules.
//
//   import { createSim, createLocalServer } from '../sim/index.js';
//   const server = createLocalServer(createSim({ zone, cells, seed: 1 }));
//   const me = server.connect({ uid: 'p1', x: 0, z: 0 });
//   me.onSnapshot((s) => draw(s));             // { tick, cell, entities: [{ uid, x, y, z, yaw, anim }] }
//   me.send({ type: 'move', dir: { x: 0, z: 1 } });
//   server.update(dt);                          // or server.start() for a real 20 Hz timer
export * from './math.js';
export { createHeightfield, terrainOf, toB64 } from './heightfield.js';
export { createWorld } from './world.js';
export { shapeOf, resolve, walkable, tooSteep, MAX_SLOPE } from './colliders.js';
export { check as checkIntent, KINDS as INTENTS } from './intents.js';
export { createSim, step, stepOnce, replay, rng, TICK, MOVE } from './tick.js';
import { step, TICK } from './tick.js';

const round = (v) => Math.round(v * 1000) / 1000;
const view = (e) => ({ uid: e.uid, x: round(e.x), y: round(e.y), z: round(e.z), yaw: round(e.yaw), anim: e.anim });

/**
 * The fake in-process server of Phase 1: same shape as the real one will have over a socket. Each tick it
 * sends every client one snapshot per cell in its area of interest (its own cell and the neighbours), with
 * the movers (players, npcs) standing in that cell; scenery comes from the cell files, not snapshots.
 */
export function createLocalServer(sim) {
  const clients = new Map();
  let timer = null;
  sim.on('tick', ({ tick }) => {
    const { world } = sim;
    for (const c of clients.values()) {
      const me = world.get(c.uid);
      if (!me) continue;
      for (const cell of world.neighbours(me.cell)) {
        const snap = { tick, cell, entities: world.inCell(cell).filter((e) => e.dynamic).map(view) };
        for (const cb of c.subs) cb(snap);
      }
    }
  });
  return {
    sim,
    /** Join a player; returns its connection { uid, send(intent), onSnapshot(cb), close() }. */
    connect({ uid, x = 0, z = 0, yaw = 0 } = {}) {
      if (!uid || clients.has(uid)) throw new Error(`local server: bad or taken uid ${uid}`);
      const c = { uid, subs: new Set() };
      clients.set(uid, c);
      sim.join(uid, { x, z, yaw });
      return {
        uid,
        send: (intent) => sim.intent(uid, intent),
        onSnapshot: (cb) => { c.subs.add(cb); return () => c.subs.delete(cb); },
        close: () => { clients.delete(uid); sim.leave(uid); },
      };
    },
    /** Advance real time; the sim runs whole 20 Hz ticks and snapshots go out after each. */
    update: (dt) => step(sim, dt),
    start() { if (!timer) { let last = Date.now(); timer = setInterval(() => { const now = Date.now(); step(sim, (now - last) / 1000); last = now; }, TICK * 1000); } },
    stop() { clearInterval(timer); timer = null; },
  };
}
