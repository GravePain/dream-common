// node --test test/   (from dream-common): the content schemas, cells and the scene <-> zone round trip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as zoneS from '../web/schema/zone.js';
import * as cellS from '../web/schema/cell.js';
import * as entityS from '../web/schema/entity.js';
import * as comps from '../web/schema/components.js';
import * as charS from '../web/schema/character.js';
import { sceneToZone, zoneToScene, normalise, cellOf, splitToCells, mergeCells } from '../web/zone.js';

const SCHEMAS = { zone: zoneS, cell: cellS, entity: entityS, character: charS };

for (const [name, s] of Object.entries(SCHEMAS)) {
  test(`${name}: its own defaults() validate`, () => assert.deepEqual(s.validate(s.defaults()), []));
  test(`${name}: a missing required field is reported`, () => {
    const d = s.defaults(), key = s.SCHEMA.find((f) => f.required).key;
    delete d[key];
    assert.ok(s.validate(d).some((p) => p.path === key && p.message === 'missing'), JSON.stringify(s.validate(d)));
  });
  test(`${name}: a wrong type is reported`, () => {
    const d = s.defaults(), f = s.SCHEMA.find((x) => x.required && x.type !== 'any');
    d[f.key] = f.type === 'string' || f.type === 'enum' ? 42 : 'not this';
    assert.ok(s.validate(d).some((p) => p.path === f.key), JSON.stringify(s.validate(d)));
  });
}

for (const name of Object.keys(comps.COMPONENTS)) {
  test(`component ${name}: defaults validate, a wrong type does not`, () => {
    const d = comps.defaults(name);
    assert.deepEqual(comps.validateComponent(name, d), []);
    const f = comps.COMPONENTS[name].find((x) => x.required) ?? comps.COMPONENTS[name][0];
    d[f.key] = f.type === 'string' || f.type === 'enum' ? 42 : 'not this';
    assert.ok(comps.validateComponent(name, d).length > 0);
  });
}

test('template and modifier records', () => {
  assert.deepEqual(entityS.validateTemplate(entityS.templateDefaults()), []);
  assert.deepEqual(comps.validateModifier({ stat: 'speed', op: 'mul', value: 1.2, duration: 10 }), []);
  assert.ok(comps.validateModifier({ stat: 'speed', op: 'pow', value: 2 }).some((p) => p.path === 'op'));
  assert.ok(comps.validateModifier({ op: 'add', value: 1 }).some((p) => p.path === 'stat'));
});

test('step 10 components: stats, inventory, pickup, hostile and spawn.respawn', () => {
  assert.deepEqual(comps.validateComponent('stats', { health: 50, maxHealth: 80, stamina: 10, maxStamina: 100, speed: 3 }), []);
  assert.ok(comps.validateComponent('stats', { maxHealth: 0 }).some((p) => p.path === 'stats.maxHealth'));
  assert.deepEqual(comps.validateComponent('inventory', { size: 12, slots: [{ item: 'potion', count: 2 }] }), []);
  assert.ok(comps.validateComponent('inventory', { size: 12, slots: [{ count: 2 }] }).some((p) => /slots/.test(p.path)));
  assert.deepEqual(comps.validateComponent('pickup', { item: 'potion', count: 1 }), []);
  assert.ok(comps.validateComponent('pickup', { count: 1 }).some((p) => p.path === 'pickup.item'));
  assert.deepEqual(comps.validateComponent('hostile', { radius: 8, speed: 3, ability: 'strike' }), []);
  assert.ok(comps.validateComponent('hostile', { radius: -1 }).some((p) => p.path === 'hostile.radius'));
  assert.deepEqual(comps.validateComponent('spawn', { group: 'a1', count: 1, radius: 0, respawn: 30 }), []);
  assert.ok(comps.validateComponent('spawn', { group: 'a1', respawn: 'soon' }).some((p) => p.path === 'spawn.respawn'));
});

test('an animal\'s gameplay components survive scene -> zone -> scene and win over the default npc', async () => {
  const zk = await import('../web/zone.js');
  const terrain = { size: 100, res: 3, heights: '', splat: '', slots: [] };
  const comps = { npc: { mode: 'stationary', home: { x: 1, z: 2 }, radius: 4, speed: 1 }, hostile: { radius: 6, speed: 3, ability: 'strike' }, loot: { table: 'boar' } };
  const scene = { version: 2, terrain, objects: [], effects: [], animals: [{ uid: 1, defId: 'boar', x: 1, z: 2, homeX: 1, homeZ: 2, components: comps }, { uid: 2, defId: 'deer', x: 0, z: 0, homeX: 0, homeZ: 0 }] };
  const { zone, cells } = zk.sceneToZone(scene, { id: 't' });
  const e = zk.mergeCells(zone, cells).find((x) => x.uid === 'a1');
  assert.equal(e.components.npc.mode, 'stationary');
  assert.deepEqual(e.components.hostile, comps.hostile);
  const back = zk.zoneToScene(zone, cells).animals.sort((x, y) => x.uid - y.uid);
  assert.deepEqual(back[0].components, comps);
  assert.equal(back[1].components, undefined, 'a plain animal stays plain');
});

