// The one move / rotate / scale tool for the Dream tools, lifted from the two TransformControls wrappers it
// replaces (Dream Forge edit.js and Dream World main.ts). The app owns what is selected; the gizmo moves a proxy
// object and reports it, so it works the same on a placed piece, a part or a set of mesh points.
//
//   const gizmo = createGizmo({ THREE, TransformControls, camera, dom: renderer.domElement, scene, orbit: controls,
//     onStart: () => before = snapshot(), onChange: (proxy) => applyFrom(proxy), onEnd: () => pushUndo(before, snapshot()) });
//   gizmo.attachAt(position, quaternion, scale);   // put the handles on the selection
//   gizmo.detach();                                // nothing selected
//
// `three` and its TransformControls are passed in, never imported, so a page never ends up with two copies.
//
// Keys (ignored while typing in a field): Q view only, W move, E rotate, R scale, X local / global, Z pivot / centre.
// Hold Ctrl to snap (steps: move 0.25 m, rotate 15 degrees, scale 0.1, all settable).

export const DEFAULT_STEPS = { move: 0.25, rotate: 15, scale: 0.1 };

export function createGizmo({
  THREE, TransformControls, camera, dom, scene, orbit = null,
  size = 0.85, steps = DEFAULT_STEPS, keys = true, keyTarget = window,
  onStart, onChange, onEnd, onState,
}) {
  const proxy = new THREE.Object3D();
  proxy.name = 'gizmo-proxy';
  const tc = new TransformControls(camera, dom);
  tc.setSize(size);
  tc.attach(proxy);
  scene.add(proxy, tc.getHelper());

  const st = { mode: 'translate', space: 'world', pivot: 'pivot', view: false, attached: false, snapping: false, dragging: false, steps: { ...steps } };

  function show() {
    const on = st.attached && !st.view;
    tc.enabled = on;
    tc.getHelper().visible = on;
  }

  tc.addEventListener('dragging-changed', (e) => {
    st.dragging = e.value;
    if (orbit) orbit.enabled = !e.value;
    if (e.value) onStart?.(proxy);
    else onEnd?.(proxy);
  });
  tc.addEventListener('objectChange', () => { if (st.dragging) onChange?.(proxy); });

  const state = () => onState?.({ mode: st.mode, space: st.space, pivot: st.pivot, view: st.view, snapping: st.snapping });

  const api = {
    proxy,
    controls: tc,
    get mode() { return st.view ? 'view' : st.mode; },
    get space() { return st.space; },
    get pivot() { return st.pivot; },
    get dragging() { return st.dragging; },
    /** True while the pointer is over a handle: the app should not start its own click or drag then. */
    get hovering() { return tc.enabled && tc.axis != null; },
    steps: st.steps,

    /** 'view' (Q), 'translate' (W), 'rotate' (E) or 'scale' (R). */
    setMode(mode) {
      st.view = mode === 'view';
      if (!st.view) { st.mode = mode; tc.setMode(mode); }
      show();
      state();
    },
    setSpace(space) { st.space = space; tc.setSpace(space); state(); },
    toggleSpace() { api.setSpace(st.space === 'local' ? 'world' : 'local'); },
    /** 'pivot' (the object's own origin) or 'centre' (the middle of its bounds); the app reads it when attaching. */
    setPivot(p) { st.pivot = p; state(); },
    togglePivot() { api.setPivot(st.pivot === 'pivot' ? 'centre' : 'pivot'); },
    snap(on) {
      st.snapping = on;
      tc.setTranslationSnap(on ? st.steps.move : null);
      tc.setRotationSnap(on ? THREE.MathUtils.degToRad(st.steps.rotate) : null);
      tc.setScaleSnap(on ? st.steps.scale : null);
      state();
    },
    setSteps(s) { Object.assign(st.steps, s); if (st.snapping) api.snap(true); },

    /** Put the handles at a place (Vector3, optional Quaternion and Vector3 or number for scale). */
    attachAt(position, quaternion = null, scale = 1) {
      proxy.position.copy(position);
      if (quaternion) proxy.quaternion.copy(quaternion); else proxy.quaternion.identity();
      if (typeof scale === 'number') proxy.scale.setScalar(scale); else proxy.scale.copy(scale);
      proxy.updateMatrixWorld(true);
      st.attached = true;
      show();
    },
    /** Put the handles on an object's world transform. */
    attachTo(object) {
      object.updateMatrixWorld(true);
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      object.matrixWorld.decompose(p, q, s);
      api.attachAt(p, q, s);
    },
    detach() { st.attached = false; show(); },

    dispose() {
      if (keys) { keyTarget.removeEventListener('keydown', down); keyTarget.removeEventListener('keyup', up); keyTarget.removeEventListener('blur', blur); }
      tc.detach();
      scene.remove(proxy, tc.getHelper());
      tc.dispose();
    },
  };

  const typing = (e) => e.target?.closest?.('input, select, textarea, [contenteditable="true"]');
  function down(e) {
    if (e.key === 'Control') { api.snap(true); return; }
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'q') api.setMode('view');
    else if (k === 'w') api.setMode('translate');
    else if (k === 'e') api.setMode('rotate');
    else if (k === 'r') api.setMode('scale');
    else if (k === 'x') api.toggleSpace();
    else if (k === 'z') api.togglePivot();
  }
  function up(e) { if (e.key === 'Control') api.snap(false); }
  const blur = () => api.snap(false);
  if (keys) {
    keyTarget.addEventListener('keydown', down);
    keyTarget.addEventListener('keyup', up);
    keyTarget.addEventListener('blur', blur); // a Ctrl released in another window must not leave snapping on
  }

  show();
  return api;
}
