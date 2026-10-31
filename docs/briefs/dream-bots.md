# Brief: Dream Bots, bots that play the game

**Built 2026-10-31.** Kept as written, with one change Graves asked for: a Bots page (decision 2 said none). So a crowd can run on his real server without breaking decision 5, its bots carry a signed token instead of accounts and save nothing. `dream-server/README.md` says what is true now, with the figures.

The next stage of `docs/game-builder-plan.md` (build order: Dream Server, Codex, Publish + GM, **Bots**, then Story
and Motion). Written 2026-10-31 from the code as it stands. Testing layers 2 and 3 of the plan: bot clients over the real
protocol, and replays as regression tests.

Read first: `CLAUDE.md`, `working-with-claude.md`, `docs/network.md`, `docs/pack-format.md`, `net/README.md`, `sim/README.md`,
`dream-server/README.md`, `dream-server/bots/{bot,bench}.mjs`, `dream-server/src/{room,players,gameplay,reload,handoff}.js`,
`dream-server/test/publish-gm.test.mjs` (a small zone and tables in memory, and a world with no Library).

## Why now

Everything since step 10 was checked by a person or a one-off script driving a browser. Story adds quests on top of all of
it, so the working game needs to be able to say "still works" by itself, and the crowd numbers need to include fighting.

## Where it stands

| Exists | What it does | What it does not do |
| --- | --- | --- |
| `bots/bot.mjs` | N clients over the real socket, sequenced intents, decoding every frame | Only walks. Reads no events, so no combat, loot, gear or portals. Has no pass or fail |
| `bots/bench.mjs` | 200 players in a room with no network, mean, p95 and worst tick | Players only wander: nobody fights. Every published number (about 4 ms bench, 8 ms live) is mostly a crowd walking |
| `sim.replay()` | Same seed and intent log, same result bit for bit (`sim.test`, `systems.test`) | Only on tiny zones built inside a test. No file format, no recording from a real room, nothing kept between runs |

Checked on 2026-10-31, each of which shapes the work:

1. **Room logs don't replay yet.** `room.js` trims `sim.log` to its last 2000 entries, and GM actions and hot reloads change the
   sim without going through the log (`gm.*`, `setTables`, `swapWorld`). Joins are logged with their position and inventory.
2. **Bots need the Library.** `character()` lists the Library for a character, so a bot can't join a live server that has none.
3. **Bots hit the sign-up limit.** `REGISTER_PER_HOUR` is 5 per address, so `--user` with more than 5 new bots fails.
4. **Nothing limits what a slow client is sent.** No file reads `bufferedAmount`, and the 1200-byte cap covers snapshots only.
   JSON gameplay events go to every player within 80 m, so a crowd fighting costs roughly players squared. This is the likeliest
   thing a fighting crowd will expose, and it has never been measured.

## Decisions already made

1. **Bots are clients.** Intents over the real socket, only what a player's client may send and only what it is told. No reaching
   into the room, no GM calls, except where a test says so to set a scene.
2. **Plain Node, in `dream-server/bots/`.** No new repo, no port, no page. Graves runs them from a command line when he wants to
   watch a crowd. A page can follow if he asks.
3. **Three separate jobs, one client underneath.** A scenario proves the game works, a load run measures it, a replay catches an
   unintended change to the sim. Each ends in pass or fail with an exit code.
4. **Tests own their world.** Scenarios and replays use small zones and tables written in the test, as `publish-gm.test.mjs` does,
   never the Library's zones: an edit to Crystal Cascades must not fail a test. Load runs use a real published zone, and name it.
5. **Throwaway servers only.** Anything that makes accounts, saves or packs runs on its own port with its own `SAVE_DIR` and
   `PACKS_DIR`, removed afterwards. Graves's saves and his server on 5320 stay out of it.
6. **Don't fix what load finds without saying so.** Measure, report and fix what is small. A change to how the server sends
   events (finding 4) gets numbers before and after.

## Deliverables

### 1. One bot client
`bots/client.mjs`: connect, hello (a name with `AUTH=off`, or a token), decode frames, keep what the socket says (movers, stats,
inventory, worn, drops, who is hostile), follow a `transfer` to the next zone, resume after a dropped socket as Dream World does.
- A live server gives it what it needs: `/content/packs.json`, the pack (which movers are hostile, where the portals are) and
  `/content/tables.json`. With `CONTENT=library` it reads the same from the Library.
- A bot takes its character from `--character` or its account, and asks the Library only when it has neither.
- `bot.mjs` becomes a thin command line over it, its flags unchanged, so the runs in the README still work.

