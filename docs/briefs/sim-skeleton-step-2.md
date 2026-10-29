# Brief: game builder step 2, the sim skeleton

Step 2 of "First concrete steps" in `docs/game-builder-plan.md`. Read first: `working-with-claude.md`,
`CLAUDE.md`, the plan's Key decisions (1 above all), Phase 1, Phase 2's tick and intent rules, "Testing
layers" and "Netcode decisions"; `docs/zone-format.md` and `dream-common/web/schema/*` (the entity and
component shapes the sim loads); `K:\skyfall-blade\src\game\sim.ts` for the pattern only (fixed tick,
one clock, intents logged per tick, deterministic, seeded randomness): its three.js imports are not
copied. `dream-world/src/terrain.ts` for how heights are stored (`heights`, `res`, `size`) so the sim's
heightfield reads the same data.

Two other sessions run at the same time: the Dream World editor rebuild (`dream-world/*`,
`dream-common/web/ui/*`) and Forge collider proxies (`Dream Forge/*`). Do not touch those paths.

## What it is

`dream-common/sim/`: one headless JS module that the server will run authoritatively and the client
will run for prediction. No renderer, no three.js, no DOM: its own small vector maths. It loads a zone
(terrain plus cells) and entity templates, keeps entities, steps at a fixed 20 Hz, and moves players by
intents over the heightfield with collision against entity colliders. Play mode (step 3) wraps it.

## Deliverables

1. **`sim/math.js`**: vec3 add/sub/scale/length/normalise/lerp, a yaw helper, all on plain arrays or
   `{x,y,z}` (pick one and keep it).
2. **`sim/heightfield.js`**: from a zone's `terrain` (decode the base64 heights as `terrain.ts` does),
   `heightAt(x, z)` bilinear, `normalAt`, `slopeAt`, `inBounds`, `waterLevel`.
3. **`sim/world.js`**: `createWorld({ zone, cells, templates })` resolving each entity's components
   over its template (`entity.components` override `template.components`), ids by uid, a spatial
   hash by cell (50 m) for queries (`near(x, z, r)`), `addEntity`, `removeEntity`, `get(uid)`.
4. **`sim/colliders.js`**: box, sphere, capsule and cylinder from the `collider` component on an entity
   transform; `resolve(pos, radius, height)` pushes a capsule player out of them; the heightfield is
   the floor; slopes over `maxSlope` (45°) are walls; a `walkable(x, z)` query.
5. **`sim/intents.js` and `sim/tick.js`**: intents `move {dir, run}`, `moveTo {x, z}`, `face {yaw}`,
   `interact {uid}`, `stop`; `step(world, dt)` applies every player's current intent (speed, run
   multiplier, acceleration, gravity, ground snap, collision), advances `npc` entities' `wander` and
   `patrol` modes on the same rules, fires `events` (`enter cell`, `interact`, `blocked`) to listeners.
   Fixed `TICK = 1/20`, an accumulator so callers step at any rate, a deterministic seeded RNG, and an
   intent log per tick so a run replays.
6. **`sim/index.js`** exporting the above and a `createLocalServer(sim)`: the fake in-process server
   of Phase 1, with `connect()` returning `{ send(intent), onSnapshot(cb) }` and snapshots per cell
   (`{ tick, cell, entities: [{uid, x, y, z, yaw, anim}] }`) so the netcode seam exists from the start.
7. **Tests** `dream-common/test/sim.test.mjs` with `node --test`: a player walks across Crystal
   Cascades' zone (load `K:\dream-forge-creations\Zones\Crystal Cascades\`) and stays on the
   heightfield; a wall of boxes stops it; a 60° slope stops it; an npc wanders within its radius; two
   runs with the same seed and intent log produce the same positions; the local server emits
   snapshots at 20 Hz for the player's cell and its neighbours only.
8. **Docs**: `dream-common/sim/README.md` (what it is, the tick rule, intents, how the client will wrap
   it) and a step 2 line in `docs/game-builder-plan.md`.

## Rules

- Plain ES modules, no packages, no three.js, no DOM, nothing that reads the window. Runs in Node and
  in the browser unchanged. Keep each file under about 400 lines.
- Only CC0 assets or Graves's own content (none needed here).
- Commit with what changed and why and the `Co-Authored-By` line the session gives you; push `origin
  main`; mirror with `git -C /z/dream-common -c safe.directory='*' pull --ff-only`. Patch files with a
  Python script written by the Write tool.
- Write scopes: `dream-common/sim/*`, `dream-common/test/sim.test.mjs`, `docs/game-builder-plan.md`
  (one line). If the zone or component schema needs a field (for example `collider` sizes or an npc
  speed), add it in `dream-common/web/schema/components.js` with a test and say so in the report; do
  not touch `dream-world` or `dream-common/web/ui`.

## Done means

`node --test test/sim.test.mjs` green and reported with what was checked against what was assumed; a
short Node script in the report's output walks a player 20 m across Crystal Cascades and prints its
path on the heightfield; the README is written.
