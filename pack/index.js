// dream-common/pack: content packs (game builder Phase 3). A pack is what players see of a zone, separate
// from the Library's live files: the zone and its cells validated against the schema, each placed piece's
// colliders baked in (from its Library meta, else its model's bounds, exactly as sim/bridge.js makes them),
// and every file the zone can reach named by its SHA-256: models, npcs' models, effects and their textures,
// ground textures, Play's UI, and (through `tables`) the gameplay tables with their item models. Built in Dream
// World's browser (Publish zone), checked again and served by the Dream Server. Plain JS, no DOM, no Node.
// docs/pack-format.md has the format.
//
//   const r = await buildPack({ zone, cells, ref: '0|Zones/X/zone.json', built: '20261030-221500', pieces, tables, file });
//   r.ok, r.report: { errors: [{ record, path, message }], warnings: [...], places: [...] }, r.pack, r.json, r.assets (Map hash -> bytes)
import { simInput, templatesOf, TEMPLATE_REF } from '../sim/bridge.js';
import { validate as validateZone } from '../web/schema/zone.js';
import { validate as validateCell } from '../web/schema/cell.js';
import { validateTemplate } from '../web/schema/entity.js';
import { checkTables, tablesOf } from '../sim/systems/tables.js';
import { glbBounds } from './glb.js';
import { sha256 } from './hash.js';

export const FORMAT = 'dream-pack', VERSION = 2;
export { sha256, glbBounds };
const CATEGORIES = ['trees', 'bushes', 'flowers', 'rocks', 'buildings', 'props', 'water', 'animals'];
/** `built` names a build: letters, digits, - and _ (a folder name on the server). */
export const BUILT = /^[A-Za-z0-9_-]{1,40}$/;
export const HASH = /^[0-9a-f]{64}$/;
const ID = /^[\w .-]+$/;
/** The kinds of file a pack may carry, by extension: what the server serves them as. */
export const TYPES = { glb: 'model/gltf-binary', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', json: 'application/json', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg' };
/** A file's extension, from its path or "place|path" ref. */
export const extOf = (ref) => String(ref).split('.').pop().toLowerCase();
/** What Play itself draws, in place 0: the HUD's bars and cell (play/hud.ts, play/combat.ts) and the ability and item icons. */
export const PLAY_FILES = ['UI/Project Y/Health bar.ui.json', 'UI/Project Y/Stamina bar.ui.json', 'UI/Project Y/Cell.ui.json', 'Sprites/Project Y/Icon sword.png', 'Sprites/Project Y/Icon scroll.png', 'Sprites/Project Y/Icon potion.png', 'Sprites/Project Y/Icon herb.png'];

const text = new TextDecoder();
const encode = new TextEncoder();
const jsonOf = (bytes) => { try { return JSON.parse(text.decode(bytes)); } catch { return null; } };

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
/** "lib0/Trees/Oak.glb" (an item id) as a ref, "0|Trees/Oak.glb"; null for anything else. */
export const refOfItem = (id) => { const m = /^lib([^/]+)\/(.*)$/.exec(String(id)); return m ? `${m[1]}|${m[2]}` : null; };
/** A portal's `zone` as a ref: a full "place|path/zone.json", or a zone name in the place of `from`. */
const portalRef = (zone, from) => (String(zone).includes('|') ? String(zone) : `${String(from).split('|')[0]}|Zones/${zone}/zone.json`);

/**
 * Everything a zone can reach beyond its placed pieces, into `hashes` and `assets`. Anything named by a record that
 * cannot be read is an error naming the record: a pack that plays is the point of checking. A ground slot and Play's
 * own UI are warnings, since the game has a plain stand-in for each and an author could not fix them from the zone.
 */
