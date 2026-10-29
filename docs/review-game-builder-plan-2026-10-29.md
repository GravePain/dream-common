# Review of the game builder plan (29 Oct 2026)

Subject: `docs/game-builder-plan.md` as of commit dbc1f7d. Read-only; the plan is not changed.
Method: each point below says what was checked in the repos and what is only an opinion. Checked means
the file was read in this review; nothing was run.

## Verdict

The plan is coherent and its big decisions are the right ones for this series: one headless simulation
shared by server and client, intents-only clients, declarative content validated on publish, interest
management from the start, Morty as staging and a VPS as live. The research sections are already
trimmed to decisions rather than surveys, which is what a plan needs.

The problems are in the joints between the plan and what exists today. Four of them would cost real
time if found during Phase 0 or 1 instead of now (A1 to A4). The rest are gaps to fill in a sentence or
two each, and one scope warning.

## A. Fix in the plan before Phase 0

1. **Port 5280 is given to two modules.** "Phase 2: Dream Server (new module, port 5280)" and, under
   Modules, "Dream Codex 5280". Checked: both lines are in the plan; the portal's cards stop at 5270
   (`gravepain-portal/index.html`), so 5280 to 5310 are free. Give the server its own port (5320, say)
   and add the new ports to the table in `CLAUDE.md` when they are real.

2. **64 m cells do not divide the maps Dream World makes.** Checked: `dream-world/src/main.ts:25` offers
   100, 200 and 400 m maps, and `save.ts:12` stores one terrain as `size`, `res = size + 1` and one
   base64 `heights` buffer plus one `splat` buffer, with all `objects` in one list. None of the three
   sizes is a multiple of 64. Either pick a cell size that divides them (50 m or 100 m) or make the
   map sizes multiples of the cell. Also decide what a cell file holds: splitting the heightfield and
   the 16-layer splat into cells creates seam and edge-ownership work that the plan does not mention,
   while splitting only the entity list (and keeping terrain per zone) gives the diff, streaming and
   AOI benefits with none of that. Opinion: entities per cell, terrain per zone, until a zone is bigger
   than a browser wants to hold.

3. **`sim/` must not import three.js, and the in-house reference does.** Checked:
   `skyfall-blade/src/game/sim.ts:1` imports `three`. The plan's testing layer 1 ("`sim/` runs headless in
   Node") and the client/server sharing both depend on the sim having no renderer dependency. Say so
   in the plan: `sim/` uses its own small vector maths (or a maths-only package), and the client wraps
   sim state for three.js. Porting Skyfall's sim pattern is still right; just not its imports.

4. **Skyfall Blade is a reference for determinism, not for the netcode model.** Checked:
   `skyfall-blade/src/game/net.ts` says the host's browser runs the one simulation, the guest sends
   inputs and draws snapshots, and on a LAN there is no prediction. Skyfall also ticks at 60 Hz
   (`sim.ts:9`), the plan at 20 Hz. So prediction, reconciliation via `lastInputSeq`, interpolation of
   others and delta snapshots against an acked baseline are all new code with no in-house precedent.
   That is the riskiest part of Phase 2 and the plan should name it as such, and keep "two browsers
   walking around together" (first concrete step 4) as the gate before any gameplay system.

## B. Gaps to close with a line or two

5. **Phase 1 needs the character assembler, which lives in a plain-JS tool.** Checked:
   `dream-characters/main.js:1` dresses a rigged CC0 base from parts, tints and scales it, and `save()`
   at line 413 writes it to the library. "Spawn a Dream Characters character" in Play mode means the
   same assembly code must run inside the game client. The plan puts shared code in TypeScript under
   `client/` and keeps the tools in plain JS; say which way the assembler goes (moved to `client/` and
   imported by Dream Characters, or duplicated). Moving it is the only option that keeps one copy.

6. **Schema validation on publish must check references, not just shape.** The plan validates schemas
   and says content contains no code. The event, condition and action rows and every template id,
   piece path and effect name are references; a zone that passes the shape check can still point at a
   piece that was renamed. Add: publish resolves every reference against the library and fails on a
   miss, and the bake writes the content hashes the plan already wants.

7. **Licence gate on publish.** Checked: `K:\non-cc0-packs` exists beside `cc0-packs`, and the Library
   lists places from `library.json`, with no licence field (`CLAUDE.md`, Dream tools table). Dream
   World builds only from library pieces, but nothing stops a non-CC0 place from being added. The
   public Content service must never carry those files. Add a `licence` field per place and make
   publish refuse assets from places that are not cleared for the public client. (Assumed: the
   non-CC0 packs are not yet library places; the gate is still worth having before the pipeline exists.)

8. **Heightfield resolution is fine for the server; piece colliders need a source.** Checked:
   terrain heights are one float per metre (`res = size + 1`). Pieces have `.mesh.json` companions in
   the library (`CLAUDE.md`), which is a plausible collider source, but the plan's "colliders, LODs" for
   Dream Forge does not say whether a collider is authored, derived from the mesh, or a simple proxy
   (box or capsule). Opinion: start with proxy shapes per piece in the template schema; mesh colliders
   are a later feature.

9. **Phase 0 lists seven schemas; the first concrete steps need three.** The steps need zone, cell and
   entity (with components) and a character. Item, ability and quest schemas belong with Dream Codex
   and Dream Story. Align Phase 0 with the steps so the first play is not waiting on formats nobody
   uses yet.

10. **Persistence of accounts and characters is not in a phase.** Phase 2 names accounts and tokens and
    state scopes, but not where a player's character list, inventory and position are written and
    read, nor what happens to a character when its zone room is disposed. One line: the World store
    writes player scope on a timer and on disconnect, and the Gateway reads it for the character list.

11. **The hafen-server plan is still active and competes for the same time.** Checked:
    `dev-hafen-server/PLAN.md` has an art pilot next and a long backlog. The game builder plan treats
    hafen-server as a reference only, which is right (Python, Seatribe protocol and assets), but a
    sentence saying which project is paused would save a future agent from splitting effort.

## C. Scope

12. **Four new editors and five server pieces is a lot for one person and agents.** Dream Codex, Story,
    Motion, Sound, Server, Publish, GM, Bots and Client. The build order at the end is the right
    answer; the Modules section reads as if all of it is committed. Opinion: mark Motion and Sound as
    "later, if needed" there too, and let Codex start as a tab in the Library page rather than a
    module, until it outgrows it.

## What this review could not determine

- Whether any earlier review of this plan exists. No file under `K:\dream-common`, `dream-world`,
  `skyfall-blade` or `world builder` mentions it, and the plan's three commits are from this morning.
- Whether the non-CC0 packs are already library places (`library.json` was not opened).
- The actual cost of the transaction-log idea; the plan already makes it conditional on measurement.

## Suggested next step

Apply A1 to A4 and B9 to the plan, then start concrete step 1 with the zone and entity schemas and a
cell size that divides the existing maps.
