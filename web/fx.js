// Dream effects: the runtime every dream tool shares (served by the Dream Library at /fx.js).
// An effect is plain data, { format: 'dream-fx', version: 1, name, layers: [...] }, saved to the library
// as "<name>.fx.json". Each layer is one of:
//   particles: sprites born in an area, moving, growing, fading (spray, mist, embers, rain, leaves)
//   sheet:     a curved falling sheet of water with scrolling streaks (waterfalls, weirs, spouts)
//   light:     a point light, steady or flickering (fire)
//   ring:      flat discs or rings that grow and fade (shockwaves, auras, ground circles, scorch marks)
//   trail:     a ribbon behind the effect's moving head (sword arcs, projectile trails)
// Particles, rings and trails draw a built-in sprite, or a Library texture (`texture: "place|path"`)
// whose luminance is the alpha (black = clear), tinted by the layer's colours. With `look: 'colours'`
// (particles and rings) it keeps its own colours and alpha instead (smoke puffs, foliage cut-outs).
// `round` fades a square picture out to a circle, `upright` stops a sprite being born at a random turn.
// A texture that is a grid of frames (`frames: "4x4"`) plays through them over each particle's life, or at `fps`.
// An effect loops (the default), or with `mode: 'once'` plays when asked: each layer then runs from
// `start` for `duration` seconds (0 = until the effect ends), so one effect can cast, travel and hit.
// `travel: { start, end, to: [x, y, z], arc }` moves the effect's head (where layers are born) in that
// window; `play({ follow })` makes the head track an Object3D instead (a hand bone, a projectile).
// Units are metres and seconds; an effect stands on its own origin. three.js is passed in, so this file
// works the same in Dream Effects (plain modules) and Dream World (Vite):
//   const fx = createEffect(THREE, def);  scene.add(fx.root);  each frame: fx.update(dt);
//   once:  const h = fx.play({ at, follow });  h.done.then(...);  h.stop();
import { fileUrl } from './resolve.js';

const SPRITES = ['soft', 'spark', 'smoke', 'drop', 'leaf', 'star', 'ring'];
// a Library texture as the shape, and its frames when it is a sheet; 'texture' and 'grid' are editor types
const SHAPE = [['texture', 'Shape', 'texture'], ['look', 'Picture is', ['brightness', 'colours']], ['round', 'Round off its edges', 'bool'], ['upright', 'Keep upright', 'bool'], ['frames', 'Sheet columns x rows', 'grid'], ['fps', 'Frames per second (0 = over its life)', 0, 60, 1]];
// when a layer runs in a play-once effect
const TIMING = [['start', 'Starts at (s)', 0, 10, 0.05], ['duration', 'Lasts (s, 0 = to the end)', 0, 10, 0.05]];
const OFFSET = [['x', 'Offset X', -20, 20, 0.05], ['y', 'Offset Y', -5, 30, 0.05], ['z', 'Offset Z', -20, 20, 0.05]];

/** The settings each layer kind has, for editors to build their panels from: [key, label, min, max, step]. */
export const SCHEMA = {
  particles: [
    ['sprite', 'Sprite', SPRITES],
    ...SHAPE,
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
    ...OFFSET, ...TIMING,
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
    ...OFFSET, ...TIMING,
  ],
  light: [
    ['color', 'Colour', 'color'],
    ['intensity', 'Brightness', 0, 20, 0.1],
    ['distance', 'Reach', 0.5, 40, 0.5],
    ['flicker', 'Flicker', 0, 1, 0.01],
    ...OFFSET, ...TIMING,
  ],
  ring: [
    ['sprite', 'Sprite', SPRITES],
    ...SHAPE,
    ['blend', 'Blend', ['add', 'alpha']],
    ['face', 'Faces', ['ground', 'camera']],
    ['every', 'One every (s)', 0.05, 10, 0.05],
    ['burst', 'Rings at once', 1, 20, 1],
    ['life', 'Lifetime', 0.05, 20, 0.05],
    ['sizeStart', 'Size at start', 0.01, 20, 0.01],
    ['sizeEnd', 'Size at end', 0.01, 20, 0.01],
    ['colorStart', 'Colour at start', 'color'],
    ['colorEnd', 'Colour at end', 'color'],
    ['alpha', 'Opacity', 0, 1, 0.01],
    ['fadeIn', 'Fade in', 0, 1, 0.01],
    ['fadeOut', 'Fade out', 0, 1, 0.01],
    ['spin', 'Spin', -10, 10, 0.1],
    ...OFFSET, ...TIMING,
  ],
  trail: [
    ...SHAPE.slice(0, 1),
    ['blend', 'Blend', ['add', 'alpha']],
    ['width', 'Width', 0.01, 5, 0.01],
    ['widthEnd', 'Width at the tail', 0, 5, 0.01],
    ['life', 'Length (s)', 0.05, 5, 0.05],
    ['arc', 'Sweeps (degrees)', 0, 360, 1],
    ['radius', 'Sweep radius', 0, 10, 0.05],
    ['colorStart', 'Colour at the head', 'color'],
    ['colorEnd', 'Colour at the tail', 'color'],
    ['alpha', 'Opacity', 0, 1, 0.01],
    ...OFFSET, ...TIMING,
  ],
};
/** The effect's own settings (not per layer). */
export const EFFECT_SCHEMA = [['mode', 'Plays', ['loop', 'once']], ['length', 'Length (s, 0 = from its layers)', 0, 20, 0.05]];

/** Starting values for a new layer of each kind. */
export const LAYER_DEFAULTS = {
  particles: {
    sprite: 'soft', blend: 'alpha', shape: 'disc', area: 1, areaH: 0, rate: 20, every: 0, burst: 60, hueVary: 0, life: 2, lifeVary: 0.3, speed: 1, speedVary: 0.3,
    dirX: 0, dirY: 1, dirZ: 0, spread: 0.3, gravity: 0, drag: 0.2, windX: 0, windZ: 0, wander: 0, sizeStart: 0.3, sizeEnd: 0.6,
    colorStart: '#ffffff', colorEnd: '#ffffff', alpha: 0.8, fadeIn: 0.1, fadeOut: 0.4, stretch: 0, spin: 0, flicker: 0, floor: false, x: 0, y: 0, z: 0,
  },
  sheet: { width: 2, height: 6, lip: 0.6, spreadOut: 0.25, speed: 4, streaks: 10, broken: 0.35, color: '#bfe6ee', foam: '#ffffff', alpha: 0.85, x: 0, y: 0, z: 0 },
  light: { color: '#ff9a4a', intensity: 3, distance: 6, flicker: 0.5, x: 0, y: 0.5, z: 0 },
  ring: { sprite: 'ring', blend: 'add', face: 'ground', every: 1, burst: 1, life: 0.8, sizeStart: 0.2, sizeEnd: 3, colorStart: '#ffffff', colorEnd: '#ffffff', alpha: 0.9, fadeIn: 0.05, fadeOut: 0.6, spin: 0, x: 0, y: 0.05, z: 0 },
  trail: { blend: 'add', width: 0.3, widthEnd: 0, life: 0.3, arc: 0, radius: 1, colorStart: '#ffffff', colorEnd: '#9fd8ff', alpha: 0.9, x: 0, y: 0, z: 0 },
};
for (const k in LAYER_DEFAULTS) Object.assign(LAYER_DEFAULTS[k], { texture: '', look: 'brightness', round: false, upright: false, frames: '1x1', fps: 0, start: 0, duration: 0 });
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