async function reach({ zone, list, templates, tables, ref, file, known, hashes, assets, errors, warnings, tableRefs }) {
  const read = new Map();
  const bytesOf = async (r) => {
    if (!read.has(r)) read.set(r, await file(r).catch(() => null));
    return read.get(r);
  };
  const add = async (r, out = hashes) => {
    const bytes = await bytesOf(r);
    if (!bytes) return null;
    const h = await sha256(bytes);
    assets.set(h, bytes);
    hashes[r] = h;
    out[r] = h;
    return bytes;
  };
  /** An effect file and the textures its layers draw. */
  const effect = async (r, record, path, out) => {
    const bytes = await add(r, out);
    if (!bytes) return errors.push({ record, path, message: `the effect ${r} could not be read from the Library` });
    for (const L of jsonOf(bytes)?.layers ?? []) {
      if (L.texture && !(await add(L.texture, out))) errors.push({ record, path, message: `the effect ${r} draws ${L.texture}, which could not be read from the Library` });
    }
  };
  const byId = new Map(templates.map((t) => [t.id, t]));
  const animals = {};
  for (const c of list) for (const e of c.entities ?? []) {
    const record = `cell ${cellName(c)}`;
    if (typeof e.template === 'string' && e.template.startsWith(TEMPLATE_REF) && !byId.has(e.template.slice(TEMPLATE_REF.length))) errors.push({ record, path: `${e.uid}.template`, message: `no template ${e.template.slice(TEMPLATE_REF.length)}` });
    const defId = e.components?.animal?.defId;
    if (defId && !animals[defId]) {
      const t = defId.startsWith(TEMPLATE_REF) ? byId.get(defId.slice(TEMPLATE_REF.length)) : null;
      const model = t?.components?.model ? modelKey(t.components.model) : refOfItem(defId);
      if (!model) warnings.push({ record, path: `${e.uid}.components.animal`, message: `${defId} is not a Library piece: it is not drawn` });
      else if (!(await add(model))) errors.push({ record, path: `${e.uid}.components.animal`, message: `${model} could not be read from the Library` });
      else {
        const meta = jsonOf((await bytesOf(`${model}.meta.json`)) ?? new Uint8Array());
        animals[defId] = { name: t?.name ?? meta?.name ?? model.split('/').pop().replace(/\.glb$/i, ''), model, ...(meta?.idle ? { idle: meta.idle } : {}), ...(meta?.walk ? { walk: meta.walk } : {}) };
      }
    }
    const fx = e.components?.fx;
    if (typeof fx?.path === 'string' && fx.path) await effect(fx.path, record, `${e.uid}.components.fx`);
    const portal = e.components?.portal;
    if (portal?.zone) {
      const to = portalRef(portal.zone, ref);
      if (!(await bytesOf(to))) errors.push({ record, path: `${e.uid}.components.portal`, message: `no zone ${to} in the Library` });
      else if (known && !known.includes(to)) warnings.push({ record, path: `${e.uid}.components.portal`, message: `${portal.zone} has no live pack yet: this portal refuses players until it has` });
    }
  }
  for (const id of zone.terrain?.slots ?? []) {
    const r = id ? refOfItem(id) : null;
    if (r && !(await add(r))) warnings.push({ record: `zone ${zone.id}`, path: 'terrain.slots', message: `the ground texture ${r} could not be read: that layer draws blank` });
  }
  for (const p of PLAY_FILES) {
    const bytes = await add(`0|${p}`);
    if (!bytes) { warnings.push({ record: 'Play', path: p, message: 'could not be read: Play draws a plain stand-in' }); continue; }
    if (p.endsWith('.ui.json')) {
      const sheet = jsonOf(bytes)?.sheet?.file ?? '.png';
      if (!(await add(`0|${p}${sheet}`))) warnings.push({ record: 'Play', path: `${p}${sheet}`, message: 'could not be read: Play draws a plain stand-in' });
    }
  }
  if (tables) {
    for (const [id, i] of tablesOf(tables).items) {
      if (i.model && !(await add(i.model, tableRefs))) errors.push({ record: `item ${id}`, path: 'model', message: `${i.model} could not be read from the Library` });
    }
    for (const [id, a] of tablesOf(tables).abilities) {
      if (typeof a.fx === 'string' && a.fx.includes('|')) await effect(a.fx, `ability ${id}`, 'fx', tableRefs);
    }
  }
  return animals;
}

