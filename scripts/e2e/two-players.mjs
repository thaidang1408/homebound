// Two-browser multiplayer smoke test against a running dev server (`npm run dev`).
// Usage: npm run e2e [-- http://host:5173]. Uses the locally installed Chrome (playwright-core).
// Screenshots go to scripts/e2e/out/. Reads state through the dev-only window.__homebound hook.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const APP_URL = process.argv[2] ?? 'http://localhost:5173';
const OUT = new URL('./out/', import.meta.url);
await mkdir(OUT, { recursive: true });

const errors = [];
const failures = [];
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(label);
};

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

/** `expectRejections`: this player is meant to be refused (HTTP 522), so those logs are expected. */
async function openPlayer(label, { expectRejections = false } = {}) {
  const page = await (
    await browser.newContext({ viewport: { width: 1100, height: 700 } })
  ).newPage();
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (expectRejections && m.text().startsWith('Failed to load resource')) return;
    errors.push(`${label}: ${m.text()}`);
  });
  await page.goto(APP_URL);
  return page;
}

const shot = (page, name) => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT)) });
const session = (page, fn) => page.evaluate(fn);
const partnerPose = (page) =>
  session(page, () => {
    const { room } = window.__homebound.getSession();
    const entry = [...room.state.players.entries()].find(([id]) => id !== room.sessionId);
    return (
      entry && { x: entry[1].x, z: entry[1].z, yaw: entry[1].yaw, connected: entry[1].connected }
    );
  });
const moved = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) > 0.5;

const a = await openPlayer('A');
const b = await openPlayer('B');
const c = await openPlayer('C', { expectRejections: true });

await a.getByText('Server online').waitFor();
await a.getByLabel('Your name').fill('An');
await a.getByRole('button', { name: 'Create room' }).click();
await a.getByText('Click to copy').waitFor();
const code = await session(a, () => window.__homebound.getSession().room.roomId);
check('create room returns a code', /^[A-Z0-9]{5}$/.test(code), code);

await b.getByLabel('Your name').fill('Binh');
await b.getByLabel('Room code').fill(code.toLowerCase());
await b.getByRole('button', { name: 'Join' }).click();
await a.getByText('Binh').waitFor();
check('partner joins by (lower-case) code', true);

await c.getByLabel('Room code').fill(code);
await c.getByRole('button', { name: 'Join' }).click();
await c.getByRole('alert').waitFor();
check('third player is turned away', /full/.test(await c.getByRole('alert').textContent()));
await c.getByLabel('Room code').fill('QQQQQ');
await c.getByRole('button', { name: 'Join' }).click();
await c.getByText(/check the room code/).waitFor();
check('wrong code shows a friendly error', true);

await a.getByRole('button', { name: "I'm ready" }).click();
await b.getByRole('button', { name: "I'm ready" }).click();
await a.getByText('Both ready').waitFor();
await shot(a, '1-lobby');
await b.getByRole('button', { name: 'Start game' }).click();
await a.getByText('Paused').waitFor();
await b.getByText('Paused').waitFor();
check('both players enter the game', true);

await a.getByText('Paused').click();
const aBefore = await partnerPose(b);
await a.keyboard.down('KeyW');
await a.mouse.move(550, 350);
await a.mouse.move(450, 350, { steps: 10 });
await a.waitForTimeout(1200);
await a.keyboard.up('KeyW');
await a.waitForTimeout(400);
const aAfter = await partnerPose(b);
check('B sees A move', moved(aBefore, aAfter));
check('B sees A turn', Math.abs(aAfter.yaw - aBefore.yaw) > 0.05);
await shot(b, '2-b-sees-a');

await b.getByText('Paused').click();
const bBefore = await partnerPose(a);
await b.keyboard.down('KeyD');
await b.waitForTimeout(800);
await b.keyboard.up('KeyD');
await b.waitForTimeout(400);
check('A sees B move', moved(bBefore, await partnerPose(a)));

const bSession = await session(b, () => window.__homebound.getSession().room.sessionId);
await b.reload();
await b.getByText('Paused').waitFor({ timeout: 15000 });
const bAfterReload = await session(b, () => window.__homebound.getSession().room.sessionId);
check('reload reconnects into the same seat', bSession === bAfterReload);

await b.context().close();
await a.getByText(/disconnected — waiting/).waitFor();
check('A is told the partner disconnected', (await partnerPose(a))?.connected === false);
await shot(a, '3-partner-disconnected');

check('no console errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nAll checks passed');
process.exitCode = failures.length ? 1 : 0;