// ability effects, played once; shapes from Kenney's CC0 particle pack (the Library place cc0-kenney-particles)
const K = (n) => `cc0-kenney-particles|${n}.png`;
const once = (name, length, layers, more = {}) => ({ format: 'dream-fx', version: 1, name, group: 'Abilities', mode: 'once', length, ...more, layers });
const HAND = 1.2; // cast from about hand height
PRESETS.push(
  once('Fireball', 1.9, [
    layer('ring', { name: 'Cast ring', texture: K('circle_03'), face: 'camera', every: 0.2, life: 0.4, sizeStart: 0.1, sizeEnd: 1.2, colorStart: '#ffd27a', colorEnd: '#ff5a1a', y: HAND, duration: 0.4 }),
    layer('particles', { name: 'Cast sparks', sprite: 'spark', blend: 'add', shape: 'point', every: 0.15, burst: 16, life: 0.4, speed: 2, spread: 1, drag: 2, sizeStart: 0.08, sizeEnd: 0.02, colorStart: '#fff1c0', colorEnd: '#ff7a2a', alpha: 1, fadeIn: 0, y: HAND, duration: 0.4 }),
    layer('particles', { name: 'Core', texture: K('flame_01'), blend: 'add', shape: 'point', rate: 70, life: 0.25, speed: 0.4, spread: 1, sizeStart: 0.7, sizeEnd: 0.2, spin: 3, colorStart: '#ffe6a0', colorEnd: '#e0401a', alpha: 1, fadeIn: 0, y: HAND, start: 0.3, duration: 0.72 }),
    layer('trail', { name: 'Trail', width: 0.4, widthEnd: 0, life: 0.3, colorStart: '#ffd27a', colorEnd: '#c8301a', y: HAND, start: 0.4, duration: 0.62 }),
    layer('particles', { name: 'Burst', texture: K('spark_01'), blend: 'add', shape: 'point', every: 5, burst: 70, life: 0.6, lifeVary: 0.4, speed: 5, spread: 1, gravity: 4, drag: 1.5, stretch: 0.3, sizeStart: 0.25, sizeEnd: 0.05, colorStart: '#fff1c0', colorEnd: '#ff4a1a', alpha: 1, fadeIn: 0, y: HAND, start: 1, duration: 0.05 }),
    layer('particles', { name: 'Flash', sprite: 'soft', blend: 'add', shape: 'point', every: 5, burst: 1, life: 0.3, speed: 0, sizeStart: 3, sizeEnd: 0.5, colorStart: '#ffffff', colorEnd: '#ffb04a', alpha: 1, fadeIn: 0, fadeOut: 0.9, y: HAND, start: 1, duration: 0.05 }),
    layer('ring', { name: 'Shockwave', texture: K('circle_02'), every: 5, life: 0.5, sizeStart: 0.3, sizeEnd: 4, colorStart: '#ffd27a', colorEnd: '#ff5a1a', start: 1, duration: 0.05 }),
    layer('ring', { name: 'Scorch', texture: K('scorch_01'), blend: 'alpha', every: 5, life: 0.85, sizeStart: 1.6, sizeEnd: 1.8, colorStart: '#20140c', colorEnd: '#3a2a20', alpha: 0.85, fadeIn: 0.02, fadeOut: 0.6, y: 0.02, start: 1, duration: 0.05 }),
    layer('light', { name: 'Glow', color: '#ff8a3a', intensity: 4, distance: 6, flicker: 0.3, y: HAND, duration: 1.2 }),
  ], { travel: { start: 0.4, end: 1, to: [6, 0, 0], arc: 0.5 } }),
  once('Heal', 1.6, [
    layer('ring', { name: 'Ground ring', texture: K('circle_05'), every: 5, life: 1.3, sizeStart: 0.6, sizeEnd: 2.6, spin: 0.8, colorStart: '#c8ffb0', colorEnd: '#5ad46a', fadeIn: 0.1, duration: 0.05 }),
    layer('particles', { name: 'Rising stars', texture: K('star_06'), blend: 'add', shape: 'disc', area: 1.4, rate: 45, life: 1, lifeVary: 0.3, speed: 1.3, spread: 0.1, sizeStart: 0.28, sizeEnd: 0.08, colorStart: '#f6ffc8', colorEnd: '#6ae07a', alpha: 1, flicker: 0.4, duration: 1 }),
    layer('light', { name: 'Glow', color: '#8aff9a', intensity: 3, distance: 5, flicker: 0.1, y: 1, duration: 1.2 }),
  ]),
  once('Slash', 0.6, [
    layer('trail', { name: 'Arc', width: 0.55, widthEnd: 0, life: 0.16, arc: 170, radius: 1.1, colorStart: '#ffffff', colorEnd: '#8fd0ff', y: 1.1, duration: 0.22 }),
    layer('particles', { name: 'Glints', sprite: 'star', blend: 'add', shape: 'line', area: 1.6, rate: 60, life: 0.25, speed: 0.6, spread: 1, sizeStart: 0.15, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#8fd0ff', alpha: 1, fadeIn: 0, y: 1.1, z: 0.8, duration: 0.2 }),
  ]),
  once('Hit sparks', 0.6, [
    layer('particles', { name: 'Sparks', sprite: 'spark', blend: 'add', shape: 'point', every: 5, burst: 40, life: 0.4, lifeVary: 0.5, speed: 6, speedVary: 0.5, spread: 1, gravity: 6, drag: 2, stretch: 0.5, sizeStart: 0.1, sizeEnd: 0.03, colorStart: '#fff6d0', colorEnd: '#ffa02a', alpha: 1, fadeIn: 0, y: 1, duration: 0.05 }),
    layer('ring', { name: 'Flash', texture: K('star_07'), face: 'camera', every: 5, life: 0.18, sizeStart: 1.4, sizeEnd: 0.4, spin: 4, colorStart: '#ffffff', colorEnd: '#ffd27a', fadeIn: 0, y: 1, duration: 0.05 }),
  ]),
  once('Smoke puff', 1.6, [
    layer('particles', { name: 'Puff', texture: K('smoke_04'), shape: 'disc', area: 0.3, every: 5, burst: 18, life: 1.3, lifeVary: 0.3, speed: 1.6, spread: 1, drag: 2.5, gravity: -0.3, spin: 0.6, sizeStart: 0.6, sizeEnd: 1.8, colorStart: '#d8d2ca', colorEnd: '#8a847c', alpha: 0.7, fadeIn: 0.05, fadeOut: 0.6, y: 0.4, duration: 0.05 }),
  ]),
  once('Magic circle', 3.2, [
    layer('ring', { name: 'Circle', texture: K('magic_03'), every: 5, life: 3, sizeStart: 2.6, sizeEnd: 3, spin: 0.7, colorStart: '#c8a0ff', colorEnd: '#7a5aff', fadeIn: 0.15, fadeOut: 0.25, duration: 0.05 }),
    layer('ring', { name: 'Inner', texture: K('symbol_02'), every: 5, life: 3, sizeStart: 1.2, sizeEnd: 1.4, spin: -1.2, colorStart: '#e6d8ff', colorEnd: '#a07aff', alpha: 0.8, fadeIn: 0.2, fadeOut: 0.25, y: 0.06, duration: 0.05 }),
    layer('particles', { name: 'Motes', texture: K('magic_01'), blend: 'add', shape: 'disc', area: 2.6, rate: 25, life: 1.4, speed: 0.8, spread: 0.1, sizeStart: 0.2, sizeEnd: 0.05, colorStart: '#e6d8ff', colorEnd: '#8a6aff', alpha: 1, flicker: 0.5, duration: 2.6 }),
    layer('light', { name: 'Glow', color: '#9a7aff', intensity: 2.5, distance: 5, flicker: 0.1, y: 0.5, duration: 3 }),
  ]),
);

// three effects from each Kenney pack, drawn only from that pack: two abilities and a light for the night
// (Bramble and Glowing grove upright, since grass does not grow sideways); they open over the night sky
const packFx = (place, group, shapes) => {
  const tex = (name) => `${place}|${shapes(name)}`;
  const moment = { group, backdrop: 'night' };
  return {
    tex,
    ability: (name, length, layers, more = {}) => once(name, length, layers, { ...moment, ...more }),
    night: (name, layers) => ({ format: 'dream-fx', version: 1, name, ...moment, layers }),
  };
};
{
  const { tex: T, ability, night } = packFx('cc0-kenney-particles', 'Kenney particles', (n) => `${n}.png`);
  PRESETS.push(
    ability('Arcane nova', 1.7, [
      layer('ring', { name: 'Sigil', texture: T('magic_01'), every: 5, life: 1.4, sizeStart: 1.6, sizeEnd: 4, spin: 1.2, colorStart: '#e6d0ff', colorEnd: '#7a4aff', fadeIn: 0.1, y: 0.04, duration: 0.05 }),
      layer('ring', { name: 'Charge', texture: T('magic_05'), face: 'camera', every: 5, life: 0.4, sizeStart: 0.4, sizeEnd: 2.2, spin: 2, colorStart: '#ffffff', colorEnd: '#a07aff', fadeIn: 0.5, fadeOut: 0.2, y: HAND, duration: 0.05 }),
      layer('ring', { name: 'Flash', texture: T('star_09'), face: 'camera', every: 5, life: 0.3, sizeStart: 5, sizeEnd: 1, colorStart: '#ffffff', colorEnd: '#c8a0ff', fadeIn: 0, fadeOut: 0.9, y: HAND, start: 0.38, duration: 0.05 }),
      layer('ring', { name: 'Shockwave', texture: T('circle_03'), every: 5, life: 0.7, sizeStart: 0.4, sizeEnd: 9, colorStart: '#e6d0ff', colorEnd: '#6a3aff', fadeIn: 0, y: 0.06, start: 0.38, duration: 0.05 }),
      layer('particles', { name: 'Star burst', texture: T('star_07'), blend: 'add', shape: 'point', every: 5, burst: 45, life: 0.9, lifeVary: 0.4, speed: 8, speedVary: 0.5, spread: 1, drag: 3, spin: 3, sizeStart: 0.5, sizeEnd: 0.08, colorStart: '#ffffff', colorEnd: '#9a6aff', alpha: 1, fadeIn: 0, flicker: 0.4, y: HAND, start: 0.38, duration: 0.05 }),
      layer('light', { name: 'Glow', color: '#a07aff', intensity: 12, distance: 14, flicker: 0.2, y: HAND, duration: 1.3 }),
    ]),
    ability('Lightning strike', 1.1, [
      layer('ring', { name: 'Bolt', texture: T('spark_06'), face: 'camera', upright: true, every: 0.09, life: 0.09, sizeStart: 9, sizeEnd: 9, colorStart: '#ffffff', colorEnd: '#9fd0ff', alpha: 1, fadeIn: 0, fadeOut: 0.3, y: 4.3, duration: 0.3 }),
      layer('ring', { name: 'Fork', texture: T('spark_05'), face: 'camera', upright: true, every: 0.13, life: 0.1, sizeStart: 8, sizeEnd: 8, colorStart: '#d8ecff', colorEnd: '#6aa8ff', alpha: 1, fadeIn: 0, fadeOut: 0.3, y: 3.8, start: 0.05, duration: 0.25 }),
      layer('ring', { name: 'Impact flash', texture: T('star_08'), face: 'camera', every: 5, life: 0.22, sizeStart: 4, sizeEnd: 1.2, colorStart: '#ffffff', colorEnd: '#9fd0ff', fadeIn: 0, y: 0.5, duration: 0.05 }),
      layer('ring', { name: 'Shock', texture: T('circle_02'), every: 5, life: 0.45, sizeStart: 0.4, sizeEnd: 5, colorStart: '#ffffff', colorEnd: '#6aa8ff', fadeIn: 0, y: 0.05, duration: 0.05 }),
      layer('ring', { name: 'Scorch', texture: T('scorch_02'), blend: 'alpha', every: 5, life: 1, sizeStart: 2.2, sizeEnd: 2.4, colorStart: '#14161c', colorEnd: '#2a2c34', alpha: 0.9, fadeIn: 0.02, fadeOut: 0.5, y: 0.02, duration: 0.05 }),
      layer('particles', { name: 'Sparks', texture: T('star_04'), blend: 'add', shape: 'point', every: 5, burst: 35, life: 0.6, lifeVary: 0.5, speed: 7, speedVary: 0.5, dirY: 1, spread: 0.7, gravity: 12, drag: 1, stretch: 0.3, sizeStart: 0.3, sizeEnd: 0.05, colorStart: '#ffffff', colorEnd: '#7ab8ff', alpha: 1, fadeIn: 0, y: 0.1, duration: 0.05 }),
      layer('light', { name: 'Flash light', color: '#bcdcff', intensity: 20, distance: 24, flicker: 0.9, y: 4, duration: 0.4 }),
    ]),
    night('Torch flame', [
      layer('ring', { name: 'Halo', texture: T('circle_05'), face: 'camera', every: 0.5, life: 1.4, sizeStart: 2.6, sizeEnd: 3, colorStart: '#ffb060', colorEnd: '#ff7a2a', alpha: 0.18, fadeIn: 0.5, fadeOut: 0.5, y: 0.5 }),
      layer('particles', { name: 'Tongues', texture: T('flame_05'), blend: 'add', upright: true, shape: 'disc', area: 0.14, rate: 20, life: 0.5, lifeVary: 0.3, speed: 0.8, spread: 0.08, sizeStart: 0.7, sizeEnd: 0.35, colorStart: '#ffe6a0', colorEnd: '#e0401a', alpha: 0.9, fadeIn: 0.15, fadeOut: 0.5, flicker: 0.3, y: 0.3 }),
      layer('particles', { name: 'Licks', texture: T('flame_06'), blend: 'add', upright: true, shape: 'disc', area: 0.2, rate: 12, life: 0.45, lifeVary: 0.3, speed: 1, spread: 0.1, sizeStart: 0.6, sizeEnd: 0.25, colorStart: '#ffc860', colorEnd: '#c8301a', alpha: 0.8, fadeIn: 0.15, fadeOut: 0.5, flicker: 0.4, y: 0.4 }),
      layer('particles', { name: 'Embers', texture: T('star_04'), blend: 'add', shape: 'disc', area: 0.15, rate: 5, life: 1.8, speed: 1.2, spread: 0.2, gravity: -0.3, wander: 1, sizeStart: 0.14, sizeEnd: 0.04, colorStart: '#ffcf6a', colorEnd: '#ff5a1a', alpha: 1, flicker: 0.6, y: 0.7 }),
      layer('light', { name: 'Light', color: '#ff9a4a', intensity: 9, distance: 13, flicker: 0.45, y: 0.8 }),
    ]),
  );
}
{
  const { tex: T, ability, night } = packFx('cc0-kenney-pattern-pack-extra', 'Kenney pattern extra', (n) => `Default/pattern_${n}.png`);
  PRESETS.push(
    ability('Skull curse', 2.8, [
      layer('ring', { name: 'Curse circle', texture: T('074'), round: true, every: 5, life: 2.6, sizeStart: 3.4, sizeEnd: 4.4, spin: 0.5, colorStart: '#8aff6a', colorEnd: '#3a9a4a', alpha: 0.7, fadeIn: 0.1, fadeOut: 0.3, y: 0.04, duration: 0.05 }),
      layer('ring', { name: 'Skull', texture: T('015'), round: true, upright: true, every: 5, life: 2.4, sizeStart: 2.2, sizeEnd: 2.5, colorStart: '#d8ffc8', colorEnd: '#5ad46a', fadeIn: 0.15, fadeOut: 0.3, y: 0.07, start: 0.1, duration: 0.05 }),
      layer('particles', { name: 'Rising skulls', texture: T('015'), blend: 'add', round: true, upright: true, shape: 'disc', area: 3, rate: 7, life: 1.3, lifeVary: 0.2, speed: 1.5, spread: 0.08, sizeStart: 0.45, sizeEnd: 0.9, colorStart: '#c8ff9a', colorEnd: '#2a7a3a', alpha: 0.9, fadeIn: 0.2, fadeOut: 0.5, duration: 1.8 }),
      layer('light', { name: 'Sick light', color: '#6aff6a', intensity: 7, distance: 10, flicker: 0.3, y: 1, duration: 2.5 }),
    ]),
    ability('Clockwork ward', 3, [
      layer('ring', { name: 'Big gear', texture: T('070'), round: true, every: 5, life: 2.8, sizeStart: 3.4, sizeEnd: 3.6, spin: 1.3, colorStart: '#ffe6a0', colorEnd: '#c8862a', alpha: 0.8, fadeIn: 0.1, fadeOut: 0.25, y: 0.04, duration: 0.05 }),
      layer('ring', { name: 'Small gears', texture: T('071'), round: true, every: 5, life: 2.8, sizeStart: 1.6, sizeEnd: 1.7, spin: -2.4, colorStart: '#fff6d8', colorEnd: '#e0a84a', alpha: 0.9, fadeIn: 0.1, fadeOut: 0.25, y: 0.07, duration: 0.05 }),
      layer('ring', { name: 'Wall gear', texture: T('069'), round: true, face: 'camera', every: 5, life: 2.4, sizeStart: 2.4, sizeEnd: 2.7, spin: 0.8, colorStart: '#ffd27a', colorEnd: '#a0641a', alpha: 0.28, fadeIn: 0.15, fadeOut: 0.3, y: HAND, start: 0.2, duration: 0.05 }),
      layer('particles', { name: 'Cogs', texture: T('068'), blend: 'add', round: true, shape: 'disc', area: 2.8, rate: 10, life: 1.2, speed: 1.1, spread: 0.1, spin: 3, sizeStart: 0.28, sizeEnd: 0.12, colorStart: '#fff1c0', colorEnd: '#c8862a', alpha: 1, duration: 2.2 }),
      layer('light', { name: 'Brass light', color: '#ffc860', intensity: 7, distance: 9, flicker: 0.08, y: 1.2, duration: 2.8 }),
    ]),
    night('Moon and stars lantern', [
      layer('ring', { name: 'Moon on the ground', texture: T('003'), round: true, upright: true, every: 7, life: 9, sizeStart: 7, sizeEnd: 7, spin: 0.04, colorStart: '#a8c4ff', colorEnd: '#c8d8ff', alpha: 0.42, fadeIn: 0.3, fadeOut: 0.3, y: 0.04 }),
      layer('ring', { name: 'Lantern', texture: T('033'), round: true, upright: true, face: 'camera', every: 1.2, life: 2.4, sizeStart: 0.9, sizeEnd: 1.05, colorStart: '#ffffff', colorEnd: '#c8d8ff', alpha: 0.7, fadeIn: 0.4, fadeOut: 0.4, y: 2.4 }),
      layer('particles', { name: 'Twinkles', texture: T('002'), blend: 'add', round: true, shape: 'disc', area: 5, areaH: 2.5, rate: 3, life: 3, speed: 0.08, spread: 1, wander: 0.12, spin: 0.5, sizeStart: 0.32, sizeEnd: 0.32, colorStart: '#d8e6ff', colorEnd: '#8aa8ff', alpha: 0.9, fadeIn: 0.3, fadeOut: 0.3, flicker: 0.6, y: 0.5 }),
      layer('light', { name: 'Moonlight', color: '#a8c4ff', intensity: 9, distance: 14, flicker: 0.03, y: 2.4 }),
    ]),
  );
}
{
  const { tex: T, ability, night } = packFx('cc0-kenney-dev-essentials-textures', 'Kenney dev essentials', (n) => `${n}.png`);
  const radial = T('Gradient/gradient-radial'), pixel = T('4×4 Pixels/pixel-white');
  PRESETS.push(
    ability('Judgement beam', 2, [
      layer('ring', { name: 'Warning', texture: radial, every: 5, life: 0.4, sizeStart: 1, sizeEnd: 3, colorStart: '#fff6d8', colorEnd: '#ffd27a', alpha: 0.7, fadeIn: 0.6, fadeOut: 0.3, y: 0.04, duration: 0.05 }),
      layer('trail', { name: 'Beam', texture: T('Gradient/gradient-vertical-mirror'), width: 1.8, widthEnd: 1.2, life: 0.7, colorStart: '#ffffff', colorEnd: '#ffd27a', alpha: 1, y: 16, start: 0.3, duration: 0.18 }),
      layer('ring', { name: 'Flash', texture: radial, face: 'camera', every: 5, life: 0.35, sizeStart: 7, sizeEnd: 2, colorStart: '#ffffff', colorEnd: '#ffd27a', fadeIn: 0, fadeOut: 0.9, y: 16.6, start: 0.4, duration: 0.05 }),
      layer('ring', { name: 'Burn', texture: T('Noise/perlin-noise'), round: true, blend: 'alpha', every: 5, life: 1.4, sizeStart: 3, sizeEnd: 3.3, colorStart: '#1a1208', colorEnd: '#30241a', alpha: 0.8, fadeIn: 0.02, fadeOut: 0.5, y: 0.03, start: 0.4, duration: 0.05 }),
      layer('ring', { name: 'Wave', texture: T('Gradient/gradient-radial'), every: 5, life: 0.5, sizeStart: 1, sizeEnd: 8, colorStart: '#fff1c0', colorEnd: '#ff9a2a', alpha: 0.6, fadeIn: 0, y: 0.06, start: 0.4, duration: 0.05 }),
      layer('particles', { name: 'Bits', texture: pixel, blend: 'add', upright: true, shape: 'point', every: 5, burst: 50, life: 0.9, lifeVary: 0.5, speed: 7, speedVary: 0.6, dirY: 1, spread: 0.8, gravity: 8, drag: 1, sizeStart: 0.14, sizeEnd: 0.03, colorStart: '#ffffff', colorEnd: '#ffb04a', alpha: 1, fadeIn: 0, y: 16.1, start: 0.4, duration: 0.05 }),
      layer('light', { name: 'Holy light', color: '#ffe6a0', intensity: 18, distance: 20, flicker: 0.1, y: 17, start: 0.3, duration: 1 }),
    ], { travel: { start: 0.3, end: 0.4, to: [0, -16, 0] } }),
    ability('Radar sweep', 2.6, [
      layer('ring', { name: 'Sweep', texture: T('Gradient/gradient-angular'), round: true, every: 5, life: 2.4, sizeStart: 8, sizeEnd: 8, spin: 3.6, colorStart: '#7affb0', colorEnd: '#2ac87a', alpha: 0.75, fadeIn: 0.08, fadeOut: 0.2, y: 0.04, duration: 0.05 }),
      layer('ring', { name: 'Ping', texture: radial, every: 0.8, life: 0.8, sizeStart: 0.3, sizeEnd: 8, colorStart: '#b0ffd0', colorEnd: '#2ac87a', alpha: 0.3, fadeIn: 0, y: 0.06, duration: 1.8 }),
      layer('particles', { name: 'Blips', texture: pixel, blend: 'add', upright: true, shape: 'disc', area: 7, rate: 30, life: 0.7, lifeVary: 0.4, speed: 0.7, spread: 0.05, sizeStart: 0.09, sizeEnd: 0.09, colorStart: '#d8ffe6', colorEnd: '#2ac87a', alpha: 1, flicker: 0.7, y: 0.1, duration: 2.1 }),
      layer('light', { name: 'Screen light', color: '#5effa0', intensity: 6, distance: 11, flicker: 0.1, y: 1, duration: 2.4 }),
    ]),
    night('Street lamp', [
      layer('ring', { name: 'Glow', texture: radial, face: 'camera', every: 0.8, life: 2.4, sizeStart: 2.6, sizeEnd: 2.8, colorStart: '#fff1d0', colorEnd: '#ffc880', alpha: 0.55, fadeIn: 0.4, fadeOut: 0.4, y: 3.4 }),
      layer('ring', { name: 'Pool', texture: radial, every: 0.8, life: 2.4, sizeStart: 9, sizeEnd: 9, colorStart: '#ffd9a0', colorEnd: '#ffc880', alpha: 0.1, fadeIn: 0.4, fadeOut: 0.4, y: 0.04 }),
      layer('ring', { name: 'Haze', texture: T('Noise/perlin-noise'), round: true, face: 'camera', every: 2, life: 7, sizeStart: 4, sizeEnd: 5, spin: 0.1, colorStart: '#ffe0b0', colorEnd: '#ffd090', alpha: 0.07, fadeIn: 0.4, fadeOut: 0.4, y: 2.2 }),
      layer('particles', { name: 'Moths', texture: pixel, upright: true, shape: 'disc', area: 1.4, areaH: 1, rate: 3, life: 4, speed: 0.3, spread: 1, wander: 2.5, sizeStart: 0.05, sizeEnd: 0.05, colorStart: '#fff6e0', colorEnd: '#ffe0b0', alpha: 0.9, fadeIn: 0.2, fadeOut: 0.2, y: 2.9 }),
      layer('light', { name: 'Lamp', color: '#ffd9a0', intensity: 16, distance: 16, flicker: 0.02, y: 3.4 }),
    ]),
  );
}
{
  const colours = { look: 'colours', blend: 'alpha' };
  const { tex: T, ability, night } = packFx('cc0-kenney-foliage-sprites', 'Kenney foliage', (n) => `Flat/sprite_${n}.png`);
  PRESETS.push(
    ability('Leaf storm', 2.4, [
      layer('ring', { ...colours, name: 'Whirl', texture: T('0048'), every: 5, life: 1.3, sizeStart: 0.6, sizeEnd: 6, spin: 3, colorStart: '#b8e86a', colorEnd: '#4a8a2a', alpha: 0.8, fadeIn: 0.05, fadeOut: 0.6, y: 0.05, duration: 0.05 }),
      layer('particles', { ...colours, name: 'Maple', texture: T('0035'), shape: 'disc', area: 1, rate: 60, life: 1.5, lifeVary: 0.4, speed: 5, speedVary: 0.5, dirY: 0.6, spread: 0.9, gravity: 1, drag: 1.2, wander: 5, spin: 6, sizeStart: 0.4, sizeEnd: 0.28, colorStart: '#d8f07a', colorEnd: '#6aa83a', alpha: 1, fadeOut: 0.3, y: 0.6, duration: 0.9 }),
      layer('particles', { ...colours, name: 'Oak', texture: T('0037'), shape: 'disc', area: 1, rate: 35, life: 1.5, lifeVary: 0.4, speed: 4, speedVary: 0.5, dirY: 0.6, spread: 0.9, gravity: 1, drag: 1.2, wander: 5, spin: -5, sizeStart: 0.34, sizeEnd: 0.24, colorStart: '#ffc84a', colorEnd: '#c8641a', alpha: 1, fadeOut: 0.3, y: 0.6, duration: 0.9 }),
      layer('light', { name: 'Green light', color: '#a0e86a', intensity: 5, distance: 8, flicker: 0.2, y: 1, duration: 1.6 }),
    ]),
    ability('Bramble bind', 3.2, [
      layer('ring', { ...colours, name: 'Roots', texture: T('0045'), every: 5, life: 3, sizeStart: 2, sizeEnd: 4.4, spin: 0.15, colorStart: '#5a8a3a', colorEnd: '#2a4a1a', alpha: 0.9, fadeIn: 0.1, fadeOut: 0.2, y: 0.04, duration: 0.05 }),
      layer('particles', { ...colours, name: 'Thorns', texture: T('0018'), upright: true, shape: 'disc', area: 3.2, rate: 26, life: 2.3, lifeVary: 0.2, speed: 0.7, speedVary: 0, spread: 0, drag: 1.6, sizeStart: 0.25, sizeEnd: 1.3, colorStart: '#7ab84a', colorEnd: '#2f6a2a', alpha: 1, fadeIn: 0.1, fadeOut: 0.25, y: 0.1, duration: 0.9 }),
      layer('particles', { ...colours, name: 'Vines', texture: T('0044'), upright: true, shape: 'disc', area: 2.6, rate: 10, life: 2.3, lifeVary: 0.2, speed: 0.8, speedVary: 0, spread: 0, drag: 1.6, sizeStart: 0.25, sizeEnd: 1.6, colorStart: '#a0d86a', colorEnd: '#3a7a2a', alpha: 1, fadeIn: 0.1, fadeOut: 0.25, y: 0.1, start: 0.15, duration: 0.8 }),
      layer('light', { name: 'Forest light', color: '#7ae06a', intensity: 4, distance: 7, flicker: 0.1, y: 0.8, duration: 2.8 }),
    ]),
    night('Glowing grove', [
      layer('particles', { name: 'Mushrooms', look: 'colours', texture: T('0026'), blend: 'add', upright: true, shape: 'disc', area: 6, rate: 1.4, life: 9, lifeVary: 0.2, speed: 0, spread: 0, sizeStart: 0.9, sizeEnd: 1, colorStart: '#5affd8', colorEnd: '#3ad0ff', alpha: 0.9, fadeIn: 0.2, fadeOut: 0.2, y: 0.42 }),
      layer('particles', { name: 'Bulbs', look: 'colours', texture: T('0010'), blend: 'add', upright: true, shape: 'disc', area: 7, rate: 1.6, life: 9, lifeVary: 0.2, speed: 0, spread: 0, sizeStart: 0.8, sizeEnd: 0.85, colorStart: '#a07aff', colorEnd: '#5affd8', alpha: 0.8, fadeIn: 0.2, fadeOut: 0.2, y: 0.36 }),
      layer('particles', { name: 'Ferns', look: 'colours', texture: T('0011'), blend: 'add', upright: true, shape: 'disc', area: 8, rate: 2, life: 9, lifeVary: 0.2, speed: 0, spread: 0, sizeStart: 1, sizeEnd: 1.05, colorStart: '#2ac8a0', colorEnd: '#1a7a8a', alpha: 0.55, fadeIn: 0.2, fadeOut: 0.2, y: 0.45 }),
      layer('particles', { name: 'Spores', look: 'colours', texture: T('0030'), blend: 'add', shape: 'disc', area: 7, rate: 7, life: 5, speed: 0.25, spread: 0.3, gravity: -0.03, wander: 0.4, spin: 1, sizeStart: 0.08, sizeEnd: 0.04, colorStart: '#d8fff0', colorEnd: '#5affd8', alpha: 1, fadeIn: 0.2, fadeOut: 0.3, flicker: 0.5, y: 0.2 }),
      layer('light', { name: 'Grove light', color: '#4affd0', intensity: 9, distance: 13, flicker: 0.08, y: 1.2 }),
    ]),
  );
}
{
  const colours = { look: 'colours', blend: 'alpha' };
  const { tex: T, ability, night } = packFx('cc0-kenney-smoke-particles', 'Kenney smoke', (n) => `${n}.png`);
  const boom = (n) => T(`Explosion/explosion0${n}`), black = (n) => T(`Black smoke/blackSmoke${n}`), fart = (n) => T(`Fart/fart0${n}`);
  PRESETS.push(
    ability('Fire blast', 2.6, [
      layer('particles', { ...colours, name: 'Black smoke', texture: black('04'), shape: 'disc', area: 1.2, rate: 16, life: 1.6, lifeVary: 0.3, speed: 2, spread: 0.5, gravity: -0.5, drag: 1, spin: 0.6, sizeStart: 1.4, sizeEnd: 3.8, alpha: 0.85, fadeIn: 0.1, fadeOut: 0.6, y: 0.8, start: 0.15, duration: 0.6 }),
      layer('particles', { ...colours, name: 'Fireball 1', texture: boom(0), shape: 'disc', area: 0.8, every: 5, burst: 10, life: 0.6, lifeVary: 0.3, speed: 3, spread: 1, drag: 3, spin: 1, sizeStart: 1.2, sizeEnd: 3.2, alpha: 1, fadeIn: 0, fadeOut: 0.5, y: 1, duration: 0.05 }),
      layer('particles', { ...colours, name: 'Fireball 2', texture: boom(4), shape: 'disc', area: 1, every: 5, burst: 8, life: 0.7, lifeVary: 0.3, speed: 3.4, spread: 1, drag: 3, spin: 1, sizeStart: 1, sizeEnd: 2.8, alpha: 1, fadeIn: 0, fadeOut: 0.5, y: 1.2, start: 0.1, duration: 0.05 }),
      layer('ring', { look: 'colours', blend: 'add', name: 'Flash', texture: T('Flash/flash00'), face: 'camera', every: 5, life: 0.28, sizeStart: 2.4, sizeEnd: 5, fadeIn: 0, fadeOut: 0.9, y: 1, duration: 0.05 }),
      layer('light', { name: 'Blast light', color: '#ff8a3a', intensity: 18, distance: 18, flicker: 0.3, y: 1.4, duration: 0.8 }),
    ]),
    ability('Toxic cloud', 4.5, [
      layer('particles', { ...colours, name: 'Low cloud', texture: fart(0), shape: 'disc', area: 3.4, rate: 9, life: 2.4, lifeVary: 0.3, speed: 0.3, spread: 0.8, wander: 0.5, spin: 0.3, sizeStart: 1, sizeEnd: 2.4, alpha: 0.6, fadeIn: 0.25, fadeOut: 0.5, y: 1.1, duration: 2.6 }),
      layer('particles', { ...colours, name: 'High cloud', texture: fart(4), shape: 'disc', area: 2.6, rate: 6, life: 2.2, lifeVary: 0.3, speed: 0.7, spread: 0.4, wander: 0.5, spin: -0.3, sizeStart: 0.8, sizeEnd: 2.4, alpha: 0.5, fadeIn: 0.25, fadeOut: 0.5, y: 1.2, start: 0.2, duration: 2.4 }),
      layer('ring', { look: 'colours', blend: 'add', name: 'Burst', texture: fart(7), face: 'camera', every: 5, life: 0.6, sizeStart: 1, sizeEnd: 4.6, alpha: 0.7, fadeIn: 0, fadeOut: 0.8, y: 0.8, duration: 0.05 }),
      layer('light', { name: 'Sick glow', color: '#7aff5a', intensity: 6, distance: 11, flicker: 0.12, y: 1, duration: 3.2 }),
    ]),
    night('Brazier', [
      layer('particles', { ...colours, name: 'Smoke', texture: black('10'), shape: 'disc', area: 0.3, rate: 5, life: 3, lifeVary: 0.3, speed: 1, spread: 0.12, gravity: -0.1, windX: 0.2, wander: 0.2, spin: 0.4, sizeStart: 0.5, sizeEnd: 2, alpha: 0.5, fadeIn: 0.2, fadeOut: 0.7, y: 1.3 }),
      layer('particles', { name: 'Flames', look: 'colours', texture: boom(2), blend: 'add', shape: 'disc', area: 0.5, rate: 18, life: 0.55, lifeVary: 0.3, speed: 1.3, spread: 0.1, gravity: -1, spin: 1, sizeStart: 0.85, sizeEnd: 0.3, alpha: 0.9, fadeIn: 0.1, fadeOut: 0.5, flicker: 0.25, y: 0.3 }),
      layer('particles', { name: 'Core', look: 'colours', texture: T('Flash/flash03'), blend: 'add', shape: 'disc', area: 0.3, rate: 10, life: 0.4, speed: 0.5, spread: 0.2, spin: 2, sizeStart: 0.65, sizeEnd: 0.3, alpha: 0.75, fadeIn: 0.1, fadeOut: 0.5, flicker: 0.3, y: 0.3 }),
      layer('light', { name: 'Firelight', color: '#ff8a3a', intensity: 12, distance: 15, flicker: 0.5, y: 1 }),
    ]),
  );
}

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
  } else if (kind === 'ring') radial([[0, 0], [0.7, 0], [0.85, 1], [1, 0]]);
  else radial([[0, 1], [0.4, 0.6], [1, 0]]);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  spriteCache.set(kind, t);
  return t;
}

