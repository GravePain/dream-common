// Entity components: what an entity is made of besides its transform. Each is a field list (see
// validate.js); an entity's `components` is { <name>: {...} }. Item, ability and quest records are not here:
// they come with Dream Codex and Dream Story.
import { validate as walk, defaults as fresh, num, int, str, bool, pick, obj, list, req } from './validate.js';

const point = (key, label) => obj(key, label, [num('x', 'X', -10000, 10000, 0.1, 0), num('z', 'Z', -10000, 10000, 0.1, 0)], { default: { x: 0, z: 0 } });

export const COMPONENTS = {
  /** A library model drawn at the entity's transform. `yOffset` lifts it off the ground (Dream World's Placed). */
  model: [req(str('place', 'Library place', '0')), req(str('path', 'Model path', '')), num('yOffset', 'Lift above ground', -50, 50, 0.01, 0)],
  /** Where players or a group of things appear. */
  spawn: [str('group', 'Spawn group', 'player'), int('count', 'How many', 1, 100, 1), num('radius', 'Spread', 0, 100, 0.5, 0)],
  /** How a creature or person moves on its own. */
  npc: [req(pick('mode', 'Behaviour', ['stationary', 'patrol', 'wander', 'follow', 'flee'], 'stationary')), point('home', 'Home'), num('radius', 'Range', 0, 500, 0.5, 14), num('speed', 'Speed', 0, 20, 0.1, 1), list('points', 'Patrol points', { type: 'object', fields: [num('x', 'X', -10000, 10000, 0.1, 0), num('z', 'Z', -10000, 10000, 0.1, 0)] }, { default: [] })],
  /** Its solid shape for the sim; `size` is x, y, z in metres (a sphere uses x as its radius; capsule and cylinder
   *  are max(x, z) wide and y tall). sim/colliders.js reads it. */
  collider: [req(pick('shape', 'Shape', ['box', 'sphere', 'capsule', 'cylinder'], 'box')), obj('size', 'Size', [num('x', 'X', 0, 500, 0.05, 1), num('y', 'Y', 0, 500, 0.05, 1), num('z', 'Z', 0, 500, 0.05, 1)], { default: { x: 1, y: 1, z: 1 } }), bool('trigger', 'Trigger only', false)],
  /** Something a player can use. */
  interact: [req(str('verb', 'Verb', 'use')), num('range', 'Range', 0, 20, 0.1, 2)],
  loot: [req(str('table', 'Loot table', ''))],
  shop: [req(str('table', 'Shop table', ''))],
  /** A way to another zone (or a cell of this one). */
  portal: [req(str('zone', 'To zone', '')), str('cell', 'Cell', 'x0z0'), num('x', 'Arrive at X', -10000, 10000, 0.1, 0), num('z', 'Arrive at Z', -10000, 10000, 0.1, 0)],
  light: [{ key: 'color', label: 'Colour', type: 'color', default: '#ffd9a0' }, num('intensity', 'Intensity', 0, 100, 0.1, 1), num('range', 'Range', 0, 200, 0.5, 8)],
  /**
   * An effect: a Dream World built-in (`type`, e.g. "smoke") or a library one (`path`, "place|path"), with
   * its radius. The fields are Dream World's EffectSave beyond the transform.
   */
  fx: [req(str('type', 'Effect', 'library')), str('path', 'Library effect'), num('radius', 'Radius', 0, 200, 0.1, 3)],
  /** A Dream World animal: which one (`defId`) and the home it wanders round (AnimalSave). */
  animal: [req(str('defId', 'Animal', '')), point('home', 'Home')],
};

/** A generic stat change for items and buffs later: { stat, op, value, duration? } (seconds; missing = lasts). */
export const MODIFIER = [req(str('stat', 'Stat', '')), req(pick('op', 'Operation', ['add', 'mul', 'set'], 'add')), req(num('value', 'Value', -1e9, 1e9, 0.01, 0)), num('duration', 'Lasts (s)', 0, 1e7, 0.1)];

/** The components field of an entity or template, as one field for the walker. Unknown names are allowed (later tools). */
export const SCHEMA = { key: 'components', label: 'Components', type: 'map', values: (name) => (COMPONENTS[name] ? { type: 'object', fields: COMPONENTS[name] } : { type: 'object', fields: [] }) };

/** Problems with one component, or [] (an unknown name is a problem here, where the name was asked for). */
export function validateComponent(name, value) {
  if (!COMPONENTS[name]) return [{ path: name, message: 'unknown component' }];
  return walk(COMPONENTS[name], value).map((p) => ({ ...p, path: `${name}.${p.path}` }));
}
/** Problems with a whole components object. */
export const validate = (components) => walk([SCHEMA], { components }).map((p) => ({ ...p, path: p.path.replace(/^components\.?/, '') || '(root)' }));
export const defaults = (name) => (name ? fresh(COMPONENTS[name]) : {});
export const validateModifier = (m) => walk(MODIFIER, m);
export const modifierDefaults = () => fresh(MODIFIER);
