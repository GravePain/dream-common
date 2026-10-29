// dream-common/pack: content packs (game builder Phase 3). A pack is what players see of a zone, separate
// from the Library's live files: the zone and its cells validated against the schema, each placed piece's
// colliders baked in (from its Library meta, else its model's bounds, exactly as sim/bridge.js makes them),
// and every model named by the SHA-256 of its GLB. Built in Dream World's browser (Publish zone), checked
// again and served by the Dream Server. Plain JS, no DOM, no Node. docs/pack-format.md has the format.
//
//   const r = await buildPack({ zone, cells, ref: '0|Zones/X/zone.json', built: '20261030-221500', pieces });
//   r.ok, r.report: { errors: [{ record, path, message }], warnings: [...] }, r.pack, r.json, r.assets (Map hash -> bytes)
import { simInput, templatesOf } from '../sim/bridge.js';
import { validate as validateZone } from '../web/schema/zone.js';
import { validate as validateCell } from '../web/schema/cell.js';
import { validateTemplate } from '../web/schema/entity.js';
import { glbBounds } from './glb.js';
import { sha256 } from './hash.js';

export const FORMAT = 'dream-pack', VERSION = 1;
export { sha256, glbBounds };
const CATEGORIES = ['trees', 'bushes', 'flowers', 'rocks', 'buildings', 'props', 'water', 'animals'];
/** `built` names a build: letters, digits, - and _ (a folder name on the server). */
export const BUILT = /^[A-Za-z0-9_-]{1,40}$/;
export const HASH = /^[0-9a-f]{64}$/;
const ID = /^[\w .-]+$/;

/** JSON with every object's keys sorted, so the same content gives the same bytes. */
export function canonical(v) {
  const sort = (x) => (Array.isArray(x) ? x.map(sort) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort(x[k])])) : x);
  return JSON.stringify(sort(v));
}

/** What the bridge knows of a piece from its meta and GLB: saved colliders, else the model's bounds. */
export function pieceInfo(meta, glb) {
  const category = [meta?.category, ...(meta?.tags ?? [])].find((c) => CATEGORIES.includes(c)) ?? 'props';
  if (Array.isArray(meta?.colliders)) return { colliders: meta.colliders, category };
  const bounds = glb ? glbBounds(glb) : null;
  return { category, ...(bounds ? { bounds } : {}) };
}

const cellName = (c) => `x${c.x}z${c.z}`;
const modelKey = (m) => `${m.place}|${m.path}`;

/**
 * Build a pack. `zone` the zone record, `cells` its cells (a list or { name: cell }), `templates` template
 * records (none yet), `ref` the zone's Library ref ("place|path/zone.json", what clients name it by),
 * `built` the build's name, `pieces(template)` resolves to { meta, glb } for a placed piece ("lib<place>/<path>":
 * its .meta.json or null, its GLB bytes or null). Nothing passed in is changed.
 */
export async function buildPack({ zone, cells, templates = [], ref, built, pieces }) {
  const errors = [], warnings = [];
  const list = Array.isArray(cells) ? cells : Object.values(cells ?? {});
  for (const p of validateZone(zone)) errors.push({ record: `zone ${zone?.id ?? '?'}`, ...p });
  for (const c of list) for (const p of validateCell(c)) errors.push({ record: `cell ${cellName(c)}`, ...p });
  for (const t of templates) for (const p of validateTemplate(t)) errors.push({ record: `template ${t?.id ?? '?'}`, ...p });
  if (typeof ref !== 'string' || !/\|.*zone\.json$/i.test(ref)) errors.push({ record: 'pack', path: 'ref', message: 'expected "place|path/zone.json"' });
  if (typeof built !== 'string' || !BUILT.test(built)) errors.push({ record: 'pack', path: 'built', message: 'expected letters, digits, - or _' });
  const names = new Set(list.map(cellName));
  for (const n of zone?.cells ?? []) if (!names.has(n)) warnings.push({ record: `zone ${zone.id}`, path: 'cells', message: `${n} is listed but has no cell file` });
  if (errors.length) return { ok: false, report: { errors, warnings } };

  // every placed piece once: its meta and GLB, its hash
  const info = new Map(), hashes = {}, assets = new Map();
  for (const t of templatesOf(list)) {
    const got = (await pieces(t).catch(() => null)) ?? {};
    info.set(t, pieceInfo(got.meta ?? null, got.glb ?? null));
    if (!got.glb) continue;
    const h = await sha256(got.glb);
    assets.set(h, got.glb);
    info.get(t).hash = h;
  }
  for (const c of list) for (const e of c.entities ?? []) {
    const m = e.components?.model;
    if (!m) continue;
    const i = info.get(e.template);
    if (!i?.hash) { errors.push({ record: `cell ${cellName(c)}`, path: `${e.uid}.components.model`, message: `${modelKey(m)} could not be read from the Library` }); continue; }
    hashes[modelKey(m)] = i.hash;
    if (!i.colliders && !e.components.collider && !i.warned) { i.warned = true; warnings.push({ record: `piece ${e.template}`, path: 'colliders', message: i.bounds ? 'no saved colliders: one shape from its bounds' : 'no saved colliders and no bounds: no shape' }); }
  }
  if (errors.length) return { ok: false, report: { errors, warnings } };

  const input = simInput(zone, list, { pieces: (t) => info.get(t) });
  const outCells = input.cells.map((c) => ({ ...c, entities: [...c.entities].sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)) })).sort((a, b) => a.x - b.x || a.z - b.z);
  const pack = {
    format: FORMAT, version: VERSION, id: zone.id, ref, built,
    hashes: Object.fromEntries(Object.keys(hashes).sort().map((k) => [k, hashes[k]])),
    zone: { ...zone, cells: outCells.map(cellName) },
    cells: outCells, templates,
    colliders: input.made.length,
  };
  return { ok: true, report: { errors, warnings }, pack, json: canonical(pack), assets };
}

