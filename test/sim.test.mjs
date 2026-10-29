// node --test test/sim.test.mjs   (from dream-common): the headless sim (sim/) on Crystal Cascades and on
// small zones built here: walking on the heightfield, collider and slope walls, npc wander, replay, snapshots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createSim, step, stepOnce, replay, createLocalServer, terrainOf, walkable, TICK, MOVE } from '../sim/index.js';
import { validateComponent } from '../web/schema/components.js';

const CRYSTAL = 'K:/dream-forge-creations/Zones/Crystal Cascades';
const loadZone = (dir) => {
  const zone = JSON.parse(fs.readFileSync(path.join(dir, 'zone.json'), 'utf8'));
  const cells = zone.cells.map((c) => JSON.parse(fs.readFileSync(path.join(dir, 'cells', `${c}.json`), 'utf8')));
  return { zone, cells };
};
/** A zone of `size` metres whose ground is h(x, z). */
function makeZone(h, size = 100, res = 101) {
  const heights = new Float32Array(res * res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) heights[j * res + i] = h((i / (res - 1) - 0.5) * size, (j / (res - 1) - 0.5) * size);
  return { format: 'dream-zone', version: 1, id: 'test', name: 'Test', size, cell: 50, terrain: terrainOf(heights, res), sky: {}, cells: [] };
}
const box = (uid, x, z, sx = 1, sy = 2, sz = 1) => ({ uid, template: 'crate', transform: { x, y: 0, z, rotY: 0, scale: 1 }, components: { collider: { shape: 'box', size: { x: sx, y: sy, z: sz } } } });
const cell = (entities) => ({ format: 'dream-cell', version: 1, zone: 'test', x: 0, z: 0, entities });
const run = (sim, seconds) => { for (let t = 0; t < Math.round(seconds / TICK); t++) stepOnce(sim); };

test('a player walks 20 m across Crystal Cascades and stays on the heightfield', () => {
  const sim = createSim({ ...loadZone(CRYSTAL), seed: 1 });
  // z = 30 runs over gentle ground (under 30 degrees); z = 0 crosses a creek bank steeper than 45
  sim.join('p1', { x: -10, z: 30 });
  sim.intent('p1', { type: 'moveTo', x: 10, z: 30 });
  let off = 0;
  for (let t = 0; t < 200; t++) {
    stepOnce(sim);
    const p = sim.world.get('p1');
    off = Math.max(off, Math.abs(p.y - sim.world.ground.heightAt(p.x, p.z)));
  }
  const p = sim.world.get('p1');
  assert.ok(off < 1e-6, `left the ground by ${off}`);
  assert.ok(Math.hypot(p.x - 10, p.z - 30) <= MOVE.arrive + 0.01, `ended at ${p.x}, ${p.z}`);
});

test('a wall of boxes stops a walking player', () => {
  const wall = Array.from({ length: 11 }, (_, k) => box(`b${k}`, -5 + k, 10));
  const sim = createSim({ zone: makeZone(() => 0), cells: [cell(wall)] });
  const blocked = [];
  sim.on('blocked', (ev) => blocked.push(ev));
  sim.join('p1', { x: 0, z: 0 });
  sim.intent('p1', { type: 'move', dir: { x: 0, z: 1 } });
  run(sim, 6);
  const p = sim.world.get('p1');
  assert.ok(p.z <= 10 - 0.5 - MOVE.radius + 1e-6 && p.z > 8, `stood at z ${p.z}`);
  assert.equal(blocked[0]?.reason, 'collider');
  assert.ok(!walkable(sim.world, 0, 10));
  assert.ok(walkable(sim.world, 0, 5));
});