### 2. Behaviours
`--behave wander | fight | loot | gear | portal | mix`, small functions over the client:
- **fight**: walk to the nearest hostile, face it, cast what is off cooldown and affordable, wait out a death.
- **loot**: walk to a drop in reach of its `drop` event, pick up, use what is usable, drop when full.
- **gear**: wear what is wearable and take it off again.
- **portal**: walk into a portal, arrive, walk back.
- **mix**: a seeded spread of these with wandering, so a run can be repeated.

### 3. The scenario
`test/bots.test.mjs` runs in `node --test`, starting the real `server.mjs` as a child on a free port, `CONTENT=live`, its Library address pointing at nothing:
- Publish two small zones over HTTP as Dream World does, with an admin account, then promote them.
- One bot, signed in: joins, kills a hostile, sees its drop, picks it up, wears it, has its speed change (read from how fast it moves), takes it off.
- Walks a portal into the second zone with its bag intact. Leaves, rejoins, and still has it.
- Drops its socket and resumes as the same player.
- Two bots in one zone: each sees the other's damage, and a door one opens is open for the other.
- A promote with players in the room: new tables reach them and nobody is dropped.
- The server with its stdout closed still takes a join (the crash of 2026-10-31).

Keep it under about 30 s, since it runs in real time at 20 Hz.

### 4. Load
`bots/load.mjs`: N bots with `--behave mix` for a set time against a chosen server, printing joins refused, disconnects and errors by code, tick mean, p95 and worst (sampled from `/health` each second), bytes out, and the server's memory at start and end.
- Add `--behave` to `bench.mjs` as well, so the server's own cost is measured with no bots on the same machine.
- Add memory to `/health`.
- **Runs to report:** 50, 100 and 200 mixed bots on the PC; the same from the PC against a throwaway server on Morty, its real home; and one 30-minute soak at 100, for growth in memory, drops and the log.
- **The bar:** the plan's 10 ms mean at 200 players, on a 50 ms budget. If a fighting crowd can't meet it, say by how much and where the time goes. Graves decides whether the bar moves.
- Keep the numbers in the Dream Server README, by date and machine. A run may fail against a figure only once one has been measured, and the figure stays per machine.

### 5. Replays
- `RECORD=<dir>` makes a room write `{ zone, built, tables, seed, log }` as it goes, untrimmed. A GM action or a hot reload ends that
  recording with a note saying why, because the log can't describe it. Logging those instead is a later job.
- A checksum of every mover's position and health and every inventory at set ticks, so a mismatch names the first tick that differs and the entity.
- `test/replays/` holds a few small recordings made by bots over the test zones, with `test/replay.test.mjs` running them. The tables and zone live in the recording, so an edit in the Library can't break one.
- **A deliberate sim change will fail them.** `node bots/replay.mjs --update` records them again, and the commit says why. The failure message says this too.
- Find out first whether a real room replays at all: the room's own recording must match a replay of it before any of this is kept. Report what doesn't.

### 6. Docs
Dream Server README (bots, load figures, replays), `net/README.md` if a message changes, `docs/network.md` for the throwaway server recipe, the plan's status lines and testing layers.

## Find out and report

- **Fighting crowd:** finding 4's cost in ms and bytes at 200, and how much each client receives. Does a client too slow to keep up grow the server's memory without limit?
- **Soak:** do memory, `sim.log`, drops or wire slots grow over 30 minutes?
- **Morty:** how do its numbers compare with the PC's, which every figure so far came from?
- **The one unexplained test failure** of 2026-10-31 (two content tests, 1 run in 35): does it come back once the suite runs in a loop, and if so what is the error? Keep the log this time.

## Not in this job

Browser and screenshot tests (layer 4), the logged-transactions idea, splitting zones across processes, sleeping empty cells (measure only), shops, chat, or anything for the VPS. No bot accounts on Graves's real server.

## Done means

- `node --test` passes in `dream-server` and `dream-common`, ten runs in a row, with the scenario and replays in it.
- Breaking something on purpose is caught, then put back: a loot table that drops nothing fails the scenario, and a changed damage formula fails a replay, naming the tick.
- The load figures above are in the README, PC and Morty, and the bar is met or the shortfall is explained.
- `bot.mjs` still works as the README shows, and works against a live server with no Library.
- Every repo touched is committed, pushed and pulled on Morty. A server restarted there is proven with something that logs, not just `/health`.
- The report says which claims were checked and which were assumed, with the numbers measured.

## Care

- `C:` on the PC has about 4.7 GB free, and test runs write to `%TEMP%`. Remove every scratch folder, including after a failed run, and keep recordings small.
- Portal, World Builder and Skyfall Blade run in Graves's RDP session on Morty: leave them alone. A load run on Morty uses a throwaway server, and only while nobody is playing on the real one, since they share a machine.
- Never pipe a server's output through something that exits when starting it (`docs/network.md`).
- Never save over `Zones/Crystal Cascades`. `Tables/` on Morty's Library is live data, and nothing here writes to it.
