// The character runtime: a saved Dream Character (a GLB in the Library, kind "character") loaded onto its
// skeleton and played with idle, walk and run, crossfading between them. Lifted out of Dream Characters
// (which imports the clip pickers, rebind and skinnedSpan from here), so a game and Dream World's Play mode
// spawn exactly what that tool saved. Plain ES module; `three` and its GLTFLoader are passed in, never
// imported, so a page never ends up with two copies (as web/ui/gizmo.js).
//
//   import { loadCharacter } from `${location.origin}/common/client/character.js`;
//   const ch = await loadCharacter({ THREE, GLTFLoader, place: 0, path: 'Characters/Test robed g6.glb' });
//   scene.add(ch.root);                 // feet at the root's origin, facing +z (yaw 0, as the sim)
//   ch.setState('walk', 4);             // idle | walk | run, with the ground speed in m/s
//   each frame: ch.update(dt);

import { fileUrl } from '../resolve.js';

/** The clip to stand about in, and the one to get about with, whatever the pack calls them. */
export const idleClip = (clips) => clips.find((a) => /(^|_)idle$/i.test(a.name)) ?? clips.find((a) => /idle/i.test(a.name) && /loop/i.test(a.name) && !/zombie|shield|rail|phone|ninja/i.test(a.name)) ?? clips.find((a) => /idle/i.test(a.name));
export const walkClip = (clips) => clips.find((a) => /(^|_)walk(_loop)?$/i.test(a.name)) ?? clips.find((a) => /walk/i.test(a.name) && !/zombie/i.test(a.name)) ?? clips.find((a) => /(^|_)run(_loop)?$/i.test(a.name)) ?? clips.find((a) => /walk|run/i.test(a.name));
/** A run clip, when the pack has one (else the walk clip played faster stands in). */
export const runClip = (clips) => clips.find((a) => /(^|_)run(_loop)?$/i.test(a.name)) ?? clips.find((a) => /(^|_)(run|jog|sprint)/i.test(a.name) && !/zombie|carry|injured/i.test(a.name));

/** Point a skinned mesh from another file at the same-named bones of this skeleton. */
export function rebind(mesh, boneByName) {
  const bones = mesh.skeleton.bones.map((b) => boneByName.get(b.name));
  if (bones.some((b) => !b)) return false;
  mesh.bind(new mesh.skeleton.constructor(bones, mesh.skeleton.boneInverses), mesh.bindMatrix);
  return true;
}

/** Lowest and highest points of the skinned meshes, posed by their bones at rest (what is actually drawn). */
export function skinnedSpan(root) {
  root.updateMatrixWorld(true);
  let lo = Infinity, hi = -Infinity;
  const v = root.position.clone();
  root.traverse((o) => {
    if (!o.isSkinnedMesh || o.userData.garment) return; // the body's height, not a hat's or a hem's
    o.skeleton.pose();
    o.skeleton.update();
    const n = o.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 5) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); }
  });
  return { lo, hi, h: hi - lo };
}

// clip speeds: the ground speed (m/s) a clip looks right at, for scaling its play rate to the mover's speed
const WALK_PACE = 1.6, RUN_PACE = 4.5, FADE = 0.2;

/**
 * A character from a GLB: { root, model, mixer, clips, name, meta, height, state, setState(state, speed),
 * update(dt), tint(hex | null), dispose() }. Give `place` and `path` (its meta is read from the Library
 * when `meta` is not given), or a `url`. The clips come from the meta's `idle` and `walk` names when the
 * file has them, else by name.
 */
export async function loadCharacter({ THREE, GLTFLoader, loader = null, place, path, url = null, meta = null, name = null }) {
  const gl = loader ?? new GLTFLoader();
  if (!meta && place !== undefined && path) meta = await readMeta(place, path);
  const gltf = await gl.loadAsync(url ?? fileUrl(place, path));
  const model = gltf.scene, clips = gltf.animations ?? [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false; // skinned meshes' bounds don't follow the pose
    o.material = o.material.clone(); // each character takes its own tint
    o.userData.baseColor = o.material.color?.clone();
  });
  // Dream Characters saves its characters standing on the origin at a person's height; a pack file may not
  const span = skinnedSpan(model);
  if (Number.isFinite(span.lo) && Math.abs(span.lo) > 0.02) model.position.y -= span.lo;
  const root = new THREE.Group();
  root.name = name ?? meta?.name ?? (path ?? 'character').split('/').pop().replace(/\.glb$/i, '');
  root.add(model);

  const byName = (n) => (n ? clips.find((a) => a.name === n) : undefined);
  const idle = byName(meta?.idle) ?? idleClip(clips);
  const walk = byName(meta?.walk) ?? walkClip(clips);
  const run = runClip(clips) ?? walk;
  const mixer = new THREE.AnimationMixer(model);
  const actions = { idle: idle && mixer.clipAction(idle), walk: walk && mixer.clipAction(walk), run: run && mixer.clipAction(run) };
  // the same clip may stand in for walk and run: one action, its rate set by the state
  let current = null;
  const ch = {
    root, model, mixer, clips, meta, name: root.name, height: Number.isFinite(span.h) ? span.h : 1.8, state: '',
    /** idle | walk | run; `speed` (m/s on the ground) sets the walk and run play rate. */
    setState(state, speed = 0) {
      const a = actions[state] ?? actions.walk ?? actions.idle;
      if (a) {
        const pace = a === actions.run && state === 'run' && run !== walk ? RUN_PACE : state === 'run' ? RUN_PACE * 0.7 : WALK_PACE;
        a.timeScale = state === 'idle' ? 1 : Math.min(2.2, Math.max(0.5, (speed || pace) / pace));
      }
      if (state === ch.state && a === current) return;
      ch.state = state;
      if (a === current) return;
      if (a) a.reset().setEffectiveWeight(1).fadeIn(current ? FADE : 0).play();
      current?.fadeOut(FADE);
      current = a;
    },
    update: (dt) => mixer.update(dt),
    /** Multiply every material by one colour (an npc's variant); null puts the saved colours back. */
    tint(hex) {
      const c = hex ? new THREE.Color(hex) : null;
      model.traverse((o) => { if (o.isMesh && o.userData.baseColor) { o.material.color.copy(o.userData.baseColor); if (c) o.material.color.multiply(c); } });
    },
    dispose() {
      mixer.stopAllAction();
      root.removeFromParent();
      model.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    },
  };
  ch.setState('idle');
  return ch;
}

/** A Library item's meta (its .meta.json companion), or null. */
export async function readMeta(place, path) {
  try {
    const r = await fetch(fileUrl(place, path + '.meta.json'));
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/** The characters in the Library (kind "character", made in Dream Characters), for a picker. */
export async function listCharacters() {
  try {
    const { listLibrary } = await import(`${location.origin}/common/library.js`);
    const { items } = await listLibrary({ kind: 'character' });
    return items.filter((i) => i.tags?.includes('made') || i.meta?.recipe).map((i) => ({ place: i.place, path: i.path, name: i.name, meta: i.meta ?? null }));
  } catch { return []; }
}
