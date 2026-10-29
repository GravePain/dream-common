# Review of the UI plan (29 Oct 2026)

Subject: `docs/ui-plan.md` (fast icons and one editor UI), written by another agent, uncommitted when this
review started; it is committed with this file. Read-only on the plan. Each point says what was checked
(file read) and what is opinion. Nothing was timed or run.

## Verdict

The icon diagnosis is right and every line reference in it is correct. The fix is the right shape:
use the thumbnail the library already has, cache rendered ones on disk for every place, render only what
is missing. Step A can start now.

The editor UI part (2 to 6) is a sound design but it is a rebuild of Dream World's and Forge's whole UI,
and it is written as if it comes next. Graves's order is: improvements to the existing tools and bug
fixes, then the Paint UI templates, then Dream Sound. The shared editor kit and the two editor rebuilds
fit in the first slot only if they are cut down to what the existing tools need now; the full version
is a later slot of its own. The order section at the end says how.

## What was checked and holds

- `dream-world/src/assets.ts:643` `Thumbnails` and `world builder/src/assets.ts` from the same line: a
  `diff` of the two classes to end of file is empty, so "copied unchanged" is exact.
- One promise chain (`queue`, line 648), in-memory `cache` (647), `toDataURL` (700), the 5 s texture wait
  (744), the IntersectionObserver in `ui.ts:184`.
- `manifest.ts:50` builds model `ItemDef`s with no `thumb`; ground textures use `.thumb.png` at line 60.
- `/api/list` reports `thumb` and `mtime` per item (`dream-library/server.mjs:90`), so the plan's cache
  key (place, path, size, mtime) is available without a new scan.
- `POST /api/meta` exists and refuses read-only places (`server.mjs:258-261`); five of the seven places
  in `library.json` are read-only CC0 packs, so a separate cache is needed, as the plan says.
- `save.ts:12` has `version: 1 | 2`. The plan assumed a version field to migrate on; it exists.
- `main.ts` is 1,338 lines and Forge `main.js` 1,217 (the plan's 1,335 and 1,213 are from the series
  review; both have grown a little since).
- Every tool and both games use three 0.170.0: the four plain-JS tools and the Library page through an
  unpkg importmap, Dream World, World Builder and Skyfall Blade from npm. One version makes a shared
  gizmo wrapper safe; passing `three` in (as the plan says) is still right, because Dream World bundles
  its copy.

## Findings

1. **Forge already uses TransformControls.** Checked: `Dream Forge/edit.js:5,29` wraps three's
   `TransformControls`, and Dream World creates one at `main.ts:652`. The plan says Edit's own handles are
   "replaced by `gizmo.js`"; what is replaced is two wrappers of the same control, not hand-made handles.
   That makes step B's gizmo cheaper than the plan reads: lift the keys, snapping and undo hooks out of
   the two existing wrappers into one.

2. **Two different things are both called "UI".** The plan's `web/ui/` is editor chrome (windows, menus,
   tree, inspector). The game builder plan's "Paint UI templates" are game HUD sprites (inventory grid,
   hotbar, bars) that players see. Name them apart in both plans: **editor kit** (`web/ui/`) and
   **game UI templates** (Paint, `.ui.json`). Otherwise "Paint UI" in the build order is read as theming
   Paint with the editor kit, which is step E, a different and much smaller job.

3. **Step A's cache route needs the Library's write rule.** Checked: since commit 2c0920f the `/dl/`
   proxy passes the client address on so the Library can refuse writes from the LAN (review B11).
   `PUT /api/thumb` is a write from a browser on any LAN machine, so it either is allowed as a special
   case (it only ever stores a PNG under a hashed key, size-capped) or Dream World's first load on a
   LAN machine never fills the cache. Say which. Opinion: allow it, capped at 64 KB per icon and a total
   folder size, since a wrong icon is harmless and the "Build icons" button on the Library page covers
   the rest.

4. **Step A should also drop the full-model render for Forge pieces entirely.** The plan's fix 1 does this
   (use `thumb` from the list). Make the done test include it explicitly: a cold load of the Creations
   tray makes no GLB requests (the network panel shows only `.thumb.png`).

