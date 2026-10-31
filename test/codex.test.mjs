// The Dream Codex's rules: its schemas and checks, tables that replace rather than merge, a template's components
// reaching a sim entity, and equipment in the 8 slots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, stepOnce, terrainOf, stat, checkTables, tablesOf, readTables, DEFAULT_TABLES, EQUIP_SLOTS, checkIntent } from '../sim/index.js';
import { simInput } from '../sim/bridge.js';
import { buildPack, packInput } from '../pack/index.js';
import { sceneToZone } from '../web/zone.js';
import { validateTemplate, templateDefaults } from '../web/schema/entity.js';
import { validateRecord, recordDefaults, equipDefaults, lootChances, usedBy, SCHEMAS } from '../web/schema/tables.js';

const flat = (size = 100, res = 21) => ({ format: 'dream-zone', version: 1, id: 'test', name: 'Test', size, cell: 50, terrain: terrainOf(new Float32Array(res * res), res), sky: {}, cells: [] });
const cell = (entities) => ({ format: 'dream-cell', version: 1, zone: 'test', x: 0, z: 0, entities });

const wolf = {
  format: 'dream-template', version: 1, id: 'wolf', name: 'Wolf',
  components: {
    model: { place: '0', path: 'Characters/Wolf.glb', yOffset: 0 },
    npc: { mode: 'wander', home: { x: 0, z: 0 }, radius: 4, speed: 1.2 },
    hostile: { radius: 6, speed: 3, ability: 'strike' },
    stats: { maxHealth: 60 },
    loot: { table: 'boar' },
  },
};
const placed = { uid: 'a1', template: 'template:wolf', transform: { x: 3, y: 0, z: 4, rotX: 0, rotY: 0, rotZ: 0, scale: 1 }, components: { animal: { defId: 'template:wolf', home: { x: 3, z: 4 } }, stats: { maxHealth: 75 } } };

test('every record kind has defaults that fit its own schema', () => {
  for (const kind of Object.keys(SCHEMAS)) assert.deepEqual(validateRecord(kind, recordDefaults(kind)), [], kind);
  assert.equal(equipDefaults().slot, 'Top');
  assert.deepEqual(validateTemplate({ ...templateDefaults(), ...wolf }), []);
});

test('bad data is refused, naming the record', () => {
  const check = (t, re) => assert.ok(checkTables(t).some((p) => re.test(p)), `${JSON.stringify(checkTables(t))} should match ${re}`);
  check({ items: [{ id: 'a', stack: 1, effects: [{ stat: 'mana', op: 'add', value: 1 }] }] }, /item a: a bad effect/);
  check({ items: [{ id: 'a', stack: 1 }, { id: 'a', stack: 2 }] }, /item a: the id is used twice/);
  check({ items: [{ id: 'a', stack: 1, equip: { slot: 'Tail' } }] }, /item a: no equipment slot Tail/);
  check({ items: [{ id: 'a', stack: 1, equip: { slot: 'Top', worn: [{ stat: 'health', op: 'add', value: 5 }] } }] }, /item a: a worn effect/);
  check({ items: [{ id: 'a', stack: 1, equip: { slot: 'Top', worn: [{ stat: 'speed', op: 'mul', value: 2, duration: 3 }] } }] }, /item a: a worn effect/);
  check({ loot: [{ id: 'l', rolls: 1, entries: [{ item: 'nope', weight: 1 }] }] }, /loot l: no item nope/);
  check({ shops: [{ id: 's', name: 'S', currency: 'gold', entries: [] }] }, /shop s: no currency item gold/);
  check({ shops: [{ id: 's', name: 'S', currency: 'potion', entries: [{ item: 'nope', price: 1 }] }] }, /shop s: no item nope/);
  check({ shops: [{ id: 's', name: 'S', currency: 'potion', entries: [{ item: 'swift', price: -1 }] }] }, /shop s: a price/);
  check({ templates: [{ id: 't', components: {} }] }, /template t: no model/);
  check({ templates: [{ id: 't', components: { model: { path: 'a.glb' }, loot: { table: 'nope' } } }] }, /template t: no loot table nope/);
  check({ templates: [{ id: 't', components: { model: { path: 'a.glb' }, shop: { table: 'nope' } } }] }, /template t: no shop nope/);
  check({ templates: [{ id: 't', components: { model: { path: 'a.glb' }, hostile: { ability: 'nope' } } }] }, /template t: no ability nope/);
  assert.deepEqual(checkTables({ ...DEFAULT_TABLES, templates: [wolf] }), []);
});

