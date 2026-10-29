# Brief: Dream Forge collider proxies

From "Finish the base tools first" in `docs/game-builder-plan.md`: "Dream Forge: collider proxies (box,
capsule, cylinder) per piece in the template; mesh colliders from `.mesh.json` only later." Read first:
`working-with-claude.md`, `CLAUDE.md`, `docs/zone-format.md` (the `collider` component shape in
`dream-common/web/schema/components.js`: use exactly its fields), `K:\Dream Forge\main.js` (save around
the `library.save` call, the meta it writes), `mesh.js` (the piece's parts and bounds), `edit.js` (the
edit tab's panels, the material panel added recently is the pattern), `materials.js`.

Two other sessions run at the same time: the Dream World editor rebuild (`dream-world/*`,
`dream-common/web/ui/*`) and the sim skeleton (`dream-common/sim/*`). Do not touch those paths or the
schema file; if the `collider` shape is missing something, say so in the report.

## What it is

Every Forge piece gets a collision proxy the game can use without its mesh: one or more boxes,
capsules or cylinders fitted to the piece, editable, saved in the piece's meta and in the GLB as extras,
and shown in the viewport as wireframes.

## Deliverables

1. **Auto-fit**: on save, if the piece has no colliders, fit one: a box to the piece's bounds for most
   pieces, a cylinder for round footprints (barrels, trees: a cylinder test on the bounds' XZ ratio and
   the cross-section fill), a capsule for tall thin pieces. Per part fits for pieces with several parts
   (a hut: walls as boxes, the roof as a box).
2. **Collider panel** in the edit tab beside the material panel: list of colliders, add box / capsule /
   cylinder, fit to selection, size and offset fields, delete; the gizmo moves the picked collider;
   wireframes in the viewport with a toggle (off by default in the Orbit tab, on in Edit).
3. **Saved form**: `meta.colliders: [{ shape, x, y, z, rotY, w, h, d | r, h }]` in the Library meta,
   matching the `collider` component's fields so Dream World can copy them straight into an entity's
   `collider` component (one entity may carry several: say in the report whether the schema allows a
   list; if not, note it rather than changing the schema). The same list goes into the GLB's root node
   `extras.colliders` so a GLB alone carries them. The `.mesh.json` source does not need them.
4. **Reading them back**: opening a piece restores its colliders; a Blender piece (`blender/out`,
   `entry.py` writes GLB extras) gets `extras.colliders` written by `kit.py` when a script declares
   them (`kit.collider(shape, ...)`), and the barrel and lantern scripts declare one each.
5. **Docs**: `Dream Forge/README.md` (the panel, the auto-fit rules, the saved form) and one line in
   `docs/game-builder-plan.md` under Dream Forge.

## Rules

- Plain JS, no build; three.js from `/common/vendor/three`. New code in a new `colliders.js`, not in
  `mesh.js` or `main.js` beyond wiring. Only CC0 assets or Graves's own content.
- Commit per repo with what changed and why and the `Co-Authored-By` line the session gives you; push
  `origin main`; mirror with `git -C /z/dream-forge -c safe.directory='*' pull --ff-only`. Patch files
  with a Python script written by the Write tool.
- Write scopes: `Dream Forge/*` except `blender/out/`, `Dream Forge/blender/{kit.py,entry.py,scripts/*}`,
  `dream-forge-creations/` through the save API (re-save the Test materials barrel and the Lantern with
  colliders), `docs/game-builder-plan.md` (one line).

## Done means

Verified in the browser on the Forge (port 5210, Library on 5230) and reported with what was checked
against what was assumed: a new barrel gets a cylinder collider on save; the scrap shelter gets boxes
per wall; the panel edits one and the wireframe follows; reopened, the colliders are back; the GLB's
extras carry them (read the GLB JSON); the Blender barrel script's piece has its declared collider in
the Library meta.
