// Step 10's systems: the registry and its event bus, stats with death and respawn, strike and bolt, hostile
// npcs, follow and flee, loot, pickups and use, all on small flat zones built here, and a replay with them on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, stepOnce, replay, terrainOf, TICK, MOVE } from '../sim/index.js';
import { registerSystem, bindSystems, REGISTRY } from '../sim/systems.js';
import { stat, checkTables, DEFAULT_TABLES, rollLoot, spawnDrop } from '../sim/systems/index.js';
import { checkIntent } from '../sim/index.js';

function flat(size = 100, res = 21) {
  return { format: 'dream-zone', version: 1, id: 'test', name: 'Test', size, cell: 50, terrain: terrainOf(new Float32Array(res * res), res), sky: {}, cells: [] };
}
const cell = (entities) => ({ format: 'dream-cell', version: 1, zone: 'test', x: 0, z: 0, entities });
const run = (sim, seconds) => { for (let t = 0; t < Math.round(seconds / TICK); t++) stepOnce(sim); };
/** A stationary dummy with stats at (x, z). */
const dummy = (uid, x, z, more = {}) => ({ uid, template: 'dummy', transform: { x, y: 0, z }, components: { stats: { maxHealth: 50 }, ...more } });
const boar = (uid, x, z, more = {}) => ({ uid, template: 'boar', transform: { x, y: 0, z }, components: { npc: { mode: 'stationary', home: { x, z }, radius: 6, speed: 1.5 }, hostile: { radius: 6, speed: 3, ability: 'strike' }, stats: { maxHealth: 40 }, ...more } });
const events = (sim, ...types) => { const out = []; for (const t of types) sim.on(t, (ev) => out.push({ type: t, ...ev })); return out; };

test('the built-in systems are registered in their fixed order', () => {
  assert.deepEqual(REGISTRY.map((s) => s.name), ['ai', 'stats', 'abilities', 'items']);
  assert.deepEqual(checkTables(DEFAULT_TABLES), []);
  assert.ok(checkTables({ abilities: [{ id: 'x', range: -1, arc: 90, cooldown: 1, cost: 0, damage: 1 }] }).some((p) => /range/.test(p)));
});

test('cast, pickup, use and drop intents are checked', () => {
  assert.deepEqual(checkIntent({ type: 'cast', ability: 'strike', target: 'a1' }), { type: 'cast', ability: 'strike', target: 'a1' });
  assert.equal(checkIntent({ type: 'cast', ability: 'strike', x: 1 }), null);
  assert.equal(checkIntent({ type: 'cast', ability: 'no spaces here' }), null);
  assert.deepEqual(checkIntent({ type: 'use', slot: 2 }), { type: 'use', slot: 2 });
  assert.equal(checkIntent({ type: 'drop', slot: -1 }), null);
  assert.equal(checkIntent({ type: 'pickup', uid: 7 }), null);
});

test('a strike in range and arc damages; out of range, out of arc, on cooldown or tired it is refused', () => {
  const sim = createSim({ zone: flat(), cells: [cell([dummy('t1', 0, 1.5), dummy('t2', 0, 6), dummy('t3', 0, -1.5)])] });
  const seen = events(sim, 'castResult', 'damage');
  sim.join('p1', { x: 0, z: 0, yaw: 0 }); // yaw 0 faces +z
  stepOnce(sim);
  sim.intent('p1', { type: 'cast', ability: 'strike', target: 't1' });
  stepOnce(sim);
  assert.equal(sim.world.get('t1').stats.health, 50 - 18);
  assert.equal(seen.filter((e) => e.type === 'damage').length, 1);
  sim.intent('p1', { type: 'cast', ability: 'strike', target: 't1' });
  stepOnce(sim);
  assert.equal(seen.at(-1).reason, 'cooldown');
  run(sim, 1.1);
  sim.intent('p1', { type: 'cast', ability: 'strike', target: 't2' });
  stepOnce(sim);
  assert.equal(seen.at(-1).reason, 'out of range');
  sim.intent('p1', { type: 'cast', ability: 'strike', target: 't3' });
  stepOnce(sim);
  assert.equal(seen.at(-1).reason, 'out of arc');
  assert.equal(sim.world.get('t3').stats.health, 50);
  sim.world.get('p1').stats.stamina = 5;
  const before = sim.world.get('t1').stats.health;
  sim.intent('p1', { type: 'cast', ability: 'strike', target: 't1' });
  stepOnce(sim);
  assert.equal(seen.at(-1).reason, 'tired');
  assert.ok(sim.world.get('t1').stats.health <= before + 0.1, 'no second hit (regeneration aside)');
  assert.equal(seen.filter((e) => e.type === 'damage').length, 1);
});

