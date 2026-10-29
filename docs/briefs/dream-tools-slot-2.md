# Brief: Dream Tools, slot 2 (Paint game UI templates)

Slot 2 of the order in `docs/review-ui-plan-2026-10-29.md`. Read first: `working-with-claude.md`,
`CLAUDE.md`, the "Finish the base tools first" section of `docs/game-builder-plan.md`, and
`K:\dream-paint\README.md` and `main.js` (766 lines: a layered canvas document saved as a PNG sprite
with its `.paint.json` beside it).

## What it is

Game UI drawn in Dream Paint and used, unchanged, by the game HUD. Not the editor chrome (that is
`dream-common/web/ui/`, slot 1); this is what the player sees: an inventory grid, a hotbar, a dialogue
box, health and stamina bars, buttons, frames and icon slots.

## Deliverables

1. **Templates in Paint.** A "UI template" picker on New: inventory grid (cells x by y, cell size),
   hotbar (n slots), dialogue box, bar (health, stamina, mana), button (normal, hover, pressed), frame,
   icon (16, 32, 64). Picking one makes a document at the template's size with guide layers that do
   not export: the nine-slice border lines and the named slots (cell 0..n, the portrait area, the text
   area, the fill of a bar). Guides are editable (drag the slice lines, resize cells) and snap.
2. **The saved form.** Kind `ui`: `<name>.ui.json` in the Library with the sprite PNG beside it (the
   Library's companion convention: `<name>.ui.json`, `<name>.ui.json.png`? decide, and add the kind and
   extension to `KINDS` in `dream-library/server.mjs` and to `kindOf`). The JSON holds: template, size,
   nine-slice insets, named slots with rects, states (button) as rects in one sheet, and for bars the
   fill rect and direction. Tags: `ui`, the template name. The `.paint.json` layers go with it as today
   so it reopens.
3. **The loader**, `dream-common/web/ui-templates.js`: `loadUi(place, path)` returns the image and the
   JSON; `nineSlice(el, ui)` sets a DOM element's `border-image` from the insets; `slotRect(ui, name)`;
   `fillBar(el, ui, fraction)`. Plain ES module, no build step, served as `/common/ui-templates.js`.
4. **A demo page** `dream-common/web/ui-templates-demo.html` that loads one of each from the Library and
   shows an inventory with ten icons dropped into cells, a bar at 60 %, a button in its three states,
   and a dialogue box with text in its text area, all scaled x2 and x3 with crisp pixels.
5. **Starter set** saved to the Library under `UI/`: one of each template in the Scald palette, drawn
   plainly (flat fills, 1 px borders), so the game builder has something to show before art is made.

## Rules

- Paint stays dependency-free and plain JS. The theme and toast from slot 1 stay as they are.
- Pixel-crisp: templates default to pixel sizes and `image-rendering: pixelated` in the loader.
- Nothing names another port; the Library is `${location.origin}/dl`, the kit `${location.origin}/common`.
- Commit per repo with what changed and why, the `Co-Authored-By` line, push `origin main`, mirror
  with `git -C /z/<repo> -c safe.directory='*' pull --ff-only`. Patch files with a Python script written
  by the Write tool (Bash heredocs mangle backslashes here). Running servers need a restart to pick up
  server changes: the Library's `KINDS` change does; ask Graves or the coordinating session.
- Write scopes: `dream-paint/*`, `dream-library/server.mjs` (`KINDS` and `kindOf` only), the two new
  files in `dream-common/web/`, `dream-forge-creations/UI/` through the Library's save API.

## Done means

Verified in the browser and reported with what was checked versus assumed: a new inventory template
opens with its guides, is painted, saved, reopens with guides; the demo page shows all five items from
the Library at x2 and x3 with crisp edges and the bar filling; the Library lists them as kind `ui`.
