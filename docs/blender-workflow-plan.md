# Dream Blender: a Blender build workflow for the Forge (plan, 2026-10-29)

Goal: a Dream-owned version of the asset-script workflow seen in the SINNON Asset Generator, living in
the Forge repo, writing straight into the Dream Library, with the art style a switch rather than a
decision, so the same scripts can be built low-poly, stylised and PBR and the results decide the look.

Source: the SINNON harness (`C:\Users\david\AppData\Local\Programs\SINNON\Asset Generator\harness`).
It is Graves's own (Claude wrote it for SINNON, 2026-10-29), so its code can be copied and trimmed, not
only its ideas. What was learned from its four builds here:
the cost is in the agent chasing quality warnings (the cottage: 58 turns, 837 s, $2.50, 26 gap
warnings), not in Blender (a final build is 25 s); its floating-parts gate cannot express "a set of
five pieces"; every LOD file embeds the full atlas (13 MB each); and the per-project memory is the one
thing that makes a second asset cheaper, and it is per project.

Checked on this PC (2026-10-29): Blender 4.5.3 LTS at `C:\Program Files\Blender Foundation\Blender 4.5`,
headless `--background --factory-startup --python`, builds a flat-shaded prop, exports GLB and renders a
256 px Eevee Next thumbnail in 2.6 s. Nothing else is needed: no pip packages inside Blender.

## What it is

`Dream Forge/blender/`, a few Python files and a style file, run from the command line by an agent (a
Claude Code session is the agent; there is no paid agent loop inside an app):

| File | Job |
| --- | --- |
| `build.py` | The outer runner: `python build.py <script.py> --style low_poly|stylized|pbr|all --seed N --out DIR [--save "<folder>"]`. Starts Blender with `entry.py`, reads `result.json`, makes `preview.png` and `sheet.png` (the three styles side by side when `all`), prints warnings, and with `--save` posts each piece to the Library (`/api/save` with `.thumb.png`, `.meta.json` carrying script, params, style, seed, warnings). |
| `entry.py` | Runs inside Blender: empty scene, executes the asset script with `kit`, `PARAMS`, `STYLE` and a seeded `rng` in scope, applies the style pass, runs the checks, exports one GLB per piece, renders the thumbnail from a fixed rig (same framing and three suns for every asset, like the Forge viewer's light), writes `result.json`. |
| `kit.py` | Lifted from the harness's `bkit.py` (1,774 lines) and `organic.py`, trimmed to what the scripts below use. The helpers an asset script builds with: `box`, `cylinder(sides)`, `lathe(profile)`, `extrude(outline, h)`, `tube(path)`, `rock(seed)`, `tuft(kind, blades, h)`, `join`, `mirror`, `bevel`, `sit_on_ground`, `piece(name, root)` (declares one library piece), `material(role)`. Materials are **palette roles** (`PAL.bark`, `PAL.leaf`, `PAL.metal`...) as in the Forge's `lib.js`, so any Dream palette suits any script. |
| `styles.json` | `low_poly`, `stylized`, `pbr`: what the style pass does and what the checks measure (below). |
| `checks.py` | Lifted from `quality.py`, `readiness.py` and `artstyle.py`, with the per-piece change. The measured checks: triangles against the style cap, connected pieces **per declared piece** (a set is five pieces, each checked alone), footprint on the 1 m grid and origin on the floor, saturation range, flat-shade share, non-manifold edges, UV presence when textured. Warnings only; nothing fails a build except a script error. |
| `README.md` | The script contract and a worked example. |

A script is style-neutral geometry: it says what the thing is (a barrel: lathe this profile, three hoop
tubes, sit on ground, `piece("barrel")`) and which roles its surfaces are. The style pass decides how it
looks:

| Style | Pass | Checks |
| --- | --- | --- |
| `low_poly` | flat shading, 6 to 8 sided cylinders, no bevel, vertex colours from the palette, no textures; decimate organic parts to the cap | triangles under 3 000 per piece, flat share over 0.7, saturation 0.25 to 0.85 |
| `stylized` | smooth shading, chunky bevel 3 to 6 % of the smallest size with 2 segments, exaggeration factor applied to the script's declared key dimensions, palette colours plus a baked gradient and edge highlight | triangles under 8 000, bevel present on hard parts |
| `pbr` | smooth shading, 2 to 8 mm bevels with weighted normals, `texkit` recipes per role and the `surfacebake` atlas (both lifted from the harness) at 1024, normal and roughness maps | triangles under 20 000, UVs on every part, texel density in range |

All three come from the same script, so a sheet shows the barrel three ways. Over a dozen scripts that
sheet, and the Forge viewer, decide the look; the plan does not.

## What it reuses from the Dream tools

- The Library is the store: one GLB per piece, `.thumb.png`, `.meta.json` with the recipe (script name,
  params, style, seed, kit version), tags (`blender`, the style, the set name). The Forge already lists
  pieces by `.mesh.json`; Blender pieces have none, so the Forge's "Open" shows them read-only in the
  viewer and the "Rebuild" button re-runs `build.py` with the saved recipe (later).
- Palettes by role from `dream-common/web/palettes.js`: `build.py` reads the same JSON so Blender and the
  browser agree on colours.
- Seeded randomness: `rng` is seeded from `--seed`; the same script and seed rebuild the same piece.
- The Dream World placement grid (1 m cells, origin at the floor centre) is the grid check.

## What it does differently from SINNON, on purpose

1. **Sets are first class.** `piece()` declares each library piece; checks and export are per piece.
2. **Warnings, not a loop.** The agent sees the warnings and the preview once and decides; the README
   says which warnings to fix (non-manifold, sunk below floor) and which to leave (a 20 cm gap between a
   doorstep and a mushroom is a design choice). Nothing nags.
3. **Memory is shared, not per project**: `Dream Forge/blender/NOTES.md`, one line per lesson, read by
   every session. The SINNON memory only helped the project that wrote it.
4. **Outputs are what the Library needs**: a GLB, a thumbnail, a meta file. No .blend, no turntable, no
   eight views, no LODs (Dream World does its own LOD batching), no detail bakes.
5. **Textures only in `pbr`**, baked to one atlas per piece at 1024, never per LOD.
6. **The agent is a Claude Code session** reading `preview.png` and the warning list: no per-asset
   37 KB system prompt; the README is the contract and it stays under 300 lines.

## Build order

0. Copy the harness files the plan names into `Dream Forge/blender/` and cut them down (no sprite,
   softbody, equip, rig, restyle or shader-view paths; `colliders.py` kept for the game builder's
   collider proxies later). Each kept file says at the top where it came from.
1. `entry.py`, `kit.py` (box, cylinder, lathe, extrude, join, sit_on_ground, piece, material), the
   `low_poly` pass, checks for triangles, pieces, grid, non-manifold; `build.py` with preview and
   `--save`. Done: a barrel script saves to the Library and shows in the Forge viewer and Dream World.
2. `stylized` and `pbr` passes, the three-way sheet, `rock` and `tuft`.
3. The bake-off: twelve scripts (prop, building, tree, rock, fence, crate, lantern, well, cart,
   signpost, tent, bridge) built three ways; a sheet per script; a note in `docs/` with the verdict on
   which style the toolset produces consistently well. That note picks the Dream art style.
4. Forge "Rebuild from recipe" and palette switch for Blender pieces.

Not in scope: characters and rigs (Dream Characters covers them with CC0 bases), animation, sprites,
sound, video; everything else the SINNON harness does.
