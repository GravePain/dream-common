# Content packs (`dream-pack`, version 2)

A pack is what players see of one zone, separate from the Library's live files (game builder plan,
Phase 3): with one promoted, a client plays with the Library stopped. Dream World builds it in the browser (File > Publish zone) with `dream-common/pack/index.js`
`buildPack`; the Dream Server checks it again (`checkPack`), stages it, and serves the live one. Plain JS,
shared: `pack/index.js` (build, check, the sim input), `pack/glb.js` (a GLB's bounds without three.js),
`pack/hash.js` (SHA-256: WebCrypto, or plain JS where a browser on a LAN address over HTTP has none).

## On disk (Dream Server, `PACKS_DIR`, default `dream-server/packs`)

```
PACKS_DIR/
  blobs/<sha256>                        every file the server was sent, by hash alone (PUT /api/assets/<sha256>); builds share them
  staging/<zone id>/<built>/pack.json   a published build: this one file
  live/<zone id>/current/pack.json      the promoted build
  tables.json                           which blob holds the live tables, and the build that set them
  characters.json, characters/          characters the Library confirmed at a hello, and their GLBs (see below)
```

## `pack.json`

The JSON is canonical: every object's keys sorted, so the same input gives the same bytes.

| Field | What |
| --- | --- |
| `format`, `version` | `"dream-pack"`, `1` |
| `id` | the zone's id (`zone.id`; the folder name under `staging/` and `live/`) |
| `ref` | the zone's Library ref, `"place\|path/zone.json"`: what a `hello` names, and how a room finds its live pack |
| `built` | the build's name (`[A-Za-z0-9_-]{1,40}`; Dream World uses the UTC time, `20261030-221500`) |
| `hashes` | `{ "<place\|path>": "<sha256>" }` for every file the zone reaches: placed models, npcs' models, effects and the textures they draw, ground textures, Play's own UI (`PLAY_FILES`), the tables' item models. The extension says the kind; a pack carries only `TYPES` |
| `animals` | `{ "<def id>": { name, model, idle?, walk? } }`: what Dream World draws each placed animal or npc template with, so it needs no catalogue from the Library |
| `tables` | the sha256 of the gameplay tables' blob (below) |
| `zone` | the zone record (`web/schema/zone.js`), its `cells` list matching the pack's cells |
| `cells` | the cell records (`web/schema/cell.js`), sorted by x then z, entities by uid, **with the colliders baked** |
| `templates` | the template records the Library had at publish; their components are already baked into the cells' entities |
| `colliders` | how many collider entities were baked (for the report) |

Brief note: the step 9 brief wrote the zone id and the zone record both as `zone`; one JSON key cannot be
both, so the id is `id` and the record is `zone`.

**Baked colliders.** Each placed piece's shapes come from its Library meta (`colliders`), else one shape from
its model's bounds, through `sim/bridge.js` `simInput` exactly as Play and the room used to make them at
load: one entity per shape, uid `<entity>:c<k>`, `template: "collider"`, `parent` the piece, in the cell its
own position falls in. A room (and online Play's prediction) builds its sim with `packInput(pack)`, which
runs the bridge again with no piece info, so the baked shapes stand and nothing is asked of the Library.
These entities sit outside the entity uid pattern; `checkPack` checks them on their own.

**The tables.** Every publish stores the gameplay tables as they stand in the Library, as one blob: `{ abilities,
items, loot, shops, hashes }`, `hashes` naming the files the tables use. Tables are global, because an item in a player's
bag must mean the same in every zone: **the last pack promoted, of any zone, sets the live tables for all of them**, and a
promote that changes them swaps them in every open room (`event { type: 'tables' }`) and goes on working after a
restart. So does going back: promoting an older build brings its tables back too. A player holding an item the new
tables no longer have keeps it, doing nothing, until a later promote brings the record back.

**Validation.** `buildPack` returns `{ ok, report: { errors, warnings, places }, pack, json, assets }`. Errors (the
publish is blocked), each named by record (`cell x1z0`, `loot boar`) and path: a zone, cell or template record against its
schema; a bad `ref` or `built`; anything `checkTables` finds (a loot table naming no item, a template naming no loot,
shop or ability); a placed template that does not exist; a model, npc model, item model, effect or effect texture that
cannot be read; a portal to a zone the Library does not have; a file from a place marked `noPublic`. Warnings: a piece with
no saved colliders (a shape from its bounds, or none), a cell listed in the zone with no file, a portal to a zone with no
live pack, a ground texture or Play UI file that cannot be read (each has a stand-in).

**Places and licences.** `report.places` lists each Library place the pack draws from, with its file count and licence
note, and Publish zone shows it. A place's `licence` and `noPublic` live in `library.json`; set them with the § on the
place in the Library panel. Nothing is `noPublic` unless marked.

**Version 1 packs.** A live one keeps playing (its GLBs are found under their old `<sha256>.glb` names), but it brings no
tables and its npcs, effects and ground still need the Library; the server refuses to stage a new one. Publish the zone again.

## The server (`dream-server/src/content.js`, `src/publish.js`)

| Route | Who | What |
| --- | --- | --- |
| `GET /api/packs` | anyone | staging and live per zone |
| `POST /api/publish { pack }` | admin | `{ staged: false, need: [sha256] }` until every GLB is there, then `{ staged: true, id, built }` |
| `PUT /api/assets/<sha256>` | admin | one file; refused unless the bytes hash to the name |
| `POST /api/promote { zone, built }` | admin | staging to live, an older build too (that is going back); the zone's open room hot-reloads, and the tables change everywhere |
| `GET` / `POST /api/clean` | admin | what a clean-up would remove / remove it: builds past each zone's live one and newest five, then blobs nothing left names (none under an hour old: a publish may be in progress) |
| `GET /content/tables.json` | anyone | the live tables (`no-cache`); 404 before any pack has set them |
| `GET /content/packs.json` | anyone | the live packs `[{ id, ref, name, built }]` |
| `GET /content/<zone id>/pack.json` | anyone | the live pack (`no-cache`) |
| `GET /content/assets/<sha256>.<ext>` | anyone | a file, typed by its extension (`Cache-Control: public, max-age=31536000, immutable`) |
| `GET /content/character?place=&path=[&meta=1]` | anyone | a character a hello checked, from the Library or the server's copy |

Admin is both: the request comes from the server's own machine or an address in `DREAM_ADMIN` (the Library's
rule; `X-Forwarded-For` believed only from this machine, which is how Dream World's `/ds` proxy reaches it),
and it carries the session token of an account flagged `admin` (`node tools/admin.mjs "Name"`).

**Hot reload.** A promote swaps the open room's static world at its next tick (`src/reload.js`): a new sim
world from the pack, every player and npc carried over where it stands (velocity, order, seq, ai) and
re-snapped to the new ground; the sim's tick, log, random and listeners stay. Every client gets
`event { type: 'reload', built, slots }` and re-fetches `pack.json`: pieces moved, added or removed follow,
and a piece whose hash changed (`changedModels`) loads the new GLB by its hash. A pack of another zone size
is not hot-loaded (the room takes it when it next opens).

**On the client.** `web/resolve.js` is the one way a game page fetches a Library file. While `useLive(pack)` holds
(Dream World's `play/content.ts`) a file the pack or the live tables carry comes from `/content`, and anything else still
asks `/dl`, so counting `/dl` requests finds a gap in a pack.

**Measured 2026-10-31, the PC, the Library stopped:** File > Open live zone, Play online, kill an npc, pick up its drop, promote
new tables and go back with the player in the room, walk a portal into a second published zone: no request to `/dl` from
Play on. Dream World itself is still the editor, so its boot and its Library panel ask for `/dl/api/places` and get nothing;
a public client built from the same code will not have them.

**Not in a pack yet:** players' characters. They reach the server through a hello the Library confirmed (`PACKS_DIR/characters`), so a
server that has never had a Library, as a VPS will not, knows none: that job goes with the VPS. Plain GLBs at open URLs can
also still be saved as they are: hiding the art belongs with zone baking.

**Rooms load from live only.** With no live pack the hello is refused with `error { code: 'unpublished' }`.
`CONTENT=library` in config keeps the pre-pack behaviour (the room reads the Library) for development.