/** Which Library places a pack draws from, with their licence text: [{ name, licence, noPublic, files }]. */
function placesOf(hashes, places = []) {
  const count = new Map();
  for (const r of Object.keys(hashes)) { const p = r.split('|')[0]; count.set(p, (count.get(p) ?? 0) + 1); }
  const seen = new Map();
  for (const [p, files] of count) {
    const at = places.find((x) => String(x.id) === p || x.slug === p), name = at?.name ?? `place ${p}`;
    const row = seen.get(name) ?? { name, licence: at?.licence ?? '', noPublic: !!at?.noPublic, files: 0 };
    row.files += files;
    seen.set(name, row);
  }
  return [...seen.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
}

/**
 * Build a pack. `zone` the zone record, `cells` its cells (a list or { name: cell }), `templates` template
 * records (their components are baked into the entities that name them, and they ride along), `ref` the zone's Library ref ("place|path/zone.json", what clients name it by),
 * `built` the build's name, `pieces(template)` resolves to { meta, glb } for a placed piece ("lib<place>/<path>":
 * its .meta.json or null, its GLB bytes or null). Nothing passed in is changed.
 *
 * `file(ref)` resolves to any Library file's bytes or null: with it, everything the zone can reach is collected
 * and every reference is checked. `tables` is the gameplay tables as the Library holds them ({ } for the built-in
 * ones): they are checked and carried, and promoting this pack makes them the live tables. `places` (the
 * Library's /api/places) lets the report list licences and refuses a `noPublic` place; `known` (the refs of the
 * live zones) lets it warn about a portal to a zone with no live pack.
 */
export async function buildPack({ zone, cells, templates = [], ref, built, pieces, tables, file, places, known }) {
  const errors = [], warnings = [];
  const list = Array.isArray(cells) ? cells : Object.values(cells ?? {});
  for (const p of validateZone(zone)) errors.push({ record: `zone ${zone?.id ?? '?'}`, ...p });
  for (const c of list) for (const p of validateCell(c)) errors.push({ record: `cell ${cellName(c)}`, ...p });
  for (const t of templates) for (const p of validateTemplate(t)) errors.push({ record: `template ${t?.id ?? '?'}`, ...p });
  if (typeof ref !== 'string' || !/\|.*zone\.json$/i.test(ref)) errors.push({ record: 'pack', path: 'ref', message: 'expected "place|path/zone.json"' });
  if (typeof built !== 'string' || !BUILT.test(built)) errors.push({ record: 'pack', path: 'built', message: 'expected letters, digits, - or _' });
  if (tables) for (const m of checkTables({ ...tables, templates })) errors.push({ record: m.split(':')[0], path: 'tables', message: m.split(':').slice(1).join(':').trim() });
  const names = new Set(list.map(cellName));
  for (const n of zone?.cells ?? []) if (!names.has(n)) warnings.push({ record: `zone ${zone.id}`, path: 'cells', message: `${n} is listed but has no cell file` });
  if (errors.length) return { ok: false, report: { errors, warnings, places: [] } };

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
  const tableRefs = {};
  const animals = file ? await reach({ zone, list, templates, tables, ref, file, known, hashes, assets, errors, warnings, tableRefs }) : {};
  const report = { errors, warnings, places: placesOf(hashes, places) };
  for (const p of report.places) if (p.noPublic) errors.push({ record: `place ${p.name}`, path: 'noPublic', message: `${p.files} file${p.files > 1 ? 's' : ''} in this pack come from a place marked not for the public game` });
  if (errors.length) return { ok: false, report };

  // the live tables: one blob, with the hashes of the files they name, shared by every zone once promoted
  let tablesHash;
  if (tables) {
    const { templates: _, ...rest } = tables;
    const blob = encode.encode(canonical({ ...rest, hashes: tableRefs }));
    tablesHash = await sha256(blob);
    assets.set(tablesHash, blob);
  }
  const input = simInput(zone, list, { pieces: (t) => info.get(t), templates });
  const outCells = input.cells.map((c) => ({ ...c, entities: [...c.entities].sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)) })).sort((a, b) => a.x - b.x || a.z - b.z);
  const pack = {
    format: FORMAT, version: VERSION, id: zone.id, ref, built,
    hashes: Object.fromEntries(Object.keys(hashes).sort().map((k) => [k, hashes[k]])),
    zone: { ...zone, cells: outCells.map(cellName) },
    cells: outCells, templates, animals,
    colliders: input.made.length,
    ...(tablesHash ? { tables: tablesHash } : {}),
  };
  return { ok: true, report, pack, json: canonical(pack), assets };
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
  for (const k of Object.keys(pack.hashes ?? {})) if (!TYPES[extOf(k)]) out.push({ record: 'pack', path: `hashes.${k}`, message: 'not a kind of file a pack may carry' });
  if (pack.tables !== undefined && !(typeof pack.tables === 'string' && HASH.test(pack.tables))) out.push({ record: 'pack', path: 'tables', message: 'expected a sha256' });
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
  for (const [id, a] of Object.entries(pack.animals ?? {})) if (!pack.hashes[a?.model]) out.push({ record: `animal ${id}`, path: 'model', message: `${a?.model} has no hash` });
  return out;
}

/** The sim's input from a pack: the colliders are baked, so the bridge is asked about no piece. */
export const packInput = (pack) => simInput(pack.zone, pack.cells, { pieces: () => undefined, templates: pack.templates ?? [] });
/** The model refs ("place|path") of a pack whose hash differs in `next` (or is new there). */
export const changedModels = (prev, next) => Object.keys(next.hashes).filter((k) => prev?.hashes?.[k] !== next.hashes[k]);
