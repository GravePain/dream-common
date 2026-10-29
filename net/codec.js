// dream-common/net/codec.js: the binary snapshot frames. The server encodes, Dream World's Play online and
// the bots decode, all through this file. Plain JS, no DOM, no Node: DataView only.
//
// Step 9 (item 0): frames are made of cell segments. Each cell encodes one segment per tick, a delta against
// its own previous tick, shared by every client that sees the cell; over a WebSocket (TCP: in order, or the
// socket dies) a client that got every segment of a cell holds the cell's state, so nothing is acked. A
// client's frame is the segments of the cells it sees, plus a full segment for a cell it does not hold
// (entering its view, after a welcome, resume or transfer, or after missing more than one tick of it).
// The decoder rebuilds whole entities and hands back the same `{ tick, at, cell, entities }` snapshots the
// JSON protocol did, so nothing above it changes. README.md has the layout byte by byte.

import { CELL } from '../web/schema/zone.js';

export const SNAPSHOT = 1;
/** Packet cap per client per tick (bytes): the nearest cells first; the player's own cell always. */
export const CAP = 1200;
export const POS = 0.002;   // m per unit of x and z, relative to the cell centre (int16: +-65 m)
export const HEIGHT = 0.01; // m per unit of y, absolute (int16: +-327 m)
const YAWQ = 65536 / (Math.PI * 2);
/** anim as a byte; an anim not here travels as 255 and decodes as 'idle'. Append only. */
export const ANIMS = ['idle', 'walk', 'run', 'death', 'jump', 'cast', 'hit'];
export const FIELDS = ['x', 'z', 'y', 'yaw', 'anim', 'seq'];
const BYTES = { x: 2, z: 2, y: 2, yaw: 2, anim: 1, seq: 4 };
export const HEADER = 1 + 4 + 8 + 2 + 1;  // type, tick, at, dropped-cell count, segment count
export const CELL_HEADER = 7;             // i, j, flags, record count, left count
export const RECORD = 4;                  // slot, mask, base
/** Segment flags: bit 0 full (the client drops what it holds in that cell first). */
export const FULL = 1;

const clamp16 = (v) => Math.max(-32768, Math.min(32767, v));
/** An entity's fields as the integers that travel (x, z, y absolute in their units). */
export function quantise(e) {
  const yaw = Math.round((e.yaw ?? 0) * YAWQ) % 65536;
  const a = ANIMS.indexOf(e.anim);
  const q = { x: Math.round(e.x / POS), z: Math.round(e.z / POS), y: clamp16(Math.round(e.y / HEIGHT)), yaw: yaw < 0 ? yaw + 65536 : yaw, anim: a < 0 ? 255 : a };
  if (e.seq !== undefined) q.seq = e.seq >>> 0;
  return q;
}
export const sameQ = (a, b) => a.x === b.x && a.z === b.z && a.y === b.y && a.yaw === b.yaw && a.anim === b.anim && a.seq === b.seq;
/** The fields of `q` that differ from `base` (all present ones without a base), as a mask. */
export function maskOf(q, base) {
  if (!base) return 15 | 16 | (q.seq !== undefined ? 32 : 0);
  return (q.x !== base.x ? 1 : 0) | (q.z !== base.z ? 2 : 0) | (q.y !== base.y ? 4 : 0) | (q.yaw !== base.yaw ? 8 : 0)
    | (q.anim !== base.anim ? 16 : 0) | (q.seq !== undefined && q.seq !== base.seq ? 32 : 0);
}
const SIZES = Array.from({ length: 64 }, (_, mask) => RECORD + FIELDS.reduce((n, f, i) => n + (mask & (1 << i) ? BYTES[f] : 0), 0));
export const recordSize = (mask) => SIZES[mask];
/** A cell's centre along one axis in POS units, from its index and the zone's size. */
export const centre = (k, size) => Math.round((-size / 2 + (k + 0.5) * CELL) / POS);
export const cellIJ = (name) => { const m = /^x(\d+)z(\d+)$/.exec(name); return m ? { i: +m[1], j: +m[2] } : null; };

/**
 * One cell segment: `{ i, j, full, records: [{ slot, base, mask, q }], left: [slot] }` (base 0: the whole
 * entity, all fields; 1: a delta on what the client holds for that slot). `left`: slots that were in this
 * cell last tick and are not now (moved on or gone). `size` is the zone's (for the cell centre).
 */
export function encodeSegment({ i, j, full = false, records = [], left = [] }, size) {
  let n = CELL_HEADER + left.length * 2;
  for (const r of records) n += SIZES[r.mask];
  const buf = new Uint8Array(n), v = new DataView(buf.buffer);
  const ox = centre(i, size), oz = centre(j, size);
  v.setUint8(0, i); v.setUint8(1, j); v.setUint8(2, full ? FULL : 0); v.setUint16(3, records.length); v.setUint16(5, left.length);
  let o = CELL_HEADER;
  for (const r of records) {
    const q = r.q, m = r.mask;
    v.setUint16(o, r.slot); v.setUint8(o + 2, m); v.setUint8(o + 3, r.base); o += RECORD;
    if (m & 1) { v.setInt16(o, clamp16(q.x - ox)); o += 2; }
    if (m & 2) { v.setInt16(o, clamp16(q.z - oz)); o += 2; }
    if (m & 4) { v.setInt16(o, q.y); o += 2; }
    if (m & 8) { v.setUint16(o, q.yaw); o += 2; }
    if (m & 16) { v.setUint8(o, q.anim); o += 1; }
    if (m & 32) { v.setUint32(o, q.seq); o += 4; }
  }
  for (const s of left) { v.setUint16(o, s); o += 2; }
  return buf;
}

