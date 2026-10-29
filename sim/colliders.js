// Solid shapes from the `collider` component, and a capsule player pushed out of them. The heightfield is the
// floor; ground steeper than MAX_SLOPE is a wall.
//
// Sizes (components.js `collider.size`, times the entity's transform scale), all standing on the entity's
// base point (its x, z and its y, which is the ground plus transform.y):
//   box       x, y, z full extents, turned by the entity's yaw
//   sphere    x is the radius; its centre is one radius above the base
//   capsule   x, z the width (radius = max(x, z) / 2), y the full height
//   cylinder  as capsule, flat ends
// The player is an upright capsule: `radius` wide, `height` tall, standing at pos.y.
import { toLocal, toWorld, clamp } from './math.js';

export const MAX_SLOPE = Math.PI / 4; // 45 degrees
const REACH = 8; // metres: the widest collider looked for around a point (plus the mover's radius)
/** Metres below the feet a shape still blocks (MOVE.snap): a boulder on lower ground stops a step down onto it. */
export const STEP_DOWN = 0.4;

const solid = (e) => { const c = e.components?.collider; return !!c && !c.trigger; };

/** The world-space shape of an entity's collider, or null when it has none (or it is a trigger). */
export function shapeOf(e) {
  const c = e.components?.collider;
  if (!c || c.trigger) return null;
  const s = e.scale ?? 1, sz = c.size ?? { x: 1, y: 1, z: 1 };
  const base = { uid: e.uid, x: e.x, y: e.y, z: e.z, yaw: e.yaw ?? 0 };
  switch (c.shape ?? 'box') {
    case 'sphere': { const r = sz.x * s; return { ...base, shape: 'sphere', r, bottom: e.y, top: e.y + 2 * r }; }
    case 'capsule': case 'cylinder': {
      const r = Math.max(sz.x, sz.z) * s / 2;
      return { ...base, shape: c.shape, r, bottom: e.y, top: e.y + sz.y * s };
    }
    default: return { ...base, shape: 'box', hx: sz.x * s / 2, hz: sz.z * s / 2, bottom: e.y, top: e.y + sz.y * s };
  }
}

/**
 * How far to push a circle of `radius` at (x, z) out of one shape on the ground plane, given the mover's
 * vertical span [y0, y1]: { x, z } offset, or null when they do not touch.
 */
function pushOut(sh, x, z, radius, y0, y1) {
  if (y1 <= sh.bottom || y0 >= sh.top) return null;
  let r = sh.r;
  if (sh.shape === 'sphere') {
    // the sphere's ground-plane radius at the closest height of the mover's span
    const cy = sh.bottom + sh.r, dy = clamp(cy, y0, y1) - cy;
    r = Math.sqrt(Math.max(0, sh.r * sh.r - dy * dy));
    if (r <= 0) return null;
  }
  if (sh.shape !== 'box') {
    const dx = x - sh.x, dz = z - sh.z, d = Math.hypot(dx, dz), need = r + radius;
    if (d >= need) return null;
    if (d < 1e-9) return { x: need, z: 0 };
    return { x: (dx / d) * (need - d), z: (dz / d) * (need - d) };
  }
  const l = toLocal(x - sh.x, z - sh.z, sh.yaw);
  const cx = clamp(l.x, -sh.hx, sh.hx), cz = clamp(l.z, -sh.hz, sh.hz);
  let ox, oz;
  if (cx === l.x && cz === l.z) {
    // centre inside the box: out through the nearest face
    const px = sh.hx - Math.abs(l.x), pz = sh.hz - Math.abs(l.z);
    if (px < pz) { ox = (l.x >= 0 ? 1 : -1) * (px + radius); oz = 0; } else { ox = 0; oz = (l.z >= 0 ? 1 : -1) * (pz + radius); }
  } else {
    const dx = l.x - cx, dz = l.z - cz, d = Math.hypot(dx, dz);
    if (d >= radius) return null;
    ox = (dx / d) * (radius - d); oz = (dz / d) * (radius - d);
  }
  return toWorld(ox, oz, sh.yaw);
}

/**
 * resolve(world, pos, radius, height, ignore?): push a capsule standing at pos out of every solid collider
 * near it. Returns { x, z, by } with `by` the uid of the first collider that pushed (null when clear).
 */
export function resolve(world, pos, radius, height, ignore) {
  let x = pos.x, z = pos.z, by = null;
  const y0 = pos.y - STEP_DOWN, y1 = pos.y + height; // reaches down to the snap, so a shape on the lower bank blocks
  const shapes = world.near(x, z, REACH + radius, (e) => e.uid !== ignore && solid(e)).map(shapeOf);
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let k = 0; k < shapes.length; k++) {
      const o = pushOut(shapes[k], x, z, radius, y0, y1);
      if (!o) continue;
      x += o.x; z += o.z; moved = true;
      if (by === null) by = shapes[k].uid;
    }
    if (!moved) break;
  }
  return { x, z, by };
}

/** Does stepping from `from` to (x, z) climb ground steeper than maxSlope? (Downhill is always allowed.) */
export function tooSteep(ground, from, x, z, maxSlope = MAX_SLOPE) {
  const run = Math.hypot(x - from.x, z - from.z);
  if (run < 1e-6) return false;
  const rise = ground.heightAt(x, z) - ground.heightAt(from.x, from.z);
  return rise > 0 && rise / run > Math.tan(maxSlope) && ground.slopeAt(x, z) > maxSlope * 0.9;
}

/** Can a mover of `radius` stand at (x, z): inside the zone, ground not steeper than maxSlope, no solid collider. */
export function walkable(world, x, z, radius = 0.35, height = 1.8, maxSlope = MAX_SLOPE) {
  const g = world.ground;
  if (!g.inBounds(x, z) || g.slopeAt(x, z) > maxSlope) return false;
  const y = g.heightAt(x, z);
  const r = resolve(world, { x, y, z }, radius, height);
  return r.by === null;
}