test('an entity with a bad component is reported at the component', () => {
  const e = { ...entityS.defaults(), components: { npc: { mode: 'dance' } } };
  assert.ok(entityS.validate(e).some((p) => p.path === 'components.npc.mode'));
});

test('a zone size that is not whole cells is reported', () => {
  assert.ok(zoneS.validate({ ...zoneS.defaults(), size: 120 }).some((p) => p.path === 'size'));
});

test('cellOf at the edges (zone metres 0, 49.99, 50 and the far edge)', () => {
  const size = 200, at = (u, v) => cellOf(u - size / 2, v - size / 2, size).name;
  assert.equal(at(0, 0), 'x0z0');
  assert.equal(at(49.99, 49.99), 'x0z0');
  assert.equal(at(50, 0), 'x1z0');
  assert.equal(at(0, 50), 'x0z1');
  assert.equal(at(size, size), 'x3z3'); // the far edge belongs to the last cell
  assert.equal(at(-5, size + 5), 'x0z3'); // outside clamps in
});

// a small scene with every kind of record, tilts present and absent
const SMALL = {
  version: 2,
  terrain: { size: 100, res: 5, heights: 'AAAA', splat: 'AAAA', slots: ['grass', null], waterLevel: -0.6 },
  objects: [
    { uid: 2, itemId: 'lib0/Creek boulder.glb', x: 30, z: -40, rotY: 1.5, scale: 1.1, yOffset: 0 },
    { uid: 1, itemId: 'lib0/Fan palm clump.glb', x: -49.9, z: 49.9, rotY: 0, rotX: 0.1, rotZ: 0, scale: 1, yOffset: 0.25 },
  ],
  animals: [{ uid: 3, defId: 'lib0/Characters/test knight.glb', x: 6.5, z: 6.2, homeX: 9, homeZ: 8 }],
  effects: [{ uid: 1, type: 'smoke', x: 0, z: 0, radius: 3 }, { uid: 2, type: 'library', x: 10, z: 12, radius: 2, fx: '0|Effects/Waterfall.fx.json', rotY: 0.5, y: 1.2 }],
  sky: { time: 10, style: 'clear', playing: false, light: { sun: 1 } },
};

function roundTrip(scene) {
  const { zone, cells } = sceneToZone(scene, { id: 'test', name: 'Test' });
  assert.deepEqual(zoneS.validate(zone), []);
  for (const c of Object.values(cells)) assert.deepEqual(cellS.validate(c), [], JSON.stringify(cellS.validate(c).slice(0, 3)));
  // through JSON, as the files are
  const back = zoneToScene(JSON.parse(JSON.stringify(zone)), JSON.parse(JSON.stringify(Object.values(cells))));
  assert.equal(normalise(back), normalise(scene));
  return { zone, cells };
}

test('scene -> zone -> scene is the same scene (small, every record kind)', () => {
  const { zone, cells } = roundTrip(SMALL);
  assert.deepEqual(zone.cells, ['x1z0', 'x0z1', 'x1z1']); // no entity falls in x0z0, so it has no file
  assert.equal(mergeCells(zone, cells).length, 5);
  assert.equal(cells.x1z0.entities[0].components.model.path, 'Creek boulder.glb');
  assert.equal(cells.x1z1.entities.find((e) => e.uid === 'a3').components.npc.mode, 'wander');
});

test('splitToCells keeps a parent and its child apart when they straddle a cell line', () => {
  const e = (uid, x, parent) => ({ uid, template: 't', ...(parent ? { parent } : {}), transform: { x, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 }, components: {} });
  const cells = splitToCells([e('p', -1), e('c', 1, 'p')], 100, 'z');
  assert.equal(cells.x0z1.entities[0].uid, 'p');
  assert.equal(cells.x1z1.entities[0].transform.x, 1); // the child keeps its own world position
});

const CASCADES = 'K:/dream-forge-creations/Scenes/Crystal Cascades (first draft).scene.json';
test('Crystal Cascades (first draft) round trips', { skip: !fs.existsSync(CASCADES) && 'scene file not on this machine' }, () => {
  const scene = JSON.parse(fs.readFileSync(CASCADES, 'utf8'));
  const { zone, cells } = roundTrip(scene);
  assert.equal(mergeCells(zone, cells).length, scene.objects.length + scene.animals.length + (scene.effects ?? []).length);
});
