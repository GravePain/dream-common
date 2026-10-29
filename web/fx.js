// Dream effects: the runtime every dream tool shares (served by the Dream Library at /fx.js).
// An effect is plain data, { format: 'dream-fx', version: 1, name, layers: [...] }, saved to the library
// as "<name>.fx.json". Each layer is one of:
//   particles: sprites born in an area, moving, growing, fading (spray, mist, embers, rain, leaves)
//   sheet:     a curved falling sheet of water with scrolling streaks (waterfalls, weirs, spouts)
//   light:     a point light, steady or flickering (fire)
// Units are metres and seconds; an effect stands on its own origin. three.js is passed in, so this file
// works the same in Dream Effects (plain modules) and Dream World (Vite):
//   const fx = createEffect(THREE, def);  scene.add(fx.root);  each frame: fx.update(dt, camera);

/** The settings each layer kind has, for editors to build their panels from: [key, label, min, max, step]. */
export const SCHEMA = {
  particles: [
    ['sprite', 'Sprite', ['soft', 'spark', 'smoke', 'drop', 'leaf', 'star']],
    ['blend', 'Blend', ['add', 'alpha']],
    ['shape', 'Born in', ['point', 'disc', 'box', 'line']],
    ['area', 'Area size', 0, 20, 0.05],
    ['areaH', 'Area height', 0, 20, 0.05],
    ['rate', 'Per second', 0, 400, 1],
    ['every', 'Burst every (s)', 0, 10, 0.05],
    ['burst', 'Per burst', 1, 600, 1],
    ['hueVary', 'Burst colour vary', 0, 1, 0.01],
    ['life', 'Lifetime', 0.1, 20, 0.1],
    ['lifeVary', 'Lifetime vary', 0, 1, 0.05],
    ['speed', 'Speed', 0, 20, 0.1],
    ['speedVary', 'Speed vary', 0, 1, 0.05],
    ['dirX', 'Direction X', -1, 1, 0.05],
    ['dirY', 'Direction Y', -1, 1, 0.05],
    ['dirZ', 'Direction Z', -1, 1, 0.05],
    ['spread', 'Spread', 0, 1, 0.01],
    ['gravity', 'Gravity', -10, 20, 0.1],
    ['drag', 'Drag', 0, 5, 0.05],
    ['windX', 'Wind X', -5, 5, 0.1],
    ['windZ', 'Wind Z', -5, 5, 0.1],
    ['wander', 'Wander', 0, 5, 0.05],
    ['sizeStart', 'Size at start', 0.01, 10, 0.01],
    ['sizeEnd', 'Size at end', 0.01, 10, 0.01],
    ['colorStart', 'Colour at start', 'color'],
    ['colorEnd', 'Colour at end', 'color'],
    ['alpha', 'Opacity', 0, 1, 0.01],
    ['fadeIn', 'Fade in', 0, 1, 0.01],
    ['fadeOut', 'Fade out', 0, 1, 0.01],
    ['stretch', 'Stretch with speed', 0, 2, 0.01],
    ['spin', 'Spin', 0, 10, 0.1],
    ['flicker', 'Flicker', 0, 1, 0.01],
    ['floor', 'Stop at the ground', 'bool'],
    ['x', 'Offset X', -20, 20, 0.05], ['y', 'Offset Y', -5, 30, 0.05], ['z', 'Offset Z', -20, 20, 0.05],
  ],
  sheet: [
    ['width', 'Width', 0.1, 20, 0.05],
    ['height', 'Drop', 0.2, 60, 0.1],
    ['lip', 'Throw out', 0, 10, 0.05],
    ['spreadOut', 'Widens by', 0, 2, 0.01],
    ['speed', 'Flow speed', 0.1, 20, 0.1],
    ['streaks', 'Streaks', 1, 40, 0.5],
    ['broken', 'Broken up', 0, 1, 0.01],
    ['color', 'Water', 'color'],
    ['foam', 'Foam', 'color'],
    ['alpha', 'Opacity', 0, 1, 0.01],
    ['x', 'Offset X', -20, 20, 0.05], ['y', 'Offset Y', -5, 30, 0.05], ['z', 'Offset Z', -20, 20, 0.05],
  ],
  light: [
    ['color', 'Colour', 'color'],
    ['intensity', 'Brightness', 0, 20, 0.1],
    ['distance', 'Reach', 0.5, 40, 0.5],
    ['flicker', 'Flicker', 0, 1, 0.01],
    ['x', 'Offset X', -20, 20, 0.05], ['y', 'Offset Y', -5, 30, 0.05], ['z', 'Offset Z', -20, 20, 0.05],
  ],
};

