// The gameplay tables' records as field lists (validate.js), so the Codex page's forms and its first check share one
// description. `checkTables` in sim/systems/tables.js stays the authority: it also checks what one record names
// in another. Picker fields carry `pick`, which the page turns into a picker rather than a text box:
// item, loot, shop, ability, model, effect. MODIFIER stays in components.js.
import { validate as walk, defaults as fresh, num, int, str, pick, list, req } from './validate.js';
import { STATS, EQUIP_SLOTS, EQUIP_SETS } from '../../sim/systems/tables.js';

const ID = '^[A-Za-z0-9_-]{1,40}$';
const id = (d) => req(str('id', 'Id', d, { pattern: ID }));
const picked = (f, p) => ({ ...f, pick: p });

/** A modifier's fields with its stat a pick from what the sim reads, so no stat nothing reads can be typed. */
export const MODIFIER_FIELDS = [req(pick('stat', 'Stat', STATS, 'health')), req(pick('op', 'Operation', ['add', 'mul', 'set'], 'add')), req(num('value', 'Value', -1e9, 1e9, 0.01, 0)), num('duration', 'Lasts (s)', 0, 1e7, 0.1)];
const modifiers = (key, label) => list(key, label, { type: 'object', fields: MODIFIER_FIELDS }, { default: [] });

export const ABILITY = [
  id('ability'), req(str('name', 'Name', 'New ability')),
  req(num('range', 'Range (m)', 0, 500, 0.5, 2)), req(num('arc', 'Arc (degrees)', 0, 360, 5, 90)), req(num('cooldown', 'Cooldown (s)', 0, 600, 0.1, 1)),
  req(num('cost', 'Stamina cost', 0, 1000, 1, 10)), req(num('damage', 'Damage', 0, 1e6, 1, 10)),
  num('speed', 'Projectile speed (m/s)', 0.1, 500, 1),
  str('anim', 'Pose', 'cast'), picked(str('fx', 'Effect', ''), 'effect'),
  modifiers('effects', 'On a hit'),
];

export const EQUIP = [req(pick('slot', 'Slot', EQUIP_SLOTS, 'Top')), pick('set', 'Looks like set', EQUIP_SETS, 'Advanced'), modifiers('worn', 'While worn')];

export const ITEM = [
  id('item'), req(str('name', 'Name', 'New item')),
  req(int('stack', 'Stack', 1, 10000, 1)), picked(str('model', 'Drop model', ''), 'model'),
  modifiers('effects', 'On use'),
];

export const LOOT_ENTRY = [picked(str('item', 'Item', ''), 'item'), req(num('weight', 'Weight', 0, 1e6, 1, 1)), int('min', 'Least', 0, 10000, 1), int('max', 'Most', 0, 10000, 1)];
export const LOOT = [id('loot'), req(int('rolls', 'Rolls', 1, 100, 1)), list('entries', 'Entries', { type: 'object', fields: LOOT_ENTRY }, { default: [] })];

export const SHOP_ENTRY = [picked(req(str('item', 'Item', '')), 'item'), req(num('price', 'Price', 0, 1e9, 1, 1)), int('stock', 'Stock', 0, 1e6)];
export const SHOP = [id('shop'), req(str('name', 'Name', 'New shop')), picked(req(str('currency', 'Currency', '')), 'item'), list('entries', 'Entries', { type: 'object', fields: SHOP_ENTRY }, { default: [] })];

export const SCHEMAS = { ability: ABILITY, item: ITEM, loot: LOOT, shop: SHOP };
/** Problems with one record of a kind: [] or [{ path, message }]. */
export const validateRecord = (kind, r) => walk(SCHEMAS[kind], r);
export const recordDefaults = (kind) => fresh(SCHEMAS[kind]);
export const equipDefaults = () => fresh(EQUIP);

/** The percentage chance of each entry of a loot table in one roll, by its weight (0 when nothing has weight). */
export function lootChances(entries) {
  const total = (entries ?? []).reduce((s, e) => s + Math.max(0, e.weight ?? 0), 0);
  return (entries ?? []).map((e) => (total > 0 ? (Math.max(0, e.weight ?? 0) / total) * 100 : 0));
}

/** What uses a record: [`loot boar`, `template wolf`, ...]; a record's own kind and id. */
export function usedBy(kind, id, t) {
  const out = [];
  if (kind === 'item') {
    for (const l of t.loot ?? []) if (l.entries?.some((e) => e.item === id)) out.push(`loot ${l.id}`);
    for (const s of t.shops ?? []) if (s.currency === id || s.entries?.some((e) => e.item === id)) out.push(`shop ${s.id}`);
  }
  for (const r of t.templates ?? []) {
    const c = r.components ?? {};
    if ((kind === 'loot' && c.loot?.table === id) || (kind === 'shop' && c.shop?.table === id) || (kind === 'ability' && (c.hostile?.ability ?? 'strike') === id && c.hostile)) out.push(`template ${r.id}`);
  }
  return out;
}
