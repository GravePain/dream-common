// The zone as the sim's input: a zone and its cells (as saved, or as Dream World's scene turns into them)
// plus what the sim cannot read from a cell file. Shared by Dream World's Play button and the Dream Server,
// so both build the identical world. Plain JS: no three.js, no DOM; what the Library knows of each placed
// piece comes in through `pieces(template)`.
//
// - each placed piece's collision shapes, from its Library meta (`meta.colliders`, Dream Forge's saved form:
//   `{ shape, size, trigger, x, y, z, rotY }` in the piece's space) with the entity's scale and turn applied.
//   An entity that already has a `collider` component keeps it. A shape is one sim entity of its own (uid
//   `<entity>:c<k>`, parent the entity), because the sim's collider stands on its entity's base point and
//   has no offset. A piece with no colliders in its meta gets one from its model's bounds (`bounds`, see
//   `fallbackShape`), so older pieces still stop the player.
// - animals are `npc` wander entities already (zone.js gives every animal one); they pass through as is.
// - the spawn point: a `spawn` component of group "player", else the zone's `spawn`, else the given point,
//   else the zone's centre; and the entities with `interact`, which a client needs to aim E at.
// - an entity placed from an NPC template (template "template:<id>", Dream World's Animals tool) gets its
//   template's components under its own (`resolve()` in schema/entity.js), so sims, packs and hostile lists all
//   see them. The template's `model` is left out: the client draws an npc from its animal def, and a pack's
//   `model` means a placed piece with a hash.
import { cellOf } from '../web/zone.js';
import { resolve } from '../web/schema/entity.js';

/** One shape for a piece with no saved colliders: none for small or flat things, a trunk for a tree, else a box. */
export function fallbackShape(info) {
  const b = info.bounds;
  if (!b) return null;
  const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
  if (['flowers', 'bushes', 'water'].includes(info.category ?? '') || h < 0.3 || Math.max(w, d) < 0.25) return null;
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
  if (info.category === 'trees') { const r = Math.max(0.25, Math.min(w, d) * 0.08); return { shape: 'cylinder', size: { x: r * 2, y: h, z: r * 2 }, x: cx, y: b.min.y + h / 2, z: cz }; }
  // bounds hug the widest points: a little in, so a lumpy rock does not stop you a step early
  return { shape: 'box', size: { x: w * 0.85, y: h, z: d * 0.85 }, x: cx, y: b.min.y + h / 2, z: cz };
}

/** A shape in a piece's space as a sim entity at the piece's place (yaw turns as three's rotation.y). */
export function shapeEntity(e, s, k, lift) {
  const t = e.transform, sc = t.scale ?? 1, yaw = t.rotY ?? 0;
  const lx = (s.x ?? 0) * sc, lz = (s.z ?? 0) * sc, c = Math.cos(yaw), sn = Math.sin(yaw);
  const half = s.shape === 'sphere' ? s.size.x : s.size.y / 2;
  return {
    uid: `${e.uid}:c${k}`, template: 'collider', parent: e.uid,
    transform: { x: t.x + lx * c + lz * sn, y: lift + ((s.y ?? half) - half) * sc, z: t.z - lx * sn + lz * c, rotX: 0, rotY: yaw + (s.rotY ?? 0), rotZ: 0, scale: sc },
    components: { collider: { shape: s.shape, size: { ...s.size }, trigger: !!s.trigger } },
  };
}

/**
 * Where a new player stands: a random point within the spawn's radius (`random` in [0, 1)) that is walkable,
 * else the spawn itself. `walkable(x, z)` is the sim's check over the built world.
 */
export function spawnPoint(spawn, random, walkable = () => true) {
  const r = spawn.radius ?? 0;
  for (let k = 0; r > 0 && k < 8; k++) {
    const a = random() * Math.PI * 2, d = Math.sqrt(random()) * r, x = spawn.x + Math.cos(a) * d, z = spawn.z + Math.sin(a) * d;
    if (walkable(x, z)) return { x, z };
  }
  return { x: spawn.x, z: spawn.z };
}