/** Problems with a pack as received (the server checks before staging it), or []. */
export function checkPack(pack) {
  const out = [];
  if (!pack || typeof pack !== 'object') return [{ record: 'pack', path: '(root)', message: 'not an object' }];
  if (pack.format !== FORMAT || pack.version !== VERSION) out.push({ record: 'pack', path: 'format', message: `expected ${FORMAT} version ${VERSION}` });
  if (typeof pack.id !== 'string' || !ID.test(pack.id) || pack.id !== pack.zone?.id) out.push({ record: 'pack', path: 'id', message: 'expected the zone\'s id' });
  if (typeof pack.built !== 'string' || !BUILT.test(pack.built)) out.push({ record: 'pack', path: 'built', message: 'expected letters, digits, - or _' });
  if (typeof pack.ref !== 'string' || !/\|.*zone\.json$/i.test(pack.ref)) out.push({ record: 'pack', path: 'ref', message: 'expected "place|path/zone.json"' });
  if (!pack.hashes || typeof pack.hashes !== 'object' || !Object.values(pack.hashes).every((h) => typeof h === 'string' && HASH.test(h))) out.push({ record: 'pack', path: 'hashes', message: 'expected { "place|path": sha256 }' });
  if (!Array.isArray(pack.cells) || !Array.isArray(pack.templates ?? [])) out.push({ record: 'pack', path: 'cells', message: 'expected a list' });
  if (out.length) return out;
  for (const p of validateZone(pack.zone)) out.push({ record: `zone ${pack.id}`, ...p });
  // the baked colliders are the bridge's entities (uid "<entity>:c<k>", outside the entity id pattern): checked on their own
  const baked = (e) => e?.template === 'collider' && typeof e.parent === 'string' && typeof e.uid === 'string' && e.uid.startsWith(`${e.parent}:c`);
  for (const c of pack.cells) {
    for (const p of validateCell({ ...c, entities: (c.entities ?? []).filter((e) => !baked(e)) })) out.push({ record: `cell ${cellName(c)}`, ...p });
    for (const e of (c.entities ?? []).filter(baked)) for (const p of validateCell({ ...c, entities: [{ ...e, uid: 'c' }] })) out.push({ record: `cell ${cellName(c)}`, ...p, path: p.path.replace('entities[0]', e.uid) });
  }
  for (const t of pack.templates ?? []) for (const p of validateTemplate(t)) out.push({ record: `template ${t?.id ?? '?'}`, ...p });
  for (const c of pack.cells) for (const e of c.entities ?? []) {
    const m = e.components?.model;
    if (m && !pack.hashes[modelKey(m)]) out.push({ record: `cell ${cellName(c)}`, path: `${e.uid}.components.model`, message: `${modelKey(m)} has no hash` });
  }
  return out;
}

/** The sim's input from a pack: the colliders are baked, so the bridge is asked about no piece. */
export const packInput = (pack) => simInput(pack.zone, pack.cells, { pieces: () => undefined });
/** The model refs ("place|path") of a pack whose hash differs in `next` (or is new there). */
export const changedModels = (prev, next) => Object.keys(next.hashes).filter((k) => prev?.hashes?.[k] !== next.hashes[k]);
