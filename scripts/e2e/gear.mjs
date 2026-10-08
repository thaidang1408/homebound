// Phase 14: the backpack window — read an item, wear a satchel (more slots) and a cap, drag a
// stack out to drop it, pick the bag up again; three things cooking at once; the key hints.
import { hb, play, prompt, startPair, walk } from './lib.mjs';

const STOVE = { x: -5.2, z: -4.45 };
const TO_STOVE = [
  { x: -3.5, z: 2.0 },
  { x: -3.5, z: -1.5 },
  { x: -4.4, z: -3.6 },
];

const me = (page) =>
  hb(page, (h) => {
    const { room } = h.getSession();
    const p = room.state.players.get(room.sessionId);
    return {
      slots: p.inventory.length,
      items: [...p.inventory].map((s) => (s.qty > 0 ? s.itemId : '')),
      worn: [...p.equipment].map((s) => (s.qty > 0 ? s.itemId : '')),
      drops: room.state.drops.size,
    };
  });

export default async function gear(t) {
  const a = await t.openPlayer('A');
  await a.getByText('Máy chủ sẵn sàng').waitFor();
  await a.getByLabel('Tên của bạn').fill('Mai');
  await a.getByRole('button', { name: 'Xây nhà mới' }).click();
  await a.getByRole('button', { name: 'Bắt đầu chơi' }).click();
  await a.getByRole('heading', { name: 'Tạm dừng' }).waitFor();
  const scrolls = await a.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  t.check('the pause menu fits without scrolling the page', !scrolls);
  await t.shot(a, 'p14-pause');
  await play(a);
  await a.getByText('Ẩn gợi ý').waitFor();
  t.check('key hints are on screen while playing', true);

  await hb(a, (h) => {
    h.give('satchel', 1); // slot 0
    h.give('leather_cap', 1); // slot 1
    h.give('wood', 5); // slot 2
  });
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    return room.state.players.get(room.sessionId).inventory.at(2).itemId === 'wood';
  });

  await a.keyboard.press('Tab');
  await a.getByText('Đang mặc').waitFor();
  const slots = a.getByRole('button', { name: /^Đồ của bạn/ });
  await slots.nth(0).hover();
  await a.getByText('🎒 +5 ô ba lô').waitFor();
  t.check('pointing at an item explains it', true);

  await slots.nth(0).dblclick();
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    return room.state.players.get(room.sessionId).inventory.length === 15;
  });
  t.check('a satchel on your back adds 5 slots', (await me(a)).slots === 15);

  await slots.nth(1).dragTo(a.getByRole('button', { name: /^Đầu:/ }));
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    return room.state.players.get(room.sessionId).equipment.at(0).itemId === 'leather_cap';
  });
  t.check('drag the cap onto the head slot to wear it', true);
  await a.getByText(/Giáp −10%/).waitFor({ state: 'attached' });
  await t.shot(a, 'p14-backpack');

  // Drag the wood out of the window (onto the world behind it) to drop it.
  await slots.nth(2).dragTo(a.locator('body'), { targetPosition: { x: 12, y: 12 } });
  await a.waitForFunction(() => window.__homebound.getSession().room.state.drops.size === 1);
  t.check('dragging a stack out of the window drops it', !(await me(a)).items.includes('wood'));

  await a.keyboard.press('Tab');
  await play(a);
  await prompt(a, 'Nhặt Gỗ ×5').waitFor();
  await t.shot(a, 'p14-drop');
  await a.keyboard.press('KeyE');
  await a.waitForFunction(() => window.__homebound.getSession().room.state.drops.size === 0);
  t.check('[E] picks the bag back up', (await me(a)).items.includes('wood'));

  await hb(a, (h) => h.give('raw_meat', 4));
  await walk(a, TO_STOVE, STOVE);
  await prompt(a, 'Nấu thịt sống ×3').waitFor();
  await a.keyboard.press('KeyE');
  await a.waitForFunction(() =>
    [...window.__homebound.getSession().room.state.pans].every((p) => p.status === 'cooking'),
  );
  t.check('three pieces of meat cook at once', true);
  await a.waitForTimeout(2000);
  await t.shot(a, 'p14-stove');
  await prompt(a, 'Lấy đồ ăn (3)').waitFor({ timeout: 15000 });
  await a.keyboard.press('KeyE');
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    return (
      [...room.state.players.get(room.sessionId).inventory]
        .filter((s) => s.itemId === 'cooked_meat')
        .reduce((n, s) => n + s.qty, 0) === 3
    );
  });
  t.check('all three are taken with one [E]', true);
  await a.context().close();
}

/** Out to the yard in one hop (dev teleport), then face `lookAt`. */
async function jump(page, at, lookAt) {
  await hb(page, (h, p) => h.teleport(p.x, p.z), at);
  await page.waitForFunction((p) => {
    const { room } = window.__homebound.getSession();
    const me = room.state.players.get(room.sessionId);
    return Math.hypot(me.x - p.x, me.z - p.z) < 0.3;
  }, at);
  await walk(page, [at], lookAt);
}

/** The partner sees what you wear: a coat, a cap, boots and a big bag on your back. */
export async function gearPartner(t) {
  const a = await t.openPlayer('A');
  const b = await t.openPlayer('B');
  await startPair(a, b, ['Mai', 'Tú']);
  await play(a);
  await play(b);
  await hb(a, (h) => {
    for (const id of ['bear_coat', 'leather_cap', 'soft_boots', 'big_backpack', 'spear']) {
      h.give(id, 1);
    }
  });
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    return [...room.state.players.get(room.sessionId).inventory].some((s) => s.itemId === 'spear');
  });
  await hb(a, (h) => {
    const { room } = h.getSession();
    // Each one is in slot 0..4 in give order; wearing one empties its slot.
    for (let slot = 0; slot < 5; slot++) room.send('equip', { slot });
  });
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    return [...room.state.players.get(room.sessionId).equipment].every((s) => s.qty > 0);
  });
  await jump(a, { x: 10, z: 10 }, { x: 10, z: 13 }); // back turned to B
  await jump(b, { x: 9, z: 7.8 }, { x: 10, z: 10 });
  await b.waitForTimeout(800);
  await t.shot(b, 'p14-partner-gear');
  const seen = await hb(b, (h) => {
    const { room } = h.getSession();
    const partner = [...room.state.players.entries()].find(([id]) => id !== room.sessionId)[1];
    return [...partner.equipment].map((s) => s.itemId).join(',');
  });
  t.check(
    'the partner’s gear syncs',
    seen === 'leather_cap,bear_coat,soft_boots,big_backpack,spear',
    seen,
  );
  await a.context().close();
  await b.context().close();
}
