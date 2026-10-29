# Brief: Project Y UI as Library sprites and UI templates

Graves's decision on 2026-10-29: the Project Y screens designed on the "Project Y — Inventory & Windows
UI" canvas go into the Dream Library as sprites and `ui` templates, the way they would go into Unity,
not as HTML. Read first: `working-with-claude.md`, `CLAUDE.md`, `docs/briefs/dream-tools-slot-2.md`
(the `ui` kind, `dream-common/web/ui-templates.js` and its demo page, which this builds on),
`K:\dream-paint\README.md`, and the six artboards saved as references at
`K:\dream-forge-creations\References\Project Y UI\*.dc.html` (HTML with inline styles; read them for
layout, sizes, colours, slot counts and states, not to serve them).

## The sources

- `K:\Unity-Projects\projrct-y\Assets\_GUI\PixelArtGUI\Textures\{Bars,Buttons,Icons,Misc,Panels}`:
  627 PNGs, the pixel frames, buttons, bars and icons the "A — Pixel icons" artboard uses.
- `K:\Unity-Projects\projrct-y\Assets\_GUI\FantasyIconsMegaPack\*`: 4,711 PNGs in categories
  (ArmorIcons, EngineeringCraftIcons, FoodIconPack, GemsIcons, Herbal_Icons, ...), the painted item
  icons the other artboards use. Its `ReadMe.txt` is the licence note: read it, and put a one-line
  summary of what it allows in the folder's meta tags (`licence:...`). Both are bought asset-store
  packs: the Library is a home-LAN tool, not a public site, but say in the report what the licences
  say about redistribution so Graves knows.
- The artboards' own look: Cinzel and Alegreya Sans type, gold `#e9c873` / `#c9a453` on blue-grey
  `#1d2836`..`#0e141c`, rarity colours common `#8c939b`, uncommon `#4fc27a`, rare `#4a9be0`, epic
  `#b06ae6`, legendary `#ffba00`.

## Deliverables

1. **Sprites in the Library.** Under `dream-forge-creations/Sprites/Project Y/`: all of PixelArtGUI's
   Textures as kind `sprite` with tags (`ui`, `pixelartgui`, its subfolder), and the Fantasy icons
   that the artboards use plus whole categories that make sense for the game (armour, weapons,
   potions, materials, gems, food, herbs: pick by the categories the artboards draw from, not all
   4,711; say what you left out). Keep the packs' file names. Import with a script through the
   Library's save API (or a copy plus `.meta.json` per file if the server accepts files placed on
   disk: check how `dream-library/server.mjs` indexes a folder before choosing). Nothing is written
   into the Unity project.
2. **UI templates** as kind `ui` under `dream-forge-creations/UI/Project Y/`, one per artboard, built
   from PixelArtGUI's panel and button textures as nine-slice sprites, with the slots the artboard
   has: main menu (title area, five buttons normal/hover/pressed, save-slot list with portrait, name,
   detail and action areas), inventory (the grid, cell size and count from the artboard, rarity frame
   per cell as separate sprites, the paper-doll slots), merchant (stock list card, gold readout,
   buy/buyback tabs, the 7x7 bag), forge (whatever its artboard has: read it), character creator
   (section tabs, option chips, swatches, name field), plus the bars (health, stamina, mana) and the
   gold coin. Each `.ui.json` follows slot 2's form: template, size, nine-slice insets, named slots
   with rects, states as rects in one sheet, bars with fill rect and direction; the sprite sheet PNG
   beside it; `.paint.json` layers so it reopens in Dream Paint.
3. **Demo page**: extend `dream-common/web/ui-templates-demo.html` (write scope for this file only)
   with a "Project Y" section that loads the main menu and the merchant from the Library through
   `ui-templates.js` and shows them at x1 and x2 with icons dropped into the inventory cells and a
   bar at 60 %. Crisp pixels (`image-rendering: pixelated`).
4. **A note** in `docs/` (`docs/project-y-ui.md`): what was imported from where, the licence
   summary, which artboards became which templates, and what is drawn by hand versus taken from the
   packs.

## Rules

- Plain JS, no build, no packages. Nothing names another port; the Library is `${location.origin}/dl`.
- The `ui` form from slot 2 is the contract: if it lacks a field (rarity frames, a tab strip), add it
  to the loader with a line in the slot 2 README and say so; do not fork a second form.
- Commit per repo with what changed and why and the `Co-Authored-By` line the session gives you; push
  `origin main`; mirror with `git -C /z/<repo> -c safe.directory='*' pull --ff-only`. Patch files with
  a Python script written by the Write tool (Bash heredocs mangle backslashes here). If
  `dream-library/server.mjs` needs a change, tell the coordinating session and it restarts both
  Libraries.
- Write scopes: `dream-forge-creations/Sprites/Project Y/`, `dream-forge-creations/UI/Project Y/`
  (through the save API or as files plus meta, see 1), `dream-paint/*` only if a template needs a
  Paint change, `dream-common/web/ui-templates.js` and `ui-templates-demo.html`, `dream-common/docs/`.
  Not the Unity project, not `dream-library`, not `Dream Forge`, not `dream-world`.

## Done means

Verified in the browser and reported with what was checked against what was assumed: the Library
lists the Project Y sprites and the `ui` templates with thumbnails; the main menu template reopens in
Dream Paint with its guides; the demo page shows the main menu and the merchant from the Library at
x1 and x2 with crisp edges, icons in the cells and the bar filling; the licence summary is in the
note and the report.
