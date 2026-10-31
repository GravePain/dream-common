// The built-in systems, registered in their fixed order: ai moves the npcs it owns (so their animation is
// this tick's before stats reads it), stats (stamina, regeneration, modifiers, death and respawn),
// abilities (projectiles in flight, the cast pose), items (drops lapsing). Every sim gets these unless
// `createSim({ systems })` names fewer.
import { registerSystem, REGISTRY } from '../systems.js';
import { aiSystem } from './ai.js';
import { statsSystem } from './stats.js';
import { abilitiesSystem } from './abilities.js';
import { itemsSystem } from './items.js';

for (const s of [aiSystem, statsSystem, abilitiesSystem, itemsSystem]) if (!REGISTRY.some((r) => r.name === s.name)) registerSystem(s);

export { REGISTRY };
export { stat, damage, kill, applyModifier, freshStats } from './stats.js';
export { cast, inReach, foes, TOLERANCE } from './abilities.js';
export { aiOwns } from './ai.js';
export { addItem, giveItem, takeItem, rollLoot, spawnDrop, cleanInventory, SLOTS, PICKUP, DROP_LIFE } from './items.js';
export { DEFAULT_TABLES, STATS, WORN_STATS, EQUIP_SLOTS, EQUIP_SETS, checkTables, tablesOf, readTables, tableReader } from './tables.js';
