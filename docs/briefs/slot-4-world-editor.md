# Brief: slot 4, the Dream World editor rebuild (hierarchy, inspector, windows, parents)

Slot 4 of `docs/review-ui-plan-2026-10-29.md`, unblocked by the zone schema (`docs/zone-format.md`,
`dream-common/web/schema/*`, `dream-common/web/zone.js`). Read first: `working-with-claude.md`,
`CLAUDE.md`, `docs/ui-plan.md` sections "Shared kit", "The Unity workflow", "Dream World as an editor"
and "Decisions", findings 6 and 7 of `docs/review-ui-plan-2026-10-29.md`, `docs/zone-format.md`, the
shared kit as it exists (`dream-common/web/ui/{window.js,gizmo.js,theme.css,toast.js,demo.html}`), and
`K:\dream-world\src\main.ts` (1,335 lines: selection, gizmo, placing and UI wiring all in one file),
`ui.ts`, `world.ts`, `save.ts`.

Two other sessions run at the same time: the sim skeleton (`dream-common/sim/*`, `dream-common/test/`)
and Forge collider proxies (`Dream Forge/*`, templates' meta). Do not touch those paths. Dream World's
Play button is a later job; leave a stub slot in the toolbar, nothing more.

## What it is

Dream World becomes the Unity-style editor Graves decided on: floating, resizable windows (Hierarchy,
Inspector, Library) over the viewport, one selection shared by hierarchy and viewport, objects that can
be parented and grouped, and all of it saved into the zone format's `parent` and `name` fields. The
tray that Terrain and Paint tools still need keeps a home (finding 6).

## Deliverables

1. **Kit additions** in `dream-common/web/ui/`: `menubar.js` (app name in the accent, File / Edit /
   View / Window menus, the portal link), `tree.js` (expand/collapse, select with click, Ctrl and
   Shift, rename with F2, drag to reparent or reorder, visibility toggle, search; data through
   callbacks), `inspector.js` (rows from a small schema: number with drag-scrub, vector3, colour,
   slider, toggle, select; takes the `dream-common/web/schema` field shapes directly so a component's
   fields render without a second description). `demo.html` shows all three. Plain ES modules, theme
   tokens only, no build.
2. **Dream World windows** using the kit: Hierarchy (objects grouped by category, or as the user
   groups them, plus lights, effects, animals), Inspector (Transform rows, then the selected entity's
   components from the schema: `model`, `npc`, `animal`, `fx`, `light`, `collider`, `interact`,
   `portal` and the rest, each addable from a "+ component" menu), Library (the docked `library.js`
   panel as a window; drag a card into the viewport to place). Window positions remembered per app.
3. **Selection and parenting**: click, Ctrl+click, box-drag select; the gizmo from `gizmo.js` on the
   selection; drag in the hierarchy to parent; a parent moves its children; delete asks when children
   exist. Parents, names and components go into the zone format (`entity.parent`, `entity.name`,
   `entity.components`) through `zone.js`; "Save as zone" and "Open zone" carry them; `.scene.json`
   keeps saving the flat form for old scenes (children flattened with world transforms).
4. **`main.ts` split** (review D21): `selection.ts`, `gizmo.ts` (the wrapper over the kit), `hierarchy.ts`,
   `inspector.ts`, `windows.ts`; `main.ts` becomes wiring. No behaviour change beyond this brief.
5. **The tray**: Terrain, Paint, Water and Effects tools keep their bottom tray; the object trays
   (trees, rocks, props, buildings, animals) move into the Library window with the same filters.
6. **Tests** (review D19) for the pure parts: `dream-world/src/*.test.ts` or `dream-common/test/` for
   the hierarchy model (reparent, reorder, flatten with world transforms, round trip through
   `zone.js`), run with the project's `tsc` plus `node --test` on the compiled or plain modules.
7. **Docs**: `dream-world/README.md` (the windows, shortcuts, parenting), `dream-common/web/ui/README`
   line per module, a slot 4 line in `docs/review-ui-plan-2026-10-29.md`'s order table.

## Rules

- Only CC0 assets or Graves's own content. Plain JS kit, TypeScript under Vite in Dream World (Vite
  picks up `src/` without a restart). Nothing names another port.
- Keep every file under about 500 lines; the kit modules are shared, so no Dream World specifics in them.
- Commit per repo with what changed and why and the `Co-Authored-By` line the session gives you; push
  `origin main`; mirror with `git -C /z/<repo> -c safe.directory='*' pull --ff-only`. Patch files with
  a Python script written by the Write tool (Bash heredocs mangle backslashes here).
- Write scopes: `dream-common/web/ui/*`, `dream-world/*`, `dream-common/docs/review-ui-plan-2026-10-29.md`
  (one line). Not `dream-common/sim`, not `dream-common/web/schema`, not `zone.js` (if it needs a
  field, say so in the report), not `Dream Forge`.

## Done means

Verified in the browser on port 5240 (Library on 5230, both running) and reported with what was
checked against what was assumed: Crystal Cascades opens from its zone; the hierarchy lists its
objects; three boulders are dragged under a new "Rocks group" node, the group is moved with the
gizmo and the boulders follow; a lantern gets a `light` component from the inspector and it lights;
saved as a zone, reopened, the group, the parent links and the light are back; the old
`.scene.json` save still opens in a fresh pane; tests green; windows reopen where they were left.
