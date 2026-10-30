// Abilities (step 10): the `cast { ability, target?, x?, z? }` intent against `Tables/abilities.json`.
//
// The checks, in order, each a `castResult { ok: false, reason }` to the caster: the ability exists and the
// caster may use it (a player any in the table, an npc its `hostile.ability`), the caster is alive, its
// cooldown has run, it has the stamina; then the target: the given uid, else the nearest foe in range and arc
// (players and npcs are foes to each other, never players to players). In range means the distance less the
// target's radius is within `range` plus TOLERANCE (the plan's 0.5 to 1 m); in arc means within `arc / 2`
// degrees of where the caster faces. Then the cost is paid, the cooldown starts, the caster plays the
// ability's `anim` for CAST s (`cast` is emitted for everyone's fx), and the hit lands: at once for melee, or
// for an ability with a `speed` (a projectile) after distance / speed seconds, if the target still lives.
// The hit is `damage` (stats.js) and then each of the ability's effects as a modifier on the target.
import { TICK, MOVE } from '../tick.js';
import { yawOf } from '../math.js';
import { damage, applyModifier, stat } from './stats.js';

export const TOLERANCE = 0.75; // m beyond an ability's range a hit still counts (lag, quantisation)
export const CAST = 0.4;       // s the cast animation holds

const angle = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };
/** Are these two foes? A player and an npc with stats, either way round. */
export const foes = (a, b) => !!a && !!b && a !== b && !!b.stats && !b.dead && (a.kind === 'player') !== (b.kind === 'player');

/** Is `t` within reach of `e` for ability `a`: { ok, reason, d }. */
export function inReach(e, t, a) {
  const d = Math.hypot(t.x - e.x, t.z - e.z);
  if (d - MOVE.radius > a.range + TOLERANCE) return { ok: false, reason: 'out of range', d };
  if (d > 0.05 && angle(e.yaw, yawOf(t.x - e.x, t.z - e.z)) > (a.arc / 2) * Math.PI / 180 + 1e-6) return { ok: false, reason: 'out of arc', d };
  return { ok: true, reason: null, d };
}

/** The nearest foe of `e` in reach of `a`, or null. */
function nearestFoe(sim, e, a) {
  let best = null, bd = Infinity;
  for (const t of sim.world.near(e.x, e.z, a.range + TOLERANCE + MOVE.radius, (x) => !!x.stats)) {
    if (!foes(e, t)) continue;
    const r = inReach(e, t, a);
    if (r.ok && r.d < bd) { best = t; bd = r.d; }
  }
  return best;
}

/** Try a cast; emits castResult to the caster either way. Returns the result. */
export function cast(sim, e, i) {
  const a = sim.tables.abilities.get(i.ability);
  const res = (ok, reason, target = null) => { const ev = { tick: sim.tick, uid: e.uid, ability: i.ability, ok, reason, target }; sim.emit('castResult', ev); return ev; };
  if (!a) return res(false, 'unknown ability');
  if (e.kind !== 'player' && e.components.hostile?.ability !== a.id) return res(false, 'not known');
  if (!e.stats || e.dead) return res(false, 'dead');
  e.cooldowns ??= {};
  if ((e.cooldowns[a.id] ?? 0) > sim.tick) return res(false, 'cooldown');
  if (e.stats.stamina < a.cost) return res(false, 'tired');
  let t = null;
  if (i.target) {
    t = sim.world.get(i.target);
    if (!t || !t.stats) return res(false, 'no target', i.target);
    if (t.dead) return res(false, 'target dead', i.target);
    if (!foes(e, t)) return res(false, 'not a foe', i.target);
    const r = inReach(e, t, a);
    if (!r.ok) return res(false, r.reason, i.target);
  } else {
    t = nearestFoe(sim, e, a);
    if (!t) return res(false, 'no target');
  }
  e.stats.stamina -= a.cost;
  e.cooldowns[a.id] = sim.tick + Math.max(1, Math.round(a.cooldown / TICK));
  e.castUntil = sim.tick + Math.round(CAST / TICK);
  const d = Math.hypot(t.x - e.x, t.z - e.z);
  sim.emit('cast', { tick: sim.tick, uid: e.uid, ability: a.id, target: t.uid, anim: a.anim ?? 'cast', fx: a.fx ?? '', x: e.x, z: e.z, tx: t.x, tz: t.z });
  if (a.speed > 0) sim.projectiles.push({ at: sim.tick + Math.max(1, Math.round(d / a.speed / TICK)), from: e.uid, to: t.uid, ability: a.id });
  else hit(sim, e, t, a);
  return res(true, null, t.uid);
}

function hit(sim, e, t, a) {
  const ev = damage(sim, e, t, a.damage, a.id);
  if (!ev || t.dead) return;
  for (const m of a.effects ?? []) applyModifier(sim, t, m);
}

export const abilitiesSystem = {
  name: 'abilities',
  components: ['stats'],
  init(sim) { sim.projectiles = []; },
  onTick(sim) {
    if (sim.projectiles.length) {
      const due = sim.projectiles.filter((p) => p.at <= sim.tick);
      sim.projectiles = sim.projectiles.filter((p) => p.at > sim.tick);
      for (const p of due) {
        const t = sim.world.get(p.to), a = sim.tables.abilities.get(p.ability);
        if (t && a && !t.dead) hit(sim, sim.world.get(p.from) ?? null, t, a);
      }
    }
    for (const e of sim.byUid()) if (!e.dead && e.castUntil > sim.tick) e.anim = 'cast';
  },
  onIntent(sim, e, i) {
    if (i.type !== 'cast') return false;
    cast(sim, e, i);
    return true;
  },
};

export { stat };
