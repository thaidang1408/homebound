// Phase 11: an egg set down in the yard hatches into a fantasy pet; name it and give it orders;
// befriend a wild unicorn foal by feeding it berries from your hand.
import { hb, play, prompt, walk } from './lib.mjs';

/** Out the front door into the yard; the egg goes down a step ahead (back toward the house). */
const FRONT_YARD = [
  { x: 0, z: 3 },
  { x: 0, z: 6 },
  { x: 0, z: 9 },
];
/** Down the road toward the clearing, where the unicorn foal lives. */
const DOWN_THE_ROAD = [
  { x: 0, z: 18 },
  { x: 0, z: 30 },
];

const firstPet = (page, kind) =>
  page.waitForFunction(
    (k) => {
      const { room } = window.__homebound.getSession();
      return [...room.state.pets.values()].some((p) => p.kind === k);
    },
    kind,
    { timeout: 70000 },
  );

export default async function pets(t) {
  const a = await t.openPlayer('A');
  await a.getByText('Server online').waitFor();
  await a.getByLabel('Your name').fill('Na');
  await a.getByRole('button', { name: 'Build a new home' }).click();
  await a.getByRole('button', { name: 'Start game' }).click();
  await a.getByText('Paused').waitFor();
  await play(a);

  // --- an egg, set down in the yard ---
  await hb(a, (h) => h.give('pet_egg', 1));
  await walk(a, FRONT_YARD, { x: 0, z: 0 });
  await a.keyboard.press('Digit1');
  await a.mouse.down();
  await a.mouse.up();
  await a.waitForFunction(() => window.__homebound.getSession().room.state.pets.size === 1);
  t.check('left click with an egg sets it down in the yard', true);
  await prompt(a, 'Egg hatching').waitFor();
  await t.shot(a, 'p11-egg');
  // Toasts last ~2.6 s: wait for the toast itself (it shows on the same patch as the hatch).
  await a.getByText('Your egg hatched').waitFor({ timeout: 70000 });
  t.check('the egg hatches into a pet (toast)', true);
  await t.shot(a, 'p11-hatched');

  // --- talk to it: name and orders ---
  await prompt(a, 'Talk to').waitFor({ timeout: 10000 });
  await a.keyboard.press('KeyE');
  await a.getByRole('button', { name: 'Stay here' }).waitFor();
  await a.getByLabel('Name').fill('Đốm');
  await a.getByRole('button', { name: 'Rename' }).click();
  await a.getByRole('button', { name: 'Stay here' }).click();
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    const [p] = [...room.state.pets.values()];
    return p.name === 'Đốm' && p.order === 'stay';
  });
  t.check('the pet panel renames it and tells it to stay', true);
  await t.shot(a, 'p11-pet-panel');
  await a.getByRole('button', { name: 'Follow me' }).click();
  await a.getByRole('button', { name: 'Back to game' }).click();
  await play(a);

  // --- a wild unicorn foal, befriended with berries ---
  await hb(a, (h) => h.give('berries', 3));
  await walk(a, DOWN_THE_ROAD, { x: 0, z: 40 });
  const slot = await hb(a, (h) => {
    const { room } = h.getSession();
    return [...room.state.players.get(room.sessionId).inventory].findIndex(
      (s) => s.itemId === 'berries',
    );
  });
  await a.keyboard.press(`Digit${slot + 1}`);
  await hb(a, (h) => h.summon('unicorn', { x: 0, z: 31.4 }));
  await prompt(a, 'Feed berries').waitFor({ timeout: 10000 });
  t.check('holding its favorite food, the wild foal can be fed', true);
  for (let i = 0; i < 3; i++) {
    await a.keyboard.press('KeyE');
    await a.waitForTimeout(300);
  }
  await a.getByText('is your friend now').waitFor({ timeout: 15000 });
  await firstPet(a, 'unicorn');
  t.check('fed three times, the unicorn foal becomes your pet', true);
  await a.waitForTimeout(600);
  await t.shot(a, 'p11-unicorn');
  const following = await a.waitForFunction(
    () => {
      const { room } = window.__homebound.getSession();
      const me = room.state.players.get(room.sessionId);
      const pet = [...room.state.pets.values()].find((p) => p.name === 'Đốm');
      return pet && Math.hypot(pet.x - me.x, pet.z - me.z) < 3;
    },
    null,
    { timeout: 20000 },
  );
  t.check('the first pet followed you down the road', !!following);
  await a.context().close();
}
