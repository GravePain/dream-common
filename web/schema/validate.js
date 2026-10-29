// The one walker for every Dream content schema (zone, cell, entity, components, character). A schema is
// data: a list of fields, each { key, label, type, ... }, read by validate() here, by defaults() for a new
// record, and by an inspector to draw its panel (label, range, step, options), as fx.js SCHEMA is.
//
// Field types:
//   number / int  { min?, max?, step?, default? }       string { default?, pattern? }
//   bool          { default? }                           color  '#rrggbb'
//   enum          { options: [...] }                     any    (not checked)
//   object        { fields: [...] }                      map    { values: <field> }   (keys are free)
//   array         { of: <field>, min?, max? }
// Every field may carry `required: true` (missing is an error) and `default` (what defaults() writes).
// `nullable: true` lets the value be null.

const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/** Problems with `value` against `field`, appended to `out` as { path, message }. */
function check(field, value, path, out) {
  if (value === null && field.nullable) return;
  const bad = (message) => out.push({ path: path || '(root)', message });
  switch (field.type) {
    case 'any': return;
    case 'number': case 'int':
      if (typeof value !== 'number' || !Number.isFinite(value)) return bad(`expected a number, got ${kindOf(value)}`);
      if (field.type === 'int' && !Number.isInteger(value)) return bad('expected a whole number');
      if (field.min !== undefined && value < field.min) return bad(`below ${field.min}`);
      if (field.max !== undefined && value > field.max) return bad(`above ${field.max}`);
      return;
    case 'string':
      if (typeof value !== 'string') return bad(`expected text, got ${kindOf(value)}`);
      if (field.pattern && !new RegExp(field.pattern).test(value)) return bad(`does not match ${field.pattern}`);
      return;
    case 'bool': if (typeof value !== 'boolean') bad(`expected true or false, got ${kindOf(value)}`); return;
    case 'color': if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) bad('expected a colour like #a8502a'); return;
    case 'enum': if (!field.options.includes(value)) bad(`expected one of ${field.options.join(', ')}`); return;
    case 'object':
      if (kindOf(value) !== 'object') return bad(`expected an object, got ${kindOf(value)}`);
      walk(field.fields, value, path, out);
      return;
    case 'map':
      if (kindOf(value) !== 'object') return bad(`expected an object, got ${kindOf(value)}`);
      for (const [k, v] of Object.entries(value)) check(typeof field.values === 'function' ? field.values(k) : field.values, v, `${path}.${k}`, out);
      return;
    case 'array':
      if (!Array.isArray(value)) return bad(`expected a list, got ${kindOf(value)}`);
      if (field.min !== undefined && value.length < field.min) bad(`needs at least ${field.min}`);
      if (field.max !== undefined && value.length > field.max) bad(`at most ${field.max}`);
      value.forEach((v, i) => check(field.of, v, `${path}[${i}]`, out));
      return;
    default: bad(`unknown field type ${field.type}`);
  }
}

/** Checks the fields of one object level; unknown keys are allowed (a newer tool may add them). */
function walk(fields, obj, path, out) {
  for (const f of fields) {
    const p = path ? `${path}.${f.key}` : f.key;
    if (obj[f.key] === undefined) { if (f.required) out.push({ path: p, message: 'missing' }); continue; }
    check(f, obj[f.key], p, out);
  }
}

/** [] when `obj` fits the field list, else every problem as { path, message }. */
export function validate(fields, obj) {
  const out = [];
  if (kindOf(obj) !== 'object') return [{ path: '(root)', message: `expected an object, got ${kindOf(obj)}` }];
  walk(fields, obj, '', out);
  return out;
}

/** A fresh value for one field: its default, or the smallest valid thing of its type. */
export function defaultOf(field) {
  if (field.default !== undefined) return structuredClone(field.default);
  switch (field.type) {
    case 'number': case 'int': return field.min !== undefined && field.min > 0 ? field.min : 0;
    case 'string': return '';
    case 'bool': return false;
    case 'color': return '#ffffff';
    case 'enum': return field.options[0];
    case 'object': return defaults(field.fields);
    case 'map': return {};
    case 'array': return [];
    default: return null;
  }
}

/** A new record: every required field and every field with a default. */
export function defaults(fields) {
  const o = {};
  for (const f of fields) if (f.required || f.default !== undefined) o[f.key] = defaultOf(f);
  return o;
}

// small builders so the schemas read as tables
export const num = (key, label, min, max, step, def, more = {}) => ({ key, label, type: 'number', min, max, step, ...(def !== undefined ? { default: def } : {}), ...more });
export const int = (key, label, min, max, def, more = {}) => ({ key, label, type: 'int', min, max, step: 1, ...(def !== undefined ? { default: def } : {}), ...more });
export const str = (key, label, def, more = {}) => ({ key, label, type: 'string', ...(def !== undefined ? { default: def } : {}), ...more });
export const bool = (key, label, def, more = {}) => ({ key, label, type: 'bool', ...(def !== undefined ? { default: def } : {}), ...more });
export const pick = (key, label, options, def = options[0], more = {}) => ({ key, label, type: 'enum', options, default: def, ...more });
export const obj = (key, label, fields, more = {}) => ({ key, label, type: 'object', fields, ...more });
export const list = (key, label, of, more = {}) => ({ key, label, type: 'array', of, ...more });
export const req = (f) => ({ ...f, required: true });
