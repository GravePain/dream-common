# Dream tools: fast icons and one editor UI (plan, 2026-10-29)

Asked by Graves, six points:

1. Icons for 3D pieces (buildings, props) load very slowly in Dream World and in the upstream World Builder.
2. Dream World is not a game, but its UI still acts like one. It should feel like Unity: a hierarchy, placing from
   the library, and Unity's place / move / rotate / scale workflow.
3. Forge's UI gets messy, especially when placing a second primitive and editing the mesh. It needs more room and
   clearer sections. Move / rotate / scale should work exactly as in Dream World.
4. Every Dream tool has the same theme and styling, never driven by the colour palette in use. Each tool gets its
   own accent shade so you can tell which one you are in.
5. Reusable components live in `dream-common` and are imported from there.
6. Floating, resizable windows are preferred.

Each finding below says whether it was **checked** (the file was read) or **assumed**. Nothing has been measured or run.

## 1. Slow icons

### Cause (checked by reading, not timed)

- `dream-world/src/assets.ts:643` `Thumbnails`, copied unchanged from `world builder/src/assets.ts:619`.
- For each card that scrolls into view (`ui.ts:184`, IntersectionObserver), it does all of this:
  - loads the full model (GLB, or the pack's FBX upstream) with its textures;
  - waits up to 5 s for the textures (`waitForTextures`);
  - renders the model on an offscreen WebGL renderer and returns `toDataURL`.
- Jobs run **one at a time** through a single promise chain (`queue`).
- The result is cached **in memory only**, so every reload renders everything again.
- The library already writes `.thumb.png` beside every Forge save, and `/api/list` reports it (`thumb: true`). But
  `manifest.ts:50` ignores it for models; only ground textures use it (`manifest.ts:60`).
- The CC0 places in `library.json` are `readonly`, so `/api/meta` cannot store an icon beside those files.

### Fix

1. **Use the library's icon when there is one.** Add `thumb` to `ItemDef` in `manifest.ts`. The tray uses it
   directly and never loads the model. This makes every Forge piece instant.
2. **A thumbnail cache in the library, for every place, read-only places included.**
   - `GET /api/thumb?place&path` answers with the cached PNG, or 404.
   - `PUT /api/thumb?place&path` (body: PNG) stores one.
   - Cache folder: `dream-library/.thumbcache/` (dot folders are already hidden from serving).
   - Key: place id, path, size and mtime, hashed, so changing the file makes a new icon.
   - `/api/list` reports `cachedThumb: true` when there is a cached icon.
3. **Dream World renders only what has no icon,** then PUTs the result so the next reload is instant.
   - Lower the texture wait from 5 s to about 1.5 s.
   - Keep rendering one at a time (one WebGL context), but take visible cards first. Already the case: verify.
4. **A "Build icons" button on the Library page** (optional). It runs the renderer over a whole place once, so the
   CC0 packs are done before anyone opens Dream World.
5. **Upstream World Builder.**
   - Assumed: same cause, same code. Its art comes from local packs, not the library.
   - Smallest change: the same disk cache, but in World Builder's own Vite dev server (a `server/thumbs.ts`
     middleware writing `.thumbcache/` there).
   - It is a separate repo with licensed art, so it gets its own small change and does not share the Dream code.
   - If upstream World Builder is meant to stay identical to Dream World apart from `manifest.ts`, the
     renderer-side change (PUT after render, GET first) has to land in both. Graves to say whether that is wanted.

Done means: second load of Dream World's Buildings and Props tray shows all icons at once, and a cold load of a
Forge piece never fetches its GLB.

## 2–6. One editor UI

### Shared kit in `dream-common/web/ui/` (the base for everything else)

Plain ES modules with no build step, so the plain-JS tools import them directly and Dream World (TypeScript, Vite)
imports them through `/common` (types via a `.d.ts`).

| Module | What it does |
| --- | --- |
| `theme.css` | One set of tokens: surfaces, text, lines, radii, spacing, fonts, controls. Dark, neutral, editor-like. `--accent` and `--accent-2` are the only per-app values, set with `<html data-app="forge">`. The colour palette never touches UI tokens. |
| `window.js` | Floating window: title bar drag, resize from edges and corners, minimise to title, close or hide. Snaps to screen edges and to other windows (dock left / right / bottom). Position and size are remembered per app in `localStorage` (try/catch). A Window menu reopens closed windows. |
| `menubar.js` | Top bar: app name in the accent, File / Edit / View / Window menus, the portal link. |
| `tree.js` | Hierarchy: expand and collapse, select (click, Ctrl, Shift), rename (F2), drag to reparent or reorder, visibility toggle, search. The data comes in through callbacks, so World and Forge supply their own nodes. |
| `inspector.js` | Property rows built from a small schema: number with drag-scrub, vector3, colour, slider, toggle, select. Shared by both tools' Transform section. |
| `gizmo.js` | The one transform tool (see below). Wraps three's `TransformControls` with shared keys, snapping and undo hooks. Each app passes in its own `three` so there is never a second copy. |
| `toolbar.js` | Tool buttons with icons and tooltips (Q W E R T), pivot / centre and local / global toggles, snap toggle and step. |
| `toast.js` | One status / toast line ("Dream Library (5230) not reachable", saved, errors). |

Per-app accents (suggested):

| App | Accent |
| --- | --- |
| Forge | orange |
| Library | gold |
| World | green |
| Paint | pink |
| Effects | violet |
| Characters | teal |
| Portal | grey |

