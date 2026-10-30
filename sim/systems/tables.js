// The gameplay tables (docs/tables.md): abilities, items and loot, as the Library keeps them in
// `Tables/abilities.json`, `Tables/items.json` and `Tables/loot/<table>.json`. A sim takes them as data
// (`createSim({ tables })`); these defaults are the same records, so a sim made without tables (tests, a
// local Play with no Library tables) still has strike, bolt, the potion and the chest's table.
//
//   ability { id, name, range, arc (degrees), cooldown (s), cost (stamina), damage, effects: [MODIFIER],
//             anim, fx, speed? (m/s: a projectile, its hit delayed by distance / speed) }
//   item    { id, name, stack, effects: [MODIFIER], model ("place|path") }
//   loot    { id, rolls, entries: [{ item, weight, min, max }] }   one weighted pick per roll; item "" is nothing

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
};

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const MODS = ['add', 'mul', 'set'];
const okMod = (m) => m && typeof m.stat === 'string' && MODS.includes(m.op) && finite(m.value) && (m.duration === undefined || (finite(m.duration) && m.duration >= 0));

/** Problems with a tables object ([] when good): each record named, so a bad table file says which. */
export function checkTables(t) {
  const out = [];
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
  }
  const items = new Set((t.items ?? []).map((i) => i.id));
  for (const l of t.loot ?? []) {
    if (typeof l.id !== 'string' || !l.id) out.push('loot: no id');
    for (const e of l.entries ?? []) if (e.item && !items.has(e.item)) out.push(`loot ${l.id}: no item ${e.item}`);
    if (!(l.entries ?? []).every((e) => finite(e.weight) && e.weight >= 0)) out.push(`loot ${l.id}: weights must be numbers of 0 or more`);
  }
  return out;
}

/** Tables as maps by id, over the defaults (a given table replaces the default of the same id). */
export function tablesOf(t = {}) {
  const by = (def, got) => new Map([...(def ?? []), ...(got ?? [])].map((r) => [r.id, r]));
  return { abilities: by(DEFAULT_TABLES.abilities, t.abilities), items: by(DEFAULT_TABLES.items, t.items), loot: by(DEFAULT_TABLES.loot, t.loot) };
}
