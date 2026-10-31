# Brief: Publish + GM, a live zone that stands on its own

**Built 2026-10-31.** Kept as written; `docs/pack-format.md` and the Dream Server README say what is true now.

The next stage of `docs/game-builder-plan.md` (build order: Dream Server, Codex, **Publish + GM**, Bots, then Story
and Motion). Written 2026-10-31 from the code and from Morty as it stands.

Read first: `CLAUDE.md`, `working-with-claude.md`, `docs/network.md`, `docs/pack-format.md`, `docs/tables.md`,
`pack/index.js`, `sim/systems/tables.js`, `dream-server/src/{content,publish,gm,reload,room,gameplay}.js`,
`dream-world/src/play/{publish,play,combat}.ts`, `gravepain-portal/start-all.bat`.

## Where it stands

Most of this stage was built early, in steps 9 and 10. Don't rebuild it.

| Built | Where |
| --- | --- |
| File > Publish zone: schema check, baked colliders, GLBs by hash, a report | `pack/`, `dream-world/src/play/publish.ts` |
| Staging, Promote, hot reload of an open room, content served by hash | `dream-server/src/{publish,content,reload}.js` |
| GM page: teleport, kill, spawn, reload, with a log | `dream-server/src/gm.js`, `/gm` |
| Two-part admin check: address and account flag | `adminCheck`, `tools/admin.mjs` |

What is missing, checked on 2026-10-31:

1. **A live zone still needs the Library.** A pack carries colliders, templates and GLBs, not the rest:
   - The server reads tables from the Library when a room opens (`room.js:54`). With no Library it falls back to the
     built-in defaults, so everything made in the Codex silently disappears.
   - Play reads through `/dl`: tables (`play.ts:175`), effect definitions (`play.ts:463`), piece meta (`play.ts:445`),
     item models and icons (`combat.ts:44`, `combat.ts:213`). A portal walk opens the target's terrain from the Library.
2. **Publish checks shape, not references.** Only a placed model's GLB is resolved. `buildPack` never runs
   `checkTables` and never checks an effect or a portal's target. The plan asks for this ("fails on a miss").
3. **There is no licence field** on a place and no mention of one in the publish report.
4. **Old builds are never cleaned up.** Staged builds and blobs only grow.
5. **None of it has been used on Morty.** `packs` holds no zones and `CONTENT` is `library`. The account `graves` has no
   admin flag, and neither `start-all.bat` nor Morty's `config.json` gives the Dream Server `DREAM_ADMIN`. So today
   the GM page and Promote should refuse Graves. Not tested by hand: check it by command line.

## Decisions already made

1. **The test of this stage is one measurement:** Play a published zone with the Library stopped and count requests to
   `/dl`. The answer must be zero, portals, a fight and a loot pickup included. That request list is also how to find
   anything this brief missed.
2. **One way to fetch content in Play.** The separate `fileUrl` helpers in `play.ts`, `combat.ts` and `publish.ts` become
   one resolver: `/dl` under `CONTENT=library`, the pack's hashes when live. New kinds of content then get this for free.
3. **Morty stays on `CONTENT=library` for everyday work**, as the plan says, so unpublished zones keep playing.
   Everything is proved on the PC first, then Morty is restarted on `live` for one supervised check and put back.
4. **The licence check reports and doesn't police.** Since 2026-10-31 anything Graves is entitled to may be used
   (`CLAUDE.md`, Assets). A place gets an optional `licence` text and an optional `noPublic: true`. The report lists every
   place a pack draws from. Publish refuses only a piece from a `noPublic` place, and only Graves sets that flag.
   Nothing is `noPublic` by default.

## Deliverables

### 1. Turn it on for Graves
- Dream Server gets `DREAM_ADMIN=192.168.1.0/24` from `start-all.bat` and Morty's `config.json`.
- Run `node tools/admin.mjs "graves"` on Morty. Find out first whether it is safe with the server running.
- `docs/network.md` says all this.

### 2. Tables travel with the game
Tables are global: an item in a player's bag must mean the same thing in every zone, so they can't simply live in
each zone's pack, where two zones could disagree. Recommended, to be overturned only with a reason:
- Each publish stores the whole table set as one blob by hash, and `pack.json` gains `tables: <sha256>`.
- The most recently promoted pack's tables are the live tables for **all** zones. A promote swaps them in every open
  room, as the GM's Reload does today.
