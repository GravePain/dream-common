// A GLB's box without three.js, on a Uint8Array (browser or Node): the union of every mesh's POSITION
// min/max through its node's world matrix, centred on x and z and stood on y = 0, as Dream World's
// assets.ts holds a model. The same rule the Dream Server's src/library.js used before packs, so the
// bridge's fallback shapes come out the same from a pack as from the Library.

const mul = (a, b) => {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
};
/** A node's local matrix (column-major, as glTF): its matrix, else translation * rotation * scale. */
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

/** The model's bounds { min, max } in metres, or null when the bytes are not a GLB with positions. */
export function glbBounds(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 20) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (v.getUint32(0, true) !== 0x46546c67 || v.getUint32(16, true) !== 0x4e4f534a) return null; // "glTF", "JSON"
  const len = v.getUint32(12, true);
  let gltf;
  try { gltf = JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + len))); } catch { return null; }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const visit = (i, parent) => {
    const n = gltf.nodes?.[i];
    if (!n) return;
    const m = mul(parent, local(n));
    for (const p of gltf.meshes?.[n.mesh]?.primitives ?? []) {
      const a = gltf.accessors?.[p.attributes?.POSITION];
      if (!a?.min || !a?.max) continue;
      for (let k = 0; k < 8; k++) {
        const q = [k & 1 ? a.max[0] : a.min[0], k & 2 ? a.max[1] : a.min[1], k & 4 ? a.max[2] : a.min[2]];
        for (let r = 0; r < 3; r++) {
          const w = m[r] * q[0] + m[4 + r] * q[1] + m[8 + r] * q[2] + m[12 + r];
          if (w < min[r]) min[r] = w;
          if (w > max[r]) max[r] = w;
        }
      }
    }
    for (const c of n.children ?? []) visit(c, m);
  };
  const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const i of gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? []) visit(i, id);
  if (!(min[0] <= max[0])) return null;
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
  return { min: { x: min[0] - cx, y: 0, z: min[2] - cz }, max: { x: max[0] - cx, y: max[1] - min[1], z: max[2] - cz } };
}