### The Unity workflow, shared by World and Forge (`gizmo.js` plus each app's selection)

- **Q** view (pan / orbit), **W** move, **E** rotate, **R** scale, **T** rect / bounds.
- Hold **Ctrl** to snap. Snap steps are set in the toolbar (move 0.25 m, rotate 15°, scale 0.1).
- **Pivot / Centre** and **Local / Global** toggles. **F** frames the selection. **Ctrl+D** duplicates.
  **Delete** deletes. **Ctrl+Z / Ctrl+Y** undo and redo.
- Click to select, Ctrl+click to add, box-drag to select many. The hierarchy and the viewport share one selection.
- Viewport navigation: right-drag orbits, middle-drag pans, wheel zooms, Alt+left orbits. Right-drag plus WASD
  flies (Dream World only; Forge orbits a single piece).
- **Placing from the library:** drag a card from the Library window into the viewport. The piece follows the
  ground or surface under the cursor and drops on release. **Shift** keeps placing copies. **Esc** cancels.

### Dream World as an editor

Windows:

| Window | Contents |
| --- | --- |
| Hierarchy | The scene: objects grouped by category or as the user groups them (parent / child), lights, effects, animals. |
| Inspector | Transform (inspector rows), then the selected object's own settings: piece, tint, effect parameters. |
| Library | The docked `library.js` panel turned into a window: search, places, tags, the new fast icons. Drag to place. |
| Terrain | Sculpt and paint brushes and ground layers. Replaces the game-style tray. |
| Scene | Size, sky, water, save / load / publish. |

Removed: the bottom game toolbar and the pop-up tray, plus the leftover Cyber kit switch and tower / neon tools
(review item D22).

Saved scenes need parents. `save.ts` objects get an optional `parent` and `name`, and old scenes load flat.
Assumed: there is a scene version field to migrate on. Check `save.ts` first.

`main.ts` is 1,335 lines (review D21). Selection, gizmo, hierarchy and UI wiring come out into their own modules as
part of this work, not before it.

### Forge

Windows:

| Window | Contents |
| --- | --- |
| Generator | Generator picker, params, seed, palette, pose. |
| Hierarchy | The piece's parts: primitives, added pieces, joints. Placing a second primitive adds a child here, selected, with the gizmo on it. That is the messy area today. |
| Inspector | Transform plus part settings. |
| Edit | Mesh mode only: points, faces and parts, extrude / subdivide / merge / flip / delete, UVs, sculpt brushes. It opens when you enter mesh mode and closes when you leave. |
| Paint and Textures | Brush, fill, picker, bake / bleach, From a photo. |
| Library | The same window as in Dream World. |
| Reference | The reference photo as a window instead of a fixed overlay. |

Edit's own move / rotate / scale handles (`edit.js`) are replaced by `gizmo.js`. In mesh mode it moves the selected
points or faces, so it acts on a pivot object.

`main.js` is 1,213 lines (review D21). It is split the same way as Dream World's.

### Paint, Effects, Characters, Library, Portal

Adopt `theme.css`, `menubar.js` and `window.js` for their existing panels. No workflow change. One small session.

## Order and split between agents

Write scopes never overlap: no two agents edit the same files at the same time.

| Step | Agent | Repos / files it writes | Needs |
| --- | --- | --- | --- |
| **A. Fast icons** | Agent 1 | `dream-library/server.mjs` (thumb cache routes), `dream-library` README API section, `dream-world/src/manifest.ts`, `dream-world/src/assets.ts` (Thumbnails only); then `world builder` server cache | nothing |
| **B. Shared UI kit** | Agent 2 | `dream-common/web/ui/*` only, plus a `dream-common/web/ui/demo.html` that shows every component working | nothing |
| **C. Dream World editor** | Agent 1, after A | `dream-world/src/*`, `index.html`, `style.css` | B merged |
| **D. Forge editor** | Agent 2, after B | `Dream Forge/*` | B merged |
| **E. Theme the other tools** | either | `dream-paint`, `dream-effects`, `dream-characters`, `dream-library/public`, `gravepain-portal` | B merged |

- A and B run at the same time from the start.
- C and D run at the same time once B is in.
- A touches only the `Thumbnails` and manifest parts of Dream World, so it is finished and pushed before C starts
  on the same repo.
- Gizmo behaviour is defined once in B. C and D must not change `gizmo.js` without the other knowing. If one needs a
  change, it is made in `dream-common` and noted in the commit.
- Each step ends published to all three places (`docs/publishing.md`). Running servers need a restart.

### How each step is checked

| Step | Check |
| --- | --- |
| A | Time the Buildings tray from a cold load and a second load, before and after, in the browser preview. Report both numbers. |
| B | `demo.html`: drag and resize windows; reload and they come back where left; tree reparenting; gizmo W / E / R with snap on a test cube. |
| C | Place three pieces from the Library window, parent one, move / rotate / scale with snap, undo each step, save and reload the scene. An old scene still loads. |
| D | Generate a piece, add a second primitive, move it with the same gizmo, enter mesh mode and extrude a face, paint, save; the piece reopens the same. |
| E | Each tool opens with the shared theme and its own accent; nothing else changes. |

## Questions for Graves

1. Upstream World Builder: icon cache only (its own small server change), or keep its `assets.ts` identical to
   Dream World's so future merges stay easy?
2. Accent colours: the table above, or your own?
3. A dark editor theme, like Unity's, or light?
