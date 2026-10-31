// Items (step 10): inventories, loot tables, drops and pickups, against `Tables/items.json` and
// `Tables/loot/<table>.json`.
//
// - A player carries `inventory { size, slots: [{ item, count } | null] }` (12 slots; a join may bring a saved
//   one: player scope, saved with the record). `inventory { uid, size, slots }` is emitted on every change.
// - `pickup { uid }` takes a drop (an entity with a `pickup { item, count }` component) within PICKUP m: all of
//   it or nothing (`itemResult { ok: false, reason: 'full' }`); vetoable through the `pickup` event.
// - `use { slot }` applies the item's effects as modifiers (stats.js) and spends one; `drop { slot }` puts the
//   whole stack on the ground at the feet.
// - Equipment: an item with `equip { slot, set, worn }` goes on with `equip { slot }` (or `use`), one of its stack,
//   into `inventory.worn { <slot name>: item id }`, swapping what was there; `worn` holds as modifiers until
//   `unequip { wear }` puts it back in the bag. It stays on through a death and is saved with the inventory.
// - An item the tables no longer have (a promote took it out) stays where it is, doing nothing: it can be dropped
//   or taken off, not used, and it means something again if a later promote brings the record back.
// - Loot: an entity with `loot { table }` rolls its table when it dies (`death`) and when it is opened or used
//   (`interact`, then again only after its `spawn.respawn` seconds, else 60); each roll is one weighted pick
//   with the sim's `random`. Drops are entities with `model` and `pickup`; they go after DROP_LIFE s.
import { TICK, MOVE } from '../tick.js';
import { applyModifier } from './stats.js';

export const SLOTS = 12;
export const PICKUP = 2;       // m from the player's capsule
export const DROP_LIFE = 120;  // s a drop lies before it goes
const REARM = 60;              // s before a chest gives loot again

const refOf = (model) => { const s = String(model ?? ''), i = s.indexOf('|'); return i > 0 ? { place: s.slice(0, i), path: s.slice(i + 1) } : null; };

/** A clean inventory: `size` slots, each { item, count } or null; bad counts dropped, an item no longer in the tables kept. */
export function cleanInventory(inv, items) {
  const size = Number.isInteger(inv?.size) && inv.size > 0 && inv.size <= 64 ? inv.size : SLOTS;
  const slots = Array.from({ length: size }, (_, k) => {
    const s = inv?.slots?.[k], def = s && items.get(s.item);
    return s && typeof s.item === 'string' && s.item && Number.isInteger(s.count) && s.count > 0 ? { item: s.item, count: def ? Math.min(s.count, def.stack) : s.count } : null;
  });
  const worn = Object.fromEntries(Object.entries(inv?.worn ?? {}).filter(([k, id]) => typeof id === 'string' && (!items.has(id) || items.get(id).equip?.slot === k)));
  return { size, slots, worn };
}

/** Put on or take off what an item holds while worn. */
function wearMods(e, wear, def, on) {
  e.mods = e.mods?.filter((m) => m.worn !== wear) ?? [];
  if (on) for (const m of def?.equip?.worn ?? []) e.mods.push({ stat: m.stat, op: m.op, value: m.value, until: Infinity, worn: wear });
}

/** Wear the item in bag slot `k`, swapping what its equipment slot holds. A reason when it cannot, else null. */
function equip(sim, e, k) {
  const s = e.inventory.slots[k], def = s && sim.tables.items.get(s.item), wear = def?.equip?.slot;
  if (!wear) return 'not wearable';
  const was = e.inventory.worn[wear];
  // a swap needs room for what comes off once this one has left the bag
  if (--s.count <= 0) e.inventory.slots[k] = null;
  if (was && !addItem(e.inventory, sim.tables.items, was, 1)) {
    if (!e.inventory.slots[k]) e.inventory.slots[k] = s;
    s.count++;
    return 'full';
  }
  e.inventory.worn[wear] = s.item;
  wearMods(e, wear, def, true);
  return null;
}

