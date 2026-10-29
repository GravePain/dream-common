// What Dream Characters saves in a character's meta today (Characters/<name>.glb.meta.json), declared here
// so the sim and Dream World can read it; Dream Characters itself is not changed by this file.
import { validate as walk, defaults as fresh, str, list, obj, req } from './validate.js';

const ref = (key, label) => obj(key, label, [req({ key: 'place', label: 'Place (index or id)', type: 'any', default: 0 }), req(str('path', 'Path', ''))]);
const tint = { type: 'object', fields: [{ key: 'main', label: 'Main', type: 'color', nullable: true }, { key: 'detail', label: 'Detail', type: 'color', nullable: true }] };
const garment = { type: 'object', fields: [req(str('slot', 'Slot', 'Body')), req({ key: 'place', label: 'Place', type: 'any', default: 0 }), req(str('path', 'Path', '')), { ...tint, key: 'tint', label: 'Tint', nullable: true }] };

export const RECIPE = [
  req(ref('base', 'Base character')),
  req({ key: 'choice', label: 'Part per slot', type: 'map', values: { type: 'string' }, default: {} }),
  { key: 'tint', label: 'Tint per slot', type: 'map', values: tint, default: {} },
  { key: 'clip', label: 'Clip playing when saved', type: 'string', nullable: true },
  list('garments', 'Library garments worn', garment, { default: [] }),
];

export const SCHEMA = [
  req({ key: 'kind', label: 'Kind', type: 'enum', options: ['character'], default: 'character' }),
  str('rig', 'Rig (g6, quaternius)'),
  req(obj('recipe', 'Recipe', RECIPE)),
  list('clips', 'Clips in the GLB', { type: 'string' }, { default: [] }),
  { key: 'idle', label: 'Idle clip', type: 'string', nullable: true },
  { key: 'walk', label: 'Walk clip', type: 'string', nullable: true },
  list('garments', 'Garment paths', { type: 'string' }, { default: [] }),
];

export const validate = (m) => walk(SCHEMA, m);
export const defaults = () => fresh(SCHEMA);
