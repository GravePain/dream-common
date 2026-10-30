// Stats (step 10): health and stamina pools, speed, timed modifiers, death and respawn.
//
// - Players always have stats (MOVE's defaults: 100 health, 100 stamina, walk speed); an npc has them when it
//   carries a `stats` component (fields over the same defaults, speed defaulting to its npc speed) or `hostile`.
// - Stamina drains while the sim says the body runs (a full bar runs 6 s), refills otherwise (3 s); at 0 the
//   entity is tired and cannot run until it is back over 30 %. Health regenerates 1 a second once 5 s have
//   passed without dealing or taking damage.
// - Modifiers `{ stat, op: add|mul|set, value, duration? }` (schema MODIFIER) on `e.mods`: a stat's value is its
//   base, plus the adds, times the muls, then the last set. With a duration they lapse; on `health` or
//   `stamina` without one they are an instant change of the pool (a potion).
// - `damage(sim, from, to, amount, ability)` fires `damage` (vetoable, `amount` amendable); at 0 health
//   `death { uid, by }`: the order drops, `anim: 'death'` for 3 s, then a player `respawn`s at the zone spawn
//   with full stats and an npc is removed (`despawn`) and comes back after its `spawn.respawn` seconds
//   (`spawned`), its own spawn component or a spawn entity whose group is its uid; none: it stays gone.
// - `stats { uid, health, maxHealth, stamina, maxStamina }` is emitted for a player when a rounded value changes.
import { MOVE, TICK } from '../tick.js';
import { spawnPoint } from '../bridge.js';
import { walkable } from '../colliders.js';

const POOLS = ['health', 'stamina'];

/** A stat's value now: base + adds, x muls, then the last set. */
export function stat(e, name) {
  let v = e.stats?.[name] ?? 0, mul = 1, set = null;
  for (const m of e.mods ?? []) {
    if (m.stat !== name) continue;
    if (m.op === 'add') v += m.value; else if (m.op === 'mul') mul *= m.value; else set = m.value;
  }
  return set ?? v * mul;
}

/** Fresh stats for an entity: MOVE's defaults under its `stats` component. */
export function freshStats(e) {
  const c = e.components?.stats ?? {}, speed = e.kind === 'player' ? MOVE.walk : e.components?.npc?.speed ?? 1;
  const maxHealth = c.maxHealth ?? MOVE.health, maxStamina = c.maxStamina ?? MOVE.stamina;
  return { health: Math.min(c.health ?? maxHealth, maxHealth), maxHealth, stamina: Math.min(c.stamina ?? maxStamina, maxStamina), maxStamina, speed: c.speed ?? speed };
}

/** Give an entity stats (players on join, npcs with stats or hostile). */
export function addStats(sim, e) {
  sim.statted.set(e.uid, e);
  e.stats = freshStats(e);
  e.mods = [];
  e.dead = null;
  e.tired = false;
  e.calmAt = 0;
  e.shown = null;
}

/** Apply a modifier to an entity now (from an item or an ability's effects). */
export function applyModifier(sim, e, m) {
  if (!e.stats) return;
  if (POOLS.includes(m.stat) && m.duration === undefined) {
    const max = m.stat === 'health' ? stat(e, 'maxHealth') : stat(e, 'maxStamina');
    const now = e.stats[m.stat], v = m.op === 'add' ? now + m.value : m.op === 'mul' ? now * m.value : m.value;
    e.stats[m.stat] = Math.max(0, Math.min(max, v));
    return;
  }
  e.mods.push({ stat: m.stat, op: m.op, value: m.value, until: m.duration === undefined ? Infinity : sim.tick + Math.round(m.duration / TICK) });
}

/** Damage `to` by `amount` from `from` (an entity or null); fires `damage` and, at 0, `death`. */
export function damage(sim, from, to, amount, ability = null) {
  if (!to?.stats || to.dead) return null;
  const ev = { tick: sim.tick, uid: from?.uid ?? null, target: to.uid, ability, amount: Math.max(0, amount), x: to.x, z: to.z };
  if (!sim.gate('damage', ev)) return null;
  ev.amount = Math.max(0, ev.amount);
  to.stats.health = Math.max(0, to.stats.health - ev.amount);
  ev.health = Math.round(to.stats.health * 10) / 10;
  ev.maxHealth = stat(to, 'maxHealth');
  const calm = sim.tick + Math.round(MOVE.calm / TICK);
  to.calmAt = calm;
  if (from?.stats) from.calmAt = calm;
  sim.done('damage', ev);
  if (to.stats.health <= 0) kill(sim, to, from);
  return ev;
}

