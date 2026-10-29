# Dream game builder: bridging tool and game (plan, 2026-10-29)

Goal: Dream tools become a complete game builder with an authoritative, MMO-style server.
Research inputs (ideas only, no code copied): Reldens (MIT), RealmCrafter (no licence), mmorpg-builder (MIT),
the user's own K:\dev-hafen-server.

## Key decisions

1. **Server in Node, not the Python hafen-server.** The simulation must be one headless JS module
   (`dream-common/sim/`) that the server runs authoritatively and the client runs for prediction.
   hafen-server speaks the Haven & Hearth UDP protocol to Seatribe's client and uses their assets, so it
   can't ship as-is; mine its game-system designs (food/stamina, wounds, crafting, farming, claims, tick
   subsystems, GM portal) as references when porting systems to `sim/`.
2. **Content is declarative, schema-validated JSON** in the library (no relational tables, no JS-as-data).
3. **The Dream editors are the authoring tools**; the server reads published content, never client edits.
4. **Interest management from day one**: world split into fixed cells.

## Phase 0: formats (dream-common)
- Schemas (like fx.js SCHEMA) for: scene, piece, character, **zone**, **entity template**, item, ability.
- Split scenes into 64 m cells (`zone/<id>/cells/x0z0.json`) for diffs, streaming and AOI.
- Entity = template id + components: `spawn`, `npc` (stationary/patrol/wander/follow/flee), `collider`,
  `interact`, `loot`, `shop`, `door/portal`, `light/fx`. Inspector panels in Dream World per component.
- Generic modifier model for items/abilities/buffs: `{stat, op, value, duration}`.

## Phase 1: Play mode, single player (Dream World)
- A Play button: spawn a Dream Characters character, third-person camera, walk on terrain with collision.
- Runs through `sim/` locally with a fake in-process "server", so the netcode seam exists from the start.
- Heightfield + piece colliders exported from the scene (navigation/validation data).

## Phase 2: Dream Server (new module, port 5280)
- Node + `ws`, a small own protocol (JSON first, binary later). One process hosts zone rooms.
- Fixed tick (20 Hz). Clients send **intents only** (move dir, click-to-move target, interact, use ability);
  the server steps movement and validates targets against the heightfield.
- AOI: clients subscribe to their cell + neighbours; snapshots/deltas per cell.
- Rooms per zone, persisted, disposed when empty; handoff at zone portals.
- Persistence behind a small repository interface: JSON files first (like hafen-server saves), SQLite later.
- State scopes: player (durable), world (shared durable), session (room-only).
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

New authoring: Dream Codex 5280 (items, abilities, stats, modifiers, loot, NPC templates, shops),
Dream Story 5290 (quests, dialogue, triggers, flags), Dream Motion 5300 (animation library, retarget,
clip-to-ability timing), Dream Sound 5310 (later).

Shared code in dream-common: `sim/`, `net/`, `schemas/`, `client/` (game runtime + HUD).

Server side: Dream Server (gateway, zones, store, chat as plugins), Dream Publish (validate, bake, pack,
push), Dream GM (VPN only), Dream Bots (test/load bots, replay regressions). Dream Client = the public
game, built from `client/` + `sim/`, the same runtime as Play mode.

Build order: schemas + sim, Play button, Dream Server, Codex, Publish + GM, Bots, then Story/Motion/Sound.

## Ideas from SpacetimeDB, FOnline, AzerothCore (ideas only; BSL / MIT / GPL-2.0)
1. Entity properties declared once with **save and sync flags** (saved, server-only, owner-only, public).
2. NPC and quest behaviour as **event → condition → action** data rows (no code in content).
3. **Conditional:** state changes as named, logged transactions (replay + audit), adopted only if the
   cost is reasonable. Measure CPU, memory and storage per player-hour with bots first; fall back to
   logging only player intents + periodic snapshots (cheap, still replayable) if it isn't.
4. **Grid wake/sleep**: cells with no players nearby stop ticking.

## First concrete steps
1. Write zone/cell/entity/component schemas in dream-common and convert one Dream World scene to cells.
2. `sim/` skeleton: world, entities, tick, intent movement on a heightfield.
3. Play mode in Dream World using `sim/` locally.
4. Dream Server with one zone, two browsers walking around together.
