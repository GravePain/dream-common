# net: the Dream Server's wire protocol

`protocol.js` is shared by the Dream Server (`K:\dream-server`) and its clients (Dream World's Play online).
Plain JS, no DOM. JSON over one WebSocket at `/ws`, one message object per frame, its type in `t`.

## Client to server

| `t` | Fields | When |
| --- | --- | --- |
| `hello` | `token` (the account's session token from `/api/login`; required unless the server runs `AUTH=off`, where `name`, 1 to 24 letters, digits, spaces, `_ ' . -`, names the player), `resume` (optional: the reconnection token from a `welcome`, to take over the same player), `character: { place, path, name }` (a kind `character` piece in the Library, and with a token one of the account's), `zone` (`"place\|path/zone.json"`) | first, once |
| `intent` | `intent`: the sim's intents unchanged (`move`, `moveTo`, `face`, `interact`, `stop`, see `sim/intents.js`); `seq` (optional): the client's counter, a positive integer that must increase | any time after `welcome` |
| `ping` | `at`: the client's clock in ms | every couple of seconds |

## Server to client

| `t` | Fields |
| --- | --- |
| `welcome` | `uid` (this player's), `tick`, `zone`, `content: { id, built }` (the live pack it plays, step 9; null on a server run with `CONTENT=library`), `spawn: { x, z }` (where it stands: the zone's spawn, or where it left), `players: [{ uid, name, character }]` (the others), `resume` (the reconnection token: valid while the room holds this player, 60 s after a drop), `exp` (ms), `resumed: true` after a resume, `name` (the zone's), `states: { uid: { open } }` (doors and chests, world scope) |
| `transfer` | `zone, resume`: a portal took this player out of its zone; say `hello { resume, zone, character }` again on the same socket to arrive there (same uid and account) |
| `join` | `uid, name, character`: another player came in |
| `leave` | `uid`: another player left |
| `snapshot` | **binary** (below; shared cell frames since step 9); decodes to `tick, at, cell, entities: [{ uid, x, y, z, yaw, anim, seq }]`: one per cell of the player's area of interest (its cell and the neighbours), after every 20 Hz tick, movers only; the in-process server's shape (`sim/index.js`) plus `at` (the server's `Date.now()` at that tick) and, on players only, `seq` (the last one the server applied for that player; absent before its first sequenced intent, never on npcs) |
| `event` | `tick, type, ...`: the sim's `interact` (`target, verb, ok, reason`) and `blocked` (`reason, by, x, z`) for this player; `state` (`uid, state`, doors and chests, to everyone); `reload` (`built, slots`: a promoted pack was swapped in, to everyone; the client re-fetches the zone's `pack.json` and adds `slots` to its decoder) |
| `pong` | `at` (echoed), `tick`, `serverAt` (the server's `Date.now()`) |
| `error` | `reason`, `code` (`auth`, `limit`, `malformed`, `full`, `unpublished`: the zone has no live content pack; `CODES` in `protocol.js`); sent before the server closes the socket |

## Rules

- A client never moves itself: it sends intents and draws snapshots. `seq` is bookkeeping for prediction:
  the server still applies the intent through the sim. A `seq` at or below the last one it took from that
  player (a repeat, or a jump back) is dropped silently, not an error; a gap is fine. A client that sends
  no `seq` (an old one) keeps working and gets no `seq` back.
- `at` and `serverAt` let a client keep a clock offset (`serverAt` against its own clock, the round trip
  halved, a median of the last few) and so draw snapshots on the server's time.

## Binary frames (`codec.js`; shared cell frames since step 9)

`snapshot` is the one binary WebSocket frame, server to client; everything else stays JSON, and a client
sends JSON only (a binary frame from a client closes its socket as malformed). Big-endian throughout
(DataView's default).

**The per-cell rule.** Each cell of a room encodes one **segment** per tick: a delta against that cell's
own previous tick, made once and shared by every client that sees the cell. Nothing is acked: a WebSocket is
TCP, so a client that was sent every segment of a cell holds that cell's state. A client's frame is the
segments of the cells it sees, concatenated: its 3x3 every tick, kept cells beyond it every other tick (as
the two deltas since it last had them). A cell the client does not hold comes as a **full segment**: when
it enters the view, after a `welcome` (a join, a resume, a transfer: a new decoder holds nothing), or when
the client missed more of it than the cell keeps (8 ticks), or when the missed deltas are bigger than the
full one. The player's own cell goes every tick, so its own record is in every frame.

**The cap.** A frame aims at 1200 bytes (`CAP`). The own cell always goes; the other due cells go in
priority order (each tick waited +1 + 20/(1 + distance to the cell's centre); sent resets it) while they
fit. A cell that does not fit waits for a later tick and then gets what it missed, deltas or full, so
nothing is lost. If nothing but the own cell fitted, the top waiting cell goes anyway (that frame is over
the cap), so a crowded own cell does not starve its neighbours.

**snapshot** (server to client, one per tick per client):

| Bytes | Field |
| --- | --- |
| 1 | `u8 1` |
| 4 | `u32 tick` |
| 8 | `f64 at`, the server's `Date.now()` at that tick |
| 2 | `u16` dropped count, then `u8 i, u8 j` each: cells that left this client's view (it forgets what it held there) |
| 1 | `u8` segment count, then per segment (a cell may have two, oldest first): |
| 1+1 | `u8 i`, `u8 j` (the cell `x<i>z<j>`) |
| 1 | `u8 flags`: bit 0 `full` (the client drops what it holds in this cell first) |
| 2 | `u16` record count |
| 2 | `u16` left count |
| | the records, then the left slots (`u16` each: entities in this cell last tick and not now, moved on or gone; a client drops one only if it still holds it in this cell) |

Each record (the layout of step 7, unchanged):

| Bytes | Field |
| --- | --- |
| 2 | `u16 slot` (the uid's slot: `welcome.slots`, `join.slot`) |
| 1 | `u8 mask`: 1 x, 2 z, 4 y, 8 yaw, 16 anim, 32 seq: the fields that follow |
| 1 | `u8 base`: 0 the whole entity (all fields: it is new to this cell, or the segment is full); 1 a delta on what the client holds for that slot |
| 2, 2 | `i16 x`, `i16 z`: 2 mm steps from the cell's centre (a cell is 50 m; +-65 m fits) |
| 2 | `i16 y`: 1 cm steps, absolute |
| 2 | `u16 yaw`: a full turn in 65536 |
| 1 | `u8 anim`: an index into `ANIMS` (`idle walk run death jump cast hit`, append only; 255 unknown) |
| 4 | `u32 seq` (players only) |

A missing field in a delta is what the client holds. An entity changing cells comes whole in its new cell
and is in the old cell's left list. `welcome` carries `size` (the zone's, for the cell centres) and `slots`
(`{ uid: slot }` for every mover); `join` gains `slot`.

`createDecoder({ size, slots })` keeps what the client holds and hands back the JSON-era snapshots (one per
cell in the frame, every entity it holds there, `{ tick, at, cell, entities }`), so nothing above it
changed. Area of interest (server side, `dream-server/src/aoi.js`): the 3x3 cells around the player at
20 Hz; a cell it walks out of stays, at 10 Hz, until it is 8 m past the band where that cell was a
neighbour.

## Prediction (`predict.js`)

The client side of step 5, plain JS so `test/predict.test.mjs` runs it in Node. `createPredictor({ zone,
cells, templates, uid, at })` makes a second sim over the same bridge input with only that player in it.
`intent(i, tick)` applies an intent locally (returning its `seq` to send), `update(dt)` or `advanceTo(tick)`
steps it, keeping a history of `{ tick, seq, intents, state }` per tick (64 ticks). `reconcile(serverTick,
entity)` lines a snapshot up with that history (the tick where the server first applied a `seq` against
ours gives the offset), drops what came before, and over 2 cm puts the player at the server's position
(with its velocity from the last two snapshots) and re-runs the intents after it. Dream World's
`src/play/predict.ts` binds it to the Play loop. The sim itself is unchanged: the predictor sets the
player's fields and calls `world.place`.
- Anything malformed (not JSON, an unknown `t`, a bad field, an intent the sim's check drops, a message
  before `hello` other than `ping`, a second `hello`, more than 4 KB) gets `error { reason }` and the
  socket is closed with code 1008 and the reason.
- `parseClient(raw)` returns `{ msg }` (a clean copy) or `{ error }`; `encode(t, body)` makes a frame.

**Bots.** A `hello`'s `token` may be a bot token, kind `bot`, which only the server's Bots page makes: `name` must be `Bot-<n>` and `character` the one signed. The same token in the socket's `x-dream-bot` header passes the sockets-per-address limit. Other event types a client hears: `moved { uid, x, z }` (a GM's teleport; prediction starts again there), `tables` (a promote changed the live tables).