/** Put `count` of `item` in: stacks first, then empty slots. All or nothing; true when it fitted. */
export function addItem(inv, items, item, count) {
  // an item no longer in the tables goes in a slot of its own
  const def = items.get(item) ?? { stack: 1 };
  if (count < 1) return false;
  let room = 0;
  for (const s of inv.slots) room += !s ? def.stack : s.item === item ? def.stack - s.count : 0;
  if (room < count) return false;
  let left = count;
  for (const s of inv.slots) if (s && s.item === item && left) { const k = Math.min(left, def.stack - s.count); s.count += k; left -= k; }
  for (let i = 0; i < inv.slots.length && left; i++) if (!inv.slots[i]) { const k = Math.min(left, def.stack); inv.slots[i] = { item, count: k }; left -= k; }
  return true;
}

/** Roll a loot table: [{ item, count }] (an "" item or a 0 count is nothing). */
export function rollLoot(sim, table) {
  const out = [];
  const entries = (table?.entries ?? []).filter((e) => e.weight > 0), total = entries.reduce((s, e) => s + e.weight, 0);
  for (let r = 0; r < (table?.rolls ?? 1) && total > 0; r++) {
    let pick = sim.random() * total, e = entries[entries.length - 1];
    for (const x of entries) { if ((pick -= x.weight) < 0) { e = x; break; } }
    const min = e.min ?? 1, max = Math.max(min, e.max ?? min), n = min + Math.floor(sim.random() * (max - min + 1));
    if (e.item && n > 0) out.push({ item: e.item, count: n });
  }
  return out;
}

/** A drop on the ground: an entity with the item's model and a pickup. Returns it. */
export function spawnDrop(sim, item, count, x, z) {
  const def = sim.tables.items.get(item), uid = `d${++sim.dropSeq}`, ref = refOf(def?.model);
  const e = sim.world.addEntity({ uid, template: `item:${item}`, transform: { x, z }, components: { ...(ref ? { model: ref } : {}), pickup: { item, count } } }, { kind: 'drop', expires: sim.tick + Math.round(DROP_LIFE / TICK) });
  sim.drops.set(uid, e);
  sim.fire('drop', { tick: sim.tick, uid, item, count, model: def?.model ?? '', x: e.x, z: e.z });
  return e;
}

function dropLoot(sim, e) {
  const table = sim.tables.loot.get(e.components.loot?.table);
  if (!table) return;
  for (const { item, count } of rollLoot(sim, table)) {
    const a = sim.random() * Math.PI * 2, r = 0.6 + sim.random() * 0.6;
    spawnDrop(sim, item, count, e.x + Math.cos(a) * r, e.z + Math.sin(a) * r);
  }
}

/** The GM's hand: give `count` of an item in the tables; false when it is not one or the bag has no room. */
export function giveItem(sim, e, item, count) {
  if (!sim.tables.items.has(item) || !addItem(e.inventory, sim.tables.items, item, count)) return false;
  told(sim, e);
  return true;
}

/** The GM's hand: take up to `count` of an item from the bag; how many went. */
export function takeItem(sim, e, item, count) {
  let left = count;
  e.inventory.slots.forEach((s, k) => {
    if (!s || s.item !== item || !left) return;
    const n = Math.min(left, s.count);
    s.count -= n; left -= n;
    if (!s.count) e.inventory.slots[k] = null;
  });
  if (left < count) told(sim, e);
  return count - left;
}

const told = (sim, e) => sim.emit('inventory', { tick: sim.tick, uid: e.uid, size: e.inventory.size, slots: e.inventory.slots.map((s) => (s ? { ...s } : null)), worn: { ...e.inventory.worn } });
const result = (sim, e, action, ok, reason, more = {}) => sim.emit('itemResult', { tick: sim.tick, uid: e.uid, action, ok, reason, ...more });

function removeDrop(sim, uid, why) {
  const d = sim.drops.get(uid);
  if (!d) return;
  sim.drops.delete(uid);
  sim.world.removeEntity(uid);
  sim.emit('despawn', { tick: sim.tick, uid, why, x: d.x, z: d.z, respawn: null });
}

