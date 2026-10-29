# The Dream ecosystem

**Mandatory before commenting on or changing anything in this series: read `working-with-claude.md` next to this file.** It is the induction training for a new agent, taken from the GravesPluginBuilder project (`Docs/research/working-with-claude.md` there): how Graves works with agents, what the operator does, what goes wrong and what the agent does about it. Nothing below replaces it.

This file is the map; each repo's README has the detail.

Everything lives side by side in one folder (`K:\` on the dev PC, `D:\Public` on the house server Morty, mapped as `Z:`). Repos reach each other by relative path (`../dream-common`), so nothing is installed or linked. Every repo is private on GitHub under `GravePain` and mirrored on Morty: see `docs/publishing.md`.

## Two games

| Folder | Port | What it is |
| --- | --- | --- |
| `world builder` | 5180 | The original world builder (TypeScript, three.js, Vite): sculpt and paint terrain, place bought Unity asset-pack pieces, release animals, publish worlds to its gallery. Its art is licensed, so it stays behind a login if ever hosted. |
| `skyfall-blade` | 5190 | Stylish sword fighting in the browser, fought on worlds published from World Builder's gallery (read-only). Also owns the portable Node the portal borrows (`.node/`). |

These two predate the Dream tools and share nothing with them but the portal. Dream World is the Dream-side successor to World Builder, built only from pieces in the Dream Library.

## The portal

`gravepain-portal` (5170) is the landing page and the launcher. `index.html` has two sections, **Game** (the two games) and, after a page break, **Development** (the Dream tools). Each card checks whether its port answers. `start-all.bat` starts everything in its own window, the Library first.

## The Dream tools

All dependency-free (except Dream World, which is Vite). Each is a static folder served by `dream-common/serve.mjs`, and each talks to the Library only through its own origin: `/dl/*` is proxied to the Library (port 5230, or `DREAM_LIBRARY`).

| Folder | Port | Makes | Reads |
| --- | --- | --- | --- |
| `dream-library` | 5230 | The one store: files in folders with companions (`.meta.json`, `.thumb.png`, `.mesh.json`), versions in `.versions/`, places listed in `library.json`. Its HTTP API (`/api/places`, `/api/list`, `/api/file`, `/api/save`, `/api/versions`) is what every tool uses. | the CC0 packs and every tool's output |
| `Dream Forge` (`dream-forge` on Morty and GitHub) | 5210 | Low-poly models from seeded generators (`generators/*.gen.js`), paint on them, textures from photos; GLB export. | palettes, photos |
| `dream-paint` | 5250 | Sprites, icons, UI: snapshot any library piece, paint in layers. | brushes, palettes, any piece |
| `dream-effects` | 5260 | Layered particle and weather effects (`.fx.json`). | `fx.js` presets |
| `dream-characters` | 5270 | Dress and tint CC0 rigged characters, try animations. | CC0 character packs |
| `dream-world` | 5240 | Worlds from library pieces only; scenes saved back as `.scene.json`. Has a public gallery. | everything above |
| `dream-forge-creations` | — | Saved Forge output, a library place. | — |

## Publishing: GitHub and Morty

Every repo is in three places and all three must match after each piece of work:

1. The working copy under `K:\` (commit here; messages say what changed and why, ending with the `Co-Authored-By` line the session gives you).
2. GitHub, `GravePain` org, private: `git push origin main`.
3. Morty, the house server (Windows, 192.168.1.111, SSH alias `morty`, cmd.exe; share `\\morty\Public` is the `Z:` drive, `D:\Public` on the box). Each repo there is a plain clone tracking GitHub: `git -C /z/<repo> -c safe.directory='*' pull --ff-only`. The `safe.directory` is needed because the share is owned by another Windows user. Dream Forge is `dream-forge` there.

An agent cannot create a GitHub repo (the permission classifier refuses it); ask Graves to create it empty, then add the remote and push. Running servers only pick up server changes after a restart (`gravepain-portal\start-all.bat`). Full notes: `docs/publishing.md`.

## Documents that belong here

Reviews, architecture notes and plans for the series go in `docs/` here, not in a tool's repo: `docs/review-2026-10-29.md` (the series review and its action list), `docs/hosting-plan.md` (the VPS plan, parked while everything is LAN-only), `docs/publishing.md`. A tool's own README stays with the tool.

## dream-common (this repo)

What every tool shares, so a fix is made once:

- `serve.mjs`: the static server. A tool's `server.mjs` is three lines on top of it.
- `web/`: the browser kit, served as `/common/` by every Dream server (the Library serves it too, and Dream World proxies it). `library.js` (the docked library panel and `fileUrl`), `brushes.js` (brush tips and samplers), `palettes.js` (palettes by colour role), `fx.js` (effect schema, presets, runtime), `library.css`.
- `docs/`: series-wide notes, plans and reviews. Build order (Oct 2026): fix and improve the existing tools (`review-ui-plan-2026-10-29.md`, slot 1), then the Paint game UI templates, then Dream Sound, then the editor rebuilds (`game-builder-plan.md`).

Rules of thumb when working here:

- A page never names another port. The library is `${location.origin}/dl`, the kit is `${location.origin}/common`.
- Colours come from a palette by role (`PAL`), so any palette suits any generator or effect.
- Randomness is seeded; a piece rebuilds the same from the same seed.
- Servers bind all interfaces: this is a home LAN setup, not hardened for the internet (see `docs/review-2026-10-29.md`, group B).
- Heredocs in Bash mangle backslashes on this machine; patch files with a Python script written by the Write tool.
- When a tool's design conflicts with the server side (`docs/game-builder-plan.md`: formats, sim, protocol), the
  server side wins; the tool adapts.

## Ports at a glance

5170 portal · 5180 World Builder · 5190 Skyfall Blade · 5210 Forge · 5230 Library · 5240 World · 5250 Paint · 5260 Effects · 5270 Characters

Planned (`docs/game-builder-plan.md`, nothing built yet): 5280 Codex · 5290 Story · 5300 Motion · 5310 Sound · 5320 Dream Server
