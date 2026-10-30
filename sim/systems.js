// The feature registry and the event bus (step 10). A system is a plugin over the sim:
//
//   registerSystem({ name, components, onTick(sim, dt), onIntent(sim, e, intent), init(sim), before, after })
//
// `components` names the components it reads (documentation, and `systemsFor(name)`); `onTick` runs once a
// tick after every mover has moved, in registration order; `onIntent` gets each intent movement does not
// handle (cast, pickup, use, drop) and returns true when it took it; `init` runs once when a sim is made.
// `before` and `after` are { <event>: (sim, ev) => ... } hooks on named events: a `before` hook returning
// false vetoes the event (it does not happen and is not emitted), and may amend it in place (a shield lowering
// `ev.amount`); `after` hooks run once it has happened, before the listeners hear it.
//
// The built-in systems (systems/index.js) register in a fixed order: stats, abilities, ai, items. Nothing in a
// system reads the clock or Math.random: time is `sim.tick`, chance is `sim.random`, entities go in uid order,
// so a replay with systems on matches bit for bit.

/** The default registry, filled by systems/index.js. */
export const REGISTRY = [];

/** Add a system to a registry (the default one unless given); names are unique. Returns the system. */
export function registerSystem(def, registry = REGISTRY) {
  if (!def || typeof def.name !== 'string' || !def.name) throw new Error('registerSystem: a system needs a name');
  if (registry.some((s) => s.name === def.name)) throw new Error(`registerSystem: ${def.name} is registered already`);
  const s = { components: [], before: {}, after: {}, ...def };
  registry.push(s);
  return s;
}

/** The systems that read a component. */
export const systemsFor = (component, registry = REGISTRY) => registry.filter((s) => s.components.includes(component));

/**
 * Bind a list of systems to a sim: `sim.systems`, `sim.gate(type, ev)` (the before hooks: false when vetoed)
 * and `sim.fire(type, ev)` (gate, then the after hooks and the listeners; returns false when vetoed).
 * `pick` is null for every registered system, or a list of names.
 */
export function bindSystems(sim, registry = REGISTRY, pick = null) {
  sim.systems = registry.filter((s) => !pick || pick.includes(s.name));
  sim.gate = (type, ev) => {
    for (const s of sim.systems) { const h = s.before[type]; if (h && h(sim, ev) === false) return false; }
    return true;
  };
  sim.done = (type, ev) => {
    for (const s of sim.systems) s.after[type]?.(sim, ev);
    sim.emit(type, ev);
  };
  sim.fire = (type, ev) => { if (!sim.gate(type, ev)) return false; sim.done(type, ev); return true; };
  for (const s of sim.systems) s.init?.(sim);
  return sim.systems;
}

/** Each system's onTick, in order. */
export function tickSystems(sim) {
  for (const s of sim.systems) s.onTick?.(sim, sim.dt);
}

/** Offer an intent to the systems; true when one took it. */
export function intentToSystems(sim, e, intent) {
  for (const s of sim.systems) if (s.onIntent?.(sim, e, intent)) return true;
  return false;
}