const loading = new Set();
/** A Library texture ("place|path"), loaded once and shared by every effect that uses it. */
export function loadTexture(THREE, ref, colours = false) {
  const key = colours ? `${ref}|colours` : ref;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const [place, path] = ref.split('|');
  let t;
  const wait = new Promise((done) => { t = new THREE.TextureLoader().load(fileUrl(place, path), done, undefined, done); });
  loading.add(wait);
  wait.then(() => loading.delete(wait));
  // read as stored when its brightness is the alpha the artist drew; a picture's own colours are sRGB
  t.colorSpace = colours ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  spriteCache.set(key, t);
  return t;
}
/** Resolves once every Library texture asked for so far has loaded (or failed): before a thumbnail. */
export const texturesReady = () => Promise.all([...loading]);
const grid = (s) => { const [c, r] = String(s || '1x1').toLowerCase().split('x').map((n) => Math.max(1, Math.round(+n) || 1)); return [c, r ?? c]; };
// the shape a layer draws: its texture (luminance is the alpha, or its own colours) or its built-in sprite
const shapeOf = (THREE, L) => {
  if (!L.texture) return { map: spriteTexture(THREE, L.sprite ?? 'soft'), lum: 0 };
  const colours = L.look === 'colours';
  return { map: loadTexture(THREE, L.texture, colours), lum: colours ? 0 : 1 };
};