/** The templates (piece ids) a zone's cells place, for asking the Library about each once. */
export const templatesOf = (cells) => [...new Set((Array.isArray(cells) ? cells : Object.values(cells)).flatMap((c) => c.entities ?? []).filter((e) => e.components?.model).map((e) => e.template))];

/**
 * simInput(zone, cells, { pieces, spawn }): the sim's { zone, cells, templates } with the made colliders,
 * plus { spawn, interactables, made }. `cells` is a list or { name: cell }; nothing passed in is changed.
 */
export function simInput(zone, cells, opts = {}) {
  const templates = opts.templates ?? [];
  const list = (Array.isArray(cells) ? cells : Object.values(cells)).map((c) => ({ ...c, entities: (c.entities ?? []).map((e) => fromTemplate(e, templates)) }));
  const all = list.flatMap((c) => c.entities);
  const made = [], extra = [];
  for (const e of all) {
    const m = e.components?.model;
    if (!m || e.components.collider) continue;
    const info = opts.pieces?.(e.template);
    if (!info) continue;
    const saved = (info.colliders ?? []).filter((s) => s && s.size);
    // a saved list, even an empty one (ground cover you walk over), is the piece's word; bounds only without one
    const shapes = info.colliders ? saved : [fallbackShape(info)].filter(Boolean);
    const lift = (m.yOffset ?? 0) + (e.transform?.y ?? 0);
    shapes.forEach((s, k) => {
      const c = shapeEntity(e, s, k, lift);
      extra.push(c);
      made.push({ uid: c.uid, from: e.uid, source: info.colliders ? 'meta' : 'bounds' });
    });
  }
  // the made colliders go into the cells their own position falls in
  const byName = new Map(list.map((c) => [`x${c.x}z${c.z}`, c]));
  for (const c of extra) {
    const { i, j, name } = cellOf(c.transform.x, c.transform.z, zone.size);
    if (!byName.has(name)) byName.set(name, { format: 'dream-cell', version: 1, zone: zone.id, x: i, z: j, entities: [] });
    byName.get(name).entities.push(c);
  }
  const outCells = [...byName.values()];

  const spawnAt = all.find((e) => e.components?.spawn?.group === 'player');
  const zs = zone.spawn && Number.isFinite(zone.spawn.x) && Number.isFinite(zone.spawn.z) ? { x: zone.spawn.x, z: zone.spawn.z } : null;
  // radius: the spawn entity's spread, so a server can scatter arrivals within it (spawnPoint)
  const spawn = spawnAt ? { x: spawnAt.transform.x, z: spawnAt.transform.z, ...(spawnAt.components.spawn.radius > 0 ? { radius: spawnAt.components.spawn.radius } : {}) } : zs ?? opts.spawn ?? { x: 0, z: 0 };
  const interactables = all.filter((e) => e.components?.interact).map((e) => {
    const use = e.components.interact;
    return { uid: e.uid, name: e.name ?? e.template.split('/').pop().replace(/\.glb$/i, ''), x: e.transform.x, z: e.transform.z, range: use.range ?? 2, verb: use.verb ?? 'use', fx: e.components.fx ?? null, light: !!e.components.light };
  });
  return { zone: { ...zone, cells: outCells.map((c) => `x${c.x}z${c.z}`) }, cells: outCells, templates, spawn, interactables, made };
}

/** What marks an entity's `template` as a template file's id rather than a library piece or an animal. */
export const TEMPLATE_REF = 'template:';

/** An entity with its template's components under its own; an entity with no such template as it is. */
function fromTemplate(e, templates) {
  if (!e.template?.startsWith(TEMPLATE_REF)) return e;
  const t = templates.find((x) => x.id === e.template.slice(TEMPLATE_REF.length));
  if (!t) return e;
  const { model, ...components } = resolve(e, t), home = components.animal?.home;
  if (components.npc && home) components.npc = { ...components.npc, home }; // it wanders round where it was placed
  return { ...e, name: e.name ?? t.name, components };
}