/** Starting values for a new layer of each kind. */
export const LAYER_DEFAULTS = {
  particles: {
    sprite: 'soft', blend: 'alpha', shape: 'disc', area: 1, areaH: 0, rate: 20, every: 0, burst: 60, hueVary: 0, life: 2, lifeVary: 0.3, speed: 1, speedVary: 0.3,
    dirX: 0, dirY: 1, dirZ: 0, spread: 0.3, gravity: 0, drag: 0.2, windX: 0, windZ: 0, wander: 0, sizeStart: 0.3, sizeEnd: 0.6,
    colorStart: '#ffffff', colorEnd: '#ffffff', alpha: 0.8, fadeIn: 0.1, fadeOut: 0.4, stretch: 0, spin: 0, flicker: 0, floor: false, x: 0, y: 0, z: 0,
  },
  sheet: { width: 2, height: 6, lip: 0.6, spreadOut: 0.25, speed: 4, streaks: 10, broken: 0.35, color: '#bfe6ee', foam: '#ffffff', alpha: 0.85, x: 0, y: 0, z: 0 },
  light: { color: '#ff9a4a', intensity: 3, distance: 6, flicker: 0.5, x: 0, y: 0.5, z: 0 },
};
export const layer = (kind, values = {}) => ({ kind, name: kind[0].toUpperCase() + kind.slice(1), ...structuredClone(LAYER_DEFAULTS[kind]), ...values });

