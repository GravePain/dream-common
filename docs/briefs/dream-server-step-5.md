# Brief: game builder step 5, prediction, reconciliation and interpolation

The part of Phase 2 the plan calls the riskiest, gated behind step 4 (now done): the local player
predicts their own movement, the server corrects them, and everyone else is drawn a little in the past.
Read first: `working-with-claude.md`, `CLAUDE.md`, the plan's "Netcode decisions" (Model, Numbers,
Messages) and Phase 2; `dream-common/sim/README.md`, `sim/tick.js` (`createSim`, `step`, `stepOnce`,
`replay`: the sim is deterministic, that is what makes prediction possible), `sim/index.js`
(`createLocalServer`); `dream-common/net/protocol.js` and `net/README.md`; `K:\dream-server\src\
{room.js,players.js}`; `K:\dream-world\src\play\{play.ts,online.ts,hud.ts}` (`online.ts` is the `Conn`;
`play.ts` lerps every entity between its last two snapshots, the local player included; that is what
changes). The briefs for steps 2 to 4 are in this folder for the shapes already agreed.

## What it is

Today a key press waits for the server's next snapshot before the character moves (one round trip plus
up to a tick), and everyone is drawn by lerping between the last two snapshots, so a late snapshot stalls
the picture. After this step the local player moves the instant a key is pressed, running the same
`sim/` the server runs, and the server's authoritative positions fold back in with a smooth correction;
other players and npcs are drawn ~100 ms behind the newest snapshot so there is always a pair to
interpolate between. Nothing about who is authoritative changes: the client still only sends intents,
the server still validates and moves.

## Deliverables

1. **Sequenced intents** (`net/protocol.js`, `net/README.md`, `dream-server/src/room.js`): `intent` gains
   `seq` (a client counter, positive integer, must increase; a repeat or a jump back is dropped, not an
   error; a gap is fine). The server records per player the last `seq` it applied in a tick and puts it
   in every snapshot that carries that player: `snapshot.entities[i].seq` for players only (npcs have
   none). `snapshot` also carries `at` (the server's `Date.now()`) so clients can measure one-way delay.
   `pong { at, tick, serverAt }`. Nothing else in the protocol changes; a client without `seq` (an old
   client) keeps working, it just gets no prediction.
2. **The client sim** (`dream-world/src/play/predict.ts`, under ~300 lines): online Play builds a second
   `createSim` from the same `sim/bridge.js` input the server uses (the client already has the zone;
   its piece meta comes from the Library as in `world-bridge.ts`), with only the local player in it
   (npcs and other players are not predicted). Each intent the user sends is also applied locally with
   its `seq`, and the local sim is stepped at 20 Hz on the client's clock; a history of `{ seq, intents
   applied, position after }` per tick is kept (cap 64 ticks). On each snapshot that carries the local
   player: drop history up to its `seq`, compare the server position to the history entry for that
   `seq`; if they differ by more than 2 cm, reset the local sim's player to the server's state and
   re-apply the intents after that `seq` (reconciliation). The displayed position eases toward the
   predicted one over ~100 ms rather than snapping (the plan's "smooth corrections over ~100 ms");
   over 2 m it snaps. The sim's `blocked` and `enter cell` events from the local sim are not used; the
   server's `event` messages stay the source for the HUD.
3. **Interpolation for others** (`play.ts`): every non-local entity keeps a short buffer of snapshots
   (cap 1 s) and is drawn at `now - delay`, `delay` starting at 100 ms and rising to 150 ms when snapshot
   arrival jitter (the standard deviation of the gaps between the last 20 snapshots) exceeds 20 ms,
   falling back when it settles. If the buffer runs dry (two missed snapshots), hold the last pose and
   keep the walk animation only for one more tick, then idle. Local Play (the in-process server) uses
   the same buffer with `delay` 0 plus one tick, so one render path serves both; its look must not
   get worse (check a walk and a run side by side with the current build before you replace it).
4. **Clock and HUD** (`online.ts`, `hud.ts`): a smoothed clock offset from ping/pong (`serverAt` against
   the client's clock, round trip halved, median of the last 8) so the interpolation delay works on
   server time; the HUD's latency corner shows round trip, the one-way estimate, and the current
   interpolation delay, and a small correction counter (how many reconciliations moved the player over
   2 cm in the last 10 s). Keep it one short line in the theme font.
5. **A lag switch for testing** (`online.ts`, dev only): the Play settings popover, online mode, gets
   "Simulated lag" (0, 50, 100, 200, 400 ms, remembered) and "Loss" (0, 5, 20 %); the `Conn` delays and
   drops messages both ways in a queue on the client side. Not sent to the server. Hidden when the
   Vite build is production.
6. **A bot client** (`dream-server/bots/bot.mjs`, Node, `ws` only): `node bots/bot.mjs --zone "place|path"
   --name Bot1 --count 10 --server ws://localhost:5320/ws` connects N bots that walk to random points
   in the zone for a time and print join/leave and their last positions. Testing layer 2 in the plan,
   and the way to see 10 others moving in one browser.
