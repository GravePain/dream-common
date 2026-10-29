// dream-common/net/codec.js: the binary snapshot and ack frames (step 7). The server encodes, Dream World's
// Play online and the bots decode, all through this file. Plain JS, no DOM, no Node: DataView only.
//
// A snapshot frame carries one tick for one client: the cells of its area of interest, in each the movers
// that changed since that client's acked baseline for them (or all their fields when it has none), the
// slots that left its view, and per cell whether everything unchanged in it is current (`complete`).
// The decoder rebuilds whole entities and hands back the same `{ tick, at, cell, entities }` snapshots the
// JSON protocol did, so nothing above it changes. README.md has the layout byte by byte.
import { CELL } from '../web/schema/zone.js';

export const SNAPSHOT = 1, ACK = 2;
/** Ticks of baselines the server may delta against (and the decoder keeps). */
export const WINDOW = 32;
/** Packet cap per client per tick (bytes). */
export const CAP = 1200;
export const POS = 0.002;   // m per unit of x and z, relative to the cell centre (int16: +-65 m)
export const HEIGHT = 0.01; // m per unit of y, absolute (int16: +-327 m)
const YAWQ = 65536 / (Math.PI * 2);
/** anim as a byte; an anim not here travels as 255 and decodes as 'idle'. Append only. */
export const ANIMS = ['idle', 'walk', 'run', 'death', 'jump', 'cast', 'hit'];
export const FIELDS = ['x', 'z', 'y', 'yaw', 'anim', 'seq'];
const BYTES = { x: 2, z: 2, y: 2, yaw: 2, anim: 1, seq: 4 };
export const HEADER = 1 + 4 + 8 + 1 + 2;  // type, tick, at, cell count, removed count
export const CELL_HEADER = 5;             // i, j, flags, record count
export const RECORD = 4;                  // slot, mask, base

const clamp16 = (v) => Math.max(-32768, Math.min(32767, v));
/** An entity's fields as the integers that travel (x, z, y absolute in their units). */
export function quantise(e) {
  const yaw = Math.round((e.yaw ?? 0) * YAWQ) % 65536;
  const a = ANIMS.indexOf(e.anim);
  const q = { x: Math.round(e.x / POS), z: Math.round(e.z / POS), y: clamp16(Math.round(e.y / HEIGHT)), yaw: yaw < 0 ? yaw + 65536 : yaw, anim: a < 0 ? 255 : a };
  if (e.seq !== undefined) q.seq = e.seq >>> 0;
  return q;
}
// these three run for every mover for every client every tick: unrolled
export const sameQ = (a, b) => a.x === b.x && a.z === b.z && a.y === b.y && a.yaw === b.yaw && a.anim === b.anim && a.seq === b.seq;
/** The fields of `q` that differ from `base` (all present ones without a base), as a mask. */
export function maskOf(q, base) {
  if (!base) return 15 | 16 | (q.seq !== undefined ? 32 : 0);
  return (q.x !== base.x ? 1 : 0) | (q.z !== base.z ? 2 : 0) | (q.y !== base.y ? 4 : 0) | (q.yaw !== base.yaw ? 8 : 0)
    | (q.anim !== base.anim ? 16 : 0) | (q.seq !== undefined && q.seq !== base.seq ? 32 : 0);
}
const SIZES = Array.from({ length: 64 }, (_, mask) => RECORD + FIELDS.reduce((n, f, i) => n + (mask & (1 << i) ? BYTES[f] : 0), 0));
export const recordSize = (mask) => SIZES[mask];
/** A cell's centre in POS units, from its i, j and the zone's size. */
const centre = (k, size) => Math.round((-size / 2 + (k + 0.5) * CELL) / POS);
export const cellIJ = (name) => { const m = /^x(\d+)z(\d+)$/.exec(name); return m ? { i: +m[1], j: +m[2] } : null; };

/**
 * One snapshot frame. `cells: [{ i, j, complete, records: [{ slot, base, mask, q }] }]` (base: ticks back to
 * the baseline, 0 for none), `removed: [slot]`. `size` is the zone's (for the cell centres).
 */
