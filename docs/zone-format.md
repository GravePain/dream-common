# The zone format

Step 1 of the game builder (`game-builder-plan.md`). The game's content formats, declared once in
`dream-common/web/schema/` and used by the editors, the sim (step 2) and the server. Dream World saves
`.scene.json` as before and also reads and writes zones.

## The files

```
Zones/<name>/zone.json          the zone: terrain, sky, the list of cells (kind "zone" in the Library)
Zones/<name>/cells/x0z0.json    one cell: the entities in that 50 m square
Zones/<name>/cells/x1z0.json    ...
```

A zone is a folder piece: the Library lists `zone.json` as kind `zone`, named after its folder, with
`cells: ["x0z0", ...]` from its `cells/` folder. Every file is saved through `/api/save`, so each has its
`.meta.json` and earlier versions in `.versions/`. Only cells with entities have a file; `zone.cells` is
the list that counts (a cell left over from an older save and not listed is ignored).

## zone.json (`schema/zone.js`)

`{ format: "dream-zone", version: 1, id, name, size, cell: 50, terrain: { res, heights, splat, slots,
waterLevel }, sky, cells: ["x0z0", ...] }`. `size` is the side in metres (100, 200 or 400 in Dream World;
any multiple of 50 validates). The terrain is one record, as in `.scene.json`: `heights` is base64 of a
Float32 array of `res * res` heights, `splat` base64 of 16 ground weights per vertex, `slots` the ground
texture in each layer. `sky` is Dream World's day/night record, kept as it is.

## The cell rule

Cells are fixed 50 m squares (50 divides 100, 200 and 400). Cell `x<i>z<j>` covers zone metres
`[50 i, 50 (i+1))` across and `[50 j, 50 (j+1))` down, measured from the zone's corner at world
`(-size/2, -size/2)`; the far edge belongs to the last cell and points outside clamp in. An entity lives in
the cell its `transform.x, z` falls in: `cellOf(x, z, size)` in `web/zone.js`.

## A cell (`schema/cell.js`)

`{ format: "dream-cell", version: 1, zone, x, z, entities: [...] }`, `x` and `z` the cell's column and row.

## An entity (`schema/entity.js`)

`{ uid, template, name?, parent?, transform: { x, y, z, rotX, rotY, rotZ, scale }, components: { <name>: {...} } }`.

- `uid` is a string unique in the zone. Converted scenes use `o12`, `a3`, `e5` for Dream World's objects,
  animals and effects (their uids are numbered separately there).
- `template` names what it is: a library item (`lib0/Creek boulder.glb`), an animal id, or `fx:<effect>`.
  A template file (`{ format: "dream-template", version: 1, id, name, components }`) supplies components;
  an entity's own components win, key by key (`resolve()` in `entity.js`). No template files exist yet.
- `transform`: world metres and radians; `y` is height above the ground at `x, z`.
- **Parents** (finding 7 of the UI review): `parent` is another entity's `uid` in the same cell. A child
  keeps its own world transform in the file, so a cell loads without its parent and a child near a cell
  line may sit in a different cell from its parent's. Nothing sets parents yet.

## Components (`schema/components.js`)