/** Ready-made effects to start from. */
export const PRESETS = [
  { format: 'dream-fx', version: 1, name: 'Waterfall', layers: [
    layer('sheet', { name: 'Falling water', width: 2.4, height: 7, lip: 0.8 }),
    layer('particles', { name: 'Foam', sprite: 'soft', shape: 'line', area: 2.6, rate: 70, life: 1.2, speed: 2.2, dirY: 1, dirZ: 0.6, spread: 0.6, gravity: 6, drag: 0.4, sizeStart: 0.35, sizeEnd: 0.9, alpha: 0.75, z: 1.2, colorStart: '#ffffff', colorEnd: '#dfeff2', floor: true }),
    layer('particles', { name: 'Mist', sprite: 'smoke', shape: 'disc', area: 2.5, rate: 6, life: 5, speed: 0.4, spread: 0.8, drag: 0.6, wander: 0.3, sizeStart: 1.5, sizeEnd: 4, alpha: 0.22, fadeIn: 0.3, fadeOut: 0.6, z: 1.4, y: 0.3, colorStart: '#f4fbfc', colorEnd: '#ffffff' }),
    layer('particles', { name: 'Spray', sprite: 'drop', blend: 'alpha', shape: 'line', area: 2.4, rate: 90, life: 0.8, speed: 4, dirZ: 0.8, dirY: 0.6, spread: 0.5, gravity: 9.8, sizeStart: 0.05, sizeEnd: 0.03, stretch: 0.6, alpha: 0.7, z: 1, y: 0.1, colorStart: '#ffffff', colorEnd: '#cfe8ee', floor: true }),
  ] },
  { format: 'dream-fx', version: 1, name: 'Creek rapids', layers: [
    layer('particles', { name: 'White water', sprite: 'soft', shape: 'box', area: 3, areaH: 0.05, rate: 40, life: 0.9, speed: 0.6, dirX: 1, dirY: 0.3, spread: 0.4, gravity: 1, sizeStart: 0.2, sizeEnd: 0.5, alpha: 0.6, colorStart: '#ffffff', colorEnd: '#e7f4f6' }),
    layer('particles', { name: 'Splashes', sprite: 'drop', shape: 'box', area: 3, rate: 25, life: 0.5, speed: 1.8, dirY: 1, spread: 0.4, gravity: 9.8, sizeStart: 0.04, sizeEnd: 0.03, stretch: 0.5, alpha: 0.7, floor: true }),
  ] },
  { format: 'dream-fx', version: 1, name: 'Campfire', layers: [
    layer('particles', { name: 'Flames', sprite: 'soft', blend: 'add', shape: 'disc', area: 0.35, rate: 45, life: 0.7, speed: 1.2, spread: 0.15, gravity: -1.5, sizeStart: 0.45, sizeEnd: 0.1, colorStart: '#ffd27a', colorEnd: '#c8401a', alpha: 0.9, fadeIn: 0.05, fadeOut: 0.5, flicker: 0.4 }),
    layer('particles', { name: 'Embers', sprite: 'spark', blend: 'add', shape: 'disc', area: 0.3, rate: 8, life: 2.5, speed: 1.6, spread: 0.3, gravity: -0.6, wander: 0.8, sizeStart: 0.05, sizeEnd: 0.02, colorStart: '#ffcf6a', colorEnd: '#ff5a1a', alpha: 1, flicker: 0.6 }),
    layer('particles', { name: 'Smoke', sprite: 'smoke', shape: 'disc', area: 0.3, rate: 4, life: 6, speed: 0.6, spread: 0.2, gravity: -0.2, windX: 0.3, wander: 0.2, sizeStart: 0.5, sizeEnd: 2.5, colorStart: '#6a6460', colorEnd: '#cfcac4', alpha: 0.35, fadeIn: 0.15, fadeOut: 0.7, y: 0.8 }),
    layer('light', { name: 'Glow', color: '#ff9a4a', intensity: 4, distance: 7, flicker: 0.5, y: 0.6 }),
  ] },
  { format: 'dream-fx', version: 1, name: 'Fireworks', layers: [
    layer('particles', { name: 'Shells', sprite: 'spark', blend: 'add', shape: 'box', area: 24, areaH: 8, y: 18, every: 1.2, burst: 220, hueVary: 1, life: 2.2, lifeVary: 0.35, speed: 9, speedVary: 0.25, spread: 1, gravity: 3, drag: 1.1, stretch: 0.25, sizeStart: 0.35, sizeEnd: 0.12, colorStart: '#ffe6a0', colorEnd: '#ff4a2a', alpha: 1, fadeIn: 0, fadeOut: 0.5, flicker: 0.35 }),
    layer('particles', { name: 'Glitter', sprite: 'star', blend: 'add', shape: 'box', area: 24, areaH: 8, y: 18, every: 2.1, burst: 120, hueVary: 0.15, life: 3.2, lifeVary: 0.5, speed: 6, spread: 1, gravity: 2, drag: 1.6, sizeStart: 0.25, sizeEnd: 0.05, colorStart: '#fff6d8', colorEnd: '#ffc85a', alpha: 1, fadeIn: 0, fadeOut: 0.7, flicker: 0.9 }),
    layer('particles', { name: 'Smoke', sprite: 'smoke', shape: 'box', area: 24, areaH: 8, y: 18, rate: 2, life: 9, speed: 0.2, spread: 1, windX: 0.2, wander: 0.1, sizeStart: 3, sizeEnd: 8, colorStart: '#7a746e', colorEnd: '#a8a29a', alpha: 0.12, fadeIn: 0.3, fadeOut: 0.6 }),
  ] },
  // after a long-exposure photo of a gold burst: slow, heavy trails that droop, and smoke hanging after
  { format: 'dream-fx', version: 1, name: 'Gold willow fireworks', layers: [
    layer('particles', { name: 'Gold trails', sprite: 'spark', blend: 'add', shape: 'box', area: 20, areaH: 6, y: 20, every: 2.4, burst: 160, life: 3, lifeVary: 0.3, speed: 7, speedVary: 0.2, spread: 1, gravity: 2.6, drag: 0.9, stretch: 0.9, sizeStart: 0.3, sizeEnd: 0.08, colorStart: '#fff1c0', colorEnd: '#c8641a', alpha: 1, fadeIn: 0, fadeOut: 0.6, flicker: 0.25 }),
    layer('particles', { name: 'Flash', sprite: 'soft', blend: 'add', shape: 'box', area: 20, areaH: 6, y: 20, every: 2.4, burst: 3, life: 0.35, speed: 0, spread: 0, sizeStart: 5, sizeEnd: 1, colorStart: '#ffffff', colorEnd: '#ffd27a', alpha: 0.9, fadeIn: 0, fadeOut: 0.9 }),
    layer('particles', { name: 'Smoke', sprite: 'smoke', shape: 'box', area: 20, areaH: 6, y: 20, rate: 2.5, life: 10, speed: 0.15, spread: 1, windX: 0.25, wander: 0.1, sizeStart: 3, sizeEnd: 9, colorStart: '#8a847c', colorEnd: '#b8b2aa', alpha: 0.14, fadeIn: 0.3, fadeOut: 0.6 }),
  ] },
  { format: 'dream-fx', version: 1, name: 'Fireflies', layers: [
    layer('particles', { name: 'Fireflies', sprite: 'soft', blend: 'add', shape: 'box', area: 10, areaH: 2, rate: 6, life: 7, speed: 0.15, spread: 1, wander: 0.6, sizeStart: 0.12, sizeEnd: 0.12, colorStart: '#d6ff7a', colorEnd: '#9fe04a', alpha: 1, fadeIn: 0.25, fadeOut: 0.25, flicker: 0.8, y: 0.4 }),
  ] },
  { format: 'dream-fx', version: 1, name: 'Rain', layers: [
    layer('particles', { name: 'Rain', sprite: 'drop', shape: 'box', area: 20, areaH: 0, rate: 400, life: 1.6, speed: 9, dirY: -1, spread: 0.02, gravity: 2, windX: 0.6, sizeStart: 0.03, sizeEnd: 0.03, stretch: 0.25, alpha: 0.45, colorStart: '#cfe0ea', colorEnd: '#cfe0ea', fadeIn: 0.05, fadeOut: 0.05, y: 12, floor: true }),
  ] },
  { format: 'dream-fx', version: 1, name: 'Falling leaves', layers: [
    layer('particles', { name: 'Leaves', sprite: 'leaf', shape: 'box', area: 8, areaH: 1, rate: 3, life: 9, speed: 0.1, dirY: -1, spread: 0.3, gravity: 0.25, drag: 1.2, windX: 0.4, wander: 0.9, spin: 2, sizeStart: 0.14, sizeEnd: 0.14, colorStart: '#9ab84a', colorEnd: '#c98a3a', alpha: 1, fadeIn: 0.05, fadeOut: 0.15, y: 7, floor: true }),
  ] },
  { format: 'dream-fx', version: 1, name: 'Ground mist', layers: [
    layer('particles', { name: 'Mist', sprite: 'smoke', shape: 'box', area: 14, areaH: 0.2, rate: 3, life: 12, speed: 0.08, spread: 1, wander: 0.15, sizeStart: 3, sizeEnd: 6, alpha: 0.18, fadeIn: 0.35, fadeOut: 0.4, colorStart: '#eef4f2', colorEnd: '#ffffff', y: 0.4 }),
  ] },
];

