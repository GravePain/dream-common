# net: the Dream Server's wire protocol

`protocol.js` is shared by the Dream Server (`K:\dream-server`) and its clients (Dream World's Play online).
Plain JS, no DOM. JSON over one WebSocket at `/ws`, one message object per frame, its type in `t`.

## Client to server

| `t` | Fields | When |
| --- | --- | --- |
| `hello` | `name` (1 to 24 letters, digits, spaces, `_ ' . -`), `character: { place, path, name }` (a kind `character` piece in the Library, checked with it), `zone` (`"place\|path/zone.json"`) | first, once |
| `intent` | `intent`: the sim's intents unchanged (`move`, `moveTo`, `face`, `interact`, `stop`, see `sim/intents.js`); `seq` (optional): the client's counter, a positive integer that must increase | any time after `welcome` |
| `ping` | `at`: the client's clock in ms | every couple of seconds |

## Server to client

| `t` | Fields |
| --- | --- |
| `welcome` | `uid` (this player's), `tick`, `zone`, `spawn: { x, z }` (where it stands: the zone's spawn, or where it left), `players: [{ uid, name, character }]` (the others) |
| `join` | `uid, name, character`: another player came in |
| `leave` | `uid`: another player left |
| `snapshot` | `tick, at, cell, entities: [{ uid, x, y, z, yaw, anim, seq }]`: one per cell of the player's area of interest (its cell and the neighbours), after every 20 Hz tick, movers only; the in-process server's shape (`sim/index.js`) plus `at` (the server's `Date.now()` at that tick) and, on players only, `seq` (the last one the server applied for that player; absent before its first sequenced intent, never on npcs) |
| `event` | `tick, type, ...`: the sim's `interact` (`target, verb, ok, reason`) and `blocked` (`reason, by, x, z`) for this player |
| `pong` | `at` (echoed), `tick`, `serverAt` (the server's `Date.now()`) |
| `error` | `reason`; sent before the server closes the socket |

## Rules

- A client never moves itself: it sends intents and draws snapshots. `seq` is bookkeeping for prediction:
  the server still applies the intent through the sim. A `seq` at or below the last one it took from that
  player (a repeat, or a jump back) is dropped silently, not an error; a gap is fine. A client that sends
  no `seq` (an old one) keeps working and gets no `seq` back.
- `at` and `serverAt` let a client keep a clock offset (`serverAt` against its own clock, the round trip
  halved, a median of the last few) and so draw snapshots on the server's time.

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