/** One client's frame: the header, the cells that left its view (`dropped`: [{ i, j }]), the segments' bytes. */
export function encodeFrame({ tick, at, dropped = [], segments }) {
  let n = HEADER + dropped.length * 2;
  for (const s of segments) n += s.length;
  const buf = new Uint8Array(n), v = new DataView(buf.buffer);
  v.setUint8(0, SNAPSHOT); v.setUint32(1, tick >>> 0); v.setFloat64(5, at); v.setUint16(13, dropped.length);
  let o = 15;
  for (const c of dropped) { v.setUint8(o, c.i); v.setUint8(o + 1, c.j); o += 2; }
  v.setUint8(o, segments.length); o += 1;
  for (const s of segments) { buf.set(s, o); o += s.length; }
  return buf;
}

/** A whole frame from objects (tests): `cells` as encodeSegment takes them. */
export const encodeSnapshot = ({ tick, at, size, cells, dropped = [] }) => encodeFrame({ tick, at, dropped, segments: cells.map((c) => encodeSegment(c, size)) });

function toBytes(x) {
  if (x instanceof Uint8Array) return x;
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  return null;
}

const round = (v) => Math.round(v * 1000) / 1000;
/** A quantised entity back to the protocol's shape. */
export function viewOf(uid, q) {
  let yaw = q.yaw / YAWQ;
  if (yaw > Math.PI) yaw -= Math.PI * 2;
  const e = { uid, x: round(q.x * POS), y: round(q.y * HEIGHT), z: round(q.z * POS), yaw: round(yaw), anim: ANIMS[q.anim] ?? 'idle' };
  if (q.seq !== undefined) e.seq = q.seq;
  return e;
}

/**
 * The client side. `size` is the zone's (welcome.size), `slots` the welcome's `{ uid: slot }`; `slot(uid, s)`
 * on a join, `forget(uid)` on a leave. `decode(bytes)` gives `{ tick, at, snapshots, fulls, misses, bytes }`,
 * one snapshot per cell in the frame (every entity held in it). A delta for a slot it does not hold is a miss
 * (dropped; with in-order delivery it does not happen).
 */
export function createDecoder({ size, slots = {} }) {
  const uids = new Map(Object.entries(slots).map(([u, s]) => [s, u]));
  const ents = new Map(); // uid -> { cell, q }
  const dropCell = (cell) => { for (const [u, e] of ents) if (e.cell === cell) ents.delete(u); };
  return {
    slot(uid, s) { uids.set(s, uid); },
    forget(uid) { ents.delete(uid); for (const [s, u] of uids) if (u === uid) uids.delete(s); },
    get known() { return ents.size; },
    decode(bytes) {
      const b = toBytes(bytes);
      if (!b || b[0] !== SNAPSHOT) return null;
      const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
      const tick = v.getUint32(1), at = v.getFloat64(5), nd = v.getUint16(13);
      let o = 15;
      for (let k = 0; k < nd; k++) { dropCell(`x${v.getUint8(o)}z${v.getUint8(o + 1)}`); o += 2; }
      const ns = v.getUint8(o); o += 1;
      const order = [];
      let fulls = 0, misses = 0;
      for (let c = 0; c < ns; c++) {
        const i = v.getUint8(o), j = v.getUint8(o + 1), flags = v.getUint8(o + 2), count = v.getUint16(o + 3), nl = v.getUint16(o + 5); o += CELL_HEADER;
        const cell = `x${i}z${j}`, ox = centre(i, size), oz = centre(j, size);
        if (flags & FULL) dropCell(cell);
        if (!order.includes(cell)) order.push(cell);
        for (let r = 0; r < count; r++) {
          const s = v.getUint16(o), m = v.getUint8(o + 2), back = v.getUint8(o + 3); o += RECORD;
          const f = {};
          if (m & 1) { f.x = ox + v.getInt16(o); o += 2; }
          if (m & 2) { f.z = oz + v.getInt16(o); o += 2; }
          if (m & 4) { f.y = v.getInt16(o); o += 2; }
          if (m & 8) { f.yaw = v.getUint16(o); o += 2; }
          if (m & 16) { f.anim = v.getUint8(o); o += 1; }
          if (m & 32) { f.seq = v.getUint32(o); o += 4; }
          const uid = uids.get(s);
          if (!uid) continue;
          if (!back) { fulls++; ents.set(uid, { cell, q: f }); continue; }
          const e = ents.get(uid);
          if (!e) { misses++; continue; }
          e.cell = cell; e.q = { ...e.q, ...f };
        }
        for (let k = 0; k < nl; k++) { const u = uids.get(v.getUint16(o)); o += 2; if (u && ents.get(u)?.cell === cell) ents.delete(u); }
      }
      const by = new Map(order.map((c) => [c, []]));
      for (const [uid, e] of ents) by.get(e.cell)?.push(viewOf(uid, e.q));
      const snapshots = order.map((cell) => ({ tick, at, cell, entities: by.get(cell).sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)) }));
      return { tick, at, snapshots, fulls, misses, bytes: b.length };
    },
  };
}