7. **Tests**: `dream-common/test/predict.test.mjs` (plain Node, no DOM: the prediction core from
   `predict.ts` must therefore live in a plain JS module `dream-common/net/predict.js` that `predict.ts`
   wraps; the TS file only binds it to three.js and the Play loop): a client sim and a server sim fed the
   same intents agree exactly with no lag; with 200 ms of simulated lag the client's history reconciles
   without a correction over 2 cm on open ground; a server-side block (a wall the client did not know
   about, injected by moving the server's player) produces one correction and then agreement; a dropped
   intent (gap in `seq`) is reconciled; a duplicate `seq` is ignored by the room. `dream-server/test/
   room.test.mjs` grows a case for `seq` in snapshots. The existing sim, room and bridge tests stay green.
8. **Docs**: `dream-server/README.md` (prediction and interpolation: what runs where, the lag switch, the
   bots), `net/README.md` (the `seq` fields, `at`, `serverAt`), `dream-world/README.md` (Play online:
   what the HUD numbers mean), a step 5 line in `docs/game-builder-plan.md`.

## Rules

- Only CC0 assets or Graves's own content (none needed). Plain ES modules; `ws` only in `dream-server`.
  `dream-common/sim` changes only for a tested bug (prediction needs `createSim` to accept a given
  player state at join and to expose the player's state after a tick: if that needs a small addition,
  add it with a test and say so). The schema is not changed. New files under about 400 lines.
- Clients never move themselves in the server's eyes: `seq` is bookkeeping, the server still applies the
  intent through the sim. The server trusts nothing beyond a checked intent with a monotonic `seq`.
- Deltas, binary encoding, AOI changes, auth and zone handoff are not this step.
- Commit per repo with what changed and why and the `Co-Authored-By` line the session gives you; push
  `origin main`; mirror with `git -C /z/<repo> -c safe.directory='*' pull --ff-only` (dream-common,
  dream-server, dream-world). Restart Morty's Dream Server after the pull (`taskkill` its PID over ssh,
  then `timeout 8 ssh morty 'cd /d D:\Public\dream-server && node server.mjs'`), and the local one on
  5320 the same way; say in the report whether both came back. Patch files with a Python script written
  by the Write tool.
- Write scopes: `dream-common/net/*`, `dream-common/test/predict.test.mjs`, `dream-common/sim/*` only as
  above, `dream-server/*`, `dream-world/src/play/*`, `dream-world/README.md`, `docs/game-builder-plan.md`
  (one line). Not `dream-common/web/ui`, not the Library, not `Dream Forge`.

## Done means

Verified and reported with what was checked against what was assumed: with the lag switch at 200 ms and
5 % loss the local character starts walking the same frame the key goes down and stops on the key up,
runs into a Creek boulder and stays outside it with at most one visible nudge, the correction counter
stays near zero on open ground; a second tab (0 lag) sees the first walk smoothly with no stutter at
the snapshot rate, and ten bots from `bot.mjs` wander smoothly in that tab; local Play looks the same
as before; the tests pass; the HUD numbers read sensibly (round trip about the lag switch value).
