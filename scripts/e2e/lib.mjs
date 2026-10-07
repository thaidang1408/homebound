// Shared helpers for browser playtests. Uses the locally installed Chrome via playwright-core and
// the dev-only window.__homebound hook (apps/client/src/devtools.ts).
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const OUT = new URL('./out/', import.meta.url);

export async function createRun(appUrl) {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  const failures = [];
  const pages = new Map();

  return {
    failures,
    check(label, ok, detail = '') {
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
      if (!ok) failures.push(label);
    },
    /** `expectRejections`: this player is meant to be refused (HTTP 522), so those logs are expected. */
    async openPlayer(label, { expectRejections = false } = {}) {
      const ctx = await browser.newContext({ viewport: { width: 800, height: 500 } });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (expectRejections && m.text().startsWith('Failed to load resource')) return;
        errors.push(`${label}: ${m.text()}`);
      });
      pages.set(label, page);
      await page.goto(appUrl);
      return page;
    },
    shot: (page, name) => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT)) }),
    takeErrors: () => errors.splice(0),
    /** On failure: screenshot every player still open, to see what each was looking at. */
    async shootAll(prefix) {
      for (const [label, page] of pages) {
        if (!page.isClosed())
          await page.screenshot({ path: fileURLToPath(new URL(`${prefix}-${label}.png`, OUT)) });
      }
      pages.clear();
    },
    close: () => browser.close(),
  };
}

/** Evaluate against the dev hook: `hb(page, (h) => h.getSession().room.roomId)`. */
export const hb = (page, fn, arg) =>
  page.evaluate(
    ([src, a]) => new Function('h', 'a', `return (${src})(h, a)`)(window.__homebound, a),
    [fn.toString(), arg],
  );

export const roomOf = (page) => hb(page, (h) => h.getSession().room.roomId);

/** Both players create/join, ready up and enter the game. Returns the room code. */
export async function startPair(a, b, names = ['An', 'Binh']) {
  await a.getByText('Server online').waitFor();
  await a.getByLabel('Your name').fill(names[0]);
  await a.getByRole('button', { name: 'Create room' }).click();
  await a.getByText('Click to copy').waitFor();
  const code = await roomOf(a);
  await b.getByLabel('Your name').fill(names[1]);
  await b.getByLabel('Room code').fill(code);
  await b.getByRole('button', { name: 'Join' }).click();
  await a.getByText(names[1]).waitFor();
  await a.getByRole('button', { name: "I'm ready" }).click();
  await b.getByRole('button', { name: "I'm ready" }).click();
  await a.getByText('Both ready').waitFor();
  await a.getByRole('button', { name: 'Start game' }).click();
  await a.getByText('Paused').waitFor();
  await b.getByText('Paused').waitFor();
  return code;
}

/** Capture the mouse if the game is paused (panels and Esc release it). */
export async function play(page) {
  const isLocked = () => page.evaluate(() => document.pointerLockElement !== null);
  // Closing a panel re-locks asynchronously; give it a moment before clicking "Paused".
  for (let i = 0; i < 10 && !(await isLocked()); i++) await page.waitForTimeout(50);
  if (!(await isLocked())) await page.getByText('Paused').click();
  await page.waitForFunction(() => document.pointerLockElement !== null);
}

/** Drive the real controller along waypoints (dev autopilot), then face `lookAt`. */
export async function walk(page, path, lookAt = null) {
  await hb(page, (h, a) => h.walkTo(a.path, a.lookAt), { path, lookAt });
  await page.waitForFunction(
    (target) => {
      const { room } = window.__homebound.getSession();
      const me = room.state.players.get(room.sessionId);
      return Math.hypot(me.x - target.x, me.z - target.z) < 0.05;
    },
    path.at(-1),
    { timeout: 90000 }, // headless software rendering runs at a low FPS
  );
}

export const myPlayer = (page) =>
  hb(page, (h) => {
    const { room } = h.getSession();
    const p = room.state.players.get(room.sessionId);
    return {
      hunger: p.hunger,
      sleeping: p.sleeping,
      items: [...p.inventory].map((s) => ({ itemId: s.itemId, qty: s.qty })),
    };
  });

export const countItem = (items, id) =>
  items.filter((s) => s.itemId === id).reduce((n, s) => n + s.qty, 0);

/** The interaction prompt under the crosshair ("[E] Sleep"), matched on its text. */
export const prompt = (page, text) => page.locator('[data-actionable]').filter({ hasText: text });
