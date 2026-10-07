// Drag and drop in the backpack (Tab): move to an empty slot, swap two stacks.
import { hb, play } from './lib.mjs';

const slotItem = (page, i) =>
  hb(
    page,
    (h, index) => {
      const { room } = h.getSession();
      const s = room.state.players.get(room.sessionId).inventory.at(index);
      return s.qty > 0 ? `${s.itemId}:${s.qty}` : 'empty';
    },
    i,
  );

export default async function backpack(t) {
  const a = await t.openPlayer('A');
  await a.getByText('Server online').waitFor();
  await a.getByLabel('Your name').fill('An');
  await a.getByRole('button', { name: 'Build a new home' }).click();
  await a.getByRole('button', { name: 'Start game' }).click();
  await a.getByText('Paused').waitFor();
  await play(a);
  await hb(a, (h) => h.give('wood', 5)); // slot 0
  await hb(a, (h) => h.give('stone', 2)); // slot 1
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    return room.state.players.get(room.sessionId).inventory.at(1).itemId === 'stone';
  });

  await a.keyboard.press('Tab');
  await a.getByText('Backpack').waitFor();
  const slots = a.getByRole('button', { name: /^Your items:/ });
  await slots.nth(0).dragTo(slots.nth(8));
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    return room.state.players.get(room.sessionId).inventory.at(8).itemId === 'wood';
  });
  t.check('drag wood onto an empty slot', (await slotItem(a, 0)) === 'empty', await slotItem(a, 8));

  await slots.nth(1).dragTo(slots.nth(8));
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    return room.state.players.get(room.sessionId).inventory.at(8).itemId === 'stone';
  });
  t.check('drag stone onto wood swaps them', (await slotItem(a, 1)) === 'wood:5');
  await t.shot(a, 'p7-backpack');

  await a.context().close();
}
