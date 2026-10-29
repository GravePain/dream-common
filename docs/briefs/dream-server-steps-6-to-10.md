# Brief: game builder steps 6 to 10 (the rest of Phase 2, Phase 3, the first of Phase 4)

Five steps, run one at a time in this order, each by its own session, each verified before the next starts.
Every step reads first: `working-with-claude.md`, `CLAUDE.md`, `docs/game-builder-plan.md` (Phase 2 to 4,
"Services", "Security model", "Netcode decisions", "Testing layers"), `dream-common/sim/README.md`,
`dream-common/net/README.md`, `K:\dream-server\README.md`, and the step 4 and 5 briefs in this folder for the
shapes already agreed (rooms, protocol, `Conn`, predictor, bots). The current state: the Dream Server (5320)
runs zone rooms over `sim/` at 20 Hz; clients send sequenced intents and predict their own movement; other
players are interpolated; saves are JSON files per player name; there is no auth, deltas, handoff or gameplay.

Rules for every step:

- Plain ES modules; `ws` is the only package, only in `dream-server`; Node 24's built-in `node:sqlite` counts
  as no package. Only CC0 assets or Graves's own content. The schema (`web/schema/*`) changes only where a
  step says so, with a test. `sim/` changes only as a step says. New files under about 400 lines.
- Clients never move themselves in the server's eyes; the server validates every message, range, cooldown,
  ownership; a malformed message closes the socket. No default secrets: a missing secret refuses to start.
- Commit per repo with what changed and why and the `Co-Authored-By` line the session gives you; push
  `origin main`; mirror with `git -C /z/<repo> -c safe.directory='*' pull --ff-only`; restart the Dream Server
  locally (kill the PID on 5320, `node server.mjs` in `K:\dream-server`) and on Morty (`taskkill` over ssh,
  then `timeout 8 ssh morty 'cd /d D:\Public\dream-server && node server.mjs'`), say both answer `/health`.
  Patch files with a Python script written by the Write tool. Tests with `node --test`
  (`K:\skyfall-blade\.node\node.exe` if `node` is not on PATH); the existing sim, predict, schema, room and
  bridge tests stay green in every step.
- Every report says what was checked against what was assumed, test counts, commit hashes, and what the
  brief asked for that was not done and why.

---

## Step 6: accounts, sessions, reconnection, limits