// ---------- particles ----------
const PARTICLE_VERT = `
attribute vec4 aColor;
attribute vec4 aMotion; // velocity xyz, spin angle
attribute float aSize;
attribute float aFrame;
uniform float uStretch, uFlat;
uniform vec2 uGrid;
varying vec2 vUv;
varying vec2 vCell;
varying vec4 vColor;
void main() {
  vCell = uv;
  vec3 centre = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  vec3 toCam = normalize(cameraPosition - centre);
  vec3 vel = mat3(modelMatrix) * aMotion.xyz;
  // stretched along the motion as seen from the camera, or a plain turned billboard
  vec3 along = vel - dot(vel, toCam) * toCam;
  float speed = length(along);
  vec3 up, right;
  float len = 1.0;
  if (uFlat > 0.5) {
    // lying flat in the effect's ground plane (rings, scorch marks), turned by the spin
    float c = cos(aMotion.w), s = sin(aMotion.w);
    right = normalize(mat3(modelMatrix) * vec3(c, 0.0, s));
    up = normalize(mat3(modelMatrix) * vec3(-s, 0.0, c));
  } else if (uStretch > 0.0 && speed > 0.001) {
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
  // a sheet's frame: column from the left, row from the top
  vUv = (uv + vec2(mod(aFrame, uGrid.x), uGrid.y - 1.0 - floor(aFrame / uGrid.x))) / uGrid;
  vColor = aColor;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const PARTICLE_FRAG = `
