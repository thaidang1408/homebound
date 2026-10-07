// Browser playtests against a running dev server (`npm run dev`).
// Usage: npm run e2e [-- http://host:5173] [scenario...]. Screenshots: scripts/e2e/out/.
import { createRun } from './lib.mjs';
import homeLoop from './home-loop.mjs';
import soloSave from './solo-save.mjs';
import twoPlayers from './two-players.mjs';

const SCENARIOS = { 'two-players': twoPlayers, 'home-loop': homeLoop, 'solo-save': soloSave };

const args = process.argv.slice(2);
const appUrl = args.find((a) => a.startsWith('http')) ?? 'http://localhost:5173';
const picked = args.filter((a) => !a.startsWith('http'));
const names = picked.length ? picked : Object.keys(SCENARIOS);

const t = await createRun(appUrl);
for (const name of names) {
  console.log(`\n— ${name}`);
  try {
    await SCENARIOS[name](t);
  } catch (error) {
    t.check(`${name} completed`, false, error.message.split('\n').slice(0, 3).join(' '));
    await t.shootAll(`fail-${name}`);
  }
  const errors = t.takeErrors();
  t.check(`${name}: no console errors`, errors.length === 0, errors.join(' | '));
}
await t.close();

console.log(t.failures.length ? `\n${t.failures.length} check(s) failed` : '\nAll checks passed');
process.exitCode = t.failures.length ? 1 : 0;
