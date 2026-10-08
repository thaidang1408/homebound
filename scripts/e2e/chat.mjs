// Chat: Enter opens the box, Enter sends, the partner sees it; typing doesn't move or mute you.
import { hb, play, startPair } from './lib.mjs';

const position = (page) =>
  hb(page, (h) => {
    const { room } = h.getSession();
    const p = room.state.players.get(room.sessionId);
    return { x: p.x, z: p.z };
  });

export default async function chat(t) {
  const a = await t.openPlayer('A');
  const b = await t.openPlayer('B');
  await startPair(a, b);
  await play(a);

  const before = await position(a);
  await a.keyboard.press('Enter');
  const input = a.getByLabel('Chat message');
  await input.waitFor();
  await input.pressSequentially('wwww mmm đi săn thôi');
  await a.keyboard.press('Enter');
  await b.getByText('đi săn thôi').waitFor();
  t.check('partner sees the message', true);
  t.check('sender sees their own line', await a.getByText('đi săn thôi').isVisible());
  const after = await position(a);
  t.check('typing W does not walk', Math.hypot(after.x - before.x, after.z - before.z) < 0.05);
  t.check('typing M does not mute', !(await a.getByText('Sound off').isVisible()));
  t.check('the box closes after sending', !(await input.isVisible()));
  await t.shot(b, 'chat-partner');
  await a.context().close();
  await b.context().close();
}
