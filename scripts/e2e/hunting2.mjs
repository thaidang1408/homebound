// Phase 10: sneak (C), set a snare outside the yard, a rabbit gets caught, butcher it; new animals
// and a stove recipe ([R]) with its buff.
import { hb, play, prompt, walk } from './lib.mjs';

/** Out the front door and down the road, just past the yard; facing north (back at the house). */
const DOWN_THE_ROAD = [
  { x: 0, z: 3 },
  { x: 0, z: 6 },
  { x: 0, z: 10 },
  { x: 0, z: 18 },
];

const state = (page, fn, arg) =>
  hb(
    page,
    (h, a) => {
      const { room } = h.getSession();
      return new Function('room', 'a', `return (${a.fn})(room, a.arg)`)(room, a);
    },
    { fn: fn.toString(), arg },
  );

export default async function hunting2(t) {
  const a = await t.openPlayer('A');
  await a.getByText('Máy chủ sẵn sàng').waitFor();
  await a.getByLabel('Tên của bạn').fill('An');
  await a.getByRole('button', { name: 'Xây nhà mới' }).click();
  await a.getByRole('button', { name: 'Bắt đầu chơi' }).click();
  await a.getByRole('heading', { name: 'Tạm dừng' }).waitFor();
  await play(a);

  await a.keyboard.press('KeyC');
  await a.getByText('Đang rón rén').waitFor();
  t.check('C toggles sneaking (HUD shows it)', true);
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    return room.state.players.get(room.sessionId).crouching;
  });
  t.check('the server knows you are sneaking', true);
  await a.keyboard.press('KeyC');

  // Snare in hotbar slot 1, set it down the road (we face north, so it lands at z ≈ 16.4).
  await hb(a, (h) => h.give('snare', 2));
  await walk(a, DOWN_THE_ROAD, { x: 0, z: 0 });
  await a.keyboard.press('Digit1');
  await a.mouse.down();
  await a.mouse.up();
  await a.waitForFunction(() => window.__homebound.getSession().room.state.traps.size === 1);
  t.check('left click with a snare sets it on the ground', true);
  const trap = await state(a, (room) => {
    const [, tr] = [...room.state.traps.entries()][0];
    return { x: tr.x, z: tr.z };
  });

  // Bring a rabbit right onto it.
  await hb(a, (h, at) => h.summon('rabbit', at), trap);
  await a.getByText('Bẫy dây bắt được gì đó!').waitFor({ timeout: 15000 });
  t.check('the snare catches a rabbit', true);
  await t.shot(a, 'p10-snare');
  await prompt(a, 'Xẻ thịt thỏ').waitFor({ timeout: 15000 });
  await a.keyboard.press('KeyE');
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    const me = room.state.players.get(room.sessionId);
    return [...me.inventory].some((s) => s.itemId === 'raw_meat');
  });
  t.check('butchering the catch gives meat', true);

  // New animals, up close for the screenshots.
  await walk(a, [{ x: 0, z: 18.5 }], { x: 0, z: 30 });
  await hb(a, (h) => h.summon('bear', { x: -4, z: 24 }));
  await hb(a, (h) => h.summon('deer', { x: 4, z: 23 }));
  await a.waitForTimeout(300);
  await t.shot(a, 'p10-deer-bear');
  await a.waitForFunction(
    () => {
      const { room } = window.__homebound.getSession();
      const deer = [...room.state.creatures.values()].filter((c) => c.kind === 'deer');
      return deer.some((c) => c.mode === 'alert' || c.mode === 'flee');
    },
    null,
    { timeout: 10000 },
  );
  t.check('a deer this close notices you and bolts', true);
  await hb(a, (h) => h.summon('bear', { x: 0, z: 25 }));
  await a.waitForTimeout(400);
  await t.shot(a, 'p10-bear');
  await a.context().close();
}
