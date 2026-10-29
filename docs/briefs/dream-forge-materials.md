# Brief: Dream Forge materials (metallic, opaque, cutout, transparent)

Graves's request on 2026-10-29, placed before slot 4 of `docs/review-ui-plan-2026-10-29.md` (the editor
rebuilds wait on the zone schema). Read first: `working-with-claude.md`, `CLAUDE.md`, then
`K:\Dream Forge\mesh.js` (the `dream-mesh` source format at the top; `meshMat`, `materialFor` around
line 133-160: one faceted vertex-colour material per piece, roughness fixed, textures by companion
`.orm.png`), `edit.js` (the edit tab: parts, faces, points, the UV tools from line 402), `main.js`
(`exportGlb` around line 640-660 with `GLTFExporter`, the paint make-over around line 790-810, the
texture loader around line 1000-1020), `textures.js` and `texlib.js` (the tile generators), and
`K:\Dream Forge\blender\kit.py` `material()` (line 43: `roughness`, `metallic`, `tint` already).

## What it is

Today a Forge piece has one material: vertex colour, roughness 0.85, never metallic, never see-through.
A textured piece is metallic only if its texture has an `.orm.png` beside it, which nothing in the
Forge makes. This pass gives every part (and, where picked, every face) a material of its own that the
Forge shows live, saves in the piece's source, writes into the GLB as standard PBR, and that Blender
pieces from `kit.py` match.

## Deliverables

1. **Material in the mesh format.** `dream-mesh` version 2: `materials: [{ name, metalness 0..1,
   roughness 0..1, opacity 0..1, mode: "opaque" | "cutout" | "blend", cutoff 0..1 (cutout only) }]` on
   the source and `m: index` on each face (absent = material 0, the default: metalness 0, roughness
   0.85, opaque). Colour stays per face (`c`) and per corner through paint as now. Version 1 sources
   open unchanged (no `materials` = one default material). The `.mesh.json` beside the GLB carries it.
2. **Rendering.** One three.js material per distinct material in a piece (geometry groups), vertex
   colours on all of them. `blend` renders with `transparent: true`, `depthWrite: false`, sorted;
   `cutout` with `alphaTest: cutoff`; metallic parts read the forge's environment so metal reads as
   metal (a small generated room environment via `PMREMGenerator` if the scene has none; the ground
   and grid are not part of it).
3. **Material panel** in the edit tab, beside the UV tools: acting on the picked parts or faces (the
   same `uvFaces()` rule), four controls (metalness, roughness, opacity, mode with its cutoff), a
   name, and presets Metal, Glass, Leaf card (cutout 0.5), Matte. Faces that share values share one
   material entry; unused entries are dropped on save. The piece's history notes the op.
4. **Textures carry alpha and ORM.** The texture generators get an optional alpha channel in the
   colour tile (holes: leaf cards, chain link, grilles) and an `.orm.png` output (occlusion R,
   roughness G, metalness B, as the loader already reads it), saved as companions beside the texture
   through the Library's save API. A face wearing such a texture gets `cutout` from its alpha unless
   its material says otherwise, and metalness from the ORM times the material's metalness.
5. **GLB export.** `GLTFExporter` writes `pbrMetallicRoughness` (`metallicFactor`, `roughnessFactor`,
   `baseColorFactor` alpha = opacity), `alphaMode` OPAQUE | MASK (with `alphaCutoff`) | BLEND, and the
   ORM texture where a face's texture has one. Check by reimporting the GLB into the Forge (it opens
   with the same materials) and into Blender 4.5 (`blender --background` script: print each material's
   metallic, roughness, blend_method / alpha).
6. **Blender kit.** `kit.material(role, roughness, metallic, ...)` gains `opacity` and `mode`
   (opaque, cutout, blend); `entry.py` exports them through the same glTF fields, so a scripted piece
   and a Forge piece round-trip identically. One script in `blender/scripts/` uses them (a lantern:
   metal frame, glass panes, cutout grille) and goes to the Library.
7. **Docs.** `K:\Dream Forge\README.md` (the material panel, the format change), the `dream-mesh`
   comment in `mesh.js`, `docs/blender-workflow-plan.md` (the material fields).

## Rules

- Plain JS, no build, no packages; three.js from `/common/vendor/three`. Nothing names another port.
- The server side wins design conflicts (`docs/game-builder-plan.md`): the GLB is what the game loads,
  so everything must be in the GLB's standard fields; `.mesh.json` is the Forge's editable source only.
- Keep `mesh.js` readable: the material code goes in a new `materials.js` rather than growing `mesh.js`.
- Commit per repo with what changed and why and the `Co-Authored-By` line the session gives you; push
  `origin main`; mirror with `git -C /z/<repo> -c safe.directory='*' pull --ff-only`. Patch files with
  a Python script written by the Write tool (Bash heredocs mangle backslashes here). The Forge server
  needs no restart for client files; if `server.mjs` changes, tell the coordinating session.
- Write scopes: `Dream Forge/*` (except `blender/out/`), `Dream Forge/blender/{kit.py,entry.py,scripts/*}`,
  `dream-forge-creations/` through the Library's save API, `dream-common/docs/blender-workflow-plan.md`.
  Not `dream-common/web/*`, not `dream-library`.

## Done means

Verified in the browser and reported with what was checked against what was assumed: a barrel with
its hoops set to Metal and a window pane set to Glass shows metallic hoops and a see-through pane in the
viewport; saved, reopened, the panel shows the same values; the exported GLB reimports with them in the
Forge and Blender prints the same metallic, roughness and alpha mode; a leaf-card texture with alpha
renders cutout; the lantern script's piece is in the Library with its three materials.
