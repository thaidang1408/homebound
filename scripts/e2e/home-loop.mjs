// Phase 2: chest → stove → eat → both sleep → new day, through the real UI and controls.
import { countItem, myPlayer, play, prompt, setTime, startPair, walk } from './lib.mjs';

// Furniture centres and walkable routes (see packages/shared/src/world/house.ts).
const CHEST = { x: -5.3, z: 3.0 };
const STOVE = { x: -5.2, z: -4.45 };
const BED = { x: 4.5, z: -3.65 };
const A_TO_CHEST = [{ x: -4.3, z: 2.9 }];
const CHEST_TO_STOVE = [
  { x: -3.5, z: 2.0 },
  { x: -3.5, z: -1.5 },
  { x: -4.4, z: -3.6 },
];
const STOVE_TO_BED = [
  { x: -3.5, z: -1.5 },
  { x: -3.5, z: 1.8 },
  { x: 3.5, z: 1.8 },
  { x: 3.5, z: -1.5 },
  { x: 2.9, z: -3.2 },
];
const B_TO_BED = [
  { x: 3.5, z: 1.8 },
  { x: 3.5, z: -0.3 },
  { x: 2.9, z: -2.0 },
];

export default async function homeLoop(t) {
  const a = await t.openPlayer('A');
  const b = await t.openPlayer('B');
  await startPair(a, b);
  await play(a);

  // Shared chest
  await walk(a, A_TO_CHEST, CHEST);
  await prompt(a, 'Mở rương chung').waitFor();
  t.check('prompt appears at the chest', true);
  await a.keyboard.press('KeyE');
  await a.getByText('Rương chung').waitFor();
  await t.shot(a, 'p2-storage');
  await a
    .getByRole('button', { name: /^Rương: Thịt sống/ })
    .first()
    .click();
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    return [...room.state.players.get(room.sessionId).inventory].some(
      (s) => s.itemId === 'raw_meat',
    );
  });
  const rawTaken = countItem((await myPlayer(a)).items, 'raw_meat');
  t.check('took raw meat from the chest', rawTaken > 0, `${rawTaken}`);
  await a.keyboard.press('Escape');
  await play(a);

  // Cooking
  await walk(a, CHEST_TO_STOVE, STOVE);
  await prompt(a, 'Nấu thịt sống').waitFor();
  await a.keyboard.press('KeyE');
  await b.waitForFunction(
    () => window.__homebound.getSession().room.state.pans.at(0).status === 'cooking',
  );
  t.check('partner sees the stove cooking', true);
  await a.waitForTimeout(2500);
  await t.shot(a, 'p2-cooking');
  // Six raw meat from the chest: three cook at once (one on each pan).
  await prompt(a, 'Lấy đồ ăn (3)').waitFor({ timeout: 15000 });
  await a.getByText('Đồ ăn chín rồi!').waitFor();
  await a.keyboard.press('KeyE');
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    return [...room.state.players.get(room.sessionId).inventory].some(
      (s) => s.itemId === 'cooked_meat',
    );
  });
  t.check('collected cooked meat', true);

  // Eating from the hotbar
  const before = await myPlayer(a);
  const slot = before.items.findIndex((s) => s.itemId === 'cooked_meat');
  await a.keyboard.press(`Digit${slot + 1}`);
  await a.mouse.click(400, 250);
  await a.getByText(/\+\d+ no/).waitFor();
  const after = await myPlayer(a);
  t.check(
    'eating raises hunger',
    after.hunger > before.hunger,
    `${before.hunger} → ${after.hunger}`,
  );
  t.check(
    'one piece was eaten',
    countItem(after.items, 'cooked_meat') === countItem(before.items, 'cooked_meat') - 1,
  );

  // Sleep together → new day (beds only work in the evening)
  await walk(a, STOVE_TO_BED, BED);
  await prompt(a, /ngủ sau khi mặt trời lặn/).waitFor();
  t.check('beds refuse daytime naps', true);
  await setTime(a, 0.8);
  await prompt(a, /Ngủ$/).waitFor();
  await a.keyboard.press('KeyE');
  await a.getByText(/Đang ngủ… chờ Binh/).waitFor();
  await b.getByText('An đã đi ngủ').waitFor();
  t.check('partner is told A went to bed', true);

  await play(b);
  await walk(b, B_TO_BED, BED);
  await prompt(b, 'Ngủ — An đang chờ').waitFor();
  await t.shot(b, 'p2-bed-prompt');
  await b.keyboard.press('KeyE');
  await a.getByText('Chúc ngủ ngon…').waitFor();
  await a.getByText('Ngày 2 — chào buổi sáng!').waitFor({ timeout: 8000 });
  await b
    .getByText(/Ngày 2/)
    .first()
    .waitFor();
  t.check('both sleeping starts day 2', true);
  const woke = await Promise.all([myPlayer(a), myPlayer(b)]);
  t.check(
    'both wake up',
    woke.every((p) => !p.sleeping),
  );
  await t.shot(a, 'p2-morning');

  await a.context().close();
  await b.context().close();
}