5. **World Builder gets the cache only.** The plan asks Graves whether to keep World Builder's `assets.ts`
   identical to Dream World's. Checked: they are already different files (747 vs 723 lines) and the
   series map (`CLAUDE.md`) says the two games share nothing with the Dream tools but the portal. Opinion:
   answer "cache only, own small change", and stop treating the two files as one.

6. **The editor rebuild removes the tray that Play mode and Terrain still need a home for.** The plan
   replaces the bottom tray with Terrain and Library windows. The game builder plan adds a Play button
   to Dream World (Phase 1). Put Play in the menubar or toolbar in the plan now so the two plans do not
   fight over the same bar later.

7. **Parents in saved scenes is a format change that belongs with the zone schema.** The plan adds
   `parent` and `name` to `save.ts` objects. The game builder plan's Phase 0 defines the zone and cell
   formats that replace `.scene.json`. Do one of the two, not both: either the hierarchy work waits for
   the zone schema, or the zone schema is written first (it is step 1 of that plan anyway) and the
   hierarchy saves into it.

8. **The series review's open items are not in either plan.** Open from `review-2026-10-29.md`: C15
   (one `listLibrary()`, cached scans, `truncated: true`), C16 (place ids are array indexes), C17 (vendor
   three.js; Paint and Effects go blank offline), D19 (tests for the pure parts), D20 (API contract),
   D21 (split the two big files), D22 (Cyber kit leftovers), D23 (READMEs). These are the "improvements
   to existing and bug fixes" slot. C15 and C16 touch what step A touches (list and place ids); C17
   touches every importmap; D21 and D22 are explicitly folded into steps C and D by the plan. They need
   to be placed in the order below so two agents do not meet in `manifest.ts`.

9. **The questions for Graves are still open.** Accent colours, dark or light, and World Builder. Only
   the first two block step B; the third blocks the last part of A. Suggested answers if none come: the
   plan's accent table, dark (every tool is dark today), cache only.

10. **Step E is bigger than "one small session" for the Library page.** Opinion only: the Library page
    is also where the plan puts the "Build icons" button and where Codex may start as a tab (game builder
    plan). Fine to theme it in E, but expect it to be revisited.

## Order (Graves's: fix and improve the existing tools, then Paint game UI templates, then Dream Sound)

| Slot | Work | Writes | Notes |
| --- | --- | --- | --- |
| 1a | **A. Fast icons** + C15 `listLibrary()` and cached scans + C16 stable place ids | `dream-library/server.mjs`, `dream-common/web/library.js`, `dream-world/src/manifest.ts`, `assets.ts` (Thumbnails) | one agent; all three touch listing and ids |
| 1b | C17 vendor three.js into `dream-common/web/vendor/` + D22 leftovers + D23 READMEs | every tool's `index.html`, `dream-world` leftovers | second agent at the same time; no file overlap with 1a |
| 1c | **B. Editor kit, minimum**: `theme.css` with per-app accents, `toast.js`, `window.js`, and `gizmo.js` lifted from the two existing wrappers | `dream-common/web/ui/*`, `demo.html` | tree, inspector, menubar, toolbar wait for slot 3 |
| 1d | **E. Theme the tools** with 1c, and the toast for "Library not reachable" (review A7) | Paint, Effects, Characters, Library page, portal, World, Forge `style.css` only | after 1c |
| 2 | **Paint game UI templates** (`.ui.json`, nine-slice sprites, inventory first) | `dream-paint/*`, `dream-common/web/ui-templates.js` (the loader the game HUD will use) | needs nothing from 1 but the theme |
| 3 | **Dream Sound** (5310) | new repo | game builder plan |
| 4 | **C and D: the editor rebuilds** (hierarchy, inspector, windows everywhere, D21 splits, parents saved into the zone format) | as the plan says | after the zone schema (game builder plan, step 1); D19 tests for `mesh.js` land here |

Done for slot 1 means the plan's step A check (two timings, reported) plus: Paint and Effects open with
the network cable out; every tool shows its accent; a down Library produces a toast in every tool.

## What this review could not determine

- Actual icon load times (nothing was timed) and whether visible cards really render first.
- Whether `window.js` state in `localStorage` survives the tools being opened from the portal on another
  LAN machine (it is per browser; fine, but worth saying in the plan).
