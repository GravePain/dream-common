# Brief: Dream Tools, slot 1 (fast icons, fixes, editor kit, theming)

For the "Dream Tools" agent. Start the session in `K:\dream-common` so `CLAUDE.md` loads. The
coordinating session (Dream Forge folder, "game builder plan review") reviews the result; message it
if blocked.

## Read first, in this order

1. `working-with-claude.md` (mandatory induction)
2. `CLAUDE.md`
3. `docs/ui-plan.md`
4. `docs/review-ui-plan-2026-10-29.md` (this brief is its Order table, slot 1)
5. Items C15, C16, C17, D22, D23 and A7 in `docs/review-2026-10-29.md`

Decisions already made: accent colours per the table in `ui-plan.md`, dark theme, World Builder gets
only its own icon cache, and where a tool's design conflicts with the server side
(`docs/game-builder-plan.md`) the server side wins.

## The work: four pieces, write scopes never overlap

1a and 1b may run at the same time (subagents, one per piece, each told its files). 1c after 1a and 1b
are pushed. 1d after 1c.

### 1a. Fast icons + C15 + C16

- `ui-plan.md` section 1, fixes 1 to 4. World Builder gets only its own disk cache in its Vite server.
- Thumb cache: `GET/PUT /api/thumb?place&path` into `dream-library/.thumbcache/`, key hashed from
  place, path, size, mtime. PUT is allowed from the LAN as a special case (the Library otherwise refuses
  LAN writes since commit 2c0920f), capped at 64 KB per icon plus a total folder cap.
- C15: one `listLibrary()` in `dream-common/web/library.js`; Library scans cached per place by
  directory mtime; `truncated: true`; `/api/list?kind=`.
- C16: stable place ids, not array indexes; existing `?scene=<id>|path` links keep working.
- Writes: `dream-library/server.mjs` and its README API section, `dream-common/web/library.js`,
  `dream-world/src/manifest.ts`, `dream-world/src/assets.ts` (the `Thumbnails` class only),
  `world builder/server/*` for its cache.

### 1b. C17 + D22 + D23

- C17: vendor three 0.170.0 (module build plus the addons the tools import) into
  `dream-common/web/vendor/`; point every importmap (`Dream Forge`, `dream-paint`, `dream-effects`,
  `dream-characters`, `dream-library/public/index.html`) at `/common/vendor/`. Paint and Effects must
  open with the network cable out.
- D22: remove Dream World's Cyber kit switch and the tower, neon, city, signs, club leftovers and dead
  `plain()` paths. Not the `Thumbnails` class in `assets.ts` (1a owns it): do D22's part of that file
  after 1a has pushed.
- D23: each README says the Library must run first, what `DREAM_LIBRARY` does, and that servers bind
  all interfaces.
- Writes: every tool's `index.html`, `dream-world/src/*` except `manifest.ts` and the `Thumbnails`
  class, every README.

### 1c. Minimum editor kit, `dream-common/web/ui/`

- `theme.css`: dark tokens; `--accent` and `--accent-2` set from `<html data-app="...">` with the
  accent table in `ui-plan.md`; the colour palette never touches UI tokens.
- `toast.js`.
- `window.js`: floating, resizable, snapping, position remembered per app in localStorage inside
  try/catch, a way to reopen closed windows.
- `gizmo.js`: lifted from the two existing `TransformControls` wrappers (`Dream Forge/edit.js:29` and
  `dream-world/src/main.ts:652`): keys Q W E R, Ctrl snap with steps, pivot/centre, local/global, undo
  hooks. `three` is passed in, never imported.
- `demo.html` showing every piece working.
- Tree, inspector, menubar and toolbar are NOT in this slot.
- Writes: `dream-common/web/ui/*` only.

### 1d. Theme every tool

- `theme.css`, its accent and `toast.js` in Paint, Effects, Characters, the Library page, the portal,
  Dream World and Forge; `window.js` only where a panel already floats. No workflow change.
- A7: the toast "Dream Library (5230) not reachable" in every tool; Dream World awaits
  `connectLibrary` before enabling Save.
- Writes: each tool's `style.css` and `index.html`, plus the few lines in each main that show the toast.

## Rules

- Commit in each repo with a message saying what changed and why, ending with the `Co-Authored-By`
  line the session gives you. Push `origin main`. Mirror:
  `git -C /z/<repo> -c safe.directory='*' pull --ff-only` (Forge is `dream-forge` on Morty).
- Heredocs in Bash mangle backslashes on this machine: patch files with a Python script written by the
  Write tool.
- Morty servers need a restart after server changes. PIDs:
  `ssh morty 'netstat -ano | findstr LISTENING | findstr ":52"'`; kill:
  `ssh morty 'taskkill /F /PID <pid>'`; start one per server, foreground, single-quoted:
  `timeout 6 ssh morty 'cd /d D:\Public\dream-library && node server.mjs'`
  (Dream World: `node node_modules\vite\bin\vite.js`). `wmic process call create` starts die silently.
  Do not touch the portal, World Builder or Skyfall processes on Morty.

## Done means (verified in the browser preview, reported with numbers)

- Dream World's Buildings and Props tray timed on a cold load and a second load, before and after.
- A cold load of the Creations tray makes no GLB requests.
- Paint and Effects open offline.
- Every tool shows the shared dark theme and its accent.
- A stopped Library produces the toast in every tool.
- `demo.html` shows window drag, resize, reload-and-return, and gizmo W/E/R with snap on a test cube.

Report what was checked and what was assumed, in the same breath as each claim; say exactly what
could not be verified.
