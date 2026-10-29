# Brief: Project Y UI as Library sprites and UI templates

Graves's decision on 2026-10-29: the Project Y screens designed on the "Project Y — Inventory & Windows
UI" canvas go into the Dream Library as sprites and `ui` templates, the way they would go into Unity,
not as HTML. **Only CC0 assets or assets Graves makes himself may be used in this project.** The
PixelArtGUI and Fantasy Icons Mega Pack files in the Unity project are bought packs and are NOT to be
imported, copied, traced or referenced: every sprite here is drawn new in Dream Paint (by script or
by hand) from the artboards' layout and colours. Read first: `working-with-claude.md`, `CLAUDE.md`,
`docs/briefs/dream-tools-slot-2.md` (the `ui` kind, `dream-common/web/ui-templates.js` and its demo
page, which this builds on), `K:\dream-paint\README.md`, and the six artboards saved as references at
`K:\dream-forge-creations\References\Project Y UI\*.dc.html` (HTML with inline styles; read them for
layout, sizes, colours, slot counts and states, not to serve them). The `<img src="/_blob/...">` icons
in those artboards are the bought packs' images: ignore them, they are not available and not wanted.

## The look (from the artboards, which are Graves's own design)

Cinzel and Alegreya Sans type (Google Fonts, OFL: fine for the demo page; sprites bake no text), gold
`#e9c873` / `#c9a453` on blue-grey `#1d2836`..`#0e141c`, panels with a 1 px `#4b5f74` edge and a gold
rule under the title strip, pressed/hover states as a gold gradient (`#f2d27c` to `#c99a35`), rarity
colours common `#8c939b`, uncommon `#4fc27a`, rare `#4a9be0`, epic `#b06ae6`, legendary `#ffba00`.
Pixel-art scale: draw at 1x pixel sizes (a 54 px bag cell is 54 px), crisp edges, no anti-aliasing.

## Deliverables

1. **The frames and widgets as sprites**, drawn in Dream Paint (a generator script in `dream-paint/`
   is fine, so they can be regenerated with another palette) and saved under
   `dream-forge-creations/Sprites/Project Y/` as kind `sprite` with tags (`ui`, `project-y`, the
   part): panel frame (nine-slice), title strip, button in normal/hover/pressed, tab, chip, swatch
   ring, inventory cell plus a rarity frame per rarity, paper-doll slot, gold coin, bar frame and
   fill for health/stamina/mana, scrollbar, close button, and a small set of placeholder item icons
   drawn plainly (potion, sword, bow, helm, boots, gem, scroll, ore, herb, food: ten flat-shaded
   icons in the Scald palette) so the screens have something in their cells until Graves draws his.
2. **UI templates** as kind `ui` under `dream-forge-creations/UI/Project Y/`, one per artboard, built
   from those sprites with the slots the artboard has: main menu (title area, five buttons
   normal/hover/pressed, save-slot list with portrait, name, detail and action areas), inventory (the
   grid, cell size and count from the artboard, rarity frame per cell as separate sprites, the
   paper-doll slots), merchant (stock list card, gold readout, buy/buyback tabs, the 7x7 bag), forge
   (read its artboard), character creator (section tabs, option chips, swatches, name field), plus
   the bars and the coin. Each `.ui.json` follows slot 2's form: template, size, nine-slice insets,
   named slots with rects, states as rects in one sheet, bars with fill rect and direction; the
   sprite sheet PNG beside it; `.paint.json` layers so it reopens in Dream Paint.
3. **Demo page**: extend `dream-common/web/ui-templates-demo.html` (write scope for this file only)
   with a "Project Y" section that loads the main menu and the merchant from the Library through
   `ui-templates.js` and shows them at x1 and x2 with the placeholder icons in the inventory cells
   and a bar at 60 %. Crisp pixels (`image-rendering: pixelated`).
4. **A note** in `docs/` (`docs/project-y-ui.md`): which artboards became which templates, what the
   generator draws, the provenance line (all drawn here, nothing imported), and what Graves still
   needs to draw himself (real item icons, portraits).

## Rules

- Plain JS, no build, no packages. Nothing names another port; the Library is `${location.origin}/dl`.
- Provenance: nothing is read from `K:\Unity-Projects\*`; no image from the artboards' blobs; the
  meta of every sprite carries `made: dream-paint` and the generator script name.
- The `ui` form from slot 2 is the contract: if it lacks a field (rarity frames, a tab strip), add it
  to the loader with a line in the slot 2 README and say so; do not fork a second form.
- Commit per repo with what changed and why and the `Co-Authored-By` line the session gives you; push
  `origin main`; mirror with `git -C /z/<repo> -c safe.directory='*' pull --ff-only`. Patch files with
  a Python script written by the Write tool (Bash heredocs mangle backslashes here). If
  `dream-library/server.mjs` needs a change, tell the coordinating session and it restarts both
  Libraries.
- Write scopes: `dream-forge-creations/Sprites/Project Y/` and `dream-forge-creations/UI/Project Y/`
  through the Library's save API, `dream-paint/*` (the generator and any template change),
  `dream-common/web/ui-templates.js` and `ui-templates-demo.html`, `dream-common/docs/`. Not the
  Unity project, not `dream-library`, not `Dream Forge`, not `dream-world`.

## Done means

Verified in the browser and reported with what was checked against what was assumed: the Library
lists the Project Y sprites and the `ui` templates with thumbnails; the main menu template reopens in
Dream Paint with its guides; the demo page shows the main menu and the merchant from the Library at
x1 and x2 with crisp edges, placeholder icons in the cells and the bar filling; the note states that
nothing was imported from the bought packs.