test('a 60 degree slope stops a walking player', () => {
  const rise = Math.tan(Math.PI / 3);
  const sim = createSim({ zone: makeZone((x, z) => (z > 10 ? (z - 10) * rise : 0)) });
  const blocked = [];
  sim.on('blocked', (ev) => blocked.push(ev));
  sim.join('p1', { x: 0, z: 0 });
  sim.intent('p1', { type: 'move', dir: { x: 0, z: 1 }, run: true });
  run(sim, 6);
  const p = sim.world.get('p1');
  assert.ok(p.z < 11.5 && p.z > 9, `stood at z ${p.z}`);
  assert.ok(p.y < 1.5 * rise, `climbed to ${p.y}`);
  assert.equal(blocked[0]?.reason, 'slope');
  // a 30 degree slope is walked up
  const easy = createSim({ zone: makeZone((x, z) => (z > 10 ? (z - 10) * Math.tan(Math.PI / 6) : 0)) });
  easy.join('p1', { x: 0, z: 0 });
  easy.intent('p1', { type: 'move', dir: { x: 0, z: 1 } });
  run(easy, 6);
  assert.ok(easy.world.get('p1').z > 20);
});

test('an npc wanders within its radius', () => {
  const npc = { uid: 'n1', template: 'deer', transform: { x: 5, y: 0, z: 5 }, components: { npc: { mode: 'wander', home: { x: 5, z: 5 }, radius: 6, speed: 2 } } };
  const sim = createSim({ zone: makeZone((x, z) => Math.sin(x * 0.1) * 2), cells: [cell([npc])], seed: 3 });
  const e = sim.world.get('n1');
  let far = 0, moved = 0, last = { x: e.x, z: e.z };
  for (let t = 0; t < 20 * 60; t++) {
    stepOnce(sim);
    far = Math.max(far, Math.hypot(e.x - 5, e.z - 5));
    moved += Math.hypot(e.x - last.x, e.z - last.z); last = { x: e.x, z: e.z };
  }
  assert.ok(far <= 6 + 0.01, `strayed ${far} m`);
  assert.ok(moved > 10, `only walked ${moved} m`);
});

test('a patrolling npc visits its points in order', () => {
  const pts = [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 8 }];
  const npc = { uid: 'n1', template: 'guard', transform: { x: 0, y: 0, z: 0 }, components: { npc: { mode: 'patrol', points: pts, speed: 3 } } };
  const sim = createSim({ zone: makeZone(() => 0), cells: [cell([npc])] });
  const e = sim.world.get('n1'), seen = [];
  for (let t = 0; t < 20 * 20; t++) {
    stepOnce(sim);
    const k = pts.findIndex((q) => Math.hypot(q.x - e.x, q.z - e.z) < 0.3);
    if (k >= 0 && seen.at(-1) !== k) seen.push(k);
  }
  assert.deepEqual(seen.slice(0, 4), [0, 1, 2, 0]);
});

test('two runs with the same seed and intent log land in the same places', () => {
  // Crystal Cascades has no animals yet, so one wanderer is added to draw on the seeded random stream
  const deer = { uid: 'a1', template: 'deer', transform: { x: 5, y: 0, z: 25 }, components: { npc: { mode: 'wander', home: { x: 5, z: 25 }, radius: 8, speed: 1.5 } } };
  const opts = () => { const { zone, cells } = loadZone(CRYSTAL); return { zone, cells: [...cells, cell([deer])], seed: 42 }; };
  const a = createSim(opts());
  a.join('p1', { x: 0, z: 0 });
  for (let t = 0; t < 300; t++) {
    if (t % 37 === 0) a.intent('p1', { type: 'move', dir: { x: Math.cos(t), z: Math.sin(t) }, run: t % 2 === 0 });
    if (t === 250) a.intent('p1', { type: 'moveTo', x: 3, z: -4 });
    stepOnce(a);
  }
  const b = replay(opts(), a.log, 300);
  const where = (s) => [...s.world.entities.values()].filter((e) => e.dynamic).map((e) => [e.uid, e.x, e.y, e.z, e.yaw]).sort();
  assert.ok(where(a).length > 1, 'expected the player and the deer');
  assert.deepEqual(where(b), where(a));
});

