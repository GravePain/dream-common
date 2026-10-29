# Brief: slot 3, Dream Sound (port 5310)

Slot 3 of the order in `docs/review-ui-plan-2026-10-29.md`. Read first, in this order:
`working-with-claude.md` (mandatory induction), `CLAUDE.md`, the "Finish the base tools first" section of
`docs/game-builder-plan.md` (the Dream Sound paragraph is the spec), `docs/publishing.md`, and
`K:\gravepain-audio-web\PLAN.md` section 2 only (the Unity-to-Web-Audio mapping table; the rest of that
plan is not this tool). Then one existing tool end to end as the pattern: `K:\dream-effects`
(`server.mjs`, `index.html`, `main.js`, its use of `/common/library.js`, `theme.css` and `toast.js`).

## What it is

An extremely light sound tool for the Dream series, not a port of GravepainAudio. It works on Graves's
own CC0 sounds in the Dream Library and makes sounds and clips the game plays back through one small
shared runtime. Dependency-free, plain JS, Web Audio only, the same shape as the other Dream tools.

## Deliverables

1. **The tool** at `K:\dream-sound` (new repo; Graves creates `GravePain/dream-sound` empty on GitHub
   when asked, then add the remote and push; on Morty it is `D:\Public\dream-sound`). `server.mjs` is
   three lines on `../dream-common/serve.mjs` with port 5310. `<html data-app="sound">`: add a
   `sound` accent to `dream-common/web/ui/theme.css` (amber, `#e0a040`, `--accent-2 #efc478`). The
   docked library panel, the toast and the theme as in the other tools. A card on the portal
   (`gravepain-portal/index.html`, Development section, port 5310) and a line in `start-all.bat`.
2. **Slicer.** Open a sound from the Library (kind `audio`), see its waveform, cut it into one-shots by
   hand (click to add a cut, drag to move, auto-cut on silence with a threshold), trim and normalise,
   name each slice, save each as its own Library sound.
3. **Filters.** Low-pass, high-pass, echo, reverb (a generated impulse, not a file), gate, gain,
   pitch (playbackRate), applied to a sound or a slice with live preview, rendered with
   `OfflineAudioContext` into the saved file.
4. **Basic synth.** One voice chain: oscillator (sine, square, saw, triangle, noise), ADSR, one filter
   with envelope, LFO to pitch or filter; presets saved as `.synth.json`; a keyboard row on the page and
   computer keys to play; "render note" writes a sound to the Library.
5. **Note dice.** Chord dice, melody dice and riff chain (key, scale, bars, density, seed): a seeded
   pattern over a synth preset, auditioned, kept or re-rolled, saved as a clip.
6. **Clip editor.** A step grid (rows = sounds from the Library or synth notes, 16 or 32 steps, tempo,
   swing), play, loop, render to a clip (`.clip.json` with the pattern plus a rendered `.ogg` or `.wav`
   companion), save to the Library.
7. **Saved forms** (the Library's companion convention: `<main>.<suffix>`): sounds are `.wav` (or `.ogg`
   when the browser can encode it; `.wav` is fine) with `<name>.wav.sound.json` beside them (source,
   slice bounds, filters applied, normalise); synth presets `.synth.json` (new kind `synth`); clips
   `.clip.json` (new kind `clip`) with `.clip.json.wav` beside. Add the kinds to `KINDS` and the
   suffixes to `COMPANION` and `pieceExt` in `dream-library/server.mjs` (follow what 298de9a and 8460f96
   did for `ui`), and the kinds to `KIND_NAME` and `KIND_ICON` in `dream-common/web/library.js` with a
   click that opens them in Dream Sound (`?sound=`, `?synth=`, `?clip=` as the other tools do).
8. **The runtime** `dream-common/web/audio.js`: `loadSound(place, path)`, `play(sound, {gain, rate,
   pan})`, `loadClip`, `playClip(clip, {loop, tempo})`, `synthNote(preset, note, duration)`, one
   `AudioContext` created on first user gesture. The tool previews through this same module, so what
   the editor plays is what the game plays.
9. **A demo page** `dream-common/web/audio-demo.html`: buttons that play three Library sounds, a synth
   preset over a keyboard row, and a clip looping, through `audio.js`.
10. **README** for the tool (what it makes, what it reads, the Library running first, `DREAM_LIBRARY`,
    binds all interfaces), and the `CLAUDE.md` tools table gets a Dream Sound row and the port.

## Rules

- Plain JS, no build, no packages; Web Audio and Canvas only. Nothing names another port: the Library is
  `${location.origin}/dl`, the kit `${location.origin}/common`.
- Seeded randomness for the dice (same seed, same pattern). Colours and UI from the theme kit.
- Keep each file readable; split the tool into `main.js`, `slicer.js`, `synth.js`, `dice.js`, `clips.js`,
  `wave.js` (decode, render, encode wav) rather than one 2,000-line file.
- Commit per repo with what changed and why and the `Co-Authored-By` line the session gives you; push
  `origin main`; mirror with `git -C /z/<repo> -c safe.directory='*' pull --ff-only`. Patch files with a
  Python script written by the Write tool (Bash heredocs mangle backslashes here). The Library's server
  change needs a restart to take effect: tell the coordinating session (Dream Forge folder, "game
  builder plan review") and it restarts both Libraries.
- Write scopes: `dream-sound/*`, `dream-library/server.mjs` (KINDS, COMPANION, pieceExt only),
  `dream-common/web/{audio.js,audio-demo.html}`, `dream-common/web/library.js` (the kind tables and the
  three open links only), `dream-common/web/ui/theme.css` (one accent line), `gravepain-portal`
  (`index.html` card, `start-all.bat` line), `dream-common/CLAUDE.md` (the table row and port).
- Ask Graves where his CC0 sounds are so they can be added as a read-only Library place
  (`library.json`); until then test with a few short CC0 sounds you make with the synth.

## Done means

Verified in the browser and reported with what was checked against what was assumed: a Library sound
opens in the slicer, is cut into three, each saved and listed as kind `audio` with its `.sound.json`;
a filter chain previews and renders; a synth preset plays from the keys and renders a note to the
Library; the dice make a pattern that re-rolls with the seed; a clip loops in the editor, renders, saves
and plays back from the demo page through `audio.js`; the portal card shows Dream Sound running.
