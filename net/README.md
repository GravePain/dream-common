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
| `welcome` | `uid` (this player's), `tick`, `zone`, `spawn: { x, z }` (where it stands: the zone's spawn, or where it left), `players: [{ uid, name, character }]` (the others), `resume` (the reconnection token: valid while the room holds this player, 60 s after a drop), `exp` (ms), `resumed: true` after a resume |
| `join` | `uid, name, character`: another player came in |
| `leave` | `uid`: another player left |
| `snapshot` | **binary since step 7** (below); decodes to `tick, at, cell, entities: [{ uid, x, y, z, yaw, anim, seq }]`: one per cell of the player's area of interest (its cell and the neighbours), after every 20 Hz tick, movers only; the in-process server's shape (`sim/index.js`) plus `at` (the server's `Date.now()` at that tick) and, on players only, `seq` (the last one the server applied for that player; absent before its first sequenced intent, never on npcs) |
| `event` | `tick, type, ...`: the sim's `interact` (`target, verb, ok, reason`) and `blocked` (`reason, by, x, z`) for this player |
| `pong` | `at` (echoed), `tick`, `serverAt` (the server's `Date.now()`) |
| `error` | `reason`, `code` (`auth`, `limit`, `malformed`, `full`; `CODES` in `protocol.js`); sent before the server closes the socket |

## Rules

- A client never moves itself: it sends intents and draws snapshots. `seq` is bookkeeping for prediction:
  the server still applies the intent through the sim. A `seq` at or below the last one it took from that
  player (a repeat, or a jump back) is dropped silently, not an error; a gap is fine. A client that sends
  no `seq` (an old one) keeps working and gets no `seq` back.
- `at` and `serverAt` let a client keep a clock offset (`serverAt` against its own clock, the round trip
  halved, a median of the last few) and so draw snapshots on the server's time.

## Binary frames (step 7, `codec.js`)

`snapshot` and `ack` are binary WebSocket frames; everything else stays JSON. The first byte is the type
(1 snapshot, 2 ack). Big-endian throughout (DataView's default).

**ack** (client to server, 5 bytes): `u8 2`, `u32 tick`, the frame the client just applied. One a tick; the
server meters acks on their own (60 a second) and against the 16 KB a second, not the 40 messages.

**snapshot** (server to client, one per tick per client, at most 1200 bytes plus the player's own record):

| Bytes | Field |
| --- | --- |
| 1 | `u8 1` |
| 4 | `u32 tick` |
| 8 | `f64 at`, the server's `Date.now()` at that tick |
| 2 | `u16` removed count, then `u16` slot each: entities that left this client's view |
| 1 | `u8` cell count, then per cell: |
| 1+1 | `u8 i`, `u8 j` (the cell `x<i>z<j>`) |
| 1 | `u8 flags`: bit 0 `complete` (every changed entity in this cell is here; the client repeats the unchanged ones it holds) |
| 2 | `u16` record count, then per record: |
| 2 | `u16 slot` (the uid's slot: `welcome.slots`, `join.slot`) |
| 1 | `u8 mask`: 1 x, 2 z, 4 y, 8 yaw, 16 anim, 32 seq: the fields that follow |
| 1 | `u8 base`: ticks back to the baseline this is a delta against; 0 = no baseline (all fields present) |
| 2, 2 | `i16 x`, `i16 z`: 2 mm steps from the cell's centre (a cell is 50 m; +-65 m fits) |
| 2 | `i16 y`: 1 cm steps, absolute |
| 2 | `u16 yaw`: a full turn in 65536 |
| 1 | `u8 anim`: an index into `ANIMS` (`idle walk run death jump cast hit`, append only; 255 unknown) |
| 4 | `u32 seq` (players only) |

A missing field in a delta is the baseline's. Baselines are per entity: the server logs each frame's
records by tick, and the ack for that tick makes them that entity's baseline; an entity equal to its
baseline is not sent. A baseline older than 32 ticks (`WINDOW`) is not used: that record comes whole. An
entity entering the view comes whole; one leaving is in `removed` until a frame carrying it is acked.
Changed entities wait on a priority (each tick +1 + 20/(1 + distance)); the frame takes them in that order
until the cap, the player itself always. `welcome` gains `size` (the zone's, for the cell centres) and
`slots` (`{ uid: slot }` for every mover); `join` gains `slot`.

`createDecoder({ size, slots })` keeps what the client holds and hands back the JSON-era snapshots (one per
cell, `{ tick, at, cell, entities }`), so nothing above it changed. Area of interest (server side,
`dream-server/src/aoi.js`): the 3x3 cells around the player at 20 Hz; a cell it walks out of stays,
at 10 Hz, until it is 8 m past the band where that cell was a neighbour.

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
