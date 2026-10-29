# Dream game builder: bridging tool and game (plan, 2026-10-29)

Goal: Dream tools become a complete game builder with an authoritative, MMO-style server.
Research inputs (ideas only, no code copied): Reldens (MIT), RealmCrafter (no licence), mmorpg-builder (MIT),
the user's own K:\dev-hafen-server.

## Key decisions

1. **Server in Node, not the Python hafen-server.** The simulation must be one headless JS module
   (`dream-common/sim/`) that the server runs authoritatively and the client runs for prediction.
   `sim/` imports no renderer: its own small vector maths, no three.js (Skyfall Blade's `sim.ts`
   imports three, so its pattern is ported, not its imports). The client wraps sim state for three.js.
   hafen-server speaks the Haven & Hearth UDP protocol to Seatribe's client and uses their assets, so it
   can't ship as-is; mine its game-system designs (food/stamina, wounds, crafting, farming, claims, tick
   subsystems, GM portal) as references when porting systems to `sim/`. hafen-server's own plan
   (`dev-hafen-server/PLAN.md`) is paused while this is built; the two compete for the same time.
2. **Content is declarative, schema-validated JSON** in the library (no relational tables, no JS-as-data).
3. **The Dream editors are the authoring tools**; the server reads published content, never client edits.
4. **Interest management from day one**: world split into fixed cells.
5. **Finish the base tools first** (section below). The tools are the game's content pipeline and
   parts of them run inside the game client and server, so they come before the server work.

## Phase 0: formats (dream-common)
- Schemas (like fx.js SCHEMA) for what the first steps need: **zone** (terrain + cells), **cell**
  (entities), **entity template** with its components, and character (what Dream Characters saves).
  Item, ability and quest schemas arrive with Dream Codex and Dream Story, not here.
- Split a zone's entities into 50 m cells (`zone/<id>/cells/x0z0.json`) for diffs, streaming and AOI.
  50 divides every Dream World map size (100, 200, 400 m; `main.ts` MAP_SIZES). Terrain (heights,
  splat, water) stays one file per zone: cutting it into cells would add seam and edge-ownership work
  for no gain until a zone is bigger than a browser wants to hold.
- Entity = template id + components: `spawn`, `npc` (stationary/patrol/wander/follow/flee), `collider`,
  `interact`, `loot`, `shop`, `door/portal`, `light/fx`. Inspector panels in Dream World per component.
- Generic modifier model for items/abilities/buffs: `{stat, op, value, duration}`.
- **Step 1 done (2026-10-29):** schemas in `web/schema/` (zone, cell, entity and templates, components
  with the modifier, character) on one walker, `web/zone.js` (cells, scene <-> zone), Library kind `zone`,
  Save as zone / Open zone in Dream World, Crystal Cascades converted; `docs/zone-format.md`.
- **Step 2 done (2026-10-29):** `sim/` skeleton (heightfield, world with cell hash, colliders, intents, 20 Hz
  tick with seeded RNG and replayable intent log, wander/patrol npcs, local server with per-cell snapshots);
  `sim/README.md`, `test/sim.test.mjs`.

## Phase 1: Play mode, single player (Dream World)
- A Play button: spawn a Dream Characters character, third-person camera, walk on terrain with collision.
- Runs through `sim/` locally with a fake in-process "server", so the netcode seam exists from the start.
- Heightfield + piece colliders exported from the scene (navigation/validation data).

## Phase 2: Dream Server (new module, port 5320)
- Node + `ws`, a small own protocol (JSON first, binary later). One process hosts zone rooms.
- Fixed tick (20 Hz). Clients send **intents only** (move dir, click-to-move target, interact, use ability);
  the server steps movement and validates targets against the heightfield.
- AOI: clients subscribe to their cell + neighbours; snapshots/deltas per cell.
- Rooms per zone, persisted, disposed when empty; handoff at zone portals.
- Persistence behind a small repository interface: JSON files first (like hafen-server saves), SQLite later.
- State scopes: player (durable), world (shared durable), session (room-only). The World store writes
  player scope on a timer and on disconnect; the Gateway reads it for the character list.