test('a bolt lands after its travel time and slows the target for 2 s', () => {
  const sim = createSim({ zone: flat(), cells: [cell([dummy('t1', 0, 10)])] });
  const seen = events(sim, 'damage');
  sim.join('p1', { x: 0, z: 0 });
  stepOnce(sim);
  sim.intent('p1', { type: 'cast', ability: 'bolt', target: 't1' });
  stepOnce(sim);
  assert.equal(seen.length, 0, 'not at once: 10 m at 20 m/s is half a second');
  run(sim, 0.5);
  assert.equal(seen.length, 1);
  const t = sim.world.get('t1');
  assert.ok(Math.abs(stat(t, 'speed') - t.stats.speed * 0.7) < 1e-9);
  run(sim, 2.1);
  assert.equal(stat(t, 'speed'), t.stats.speed);
});

test('a before hook vetoes or amends damage; after hooks see it happen', () => {
  const reg = [...REGISTRY];
  registerSystem({ name: 'shield', before: { damage: (sim, ev) => { if (ev.target === 't2') return false; ev.amount = 5; } }, after: { damage: (sim, ev) => { sim.afterSeen = ev.amount; } } }, reg);
  const sim = createSim({ zone: flat(), cells: [cell([dummy('t1', 0, 1.5), dummy('t2', 1, 1.5)])] });
  bindSystems(sim, reg);
  sim.join('p1', { x: 0, z: 0 });
  stepOnce(sim);
  sim.intent('p1', { type: 'cast', ability: 'strike', target: 't1' });
  stepOnce(sim);
  assert.equal(sim.world.get('t1').stats.health, 45);
  assert.equal(sim.afterSeen, 5);
  run(sim, 1.1);
  sim.intent('p1', { type: 'cast', ability: 'strike', target: 't2' });
  stepOnce(sim);
  assert.equal(sim.world.get('t2').stats.health, 50);
});

test('stamina drains on a run and refills; empty, the player walks', () => {
  const sim = createSim({ zone: flat(200) });
  sim.join('p1', { x: -90, z: 0 });
  stepOnce(sim);
  sim.intent('p1', { type: 'move', dir: { x: 1, z: 0 }, run: true });
  run(sim, 3);
  const p = sim.world.get('p1');
  assert.ok(p.stats.stamina < 55 && p.stats.stamina > 45, `stamina ${p.stats.stamina}`);
  run(sim, 3.5);
  assert.equal(p.tired, true);
  assert.ok(Math.hypot(p.vx, p.vz) <= MOVE.walk + 0.01, `tired: walking speed (${Math.hypot(p.vx, p.vz)})`);
  sim.intent('p1', { type: 'stop' });
  run(sim, 3.1);
  assert.equal(p.stats.stamina, 100);
});

test('a hostile aggros, chases, strikes, and walks home when the target is 2x radius away', () => {
  const sim = createSim({ zone: flat(), cells: [cell([boar('a1', 0, 0)])], spawn: { x: 30, z: 30 } });
  const seen = events(sim, 'aggro', 'damage', 'home');
  sim.join('p1', { x: 4, z: 0 });
  run(sim, 2.5);
  const b = sim.world.get('a1'), p = sim.world.get('p1');
  assert.equal(seen[0].type, 'aggro');
  assert.equal(seen[0].target, 'p1');
  assert.ok(seen.some((e) => e.type === 'damage' && e.uid === 'a1' && e.target === 'p1'), 'struck the player');
  assert.ok(p.stats.health < 100);
  assert.ok(Math.hypot(b.x - p.x, b.z - p.z) - MOVE.radius <= 2.01, 'closed in to strike range');
  // the player runs off past 2x radius from the boar's home
  sim.intent('p1', { type: 'moveTo', x: 20, z: 0, run: true });
  run(sim, 6);
  assert.ok(seen.some((e) => e.type === 'aggro' && e.target === null), 'gave up');
  run(sim, 8);
  const home = seen.find((e) => e.type === 'home');
  assert.ok(home && Math.hypot(home.x, home.z) <= 1.05, `home: ${JSON.stringify(home)}`);
  assert.equal(home.health, 40, 'healed at home');
});