Closes the "name is the identity" gap. A Gateway in the same process (plan: "one Node process with
code-level service boundaries").

1. **Accounts** `dream-server/src/accounts.js` behind the store: `{ name, hash, salt, created, characters:
   [{ place, path, name }] }`. Passwords hashed with `node:crypto` `scrypt` (N 2^15, 32-byte salt, 64-byte
   key), compared in constant time. Names as `protocol.NAME`. HTTP `POST /api/register { name, password }`,
   `POST /api/login { name, password }` → `{ token, name, characters }`; `POST /api/character` adds a
   character ref (must be a kind `character` piece in the Library, as hello checks today). Login throttled:
   five failures per name or address per minute, then 429 for a minute. Body cap 4 KB, JSON only.
2. **Tokens** `src/tokens.js`: HMAC-SHA256 over `{ name, exp, nonce }`, secret from `DREAM_SECRET` (env or
   `secret.txt` beside `config.json`, gitignored; the server refuses to start without one and prints how to
   make it). Session tokens live 12 h; a **reconnection token** is issued in `welcome` and lives 60 s after a
   disconnect: a `hello` carrying `resume` within that window takes over the same player entity in place
   (position, order, uid), so a dropped socket does not leave and rejoin. Rooms hold a disconnected player
   for 60 s (frozen, `stop` order) before the leave.
3. **Protocol** (`net/protocol.js`, `net/README.md`): `hello` gains `token` (required unless the server runs
   with `AUTH=off` for the test harness and bots) and optional `resume`; `welcome` gains `resume` (the
   reconnection token) and `exp`. `error { reason, code }` with codes `auth`, `limit`, `malformed`, `full`.
   A room holds at most `MAX_PLAYERS` (config, default 100), `full` beyond.
4. **Limits** `src/limits.js`: per connection, 40 messages a second and 16 KB a second, measured over a
   1 s window; over either, the socket closes with `limit`. Per address, 8 sockets. `perMessageDeflate:
   false` on the `ws` server (plan).
5. **Dream World** (`src/play/online.ts`, `hud.ts`): the Play settings popover gets Sign in / Register
   (name, password; the token kept in `sessionStorage`, never the password); the character list comes from
   the account; a dropped socket shows "reconnecting…" and resumes silently within the window, then falls
   back to a toast and Play off. The name field goes (the account's name is the name).
6. **Bots** take `--auth off` against a server started with `AUTH=off`, or `--user/--password`.
7. **Tests** `dream-server/test/{accounts,tokens,limits}.test.mjs`: register, login, wrong password, throttle
   trips after five, token round trip and expiry, resume within 60 s keeps the uid and position, resume after
   60 s is `auth`, a flood over 40 messages closes with `limit`, a ninth socket from one address is refused,
   the server refuses to start without a secret.
8. **Docs**: `dream-server/README.md` (accounts, tokens, limits, `AUTH=off`, how to make the secret, what is
   still missing: HTTPS/WSS is the reverse proxy's job later), `dream-world/README.md`, the plan line.

Scopes: `dream-server/*`, `dream-common/net/*`, `dream-world/src/play/*`, `dream-world/README.md`, the plan.
Done means: two browsers register, sign in, pick characters and walk together; pulling one tab's network
(DevTools offline for 10 s) resumes without a leave in the other tab; a wrong password five times gives the
throttle message; the tests pass; bots still run with `AUTH=off`.

---

## Step 7: delta snapshots, binary frames, area of interest

The wire for a few hundred players per zone (plan: "Snapshots", "Numbers", "Transport").

1. **Baselines and deltas** `dream-server/src/deltas.js` + `net/codec.js` (shared, plain JS, used by the
   server to encode and by the client and bots to decode): the server keeps the last 32 snapshots it sent to
   each client per cell; the client acks the newest tick it applied (`ack { tick }`, once per tick at most);
   the server encodes each snapshot as a delta against the client's acked baseline, with a per-entity field
   bitmask (x, z, y, yaw, anim, seq); full state when there is no baseline or the baseline fell out of the
   window. An entity entering the area of interest comes full, with `join`-style identity (name, character)
   for players.
2. **Binary** frames: positions as int16 relative to the cell origin in 2 mm steps (a cell is 50 m, so ±25 m
   fits with margin), yaw uint16, anim uint8, seq uint32, uid as a uint16 slot per room (the `welcome`
   carries the mapping and `join`/`leave` keep it current). JSON stays for `hello`, `welcome`, `join`,
   `leave`, `event`, `ping`, `pong`, `error`, `intent`; `snapshot` and `ack` are binary; the first byte of a
   binary frame is the type. The codec round-trips in tests to within the quantisation.
3. **Area of interest** `src/aoi.js`: a player's cells are the 3×3 around their cell, with 8 m leave hysteresis
   (a cell stays subscribed until the player is 8 m past its edge); the server sends the player's own cell
   and its neighbours at 20 Hz and cells beyond the nearest ring (if any, for larger views later) at 10 Hz.
   Packet cap 1.2 KB per client per tick with a priority accumulator: entities not sent this tick gain
   priority (nearer gain faster) and go first next tick.
4. **Client** (`play.ts`, `online.ts`, `predict.ts`): decode through `net/codec.js`; the interpolation buffer
   and predictor read the same entity shape as today, so nothing above the decoder changes. HUD latency line
   gains bytes in per second and the full-snapshot count.
5. **Bots** decode binary; a `--count 200` run prints the server's bytes out per second and tick time.
6. **Tests** `dream-common/test/codec.test.mjs`, `dream-server/test/deltas.test.mjs`: round trip; a delta
   against a baseline applies to the baseline's state and matches the full snapshot; a lost ack (baseline out
   of window) falls back to full; 200 entities in one cell fit the packet cap over at most three ticks with
   the nearest first; the hysteresis keeps a cell at 7 m past and drops it at 9 m.
7. **Docs**: `net/README.md` (the binary layout, byte by byte), `dream-server/README.md`, the plan line.

Scopes: `dream-common/net/*`, `dream-common/test/codec.test.mjs`, `dream-server/*`, `dream-world/src/play/*`,
the plan. Not `sim/`.
Done means: two browsers walk as before with the HUD showing a fraction of the bytes of step 5 (report both
numbers); 200 bots in Crystal Cascades with one browser watching, tick time under 10 ms and the watcher's
bytes in under 30 KB/s, no visible stutter near the player; tests pass.

---

## Step 8: zone handoff at portals, SQLite store, world scope

Rooms exist per zone; nothing yet moves a player between them, and saves are JSON files.

1. **Portals** (`sim/tick.js`, one tested addition): an entity with `portal` and a `collider` with `trigger`
   fires `portal { uid, zone, cell, x, z }` when a player's capsule overlaps it (once per entry; re-arms when
   the player leaves the shape). `dream-server/src/handoff.js`: on the event the room saves the player's
   record, tells the client `transfer { zone, resume }` with a reconnection token bound to the target zone
   and arrival point, removes the player, and the client (same socket) sends a new `hello` with `resume`;
   the target room (made if needed) places the player at the portal's arrival point. The arrival point is
   checked `walkable`, else the nearest walkable point within 3 m, else the zone spawn.
2. **Zone spawn**: the room spawns a new player at the zone's `spawn` entity with `group: 'player'` (random
   point within its `radius`), else the zone centre; Dream World's Play settings get a "Set spawn here" that
   places one. (This retires the step 4 note "online spawns at centre".)
