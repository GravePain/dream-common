// The gameplay tables (docs/tables.md): abilities, items, loot and shops, as the Library keeps them in
// `Tables/abilities.json`, `Tables/items.json`, `Tables/loot/<id>.json` and `Tables/shops/<id>.json`. A sim takes
// them as data (`createSim({ tables })`); these defaults are the same records, so a sim made without tables
// (tests, a Library with no tables yet) still has strike, bolt, the potion and the chest's table.
//
//   ability { id, name, range, arc (degrees), cooldown (s), cost (stamina), damage, effects: [MODIFIER],
//             anim, fx, speed? (m/s: a projectile, its hit delayed by distance / speed) }
//   item    { id, name, stack, effects: [MODIFIER], model ("place|path"), equip?: { slot, set, worn: [MODIFIER] } }
//   loot    { id, rolls, entries: [{ item, weight, min, max }] }   one weighted pick per roll; item "" is nothing
//   shop    { id, name, currency (an item id), entries: [{ item, price, stock? }] }
// A template (web/schema/entity.js) is checked here too, for what it names: its loot table, shop and ability.
// No imports: Dream Library's Codex page runs this file in the browser, so its check is the server's check.

export const DEFAULT_TABLES = {
  abilities: [
    { id: 'strike', name: 'Strike', range: 2, arc: 90, cooldown: 1, cost: 10, damage: 18, effects: [], anim: 'cast', fx: '' },
    { id: 'bolt', name: 'Bolt', range: 15, arc: 60, cooldown: 0.8, cost: 15, damage: 12, speed: 20, effects: [{ stat: 'speed', op: 'mul', value: 0.7, duration: 2 }], anim: 'cast', fx: '' },
  ],
  items: [
    { id: 'potion', name: 'Healing potion', stack: 5, effects: [{ stat: 'health', op: 'add', value: 40 }], model: '6|Fantasy Props MegaKit/Potion_1.glb' },
    { id: 'swift', name: 'Swift draught', stack: 5, effects: [{ stat: 'speed', op: 'mul', value: 1.5, duration: 10 }], model: '6|Fantasy Props MegaKit/Potion_2.glb' },
  ],
  loot: [
    { id: 'chest', rolls: 2, entries: [{ item: 'potion', weight: 3, min: 1, max: 2 }, { item: 'swift', weight: 1, min: 1, max: 1 }] },
    { id: 'boar', rolls: 1, entries: [{ item: 'potion', weight: 2, min: 1, max: 1 }, { item: 'swift', weight: 1, min: 1, max: 1 }, { item: '', weight: 1, min: 0, max: 0 }] },
  ],
  shops: [],
};

/** The stats a modifier can name: what systems/stats.js reads. Not a table yet (docs/tables.md). */
export const STATS = ['health', 'maxHealth', 'stamina', 'maxStamina', 'speed'];
/** The stats a worn item can hold: health and stamina pools change at once, so they are for effects, not gear. */
export const WORN_STATS = ['maxHealth', 'maxStamina', 'speed'];
/** The equipment slots, in Dream Characters' order. */
export const EQUIP_SLOTS = ['Head', 'Shoulders', 'Top', 'Gloves', 'Belt', 'Pants', 'Boots', 'Cape'];
/** The Ida Faber sets a worn item can look like (Dream Characters). */
export const EQUIP_SETS = ['Advanced', 'Champion', 'Newbie'];

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const MODS = ['add', 'mul', 'set'];
const okMod = (m) => m && STATS.includes(m.stat) && MODS.includes(m.op) && finite(m.value) && (m.duration === undefined || (finite(m.duration) && m.duration >= 0));
const okWorn = (m) => okMod(m) && WORN_STATS.includes(m.stat) && m.duration === undefined;