export function encodeSnapshot({ tick, at, size, cells, removed = [] }) {
  let n = HEADER + removed.length * 2;
  for (const c of cells) { n += CELL_HEADER; for (const r of c.records) n += recordSize(r.mask); }
  const buf = new Uint8Array(n), v = new DataView(buf.buffer);
  let o = 0;
  v.setUint8(o, SNAPSHOT); o += 1;
  v.setUint32(o, tick >>> 0); o += 4;
  v.setFloat64(o, at); o += 8;
  v.setUint16(o, removed.length); o += 2;
  for (const s of removed) { v.setUint16(o, s); o += 2; }
  v.setUint8(o, cells.length); o += 1;
  for (const c of cells) {
    const ox = centre(c.i, size), oz = centre(c.j, size);
    v.setUint8(o, c.i); v.setUint8(o + 1, c.j); v.setUint8(o + 2, c.complete ? 1 : 0); v.setUint16(o + 3, c.records.length); o += CELL_HEADER;
    for (const r of c.records) {
      v.setUint16(o, r.slot); v.setUint8(o + 2, r.mask); v.setUint8(o + 3, r.base); o += RECORD;
      const q = r.q, m = r.mask;
      if (m & 1) { v.setInt16(o, clamp16(q.x - ox)); o += 2; }
      if (m & 2) { v.setInt16(o, clamp16(q.z - oz)); o += 2; }
      if (m & 4) { v.setInt16(o, q.y); o += 2; }
      if (m & 8) { v.setUint16(o, q.yaw); o += 2; }
      if (m & 16) { v.setUint8(o, q.anim); o += 1; }
      if (m & 32) { v.setUint32(o, q.seq); o += 4; }
    }
  }
  return buf;
}

/** The client's ack: the newest tick it applied. */
export function encodeAck(tick) {
  const buf = new Uint8Array(5);
  buf[0] = ACK;
  new DataView(buf.buffer).setUint32(1, tick >>> 0);
  return buf;
}
/** An ack frame's tick, or null when the bytes are not one. */
export function decodeAck(bytes) {
  const b = toBytes(bytes);
  return b && b.length === 5 && b[0] === ACK ? new DataView(b.buffer, b.byteOffset, 5).getUint32(1) : null;
}
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
 * on a join, `forget(uid)` on a leave. `decode(bytes)` gives `{ tick, at, snapshots, fulls, misses }`, one
 * snapshot per cell in the frame; the caller acks `tick`. A record whose baseline it no longer has is a miss
 * (dropped; the server's window and ours make that not happen in practice).
 */
export function createDecoder({ size, slots = {} }) {
  const uids = new Map(Object.entries(slots).map(([u, s]) => [s, u]));
  const ents = new Map(); // uid -> { cell, q, hist: Map tick -> q }
  return {
    slot(uid, s) { uids.set(s, uid); },
    forget(uid) { ents.delete(uid); for (const [s, u] of uids) if (u === uid) uids.delete(s); },
    get known() { return ents.size; },
    decode(bytes) {
      const b = toBytes(bytes);
      if (!b || b[0] !== SNAPSHOT) return null;
      const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
      let o = 1;
      const tick = v.getUint32(o); o += 4;
      const at = v.getFloat64(o); o += 8;
      const nr = v.getUint16(o); o += 2;
      for (let k = 0; k < nr; k++) { const u = uids.get(v.getUint16(o)); o += 2; if (u) ents.delete(u); }
      const nc = v.getUint8(o); o += 1;
      const snapshots = [];
      let fulls = 0, misses = 0;
      for (let c = 0; c < nc; c++) {
        const i = v.getUint8(o), j = v.getUint8(o + 1), complete = v.getUint8(o + 2) & 1, count = v.getUint16(o + 3); o += CELL_HEADER;
        const cell = `x${i}z${j}`, ox = centre(i, size), oz = centre(j, size);
        const listed = new Set(), out = [];
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
          let e = ents.get(uid), base = null;
          if (back) {
            base = e?.hist.get(tick - back);
            if (!base) { misses++; continue; }
          } else fulls++;
          const q = base ? { ...base, ...f } : f;
          if (!e || !back) { e = { cell, q, hist: new Map() }; ents.set(uid, e); }
          e.cell = cell; e.q = q; e.hist.set(tick, q);
          for (const t of e.hist.keys()) if (t < tick - WINDOW - 8) e.hist.delete(t);
          listed.add(uid);
          out.push(viewOf(uid, q));
        }
        if (complete) for (const [uid, e] of ents) if (e.cell === cell && !listed.has(uid)) out.push(viewOf(uid, e.q));
        out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
        snapshots.push({ tick, at, cell, entities: out });
      }
      return { tick, at, snapshots, fulls, misses, bytes: b.length };
    },
  };
}
