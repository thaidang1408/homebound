// Phase 4: walk to the meadow, a boar charges, punch it down, butcher it for meat.
import { countItem, hb, myPlayer, play, prompt, setTime, walk } from './lib.mjs';

const TO_MEADOW = [
  { x: 0, z: 3 },
  { x: 0, z: 6 },
  { x: 0, z: 8 },
  { x: 30, z: -2 },
];
const HOSTILE = ['alert', 'chase', 'attack', 'hurt'];

/** The first boar that has noticed us, with its live position and mode. */
const hostileBoar = (page) =>
  hb(
    page,
    (h, hostile) => {
      const { room } = h.getSession();
      for (const [id, c] of room.state.creatures) {
        if (c.present && hostile.includes(c.mode)) return { id, x: c.x, z: c.z, mode: c.mode };
      }
      return null;
    },
    HOSTILE,
  );

const boarById = (page, id) =>
  hb(
    page,
    (h, boarId) => {
      const c = h.getSession().room.state.creatures.get(boarId);
      return { x: c.x, z: c.z, mode: c.mode, present: c.present, health: c.health };
    },
    id,
  );

const face = (page, target) => hb(page, (h, p) => h.walkTo([], p), target);

export default async function hunting(t) {
  const a = await t.openPlayer('A');
  await a.getByText('Máy chủ sẵn sàng').waitFor();
  await a.getByLabel('Tên của bạn').fill('An');
  await a.getByRole('button', { name: 'Xây nhà mới' }).click();
  await a.getByRole('button', { name: 'Bắt đầu chơi' }).click();
  await a.getByRole('heading', { name: 'Tạm dừng' }).waitFor();
  t.check('HUD shows health', (await a.getByText('❤️ Máu').count()) === 1);
  await play(a);
  await setTime(a, 0.5);

  await walk(a, TO_MEADOW, { x: 40, z: -2 });
  let boar = null;
  for (let i = 0; i < 60 && !boar; i++) {
    boar = await hostileBoar(a);
    if (!boar) await a.waitForTimeout(500);
  }
  t.check('a boar notices you in the meadow', !!boar, boar?.mode);
  if (!boar) return;
  await face(a, boar);
  await a.waitForTimeout(300);
  await t.shot(a, 'p4-boar-charging');

  let sawPrompt = false;
  let hurt = false;
  for (let i = 0; i < 80; i++) {
    const b = await boarById(a, boar.id);
    if (b.mode === 'dead') break;
    await face(a, b);
    await a.waitForTimeout(120);
    sawPrompt ||= (await prompt(a, 'Đấm heo rừng').count()) > 0;
    await a.mouse.down();
    await a.mouse.up();
    if (b.health < 40 && !hurt) {
      hurt = true;
      await t.shot(a, 'p4-fight');
    }
    await a.waitForTimeout(400);
  }
  const dead = await boarById(a, boar.id);
  t.check('crosshair shows "Click Punch boar"', sawPrompt);
  t.check('the boar goes down', dead.mode === 'dead', `mode ${dead.mode}`);
  await a.getByText(/Heo rừng gục rồi!/).waitFor();

  await face(a, dead);
  await prompt(a, 'Xẻ thịt heo rừng').waitFor();
  await t.shot(a, 'p4-carcass');
  const before = countItem((await myPlayer(a)).items, 'raw_meat');
  await a.keyboard.press('KeyE');
  await a.waitForFunction(
    (id) => !window.__homebound.getSession().room.state.creatures.get(id).present,
    boar.id,
  );
  const meat = countItem((await myPlayer(a)).items, 'raw_meat') - before;
  t.check('butchering gives raw meat', meat >= 2, `+${meat}`);
  const health = await hb(a, (h) => {
    const { room } = h.getSession();
    return room.state.players.get(room.sessionId).health;
  });
  t.check('still standing after the fight', health > 0, `health ${health}`);

  await a.context().close();
}