test('a table given is the whole table: a deleted record stays gone; one not given is the default', () => {
  const t = tablesOf({ items: [DEFAULT_TABLES.items[0]] });
  assert.equal(t.items.has('swift'), false);
  assert.equal(t.abilities.has('strike'), true);
});

test('readTables reads every kind, and says when they are bad', async () => {
  const files = {
    'Tables/abilities.json': { records: DEFAULT_TABLES.abilities },
    'Tables/items.json': { records: DEFAULT_TABLES.items },
    'Tables/loot/boar.json': DEFAULT_TABLES.loot[1],
    'Tables/shops/inn.json': { id: 'inn', name: 'Inn', currency: 'potion', entries: [{ item: 'swift', price: 2 }] },
    'Templates/wolf.template.json': wolf,
  };
  const library = { table: async (p) => { if (!files[p]) throw new Error('none'); return files[p]; }, tableList: async (pre) => Object.keys(files).filter((p) => p.startsWith(pre)) };
  const t = await readTables(library);
  assert.deepEqual([t.abilities.length, t.items.length, t.loot.length, t.shops.length, t.templates.length], [2, 2, 1, 1, 1]);
  // the chest's table was deleted: it does not come back from the defaults
  assert.equal(tablesOf(t).loot.has('chest'), false);
  files['Tables/shops/inn.json'] = { id: 'inn', name: 'Inn', currency: 'gold', entries: [] };
  const said = [];
  assert.deepEqual(await readTables(library, (s) => said.push(s)), {});
  assert.match(said[0], /shop inn: no currency item gold/);
});

test('loot chances come from the weights; what uses a record is named', () => {
  assert.deepEqual(lootChances(DEFAULT_TABLES.loot[1].entries), [50, 25, 25]);
  assert.deepEqual(lootChances([{ weight: 0 }]), [0]);
  const t = { loot: DEFAULT_TABLES.loot, shops: [{ id: 'inn', currency: 'swift', entries: [] }], templates: [wolf] };
  assert.deepEqual(usedBy('item', 'swift', t), ['loot chest', 'loot boar', 'shop inn']);
  assert.deepEqual(usedBy('loot', 'boar', t), ['template wolf']);
  assert.deepEqual(usedBy('ability', 'strike', t), ['template wolf']);
  assert.deepEqual(usedBy('ability', 'bolt', t), []);
});

test("a template's components reach a sim entity, the entity's own winning; it fights and drops its loot", () => {
  const input = simInput(flat(), [cell([placed])], { templates: [wolf] });
  const out = input.cells[0].entities[0];
  assert.equal(out.components.model, undefined, 'the template model is the client animal def, not a placed piece');
  assert.equal(out.name, 'Wolf');
  const sim = createSim({ zone: input.zone, cells: input.cells, templates: input.templates, seed: 1 });
  const e = sim.world.get('a1');
  assert.equal(e.kind, 'npc');
  assert.equal(e.components.npc.mode, 'wander');
  assert.deepEqual(e.components.npc.home, { x: 3, z: 4 });
  assert.equal(e.stats.maxHealth, 75, "the entity's own value wins");
  assert.equal(e.components.hostile.ability, 'strike');
  assert.equal(e.components.loot.table, 'boar');
});

test('a placed template survives a scene turning into a zone, and a pack', async () => {
  const size = 100, res = 21;
  const scene = { version: 2, terrain: { size, res, heights: flat().terrain.heights, splat: '', slots: [] }, objects: [], animals: [{ uid: 1, defId: 'template:wolf', x: 3, z: 4, homeX: 3, homeZ: 4 }], effects: [] };
  const { zone, cells } = sceneToZone(scene, { id: 'test', name: 'Test' });
  assert.equal(cells.x1z1.entities[0].components.npc, undefined, 'no default wander under the template');
  const r = await buildPack({ zone, cells, templates: [wolf], ref: '0|Zones/Test/zone.json', built: 'b1', pieces: async () => ({}) });
  assert.deepEqual(r.report.errors, []);
  const e = createSim({ ...packInput(r.pack), seed: 1 }).world.get('a1');
  assert.equal(e.components.hostile.radius, 6);
  assert.deepEqual(e.components.npc.home, { x: 3, z: 4 });
  assert.equal(e.components.model, undefined);
});

