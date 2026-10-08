// Phase 5: craft weapons at the workbench, go down, get revived by the partner, shoot the bow.
import { countItem, hb, myPlayer, play, prompt, startPair, walk } from './lib.mjs';

const WORKBENCH = { x: 5.2, z: 3.0 };
const A_TO_WORKBENCH = [{ x: 4.2, z: 3.0 }];

const give = (page, itemId, qty) => hb(page, (h, a) => h.give(a.itemId, a.qty), { itemId, qty });
const me = (page) =>
  hb(page, (h) => {
    const { room } = h.getSession();
    const p = room.state.players.get(room.sessionId);
    return { health: p.health, downed: p.downed, x: p.x, z: p.z };
  });

export default async function combat(t) {
  const a = await t.openPlayer('A');
  const b = await t.openPlayer('B');
  await startPair(a, b);
  await play(a);
  await play(b);

  // --- Crafting ---
  await give(a, 'wood', 8);
  await give(a, 'stone', 3);
  await walk(a, A_TO_WORKBENCH, WORKBENCH);
  await prompt(a, 'Chế tạo').waitFor();
  await a.keyboard.press('KeyE');
  await a.getByText('Bàn chế tạo').waitFor();
  for (const name of ['Giáo', 'Cung', 'Mũi tên ×5']) {
    await a
      .getByRole('listitem')
      .filter({ has: a.getByText(name, { exact: true }) })
      .getByRole('button')
      .click();
  }
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    const inv = [...room.state.players.get(room.sessionId).inventory];
    return ['spear', 'bow', 'arrow'].every((id) => inv.some((s) => s.itemId === id));
  });
  await t.shot(a, 'p5-workbench');
  const items = (await myPlayer(a)).items;
  t.check(
    'crafted a spear, a bow and arrows',
    countItem(items, 'spear') === 1 && countItem(items, 'bow') === 1,
    `${countItem(items, 'arrow')} arrows`,
  );
  await a.keyboard.press('Escape');
  await play(a);

  // --- Downed and revive ---
  await hb(b, (h) => h.hurt(200));
  await b.getByText('Bạn bị gục rồi!').first().waitFor();
  await a.getByText(/bị gục! Đứng gần và giữ E/).waitFor();
  t.check('B goes down; A is told to help', true);
  await t.shot(b, 'p5-downed');

  const bPos = await me(b);
  await walk(
    a,
    [
      { x: 2.5, z: 2.0 },
      { x: bPos.x + 0.6, z: bPos.z - 0.4 },
    ],
    bPos,
  );
  await prompt(a, 'cứu').waitFor();
  await a.keyboard.down('KeyE');
  await a.waitForTimeout(800);
  await t.shot(a, 'p5-reviving');
  await b.getByText('Bạn đứng dậy rồi!').waitFor({ timeout: 15000 });
  await a.keyboard.up('KeyE');
  const revived = await me(b);
  t.check(
    'A holds E and revives B',
    !revived.downed && revived.health > 0,
    `health ${revived.health}`,
  );

  // --- Weapons in hand ---
  const slotOf = (id) =>
    hb(
      a,
      (h, itemId) => {
        const { room } = h.getSession();
        return [...room.state.players.get(room.sessionId).inventory].findIndex(
          (s) => s.itemId === itemId,
        );
      },
      id,
    );
  const bowSlot = await slotOf('bow');
  await a.keyboard.press(`Digit${bowSlot + 1}`);
  await walk(a, [{ x: 1.2, z: 2.0 }], { x: 1.2, z: -10 });
  const before = countItem((await myPlayer(a)).items, 'arrow');
  await a.mouse.down();
  await a.mouse.up();
  await a.waitForTimeout(60);
  await t.shot(a, 'p5-bow-shot');
  await a.waitForFunction((n) => {
    const { room } = window.__homebound.getSession();
    const inv = [...room.state.players.get(room.sessionId).inventory];
    return inv.filter((s) => s.itemId === 'arrow').reduce((k, s) => k + s.qty, 0) === n - 1;
  }, before);
  t.check('shooting the bow uses an arrow', true);

  const spearSlot = await slotOf('spear');
  await a.keyboard.press(`Digit${spearSlot + 1}`);
  await a.mouse.down();
  await a.mouse.up();
  await a.waitForTimeout(100);
  await t.shot(a, 'p5-spear');

  await a.context().close();
  await b.context().close();
}
