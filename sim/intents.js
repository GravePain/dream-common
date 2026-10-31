// Intents: the only input the sim takes. A client (or the server on a client's behalf) sends these; the sim
// checks them, keeps a player's latest movement intent and applies it every tick.
//
//   { type: 'move', dir: { x, z }, run }   walk (or run) along a ground direction until another intent
//   { type: 'moveTo', x, z, run }          walk to a point and stop there
//   { type: 'face', yaw }                  turn on the spot (radians, 0 faces +z)
//   { type: 'interact', uid }              use an entity in range (one-shot; movement carries on)
//   { type: 'stop' }                       stand still
//   { type: 'cast', ability, target?, x?, z? }  use an ability (step 10, systems/abilities.js; one-shot)
//   { type: 'pickup', uid }                pick up a drop in reach (systems/items.js; one-shot)
//   { type: 'use', slot }                  use the item in an inventory slot (one-shot)
//   { type: 'drop', slot }                 put a slot's stack on the ground (one-shot)
//   { type: 'equip', slot }                wear the item in an inventory slot (one-shot)
//   { type: 'unequip', wear }              take off what is worn in an equipment slot, "Head" (one-shot)

export const KINDS = ['move', 'moveTo', 'face', 'interact', 'stop', 'cast', 'pickup', 'use', 'drop', 'equip', 'unequip'];
const ID = /^[A-Za-z0-9_.:-]{1,64}$/;
const slotOk = (v) => Number.isInteger(v) && v >= 0 && v < 64;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** A clean copy of an intent, or null when it is malformed (the server drops those, and may kick later). */
export function check(i) {
  if (!i || typeof i !== 'object' || !KINDS.includes(i.type)) return null;
  switch (i.type) {
    case 'move': {
      if (!i.dir || !finite(i.dir.x) || !finite(i.dir.z)) return null;
      const l = Math.hypot(i.dir.x, i.dir.z);
      return l < 1e-6 ? { type: 'stop' } : { type: 'move', dir: { x: i.dir.x / l, z: i.dir.z / l }, run: !!i.run };
    }
    case 'moveTo': return finite(i.x) && finite(i.z) ? { type: 'moveTo', x: i.x, z: i.z, run: !!i.run } : null;
    case 'face': return finite(i.yaw) ? { type: 'face', yaw: i.yaw } : null;
    case 'interact': return typeof i.uid === 'string' && i.uid ? { type: 'interact', uid: i.uid } : null;
    case 'cast': {
      if (typeof i.ability !== 'string' || !ID.test(i.ability)) return null;
      if (i.target !== undefined && (typeof i.target !== 'string' || !ID.test(i.target))) return null;
      if ((i.x !== undefined || i.z !== undefined) && !(finite(i.x) && finite(i.z))) return null;
      return { type: 'cast', ability: i.ability, ...(i.target !== undefined ? { target: i.target } : {}), ...(i.x !== undefined ? { x: i.x, z: i.z } : {}) };
    }
    case 'pickup': return typeof i.uid === 'string' && ID.test(i.uid) ? { type: 'pickup', uid: i.uid } : null;
    case 'use': case 'drop': case 'equip': return slotOk(i.slot) ? { type: i.type, slot: i.slot } : null;
    case 'unequip': return typeof i.wear === 'string' && ID.test(i.wear) ? { type: 'unequip', wear: i.wear } : null;
    default: return { type: 'stop' };
  }
}

/** Is this a one-shot intent (applied once) rather than a standing movement order? */
export const oneShot = (i) => i.type !== 'move' && i.type !== 'moveTo' && i.type !== 'stop';
