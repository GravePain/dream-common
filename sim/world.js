// The sim's entities: a zone's cells loaded into one map by uid, each entity's components resolved over its
// template, and a spatial hash by 50 m cell for "what is near here". Static scenery and movers (players,
// npcs) live in the same map; movers are flagged `dynamic` and keep velocity and state on the entity.
import { cellOf, CELL } from '../web/zone.js';
import { resolve } from '../web/schema/entity.js';
import { createHeightfield } from './heightfield.js';

/**
 * createWorld({ zone, cells, templates }): `cells` is a list of cell records (or { name: cell }), `templates`
 * a list of template records or { id: template }. Returns the world: { zone, size, ground, entities, ... }.
 */
export function createWorld({ zone, cells = [], templates = [] }) {
  const size = zone.size;
  const ground = createHeightfield(zone.terrain, size);
  const tpl = new Map((Array.isArray(templates) ? templates : Object.values(templates)).map((t) => [t.id, t]));
  const entities = new Map();   // uid -> entity
  const buckets = new Map();    // cell name -> Set of uids
  const cellList = Array.isArray(cells) ? cells : Object.values(cells);
  const n = Math.max(1, Math.round(size / CELL));

  const bucket = (name) => { let b = buckets.get(name); if (!b) buckets.set(name, (b = new Set())); return b; };

  /** Add an entity record ({ uid, template, transform, components }) or a mover; returns the live entity. */
  function addEntity(rec, more = {}) {
    if (entities.has(rec.uid)) throw new Error(`world: uid ${rec.uid} already present`);
    const t = rec.transform ?? {};
    const x = t.x ?? 0, z = t.z ?? 0;
    const components = resolve(rec, tpl.get(rec.template));
    const e = {
      uid: rec.uid, template: rec.template ?? '', name: rec.name, parent: rec.parent,
      x, z, y: ground.heightAt(x, z) + (t.y ?? 0), yaw: t.rotY ?? 0, scale: t.scale ?? 1,
      rotX: t.rotX ?? 0, rotZ: t.rotZ ?? 0, components, dynamic: false, anim: 'idle',
      cell: cellOf(x, z, size).name, ...more,
    };
    entities.set(e.uid, e);
    bucket(e.cell).add(e.uid);
    return e;
  }
  function removeEntity(uid) {
    const e = entities.get(uid);
    if (!e) return false;
    buckets.get(e.cell)?.delete(uid);
    entities.delete(uid);
    return true;
  }
  const get = (uid) => entities.get(uid);
  /** Move an entity on the ground plane; returns { from, to } when it crossed into another cell, else null. */
  function place(e, x, z) {
    e.x = x; e.z = z;
    const to = cellOf(x, z, size).name;
    if (to === e.cell) return null;
    const from = e.cell;
    buckets.get(from)?.delete(e.uid);
    bucket(to).add(e.uid);
    e.cell = to;
    return { from, to };
  }
  /**
   * Entities whose position is within r of (x, z), in uid order (deterministic). `keep(e)`, when given, is
   * asked first: collision asks only for solid shapes, so a crowd of movers is not measured and sorted.
   */
  function near(x, z, r, keep) {
    const out = [], lo = cellOf(x - r, z - r, size), hi = cellOf(x + r, z + r, size), r2 = r * r;
    for (let i = lo.i; i <= hi.i; i++) for (let j = lo.j; j <= hi.j; j++) {
      for (const uid of buckets.get(`x${i}z${j}`) ?? []) {
        const e = entities.get(uid);
        if (keep && !keep(e)) continue;
        const dx = e.x - x, dz = e.z - z;
        if (dx * dx + dz * dz <= r2) out.push(e);
      }
    }
    return out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  }
  /** Entities in one named cell, in uid order. */
  const inCell = (name) => [...(buckets.get(name) ?? [])].sort().map((uid) => entities.get(uid));
  /** A cell's name and its up-to-8 neighbours inside the zone. */
  function neighbours(name) {
    const m = /^x(\d+)z(\d+)$/.exec(name), i = +m[1], j = +m[2], out = [];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < n && b < n) out.push(`x${a}z${b}`);
    }
    return out;
  }

  for (const c of cellList) for (const rec of c.entities ?? []) addEntity(rec);

  return { zone, size, ground, templates: tpl, entities, addEntity, removeEntity, get, place, near, inCell, neighbours, cellOf: (x, z) => cellOf(x, z, size) };
}