// ---------- sprites: drawn once on canvases, shared by every effect ----------
const spriteCache = new Map();
function spriteTexture(THREE, kind) {
  if (spriteCache.has(kind)) return spriteCache.get(kind);
  const S = 64, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), mid = S / 2;
  const radial = (stops) => { const gr = g.createRadialGradient(mid, mid, 0, mid, mid, mid); for (const [o, a] of stops) gr.addColorStop(o, `rgba(255,255,255,${a})`); g.fillStyle = gr; g.fillRect(0, 0, S, S); };
  if (kind === 'spark') radial([[0, 1], [0.15, 1], [0.35, 0.35], [1, 0]]);
  else if (kind === 'smoke') {
    // a lumpy puff: several soft blobs
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9; i++) {
      const x = mid + (rnd() - 0.5) * S * 0.4, y = mid + (rnd() - 0.5) * S * 0.4, r = S * (0.18 + rnd() * 0.16);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
    }
  } else if (kind === 'drop') {
    // a soft streak, long up the sprite: stretched along the motion
    const gr = g.createLinearGradient(0, 0, S, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(mid, mid, S * 0.2, S * 0.48, 0, 0, Math.PI * 2); g.fill();
  } else if (kind === 'leaf') {
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(mid, 4); g.quadraticCurveTo(S - 6, mid, mid, S - 4); g.quadraticCurveTo(6, mid, mid, 4); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(mid, 6); g.lineTo(mid, S - 6); g.stroke();
  } else if (kind === 'star') {
    radial([[0, 1], [0.1, 0.9], [0.3, 0.15], [1, 0]]);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(mid - 1, 4, 2, S - 8); g.fillRect(4, mid - 1, S - 8, 2);
  } else radial([[0, 1], [0.4, 0.6], [1, 0]]);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  spriteCache.set(kind, t);
  return t;
}

