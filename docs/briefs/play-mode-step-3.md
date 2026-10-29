# Brief: game builder step 3, Play mode in Dream World

Step 3 of "First concrete steps" and Phase 1 of `docs/game-builder-plan.md`. Read first:
`working-with-claude.md`, `CLAUDE.md`, the plan's Phase 1 and key decision 1, `dream-common/sim/README.md`
and `sim/index.js` (`createSim`, `step`, `createLocalServer`: the in-process server with `connect`,
`send(intent)`, `onSnapshot`), `docs/zone-format.md`, `K:\dream-world\src\{main.ts,ui.ts,zones.ts,
windows.ts,camera.ts,world.ts,animals.ts}` (the editor after slot 4; the disabled Play button is in
`ui.ts` line 76), `K:\dream-characters\main.js` (`loadBase`, `loadCombined`, `rebind`, `dress`,
`coverSkin`, `playClip`: the character assembler that must move to `dream-common/web/client/` so Play
spawns exactly what the tool saved), and `Dream Forge/README.md` for `meta.colliders` on pieces.

## What it is

Press Play in Dream World and you are in the zone: your saved Dream Character drops in, third-person
camera, WASD and click-to-move, walking on the terrain and stopped by pieces' colliders, npcs wandering,
play-once effects on interact. It runs through `sim/` with the local in-process server, so the client
only sends intents and renders snapshots: the netcode seam is real from day one. Stop returns to the
editor with nothing changed.

## Deliverables

1. **Character runtime** `dream-common/web/client/character.js`: the assembler lifted out of Dream
   Characters (load a saved character GLB from the Library, bind its skeleton, pick `idle`, `walk`,
   `run` clips from its meta, play and crossfade, set a tint from the recipe) as a plain ES module on
   `/common/vendor/three`. Dream Characters imports it instead of its own copy (its behaviour
   unchanged: check the robed test character still opens there).
2. **Zone to sim**: `dream-world/src/play/world-bridge.ts` builds the sim's `{ zone, cells, templates }`
   from the open zone, with each placed piece's `meta.colliders` (from the Library meta, `scale` applied)
   turned into `collider` components when the entity has none, and animals as `npc` wander entities.
3. **Play mode** `dream-world/src/play/`: the Play button (enabled when a zone is open) hides the editor
   windows and gizmo, keeps terrain, objects, water, sky and effects rendering, starts `createSim` plus
   `createLocalServer`, connects one player, spawns the player's character (the character picked in a
   small Play settings popover: any kind `character` piece in the Library, remembered), and renders
   from snapshots: player and npc transforms lerp between the last two snapshots, animation state from
   speed (idle, walk, run). Third-person camera (orbit with the right button, zoom, follows the player,
   collides softly with terrain). Inputs: WASD relative to the camera, Shift to run, click on ground to
   `moveTo`, E on a nearby `interact` entity, Esc or the Stop button to leave. A small HUD from
   `ui-templates.js` using the Project Y bars (health at full, stamina draining on run and refilling)
   and the character's name. Stop restores the editor and selection exactly.
4. **Npcs in play**: animals and `npc` entities move by the sim's wander and patrol, rendered through
   the same bridge; a Dream Character with an `npc` component walks with its own clips.
5. **Effects on interact**: an entity with `interact` and an `fx` component plays its effect once
   (fx.js `play`) when the player interacts; a `light` component lights in play as in the editor.
6. **Tests**: the bridge (zone with two pieces and an animal becomes a sim world with the right
   colliders and npcs) in `dream-world/src/play/bridge.test.ts` with the project's test runner; the sim
   tests stay green.
7. **Docs**: `dream-world/README.md` (Play mode: controls, what runs where), `dream-common/web/client/README.md`,
   a step 3 line in `docs/game-builder-plan.md`.

## Rules

- Only CC0 assets or Graves's own content (the saved characters are). The client never moves itself:
  intents in, snapshots out, prediction can come later. Plain JS in `dream-common/web/client`,
  TypeScript under Vite in Dream World (no restart for `src/`). Nothing names another port.
- `sim/` is not changed except for a bug you find (test it, say so); the schema is not changed.
- Keep each new file under about 500 lines.
- Commit per repo with what changed and why and the `Co-Authored-By` line the session gives you; push
  `origin main`; mirror with `git -C /z/<repo> -c safe.directory='*' pull --ff-only`. Patch files with
  a Python script written by the Write tool.
- Write scopes: `dream-common/web/client/*`, `dream-world/src/play/*`, `dream-world/src/{ui.ts,main.ts,
  windows.ts,camera.ts}` for the wiring only, `dream-world/README.md`, `dream-characters/main.js` (the
  import swap only), `docs/game-builder-plan.md` (one line). Not `dream-common/sim` beyond a tested
  bug fix, not `dream-common/web/ui`, not `Dream Forge`.

## Done means

Verified in the browser on port 5240 (Library on 5230, both running) and reported with what was
checked against what was assumed: Crystal Cascades opened from its zone, Play pressed, "Test robed g6"
walks on the terrain with WASD and runs with Shift, is stopped by a Creek boulder's collider and walks
round it, click-to-move crosses the sandbank, the camera follows and orbits, the stamina bar drains on
a run and refills, an animal wanders, E on a lantern with `interact` and `fx` plays Hit sparks once,
Stop returns to the editor with the same selection and nothing moved; Dream Characters still opens the
robed character; the bridge test and the sim tests pass.
