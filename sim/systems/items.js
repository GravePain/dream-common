// Items (step 10): inventories, loot tables, drops and pickups, against `Tables/items.json` and
// `Tables/loot/<table>.json`.
//
// - A player carries `inventory { size, slots: [{ item, count } | null] }` (12 slots; a join may bring a saved
//   one: player scope, saved with the record). `inventory { uid, size, slots }` is emitted on every change.
// - `pickup { uid }` takes a drop (an entity with a `pickup { item, count }` component) within PICKUP m: all of
//   it or nothing (`itemResult { ok: false, reason: 'full' }`); vetoable through the `pickup` event.
// - `use { slot }` applies the item's effects as modifiers (stats.js) and spends one; `drop { slot }` puts the
//   whole stack on the ground at the feet.
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

/** A clean inventory: `size` slots, each { item, count } or null; unknown items and bad counts dropped. */
export function cleanInventory(inv, items) {
  const size = Number.isInteger(inv?.size) && inv.size > 0 && inv.size <= 64 ? inv.size : SLOTS;
  const slots = Array.from({ length: size }, (_, k) => {
    const s = inv?.slots?.[k], def = s && items.get(s.item);
    return def && Number.isInteger(s.count) && s.count > 0 ? { item: s.item, count: Math.min(s.count, def.stack) } : null;
  });
  return { size, slots };
}

/** Put `count` of `item` in: stacks first, then empty slots. All or nothing; true when it fitted. */
export function addItem(inv, items, item, count) {
  const def = items.get(item);
  if (!def || count < 1) return false;
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

const told = (sim, e) => sim.emit('inventory', { tick: sim.tick, uid: e.uid, size: e.inventory.size, slots: e.inventory.slots.map((s) => (s ? { ...s } : null)) });
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
    if (i.type === 'use' || i.type === 'drop') {
      const s = e.inventory?.slots[i.slot];
      if (!s) { result(sim, e, i.type, false, 'empty slot', { slot: i.slot }); return true; }
      if (e.dead) { result(sim, e, i.type, false, 'dead', { slot: i.slot }); return true; }
      const def = sim.tables.items.get(s.item);
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