test('death drops loot from its table with the seeded random and the npc respawns after `respawn`', () => {
  const make = (seed) => {
    const sim = createSim({ zone: flat(), cells: [cell([{ ...boar('a1', 0, 1.5), components: { ...boar('a1', 0, 1.5).components, hostile: { radius: 0.1 }, loot: { table: 'boar' }, spawn: { group: 'npc', respawn: 10 } } }])], seed });
    const seen = events(sim, 'death', 'drop', 'despawn', 'spawned');
    sim.join('p1', { x: 0, z: 0 });
    stepOnce(sim);
    sim.world.get('a1').stats.health = 10;
    sim.intent('p1', { type: 'cast', ability: 'strike', target: 'a1' });
    stepOnce(sim);
    return { sim, seen };
  };
  const { sim, seen } = make(5);
  assert.ok(seen.some((e) => e.type === 'death' && e.uid === 'a1'));
  assert.equal(sim.world.get('a1').anim, 'death');
  const drops = seen.filter((e) => e.type === 'drop').map((e) => [e.item, e.count]);
  assert.deepEqual(make(5).seen.filter((e) => e.type === 'drop').map((e) => [e.item, e.count]), drops, 'the same seed drops the same');
  run(sim, 3.05);
  assert.equal(sim.world.get('a1'), undefined, 'removed after the death pose');
  assert.equal(seen.find((e) => e.type === 'despawn' && e.uid === 'a1').respawn, 10);
  run(sim, 9.9);
  assert.equal(sim.world.get('a1'), undefined);
  run(sim, 0.2);
  const back = sim.world.get('a1');
  assert.ok(back && back.stats.health === 40 && !back.dead, 'back with full health');
  assert.ok(seen.some((e) => e.type === 'spawned' && e.uid === 'a1'));
});

test('a dead player respawns at the zone spawn with full stats after 3 s', () => {
  const sim = createSim({ zone: flat(), spawn: { x: 20, z: -10 } });
  const seen = events(sim, 'death', 'respawn');
  sim.join('p1', { x: 0, z: 0 });
  stepOnce(sim);
  sim.intent('p1', { type: 'move', dir: { x: 1, z: 0 } });
  stepOnce(sim);
  const p = sim.world.get('p1');
  p.stats.health = 1;
  sim.emit('noop', {});
  // a projectile from nobody: damage from the environment
  sim.projectiles.push({ at: sim.tick, from: 'none', to: 'p1', ability: 'strike' });
  stepOnce(sim);
  assert.equal(seen[0].type, 'death');
  assert.equal(p.order.type, 'stop');
  sim.intent('p1', { type: 'move', dir: { x: 1, z: 0 } });
  run(sim, 1);
  assert.ok(Math.hypot(p.vx, p.vz) < 1e-6, 'the dead do not walk');
  run(sim, 2.1);
  assert.ok(seen.some((e) => e.type === 'respawn'));
  assert.deepEqual([p.x, p.z], [20, -10]);
  assert.equal(p.stats.health, 100);
});

test('a chest drops its loot when opened, a pickup goes in the inventory, and use applies the modifier for its duration', () => {
  const chest = { uid: 'o1', template: 'chest', transform: { x: 0, y: 0, z: 1 }, components: { interact: { verb: 'open', range: 2 }, loot: { table: 'chest' } } };
  const sim = createSim({ zone: flat(), cells: [cell([chest])], seed: 3 });
  const seen = events(sim, 'drop', 'itemResult', 'inventory');
  sim.join('p1', { x: 0, z: 0 });
  stepOnce(sim);
  sim.intent('p1', { type: 'interact', uid: 'o1' });
  stepOnce(sim);
  const drops = seen.filter((e) => e.type === 'drop');
  assert.ok(drops.length >= 1, 'the chest dropped something');
  sim.intent('p1', { type: 'interact', uid: 'o1' });
  stepOnce(sim);
  assert.equal(seen.filter((e) => e.type === 'drop').length, drops.length, 'not again until it re-arms');
  for (const d of drops) sim.intent('p1', { type: 'pickup', uid: d.uid });
  stepOnce(sim);
  const p = sim.world.get('p1');
  assert.ok(seen.filter((e) => e.type === 'itemResult').every((e) => e.ok), JSON.stringify(seen.filter((e) => e.type === 'itemResult')));
  assert.equal(p.inventory.slots.filter(Boolean).reduce((n, s) => n + s.count, 0), drops.reduce((n, d) => n + d.count, 0));
  assert.equal(sim.world.get(drops[0].uid), undefined, 'picked up: gone');
  // a swift draught by hand: speed x1.5 for 10 s
  p.inventory.slots[5] = { item: 'swift', count: 1 };
  sim.intent('p1', { type: 'use', slot: 5 });
  stepOnce(sim);
  assert.equal(stat(p, 'speed'), 6);
  assert.equal(p.inventory.slots[5], null);
  run(sim, 10);
  assert.equal(stat(p, 'speed'), 4);
  // a potion heals 40, to the max
  p.stats.health = 30;
  p.inventory.slots[6] = { item: 'potion', count: 2 };
  sim.intent('p1', { type: 'use', slot: 6 });
  stepOnce(sim);
  assert.ok(p.stats.health >= 70 && p.stats.health < 71);
  assert.equal(p.inventory.slots[6].count, 1);
  sim.intent('p1', { type: 'drop', slot: 6 });
  stepOnce(sim);
  assert.equal(p.inventory.slots[6], null);
  assert.equal(seen.at(-1).type, 'inventory');
});

