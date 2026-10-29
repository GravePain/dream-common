// Small vector maths for the sim: plain { x, y, z } objects, never mutated (every function returns a new one).
// No three.js here; the client copies these into its own vectors.

export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a) => Math.hypot(a.x, a.y, a.z);
/** The unit vector along `a`, or zero for a zero vector. */
export function normalise(a) {
  const l = length(a);
  return l > 1e-9 ? scale(a, 1 / l) : v3();
}
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** Distance on the ground plane (x, z only). */
export const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------- yaw: turn about +y; yaw 0 faces +z, yaw PI/2 faces +x (as rotY in Dream World) ----------
/** The yaw that faces along (dx, dz). */
export const yawOf = (dx, dz) => Math.atan2(dx, dz);
/** The unit ground direction a yaw faces. */
export const yawDir = (yaw) => ({ x: Math.sin(yaw), y: 0, z: Math.cos(yaw) });
/** b - a wrapped into (-PI, PI]. */
export function yawDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
/** Turn `from` toward `to` by at most `step` radians. */
export const turnToward = (from, to, step) => from + clamp(yawDiff(from, to), -step, step);
/** Rotate a ground offset (x, z) by -yaw: world into a shape's local frame. */
export function toLocal(dx, dz, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}
/** Rotate a local ground offset back by +yaw. */
export function toWorld(lx, lz, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: lx * c + lz * s, z: -lx * s + lz * c };
}
