// A zone: one Dream World map. Its terrain is one record here (base64, as in .scene.json); its entities are
// split into fixed 50 m cells, listed by name ("x0z0") and saved beside it as cells/<name>.json.
import { validate as walk, defaults as fresh, num, int, str, list, obj, req } from './validate.js';

export const CELL = 50; // metres: divides every Dream World map size (100, 200, 400)

export const TERRAIN = [
  req(int('res', 'Vertices per side', 2, 4097, 129)),
  req(str('heights', 'Heights (base64 Float32)', '')),
  req(str('splat', 'Ground weights (base64)', '')),
  list('slots', 'Ground textures', { type: 'string', nullable: true }, { default: [] }),
  num('waterLevel', 'Water level', -100, 100, 0.01, -0.6),
];

export const SCHEMA = [
  req({ key: 'format', label: 'Format', type: 'enum', options: ['dream-zone'], default: 'dream-zone' }),
  req({ key: 'version', label: 'Version', type: 'int', min: 1, max: 1, default: 1 }),
  req(str('id', 'Id', 'zone', { pattern: '^[\\w .-]+$' })),
  req(str('name', 'Name', 'Zone')),
  req(int('size', 'Size (m)', CELL, 4000, 200)),
  req(int('cell', 'Cell size (m)', CELL, CELL, CELL)),
  req(obj('terrain', 'Terrain', TERRAIN)),
  { key: 'sky', label: 'Sky (Dream World day and night)', type: 'any' },
  req(list('cells', 'Cells', { type: 'string', pattern: '^x\\d+z\\d+$' }, { default: [] })),
];

/** The field checks, plus the one rule they cannot say: the size is a whole number of cells. */
export function validate(z) {
  const out = walk(SCHEMA, z);
  if (typeof z?.size === 'number' && z.size % CELL) out.push({ path: 'size', message: `not a multiple of ${CELL}` });
  return out;
}
export const defaults = () => fresh(SCHEMA);
