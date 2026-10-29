// The binary snapshot codec (net/codec.js): round trips within the quantisation, deltas against a baseline,
// the cell-complete flag, removals and acks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSnapshot, createDecoder, quantise, maskOf, encodeAck, decodeAck, POS, HEIGHT } from '../net/codec.js';

const SIZE = 200; // four cells a side; x1z1 spans -50..0
const ents = [
  { uid: 'p1', x: -12.3456, y: 3.217, z: -40.001, yaw: 2.5, anim: 'run', seq: 77 },
  { uid: 'a3', x: -49.999, y: -1.5, z: -0.001, yaw: -3.1, anim: 'walk' },
];
const slots = { p1: 1, a3: 2 };
const full = (tick, list, more = {}) => encodeSnapshot({ tick, at: 1e12 + tick * 50, size: SIZE, cells: [{ i: 1, j: 1, complete: true, records: list.map((e) => ({ slot: slots[e.uid], base: 0, mask: maskOf(quantise(e)), q: quantise(e) })) }], ...more });

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

test('a delta against a baseline gives the same state as a full frame of it', () => {
  const d = createDecoder({ size: SIZE, slots }), ref = createDecoder({ size: SIZE, slots });
  d.decode(full(10, ents));
  const moved = { ...ents[0], x: -11.9, anim: 'walk', seq: 78 };
  const q = quantise(moved), mask = maskOf(q, quantise(ents[0]));
  assert.equal(mask, 1 | 16 | 32, 'only x, anim and seq changed');
  const delta = encodeSnapshot({ tick: 12, at: 0, size: SIZE, cells: [{ i: 1, j: 1, complete: true, records: [{ slot: 1, base: 2, mask, q }] }] });
  const got = d.decode(delta).snapshots[0].entities;
  const want = ref.decode(full(12, [moved, ents[1]])).snapshots[0].entities;
  assert.deepEqual(got, want, 'delta plus the complete cell repeat matches the full snapshot');
  assert.ok(delta.length < full(12, [moved]).length, 'the delta is smaller');
});

test('an incomplete cell leaves out what was not sent; a missing baseline is a miss; removals and acks', () => {
  const d = createDecoder({ size: SIZE, slots });
  d.decode(full(1, ents));
  const q = quantise({ ...ents[0], x: -12 });
  let r = d.decode(encodeSnapshot({ tick: 2, at: 0, size: SIZE, cells: [{ i: 1, j: 1, complete: false, records: [{ slot: 1, base: 1, mask: 1, q }] }] }));
  assert.deepEqual(r.snapshots[0].entities.map((e) => e.uid), ['p1'], 'a3 deferred: not repeated');
  r = d.decode(encodeSnapshot({ tick: 50, at: 0, size: SIZE, cells: [{ i: 1, j: 1, complete: false, records: [{ slot: 1, base: 45, mask: 1, q }] }] }));
  assert.equal(r.misses, 1);
  r = d.decode(encodeSnapshot({ tick: 51, at: 0, size: SIZE, cells: [{ i: 1, j: 1, complete: true, records: [] }], removed: [2] }));
  assert.deepEqual(r.snapshots[0].entities.map((e) => e.uid), ['p1'], 'a3 removed');
  assert.equal(decodeAck(encodeAck(123456)), 123456);
  assert.equal(decodeAck(new Uint8Array([1, 0, 0, 0, 1])), null);
});