3. **SQLite store** `dream-server/src/store-sqlite.js` with `node:sqlite`: the same `load`/`save` interface
   as the JSON store plus `accounts`; one file `SAVE_DIR/dream.db`, WAL mode, tables `players (name PK,
   json)`, `accounts (name PK, json)`, `world (zone, key, json, PK (zone, key))`. `STORE=json|sqlite` in
   config, default `sqlite`; `node tools/migrate-json.mjs` copies the JSON saves in once. Writes happen off
   the tick: the room queues records and a 1 s timer flushes them in one transaction.
4. **World scope**: `world (zone, key)` holds shared durable state per zone: for now the open/closed state
   of entities with `interact verb: 'open'` (a door or chest), toggled by interact, broadcast as `event
   { type: 'state', uid, state }`, restored when the room loads. The client plays the entity's `fx` on the
   change as it does for interact today. This is the first world-scope write and the pattern for Phase 4.
5. **Dream World**: the Play client handles `transfer` (a short fade, the new zone's terrain and cells load
   from the Library as Play does at start, the predictor resets), and shows the zone's name for 2 s.
6. **Tests** `dream-server/test/{handoff,store}.test.mjs`, `dream-common/test/sim.test.mjs` (the portal event
   once per entry): a player walking through a portal in zone A arrives in zone B at the arrival point with
   the same uid and account, zone A disposes after its timer, the record shows both zones; a non-walkable
   arrival falls back; the SQLite store round-trips players, accounts and world state and the migration
   copies the JSON saves; a door opened in a room is open after the room is disposed and reloaded.
7. **Docs**: `docs/zone-format.md` (the trigger portal, the player spawn group), `dream-server/README.md`,
   the plan line.

Scopes: `dream-common/sim/*` (the portal event and the spawn point only), `dream-common/test/sim.test.mjs`,
`dream-server/*`, `dream-world/src/play/*`, `dream-world/src/ui.ts` (the Set spawn wiring only),
`docs/zone-format.md`, the plan. Needs a second zone in the Library with a portal each way: make a small
test zone "Portal Test" beside Crystal Cascades through Dream World and save it (both zones get a portal).
Done means: a browser walks from Crystal Cascades into Portal Test and back with a second browser seeing the
leave and the join; a chest opened by one is open for a browser joining later and after a server restart;
saves live in `dream.db`; tests pass.

