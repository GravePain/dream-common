// dream-common/net: the Dream Server's wire protocol, shared by the server and every client. JSON, one
// message object per WebSocket frame, its type in `t`. README.md has the table. Plain JS, no DOM.
//
//   client -> server   hello { token?, resume?, name?, character: { place, path, name }, zone }   first, once
//                        (token: the account's session token, required unless the server runs AUTH=off, where
//                        name is; resume: the reconnection token from welcome, to take over the same player)
//                      intent { intent, seq }                                  the sim's intents, unchanged; seq optional
//                      ping { at }                                             at: the client's clock (ms)
//   server -> client   welcome { uid, tick, zone, name, spawn, players: [{ uid, name, character }], resume, exp, resumed?, states }
//                      transfer { zone, resume }   a portal: say hello again on this socket with { resume, zone }
//                      join { uid, name, character }    leave { uid }
//                      snapshot: binary since step 7 (codec.js), decoded to { tick, at, cell, entities } per cell
//                      (welcome also carries size and slots, join a slot; nothing is acked: each cell's
//                      segment is a delta on its previous tick, in order over the socket)
//                      event { tick, type, ... }        the sim's interact and blocked, for that player
//                      pong { at, tick, serverAt }      error { reason, code }   code: one of CODES
import { checkIntent } from '../sim/index.js';

export const PATH = '/ws';
export const NAME = /^[\p{L}\p{N} _'.-]{1,24}$/u;
/** Biggest message a client may send (a hello is the largest, well under this). */
export const MAX_BYTES = 4096;
export const CLIENT = ['hello', 'intent', 'ping'];
export const SERVER = ['welcome', 'join', 'leave', 'snapshot', 'event', 'pong', 'error', 'transfer'];
/** error.code: auth (no or bad token, a resume too late), limit (rates, sockets per address), malformed, full. */
export const CODES = ['auth', 'limit', 'malformed', 'full'];
/** A token as tokens.js makes it: base64url payload, a dot, base64url signature. */
const TOKEN = /^[A-Za-z0-9_-]{8,1024}\.[A-Za-z0-9_-]{16,128}$/;

const str = (v, max = 512) => typeof v === 'string' && v.length > 0 && v.length <= max;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
/** A Library path inside a place: no climbing out, no absolute paths. */
const safePath = (p) => str(p) && !/(^|[\\/])\.\.([\\/]|$)/.test(p) && !/^[\\/]|^[a-z]:/i.test(p);
const place = (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 0) || str(v, 64);

/** The zone ref a client names: "place|path to zone.json". Returns { place, path } or null. */
export function zoneRef(ref) {
  if (!str(ref)) return null;
  const i = ref.indexOf('|');
  if (i < 1) return null;
  const p = ref.slice(0, i), path = ref.slice(i + 1);
  return safePath(path) && /(^|\/)zone\.json$/i.test(path) ? { place: /^\d+$/.test(p) ? +p : p, path } : null;
}

/**
 * Parse one client frame. Returns { msg } with a clean copy, or { error } (the server closes the socket on
 * one). Only the shapes above get through; for an intent, the sim's own check.
 */
export function parseClient(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_BYTES) return { error: 'message too big or not text' };
  let m;
  try { m = JSON.parse(raw); } catch { return { error: 'not JSON' }; }
  if (!m || typeof m !== 'object' || Array.isArray(m) || !CLIENT.includes(m.t)) return { error: 'unknown message type' };
  switch (m.t) {
    case 'hello': {
      if (m.token !== undefined && !(typeof m.token === 'string' && TOKEN.test(m.token))) return { error: 'hello: token malformed' };
      if (m.resume !== undefined && !(typeof m.resume === 'string' && TOKEN.test(m.resume))) return { error: 'hello: resume malformed' };
      // with a token the account names the player; without one (AUTH=off, or a resume) the name is checked here
      const name = typeof m.name === 'string' ? m.name.trim() : '';
      if (name ? !NAME.test(name) : !(m.token || m.resume)) return { error: 'hello: a name of 1 to 24 letters, digits, spaces or _ \' . -' };
      const c = m.character;
      if (!c || typeof c !== 'object' || !place(c.place) || !safePath(c.path) || !/\.glb$/i.test(c.path)) return { error: 'hello: character must be { place, path to a .glb, name }' };
      const zone = zoneRef(m.zone);
      if (!zone) return { error: 'hello: zone must be "place|path/zone.json"' };
      const extra = { ...(m.token ? { token: m.token } : {}), ...(m.resume ? { resume: m.resume } : {}) };
      return { msg: { t: 'hello', name, ...extra, character: { place: c.place, path: c.path, name: str(c.name, 64) ? c.name : c.path.split('/').pop().replace(/\.glb$/i, '') }, zone: m.zone, zoneAt: zone } };
    }
    case 'intent': {
      const intent = checkIntent(m.intent);
      if (!intent) return { error: 'intent: malformed' };
      if (m.seq === undefined) return { msg: { t: 'intent', intent } };
      // seq: the client's counter for prediction; must be a positive integer (the room drops repeats)
      return Number.isSafeInteger(m.seq) && m.seq > 0 ? { msg: { t: 'intent', intent, seq: m.seq } } : { error: 'intent: seq must be a positive integer' };
    }
    case 'ping': return finite(m.at) ? { msg: { t: 'ping', at: m.at } } : { error: 'ping: at must be a number' };
  }
}

/** One server message as its frame. */
export function encode(t, body = {}) {
  if (!SERVER.includes(t) && !CLIENT.includes(t)) throw new Error(`protocol: unknown type ${t}`);
  return JSON.stringify({ t, ...body });
}
