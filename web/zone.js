// Zones and cells: a Dream World map as one zone.json (terrain, sky, the list of cells) and its entities in
// fixed 50 m cells (cells/x<i>z<j>.json). Converts to and from Dream World's .scene.json without loss, so
// Dream World can keep saving scenes and also read and write zones. docs/zone-format.md has the files.
//
//   import { sceneToZone, zoneToScene, cellOf } from `${location.origin}/common/zone.js`;
//   const { zone, cells } = sceneToZone(scene, { id: 'crystal-cascades', name: 'Crystal Cascades' });
//   const back = zoneToScene(zone, cells);   // the same scene (normalise() both to compare)
import { CELL } from './schema/zone.js';

export { CELL };

/** The cell (i, j) and its name for a world point; x0z0 is the corner at (-size/2, -size/2). Edges clamp in. */
export function cellOf(x, z, size) {
  const n = Math.max(1, Math.round(size / CELL));
  const at = (v) => Math.min(n - 1, Math.max(0, Math.floor((v + size / 2) / CELL)));
  const i = at(x), j = at(z);
  return { i, j, name: `x${i}z${j}` };
}

// ---------- scene records <-> entities ----------
const rest = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const PLACED = ['uid', 'itemId', 'x', 'z', 'rotY', 'rotX', 'rotZ', 'scale', 'yOffset'];
const ANIMAL = ['uid', 'defId', 'x', 'z', 'homeX', 'homeZ', 'components'];
const EFFECT = ['uid', 'type', 'x', 'z', 'radius', 'fx', 'rotY', 'y'];
/** A library item id ("lib0/Creek boulders.glb") as place and path. */
const libRef = (id) => { const m = /^lib([^/]+)\/(.*)$/.exec(id); return m ? { place: m[1], path: m[2] } : { place: '', path: id }; };

/** A placed object: template = its item id, a model component; any other fields ride along in the component. */
const fromPlaced = (p) => ({
  uid: `o${p.uid}`, template: p.itemId,
  transform: { x: p.x, y: 0, z: p.z, rotX: p.rotX ?? 0, rotY: p.rotY, rotZ: p.rotZ ?? 0, scale: p.scale },
  components: { model: { ...libRef(p.itemId), yOffset: p.yOffset, ...rest(p, PLACED) } },
});
const toPlaced = (e) => {
  const { place, path, yOffset, ...extra } = e.components.model, t = e.transform;
  return { uid: +e.uid.slice(1), itemId: e.template, x: t.x, z: t.z, rotY: t.rotY, ...(t.rotX ? { rotX: t.rotX } : {}), ...(t.rotZ ? { rotZ: t.rotZ } : {}), scale: t.scale, yOffset, ...extra };
};
/**
 * An animal: template = its animal id, an animal component (what AnimalSave carries) and an npc that wanders.
 * Step 10: an AnimalSave may carry `components` (its own npc, hostile, stats, loot, spawn...), which win over
 * that default npc; back in a scene an animal carries every component beside `animal` once it has any but
 * the default npc, so a hostile npc survives the editor. An animal placed from a template ("template:<id>",
 * sim/bridge.js) gets no default npc: the template's is its npc, with this animal's home.
 */
const fromAnimal = (a) => ({
  uid: `a${a.uid}`, template: a.defId,
  transform: { x: a.x, y: 0, z: a.z, rotX: 0, rotY: 0, rotZ: 0, scale: 1 },
  components: { animal: { defId: a.defId, home: { x: a.homeX, z: a.homeZ }, ...rest(a, ANIMAL) }, ...(a.defId.startsWith('template:') ? {} : { npc: { mode: 'wander', home: { x: a.homeX, z: a.homeZ }, radius: 14, speed: 1 } }), ...(a.components ?? {}) },
});
const toAnimal = (e) => {
  const { animal, ...others } = e.components, { defId, home, ...extra } = animal, t = e.transform;
  const keep = Object.keys(others).some((k) => k !== 'npc');
  return { uid: +e.uid.slice(1), defId, x: t.x, z: t.z, homeX: home.x, homeZ: home.z, ...extra, ...(keep ? { components: structuredClone(others) } : {}) };
};
/** An effect: template "fx:<type>" or "fx:<place|path>", an fx component. */
const fromEffect = (f) => ({
  uid: `e${f.uid}`, template: `fx:${f.fx ?? f.type}`,
  transform: { x: f.x, y: f.y ?? 0, z: f.z, rotX: 0, rotY: f.rotY ?? 0, rotZ: 0, scale: 1 },
  components: { fx: { type: f.type, ...(f.fx !== undefined ? { path: f.fx } : {}), radius: f.radius, ...rest(f, EFFECT) } },
});
const toEffect = (e) => {
  const { type, path, radius, ...extra } = e.components.fx, t = e.transform;
  return { uid: +e.uid.slice(1), type, x: t.x, z: t.z, radius, ...(path !== undefined ? { fx: path } : {}), ...(t.rotY ? { rotY: t.rotY } : {}), ...(t.y ? { y: t.y } : {}), ...extra };
};

