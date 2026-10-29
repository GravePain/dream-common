# Brief: game builder step 4, Dream Server (one zone, two browsers walking together)

Step 4 of "First concrete steps" and the start of Phase 2 in `docs/game-builder-plan.md`. Read first:
`working-with-claude.md`, `CLAUDE.md`, the plan's Phase 2, "Netcode decisions" and key decision 1;
`dream-common/sim/README.md` and `sim/index.js` (`createLocalServer` is the shape the real server
copies: `connect`, `send(intent)`, snapshots per cell of the area of interest); `K:\dream-world\src\play\
{play.ts,world-bridge.ts,hud.ts}` (the client that today talks to the in-process server; `buildSimInput`
turns a zone plus piece meta into the sim's `{ zone, cells, templates }`); `K:\dream-world\vite.config.ts`
(the `/dl` proxy to the Library is the pattern); `K:\dream-library\server.mjs` (`/api/file?place&path`,
`/api/list`, how meta is served); `K:\dream-paint\server.mjs` (the dependency-free static server every
tool uses, copy its shape); `K:\gravepain-portal\start-all.bat`.

## What it is

A new repo `K:\dream-server`, port 5320: a Node process that hosts zone rooms. Each room runs the same
`dream-common/sim` the Play button runs, at 20 Hz, authoritatively. Browsers connect over a WebSocket,
send intents only, and get snapshots per cell of their area of interest. Dream World's Play button gets
a second mode, Play online, so two browsers (two PCs, or two tabs) walk Crystal Cascades together and
see each other's Dream Character. No prediction yet: the client draws snapshots as it does today.

## Deliverables

1. **The server** `dream-server/server.mjs` plus `src/`: HTTP on 5320 (a status page at `/` listing rooms,
   players and tick rate; `/health` JSON) and a WebSocket at `/ws`. `ws` from npm is the one allowed
   dependency (or a hand-written RFC 6455 handshake if you prefer none; say which). Config by env and a
   `config.json`: `LIBRARY` (the Library's URL, default `http://localhost:5230`), `PORT`, `SAVE_DIR`.
2. **Rooms** `src/room.js`: one per zone, made on the first join, stepped by one 20 Hz timer, disposed
   two minutes after the last leave. A room loads the zone and cells from the Library (`/api/file`) and
   each placed piece's meta for its colliders, through the **bridge moved to the kit**: lift the pure
   zone-to-sim part of `dream-world/src/play/world-bridge.ts` into `dream-common/sim/bridge.js` (plain
   JS, no three.js; the pieces' meta comes in through a callback) and make `world-bridge.ts` call it,
   so the server and the Play button build the identical sim input. Animals become wander npcs as now.
3. **Protocol** `dream-common/net/protocol.js` (plain JS, shared, documented in `net/README.md`): JSON
   messages, one object per frame, `t` field for type. Client: `hello { name, character: { place, path,
   name }, zone }`, `intent { intent }` (the sim's intents unchanged), `ping { at }`. Server: `welcome
   { uid, tick, zone, spawn, players: [...] }`, `join { uid, name, character }`, `leave { uid }`,
   `snapshot { tick, cell, entities }` (the local server's shape exactly), `event { tick, type, ...}`
   (the sim's `interact` and `blocked` for that player), `pong { at, tick }`, `error { reason }`. A
   malformed message closes the socket with a reason. Validate `hello` fields; the character ref must
   be a kind `character` piece in the Library (ask it).
4. **Players** `src/players.js`: uid per connection, name, character ref, spawn at the zone's spawn point
   (the zone's `spawn` if it has one, else its centre on the heightfield); position saved to
   `SAVE_DIR/players/<name>.json` on leave and every 30 s, and restored on the next hello with the same
   name in the same zone (player scope, JSON first: the repository interface in `src/store.js` with a
   JSON implementation so SQLite can follow). No accounts yet: the name is the identity, said so in the
   README as a Phase 2 gap.
5. **Play online in Dream World** `dream-world/src/play/online.ts` plus wiring: the Play settings popover
   gets a mode switch (Local / Online) and a name field, remembered. Online connects to `/ds/ws` through
   a new Vite proxy (`/ds` → the server, `ws: true`; nothing in `src/` names a port) and uses the same
   `Conn` shape as the local server so `play.ts` barely changes (one `Conn` factory for each mode).
   Other players: on `join`, load their character with `web/client/character.js` and drive it from
   snapshots like the npcs; a name label above the head (a sprite from a canvas, theme font); on
   `leave`, remove it. A small latency figure from ping/pong in the HUD corner. If the server is down,
   a toast and Play stays off.
6. **Tests** `dream-server/test/*.test.mjs` with `node --test`: a room from the Crystal Cascades zone on
   disk (`K:\dream-forge-creations\Zones\Crystal Cascades\`) with a fake library; two fake sockets join,
   one sends `move`, both receive snapshots with both uids and the mover moves; a malformed hello is
   rejected; a leave removes the player and the room disposes after its timer (faked clock); player
   position round-trips through the JSON store. `dream-common`'s sim tests stay green.
7. **Ops**: `start-all.bat` starts Dream Server after the Library (same pattern as the others, `node
   server.mjs`); `dream-server/README.md` (what it is, protocol summary, config, how to run two browsers,
   what is not built: auth, prediction, deltas, handoff). One step 4 line in `docs/game-builder-plan.md`.

## Rules

- Only CC0 assets or Graves's own content (none needed). Plain ES modules; `ws` is the only package
  allowed, and only in `dream-server`. `dream-common/sim` changes only for a tested bug; the schema is
  not changed. Keep each new file under about 400 lines.
- Clients never move themselves: intents in, snapshots out. The server trusts nothing from a client
  beyond a checked intent and a checked hello.
- Commit per repo with what changed and why and the `Co-Authored-By` line the session gives you; push
  `origin main`; create the GitHub repo `dream-server` with `gh repo create --private --source`, then
  clone it to `Z:\dream-server` and `npm ci` there (Morty runs it from `D:\Public\dream-server`); mirror
  the others with `git -C /z/<repo> -c safe.directory='*' pull --ff-only`. Patch files with a Python
  script written by the Write tool.
- Write scopes: `dream-server/*` (new), `dream-common/net/*` (new), `dream-common/sim/bridge.js` (new),
  `dream-world/src/play/*`, `dream-world/vite.config.ts`, `dream-world/README.md` (a Play online
  section), `gravepain-portal/start-all.bat` (the one block), `docs/game-builder-plan.md` (one line).
  Not `dream-common/web/ui`, not the Library, not `Dream Forge`.

## Done means

Verified and reported with what was checked against what was assumed: the server runs on 5320 with the
Library on 5230; two Dream World tabs on 5240 open Crystal Cascades, pick different characters and names,
press Play online, and each sees the other's character walk and run with its name over its head, stopped
by the same boulders; one tab closes and its character leaves the other; it reopens and stands where it
left; the status page lists the room and the players; the tests pass; local Play still works unchanged.
