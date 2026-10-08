// Phase 1: room code join, full room, movement sync both ways, reload reconnect, disconnect UI.
import { hb, play, roomOf } from './lib.mjs';

const partnerPose = (page) =>
  hb(page, (h) => {
    const { room } = h.getSession();
    const entry = [...room.state.players.entries()].find(([id]) => id !== room.sessionId);
    return (
      entry && { x: entry[1].x, z: entry[1].z, yaw: entry[1].yaw, connected: entry[1].connected }
    );
  });
const moved = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) > 0.5;

export default async function twoPlayers(t) {
  const a = await t.openPlayer('A');
  const b = await t.openPlayer('B');
  const c = await t.openPlayer('C', { expectRejections: true });

  await a.getByText('Server online').waitFor();
  await a.getByLabel('Your name').fill('An');
  await a.getByRole('button', { name: 'Build a new home' }).click();
  await a.getByText('Click to copy').waitFor();
  const code = await roomOf(a);
  t.check('create room returns a code', /^[A-Z0-9]{5}$/.test(code), code);

  await b.getByLabel('Your name').fill('Binh');
  await b.getByLabel('Home code').fill(code.toLowerCase());
  await b.getByRole('button', { name: 'Join' }).click();
  await a.getByText('Binh').waitFor();
  t.check('partner joins by (lower-case) code', true);

  await c.getByLabel('Home code').fill(code);
  await c.getByRole('button', { name: 'Join' }).click();
  await c.getByRole('alert').waitFor();
  t.check(
    'third player is turned away',
    /two players/.test(await c.getByRole('alert').textContent()),
  );
  await c.getByLabel('Home code').fill('QQQQQ');
  await c.getByRole('button', { name: 'Join' }).click();
  await c.getByText(/check the code/).waitFor();
  t.check('wrong code shows a friendly error', true);
  await c.context().close();

  await a.getByRole('button', { name: "I'm ready" }).click();
  await b.getByRole('button', { name: "I'm ready" }).click();
  await a.getByText('Both ready').waitFor();
  await t.shot(a, 'p1-lobby');
  await b.getByRole('button', { name: 'Start game' }).click();
  await a.getByText('Paused').waitFor();
  await b.getByText('Paused').waitFor();
  t.check('both players enter the game', true);

  await a.getByText('Paused').click();
  const aBefore = await partnerPose(b);
  await a.keyboard.down('KeyW');
  await a.mouse.move(400, 250);
  await a.mouse.move(300, 250, { steps: 10 });
  await a.waitForTimeout(1200);
  await a.keyboard.up('KeyW');
  await a.waitForTimeout(400);
  const aAfter = await partnerPose(b);
  t.check('B sees A move', moved(aBefore, aAfter));
  t.check('B sees A turn', Math.abs(aAfter.yaw - aBefore.yaw) > 0.05);
  await t.shot(b, 'p1-b-sees-a');

  await play(b); // waits until the mouse is captured: keys only move you then
  const bBefore = await partnerPose(a);
  await b.keyboard.down('KeyD');
  await b.waitForTimeout(1200);
  await b.keyboard.up('KeyD');
  await b.waitForTimeout(400);
  t.check('A sees B move', moved(bBefore, await partnerPose(a)));

  const sessionOf = (page) => hb(page, (h) => h.getSession().room.sessionId);
  const bSession = await sessionOf(b);
  await b.reload();
  await b.getByText('Paused').waitFor({ timeout: 15000 });
  t.check('reload reconnects into the same seat', bSession === (await sessionOf(b)));

  await b.context().close();
  await a.getByText(/disconnected — waiting/).waitFor();
  t.check('A is told the partner disconnected', (await partnerPose(a))?.connected === false);
  await t.shot(a, 'p1-partner-disconnected');
  await a.context().close();
}