---

## Step 9: publish pipeline (Phase 3)

Editing happens on the Library's live files today; the server loads whatever is saved. Publishing separates
authoring from what players see.

1. **Content packs** `dream-common/pack/` (plain JS, shared): `buildPack({ zone, cells, templates, pieces })`
   validates every record against the schema, bakes each placed piece's `collider` components from its
   Library meta (so the server no longer asks the Library for meta at room load), resolves `model` refs to
   content hashes (SHA-256 of the GLB), and writes `pack.json { format: 'dream-pack', version: 1, zone,
   built, hashes: { "<place|path>": "<sha256>" }, zone: {...}, cells: [...], templates: [...] }` plus the
   referenced GLBs under `assets/<sha256>.glb`. Deterministic: the same input gives the same bytes.
2. **Publish zone** in Dream World (File menu, enabled with a zone open): runs `buildPack` in the browser,
   shows the validation report (errors block, warnings list), and POSTs the pack to the Dream Server's
   `POST /api/publish` (admin only: `DREAM_ADMIN` addresses as the Library does, plus a signed-in account
   flagged `admin` in its record). The server writes it to `PACKS_DIR/staging/<zone id>/<built>/`.
3. **Staging and live** `dream-server/src/content.js`: `GET /api/packs` lists staging and live per zone;
   `POST /api/promote { zone, built }` (admin) copies staging to `live/<zone id>/current` atomically (write
   to a temp dir, rename) and **hot-reloads**: the zone's room, if open, swaps its static world (terrain,
   placed pieces, colliders, templates) at the next tick, keeps players and npcs where they stand (re-snapped
   to the new ground), and sends every client `event { type: 'reload', built }`. Rooms load from `live` only;
   with no live pack for a zone the room refuses the hello with `error { code: 'unpublished' }`, except with
   `CONTENT=library` in config, which keeps today's behaviour for development.
4. **Content served** `GET /content/<zone id>/pack.json` and `GET /content/assets/<sha256>.glb` from `live`,
   with `Cache-Control: immutable` for the hashed assets; the Play client loads the zone and its pieces from
   the server's content when playing online (the Library only for local Play), so a browser on the VPS later
   needs no Library. The `reload` event re-fetches `pack.json` and swaps pieces whose hash changed.
5. **Tests** `dream-common/test/pack.test.mjs`, `dream-server/test/content.test.mjs`: a pack from Crystal
   Cascades validates, is deterministic, and carries the baked colliders the bridge would have made (same
   sim input); an invalid cell fails with the record named; publish then promote makes the room load the new
   pack and keep its players; a client refusing a stale hash gets the new asset.
6. **Docs**: `docs/pack-format.md` (new), `dream-server/README.md` (publish, promote, staging/live, content
   URLs), `dream-world/README.md` (Publish), the plan lines for Phase 3.

Scopes: `dream-common/pack/*` (new), `dream-common/test/pack.test.mjs`, `dream-server/*`, `dream-world/src/
play/*`, `dream-world/src/{ui.ts,main.ts}` (the menu item wiring only), `docs/pack-format.md`, the plan.
Not `sim/` (the bridge is used, not changed).
Done means: edit Crystal Cascades (move a boulder), Publish, see the validation report, Promote on the
server's status page, and a browser already playing sees the boulder move without leaving; a second browser
joins from the live pack with the Library stopped; tests pass.

---

## Step 10: first gameplay systems (Phase 4, data-driven)

The first systems in `sim/`, as plugins on an event bus, with their data in zone templates and Library tables.

1. **Feature registry** `sim/systems.js`: `registerSystem({ name, components, onTick, onIntent, before, after
   })`; `step` calls each system's `onTick(world, dt)` in registration order, intents not handled by movement
   go to `onIntent`; `before`/`after` hooks on named events (`interact`, `damage`, `pickup`) can veto or
   amend. Deterministic order; the replay test stays green with systems on.