// ---------- cells ----------
/** Entities into cells by position: { "x0z0": cell, ... }, each cell { format, version, zone, x, z, entities }. */
export function splitToCells(entities, size, zoneId) {
  const cells = {};
  for (const e of entities) {
    const c = cellOf(e.transform.x, e.transform.z, size);
    (cells[c.name] ??= { format: 'dream-cell', version: 1, zone: zoneId, x: c.i, z: c.j, entities: [] }).entities.push(e);
  }
  return cells;
}

/** Every entity of the zone's cells, in cell order. `cells` is { name: cell } or a list of cells. */
export function mergeCells(zone, cells) {
  const byName = Array.isArray(cells) ? Object.fromEntries(cells.map((c) => [`x${c.x}z${c.z}`, c])) : cells;
  return zone.cells.flatMap((n) => byName[n]?.entities ?? []);
}

// ---------- scene <-> zone ----------
/** A Dream World .scene.json (version 2) as a zone and its cells. */
export function sceneToZone(scene, { id = 'zone', name = id } = {}) {
  const t = scene.terrain, size = t.size;
  const entities = [...(scene.objects ?? []).map(fromPlaced), ...(scene.animals ?? []).map(fromAnimal), ...(scene.effects ?? []).map(fromEffect)];
  const cells = splitToCells(entities, size, id);
  const zone = {
    format: 'dream-zone', version: 1, id, name, size, cell: CELL,
    terrain: { res: t.res, heights: t.heights, splat: t.splat, slots: t.slots ?? [], ...(t.waterLevel !== undefined ? { waterLevel: t.waterLevel } : {}) },
    ...(scene.sky !== undefined ? { sky: scene.sky } : {}),
    cells: Object.keys(cells).sort(byCell),
  };
  return { zone, cells };
}
const byCell = (a, b) => { const [, ai, aj] = a.match(/x(\d+)z(\d+)/), [, bi, bj] = b.match(/x(\d+)z(\d+)/); return aj - bj || ai - bi; };

/** A zone and its cells back as a Dream World .scene.json (version 2). */
export function zoneToScene(zone, cells) {
  const all = mergeCells(zone, cells), of = (p) => all.filter((e) => e.uid[0] === p).sort((a, b) => a.uid.slice(1) - b.uid.slice(1));
  const t = zone.terrain;
  return {
    version: 2,
    terrain: { size: zone.size, res: t.res, heights: t.heights, splat: t.splat, slots: t.slots ?? [], ...(t.waterLevel !== undefined ? { waterLevel: t.waterLevel } : {}) },
    objects: of('o').map(toPlaced),
    animals: of('a').map(toAnimal),
    effects: of('e').map(toEffect),
    ...(zone.sky !== undefined ? { sky: zone.sky } : {}),
  };
}

/**
 * A scene in one canonical form, to compare two: lists by uid, zero tilts / turns / lifts left out (Dream
 * World writes them either way), keys sorted. Returns the JSON text.
 */
export function normalise(scene) {
  const s = structuredClone(scene);
  const drop0 = (o, keys) => { for (const k of keys) if (o[k] === 0 || o[k] === undefined) delete o[k]; return o; };
  s.objects = (s.objects ?? []).map((o) => drop0(o, ['rotX', 'rotZ'])).sort((a, b) => a.uid - b.uid);
  s.animals = (s.animals ?? []).sort((a, b) => a.uid - b.uid);
  s.effects = (s.effects ?? []).map((e) => drop0(e, ['rotY', 'y'])).sort((a, b) => a.uid - b.uid);
  const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
  return JSON.stringify(sorted(s));
}
