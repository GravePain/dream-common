# Brief: game builder step 1, the zone / cell / entity schemas

Step 1 of "First concrete steps" in `docs/game-builder-plan.md`; slot 4 of
`docs/review-ui-plan-2026-10-29.md` waits on it. Read first: `working-with-claude.md`, `CLAUDE.md`,
`docs/game-builder-plan.md` (Key decisions, Phase 0, Finish the base tools first, First concrete
steps), finding 7 of `docs/review-ui-plan-2026-10-29.md` (parents and names belong in the zone
format), `dream-common/web/fx.js` (`SCHEMA`: the one schema pattern already in use, driven by the
Effects editor's panels), and `K:\dream-world\src\save.ts` (the `.scene.json` form today: version 2,
`terrain {size, res, heights, splat, slots, waterLevel}`, `objects: Placed[]` with `uid, itemId, x, z,
rotY, rotX?, rotZ?, scale, yOffset`, `animals: AnimalSave[]` with `uid, defId, x, z, homeX, homeZ`,
`effects`, `sky`), with `world.ts`, `animals.ts`, `effects.ts` for what those records mean.

## What it is

The game's content formats, declared once in `dream-common` and used by the editors, the sim and the
server. A **zone** is one Dream World map: its terrain as one file, its entities split into fixed
50 m **cells** (50 divides 100, 200 and 400 m, `MAP_SIZES` in `main.ts`). An **entity** is a
template id plus components. Dream World keeps saving `.scene.json` as today and also reads and
writes the zone form, so one existing scene converted to cells proves it.

## Deliverables

1. **Schemas** in `dream-common/web/schema/` (plain ES modules, no build, served as
   `/common/schema/*`): `zone.js`, `cell.js`, `entity.js`, `components.js`, `character.js`, each
   exporting its schema in the `fx.js` `SCHEMA` style (fields, types, ranges, defaults, a label for
   an inspector) plus a `validate(obj)` that returns `[]` or a list of `{path, message}`, and a
   `defaults()` factory. One shared `validate.js` does the walking so each schema is data.
   - zone: `{ format: "dream-zone", version: 1, id, name, size, cell: 50, terrain: { res, heights,
     splat, slots, waterLevel }, sky, cells: ["x0z0", ...] }` (terrain stays one file, base64 as now).
   - cell: `{ format: "dream-cell", version: 1, zone, x, z, entities: [...] }`.
   - entity: `{ uid, template, name?, parent?, transform: { x, y, z, rotX, rotY, rotZ, scale },
     components: { <name>: {...} } }`. `parent` is another entity's uid in the same cell (finding 7);
     children keep their own world transform in the file so a cell loads without its parent.
   - components, each a schema: `model` (library place/path, the Placed fields that are not
     transform: `yOffset`), `spawn`, `npc` (`mode: stationary|patrol|wander|follow|flee`, home, radius,
     speed), `collider` (box|sphere|capsule, size), `interact` (verb, range), `loot` (table id), `shop`
     (table id), `portal` (zone id, cell, x, z), `light` (colour, intensity, range), `fx` (effect
     path), `animal` (what `AnimalSave` carries). Item, ability and quest schemas are not here (they
     come with Dream Codex and Dream Story).
   - entity template: `{ format: "dream-template", version: 1, id, name, components }`; an entity's
     components override its template's.
   - character: what Dream Characters saves today in its meta (`recipe`, `clips`, `idle`, `walk`,
     `garments`), declared, not changed.
   - A generic modifier record `{ stat, op: add|mul|set, value, duration? }` in `components.js` for
     later items and buffs.
2. **Cells**: `dream-common/web/zone.js` with `splitToCells(scene, size)`, `mergeCells(zone, cells)`,
   `cellOf(x, z)`, and a converter `sceneToZone(sceneJson) -> { zone, cells }` /
   `zoneToScene(zone, cells)` that maps today's `Placed` and `AnimalSave` to entities (a Placed becomes
   an entity with a `model` component and template `lib<place>/<path>`; an animal becomes an entity
   with `animal` plus `npc` wander) and back without loss (a round trip of a scene is byte-equal
   after normalisation; write that test).
3. **Library kind** `zone`: a zone is a folder `Zones/<name>/zone.json` with `cells/x0z0.json` beside
   it; add kind `zone` to `dream-library/server.mjs` (`KINDS`, `kindOf`, `pieceExt`, the folder-piece
   listing: follow what `ui`, `synth`, `clip` did) and to `dream-common/web/library.js` `KIND_NAME`
   and `KIND_ICON`, opening in Dream World with `?zone=`. Tell the coordinating session when
   `server.mjs` changes: it restarts both Libraries.
4. **Dream World**: "Save as zone" and "Open zone" next to the scene save in `src/save.ts` /
   `ui.ts`, using `zone.js` (imported from `/common/zone.js` as the other common modules are), and
   `?zone=<place>|<path>` on load. `.scene.json` keeps working unchanged. Convert "Crystal Cascades
   (first draft)" to `Zones/Crystal Cascades/` in the Library through the save API and reopen it
   from the zone: same objects, animals, terrain and sky.
5. **Tests**: `dream-common/test/schema.test.mjs` run with `node --test`: every schema validates its
   own `defaults()`, rejects a wrong type and a missing required field, the scene round trip above,
   `cellOf` at the edges (0, 49.99, 50, size).
6. **Docs**: `docs/zone-format.md` (the files, the fields, the cell rule, parents, what is not here
   yet), a Phase 0 line in `docs/game-builder-plan.md` marking step 1 done, and a note in
   `dream-world/README.md`.

## Rules

- Only CC0 assets or Graves's own content; nothing new is imported here anyway.
- Plain JS in `dream-common/web`, no build, no packages; `sim/` is step 2, not this. Nothing names
  another port; the Library is `${location.origin}/dl`, the kit `${location.origin}/common`.
- Dream World is TypeScript under Vite: the common modules are imported by URL with a `.d.ts` shim
  if needed, as the existing ones are. Vite picks up `src/` changes without a restart.
- Keep each file readable; schemas are data, one walker validates them all.
- Commit per repo with what changed and why and the `Co-Authored-By` line the session gives you; push
  `origin main`; mirror with `git -C /z/<repo> -c safe.directory='*' pull --ff-only`. Patch files with
  a Python script written by the Write tool (Bash heredocs mangle backslashes here).
- Write scopes: `dream-common/web/schema/*`, `dream-common/web/zone.js`, `dream-common/web/library.js`
  (kind tables and the open link only), `dream-common/test/*`, `dream-common/docs/{zone-format.md,
  game-builder-plan.md}`, `dream-library/server.mjs` (kinds and folder pieces only), `dream-world/src/*`
  and its README, `dream-forge-creations/Zones/` through the save API. Not Dream Forge, Paint,
  Characters, Sound.

## Done means

Verified and reported with what was checked against what was assumed: `node --test` green; Crystal
Cascades saved as a zone shows in the Library as kind `zone` with its cells, reopens in Dream World
(port 5240) with the same object count, animals, water level and sky; the round trip test passes;
the format doc is written; the coordinating session was told whether `server.mjs` changed.
