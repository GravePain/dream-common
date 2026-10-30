// Npc behaviour (step 10): the `follow` and `flee` modes the schema always had, and `hostile` npcs.
//
// - follow: the nearest living player within `npc.radius` of the npc; walks after it, stopping 2.5 m off.
// - flee: runs (1.5x its speed) directly away from the nearest player within `npc.radius`; else stands.
// - hostile (a `hostile` component, whatever the npc's mode): idles in its mode until a living player comes
//   within `hostile.radius`, then chases it (`hostile.speed`, else 2x its speed), turns to face it in reach and
//   uses `hostile.ability` (strike) with the very same checks a player's cast meets (abilities.js). It gives
//   up and walks home once the target is 2x radius from home (or dies, or leaves), healing to full there.
//
// Moves go through the sim's own mover (`sim.move`), npcs in uid order; the only chance is `sim.random`
// (through the wander the sim already had), so it replays exactly.
import { TICK, MOVE } from '../tick.js';
import { yawOf, turnToward } from '../math.js';
import { cast, inReach } from './abilities.js';
import { stat, freshStats } from './stats.js';

const HOME = 1;      // m: back home
const KEEP = 2.5;    // m: a follower's distance

const speedOf = (e) => (e.stats ? stat(e, 'speed') : e.components.npc?.speed ?? 1);

/** The nearest living player within r of (x, z), or null. */
function nearestPlayer(sim, x, z, r) {
  let best = null, bd = Infinity;
  for (const p of sim.world.near(x, z, r, (q) => q.kind === 'player')) {
    if (p.dead) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) { best = p; bd = d; }
  }
  return best;
}

function walkTo(sim, e, x, z, speed, stopAt = 0) {
  const rx = x - e.x, rz = z - e.z, d = Math.hypot(rx, rz);
  if (d <= Math.max(stopAt, MOVE.arrive)) { sim.move(e, 0, 0, 0); return true; }
  sim.move(e, rx / d, rz / d, Math.min(speed, (d - stopAt) / TICK));
  return false;
}

function face(sim, e, t) {
  e.yaw = turnToward(e.yaw, yawOf(t.x - e.x, t.z - e.z), MOVE.turn * TICK);
  sim.move(e, 0, 0, 0);
}

function hostile(sim, e) {
  const h = e.components.hostile, ai = e.ai, r = h.radius ?? 8;
  if (e.dead) { sim.move(e, 0, 0, 0); return; }
  if (ai.returning) {
    if (walkTo(sim, e, e.home.x, e.home.z, h.speed ?? speedOf(e) * 2, HOME)) {
      ai.returning = false; e.stats = freshStats(e); e.mods = [];
      sim.emit('home', { tick: sim.tick, uid: e.uid, x: e.x, z: e.z, health: e.stats.health });
    }
    return;
  }
  let t = ai.foe ? sim.world.get(ai.foe) : null;
  if (ai.foe && (!t || t.dead || Math.hypot(t.x - e.home.x, t.z - e.home.z) > 2 * r)) {
    ai.foe = null; t = null; ai.returning = true; ai.target = null;
    sim.emit('aggro', { tick: sim.tick, uid: e.uid, target: null });
    walkTo(sim, e, e.home.x, e.home.z, h.speed ?? speedOf(e) * 2, HOME);
    return;
  }
  if (!t) {
    t = nearestPlayer(sim, e.x, e.z, r);
    if (!t) { sim.wander(e); return; }
    ai.foe = t.uid; ai.target = null; ai.wait = 0;
    sim.emit('aggro', { tick: sim.tick, uid: e.uid, target: t.uid });
  }
  const a = sim.tables.abilities.get(h.ability ?? 'strike');
  if (!a) { walkTo(sim, e, t.x, t.z, h.speed ?? speedOf(e) * 2, KEEP); return; }
  const reach = inReach(e, t, a);
  // it strikes from inside the range proper (the tolerance is for the server's check, not to aim at)
  if (reach.d - MOVE.radius <= a.range) {
    face(sim, e, t);
    if (inReach(e, t, a).ok && (e.cooldowns?.[a.id] ?? 0) <= sim.tick && e.stats.stamina >= a.cost) cast(sim, e, { type: 'cast', ability: a.id, target: t.uid });
    return;
  }
  // close in to well inside the range, so a step back by the target does not leave it just out
  walkTo(sim, e, t.x, t.z, h.speed ?? speedOf(e) * 2, Math.max(0.6, a.range * 0.6));
}

function follow(sim, e) {
  const npc = e.components.npc, t = nearestPlayer(sim, e.x, e.z, npc.radius ?? 14);
  if (!t) { sim.move(e, 0, 0, 0); return; }
  if (walkTo(sim, e, t.x, t.z, speedOf(e), KEEP)) face(sim, e, t);
}

function flee(sim, e) {
  const npc = e.components.npc, t = nearestPlayer(sim, e.x, e.z, npc.radius ?? 14);
  if (!t) { sim.move(e, 0, 0, 0); return; }
  const rx = e.x - t.x, rz = e.z - t.z, d = Math.hypot(rx, rz) || 1;
  sim.move(e, rx / d, rz / d, speedOf(e) * 1.5);
}

/** Does the ai system move this npc (rather than the sim's own wander and patrol)? */
export const aiOwns = (e) => !!e.components.hostile || e.components.npc?.mode === 'follow' || e.components.npc?.mode === 'flee';

export const aiSystem = {
  name: 'ai',
  components: ['npc', 'hostile'],
  onTick(sim) {
    for (const e of sim.npcs()) {
      if (!aiOwns(e)) continue;
      if (e.components.hostile) hostile(sim, e);
      else if (e.components.npc.mode === 'follow') follow(sim, e);
      else flee(sim, e);
    }
  },
};
