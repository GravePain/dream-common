# sim: the headless game simulation

Step 2 of `docs/game-builder-plan.md` (key decision 1). One set of plain ES modules that the Dream Server
will run authoritatively and the client will run for prediction. It imports no renderer, no three.js, no
DOM and reads nothing from the window, so it runs unchanged in Node and in the browser. Its maths is its
own (`math.js`, plain `{ x, y, z }` objects).

| File | What it does |
| --- | --- |
| `math.js` | vec3 add, sub, scale, length, normalise, lerp; yaw helpers (yaw 0 faces +z, as `rotY` in Dream World) |
| `heightfield.js` | a zone's `terrain` decoded as Dream World stores it (`terrain.ts`, `save.ts`): `heightAt` (bilinear), `normalAt`, `slopeAt`, `inBounds`, `waterLevel` |
| `world.js` | `createWorld({ zone, cells, templates })`: entities by uid with components resolved over their template, a spatial hash by 50 m cell, `near(x, z, r)`, `addEntity`, `removeEntity`, `get` |
| `colliders.js` | box, sphere, capsule, cylinder from the `collider` component; `resolve` pushes a capsule out; `tooSteep`; `walkable(x, z)` |
| `intents.js` | the intents and their check |
| `tick.js` | `createSim`, `step` (accumulator), `stepOnce`, the seeded RNG, the intent log, `replay`, player and npc movement |
| `systems.js` | step 10: the feature registry (`registerSystem`) and the event bus (`gate`, `done`, `fire`) |
| `systems/*.js` | the built-in systems: `ai.js` (follow, flee, hostile), `stats.js` (pools, modifiers, death, respawn), `abilities.js` (cast), `items.js` (inventory, equipment, loot, drops, pickup, use), `tables.js` (the default tables, `checkTables`, `readTables`; no imports, so the Codex page runs it too) |
| `index.js` | all of the above and `createLocalServer(sim)` |
| `walk.mjs` | `node sim/walk.mjs`: walks a player 20 m across Crystal Cascades and prints its path |

Tests: `node --test test/sim.test.mjs` from `dream-common`.

## The tick rule

- One clock: `TICK = 1/20` s. `step(sim, realDt)` adds real time to an accumulator and runs every whole
  tick it covers, so a caller can step at 60 Hz, at 20 Hz or once with a second and get the same result.
- Inputs arrive only as intents. `sim.intent(uid, i)` queues one; it is applied at the start of the next
  tick and written to `sim.log` as `{ tick, uid, intent }`. Joins and leaves are logged the same way.
- All randomness comes from `sim.random`, one mulberry32 stream from `seed`. Players, then npcs, are moved
  in uid order. So `replay(opts, sim.log, ticks)` gives the same positions bit for bit (tested).
- Each tick a mover accelerates toward its wanted velocity, turns toward where it goes, is stopped by the
  zone edge, by ground climbing steeper than 45 degrees (`MAX_SLOPE`; downhill is allowed) and by solid
  colliders (on a collider or edge it slides: the velocity into the wall is dropped and speed never goes above
  the tick's intended speed), then falls under gravity or snaps to the ground (within 0.4 m). `y` is always the ground
  under it while walking. Numbers are in `MOVE` (walk 4 m/s, run x1.8).
- Events go to `sim.on(type, cb)`: `enter cell` `{ uid, from, to }`, `interact` `{ uid, target, verb, ok,
  reason }`, `blocked` `{ uid, reason: edge | slope | collider, by }` (on the tick it starts), and `tick`.

## Intents

`move { dir: { x, z }, run }` (until another order), `moveTo { x, z, run }` (stops on arrival), `face { yaw }`,
`interact { uid }` (one-shot: in range is the entity's `interact.range` plus the player's radius; movement
carries on), `stop`. A malformed intent is dropped and `sim.intent` returns false.

## Npcs

Entities with an `npc` component in mode `wander` or `patrol` are movers on the same rules, at `npc.speed`.
Wander picks walkable points inside `radius` of `home` from the seeded stream and waits 1 to 3 s at each;
patrol walks `npc.points` in a loop (a square of `radius` round `home` when there are none). Stationary,
follow and flee stand still for now.

## Colliders

From `collider` (`web/schema/components.js`), times the entity's scale, standing on its base point: a box
is `size` x, y, z full extents turned by the entity's yaw; a sphere has radius `size.x`; a capsule or
cylinder is `max(size.x, size.z)` wide and `size.y` tall. Triggers are not solid. The player is an
upright capsule (radius 0.35, height 1.8). Shapes are only tested where their height span meets the
player's; that span reaches `STEP_DOWN` (0.4 m, `MOVE.snap`) below the feet, so a shape on lower ground still
blocks a step down onto it, and a step is tested from the lower of the feet and the destination's ground (a run
down a steep bank drops further than the margin in one tick). Standing on tops is not built yet.