uniform sampler2D uMap;
uniform float uLum, uRound;
varying vec2 vUv;
varying vec2 vCell;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(uMap, vUv);
  // a Library texture: white shapes on black, so its brightness is how solid it is
  if (uLum > 0.5) t = vec4(1.0, 1.0, 1.0, dot(t.rgb, vec3(0.299, 0.587, 0.114)) * t.a);
  // a square picture with no edge of its own, faded out to a circle
  if (uRound > 0.5) t.a *= 1.0 - smoothstep(0.62, 0.95, length(vCell - 0.5) * 2.0);
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
  const aFrame = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  for (const a of [aColor, aMotion, aSize, aFrame]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aColor', aColor);
  geo.setAttribute('aMotion', aMotion);
  geo.setAttribute('aSize', aSize);
  geo.setAttribute('aFrame', aFrame);
  const shape = shapeOf(THREE, L), [cols, rows] = grid(L.frames), frames = cols * rows;
  const flat = L.kind === 'ring' && L.face !== 'camera';
  const mat = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG, transparent: true, depthWrite: false, side: flat ? THREE.DoubleSide : THREE.FrontSide,
    blending: L.blend === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uMap: { value: shape.map }, uLum: { value: shape.lum }, uRound: { value: L.round ? 1 : 0 }, uStretch: { value: L.stretch }, uFlat: { value: flat ? 1 : 0 }, uGrid: { value: new THREE.Vector2(cols, rows) } },
  });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = flat ? 2.5 : L.blend === 'add' ? 4 : 3;
  const c0 = new THREE.Color(L.colorStart), c1 = new THREE.Color(L.colorEnd), col = new THREE.Color();
  const parts = [], m = new THREE.Matrix4(), dir = new THREE.Vector3(L.dirX, L.dirY, L.dirZ);
  if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
  dir.normalize();
  let carry = 0, clock = 0;
  const born = (at = null, tint = null) => {
    const p = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: L.life * (1 - L.lifeVary * Math.random()), spin: L.upright ? 0 : Math.random() * 6.28, seed: Math.random() * 100, tint };
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * L.area / 2;
    if (L.shape === 'disc') p.pos.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    else if (L.shape === 'box') p.pos.set((Math.random() - 0.5) * L.area, Math.random() * L.areaH, (Math.random() - 0.5) * L.area);
    else if (L.shape === 'line') p.pos.set((Math.random() - 0.5) * L.area, 0, 0);
    p.pos.y += L.areaH && L.shape !== 'box' ? Math.random() * L.areaH : 0;
    p.pos.add(new THREE.Vector3(L.x, L.y, L.z)).add(ctx.head);
    // a ground ring lies on the ground under the head, wherever the head has flown
    if (flat) p.pos.y = ctx.groundAt(p.pos) + L.y;
    if (at) p.pos.copy(at);
    // a direction within the cone round `dir`
    const v = new THREE.Vector3().randomDirection().multiplyScalar(L.spread * 1.5).add(dir).normalize();
    p.vel.copy(v).multiplyScalar(L.speed * (1 - L.speedVary * Math.random()));
    return p;
  };
  return {
    object: mesh,
    update(dt, t, emit = true) {
      if (!emit) { /* outside its window in a play-once effect: what is alive lives on */ } else if (L.every > 0) {
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
        aFrame.setX(n, frames < 2 ? 0 : L.fps > 0 ? Math.floor(p.age * L.fps) % frames : Math.min(frames - 1, Math.floor(k * frames)));
        m.makeTranslation(p.pos.x, p.pos.y, p.pos.z);
        mesh.setMatrixAt(n, m);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = aColor.needsUpdate = aMotion.needsUpdate = aSize.needsUpdate = aFrame.needsUpdate = true;
    },
    reset() { parts.length = 0; carry = 0; clock = 0; mesh.count = 0; },
    idle: () => parts.length === 0,
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
  return { object: mesh, update(dt, t, emit = true) { mesh.visible = emit; mat.uniforms.uTime.value = t; }, dispose() { geo.dispose(); mat.dispose(); } };
}

// ---------- light ----------
function lightLayer(THREE, L, ctx) {
  const light = new THREE.PointLight(new THREE.Color(L.color), L.intensity, L.distance, 2);
  light.position.set(L.x, L.y, L.z);
  return {
    object: light,
    // in a play-once effect it shows in its window only, dimming towards the end of it
    update(dt, t, emit = true, k = 0) {
      light.visible = emit;
      light.position.set(L.x, L.y, L.z).add(ctx.head);
      light.intensity = L.intensity * (1 - k * k) * (1 - L.flicker * 0.5 * (0.5 + 0.5 * Math.sin(t * 17) * Math.sin(t * 7.3 + 1)));
    },
    dispose() {},
  };
}

// ---------- trail: a camera-facing ribbon through the head's recent positions ----------
const TRAIL_VERT = `
attribute vec3 aDir;
attribute vec2 aInfo; // side (-1 or 1), how far down the trail (0 at the head, 1 at the tail)
uniform float uWidth, uWidthEnd;
varying vec2 vUv;
void main() {
  vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 side = cross(mat3(modelMatrix) * aDir, cameraPosition - p);
  side = length(side) > 1e-6 ? normalize(side) : vec3(0.0, 1.0, 0.0);
  p += side * aInfo.x * mix(uWidth, uWidthEnd, aInfo.y) * 0.5;
  vUv = vec2(aInfo.y, aInfo.x * 0.5 + 0.5);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const TRAIL_FRAG = `
uniform sampler2D uMap;
uniform float uHasMap, uAlpha;
uniform vec3 uC0, uC1;
varying vec2 vUv;
void main() {
  // across the ribbon: the texture's brightness, or soft edges
  float across = uHasMap > 0.5 ? dot(texture2D(uMap, vUv).rgb, vec3(0.299, 0.587, 0.114)) : 1.0 - abs(vUv.y * 2.0 - 1.0);
  float a = uAlpha * across * (1.0 - vUv.x);
  gl_FragColor = vec4(mix(uC0, uC1, vUv.x), a);
  if (a < 0.003) discard;
  #include <colorspace_fragment>
}`;
function trailLayer(THREE, L, ctx) {
  const M = 96, geo = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array(M * 6), 3), dirs = new THREE.BufferAttribute(new Float32Array(M * 6), 3), info = new THREE.BufferAttribute(new Float32Array(M * 4), 2);
  for (const a of [pos, dirs, info]) a.setUsage(THREE.DynamicDrawUsage);
  const index = [];
  for (let i = 0; i < M - 1; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(index);
  geo.setAttribute('position', pos);
  geo.setAttribute('aDir', dirs);
  geo.setAttribute('aInfo', info);
  geo.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: L.blend === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uMap: { value: L.texture ? loadTexture(THREE, L.texture) : null }, uHasMap: { value: L.texture ? 1 : 0 }, uAlpha: { value: L.alpha },
      uWidth: { value: L.width }, uWidthEnd: { value: L.widthEnd }, uC0: { value: new THREE.Color(L.colorStart) }, uC1: { value: new THREE.Color(L.colorEnd) },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  const points = [], d = new THREE.Vector3();
  return {
    object: mesh,
    update(dt, t, emit = true, k = 0) {
      for (const q of points) q.age += dt;
      while (points.length && points[points.length - 1].age > L.life) points.pop();
      if (emit) {
        const at = new THREE.Vector3(L.x, L.y, L.z).add(ctx.head);
        if (L.arc) {
          // a swing round the effect's up axis, eased in and out (a loop swings once a second)
          const u = k || t % 1, e = u * u * (3 - 2 * u), a = ((-L.arc / 2 + L.arc * e) * Math.PI) / 180;
          at.x += Math.sin(a) * L.radius; at.z += Math.cos(a) * L.radius;
        }
        if (!points.length || points[0].pos.distanceToSquared(at) > 1e-6) points.unshift({ pos: at, age: 0 });
        if (points.length > M) points.length = M;
      }
      const n = points.length;
      for (let i = 0; i < n; i++) {
        const q = points[i];
        d.copy(points[Math.max(0, i - 1)].pos).sub(points[Math.min(n - 1, i + 1)].pos);
        for (let s = 0; s < 2; s++) {
          pos.setXYZ(i * 2 + s, q.pos.x, q.pos.y, q.pos.z);
          dirs.setXYZ(i * 2 + s, d.x, d.y, d.z);
          info.setXY(i * 2 + s, s ? 1 : -1, Math.min(1, q.age / L.life));
        }
      }
      geo.setDrawRange(0, n > 1 ? (n - 1) * 6 : 0);
      pos.needsUpdate = dirs.needsUpdate = info.needsUpdate = true;
    },
    reset() { points.length = 0; geo.setDrawRange(0, 0); },
    idle: () => points.length === 0,
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

// a ring is a particle layer that is born still, at the head, flat on the ground or facing the camera
const RING_FIXED = { shape: 'point', area: 0, areaH: 0, rate: 0, speed: 0, speedVary: 0, gravity: 0, drag: 0, wander: 0, windX: 0, windZ: 0, stretch: 0, hueVary: 0, lifeVary: 0, flicker: 0, floor: false };
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * A live effect from its data. `opts.groundAt(localPos)` gives the ground height under a point in the
 * effect's own space (default 0), for layers that stop at the ground.
 */
export function createEffect(THREE, def, opts = {}) {
  const root = new THREE.Group();
  root.name = def.name ?? 'effect';
  // the head is where layers are born, in the effect's own space: its origin, or flown by `travel` / `follow`
  const ctx = { groundAt: opts.groundAt ?? (() => 0), head: new THREE.Vector3() };
  const once = def.mode === 'once', layers = [];
  for (const raw of def.layers ?? []) {
    const L = raw.kind === 'ring' ? { ...LAYER_DEFAULTS.particles, ...LAYER_DEFAULTS.ring, ...raw, ...RING_FIXED } : { ...LAYER_DEFAULTS[raw.kind], ...raw };
    if (L.off) continue;
    const make = { sheet: sheetLayer, light: lightLayer, particles: particleLayer, ring: particleLayer, trail: trailLayer }[raw.kind];
    if (!make) continue;
    const made = make(THREE, L, ctx);
    root.add(made.object);
    layers.push({ made, L });
  }
  // a play-once effect lasts its `length`, or until its last layer's window closes
  const length = def.length > 0 ? def.length : Math.max(0.1, ...layers.map(({ L }) => L.start + L.duration));
  const tr = def.travel, v = new THREE.Vector3();
  let time = 0, playing = !once, stopped = false, follow = null, finish = null;
  const step = (dt) => {
    time += dt;
    if (follow) { follow.getWorldPosition(v); root.updateWorldMatrix(true, false); ctx.head.copy(root.worldToLocal(v)); }
    else if (once && tr) {
      const k = clamp01((time - tr.start) / Math.max(1e-3, tr.end - tr.start)), to = tr.to ?? [0, 0, 0];
      ctx.head.set(to[0] * k, (to[1] ?? 0) * k + (tr.arc ?? 0) * 4 * k * (1 - k), (to[2] ?? 0) * k);
    }
    for (const { made, L } of layers) {
      let emit = playing && !stopped, k = 0;
      if (once) {
        const end = L.duration > 0 ? L.start + L.duration : length;
        emit = emit && time >= L.start && time < end;
        k = clamp01((time - L.start) / Math.max(1e-3, end - L.start));
      }
      made.update(dt, time, emit, k);
    }
    if (finish && (stopped || (once && time >= length)) && layers.every(({ made }) => !made.idle || made.idle())) { playing = !once; finish(); finish = null; }
  };
  // warm up, so a placed waterfall is already falling and mist already hangs; a play-once effect waits for play()
  const warm = once ? 0 : opts.warm ?? 3;
  for (let s = 0; s < warm * 20; s++) step(0.05);
  if (once) step(0);
  const fx = {
    root,
    def,
    once,
    length,
    get time() { return time; },
    update(dt) { if (playing || finish) step(Math.min(dt, 0.1)); },
    /**
     * Play from the start (a looping effect just keeps going). `at` places the root (a Vector3 in its
     * parent's space); `follow` is an Object3D the head tracks each frame. The handle's `done` resolves
     * when a play-once effect has ended and its last particle faded, or after stop().
     */
    play({ at = null, follow: f = null } = {}) {
      finish?.();
      if (once) { for (const { made } of layers) made.reset?.(); time = 0; ctx.head.set(0, 0, 0); }
      playing = true; stopped = false; follow = f;
      if (at) root.position.copy(at);
      else if (f && root.parent) { f.getWorldPosition(v); root.position.copy(root.parent.worldToLocal(v)); }
      const done = new Promise((r) => (finish = r));
      return { done, stop() { stopped = true; } };
    },
    /** Jump to `t` seconds into a play-once effect (an editor's scrub), replaying it from the start. */
    seek(t) { fx.play({ follow }); while (time < t - 1e-6) step(Math.min(1 / 60, t - time)); },
    dispose() { finish?.(); for (const { made } of layers) made.dispose(); root.removeFromParent(); },
  };
  return fx;
}
