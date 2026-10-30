# Project Y UI in the Library

The Project Y screens from Graves's "Project Y — Inventory & Windows UI" canvas, as sprites and `ui`
pieces the way they would go into Unity. Brief: `docs/briefs/project-y-ui-sprites.md`.

**Provenance: all drawn here, nothing imported.** Every pixel is drawn by `dream-paint/project-y.js`
from the artboards' layout and colours (Graves's own design). Nothing is read from
`K:\Unity-Projects\*`, no bought pack (PixelArtGUI, Fantasy Icons Mega Pack) is copied, traced or
referenced, and none of the artboards' embedded images are used. Each sprite's and piece's meta carries
`made: dream-paint` and `generator: dream-paint/project-y.js`. This set was made under the old CC0-or-own rule; since 2026-10-31 bought packs may be used too (see Assets in `CLAUDE.md`).

## Making it again

Dream Paint, Game UI section: **Make Project Y set**. It draws everything and saves over what it saved
before (each save is a new version in the Library). `saveProjectY(library, look)` takes another `look`
(the colours at the top of the file) for another palette.

## What the generator draws (`Sprites/Project Y/`, kind `sprite`, tags `ui`, `project-y`, the part)

Panel frame, title strip (gold rule under it), button normal/hover/pressed, tab normal/hover/active, chip
normal/on, swatch ring normal/selected, inventory cell, a rarity frame per rarity (common `#8c939b`,
uncommon `#4fc27a`, rare `#4a9be0`, epic `#b06ae6`, legendary `#ffba00`), paper-doll slot, gold coin,
bar frame and fills for health/stamina/mana, scrollbar track and thumb, close button in three states,
and ten placeholder item icons, flat-shaded in Scald at 32 px: potion, sword, bow, helm, boots, gem,
scroll, ore, herb, food (tags `icon`, `placeholder`, `scald`). Whole-pixel fills only, gradients one flat
colour per row, discs by pixel centres: no anti-aliasing. Sizes are the artboards' 1x sizes (54 px bag
cells, 56 px paper-doll slots, 44 px swatches).

## Which artboard became which piece (`UI/Project Y/`, kind `ui`, slot 2's form)

| Artboard | Piece | Slots |
|---|---|---|
| Main menu | `Main menu` (760x560) | title, button 0..4, version, list title, save 0..2 portrait/name/detail/action, create, hint |
| Inventory & windows | `Inventory` (718x490) | title, close, doll head/chest/arms/hands/back/legs/feet/aura/main/off, doll, cell 0..48 (7x7, 54 px, gap 4), gold, count |
| Merchant | `Merchant` (730x480) | title, greeting, gold, close, tab buy, tab buyback, card 0..5, bag title, cell 0..48 (7x7, 46 px), status |
| Forge | `Forge` (780x520) | title, close, shards, essence, gold, tab craft/enhance/reroll/scrap, anvil, item title/kind/line, panel title/text, recipe 0..3, action, result, bag title, cell 0..23 (6x4) |
| Character creator | `Character creator` (760x700) | title, back, tab body/face/hair/extras/name, preview, facing, section title, chip male/female, skin 0..6, face 0..9, style 0..8, hair 0..6, name field, name hint, summary, randomise, reset, start |

Widget pieces beside them: `Button` (normal/hover/pressed, label), `Tab` (normal/hover/active), `Chip`
(normal/on), `Swatch` (normal/selected, colour), `Close`, `Cell` (icon), `Rarity frames` (one state per
rarity), `Stock card` (icon, name, sub, price; normal/hover), `Save slot` (portrait, name, detail,
action; normal/hover), `Health bar`, `Stamina bar`, `Mana bar` (empty/full, fill to the right) and
`Gold coin`. The screens bake no text; the demo lays Cinzel and Alegreya Sans over the slots.

No new field was needed in the `ui` form: rarity frames are states of one piece, tab strips are named
slots (`tab buy`, ...), and the five screens use new `template` names (`menu`, `merchant`, `forge`,
`creator`) with the same keys. Paint's own templates list does not offer these for "New from template";
they open, show their guides and save like any piece.

Demo: `dream-common/web/ui-templates-demo.html`, "Project Y" section (main menu and merchant at x1 and
x2, placeholder icons in the cells, the health bar at 60 %).

## Still for Graves to draw

The real item icons (the ten here are placeholders), portraits for the save slots and the paper doll's
figure, the title art behind the main menu, and any per-screen flourishes the artboards have as CSS
(glows, the legendary and epic shimmer).