// ---------- particles ----------
const PARTICLE_VERT = `
attribute vec4 aColor;
attribute vec4 aMotion; // velocity xyz, spin angle
attribute float aSize;
uniform float uStretch;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec3 centre = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  vec3 toCam = normalize(cameraPosition - centre);
  vec3 vel = mat3(modelMatrix) * aMotion.xyz;
  // stretched along the motion as seen from the camera, or a plain turned billboard
  vec3 along = vel - dot(vel, toCam) * toCam;
  float speed = length(along);
  vec3 up, right;
  float len = 1.0;
  if (uStretch > 0.0 && speed > 0.001) {
    up = along / speed;
    right = normalize(cross(up, toCam));
    len = 1.0 + speed * uStretch * 4.0;
  } else {
    vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    float c = cos(aMotion.w), s = sin(aMotion.w);
    right = camRight * c + camUp * s;
    up = -camRight * s + camUp * c;
  }
  vec3 world = centre + (right * position.x + up * position.y * len) * aSize;
  vUv = uv;
  vColor = aColor;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const PARTICLE_FRAG = `
uniform sampler2D uMap;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(uMap, vUv);
  gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.003) discard;
  #include <colorspace_fragment>
}`;

function particleLayer(THREE, L, ctx) {
  // continuous (rate per second), or in bursts: `burst` at once from one spot, every `every` seconds
  const perSec = L.every > 0 ? L.burst / L.every : L.rate;
  const max = Math.min(4000, Math.ceil(perSec * L.life * (1 + L.lifeVary) * (L.every > 0 ? 1.5 : 1)) + (L.every > 0 ? L.burst : 0) + 8);
  const geo = new THREE.PlaneGeometry(1, 1);
  const aColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  const aMotion = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  const aSize = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  for (const a of [aColor, aMotion, aSize]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aColor', aColor);
  geo.setAttribute('aMotion', aMotion);
  geo.setAttribute('aSize', aSize);
  const mat = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG, transparent: true, depthWrite: false,
    blending: L.blend === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uMap: { value: spriteTexture(THREE, L.sprite) }, uStretch: { value: L.stretch } },
  });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = L.blend === 'add' ? 4 : 3;
  const c0 = new THREE.Color(L.colorStart), c1 = new THREE.Color(L.colorEnd), col = new THREE.Color();
  const parts = [], m = new THREE.Matrix4(), dir = new THREE.Vector3(L.dirX, L.dirY, L.dirZ);
  if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
  dir.normalize();
  let carry = 0, clock = 0;
  const born = (at = null, tint = null) => {
    const p = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: L.life * (1 - L.lifeVary * Math.random()), spin: Math.random() * 6.28, seed: Math.random() * 100, tint };
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * L.area / 2;
    if (L.shape === 'disc') p.pos.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    else if (L.shape === 'box') p.pos.set((Math.random() - 0.5) * L.area, Math.random() * L.areaH, (Math.random() - 0.5) * L.area);
    else if (L.shape === 'line') p.pos.set((Math.random() - 0.5) * L.area, 0, 0);
    p.pos.y += L.areaH && L.shape !== 'box' ? Math.random() * L.areaH : 0;
    p.pos.add(new THREE.Vector3(L.x, L.y, L.z));
    if (at) p.pos.copy(at);
    // a direction within the cone round `dir`
    const v = new THREE.Vector3().randomDirection().multiplyScalar(L.spread * 1.5).add(dir).normalize();
    p.vel.copy(v).multiplyScalar(L.speed * (1 - L.speedVary * Math.random()));
    return p;
  };
  return {
    object: mesh,
    update(dt, t) {
      if (L.every > 0) {
        clock -= dt;
        if (clock <= 0) {
          clock = L.every * (0.7 + Math.random() * 0.6);
          // one spot for the whole burst, and (if asked) its own colour, like a firework shell
          const at = born().pos.clone(), tint = L.hueVary ? Math.random() * L.hueVary : null;
          for (let k = 0; k < L.burst && parts.length < max; k++) parts.push(born(at, tint));
        }
      } else {
        carry += L.rate * dt;
        while (carry >= 1 && parts.length < max) { parts.push(born()); carry -= 1; }
        if (parts.length >= max) carry = 0;
      }
      const drag = Math.exp(-L.drag * dt);
      let n = 0;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        if (p.age >= p.life) { parts.splice(i, 1); continue; }
        p.vel.y -= L.gravity * dt;
        p.vel.x += L.windX * dt; p.vel.z += L.windZ * dt;
        if (L.wander) { p.vel.x += Math.sin(t * 1.3 + p.seed) * L.wander * dt; p.vel.y += Math.sin(t * 1.7 + p.seed * 2) * L.wander * 0.5 * dt; p.vel.z += Math.cos(t * 1.1 + p.seed) * L.wander * dt; }
        p.vel.multiplyScalar(drag);
        p.pos.addScaledVector(p.vel, dt);
        // the effect's own ground (y = 0 at its origin): stop there, as rain and foam do
        if (L.floor && p.pos.y < ctx.groundAt(p.pos)) { parts.splice(i, 1); continue; }
        p.spin += L.spin * dt;
      }
      for (const p of parts) {
        const k = p.age / p.life;
        const fade = Math.min(1, L.fadeIn > 0 ? k / L.fadeIn : 1, L.fadeOut > 0 ? (1 - k) / L.fadeOut : 1);
        const flick = L.flicker ? 1 - L.flicker * (0.5 + 0.5 * Math.sin(t * 23 + p.seed * 7) * Math.sin(t * 9.7 + p.seed)) : 1;
        col.copy(c0).lerp(c1, k);
        if (p.tint !== null) col.offsetHSL(p.tint, 0, 0);
        aColor.setXYZW(n, col.r, col.g, col.b, L.alpha * fade * flick);
        aMotion.setXYZW(n, p.vel.x, p.vel.y, p.vel.z, p.spin);
        aSize.setX(n, L.sizeStart + (L.sizeEnd - L.sizeStart) * k);
        m.makeTranslation(p.pos.x, p.pos.y, p.pos.z);
        mesh.setMatrixAt(n, m);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = aColor.needsUpdate = aMotion.needsUpdate = aSize.needsUpdate = true;
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

// ---------- falling water ----------
const SHEET_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SHEET_FRAG = `
uniform float uTime, uSpeed, uStreaks, uBroken, uAlpha, uLen;
uniform vec3 uColor, uFoam;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  // v runs 0 at the lip to 1 at the bottom; the pattern moves down at the flow speed
  float flow = vUv.y * uLen - uTime * uSpeed;
  float u = vUv.x * uStreaks;
  float streak = noise(vec2(u * 3.0, flow * 0.25)) * 0.6 + noise(vec2(u * 9.0, flow * 0.6)) * 0.4;
  float gaps = smoothstep(uBroken * 0.9, uBroken * 0.9 + 0.25, noise(vec2(u * 1.5, flow * 0.12)) + 0.15);
  float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  float white = smoothstep(0.55, 0.95, streak) + smoothstep(0.75, 1.0, vUv.y) * 0.6 + smoothstep(0.12, 0.0, vUv.y) * 0.4;
  vec3 c = mix(uColor, uFoam, clamp(white, 0.0, 1.0));
  float a = uAlpha * edge * gaps * (0.55 + streak * 0.6) * smoothstep(1.0, 0.94, vUv.y);
  gl_FragColor = vec4(c, a);
  if (a < 0.01) discard;
  #include <colorspace_fragment>
}`;
function sheetLayer(THREE, L) {
  // the curve water takes off a lip: out by `lip` metres at the bottom, sqrt-shaped like a thrown stream
  const segsY = 24, geo = new THREE.PlaneGeometry(1, 1, 8, segsY), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = 0.5 - pos.getY(i); // 0 at the top, 1 at the bottom
    const w = L.width * (1 + L.spreadOut * t);
    pos.setXYZ(i, pos.getX(i) * w + L.x, L.y + L.height * (1 - t), L.z + L.lip * Math.sqrt(t));
  }
  geo.computeVertexNormals();
  // v: 0 at the lip
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const mat = new THREE.ShaderMaterial({
    vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uSpeed: { value: L.speed }, uStreaks: { value: L.streaks }, uBroken: { value: L.broken }, uAlpha: { value: L.alpha },
      uLen: { value: L.height }, uColor: { value: new THREE.Color(L.color) }, uFoam: { value: new THREE.Color(L.foam) },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return { object: mesh, update(dt, t) { mat.uniforms.uTime.value = t; }, dispose() { geo.dispose(); mat.dispose(); } };
}

// ---------- light ----------
function lightLayer(THREE, L) {
  const light = new THREE.PointLight(new THREE.Color(L.color), L.intensity, L.distance, 2);
  light.position.set(L.x, L.y, L.z);
  return {
    object: light,
    update(dt, t) { light.intensity = L.intensity * (1 - L.flicker * 0.5 * (0.5 + 0.5 * Math.sin(t * 17) * Math.sin(t * 7.3 + 1))); },
    dispose() {},
  };
}

/**
 * A live effect from its data. `opts.groundAt(localPos)` gives the ground height under a point in the
 * effect's own space (default 0), for layers that stop at the ground.
 */
export function createEffect(THREE, def, opts = {}) {
  const root = new THREE.Group();
  root.name = def.name ?? 'effect';
  const ctx = { groundAt: opts.groundAt ?? (() => 0) };
  const layers = [];
  for (const raw of def.layers ?? []) {
    const L = { ...LAYER_DEFAULTS[raw.kind], ...raw };
    if (L.off) continue;
    const made = raw.kind === 'sheet' ? sheetLayer(THREE, L) : raw.kind === 'light' ? lightLayer(THREE, L) : raw.kind === 'particles' ? particleLayer(THREE, L, ctx) : null;
    if (!made) continue;
    root.add(made.object);
    layers.push(made);
  }
  let time = 0;
  // warm up, so a placed waterfall is already falling and mist already hangs
  const warm = opts.warm ?? 3;
  for (let s = 0; s < warm * 20; s++) { time += 0.05; for (const l of layers) l.update(0.05, time); }
  return {
    root,
    def,
    update(dt) { time += Math.min(dt, 0.1); for (const l of layers) l.update(Math.min(dt, 0.1), time); },
    dispose() { for (const l of layers) l.dispose(); root.removeFromParent(); },
  };
}