## The local server, and how the client will wrap it

`createLocalServer(sim)` is Phase 1's fake in-process server, shaped like the real one will be over a
socket: `connect({ uid, x, z })` joins a player and returns `{ send(intent), onSnapshot(cb), close() }`;
`update(dt)` (or `start()` for a 20 Hz timer) steps the sim, and after each tick every client gets one
snapshot per cell of its area of interest (its cell and the neighbours inside the zone):
`{ tick, cell, entities: [{ uid, x, y, z, yaw, anim }] }`, movers only (scenery comes from the cell files).

Play mode in Dream World (step 3) will: load the zone and cells, make a sim and a local server, `connect`
the player, turn keys and clicks into intents with `send`, and draw from snapshots, copying each
entity's `x, y, z, yaw` into a three.js object and its `anim` into the character's mixer. For prediction
the client will later run its own sim with the same intents and correct to the server's snapshots.

## Systems (step 10)

`registerSystem({ name, components, onTick, onIntent, onJoin, init, before, after })` adds a plugin to the
registry; every sim binds the registered systems in order (ai, stats, abilities, items; `createSim({
systems: [...names] })` for fewer, `[]` for none). Each tick, after the players and the sim's own npcs move,
each system's `onTick` runs in that order. An intent movement does not take (`cast`, `pickup`, `use`,
`drop`) goes to the systems' `onIntent` until one takes it. Named events go through the bus: `before`
hooks may veto (return false) or amend (change the event in place), `after` hooks run once it happened,
then the listeners hear it. `interact`, `damage`, `pickup`, `death` and `drop` go through it.

`createSim({ tables, spawn })`: the gameplay tables (`docs/tables.md`; built-in copies when not given)
and the player respawn point (the bridge's `spawn`).

- **Stats** (`stats` component on npcs, always on players; defaults in `MOVE`: 100 health, 100 stamina,
  walk speed): stamina drains on a run (6 s) and refills (3 s), empty means tired (no running until 30 %);
  health regenerates 1/s after 5 s without combat; modifiers lapse after their duration. At 0 health
  `death`: the order drops, `anim: 'death'` for 3 s, then a player `respawn`s at the spawn with full stats and
  an npc is removed (`despawn`) and back after its `spawn.respawn` seconds (`spawned`, same uid).
- **Abilities** (`cast { ability, target?, x?, z? }`): exists and allowed, alive, cooldown, stamina, then
  the target in range (+ `TOLERANCE` 0.75 m, from the target's capsule) and arc; `castResult` to the
  caster, `cast` for everyone's pose and fx, the hit as `damage` then the effects. A projectile hits after
  distance / speed.
- **Npcs**: `follow` and `flee` modes move now; a `hostile { radius, speed, ability }` npc aggros the
  nearest living player within radius (`aggro`), chases, faces and casts with the same checks, and goes
  home (healing full, `home`) once its target is 2x radius from home.
- **Items**: players carry `inventory { size, slots }` (12; a join may bring a saved one); `pickup { uid }`
  within 2 m, `use { slot }`, `drop { slot }`; `loot { table }` rolls on death and when opened (re-armed
  after its `spawn.respawn` s, else 60); drops are entities with `model` and `pickup`, gone after 120 s.
  Events: `inventory`, `itemResult`, `drop`, `despawn`, `use`.

All chance is `sim.random`, all order is uid order: `test/systems.test.mjs` replays casts, a hostile, loot
and pickups bit for bit, and the older replay in `sim.test.mjs` runs with every system on.

## Not here yet

Water (a player walks the sea floor; `waterLevel` is read, not used), standing on colliders, jumping,
players blocking each other, mesh colliders, deltas instead of whole snapshots, and
templates on disk (none exist; `createWorld` takes them as data).