2. **Stats** `sim/systems/stats.js`: a `stats` component `{ health, maxHealth, stamina, maxStamina, speed }`
   on players and npcs with defaults in `MOVE`; stamina drains on run and refills (today's HUD bar becomes
   real); health regenerates slowly out of combat; `MODIFIER`s apply with duration. `death` event at 0
   health: the entity drops its order, plays `anim: 'death'` for 3 s, then a player respawns at the zone
   spawn with full stats, an npc is removed and its `spawn` entity respawns it after `respawn` seconds (a new
   `spawn` field, schema change with a test).
3. **Abilities** `sim/systems/abilities.js`: `cast { ability, target? , x?, z? }` intent; abilities are
   data in Library tables `Tables/abilities.json` (`{ id, name, range, arc, cooldown, cost, damage, effects:
   [MODIFIER], anim, fx }`); the server checks range with the plan's 0.5 to 1 m tolerance, arc, cooldown and
   stamina cost; `castResult` event to the caster, `damage` events to everyone in the area of interest; the
   client plays the ability's `anim` and `fx`. Two abilities to start: `strike` (melee, 2 m, 90°, 1 s) and
   `bolt` (ranged, 15 m, 0.8 s cooldown, projectile travel 20 m/s simulated as a delayed hit). Prediction:
   the client starts the cast animation at once (cosmetic), never the damage (plan).
4. **Npc behaviour** `sim/systems/ai.js`: `follow` and `flee` modes (the schema has them, the sim does not),
   plus `hostile: true` npcs that aggro within `radius`, chase, and use `strike` with the same rules as
   players; they return home when the target is 2× radius away. Deterministic through the sim's `random`.
5. **Items** `sim/systems/items.js`: an `inventory` component (`{ slots: [{ item, count }], size }`), item
   defs in `Tables/items.json` (`{ id, name, stack, effects: [MODIFIER], model }`), a `loot` component's
   table in `Tables/loot/<table>.json` rolling on death with the sim's `random`; `pickup { uid }` intent
   within 2 m; `use { slot }` applies the item's modifiers; drops are entities with `model` and a `pickup`
   component that despawn after 120 s. Player inventory is player scope (saved with the record).
6. **GM page** `dream-server` status page, admin only: online players with zone and position, teleport,
   spawn an entity from a template at a point, kill, reload a zone's live pack, and a log of GM actions
   appended to `SAVE_DIR/gm.log`.
7. **Dream World**: the HUD's health and stamina bars read the player's `stats`; an ability bar (two slots,
   keys 1 and 2) from `ui-templates.js`; a target ring on the nearest hostile in range; floating damage
   numbers; a small inventory panel (key I) with use and drop; death fade and respawn. The editor's
   Inspector shows the new components through the schema as it does the others.
8. **Tests** `dream-common/test/systems.test.mjs` (and `sim.test.mjs` for replay): a strike in range and arc
   damages, out of range does not, cooldown refuses, stamina cost refuses; a hostile aggros, chases, strikes
   and returns home; death drops loot from its table with the seeded random and respawns after `respawn`;
   pickup and use apply a modifier for its duration; a replay with casts and pickups matches; `dream-server`
   room test: a cast from a client is validated server-side and the client's predicted animation never moves
   health.
9. **Docs**: `sim/README.md` (systems, events, the tables), `docs/tables.md` (new: the table formats),
   `dream-world/README.md` (play controls), the plan lines for Phase 4.

Scopes: `dream-common/sim/*`, `dream-common/test/*`, `dream-common/web/schema/components.js` (`stats`,
`inventory`, `pickup`, `hostile`, `respawn` on spawn, with tests), `dream-server/*`, `dream-world/src/play/*`,
`dream-world/README.md`, `docs/tables.md`, the plan. Tables and the two test npcs (a hostile boar from the
CC0 animals, a chest with loot) go through the Library save API into `dream-forge-creations`.
Done means: two browsers fight the boar in Crystal Cascades, see each other's strikes and damage numbers,
one dies and respawns at the spawn point, the boar dies, drops, respawns; a potion from the chest heals;
the GM page teleports a player; tests pass; a 50-bot run with hostiles keeps tick time under 10 ms.
