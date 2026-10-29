# Brief: two sim collider quirks (push-out velocity, shapes below the feet)

Found while verifying step 5. Read first: `working-with-claude.md`, `CLAUDE.md`, `dream-common/sim/README.md`,
`sim/tick.js` (the mover around lines 140 to 160), `sim/colliders.js` (`shapeOf`, `resolve`, the test at
line 37 against `y0`/`y1`), `test/sim.test.mjs`. The sim is shared by the Dream Server, Play local, and the
step 5 predictor (`net/predict.js`), so a change here reaches all three through the same module.

## The quirks

1. **Push-out becomes velocity.** After a collider pushes the mover out (`tick.js` line 151), the velocity is
   recomputed from the corrected displacement: `e.vx = (nx - e.x) / dt`. A push of a few decimetres in one
   50 ms tick becomes 20 to 70 m/s, so bots running into rocks or the creek wall are flung, the walk/run
   animation state flips, and the next tick carries that velocity on. Wanted: on a collider or edge block,
   keep only the component of the intended velocity along the wall (slide), and never let speed exceed the
   intended speed for this tick; the `blocked` event fires as now.
2. **Shapes whose top is below the feet are skipped.** `resolve` tests the mover's capsule from `y0 = y + 0.05`
   to `y1 = y + height`; a boulder on a downhill bank has its top below the feet of a player standing uphill,
   so for one tick it is skipped and the player steps into it, then the next tick pushes them out: one
   visible nudge. Wanted: the step is tested against the shape at the ground height of the destination too
   (so a shape standing on lower ground still blocks a player stepping down onto it), or shapes gain a small
   vertical margin equal to `MOVE.snap`; pick the simpler rule that passes the tests and say which.

## Deliverables

- The two fixes in `sim/tick.js` and `sim/colliders.js`, each under ten lines if it can be.
- Tests in `test/sim.test.mjs`: a player running into a wall of boxes slides along it with speed never above
  the run speed and the blocked event fires once; an npc wandering into a box is never faster than its walk
  speed on the next tick; a box whose top is 0.3 m below a player's feet on a slope blocks the first step
  into it (no overlap on any tick). The existing sim, predict, room and bridge tests stay green (`node --test`
  for `dream-common/test/*.test.mjs` and `dream-server/test/*.test.mjs`; the bridge test with Dream World's
  runner).
- A line in `sim/README.md` on the slide rule and the vertical margin; one line in `docs/game-builder-plan.md`.

## Rules

- Plain ES modules, no packages. Only `dream-common/sim/*`, `dream-common/test/sim.test.mjs`, `sim/README.md`
  and the plan line. Not `net/`, not `dream-server`, not `dream-world`. The schema is not changed.
- Deterministic: no `Math.random`, only the sim's `random`.
- Commit with what changed and why and the `Co-Authored-By` line the session gives you; push `origin main`;
  mirror with `git -C /z/dream-common -c safe.directory='*' pull --ff-only`; restart the Dream Server locally
  (port 5320, kill its PID then `node server.mjs` in `K:\dream-server`) and on Morty (`taskkill` over ssh,
  then `timeout 8 ssh morty 'cd /d D:\Public\dream-server && node server.mjs'`), and say both came back
  (`/health`). Patch files with a Python script written by the Write tool.

## Done means

Tests green and reported with what was checked against what was assumed, plus one browser check on 5240,
Play local, Crystal Cascades: running into a Creek boulder slides along it with no fling, and stepping down
onto the boulder on the bank below the spawn is stopped without a nudge. Report what you saw.
