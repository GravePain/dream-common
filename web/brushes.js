// The shared brush tips for every dream tool (served by the Dream Library: import from "<library>/brushes.js").
// Round and Square are the plain tips; the rest are shaped like Unity's terrain brushes.

export const TIPS = [
  { id: 'round', name: 'Round' },
  { id: 'square', name: 'Square' },
  { id: 'soft', name: 'Soft' },
  { id: 'noise', name: 'Noise' },
  { id: 'rocky', name: 'Rocky' },
  { id: 'splatter', name: 'Splatter' },
  { id: 'grass', name: 'Grass' },
  { id: 'star', name: 'Star' },
];
/** Tips that look better turned a random amount on every dab. */
export const SCATTERED = new Set(['noise', 'rocky', 'splatter', 'grass']);

// a small seeded random and value noise, so a tip always looks the same at the same size
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
function valueNoise(seed) {
  const r = rng(seed), g = Array.from({ length: 64 * 64 }, r);
  const at = (x, y) => g[(y & 63) * 64 + (x & 63)];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
const fbm = (n, x, y) => (n(x, y) * 4 + n(x * 2, y * 2) * 2 + n(x * 4, y * 4)) / 7;
const noiseA = valueNoise(11), noiseB = valueNoise(29);

/** Falloff from the edge in: 1 inside the hard core, easing to 0 at the rim. */
const edge = (d, hardness) => (d >= 1 ? 0 : d <= hardness ? 1 : 1 - ((d - hardness) / (1 - hardness)) ** 2);

/**
 * The tip as a canvas `size` pixels across. `hardness` 0..1 sets how soft the edge is; `crisp` makes
 * every pixel fully on or off (pixel art), the way a 1-pixel pencil works.
 */
export function makeTip(id, size, hardness = 0.8, crisp = false) {
  const s = Math.max(1, Math.round(size)), c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d'), img = g.createImageData(s, s), r = s / 2;
  const alpha = (x, y) => {
    // pixel centres, -1..1 across the tip
    const dx = (x + 0.5 - r) / r, dy = (y + 0.5 - r) / r, d = Math.hypot(dx, dy);
    if (s <= 2) return 1; // one or two pixels: always the full square
    switch (id) {
      case 'square': return edge(Math.max(Math.abs(dx), Math.abs(dy)), hardness);
      case 'soft': return edge(d, 0) ** 1.5;
      case 'noise': return edge(d, hardness * 0.5) * Math.max(0, fbm(noiseA, x * 8 / s + 3, y * 8 / s + 5) * 1.8 - 0.55);
      case 'rocky': {
        const n = fbm(noiseB, x * 5 / s, y * 5 / s);
        return edge(d + (n - 0.5) * 0.6, hardness) * (0.55 + n * 0.6);
      }
      case 'splatter': return 0; // drawn below
      case 'grass': return 0;
      case 'star': return 0;
      default: return edge(d, hardness);
    }
  };
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    let a = Math.min(1, Math.max(0, alpha(x, y)));
    if (crisp) a = a >= 0.5 ? 1 : 0;
    const i = (y * s + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  // the shaped tips are drawn as paths
  g.fillStyle = '#fff';
  if (id === 'splatter' && s > 2) {
    const rnd = rng(7 + s);
    for (let k = 0; k < 10 + s / 3; k++) {
      const a = rnd() * Math.PI * 2, dist = Math.sqrt(rnd()) * r * 0.85, rad = Math.max(0.6, (0.04 + rnd() * 0.12) * s * (1 - dist / r * 0.6));
      g.globalAlpha = 0.6 + rnd() * 0.4;
      g.beginPath();
      g.arc(r + Math.cos(a) * dist, r + Math.sin(a) * dist, rad, 0, Math.PI * 2);
      g.fill();
    }
  } else if (id === 'grass' && s > 2) {
    const rnd = rng(3 + s);
    g.lineCap = 'round';
    g.strokeStyle = '#fff';
    for (let k = 0; k < 9; k++) {
      const x0 = r + (rnd() - 0.5) * r * 1.2, lean = (rnd() - 0.5) * r * 0.9, top = s * (0.05 + rnd() * 0.35);
      g.lineWidth = Math.max(1, s * 0.05);
      g.globalAlpha = 0.7 + rnd() * 0.3;
      g.beginPath();
      g.moveTo(x0, s * 0.95);
      g.quadraticCurveTo(x0, (s + top) / 2, x0 + lean, top);
      g.stroke();
    }
  } else if (id === 'star' && s > 2) {
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5, rad = k % 2 ? r * 0.42 : r * 0.98;
      g.lineTo(r + Math.cos(a) * rad, r + Math.sin(a) * rad);
    }
    g.fill();
  }
  if (crisp && ['splatter', 'grass', 'star'].includes(id)) {
    const d = g.getImageData(0, 0, s, s);
    for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] >= 128 ? 255 : 0;
    g.putImageData(d, 0, 0);
  }
  g.globalAlpha = 1;
  return c;
}

/** A little picture of a tip for its button. */
export function tipIcon(id) {
  const t = makeTip(id, 28, 0.6), c = document.createElement('canvas');
  c.width = c.height = 28;
  const g = c.getContext('2d');
  g.fillStyle = '#e8d9b8';
  g.fillRect(0, 0, 28, 28);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(t, 0, 0);
  return c;
}

/**
 * The tip as a function for brushes that are not pixels (terrain, vertex paint): sample(u, v) gives 0..1
 * for u, v in -1..1 across the tip, turned by `angle` radians. Made once at `res` pixels and reused.
 */
export function sampler(id, hardness = 0.8, angle = 0, res = 64) {
  const tip = makeTip(id, res, hardness), a = tip.getContext('2d').getImageData(0, 0, res, res).data;
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return (u, v) => {
    const x = u * cs - v * sn, y = u * sn + v * cs;
    if (x <= -1 || x >= 1 || y <= -1 || y >= 1) return 0;
    const px = Math.min(res - 1, ((x + 1) / 2) * res) | 0, py = Math.min(res - 1, ((y + 1) / 2) * res) | 0;
    return a[(py * res + px) * 4 + 3] / 255;
  };
}
