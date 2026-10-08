// Phase 9: jump, dodge, wave and ping reach the partner; sprinting and dodging use stamina.
import { hb, play, startPair } from './lib.mjs';

/** What the other page sees of this player: their announced action and stamina. */
const seenBy = (page) =>
  hb(page, (h) => {
    const { room } = h.getSession();
    const [, p] = [...room.state.players.entries()].find(([id]) => id !== room.sessionId);
    return { action: p.action, seq: p.actionSeq, stamina: p.stamina };
  });

const waitForAction = (page, action) =>
  page.waitForFunction((a) => {
    const { room } = window.__homebound.getSession();
    const [, p] = [...room.state.players.entries()].find(([id]) => id !== room.sessionId);
    return p.action === a;
  }, action);

export default async function feel(t) {
  const a = await t.openPlayer('A');
  const b = await t.openPlayer('B');
  await startPair(a, b);
  await play(a);
  await play(b);
  // B turns left (+90°) to watch A, who spawned 2.4 m to the west.
  await b.mouse.move(400, 250);
  for (let i = 0; i < 12; i++) await b.mouse.move(400 - (i + 1) * 60, 250);

  await a.keyboard.press('KeyG');
  await waitForAction(b, 'wave');
  await b.waitForTimeout(350);
  await t.shot(b, 'p9-partner-waves');
  t.check('partner sees the wave', true);

  await a.keyboard.press('Space');
  await waitForAction(b, 'jump');
  t.check('partner sees the jump', true);

  // Q mid-air waits only a moment; at headless frame rates the jump lasts a while, so press
  // again until it lands and the roll goes through.
  for (let i = 0; i < 12; i++) {
    await a.waitForTimeout(400);
    await a.keyboard.press('KeyQ');
    const seen = await seenBy(b);
    if (seen.action === 'dodge') break;
  }
  await waitForAction(b, 'dodge');
  const afterDodge = await seenBy(b);
  t.check('a dodge costs stamina', afterDodge.stamina < 100, `stamina ${afterDodge.stamina}`);

  // Look down at the floor in front and mark it.
  await a.mouse.move(400, 250);
  await a.mouse.move(400, 420, { steps: 8 });
  await a.keyboard.press('KeyF');
  await waitForAction(b, 'point');
  await b.locator('[data-mark="ping"]:not([hidden])').waitFor();
  await t.shot(b, 'p9-ping');
  t.check('partner sees the ping on the compass', true);

  // Sprint out of the front door for a moment: stamina drains.
  await a.mouse.move(400, 250, { steps: 8 });
  const before = (await seenBy(b)).stamina;
  await a.keyboard.down('ShiftLeft');
  await a.keyboard.down('KeyS');
  await a.waitForTimeout(1500);
  await a.keyboard.up('KeyS');
  await a.keyboard.up('ShiftLeft');
  await a.waitForTimeout(200);
  const after = (await seenBy(b)).stamina;
  t.check('sprinting drains stamina', after < before, `${before} → ${after}`);
  await t.shot(a, 'p9-arms-hud');

  await a.context().close();
  await b.context().close();
}
