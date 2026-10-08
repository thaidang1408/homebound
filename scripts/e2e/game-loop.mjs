// Phase 6: daily goals, a night out with wolves (spear in hand), home to bed, the morning summary.
import { hb, play, prompt, setTime, walk } from './lib.mjs';

const NIGHT = 0.9;
const OUT_NORTH = [
  { x: 0, z: 3 },
  { x: 0, z: 6 },
  { x: 0, z: 8 },
  { x: 14, z: 8 },
  { x: 15, z: -10 },
  { x: 10, z: -18 },
];
const FRONT_DOOR = [
  { x: 15, z: -10 },
  { x: 14, z: 8 },
  { x: 0, z: 8 },
  { x: 0, z: 6 },
  { x: 0, z: 3 },
];
const TO_BED = [
  { x: 3.5, z: 1.8 },
  { x: 3.5, z: -1.5 },
  { x: 2.9, z: -3.2 },
];
const BED = { x: 4.5, z: -3.65 };
const HOSTILE = ['alert', 'chase', 'attack', 'hurt'];

const hostileWolf = (page) =>
  hb(
    page,
    (h, hostile) => {
      const { room } = h.getSession();
      for (const [id, c] of room.state.creatures) {
        if (c.kind === 'wolf' && c.present && hostile.includes(c.mode))
          return { id, x: c.x, z: c.z };
      }
      return null;
    },
    HOSTILE,
  );

const me = (page) =>
  hb(page, (h) => {
    const { room } = h.getSession();
    const p = room.state.players.get(room.sessionId);
    return { x: p.x, z: p.z, health: p.health };
  });

export default async function gameLoop(t) {
  const a = await t.openPlayer('A');
  await a.getByText('Máy chủ sẵn sàng').waitFor();
  await a.getByLabel('Tên của bạn').fill('An');
  await a.getByRole('button', { name: 'Xây nhà mới' }).click();
  await a.getByRole('button', { name: 'Bắt đầu chơi' }).click();
  await a.getByRole('heading', { name: 'Tạm dừng' }).waitFor();
  const goals = await a
    .getByRole('list', { name: 'Mục tiêu hôm nay' })
    .getByRole('listitem')
    .count();
  t.check('two daily goals on the HUD', goals === 2, `${goals}`);
  await play(a);

  await hb(a, (h) => h.give('spear', 1)); // slot 1 = hotbar key 1
  await setTime(a, NIGHT);
  await a.getByText(/sói đã ra ngoài/).waitFor({ timeout: 20000 });
  t.check('nightfall warns about wolves', true);

  await walk(a, OUT_NORTH, { x: 0, z: -38 });
  let wolf = null;
  for (let i = 0; i < 80 && !wolf; i++) {
    wolf = await hostileWolf(a);
    if (!wolf) await a.waitForTimeout(500);
    // Wolves roam a wide area; if none wandered close in 10 s, bring the nearest one over.
    if (!wolf && i === 20) await hb(a, (h) => h.summon('wolf'));
  }
  t.check('a wolf comes for you in the north woods at night', !!wolf);
  if (wolf) {
    await hb(a, (h, p) => h.walkTo([], p), wolf);
    await a.waitForTimeout(400);
    await t.shot(a, 'p6-wolf');
    // Fight it with the spear until it drops, or we do (alone that means waking up at home).
    for (let i = 0; i < 40; i++) {
      const w = await hb(a, (h, id) => h.getSession().room.state.creatures.get(id), wolf.id);
      const pos = await me(a);
      if (!w.present || w.mode === 'dead' || Math.hypot(pos.x, pos.z) < 6) break;
      await hb(a, (h, p) => h.walkTo([], p), { x: w.x, z: w.z });
      await a.waitForTimeout(150);
      await a.mouse.down();
      await a.mouse.up();
      await a.waitForTimeout(600);
    }
  }

  // Home (or already there after dying), then bed.
  const pos = await me(a);
  if (Math.hypot(pos.x, pos.z) > 6) await walk(a, FRONT_DOOR);
  await walk(a, TO_BED, BED);
  await prompt(a, 'Ngủ').waitFor();
  await a.keyboard.press('KeyE');
  await a.getByText(/Đã vượt qua ngày 1/).waitFor({ timeout: 20000 });
  t.check('morning summary card after sleeping', true);
  await t.shot(a, 'p6-summary');
  t.check(
    'day 2 brings fresh goals',
    (await a.getByRole('list', { name: 'Mục tiêu hôm nay' }).getByRole('listitem').count()) === 2,
  );

  await a.context().close();
}
