// One-off: give every Creations GLB saved before Dream Forge's collider job a `meta.colliders` list, in the
// shape the Forge writes ({ shape, size, trigger, x, y, z, rotY } in the piece's space). The bounds come from
// the GLB's POSITION accessor min/max taken through each node's world transform.
//   - a box to the bounds;
//   - a cylinder when the footprint is within 15 % of square and the name says rock, boulder, barrel, tree,
//     trunk or log;
//   - nothing (an empty list) for pieces under 0.3 m tall (a sandbank, grass tufts): you walk over them.
// Skips Characters/, Autosaves/, .versions/, garments (meta.wear) and any piece that already has colliders.
// Saves through the Library (a new version of each piece, the old one kept).  Run with the Library up:
//   node tools/backfill-colliders.mjs [root] [--dry]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'K:/dream-forge-creations';
const DRY = process.argv.includes('--dry');
const LIBRARY = process.env.DREAM_LIBRARY ?? 'http://127.0.0.1:5230'; // whose save place 0 is ROOT
const SKIP = /(^|[\\/])(Characters|Autosaves|\.versions)([\\/]|$)/;
const ROUND = /rock|boulder|barrel|tree|trunk|log/i;

function* glbs(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (SKIP.test(path.relative(ROOT, p))) continue;
    if (e.isDirectory()) yield* glbs(p);
    else if (/\.glb$/i.test(e.name)) yield p;
  }
}

/** The GLB's JSON chunk. */
function gltfOf(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
}

// 4x4 column-major matrices, as glTF stores them
const mul = (a, b) => { const r = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) for (let k = 0; k < 4; k++) r[c * 4 + rr] += a[k * 4 + rr] * b[c * 4 + k]; return r; };
function local(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const apply = (m, p) => [0, 1, 2].map((i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);

/** World bounds of every mesh in the default scene. */
function bounds(g) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const walk = (i, parent) => {
    const n = g.nodes[i], m = mul(parent, local(n));
    if (n.mesh !== undefined) for (const prim of g.meshes[n.mesh].primitives) {
      const a = g.accessors[prim.attributes.POSITION];
      if (!a?.min || !a?.max) continue;
      for (let c = 0; c < 8; c++) {
        const p = apply(m, [c & 1 ? a.max[0] : a.min[0], c & 2 ? a.max[1] : a.min[1], c & 4 ? a.max[2] : a.min[2]]);
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
      }
    }
    for (const c of n.children ?? []) walk(c, m);
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const i of g.scenes?.[g.scene ?? 0]?.nodes ?? []) walk(i, I);
  return Number.isFinite(lo[0]) ? { lo, hi } : null;
}

const r3 = (v) => Math.round(v * 1000) / 1000;
/** Forge-shaped colliders for a piece from its bounds and name. */
export function collidersFor(name, b) {
  const [w, h, d] = [0, 1, 2].map((k) => b.hi[k] - b.lo[k]);
  if (h < 0.3 || (h < 0.5 && h < 0.15 * Math.max(w, d))) return []; // ground cover is walked over (the sim cannot stand on a shape yet)
  const x = r3((b.lo[0] + b.hi[0]) / 2), y = r3((b.lo[1] + b.hi[1]) / 2), z = r3((b.lo[2] + b.hi[2]) / 2);
  if (ROUND.test(name) && Math.max(w, d) / Math.min(w, d) <= 1.15) {
    const dia = r3(Math.max(w, d));
    return [{ shape: 'cylinder', size: { x: dia, y: r3(h), z: dia }, trigger: false, x, y, z, rotY: 0 }];
  }
  return [{ shape: 'box', size: { x: r3(w), y: r3(h), z: r3(d) }, trigger: false, x, y, z, rotY: 0 }];
}

const out = { written: 0, none: 0, skipped: 0 };
for (const file of glbs(ROOT)) {
  const mf = file + '.meta.json';
  const meta = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : {};
  if (Array.isArray(meta.colliders) || meta.wear || meta.kind === 'character') { out.skipped++; continue; }
  let b;
  try { b = bounds(gltfOf(file)); } catch (e) { console.warn('skip', file, e.message); out.skipped++; continue; }
  if (!b) { out.skipped++; continue; }
  const name = path.basename(file, '.glb'), colliders = collidersFor(name, b);
  colliders.length ? out.written++ : out.none++;
  console.log(`${path.relative(ROOT, file)}: ${colliders.length ? `${colliders[0].shape} ${JSON.stringify(colliders[0].size)}` : 'none (low ground cover: walked over)'}`);
  if (!DRY) await save(file, { ...meta, colliders, collidersFrom: 'backfill-bounds' });
}

/**
 * Through the Library's /api/save with overwrite: the piece as it was (GLB, meta, thumbnail, mesh source)
 * becomes a numbered version in .versions/, so this is undone by restoring it there. The same GLB bytes and
 * every companion but the meta are sent back, so the current piece keeps them.
 */
async function save(file, meta) {
  const rel = path.relative(ROOT, file).split(path.sep), base = rel.pop(), dir = path.dirname(file);
  const parts = Object.fromEntries(fs.readdirSync(dir).filter((n) => n.startsWith(base + '.') && n !== base + '.meta.json' && n !== base + '.thumb.png')
    .map((n) => [n.slice(base.length), fs.readFileSync(path.join(dir, n)).toString('base64')]));
  const thumb = fs.existsSync(file + '.thumb.png') ? fs.readFileSync(file + '.thumb.png').toString('base64') : undefined;
  const { version: _v, history: _h, saved: _s, ...keep } = meta;
  const r = await fetch(`${LIBRARY}/api/save`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: base.replace(/\.glb$/i, ''), ext: '.glb', folder: rel.join('/'), data: fs.readFileSync(file).toString('base64'), parts, thumb, meta: keep, overwrite: true }) });
  if (!r.ok) throw new Error(`${base}: save failed ${r.status} ${await r.text()}`);
}
console.log(out);
