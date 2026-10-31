# Brief: Dream Codex, first version

The Codex stage of `docs/game-builder-plan.md` (build order: Dream Server, **Codex**, Publish + GM, Bots, then
Story and Motion). Step 10 left gameplay data as hand-written JSON files; the Codex is where it gets authored.

Read first: `CLAUDE.md`, `working-with-claude.md`, `docs/network.md`, `docs/tables.md`, `docs/zone-format.md`,
`sim/systems/*` (above all `tables.js`, `ai.js`, `stats.js`), `web/schema/{validate,components,entity}.js`,
`web/ui/{panes,window,inspector}.js`, `sim/bridge.js`, `dream-library/server.mjs`, `dream-library/public/index.html`,
`dream-server/src/gameplay.js`, `dream-world/src/manifest.ts`.

## What it is

A page for making the game's data without touching JSON: **items, abilities, loot tables, shops and NPC
templates**, with modifiers edited inside items and abilities. Output is Library files the sim already reads, so
what is saved here is what plays.

## Decisions already made

1. **A page of the Library, not a new tool.** `dream-library/public/codex.html`, opened from the Library and with
   its own portal card. No port 5280 and no new repo; the plan allows this ("may start as a tab in the Library
   page"), the 2026-10-29 review recommends it, and an agent cannot create a GitHub repo. It moves out if it outgrows
   this. Check first that the Library serves a second page from `public/`; if it doesn't, that is the one server
   change.
2. **Use the kit.** Floating windows from `web/ui/panes.js`, rows from `web/ui/inspector.js`, theme tokens only.
   A list window (search, new, duplicate, delete) and an inspector window, one tab per kind.
3. **One description of each record.** Add `web/schema/tables.js` with field lists for ability, item, loot and shop,
   in the shape `validate.js` and `inspector.js` already take, so the form and the check share a source. `MODIFIER`
   stays in `components.js`.
4. **`checkTables` in `sim/systems/tables.js` stays the authority.** The page runs it on the whole set before saving
   and refuses a save it fails, naming the record. Don't fork the rules into the page.
5. **Stats are not a table yet.** The sim has health, stamina and speed. Export that list from `sim/` and make a
   modifier's `stat` a pick from it. A free-text stat that nothing reads is the failure to avoid.
6. **Files stay as `docs/tables.md` says**, saved with `/api/save` and `overwrite` so the Library keeps versions:
   `Tables/abilities.json`, `Tables/items.json`, `Tables/loot/<id>.json`. New: `Tables/shops/<id>.json`, and
   templates as `Templates/<id>.template.json` in the format `entity.js` already defines.

## Deliverables

1. **Schemas and checks**: `web/schema/tables.js`; `checkTables` also covers shops `{ id, name, currency, entries:
   [{ item, price, stock? }] }` (`currency` and `item` must be item ids) and template references (loot table, shop
   table and ability exist). Tests in `test/`.
2. **The page**: the five kinds, each with new, duplicate, delete and undoable edits until saved.
   - Pickers, never typed ids: an item in loot and shops, a loot table, a shop, an ability, and a Library model and
     effect through the existing Library window (`web/library.js`).
   - Loot shows each entry's percentage chance, worked out from the weights.
   - Deleting a record something uses says what uses it and asks first.
   - An item shows its model in a small preview; an ability shows its effect's name, no playback needed.
3. **NPC templates that work in the game.** A template holds `model`, `npc`, `stats`, `hostile`, `collider`, `loot`
   and `shop` components. No template files exist yet, so this needs the other half: the Library knows kind
   `template`, Dream World lists them for placing (`manifest.ts`, near where characters become animals), and
   `sim/bridge.js` resolves an entity against its template through `resolve()` in `entity.js`, in the editor, in
   Play and on the Dream Server. Rebuild the boar stand-in as the first real template.
4. **Shops are authored and checked, not playable.** Buying needs an intent, currency handling and a window, and is
   its own later job. Say this on the Shops tab so nobody hunts for why it does nothing.
5. **Equipment in the 8 slots** (Graves, 2026-10-31: Head, Shoulders, Top, Gloves, Belt, Pants, Boots, Cape). An item may
   carry `equip { slot, set, worn: [MODIFIER] }`: `set` names the Ida Faber set it looks like (Advanced, Champion,
   Newbie), `worn` holds while it is on. The sim takes `equip { slot }` and `unequip { wear }`, keeps what is worn with
   the inventory and saves it with the player. Play's inventory wears and takes off. Showing the worn parts on the
   player's body in Play is a later job, because it needs the worn state on the wire and Dream Characters' skin cut.
6. **Docs**: update `docs/tables.md`, `docs/zone-format.md` ("No template files exist yet"), the plan's status lines,
   the Library README and `CLAUDE.md`'s table and planned-ports line.

## Not in this job

Buying in shops, new stats or stat formulas, classes and levels, quests and dialogue (Dream Story), animation timing
(Dream Motion), icons for items, publish changes beyond the question below.

## Assets

Since 2026-10-31 the series may use anything the owner is entitled to, including packs he paid for (`CLAUDE.md`,
Assets). A bought creature model may replace the boar stand-in if a good one is at hand; don't go hunting for one.

## Find out and report

Don't assume these, and say what you found:
- Does a published pack (`pack/`, `docs/pack-format.md`) carry the tables and templates, or does a live room fall back
  to `DEFAULT_TABLES`? Fix it if it is small; otherwise report it.
- `gameplay.js` reads tables when a room opens. How does an edit reach a running room, and what must the page tell the
  author about that?
- `tablesOf` merges over the defaults, so a deleted default record comes back. Does that make Delete a lie for
  `strike`, `potion` and the rest? Fix or say so in the page.

## Done means

- `node --test` passes in `dream-common` (and `dream-server` if touched), with a test that a template's components
  reach a sim entity.
- In a browser on the PC: make an item, put it in a loot table, make an NPC template using that table, place it in a
  zone, press Play, kill it, pick up the item. Then the same on Morty at `http://192.168.1.111:<port>/`.
- Bad data is refused with a message naming the record.
- 200 bots still hold their tick time, measured before and after, if the sim changed.
- Every repo touched is committed, pushed and pulled on Morty, with servers restarted as `docs/network.md` says.

## Care

- **Never save over `Zones/Crystal Cascades`.** Tests use "Portal Test" and "Crystal Cascades portal".
- `Tables/` on Morty's Library is live data. Test records use a `test-` prefix and are removed afterwards; leave the
  existing records' values alone.
- Portal, World Builder and Skyfall Blade run in Graves's RDP session on Morty: leave them alone.
- The report says which claims were checked and which were assumed, with the numbers measured.
