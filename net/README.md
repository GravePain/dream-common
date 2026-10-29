# net: the Dream Server's wire protocol

`protocol.js` is shared by the Dream Server (`K:\dream-server`) and its clients (Dream World's Play online).
Plain JS, no DOM. JSON over one WebSocket at `/ws`, one message object per frame, its type in `t`.

## Client to server

| `t` | Fields | When |
| --- | --- | --- |
| `hello` | `name` (1 to 24 letters, digits, spaces, `_ ' . -`), `character: { place, path, name }` (a kind `character` piece in the Library, checked with it), `zone` (`"place\|path/zone.json"`) | first, once |
| `intent` | `intent`: the sim's intents unchanged (`move`, `moveTo`, `face`, `interact`, `stop`, see `sim/intents.js`) | any time after `welcome` |
| `ping` | `at`: the client's clock in ms | every couple of seconds |

## Server to client

| `t` | Fields |
| --- | --- |
| `welcome` | `uid` (this player's), `tick`, `zone`, `spawn: { x, z }` (where it stands: the zone's spawn, or where it left), `players: [{ uid, name, character }]` (the others) |
| `join` | `uid, name, character`: another player came in |
| `leave` | `uid`: another player left |
| `snapshot` | `tick, cell, entities: [{ uid, x, y, z, yaw, anim }]`: one per cell of the player's area of interest (its cell and the neighbours), after every 20 Hz tick, movers only; exactly the in-process server's shape (`sim/index.js`) |
| `event` | `tick, type, ...`: the sim's `interact` (`target, verb, ok, reason`) and `blocked` (`reason, by, x, z`) for this player |
| `pong` | `at` (echoed), `tick` |
| `error` | `reason`; sent before the server closes the socket |

## Rules

- A client never moves itself: it sends intents and draws snapshots.
- Anything malformed (not JSON, an unknown `t`, a bad field, an intent the sim's check drops, a message
  before `hello` other than `ping`, a second `hello`, more than 4 KB) gets `error { reason }` and the
  socket is closed with code 1008 and the reason.
- `parseClient(raw)` returns `{ msg }` (a clean copy) or `{ error }`; `encode(t, body)` makes a frame.
