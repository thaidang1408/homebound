// Solo start, saving, "Continue home", and a partner dropping in later.
import { countItem, myPlayer, play, prompt, roomOf, walk } from './lib.mjs';

const CHEST = { x: -5.3, z: 3.0 };

export default async function soloSave(t) {
  const a = await t.openPlayer('A');
  await a.getByText('Máy chủ sẵn sàng').waitFor();
  await a.getByLabel('Tên của bạn').fill('An');
  await a.getByRole('button', { name: 'Xây nhà mới' }).click();
  await a.getByText(/có thể vào bất cứ lúc nào/).waitFor();
  t.check(
    'alone in the lobby, no ready needed',
    !(await a.getByRole('button', { name: 'Tớ sẵn sàng' }).isVisible()),
  );
  await a.getByRole('button', { name: 'Bắt đầu chơi' }).click();
  await a.getByRole('heading', { name: 'Tạm dừng' }).waitFor();
  const code = await roomOf(a);
  t.check('solo player enters the game', true, code);
  await a.getByText(`Ở nhà một mình — gửi mã nhà ${code}`).waitFor();

  await play(a);
  await walk(a, [{ x: -4.3, z: 2.9 }], CHEST);
  await prompt(a, 'Mở rương chung').waitFor();
  await a.keyboard.press('KeyE');
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
  const carried = countItem((await myPlayer(a)).items, 'raw_meat');
  await a.keyboard.press('Escape');

  // Leave through the pause menu: the home is saved when the last player leaves.
  await a.evaluate(() => document.exitPointerLock());
  await a.getByRole('button', { name: 'Rời nhà' }).click();
  await a.getByRole('button', { name: `Về nhà cũ ${code}` }).waitFor();
  t.check('landing offers to continue the last home', true);
  await a.waitForTimeout(500);

  await a.getByRole('button', { name: `Về nhà cũ ${code}` }).click();
  await a.getByRole('heading', { name: 'Tạm dừng' }).waitFor();
  const back = await myPlayer(a);
  t.check(
    'items are still in the backpack after re-opening',
    countItem(back.items, 'raw_meat') === carried,
    `${carried}`,
  );

  const b = await t.openPlayer('B');
  await b.getByLabel('Tên của bạn').fill('Binh');
  await b.getByLabel('Mã nhà').fill(code);
  // Toasts are brief: start watching before B arrives.
  const cameHome = a.getByText('Binh đã về nhà').waitFor();
  await b.getByRole('button', { name: 'Vào nhà' }).click();
  await b.getByRole('heading', { name: 'Tạm dừng' }).waitFor();
  t.check('partner drops into the running home', true);
  await cameHome;
  t.check('A is told the partner came home', true);
  await t.shot(a, 'p2-partner-came-home');

  await a.context().close();
  await b.context().close();
}
