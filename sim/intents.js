// Intents: the only input the sim takes. A client (or the server on a client's behalf) sends these; the sim
// checks them, keeps a player's latest movement intent and applies it every tick.
//
//   { type: 'move', dir: { x, z }, run }   walk (or run) along a ground direction until another intent
//   { type: 'moveTo', x, z, run }          walk to a point and stop there
//   { type: 'face', yaw }                  turn on the spot (radians, 0 faces +z)
//   { type: 'interact', uid }              use an entity in range (one-shot; movement carries on)
//   { type: 'stop' }                       stand still

export const KINDS = ['move', 'moveTo', 'face', 'interact', 'stop'];
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
    default: return { type: 'stop' };
  }
}

/** Is this a one-shot intent (applied once) rather than a standing movement order? */
export const oneShot = (i) => i.type === 'interact' || i.type === 'face';
