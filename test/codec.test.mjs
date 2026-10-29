// The binary snapshot codec (net/codec.js): round trips within the quantisation, a cell delta on the
// previous tick's state, a full cell replacing what was held, entities leaving a cell, dropped cells.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSnapshot, createDecoder, quantise, maskOf, POS, HEIGHT } from '../net/codec.js';

const SIZE = 200; // four cells a side; x1z1 spans -50..0
const ents = [
  { uid: 'p1', x: -12.3456, y: 3.217, z: -40.001, yaw: 2.5, anim: 'run', seq: 77 },
  { uid: 'a3', x: -49.999, y: -1.5, z: -0.001, yaw: -3.1, anim: 'walk' },
];
const slots = { p1: 1, a3: 2 };
const whole = (e) => ({ slot: slots[e.uid], base: 0, mask: maskOf(quantise(e)), q: quantise(e) });
const full = (tick, list, more = {}) => encodeSnapshot({ tick, at: 1e12 + tick * 50, size: SIZE, cells: [{ i: 1, j: 1, full: true, records: list.map(whole) }], ...more });

test('a full frame round trips to within the quantisation', () => {
  const d = createDecoder({ size: SIZE, slots });
  const r = d.decode(full(5, ents));
  assert.equal(r.tick, 5);
  assert.equal(r.at, 1e12 + 250);
  assert.equal(r.fulls, 2);
  const [s] = r.snapshots;
  assert.equal(s.cell, 'x1z1');
  for (const e of ents) {
    const g = s.entities.find((x) => x.uid === e.uid);
    assert.ok(Math.abs(g.x - e.x) <= POS / 2 + 1e-9 && Math.abs(g.z - e.z) <= POS / 2 + 1e-9, `${e.uid} x, z`);
    assert.ok(Math.abs(g.y - e.y) <= HEIGHT / 2 + 1e-9, `${e.uid} y`);
    const dy = Math.abs(((g.yaw - e.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    assert.ok(dy < 0.001, `${e.uid} yaw`);
    assert.equal(g.anim, e.anim);
    assert.equal(g.seq, e.seq);
  }
});

test('a cell delta applies to the previous tick\'s state and matches a full frame of the new one', () => {
  const d = createDecoder({ size: SIZE, slots }), ref = createDecoder({ size: SIZE, slots });
  d.decode(full(10, ents));
  const moved = { ...ents[0], x: -11.9, anim: 'walk', seq: 78 };
  const q = quantise(moved), mask = maskOf(q, quantise(ents[0]));
  assert.equal(mask, 1 | 16 | 32, 'only x, anim and seq changed');
  const delta = encodeSnapshot({ tick: 11, at: 0, size: SIZE, cells: [{ i: 1, j: 1, records: [{ slot: 1, base: 1, mask, q }] }] });
  const got = d.decode(delta).snapshots[0].entities;
  const want = ref.decode(full(11, [moved, ents[1]])).snapshots[0].entities;
  assert.deepEqual(got, want, 'the delta plus what the client held is the full snapshot');
  assert.ok(delta.length < full(11, [moved]).length, 'the delta is smaller');
});

test('a full cell replaces what was held; left slots and dropped cells go; a delta on nothing is a miss', () => {
  const d = createDecoder({ size: SIZE, slots });
  d.decode(full(1, ents));
  let r = d.decode(full(2, [ents[0]]));
  assert.deepEqual(r.snapshots[0].entities.map((e) => e.uid), ['p1'], 'a full cell drops what it does not list');
  r = d.decode(encodeSnapshot({ tick: 3, at: 0, size: SIZE, cells: [{ i: 1, j: 1, records: [whole(ents[1])], left: [1] }] }));
  assert.deepEqual(r.snapshots[0].entities.map((e) => e.uid), ['a3'], 'a3 entered, p1 left');
  r = d.decode(encodeSnapshot({ tick: 4, at: 0, size: SIZE, cells: [{ i: 1, j: 1, records: [{ slot: 1, base: 1, mask: 1, q: quantise(ents[0]) }] }] }));
  assert.equal(r.misses, 1, 'p1 is not held');
  // p1 moves into x2z1 (seen); x1z1's left for it arrives after: it stays, held in its new cell
  const there = { ...ents[0], x: 10 };
  r = d.decode(encodeSnapshot({ tick: 5, at: 0, size: SIZE, cells: [{ i: 2, j: 1, records: [whole(there)] }, { i: 1, j: 1, left: [1] }] }));
  assert.deepEqual(r.snapshots.find((s) => s.cell === 'x2z1').entities.map((e) => e.uid), ['p1']);
  r = d.decode(encodeSnapshot({ tick: 6, at: 0, size: SIZE, cells: [{ i: 2, j: 1 }], dropped: [{ i: 1, j: 1 }] }));
  assert.equal(d.known, 1, 'a3 went with its cell');
});