export const itemsSystem = {
  name: 'items',
  components: ['inventory', 'pickup', 'loot'],
  init(sim) { sim.drops = new Map(); sim.dropSeq = 0; },
  onJoin(sim, e, join) {
    if (e.kind !== 'player') return;
    e.inventory = cleanInventory(join?.inventory, sim.tables.items);
    for (const [wear, id] of Object.entries(e.inventory.worn)) wearMods(e, wear, sim.tables.items.get(id), true);
    told(sim, e);
  },
  onTick(sim) {
    for (const [uid, d] of sim.drops) if (d.expires <= sim.tick) removeDrop(sim, uid, 'expired');
  },
  onIntent(sim, e, i) {
    if (i.type === 'pickup') {
      const t = sim.drops.get(i.uid), p = t?.components.pickup;
      if (!t || !p) { result(sim, e, 'pickup', false, 'missing', { target: i.uid }); return true; }
      if (e.dead) { result(sim, e, 'pickup', false, 'dead', { target: i.uid }); return true; }
      if (Math.hypot(t.x - e.x, t.z - e.z) > PICKUP + MOVE.radius) { result(sim, e, 'pickup', false, 'out of range', { target: i.uid }); return true; }
      const ev = { tick: sim.tick, uid: e.uid, target: i.uid, item: p.item, count: p.count };
      if (!sim.gate('pickup', ev)) { result(sim, e, 'pickup', false, 'refused', { target: i.uid }); return true; }
      if (!addItem(e.inventory, sim.tables.items, p.item, p.count)) { result(sim, e, 'pickup', false, 'full', { target: i.uid }); return true; }
      removeDrop(sim, i.uid, 'picked up');
      sim.done('pickup', ev);
      result(sim, e, 'pickup', true, null, { target: i.uid, item: p.item, count: p.count });
      told(sim, e);
      return true;
    }
    if (i.type === 'unequip') {
      const id = e.inventory?.worn[i.wear];
      if (!id) { result(sim, e, 'unequip', false, 'nothing worn', { wear: i.wear }); return true; }
      if (e.dead) { result(sim, e, 'unequip', false, 'dead', { wear: i.wear }); return true; }
      if (!addItem(e.inventory, sim.tables.items, id, 1)) { result(sim, e, 'unequip', false, 'full', { wear: i.wear }); return true; }
      delete e.inventory.worn[i.wear];
      wearMods(e, i.wear, sim.tables.items.get(id), false);
      result(sim, e, 'unequip', true, null, { wear: i.wear, item: id });
      told(sim, e);
      return true;
    }
    if (i.type === 'use' || i.type === 'drop' || i.type === 'equip') {
      const s = e.inventory?.slots[i.slot];
      if (!s) { result(sim, e, i.type, false, 'empty slot', { slot: i.slot }); return true; }
      if (e.dead) { result(sim, e, i.type, false, 'dead', { slot: i.slot }); return true; }
      const def = sim.tables.items.get(s.item);
      if (i.type === 'equip' || (i.type === 'use' && def?.equip)) {
        const no = equip(sim, e, i.slot);
        if (no) { result(sim, e, 'equip', false, no, { slot: i.slot }); return true; }
        result(sim, e, 'equip', true, null, { slot: i.slot, item: s.item });
        told(sim, e);
        return true;
      }
      if (i.type === 'use' && !def) { result(sim, e, 'use', false, 'no longer exists', { slot: i.slot }); return true; }
      if (i.type === 'use') {
        for (const m of def?.effects ?? []) applyModifier(sim, e, m);
        sim.emit('use', { tick: sim.tick, uid: e.uid, item: s.item, x: e.x, z: e.z });
        if (--s.count <= 0) e.inventory.slots[i.slot] = null;
      } else {
        e.inventory.slots[i.slot] = null;
        spawnDrop(sim, s.item, s.count, e.x + Math.sin(e.yaw) * 0.8, e.z + Math.cos(e.yaw) * 0.8);
      }
      result(sim, e, i.type, true, null, { slot: i.slot, item: s.item });
      told(sim, e);
      return true;
    }
    return false;
  },
  after: {
    death(sim, ev) { const e = sim.world.get(ev.uid); if (e?.components.loot) dropLoot(sim, e); },
    interact(sim, ev) {
      const t = sim.world.get(ev.target);
      if (!ev.ok || !t?.components.loot || t.stats) return;
      if ((t.lootAt ?? 0) > sim.tick) return;
      t.lootAt = sim.tick + Math.round((t.components.spawn?.respawn ?? REARM) / TICK);
      dropLoot(sim, t);
    },
  },
};