- Auth: simple accounts with hashed passwords and signed session tokens (no default secrets).

## Phase 3: publish pipeline
- "Publish zone" in Dream World: validates schemas, bakes colliders, writes a versioned content pack.
- Server loads packs to **staging**, then promotes to **live**; rooms hot-reload on promote.
- Library assets referenced by content hash so clients cache and the server checks versions.

## Phase 4: first gameplay systems (in sim/, data-driven)
- NPC behaviours, interact/doors, inventory + items, loot, simple combat with abilities + modifiers,
  then crafting/gathering (port ideas from hafen-server), quests/dialogue.
- Feature registry + event bus with before/after hooks so systems are plugins.
- GM/admin page on the server (online players, teleport, spawn, reload).

## Phase 5: scale and test
- Headless bot clients (like hafen-server's playbridge) for load and regression tests.
- Binary deltas, zone processes across machines, Morty as the first host.

## Finish the base tools first
The Dream tools are not just editors: their output is the game's content and some of their code runs
in the game client and server (the character assembler, the effects runtime, the UI). So the base set
is completed before Dream Server, and each tool's runtime half moves to `dream-common` as it is needed.

- **Dream Sound (5310), a new base tool.** An extremely light version of the GravepainAudio Unity
  project, not a port of it: the existing `gravepain-audio-web/PLAN.md` (Pad, Studio and a DJ game on
  one engine) is too big for this and is not the plan here; only its Unity-to-Web-Audio mapping table
  is reused as a reference. Dream Sound works on Graves's own CC0 sounds in the library and makes:
  a **slicer** (cut a recording into one-shots, trim, normalise, save each as a library sound), a few
  **filters** (low/high pass, echo, reverb, gate, from native Web Audio nodes), the GravepainAudio
  **basic synth** (subtractive, presets, render a note to a sound), a **note generator** (the chord,
  melody and riff dice) and a **clip editor** (steps over a kit, play, render to a clip). Output is
  `.sound.json` + audio companions and `.clip.json` in the library; the game client plays them through
  a small `dream-common/web/audio.js` runtime, the same one the editor previews with.
- **Dream Paint: UI templates.** The sprite editor gets templates for game UI: inventory grid, hotbar,
  dialogue box, health and stamina bars, buttons, frames and icons at fixed sizes, saved as
  `.ui.json` + sprites with nine-slice borders and named slots. The game HUD in `client/` is built
  from these, so a UI drawn in Paint is what the player sees.
- **Dream Characters:** its assembler (parts, tints, scale, animations) moves to `dream-common/client/`
  and the tool imports it, so Play mode and the game spawn exactly what the tool saved.
- **Dream Effects:** `fx.js` already is the shared runtime; ability and hit presets are added when
  Codex needs them.
  Done 2026-10-29: play-once effects (`fx.play({ at, follow })` with `done`), per-layer start and duration, ring and trail layers, Library textures and flipbooks, six presets in `Effects/Abilities/`.
- **Dream Forge:** collider proxies (box, capsule, cylinder) per piece in the template; mesh colliders
  from `.mesh.json` only later.
  Done 2026-10-29: auto-fit on save, the Colliders panel in Edit, `meta.colliders` + GLB root `extras.colliders` (`{ shape, size, trigger, x, y, z, rotY }`), `kit.collider` for Blender pieces.
- **Dream Library:** a `licence` field per place; publish refuses assets from places not cleared for the
  public client (`K:\non-cc0-packs` exists beside `cc0-packs`). Publish also resolves every reference
  (piece paths, template ids, effect and sound names) and fails on a miss, not only the shape check.

## Services (separable; one Node process at first, split later)
| service | job | exposure |
|---|---|---|
| Gateway | login, accounts, tokens, character list, which zone server | public |
| Zone servers | live sim per zone(s), 20 Hz tick, AOI deltas | public (WSS) |
| World store | player + world persistence behind a repository interface | internal |
| Content | published packs + assets, static, content-hashed | public read-only |
| Chat / social | chat, friends, guilds | public |
| Admin / GM | GM tools, publish/promote | VPN only |
| Library + editors | authoring | LAN only (Morty) |

## Hosting
- **Morty = development + staging** (LAN only: editors, library, publish pipeline, staging server).
  Not exposed publicly (that would need an OS reinstall, hardening and a DMZ).
- **VPS = live**, public services only. Morty pushes signed, versioned content packs + server builds
  over Tailscale/WireGuard or SSH; the VPS never connects into the LAN. Morty pulls nightly save backups.
- VPS hardening: ports 22 (keys/VPN only), 80, 443; Caddy TLS; auto updates; non-root service;
  firewall + fail2ban; admin page reachable only over the VPN.
- Home line (1 Gb, static IP) is a later option for a DMZ-hosted zone server behind the VPS gateway.

## Security model (public)
- Client is a display + controller: sends intents only; the server validates range, cooldown, path, ownership.
- Rate limits and message size caps per connection and account; kick on malformed data.
- Passwords argon2/bcrypt; short-lived signed tokens; secrets from config, never defaults; login throttling.
- HTTPS/WSS only. Content is schema-validated on publish and contains no code.
- No player uploads at first; later, filtered and size-capped. Audit log of GM actions; backups.

## Testing layers (agent-friendly, cheapest first)
1. Sim tests: `sim/` runs headless in Node (spawn, walk, hit, assert).
2. Bot clients: Node scripts over the real protocol acting on state; many at once = load test.
3. Replays: seed + inputs re-simulated after changes as regression tests (as in Skyfall Blade).
4. Browser + screenshots (like Skyfall Blade's devsnap) only for visual checks.

## Modules
Existing: Portal 5170 (hub, staging status, publish history), Dream Library 5230 (+ zone, entity template,
item, ability, quest kinds), Dream Forge 5210 (+ colliders, LODs), Dream World 5240 (zone editor + Play
button), Dream Paint 5250 (+ UI/item icons), Dream Effects 5260 (ability/hit VFX), Dream Characters 5270.

New authoring: Dream Sound 5310 (base tool, see above), Dream Codex 5280 (items, abilities, stats,
modifiers, loot, NPC templates, shops; may start as a tab in the Library page), Dream Story 5290
(quests, dialogue, triggers, flags), Dream Motion 5300 (animation library, retarget, clip-to-ability
timing; later, if needed).

Shared code in dream-common: `sim/`, `net/`, `schemas/`, `client/` (game runtime + HUD).

Server side: Dream Server 5320 (gateway, zones, store, chat as plugins), Dream Publish (validate, bake, pack,
push), Dream GM (VPN only), Dream Bots (test/load bots, replay regressions). Dream Client = the public
game, built from `client/` + `sim/`, the same runtime as Play mode.

Build order: Dream Sound and the Paint UI templates (finish the base tools), schemas + sim, Play button,
Dream Server, Codex, Publish + GM, Bots, then Story and Motion.

## Ideas from SpacetimeDB, FOnline, AzerothCore (ideas only; BSL / MIT / GPL-2.0)
1. Entity properties declared once with **save and sync flags** (saved, server-only, owner-only, public).
2. NPC and quest behaviour as **event → condition → action** data rows (no code in content).
3. **Conditional:** state changes as named, logged transactions (replay + audit), adopted only if the
   cost is reasonable. Measure CPU, memory and storage per player-hour with bots first; fall back to
   logging only player intents + periodic snapshots (cheap, still replayable) if it isn't.
4. **Grid wake/sleep**: cells with no players nearby stop ticking.

## Netcode decisions (Gambetta, Valve, Fiedler, Colyseus, geckos.io, HYTOPIA, Hordes.io, Ryzom Core)
- **Own small `ws` server, not Colyseus.** Its Schema state would couple `sim/` to its types and its
  StateView is weak at large AOI; pre-1.0 churn. Borrow: seat reservation before connect, reconnection
  tokens with a hold window, validate every message (disconnect on failure), patch rate separate from
  tick, graceful shutdown, load-test harness.
- **ECS: Miniplex-style** (MIT; plain JS objects as entities, archetype queries) or a ~200-line in-house
  equivalent. Not bitECS (typed arrays clash with JSON templates; MPL). Save/sync flags drive serializers.
- **Transport:** binary WebSocket (`perMessageDeflate: false`) behind a transport interface with
  reliable and unreliable lanes; geckos.io (WebRTC) or WebTransport for the unreliable lane later, only
  if measured loss hurts. Keep WS fallback.
- **Model:** server-authoritative; client predicts only its own movement and cosmetic cast starts;
  never damage/HP/death. Server reconciliation via `lastInputSeq`, smooth corrections over ~100 ms.
  Others interpolated ~100 ms in the past (150 ms on jitter). No full lag-compensation rewind: melee and
  tab-target get range/arc tolerance (0.5–1 m) server-side.
- **Numbers:** 20 Hz sim and snapshots near, ≤10 Hz far; inputs once per tick carrying last 3; server
  input buffer 1–2 ticks, repeat last move ≤3 ticks; seeded RNG, fixed dt 0.05.
- **Snapshots:** delta against each client's acked baseline (keep ~32), per-entity field bitmask, full
  state on AOI enter. Quantise position int16 relative to cell origin, yaw uint8/16, HP % byte.
  ~6–10 bytes per moving entity; packet cap ~1.2 KB with a priority accumulator. AOI = 3×3 cells,
  ~8 m leave hysteresis.
- **Messages:** C_HELLO, C_INPUT, C_MOVE_TO, C_CAST, C_ACK, C_PING; S_WELCOME, S_SNAPSHOT, S_ENTER,
  S_LEAVE, S_EVENT[], S_CAST_RESULT, S_PONG, S_CHAT. Clock sync from PING/PONG.
- **Scale target:** a few hundred concurrent players per zone process; zone-owned state with explicit
  cross-zone handoff (avoid Ryzom's shared-memory mirror and global singletons). One process with code-level
  service boundaries until profiling says split.
- **Asset budget as a design rule** (Hordes): vertex colours, small textures, stream after login.
- **Content compiled** from editor output to versioned bundles (Ryzom's primitives + sheets idea).

## Language: TypeScript for the shared game code
`sim/`, `net/`, `schemas/`, `client/` and Dream Server are **TypeScript** (types on both sides catch
mistakes before testing, and Claude works best in it). The existing Dream tools stay plain JS and use
the compiled output. Schemas are TS types plus runtime validators generated from one source.

## RPG-JS (MIT, TypeScript, 2D) — ideas only
- One game, two modes: same code single-player in the browser or on the server (= our Play button vs
  Dream Server).
- Events as objects with hooks (`onAction`, `onPlayerTouch`, `onChanges`) for engine-side behaviour;
  creators still author event → condition → action data.
- Player/module hooks (`onConnected`, `onJoinMap`, `onLevelUp`) = our feature registry + event bus.
- Built-in items, skills, states, classes, levels as a checklist for Dream Codex.
- Not adopted: 2D (Tiled/PixiJS), mid-rewrite to v5, one main developer. Same verdict as ET:
  take the architecture, not the framework. Skyfall Blade's fixed-tick seeded sim is the in-house
  reference for starting `sim/`. Its co-op is not a netcode reference: the host's browser runs the one
  sim at 60 Hz and guests draw snapshots with no prediction (`net.ts`). Prediction, reconciliation,
  interpolation and delta snapshots are all new code with no precedent in the series: the riskiest
  part of Phase 2, gated by first concrete step 4 before any gameplay system.

## First concrete steps
1. Write zone/cell/entity/component schemas in dream-common and convert one Dream World scene to cells. **Done** (`zone-format.md`).
2. `sim/` skeleton: world, entities, tick, intent movement on a heightfield.
3. Play mode in Dream World using `sim/` locally.
4. Dream Server with one zone, two browsers walking around together.
