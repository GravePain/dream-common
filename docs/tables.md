# Gameplay tables

Step 10 of the game builder (`docs/briefs/dream-server-steps-6-to-10.md`). The data the sim's gameplay
systems (`sim/systems/`) read: abilities, items and loot. They are Library files in the save place
(place 0, `dream-forge-creations`), saved through `/api/save` like any piece; the Library lists any
`.json` under a `Tables` folder as kind `table` (dream-library `kindOf`, from its next restart).

```
Tables/abilities.json      { format: "dream-table", version: 1, kind: "abilities", records: [ability, ...] }
Tables/items.json          { format: "dream-table", version: 1, kind: "items", records: [item, ...] }
Tables/loot/<id>.json      { format: "dream-table", version: 1, kind: "loot", id, rolls, entries: [...] }
```

| Record | Fields |
| --- | --- |
| ability | `id`, `name`, `range` (m), `arc` (degrees, centred on the caster's facing), `cooldown` (s), `cost` (stamina), `damage`, `effects: [MODIFIER]` (on the target, on a hit), `anim` (the caster's pose, `cast`), `fx` (a library effect, "place\|path", or ""), `speed` (m/s: a projectile, its hit delayed by distance / speed; none: melee, at once) |
| item | `id`, `name`, `stack` (most per slot), `effects: [MODIFIER]` (applied on `use`), `model` ("place\|path" of the drop's GLB) |
| loot | `id` (what a `loot { table }` component names), `rolls` (picks per roll), `entries: [{ item, weight, min, max }]` (one weighted pick per roll; `item: ""` is nothing) |

`MODIFIER` is the schema's `{ stat, op: add | mul | set, value, duration? }` (`web/schema/components.js`).
A stat's value is its base plus the adds, times the muls, then the last set. With a `duration` (s) it
lapses; on `health` or `stamina` without one it changes the pool at once (a potion's `health add 40`).

The two abilities and the starting items, as saved:

| | |
| --- | --- |
| `strike` | melee, 2 m, 90°, 1 s cooldown, 10 stamina, 18 damage |
| `bolt` | ranged, 15 m, 60°, 0.8 s, 15 stamina, 12 damage, 20 m/s, slows the target to 0.7x for 2 s |
| `potion` | Healing potion, stacks 5, health +40 (`6\|Fantasy Props MegaKit/Potion_1.glb`) |
| `swift` | Swift draught, stacks 5, speed x1.5 for 10 s (`Potion_2.glb`) |
| loot `chest` | 2 rolls: potion (weight 3, 1-2) or swift (1) |
| loot `boar` | 1 roll: potion (2), swift (1) or nothing (1) |

The checks: `checkTables(tables)` (`sim/systems/tables.js`) names every bad record; the Dream Server reads
the tables when a room opens (`src/gameplay.js`) and, when one is missing or bad, says so once and uses the
sim's built-in copies of the same records (`DEFAULT_TABLES`), so a sim made without tables (tests, local
Play) behaves the same. A table given replaces the built-in record of the same id; new ids add.
