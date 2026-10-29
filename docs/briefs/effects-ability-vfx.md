# Brief: Dream Effects, ability VFX (shape textures, flipbooks, play-once effects)

Slotted by the coordinating session on 2026-10-29 between the Project Y UI and Dream Codex, so
abilities have effects to attach to when Codex arrives. Independent of the zone schema work running at
the same time (that one writes `dream-common/web/schema/`, `zone.js`, `library.js` kind tables,
`dream-world`, `dream-library/server.mjs` kinds; this one does not). Read first:
`working-with-claude.md`, `CLAUDE.md`, `dream-common/web/fx.js` (390 lines: `SCHEMA`, `LAYER_DEFAULTS`,
the presets, `spriteTexture` at line 128 drawing the six sprites on a canvas, the `InstancedMesh`
emitter at 229), `K:\dream-effects\main.js` (the layer panels driven by `SCHEMA`), and how Dream World
places effects (`dream-world/src/effects.ts`).

## The sources

Kenney's Particle Pack, CC0 (licence file in the folder), unpacked at
`K:\cc0-packs\kenney-particle-pack\PNG\`: 80 greyscale shape sprites at 512 px on black (smoke x10,
star x9, trace x7, spark x7, flame x6, muzzle x5, magic x5, circle x5, window x4, slash x4, twirl x3,
scorch x3, light x3, dirt x3, symbol x2, fire x2, scratch, flare). On Morty the same folder is
`D:\Public\cc0-packs\kenney-particle-pack` (copy it there with `robocopy` from this PC, as the other
cc0 packs were). Only CC0 or Graves's own assets go into this project.

## Deliverables

1. **The pack as a Library place.** Add `{ id: "cc0-kenney-particles", name: "CC0 Kenney particles",
   path: "K:\\cc0-packs\\kenney-particle-pack\\PNG", readonly: true }` to `dream-library/library.json`
   here and the `D:\Public` path in Morty's `D:\Public\dream-library\library.json` (over the Z: share);
   the files list as kind `texture` with tag `particle`. Tell the coordinating session: the Library
   restarts to pick up a place.
2. **Library textures as particle sprites.** `SCHEMA.particles` gains `['texture', 'Shape', 'texture']`:
   a Library texture reference (`place|path`) whose luminance becomes the sprite's alpha (black = clear),
   tinted by `colorStart`/`colorEnd` as the drawn sprites are; `sprite` stays as the fallback when no
   texture is set. One cached `THREE.Texture` per path in fx.js (`loadTexture(place, path)` through
   `${location.origin}/dl`), loaded once per effect, never per particle. Effects gets a picker for it
   (the Library panel's textures, filtered by tag `particle`, plus any Creations texture, so Graves's
   own Paint shapes work too).
3. **Flipbooks.** `['frames', 'Sheet columns x rows', ...]` and `['fps', 'Frames per second', ...]`:
   a texture that is a grid plays through its frames over the particle's life (or at `fps` when set),
   per instance via a UV offset attribute. A Paint-made sheet and a Kenney `window` sheet both work.
4. **Play-once effects with phases.** An effect gains `mode: loop | once` and each layer gains
   `start` (seconds after play) and `duration` (0 = until the effect ends), so one `.fx.json` can be
   cast (0 to 0.4 s: a ring and sparks at the hand), travel (0.4 to 1.0 s: a trail) and hit (1.0 s: a
   burst and a scorch decal that fades). `fx.play(effect, {at, follow})` returns a handle with
   `stop()` and `done` (a promise); `follow` is an `Object3D` the effect tracks each frame (a bone, a
   projectile). Looping effects behave exactly as today; every existing `.fx.json` loads unchanged.
5. **Two new layer kinds**, small: `ring` (a flat disc or ring that scales from `sizeStart` to
   `sizeEnd` and fades, with a texture: shockwaves, auras, ground circles) and `trail` (a ribbon of
   quads behind the effect's position as it moves: sword arcs, projectile trails; width, life, texture).
6. **Presets** in fx.js and saved to the Library under `Effects/Abilities/`: Fireball (cast, travel,
   hit), Heal (ring plus rising stars), Slash (trail arc), Hit sparks, Smoke puff, Magic circle. Each
   plays once in Effects with a Play button and a scrub of the timeline; Dream World's Effects tool
   can place the looping ones as before and play a once effect on click.
7. **Docs**: `dream-effects/README.md` (textures, flipbooks, once mode, the layer kinds), the comment
   block at the top of `fx.js`, and a line in `docs/game-builder-plan.md` under Dream Effects.

## Rules

- Plain JS, no build, no packages; three.js from `/common/vendor/three`. Nothing names another port.
- fx.js is the runtime the game will use: keep it one file under about 700 lines, instanced, no per
  particle objects; new kinds follow the particles pattern.
- Commit per repo with what changed and why and the `Co-Authored-By` line the session gives you; push
  `origin main`; mirror with `git -C /z/<repo> -c safe.directory='*' pull --ff-only`. Patch files with
  a Python script written by the Write tool (Bash heredocs mangle backslashes here). Client files need
  no restart; the Library does for the new place: tell the coordinating session.
- Write scopes: `dream-common/web/fx.js`, `dream-effects/*`, `dream-library/library.json` (one place
  entry) and Morty's copy, `dream-world/src/effects.ts` only for playing once effects,
  `dream-forge-creations/Effects/Abilities/` through the save API, `dream-common/docs/game-builder-plan.md`
  (one line). Not `dream-common/web/schema/`, not `zone.js`, not `library.js`, not `server.mjs`.

## Done means

Verified in the browser (Effects on 5260, Library on 5230) and reported with what was checked against
what was assumed: a particle layer picks `magic_03` from the Kenney place and shows it tinted; a
Kenney `window` sheet plays as a flipbook; Fireball plays once end to end with its three phases and
`done` resolves; every effect that was in the Library before still opens and looks the same (compare
the waterfall and the campfire against their thumbnails); the six ability presets are in the Library;
Dream World places the campfire as before and plays Hit sparks once on click.
