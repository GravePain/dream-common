# Gameplay tables

Step 10 of the game builder (`docs/briefs/dream-server-steps-6-to-10.md`). The data the sim's gameplay
systems (`sim/systems/`) read: abilities, items, loot and shops. They are Library files in the save place
(place 0, `dream-forge-creations`), authored in **Dream Codex** (`/codex.html` on the Library) and saved through
`/api/save` like any piece; the Library lists any `.json` under a `Tables` folder as kind `table`.

```
Tables/abilities.json      { format: "dream-table", version: 1, kind: "abilities", records: [ability, ...] }
Tables/items.json          { format: "dream-table", version: 1, kind: "items", records: [item, ...] }
Tables/loot/<id>.json      { format: "dream-table", version: 1, kind: "loot", id, rolls, entries: [...] }
Tables/shops/<id>.json     { format: "dream-table", version: 1, kind: "shop", id, name, currency, entries: [...] }
```

| Record | Fields |
| --- | --- |
| ability | `id`, `name`, `range` (m), `arc` (degrees, centred on the caster's facing), `cooldown` (s), `cost` (stamina), `damage`, `effects: [MODIFIER]` (on the target, on a hit), `anim` (the caster's pose, `cast`), `fx` (a library effect, "place\|path", or ""), `speed` (m/s: a projectile, its hit delayed by distance / speed; none: melee, at once) |
| item | `id`, `name`, `stack` (most per slot), `effects: [MODIFIER]` (applied on `use`), `model` ("place\|path" of the drop's GLB), `equip?` (below) |
| loot | `id` (what a `loot { table }` component names), `rolls` (picks per roll), `entries: [{ item, weight, min, max }]` (one weighted pick per roll; `item: ""` is nothing) |
| shop | `id`, `name`, `currency` (an item id), `entries: [{ item, price, stock? }]`. Authored and checked, **not playable yet**: buying is its own later job |

**How they reach the game.** Under `CONTENT=library` a room reads these files when it opens or on the GM page's Reload. On
`CONTENT=live` a room never asks the Library: Publish zone carries the whole set in the pack, and the last pack promoted sets
the tables for every zone (`docs/pack-format.md`). An item a promote takes out stays with whoever holds it, doing nothing.

`MODIFIER` is the schema's `{ stat, op: add | mul | set, value, duration? }` (`web/schema/components.js`).
A stat's value is its base plus the adds, times the muls, then the last set. With a `duration` (s) it
lapses; on `health` or `stamina` without one it changes the pool at once (a potion's `health add 40`).
A modifier's `stat` is one of `STATS` (`sim/systems/tables.js`): `health`, `maxHealth`, `stamina`, `maxStamina`,
`speed`. Stats are not a table yet.

**Equipment.** An item with `equip { slot, set, worn: [MODIFIER] }` can be worn. `slot` is one of the 8: Head,
Shoulders, Top, Gloves, Belt, Pants, Boots, Cape. `set` is the Ida Faber set it looks like (Advanced, Champion,
Newbie). `worn` holds while it is on, and can only name `maxHealth`, `maxStamina` or `speed`, with no duration.
Intents `equip { slot }` (or `use`) and `unequip { wear }`; `inventory.worn { <slot>: item id }` is sent with the
inventory, saved with the player and stays on through a death. Play's inventory (I) wears and takes off. **Not done:**
the worn parts do not show on the player's body in Play yet; that needs the worn state on the wire and Dream
Characters' skin cut.

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
the tables when a room opens (`readTables`) and, when they are bad, says so once and uses the sim's built-in
copies of the same records (`DEFAULT_TABLES`); so does a Library with no tables yet. Local Play reads the same
files when it starts. A table the Library has is the whole table: a record deleted from it stays gone. Dream Codex
runs `checkTables` before a save and refuses one it fails, naming the record; a file it deletes goes to the piece's
`.versions` (`POST /api/retire`).

**When an edit reaches the game.** A table is read when a room opens (an empty room closes after 2 minutes) or on
the GM page's Reload; local Play reads at each Play. Packs do not carry tables: a published zone plays the Library's
tables as they were when its room opened. Templates are baked into a pack's entities at publish, so editing a
template reaches a published zone at its next publish.
