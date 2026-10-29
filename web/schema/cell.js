// A cell: the entities of one 50 m square of a zone, "cells/x<i>z<j>.json" beside the zone's zone.json.
// Cell x0z0 is the zone's corner at (-size/2, -size/2); an entity lives in the cell its x, z falls in.
import { validate as walk, defaults as fresh, int, str, list, req } from './validate.js';
import { SCHEMA as ENTITY } from './entity.js';

export const SCHEMA = [
  req({ key: 'format', label: 'Format', type: 'enum', options: ['dream-cell'], default: 'dream-cell' }),
  req({ key: 'version', label: 'Version', type: 'int', min: 1, max: 1, default: 1 }),
  req(str('zone', 'Zone id', 'zone')),
  req(int('x', 'Cell column', 0, 1000, 0)),
  req(int('z', 'Cell row', 0, 1000, 0)),
  req(list('entities', 'Entities', { type: 'object', fields: ENTITY }, { default: [] })),
];

export const validate = (c) => walk(SCHEMA, c);
export const defaults = () => fresh(SCHEMA);