test('a pickup out of reach or into a full inventory is refused; drops lapse after 120 s', () => {
  const sim = createSim({ zone: flat() });
  const seen = events(sim, 'itemResult', 'despawn');
  sim.join('p1', { x: 0, z: 0, inventory: { size: 1, slots: [{ item: 'swift', count: 5 }] } });
  stepOnce(sim);
  const a = spawnDrop(sim, 'potion', 1, 0, 1), b = spawnDrop(sim, 'potion', 1, 10, 0);
  sim.intent('p1', { type: 'pickup', uid: a.uid });
  sim.intent('p1', { type: 'pickup', uid: b.uid });
  stepOnce(sim);
  assert.deepEqual(seen.filter((e) => e.type === 'itemResult').map((e) => e.reason), ['full', 'out of range']);
  run(sim, 120);
  assert.equal(sim.drops.size, 0);
  assert.equal(seen.filter((e) => e.type === 'despawn' && e.why === 'expired').length, 2);
});

test('follow walks after the nearest player and stops short; flee runs away', () => {
  const dog = { uid: 'a1', template: 'dog', transform: { x: 0, y: 0, z: 0 }, components: { npc: { mode: 'follow', home: { x: 0, z: 0 }, radius: 20, speed: 3 } } };
  const hare = { uid: 'a2', template: 'hare', transform: { x: 30, y: 0, z: 30 }, components: { npc: { mode: 'flee', home: { x: 30, z: 30 }, radius: 10, speed: 2 } } };
  const sim = createSim({ zone: flat(), cells: [cell([dog]), { ...cell([hare]), x: 1, z: 1 }] });
  sim.join('p1', { x: 10, z: 0 });
  run(sim, 5);
  const d = sim.world.get('a1');
  const gap = Math.hypot(d.x - 10, d.z);
  assert.ok(gap > 2 && gap < 3, `follower ${gap} m off`);
  sim.intent('p1', { type: 'moveTo', x: 26, z: 30 });
  run(sim, 9);
  const h = sim.world.get('a2');
  assert.ok(h.x > 33, `the hare fled to ${h.x}`);
});

test('a replay with casts, a hostile, loot and pickups matches', () => {
  const chest = { uid: 'o1', template: 'chest', transform: { x: 3, y: 0, z: 1 }, components: { interact: { verb: 'open', range: 2 }, loot: { table: 'chest' } } };
  const opts = () => ({ zone: flat(), cells: [cell([boar('a1', -3, 0, { loot: { table: 'boar' }, spawn: { group: 'npc', respawn: 4 } }), chest])], seed: 11, spawn: { x: 10, z: 10, radius: 3 } });
  const a = createSim(opts());
  a.join('p1', { x: 0, z: 0 });
  for (let t = 0; t < 500; t++) {
    if (t % 25 === 3) a.intent('p1', { type: 'cast', ability: t % 50 === 3 ? 'strike' : 'bolt' });
    if (t === 60) a.intent('p1', { type: 'moveTo', x: 3, z: 0 });
    if (t === 90) a.intent('p1', { type: 'interact', uid: 'o1' });
    if (t > 95 && t % 10 === 0) for (const uid of a.drops.keys()) a.intent('p1', { type: 'pickup', uid });
    if (t === 200) a.intent('p1', { type: 'use', slot: 0 });
    stepOnce(a);
  }
  const b = replay(opts(), a.log, 500);
  const where = (s) => [...s.world.entities.values()].filter((e) => e.dynamic || e.kind === 'drop').map((e) => [e.uid, e.x, e.y, e.z, e.yaw, e.anim, e.stats?.health ?? null, JSON.stringify(e.inventory ?? null)]).sort();
  assert.ok(a.log.some((l) => l.intent?.type === 'cast'), 'casts in the log');
  assert.deepEqual(where(b), where(a));
});
