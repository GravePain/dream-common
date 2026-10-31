// One way to fetch a Library file in a game page. Normally that is the Library at `/dl`; while a live content
// pack is being played (`useContent`), a file the pack carries comes from the Dream Server by its hash, so the
// game needs no Library. A file the pack does not carry still asks `/dl`: counting those requests is how a gap in
// a pack shows up. Pages reach this file both as /common/resolve.js and through Vite's path into dream-common,
// which are two module instances, so the map lives on one global.
//
//   import { fileUrl, useContent } from `${location.origin}/common/resolve.js`;
//   fileUrl(0, 'Sprites/x.png');                       // the URL to fetch
//   useContent(new Map([['0|Sprites/x.png', url]]));   // null goes back to the Library

const KEY = Symbol.for('dream.content');
const state = (globalThis[KEY] ??= { map: null });

/** The Library's own URL for a file, whatever is being played. */
export const libraryUrl = (place, path) => `${globalThis.location?.origin ?? ''}/dl/api/file?place=${encodeURIComponent(place)}&path=${encodeURIComponent(path)}`;
/** Where to fetch a file now. */
export const fileUrl = (place, path) => state.map?.get(`${place}|${path}`) ?? libraryUrl(place, path);
/** Serve these files ("place|path" -> URL) from now on; null ends it. */
export function useContent(map) { state.map = map; }
/** True while a live pack is being played. */
export const usingContent = () => !!state.map;