test('step accumulates real time into whole 20 Hz ticks', () => {
  const sim = createSim({ zone: makeZone(() => 0) });
  assert.equal(step(sim, 0.03), 0);
  assert.equal(step(sim, 0.03), 1);
  assert.equal(step(sim, 1), 20);
  assert.equal(sim.tick, 21);
});

test('interact fires for an entity in range and not out of it; malformed intents are dropped', () => {
  const lever = { uid: 'l1', template: 'lever', transform: { x: 1, y: 0, z: 0 }, components: { interact: { verb: 'pull', range: 1.5 } } };
  const sim = createSim({ zone: makeZone(() => 0), cells: [cell([lever])] });
  const got = [];
  sim.on('interact', (ev) => got.push(ev));
  sim.join('p1', { x: 0, z: 0 });
  stepOnce(sim);
  sim.intent('p1', { type: 'interact', uid: 'l1' });
  stepOnce(sim);
  assert.equal(got[0].ok, true); assert.equal(got[0].verb, 'pull');
  sim.intent('p1', { type: 'moveTo', x: -10, z: 0 });
  run(sim, 4);
  sim.intent('p1', { type: 'interact', uid: 'l1' });
  stepOnce(sim);
  assert.equal(got[1].ok, false); assert.equal(got[1].reason, 'out of range');
  assert.equal(sim.intent('p1', { type: 'move', dir: { x: NaN, z: 0 } }), false);
  assert.equal(sim.intent('p1', { type: 'teleport' }), false);
});

test('the local server sends 20 snapshots a second for the player cell and its neighbours only', () => {
  const zone = makeZone(() => 0, 200); // 4 x 4 cells
  const far = { uid: 'n9', template: 'deer', transform: { x: 90, y: 0, z: 90 }, components: { npc: { mode: 'wander', home: { x: 90, z: 90 }, radius: 3, speed: 1 } } };
  const server = createLocalServer(createSim({ zone, cells: [cell([far])] }));
  const enter = [];
  server.sim.on('enter cell', (ev) => enter.push(ev));
  const me = server.connect({ uid: 'p1', x: -80, z: -80 }); // cell x0z0
  const snaps = [];
  me.onSnapshot((s) => snaps.push(s));
  server.update(1);
  const cells = [...new Set(snaps.map((s) => s.cell))].sort();
  assert.deepEqual(cells, ['x0z0', 'x0z1', 'x1z0', 'x1z1']);
  for (const c of cells) assert.equal(snaps.filter((s) => s.cell === c).length, 20);
  assert.ok(!snaps.some((s) => s.entities.some((e) => e.uid === 'n9')), 'n9 is outside the area of interest');
  const mine = snaps.find((s) => s.cell === 'x0z0').entities.find((e) => e.uid === 'p1');
  assert.deepEqual(Object.keys(mine).sort(), ['anim', 'uid', 'x', 'y', 'yaw', 'z']);
  // walking into the next cell moves the area of interest with it
  me.send({ type: 'moveTo', x: -40, z: -80 });
  server.update(8);
  assert.deepEqual(enter.find((e) => e.uid === 'p1'), { tick: enter.find((e) => e.uid === 'p1').tick, uid: 'p1', from: 'x0z0', to: 'x1z0' });
  snaps.length = 0;
  server.update(TICK);
  assert.deepEqual([...new Set(snaps.map((s) => s.cell))].sort(), ['x0z0', 'x0z1', 'x1z0', 'x1z1', 'x2z0', 'x2z1']);
});

test('collider schema takes a cylinder and npc patrol points', () => {
  assert.deepEqual(validateComponent('collider', { shape: 'cylinder', size: { x: 1, y: 2, z: 1 } }), []);
  assert.deepEqual(validateComponent('npc', { mode: 'patrol', points: [{ x: 1, z: 2 }] }), []);
  assert.ok(validateComponent('npc', { mode: 'patrol', points: [{ x: 'a', z: 2 }] }).length > 0);
});