// ---- equipment
const cloak = { id: 'cloak', name: 'Cloak', stack: 1, effects: [], model: '', equip: { slot: 'Cape', set: 'Advanced', worn: [{ stat: 'speed', op: 'mul', value: 2 }, { stat: 'maxHealth', op: 'add', value: 50 }] } };
const cape2 = { id: 'cape2', name: 'Other cape', stack: 1, effects: [], model: '', equip: { slot: 'Cape', worn: [{ stat: 'speed', op: 'add', value: 1 }] } };
const items = [...DEFAULT_TABLES.items, cloak, cape2];
const joined = (inventory) => {
  const sim = createSim({ zone: flat(), tables: { items } });
  sim.join('p1', { x: 0, z: 0, inventory });
  stepOnce(sim);
  return { sim, p: sim.world.get('p1') };
};

test('equip and unequip intents are checked; the 8 slots are the ones asked for', () => {
  assert.deepEqual(EQUIP_SLOTS, ['Head', 'Shoulders', 'Top', 'Gloves', 'Belt', 'Pants', 'Boots', 'Cape']);
  assert.deepEqual(checkIntent({ type: 'equip', slot: 1 }), { type: 'equip', slot: 1 });
  assert.deepEqual(checkIntent({ type: 'unequip', wear: 'Head' }), { type: 'unequip', wear: 'Head' });
  assert.equal(checkIntent({ type: 'unequip', wear: 3 }), null);
});

test('wearing holds its modifiers until it comes off, and goes back to the bag', () => {
  const { sim, p } = joined({ size: 2, slots: [{ item: 'cloak', count: 1 }] });
  sim.intent('p1', { type: 'equip', slot: 0 });
  stepOnce(sim);
  assert.deepEqual(p.inventory.worn, { Cape: 'cloak' });
  assert.equal(p.inventory.slots[0], null);
  assert.equal(stat(p, 'speed'), 8);
  assert.equal(stat(p, 'maxHealth'), 150);
  sim.intent('p1', { type: 'unequip', wear: 'Cape' });
  stepOnce(sim);
  assert.deepEqual(p.inventory.worn, {});
  assert.equal(p.inventory.slots[0].item, 'cloak');
  assert.equal(stat(p, 'speed'), 4);
});

test('wearing swaps what the slot held; use on a wearable wears it instead of spending it', () => {
  const { sim, p } = joined({ size: 2, slots: [{ item: 'cloak', count: 1 }, { item: 'cape2', count: 1 }] });
  sim.intent('p1', { type: 'use', slot: 0 });
  sim.intent('p1', { type: 'equip', slot: 1 });
  stepOnce(sim);
  assert.deepEqual(p.inventory.worn, { Cape: 'cape2' });
  assert.deepEqual(p.inventory.slots.map((s) => s?.item ?? null).sort(), ['cloak', null].sort());
  assert.equal(stat(p, 'speed'), 5, 'the first cape stopped counting');
});

test('what cannot be worn or taken off says why', () => {
  const { sim, p } = joined({ size: 1, slots: [{ item: 'potion', count: 1 }], worn: { Cape: 'cloak' } });
  const seen = [];
  sim.on('itemResult', (e) => seen.push(e.reason));
  sim.intent('p1', { type: 'equip', slot: 0 });
  sim.intent('p1', { type: 'unequip', wear: 'Head' });
  sim.intent('p1', { type: 'unequip', wear: 'Cape' });
  stepOnce(sim);
  assert.deepEqual(seen, ['not wearable', 'nothing worn', 'full']);
  assert.deepEqual(p.inventory.worn, { Cape: 'cloak' });
});

test('what is worn comes back with a saved inventory and stays on through a death', () => {
  const { sim, p } = joined({ size: 2, slots: [], worn: { Cape: 'cloak', Head: 'cloak', Boots: 'gone' } });
  assert.deepEqual(p.inventory.worn, { Cape: 'cloak' }, 'an item worn in the wrong slot, or no longer there, is dropped');
  assert.equal(stat(p, 'speed'), 8);
  sim.intent('p1', { type: 'stop' });
  p.stats.health = 1;
  p.mods.push({ stat: 'speed', op: 'add', value: 100, until: Infinity });
  sim.spawn = { x: 0, z: 0 };
  for (let k = 0; k < 2; k++) stepOnce(sim);
  p.dead = { until: sim.tick };
  stepOnce(sim);
  assert.equal(p.dead, null);
  assert.equal(stat(p, 'speed'), 8, 'a passing modifier went, what is worn stayed');
});