/** Death: the order drops, the death animation plays for MOVE.dying s, then respawn or removal. */
export function kill(sim, e, by = null) {
  if (e.dead) return;
  e.dead = { until: sim.tick + Math.round(MOVE.dying / TICK) };
  e.stats.health = 0;
  e.order = { type: 'stop' };
  if (e.ai) e.ai.target = null;
  sim.fire('death', { tick: sim.tick, uid: e.uid, by: by?.uid ?? null, x: e.x, z: e.z });
}

/** Seconds an npc takes to come back: its own spawn.respawn, or a spawn entity's whose group is its uid. */
function respawnOf(sim, e) {
  const own = e.components.spawn?.respawn;
  if (own > 0) return own;
  for (const s of sim.spawners ?? []) if (s.components.spawn.group === e.uid) return s.components.spawn.respawn ?? 0;
  return 0;
}

function revive(sim, e) {
  e.dead = null;
  e.stats = freshStats(e);
  e.mods = [];
  e.tired = false;
}

function respawnPlayer(sim, e) {
  const at = spawnPoint(sim.spawn ?? { x: 0, z: 0 }, sim.random, (x, z) => walkable(sim.world, x, z));
  sim.world.place(e, at.x, at.z);
  e.y = sim.world.ground.heightAt(at.x, at.z);
  e.vx = e.vz = e.vy = 0;
  e.grounded = true;
  e.order = { type: 'stop' };
  revive(sim, e);
  sim.fire('respawn', { tick: sim.tick, uid: e.uid, x: e.x, z: e.z });
}

export const statsSystem = {
  name: 'stats',
  components: ['stats'],
  init(sim) {
    sim.respawns = [];
    sim.statted = new Map();
    // the entities with stats, in uid order (players come and go; an npc's removal takes it out)
    sim.byUid = () => [...sim.statted.values()].filter((e) => sim.world.get(e.uid) === e || (sim.statted.delete(e.uid), false)).sort((a, b) => (a.uid < b.uid ? -1 : 1));
    sim.spawners = [...sim.world.entities.values()].filter((s) => s.components.spawn?.respawn > 0 && s.components.spawn.group).sort((a, b) => (a.uid < b.uid ? -1 : 1));
    for (const e of [...sim.world.entities.values()].sort((a, b) => (a.uid < b.uid ? -1 : 1))) if (e.components.stats || (e.kind === 'npc' && e.components.hostile)) addStats(sim, e);
  },
  onTick(sim) {
    const dt = TICK;
    // npcs coming back
    if (sim.respawns.length) {
      const due = sim.respawns.filter((r) => r.at <= sim.tick);
      sim.respawns = sim.respawns.filter((r) => r.at > sim.tick);
      for (const r of due) {
        if (sim.world.get(r.rec.uid)) continue;
        const e = sim.addNpc(r.rec);
        sim.fire('spawned', { tick: sim.tick, uid: e.uid, x: e.x, z: e.z });
      }
    }
    for (const e of sim.byUid()) {
      if (!e.stats) continue;
      if (e.dead) {
        e.anim = 'death';
        if (sim.tick < e.dead.until) continue;
        if (e.kind === 'player') { respawnPlayer(sim, e); continue; }
        const rec = sim.records.get(e.uid), secs = respawnOf(sim, e);
        sim.world.removeEntity(e.uid);
        sim.fire('despawn', { tick: sim.tick, uid: e.uid, x: e.x, z: e.z, respawn: rec && secs > 0 ? secs : null });
        if (rec && secs > 0) sim.respawns.push({ at: sim.tick + Math.round(secs / TICK), rec });
        continue;
      }
      if (e.mods.length) e.mods = e.mods.filter((m) => m.until > sim.tick);
      const s = e.stats, maxS = stat(e, 'maxStamina'), maxH = stat(e, 'maxHealth');
      s.stamina = Math.max(0, Math.min(maxS, s.stamina + (e.anim === 'run' ? -MOVE.drain : MOVE.refill) * dt));
      if (s.stamina <= 0) e.tired = true;
      else if (e.tired && s.stamina > maxS * 0.3) e.tired = false;
      if (sim.tick >= e.calmAt && s.health < maxH) s.health = Math.min(maxH, s.health + MOVE.regen * dt);
      s.health = Math.min(s.health, maxH);
      if (e.kind === 'player') {
        const view = { uid: e.uid, health: Math.round(s.health), maxHealth: Math.round(maxH), stamina: Math.round(s.stamina), maxStamina: Math.round(maxS), dead: false };
        const was = e.shown;
        if (!was || was.health !== view.health || was.stamina !== view.stamina || was.maxHealth !== view.maxHealth || was.maxStamina !== view.maxStamina) { e.shown = view; sim.emit('stats', { tick: sim.tick, ...view }); }
      }
    }
  },
  /** A player joining, or an npc coming back. */
  onJoin(sim, e) { if (e.kind === 'player' || e.components.stats || e.components.hostile) addStats(sim, e); },
};