| Component | Fields |
|---|---|
| `model` | `place`, `path` (the library piece), `yOffset` (Dream World's lift above ground) |
| `spawn` | `group`, `count`, `radius` |
| `npc` | `mode` (stationary, patrol, wander, follow, flee), `home {x, z}`, `radius`, `speed`, `points [{x, z}]` (patrol) |
| `collider` | `shape` (box, sphere, capsule, cylinder), `size {x, y, z}`, `trigger` |
| `interact` | `verb`, `range` |
| `loot` / `shop` | `table` (a table id) |
| `portal` | `zone`, `cell`, `x`, `z` |
| `light` | `color`, `intensity`, `range` |
| `fx` | `type` (a Dream World built-in or `library`), `path` (`place\|path` of a library effect), `radius` |
| `animal` | `defId`, `home {x, z}` (Dream World's AnimalSave) |
| `stats` | `health`, `maxHealth`, `stamina`, `maxStamina`, `speed` (step 10; missing fields take `MOVE`'s defaults) |
| `inventory` | `size`, `slots [{item, count}]` |
| `pickup` | `item`, `count` (a drop on the ground) |
| `hostile` | `radius` (aggro), `speed` (chase), `ability` (an ability id, `strike`) |

`spawn` gained `respawn` (s): an npc carrying it (or a spawn entity whose `group` is the npc's uid) comes
back that long after it died; on a chest with `loot` it is how long before the chest gives loot again.
An animal's AnimalSave may carry `components` (npc, hostile, stats, loot, spawn): they win over the default
wandering npc and come back into the scene, so Dream World keeps a hostile npc through open and save.
Tables (abilities, items, loot) are not components: `docs/tables.md`.

**Player spawn.** An entity with `spawn` of group `player` (Dream World: Play settings, *Set spawn here*,
makes a group carrying one) is where new players start: the Dream Server puts each at a random walkable
point within its `radius`. Without one, the zone's `spawn`, else its centre. A player who has been in the
zone before starts where it left.

**Portals.** An entity with `portal` and a `collider` with `trigger: true` (on itself, or a trigger collider
from its piece's meta) moves a player who walks into it to another zone: `zone` is a zone name in the same
Library place ("Portal Test" means `Zones/Portal Test/zone.json`) or a full `"place|path/zone.json"` ref;
`x`, `z` are where the player arrives in that zone (`cell` is informational). The arrival is checked
walkable, else the nearest walkable point within 3 m, else the target's spawn. Put the arrival a few metres
off the target zone's own portal so the player does not walk straight back. The sim fires the event once
per entry; the trigger never blocks.

**Doors and chests.** An entity with `interact` of verb `open` keeps its open/closed state on the Dream
Server (world scope, per zone), shared by everyone and kept across restarts.

Plus `MODIFIER`, `{ stat, op: add|mul|set, value, duration? }`, for items and buffs later. A component may
carry fields the schema does not name (a converted record's extra fields ride there, so nothing is lost).

## A character (`schema/character.js`)

What Dream Characters writes in a character's meta today, declared and not changed: `kind: "character"`,
`rig`, `recipe { base {place, path}, choice, tint, clip, garments [{slot, place, path, tint}] }`, `clips`,
`idle`, `walk`, `garments` (paths).

## Schemas are data

Each schema module exports `SCHEMA` (a field list: key, label, type, range, step, options, default,
required), `validate(obj)` (`[]` or `[{ path, message }]`) and `defaults()`. One walker,
`schema/validate.js`, checks them all and builds defaults; an inspector can draw a panel from the same
fields, as the Effects editor does from `fx.js` `SCHEMA`. Unknown keys are allowed, so a newer tool's
fields do not fail an older check.

## Scenes and zones

`web/zone.js`: `sceneToZone(scene, { id, name })` gives `{ zone, cells }`; `zoneToScene(zone, cells)` gives
the scene back. A placed object becomes an entity with a `model` component (template = its item id); an
animal an `animal` plus an `npc` that wanders; an effect an `fx` component. The round trip is lossless:
`normalise()` of both is equal (it sorts by uid and drops zero tilts, which Dream World writes either way).
`splitToCells` and `mergeCells` do the cell step on their own.

Tests: `node --test` in `dream-common` (`test/schema.test.mjs`): every schema's defaults validate, a
missing required field and a wrong type are caught, `cellOf` at the edges, the round trip of a small scene
with every record kind and of Crystal Cascades (first draft).

## Not here yet

Items, abilities and quests (Dream Codex, Dream Story); template files and an editor for them; parents
set by any tool; the sim (step 2) reading cells; per-cell terrain (the terrain stays one record per zone);
streaming cells in and out.