/** Problems with a tables object ([] when good): each record named, so a bad table file says which. */
export function checkTables(t) {
  const out = [];
  const unique = (list, what) => { const seen = new Set(); for (const r of list ?? []) { if (seen.has(r.id)) out.push(`${what} ${r.id}: the id is used twice`); seen.add(r.id); } };
  unique(t.abilities, 'ability'); unique(t.items, 'item'); unique(t.loot, 'loot'); unique(t.shops, 'shop'); unique(t.templates, 'template');
  for (const a of t.abilities ?? []) {
    if (typeof a.id !== 'string' || !a.id) out.push('ability: no id');
    for (const k of ['range', 'arc', 'cooldown', 'cost', 'damage']) if (!finite(a[k]) || a[k] < 0) out.push(`ability ${a.id}: ${k} must be a number of 0 or more`);
    if (a.speed !== undefined && (!finite(a.speed) || a.speed <= 0)) out.push(`ability ${a.id}: speed must be over 0`);
    if (!(a.effects ?? []).every(okMod)) out.push(`ability ${a.id}: a bad effect`);
  }
  for (const i of t.items ?? []) {
    if (typeof i.id !== 'string' || !i.id) out.push('item: no id');
    if (!Number.isInteger(i.stack) || i.stack < 1) out.push(`item ${i.id}: stack must be a whole number of 1 or more`);
    if (!(i.effects ?? []).every(okMod)) out.push(`item ${i.id}: a bad effect`);
    if (i.equip) {
      if (!EQUIP_SLOTS.includes(i.equip.slot)) out.push(`item ${i.id}: no equipment slot ${i.equip.slot}`);
      if (i.equip.set && !EQUIP_SETS.includes(i.equip.set)) out.push(`item ${i.id}: no set ${i.equip.set}`);
      if (!(i.equip.worn ?? []).every(okWorn)) out.push(`item ${i.id}: a worn effect must be max health, max stamina or speed, and lasts while worn`);
    }
  }
  const has = tablesOf(t);
  for (const l of t.loot ?? []) {
    if (typeof l.id !== 'string' || !l.id) out.push('loot: no id');
    for (const e of l.entries ?? []) if (e.item && !has.items.has(e.item)) out.push(`loot ${l.id}: no item ${e.item}`);
    if (!(l.entries ?? []).every((e) => finite(e.weight) && e.weight >= 0)) out.push(`loot ${l.id}: weights must be numbers of 0 or more`);
  }
  for (const s of t.shops ?? []) {
    if (typeof s.id !== 'string' || !s.id) out.push('shop: no id');
    if (!has.items.has(s.currency)) out.push(`shop ${s.id}: no currency item ${s.currency}`);
    for (const e of s.entries ?? []) {
      if (!has.items.has(e.item)) out.push(`shop ${s.id}: no item ${e.item}`);
      if (!finite(e.price) || e.price < 0) out.push(`shop ${s.id}: a price must be a number of 0 or more`);
      if (e.stock !== undefined && (!Number.isInteger(e.stock) || e.stock < 0)) out.push(`shop ${s.id}: stock must be a whole number of 0 or more`);
    }
  }
  for (const r of t.templates ?? []) {
    const c = r.components ?? {};
    if (typeof r.id !== 'string' || !r.id) out.push('template: no id');
    if (!c.model?.path) out.push(`template ${r.id}: no model`);
    if (c.loot && !has.loot.has(c.loot.table)) out.push(`template ${r.id}: no loot table ${c.loot.table}`);
    if (c.shop && !has.shops.has(c.shop.table)) out.push(`template ${r.id}: no shop ${c.shop.table}`);
    if (c.hostile && !has.abilities.has(c.hostile.ability ?? 'strike')) out.push(`template ${r.id}: no ability ${c.hostile.ability ?? 'strike'}`);
  }
  return out;
}

/** Tables as maps by id: a table given is the whole table, so a record deleted from it stays gone; one not given is the default's. */
export function tablesOf(t = {}) {
  const by = (def, got) => new Map((got ?? def ?? []).map((r) => [r.id, r]));
  return { abilities: by(DEFAULT_TABLES.abilities, t.abilities), items: by(DEFAULT_TABLES.items, t.items), loot: by(DEFAULT_TABLES.loot, t.loot), shops: by(DEFAULT_TABLES.shops, t.shops) };
}

/** The reader `readTables` wants, over the Library's HTTP API at `base` ("/dl"): place 0's files. */
export function tableReader(base, fetchImpl = globalThis.fetch) {
  return {
    async table(path) {
      const r = await fetchImpl(`${base}/api/file?place=0&path=${encodeURIComponent(path)}`);
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    },
    async tableList(prefix) {
      const r = await fetchImpl(`${base}/api/list?place=0`);
      if (!r.ok) return [];
      const items = await r.json();
      return (Array.isArray(items) ? items : items.items ?? []).map((it) => it.path).filter((p) => p.startsWith(prefix) && p.endsWith('.json') && !p.endsWith('.meta.json')).sort();
    },
  };
}

/**
 * Read every table and template through `library` ({ table(path), tableList(prefix) }; the Dream Server's, Play's
 * and the Codex's own); {} when there are none or they fail the check, said once through `log`. Never throws.
 * `raw` hands back what was read even when it fails: publish checks it and names each bad record.
 */
export async function readTables(library, log = () => {}, { raw = false } = {}) {
  if (!library?.table) return {};
  const t = {};
  const one = async (path) => { try { return await library.table(path); } catch { return null; } };
  const files = async (prefix) => {
    const out = [];
    for (const path of (await library.tableList?.(prefix).catch(() => [])) ?? []) { const r = await one(path); if (r?.id) out.push(r); }
    return out;
  };
  const ab = await one('Tables/abilities.json'), it = await one('Tables/items.json');
  if (Array.isArray(ab?.records)) t.abilities = ab.records;
  if (Array.isArray(it?.records)) t.items = it.records;
  // with the Library's own tables, a folder with nothing left in it is an empty table, not the defaults
  const loot = await files('Tables/loot/'), shops = await files('Tables/shops/'), templates = await files('Templates/');
  if (loot.length || t.abilities || t.items) t.loot = loot;
  if (shops.length) t.shops = shops;
  if (templates.length) t.templates = templates;
  if (raw) return t;
  const bad = checkTables(t);
  if (bad.length) { log(`Tables: ${bad.join('; ')} (the built-in tables are used instead)`); return {}; }
  return t;
}
