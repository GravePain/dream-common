// An entity: a template id plus components, at a transform. `parent` is another entity's uid in the same
// cell; a child keeps its own world transform in the file, so a cell loads without its parent.
// A template ("<id>.template.json", later) is { format: "dream-template", version: 1, id, name, components };
// an entity's components override its template's, key by key.
import { validate as walk, defaults as fresh, num, str, obj, req } from './validate.js';
import { SCHEMA as COMPONENTS } from './components.js';

const ANGLE = Math.PI * 2;
export const TRANSFORM = [
  num('x', 'X', -10000, 10000, 0.01, 0), num('y', 'Height above ground', -1000, 1000, 0.01, 0), num('z', 'Z', -10000, 10000, 0.01, 0),
  num('rotX', 'Tilt X', -ANGLE, ANGLE, 0.01, 0), num('rotY', 'Turn', -ANGLE * 8, ANGLE * 8, 0.01, 0), num('rotZ', 'Tilt Z', -ANGLE, ANGLE, 0.01, 0),
  num('scale', 'Scale', 0.001, 1000, 0.01, 1),
];

/** uid: unique in its zone (converted scenes use "o12", "a3", "e5" for objects, animals and effects). */
export const SCHEMA = [
  req(str('uid', 'Id', 'e1', { pattern: '^[\\w.-]+$' })),
  req(str('template', 'Template', '')),
  str('name', 'Name'),
  str('parent', 'Parent'),
  req(obj('transform', 'Transform', TRANSFORM)),
  req({ ...COMPONENTS, default: {} }),
];

export const TEMPLATE = [
  req({ key: 'format', label: 'Format', type: 'enum', options: ['dream-template'], default: 'dream-template' }),
  req({ key: 'version', label: 'Version', type: 'int', min: 1, max: 1, default: 1 }),
  req(str('id', 'Id', 'template')),
  str('name', 'Name'),
  req({ ...COMPONENTS, default: {} }),
];

export const validate = (e) => walk(SCHEMA, e);
export const defaults = () => fresh(SCHEMA);
export const validateTemplate = (t) => walk(TEMPLATE, t);
export const templateDefaults = () => fresh(TEMPLATE);

/** An entity's components with its template's underneath: the entity's own win, key by key. */
export function resolve(entity, template) {
  const out = structuredClone(template?.components ?? {});
  for (const [k, v] of Object.entries(entity.components ?? {})) out[k] = { ...(out[k] ?? {}), ...v };
  return out;
}
