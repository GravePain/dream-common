# Brief: Dream Characters wears Library garments

An item held back from the order in `docs/review-ui-plan-2026-10-29.md`, independent of the Dream Forge
materials pass running at the same time (that one writes `Dream Forge/*` and `blender/*`; this one does
not). Read first: `working-with-claude.md`, `CLAUDE.md`, `K:\dream-characters\README.md` and `main.js`
(503 lines: `loadCombined` binds Quaternius outfit parts to the body's skeleton with `rebind`,
`loadBase` sorts meshes into slots, `dress` / `coverSkin` hide the skin under worn pieces, `recipe` /
`save` write the character GLB), and `K:\Dream Forge\blender\scripts\wizard_robe.py` with
`clothkit.py` (how a garment is measured off a base and skin-weighted to its bones).

## What it is

Dream Blender now makes garments: `Wizard_Robe_g6.glb` and `Wizard_Robe_quaternius.glb` in the Library
under `blender/wizard-robe/`, each a skinned mesh weighted to its base's bones, with a `wear` record in
the meta: `{ base: "g6" | "quaternius", slot: "Body", covers: ["Body", "Arms", "Legs"] }` and the tag
`wearable`. Dream Characters cannot put them on yet: its slots come only from the base pack's own parts.
This pass makes a Library garment a slot option like any pack part, so a character can wear the robe,
be tinted, animated and saved with it, and reopen wearing it.

## Deliverables

1. **Garments in the panel.** Library models tagged `wearable` whose `wear.base` matches the loaded
   base's rule (`ch.base.rule`: `g6` or `quaternius`) are listed as options under their `wear.slot`
   (a new slot when the pack has none of that name), named from the piece's name. Picking one loads the
   GLB, rebinds its skinned meshes to the base's skeleton (`rebind`, as `loadCombined` does for outfit
   parts), parents them under the armature, and hides the pack parts in every slot named in
   `wear.covers` while it is worn (restore the previous choices when it is taken off). `coverSkin` then
   cuts the skin under it as it does for pack parts.
2. **Tint** works on the garment through the same main/detail channels (`recolour`); garments have
   vertex colours and no texture, so the colour channel is the material colour times COLOR_0: make
   `recolour` handle a mesh without a texture.
3. **Saved form.** `recipe()` records worn garments as `{ slot, place, path }` with their tints;
   `toGlb` writes the garment meshes into the character GLB like any worn part (one skeleton); the
   meta gains `garments: [path...]`. `openCharacter` reloads the base, then the garments from the
   recipe, then applies choices and tints. A saved character from before this change opens as it did.
4. **Animation** plays through the garment: the robe follows the walk and idle clips without tearing
   at the armholes (skin weights come from the base; if the yoke tears, note it for the Blender side
   rather than patching weights in the browser).
5. **README**: a "Garments" paragraph (what tags and `wear` fields the panel looks for, so Blender
   scripts know what to write).

## Rules

- Plain JS, no build, no packages; three.js from `/common/vendor/three`. Nothing names another port:
  the Library is `${location.origin}/dl`.
- The Library's `wear` record is the contract; do not change its shape. If a field is missing for the
  job, say which and why in the report rather than inventing one in `dream-characters` only.
- Do not write to `Dream Forge/*`, `blender/*`, `dream-common/*` or `dream-library/*`; the materials
  pass is in `Dream Forge` and `blender` now. The wizard robe files in the Library are read only.
- Commit with what changed and why and the `Co-Authored-By` line the session gives you; push
  `origin main`; mirror with `git -C /z/dream-characters -c safe.directory='*' pull --ff-only`. Patch
  files with a Python script written by the Write tool (Bash heredocs mangle backslashes here). The
  server needs no restart for client files.
- Write scopes: `dream-characters/*`, `dream-forge-creations/Characters/` through the Library's save
  API (test characters named "Test ...").

## Done means

Verified in the browser on port 5270 (the Library on 5230 first) and reported with what was checked
against what was assumed: the G6 male loads, the Body slot offers "Wizard Robe", picking it shows the
robe over the body with the body, arms and legs parts hidden and the skin under it cut, the robe tints,
the walk clip plays with the robe moving on the arms and torso; the same on the Quaternius male; the
character saves as "Test robed g6", reopens from the Library wearing the robe with its tint, and the
saved GLB opens in Dream World (or, if Dream World is not running, in the Forge viewer) with the robe
on the skeleton.
