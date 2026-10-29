# web/client: the game client's runtime pieces

Browser modules the game client shares with the editors, served as `/common/client/` by every Dream server.
Plain ES modules; `three` and its loaders are passed in, never imported, so a page (plain JS on
`/common/vendor/three`, or Dream World under Vite) never ends up with two copies.

## character.js

The character runtime, lifted out of Dream Characters so Play mode and the game spawn exactly what that
tool saved.

| Export | What it does |
| --- | --- |
| `loadCharacter({ THREE, GLTFLoader, place, path, meta?, name? })` | a saved character GLB from the Library, its meta read beside it (`.meta.json`) when not given. Returns `{ root, model, mixer, clips, name, meta, height, state, setState(state, speed), update(dt), tint(hex), dispose() }`. Feet on the root's origin, facing +z (the sim's yaw 0). |
| `setState('idle' \| 'walk' \| 'run', speed)` | crossfades (0.2 s) to the clip and sets its play rate from the ground speed. Idle and walk are the meta's `idle` and `walk` clip names when the file has them, else picked by name; run is a clip named run or jog, else the walk clip faster. |
| `tint(hex)` | multiplies every material by one colour (an npc's variant); `null` puts the saved colours back. The recipe's own tints are baked into the GLB when Dream Characters saves it, so a saved character needs none. |
| `idleClip`, `walkClip`, `runClip` | the clip pickers, by the names packs use |
| `rebind(mesh, boneByName)` | points a skinned mesh from another file at this skeleton's same-named bones |
| `skinnedSpan(root)` | the lowest and highest drawn points of the skinned body at rest |
| `readMeta(place, path)`, `listCharacters()` | a piece's meta; the characters made in Dream Characters (for a picker) |

Dream Characters imports the clip pickers, `rebind` and `skinnedSpan` from here (`main.js`); its dressing,
tinting and saving stay in the tool. Dream World's Play mode (`src/play/play.ts`) spawns the player with
`loadCharacter`.
