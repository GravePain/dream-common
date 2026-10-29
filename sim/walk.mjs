// node sim/walk.mjs [zone folder]: walk a player 20 m across a zone (Crystal Cascades by default) and print
// its path every half second: position, the ground height under it, and the gap between them.
import fs from 'node:fs';
import path from 'node:path';
import { createSim, stepOnce } from './index.js';

const dir = process.argv[2] ?? 'K:/dream-forge-creations/Zones/Crystal Cascades';
const zone = JSON.parse(fs.readFileSync(path.join(dir, 'zone.json'), 'utf8'));
const cells = zone.cells.map((c) => JSON.parse(fs.readFileSync(path.join(dir, 'cells', `${c}.json`), 'utf8')));
const sim = createSim({ zone, cells, seed: 1 });
sim.on('enter cell', (e) => console.log(`  enter cell ${e.from} -> ${e.to} at tick ${e.tick}`));
sim.on('blocked', (e) => console.log(`  blocked (${e.reason}) at tick ${e.tick}`));
sim.join('p1', { x: -10, z: 30 });
sim.intent('p1', { type: 'moveTo', x: 10, z: 30 });
console.log(`${zone.name}: tick      x       z    y(player)  ground   gap   anim`);
for (let t = 0; t <= 120; t++) {
  stepOnce(sim);
  const p = sim.world.get('p1'), g = sim.world.ground.heightAt(p.x, p.z);
  if (t % 10 === 0) console.log(`  ${String(t).padStart(4)} ${p.x.toFixed(2).padStart(7)} ${p.z.toFixed(2).padStart(7)} ${p.y.toFixed(3).padStart(9)} ${g.toFixed(3).padStart(8)} ${(p.y - g).toFixed(3).padStart(6)}  ${p.anim}`);
}
