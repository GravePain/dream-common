// The ground: a zone's terrain record read the way Dream World stores it (dream-world/src/terrain.ts and
// save.ts): `heights` is base64 of a little-endian Float32 array of res * res heights, row-major from the -z
// edge, vertex (i, j) at world x = (i / (res - 1) - 0.5) * size, z = (j / (res - 1) - 0.5) * size.
import { clamp } from './math.js';

/** Base64 to bytes, without Buffer or the DOM (atob is global in Node 16+ and every browser). */
function fromB64(b64) {
  const s = atob(b64), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
/** Bytes to base64, for tests and tools that build a terrain in code. */
export function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
/** A terrain record from a Float32Array of heights (the inverse of the decode below). */
export const terrainOf = (heights, res, waterLevel = -100) => ({ res, heights: toB64(new Uint8Array(heights.buffer.slice(0))), splat: '', slots: [], waterLevel });

/**
 * createHeightfield(terrain, size): { size, res, heights, heightAt, normalAt, slopeAt, inBounds, waterLevel }.
 * `terrain.heights` may also be a Float32Array already decoded.
 */
export function createHeightfield(terrain, size) {
  const res = terrain.res;
  const heights = terrain.heights instanceof Float32Array ? terrain.heights : new Float32Array(fromB64(terrain.heights).buffer);
  if (heights.length !== res * res) throw new Error(`heightfield: ${heights.length} heights for res ${res}`);
  const half = size / 2, cellSize = size / (res - 1);

  /** Bilinear height at world x, z (clamped to the edge, as terrain.ts does). */
  function heightAt(x, z) {
    const fx = clamp((x / size + 0.5) * (res - 1), 0, res - 1);
    const fz = clamp((z / size + 0.5) * (res - 1), 0, res - 1);
    const x0 = Math.floor(fx), z0 = Math.floor(fz);
    const x1 = Math.min(x0 + 1, res - 1), z1 = Math.min(z0 + 1, res - 1);
    const tx = fx - x0, tz = fz - z0, h = heights;
    const a = h[z0 * res + x0] * (1 - tx) + h[z0 * res + x1] * tx;
    const b = h[z1 * res + x0] * (1 - tx) + h[z1 * res + x1] * tx;
    return a * (1 - tz) + b * tz;
  }
  /** The unit up-facing ground normal, by central differences one grid step wide. */
  function normalAt(x, z) {
    const e = cellSize;
    const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
    const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    const l = Math.hypot(dx, 1, dz);
    return { x: -dx / l, y: 1 / l, z: -dz / l };
  }
  /** The ground's steepness in radians, 0 flat to PI/2 vertical. */
  const slopeAt = (x, z) => Math.acos(clamp(normalAt(x, z).y, -1, 1));
  /** Inside the zone square (edges included). */
  const inBounds = (x, z) => Math.abs(x) <= half && Math.abs(z) <= half;

  return { size, res, heights, heightAt, normalAt, slopeAt, inBounds, waterLevel: terrain.waterLevel ?? -0.6 };
}
