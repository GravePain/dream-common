// node --test test/predict.test.mjs   (from dream-common): the prediction core (net/predict.js) against a
// server sim that keeps a player's seq the way the Dream Server's room does, with messages delayed (and
// dropped) in ticks: agreement with no lag, no corrections with 200 ms of lag on open ground, one correction
// after the server moves the player, and a dropped intent reconciled.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, stepOnce, terrainOf, TICK } from '../sim/index.js';
import { createPredictor, TOLERANCE } from '../net/predict.js';

function flatZone(size = 100, res = 51) {
  return { format: 'dream-zone', version: 1, id: 'test', name: 'Test', size, cell: 50, terrain: terrainOf(new Float32Array(res * res), res), sky: {}, cells: [] };
}
const input = () => ({ zone: flatZone(), cells: [], templates: [] });

/**
 * A client and a server sim joined by a pipe `lag` ticks long each way. `script[k]` is the intent the client
 * sends on tick k; `drop(seq)` loses that intent on the way. Returns what happened per tick.
 */
function play({ ticks, script = {}, lag = 0, drop = () => false, onServer = () => {} }) {
  const server = createSim({ ...input(), seed: 1 });
  server.join('p1', { x: 0, z: 0 });
  stepOnce(server);
  const client = createPredictor({ ...input(), uid: 'p1', at: { x: 0, y: 0, z: 0 } });
  const up = [], down = [], out = [];
  let applied = 0, queued = 0;
  for (let k = 0; k < ticks; k++) {
    // the client: snapshots in, an intent out, a tick on its clock
    for (const m of down.filter((m) => m.at <= k)) {
      const r = client.reconcile(m.tick, m.e);
      if (r) out.push({ k, ...r });
    }
    down.splice(0, down.length, ...down.filter((m) => m.at > k));
    if (script[k]) {
      const seq = client.intent(script[k]);
      if (!drop(seq)) up.push({ at: k + lag, seq, intent: script[k] });
    }
    client.update(TICK);
    // the server: intents in (a seq at or below the last taken is dropped), one tick, a snapshot out
    for (const m of up.filter((m) => m.at <= k)) if (m.seq > Math.max(applied, queued) && server.intent('p1', m.intent)) queued = m.seq;
    up.splice(0, up.length, ...up.filter((m) => m.at > k));
    onServer(server, k);
    const tick = server.tick;
    stepOnce(server);
    if (queued) { applied = queued; queued = 0; }
    const e = server.world.get('p1');
    down.push({ at: k + lag, tick, e: { seq: applied || undefined, x: e.x, y: e.y, z: e.z, yaw: e.yaw } });
  }
  return { client, server, out };
}
const walk = { 2: { type: 'move', dir: { x: 1, z: 0 } }, 30: { type: 'move', dir: { x: 0, z: 1 }, run: true }, 55: { type: 'move', dir: { x: -1, z: 1 } }, 80: { type: 'stop' } };

test('a client sim and a server sim fed the same intents agree exactly with no lag', () => {
  const { client, server, out } = play({ ticks: 100, script: walk });
  const c = client.state(), s = server.world.get('p1');
  assert.ok(Math.hypot(c.x - s.x, c.z - s.z) < 1e-9, `client ${c.x},${c.z} server ${s.x},${s.z}`);
  assert.ok(out.length > 50 && out.every((r) => r.error < 1e-9 && !r.corrected), 'every snapshot agrees');
  assert.ok(Math.hypot(s.x, s.z) > 10, 'the player walked');
});

test('with 200 ms of lag each way the history reconciles without a correction over 2 cm on open ground', () => {
  const { client, server, out } = play({ ticks: 120, script: walk, lag: 4 });
  assert.ok(out.length > 50, `${out.length} snapshots lined up`);
  assert.equal(out.filter((r) => r.corrected).length, 0);
  assert.ok(Math.max(...out.map((r) => r.error)) <= TOLERANCE);
  const c = client.state(), s = server.world.get('p1');
  assert.ok(Math.hypot(c.x - s.x, c.z - s.z) < 1e-9, 'stood still in the same place');
});

test('a server-side block (the server moves the player) gives one correction and then agreement', () => {
  const { client, server, out } = play({
    ticks: 100, lag: 3, script: { 2: { type: 'move', dir: { x: 1, z: 0 } }, 70: { type: 'stop' } },
    onServer: (sim, k) => { if (k === 30) { const e = sim.world.get('p1'); sim.world.place(e, e.x - 1, e.z); } },
  });
  const fixes = out.filter((r) => r.corrected);
  assert.equal(fixes.length, 1, `corrections at ${fixes.map((r) => r.k)}`);
  assert.ok(fixes[0].error > 0.9 && fixes[0].error < 1.1, `the correction was ${fixes[0].error} m`);
  assert.ok(out.filter((r) => r.k > fixes[0].k).every((r) => r.error <= TOLERANCE), 'agreement after it');
  const c = client.state(), s = server.world.get('p1');
  assert.ok(Math.hypot(c.x - s.x, c.z - s.z) < 1e-6);
});

test('a dropped intent (a gap in seq) is reconciled', () => {
  const script = { 2: { type: 'move', dir: { x: 1, z: 0 } }, 20: { type: 'move', dir: { x: 0, z: 1 } }, 40: { type: 'stop' } };
  const { client, server, out } = play({ ticks: 90, lag: 2, script, drop: (seq) => seq === 2 });
  assert.ok(out.some((r) => r.corrected), 'the lost turn is corrected');
  assert.ok(out.filter((r) => r.k > 60).every((r) => r.error <= TOLERANCE), 'agreement once both stand still');
  const c = client.state(), s = server.world.get('p1');
  assert.ok(Math.hypot(c.x - s.x, c.z - s.z) < 1e-6, `client ${c.x},${c.z} server ${s.x},${s.z}`);
  assert.ok(Math.abs(s.z) < 1e-9, 'the server never turned');
});

test('a malformed intent is not given a seq; reset drops the history', () => {
  const p = createPredictor({ ...input(), uid: 'p1' });
  assert.equal(p.intent({ type: 'fly' }), 0);
  assert.equal(p.intent({ type: 'stop' }), 1);
  p.update(TICK * 3);
  assert.equal(p.history.length, 3);
  p.reset({ x: 5, z: 5, y: 0 });
  assert.equal(p.history.length, 0);
  assert.equal(p.state().x, 5);
});