- The status page shows which build the live tables came from.
- A player holding an item the new tables no longer have keeps it, and nothing crashes. Add a test for this.

### 3. Everything else travels too
- Blobs today are GLB only. Widen them to the Library's image, audio and JSON files, each served with its own type and
  still checked against its hash.
- The pack collects what a zone can reach: placed pieces, templates' models, item models and icons, effect definitions
  with their textures and flipbooks, UI sprites, terrain textures, and sounds if Play uses any.
- A portal's target loads from its live pack. A target with no live pack is a warning at publish and a clean message in
  the game, never a hang.

### 4. Publish fails on a miss
- `buildPack` runs `checkTables` and resolves every reference: template ids, loot, shop, ability, model, effect, icon.
- Each error names the record and the field, in the report Dream World already shows.
- Add the places and licences list from decision 4.

### 5. Builds: go back, and clean up
- Check that promoting an older staged build works as a rollback, then say so on the status page. Add a test.
- A clean-up button keeps the live build and the last five per zone, shows what it would delete and asks first. It
  removes only blobs no remaining build uses.

### 6. GM: what running a game needs
Add to `/gm`, each through `gm.log`: **kick**; **ban and unban** (an account flag, refused at login and hello, reason
shown); **give and take an item** (picker from the tables); **restore health**; **reset a zone's world state** (doors and
chests); and the last 200 log lines on the page. No chat or announcements: chat doesn't exist yet.

### 7. Docs
`pack-format.md` (format version 2, with what happens to version 1 packs), `tables.md`, the plan's status lines, the
Dream Server README's "Not yet" list.

## Not in this job

- **Hiding the art.** Plain GLBs at `/content/assets/<hash>.glb` can still be saved. Graves expects the finished public
  game to pack them into game data. That belongs with zone baking (merged meshes, LODs) when a VPS is near. Keep the
  resolver in decision 2 as the seam so the client doesn't have to change.
- **VPS, HTTPS, signed packs, the push from Morty.** No VPS is planned yet.
- **Password reset, token revocation, account deletion.** Needed before a public launch.
- **Worn parts on the body, buying in shops, chat.** These are their own jobs.

## After this

**Bots.** `bots/bot.mjs` only walks, and `bench.mjs` only measures. The next stage adds a bot that fights, loots and
wears gear over the real protocol, and replay regressions (seed plus intents) in the test run. Then Story and Motion.

## Done means

- `node --test` passes in `dream-common` and `dream-server`, and `npm test` in `dream-world`.
- **On the PC, with the Library stopped:** make a test item, abilities and NPC in the Codex, publish and promote; stop the
  Library; Play, kill, loot, wear, walk a portal to a second published zone. Zero `/dl` requests, shown from the network
  log.
- A deliberately broken reference is refused, with a message naming the record.
- Promote an edit with players in the room: new tables reach them, nobody is dropped. Promote the old build: it goes back.
- 200 bots hold their tick time, measured before and after.
- On Morty by command line: Graves's account is admin, `/api/gm` answers for it, a published test zone lists in
  `/api/packs` and is removed afterwards. Graves is told what to look at, since agents don't drive Morty's pages.
- Every repo touched is committed, pushed and pulled on Morty, with servers restarted as `docs/network.md` says. Stop the
  server before a pull that replaces a page it may hold open.

## Care

- **Never save over `Zones/Crystal Cascades`.** Tests use "Portal Test" and "Crystal Cascades portal".
- `Tables/` on Morty's Library is live data. Test records use a `test-` prefix and are removed afterwards. `start-all.bat`
  copies the newer file each way, so a PC table with test records can overwrite Morty's: restore it before stopping. It
  deletes nothing either, so a template or loot table the Codex deleted on one machine comes back from the other.
- Changing `dream.db` by hand on a running server can lose to its one-second write queue: use the tools.
- The dream-server test "a client holding a stale hash..." failed 1 of 5 runs on 2026-10-31, cause not captured, and it
  covers code this job changes. Run the suite ten times before starting and capture the failure if it comes back.
- Portal, World Builder and Skyfall Blade run in Graves's RDP session on Morty: leave them alone.
- The report says which claims were checked and which were assumed, with the numbers measured.
