// Content packs (pack/): a pack from Crystal Cascades validates, is deterministic, and carries the colliders
// the bridge would have made (the same sim input); an invalid cell fails with the record named; the hash
// is SHA-256 (WebCrypto and the plain-JS fallback agree).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildPack, checkPack, packInput, pieceInfo, changedModels } from '../pack/index.js';
import { sha256js, sha256 } from '../pack/hash.js';
import { simInput } from '../sim/bridge.js';
import { createSim } from '../sim/index.js';

const CREATIONS = process.env.DREAM_CREATIONS ?? 'K:\\dream-forge-creations';
const DIR = path.join(CREATIONS, 'Zones', 'Crystal Cascades');
const REF = '0|Zones/Crystal Cascades/zone.json';
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p) : null);
function zoneOnDisk() {
  const zone = JSON.parse(fs.readFileSync(path.join(DIR, 'zone.json'), 'utf8'));
  const cells = zone.cells.map((n) => read(path.join(DIR, 'cells', `${n}.json`))).filter(Boolean).map((b) => JSON.parse(b.toString('utf8')));
  return { zone, cells };
}
/** The Library on disk: place 0 only, as the Dream Server's tests use it. */
async function pieces(t) {
  const m = /^lib0\/(.*)$/.exec(t);
  if (!m) return null;
  const meta = read(path.join(CREATIONS, m[1] + '.meta.json'));
  const glb = read(path.join(CREATIONS, m[1]));
  return { meta: meta ? JSON.parse(meta.toString('utf8')) : null, glb: glb ? new Uint8Array(glb) : null };
}
const BUILT = '20261030-120000';

test('a pack from Crystal Cascades validates and is deterministic', async () => {
  const { zone, cells } = zoneOnDisk();
  const a = await buildPack({ zone, cells, ref: REF, built: BUILT, pieces });
  assert.ok(a.ok, JSON.stringify(a.report.errors.slice(0, 3)));
  assert.deepEqual(checkPack(JSON.parse(a.json)), []);
  assert.equal(a.pack.format, 'dream-pack');
  assert.equal(a.pack.id, zone.id);
  assert.ok(Object.keys(a.pack.hashes).length > 0, 'models hashed');
  for (const [k, h] of Object.entries(a.pack.hashes)) {
    const bytes = a.assets.get(h);
    assert.ok(bytes, `${k} has its asset`);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), h);
  }
  const b = await buildPack({ zone: structuredClone(zone), cells: structuredClone(cells).reverse(), ref: REF, built: BUILT, pieces });
  assert.equal(a.json, b.json, 'the same input gives the same bytes');
});

test('the pack carries the colliders the bridge would have made: the same sim', async () => {
  const { zone, cells } = zoneOnDisk();
  const { pack } = await buildPack({ zone, cells, ref: REF, built: BUILT, pieces });
  const info = new Map();
  for (const c of cells) for (const e of c.entities) if (e.components?.model && !info.has(e.template)) { const p = await pieces(e.template); info.set(e.template, pieceInfo(p?.meta, p?.glb)); }
  const direct = simInput(zone, cells, { pieces: (t) => info.get(t) }), fromPack = packInput(JSON.parse(JSON.stringify(pack)));
  assert.ok(direct.made.length > 0);
  assert.equal(pack.colliders, direct.made.length);
  const shapes = (inp) => inp.cells.flatMap((c) => c.entities).filter((e) => e.components.collider).map((e) => JSON.stringify([e.uid, e.transform, e.components.collider])).sort();
  assert.deepEqual(shapes(fromPack), shapes(direct));
  const w1 = createSim({ zone: direct.zone, cells: direct.cells, templates: [], seed: 1 }).world;
  const w2 = createSim({ zone: fromPack.zone, cells: fromPack.cells, templates: [], seed: 1 }).world;
  const all = (w) => [...w.entities.values()].map((e) => `${e.uid} ${e.x.toFixed(4)} ${e.z.toFixed(4)} ${e.y.toFixed(4)} ${e.cell}`).sort();
  assert.deepEqual(all(w2), all(w1));
  assert.deepEqual(fromPack.spawn, direct.spawn);
});

test('an invalid cell fails with the record named; a model that cannot be read is an error', async () => {
  const { zone, cells } = zoneOnDisk();
  const bad = structuredClone(cells);
  bad[0].entities[0].transform.x = 'east';
  const r = await buildPack({ zone, cells: bad, ref: REF, built: BUILT, pieces });
  assert.equal(r.ok, false);
  const e = r.report.errors[0];
  assert.equal(e.record, `cell x${bad[0].x}z${bad[0].z}`);
  assert.match(e.path, /entities\[0\]\.transform\.x/);
  const none = await buildPack({ zone, cells, ref: REF, built: BUILT, pieces: async () => ({ meta: null, glb: null }) });
  assert.equal(none.ok, false);
  assert.match(none.report.errors[0].message, /could not be read/);
});

test('hashes: plain JS matches WebCrypto; changedModels lists what a reload swaps', async () => {
  for (const n of [0, 1, 55, 56, 63, 64, 65, 1000]) {
    const b = new Uint8Array(n).map((_, i) => (i * 31 + 7) & 255);
    assert.equal(sha256js(b), await sha256(b), `${n} bytes`);
  }
  assert.deepEqual(changedModels({ hashes: { a: '1', b: '2' } }, { hashes: { a: '1', b: '3', c: '4' } }), ['b', 'c']);
});
