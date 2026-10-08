// Phase 13: chapter 1 in the browser — wake Đốm, bring it wood and mushrooms, find the Giant
// Tree, light its great lantern, come home; the journal gets its first page.
import { hb, play, prompt, walk } from './lib.mjs';

/** Into the kitchen, facing Đốm on the table. */
const TO_DOM = [
  { x: -1.2, z: 1.8 },
  { x: -3.5, z: 1.8 },
  { x: -3.5, z: -1.2 },
  { x: -2.5, z: -1.4 },
];
const DOM = { x: -2.5, z: -2.5 };
/** Next to the Giant Tree's great lantern (the tree is at 0, −82; the lantern 2.5 m off it). */
const LANTERN = { x: -2.5, z: -79.5 };

const tracker = (page) => page.getByRole('status').filter({ hasText: 'Chương' });

async function jump(page, x, z, lookAt) {
  await hb(page, (h, p) => h.teleport(p.x, p.z), { x, z });
  await page.waitForFunction(
    (p) => {
      const { room } = window.__homebound.getSession();
      const me = room.state.players.get(room.sessionId);
      return Math.hypot(me.x - p.x, me.z - p.z) < 0.3;
    },
    { x, z },
  );
  await walk(page, [{ x, z }], lookAt);
}

const talkToDom = async (page) => {
  await prompt(page, 'Nói chuyện với Đốm').waitFor();
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: 'OK!' }).waitFor();
};

export default async function story(t) {
  const a = await t.openPlayer('A');
  await a.getByText('Máy chủ sẵn sàng').waitFor();
  await a.getByLabel('Tên của bạn').fill('Na');
  await a.getByRole('button', { name: 'Xây nhà mới' }).click();
  await a.getByRole('button', { name: 'Bắt đầu chơi' }).click();
  await a.getByRole('heading', { name: 'Tạm dừng' }).waitFor();
  await play(a);
  await tracker(a).filter({ hasText: 'Nói chuyện với Đốm' }).waitFor();
  t.check('the quest tracker says what to do first', true);

  await walk(a, TO_DOM, DOM);
  await talkToDom(a);
  await a.getByText('Tớ là Đốm').waitFor();
  t.check('Đốm wakes up and asks for help', true);
  await t.shot(a, 'p13-dom');
  await a.getByRole('button', { name: 'OK!' }).click();
  await play(a);
  await tracker(a).filter({ hasText: 'Mang cho Đốm' }).waitFor();

  await hb(a, (h) => {
    h.give('wood', 5);
    h.give('mushroom', 2);
  });
  await tracker(a).filter({ hasText: '🍄 2/2' }).waitFor();
  await talkToDom(a);
  await a.getByRole('button', { name: 'OK!' }).click();
  await play(a);
  await tracker(a).filter({ hasText: 'Cây Khổng Lồ' }).waitFor();
  t.check('bringing wood and mushrooms sends you to the Giant Tree', true);

  await jump(a, LANTERN.x + 1.2, LANTERN.z + 1, { x: LANTERN.x, z: LANTERN.z + 0.6 });
  await tracker(a).filter({ hasText: 'Thắp đèn lồng lớn' }).waitFor();
  await prompt(a, 'Thắp đèn lồng lớn').waitFor();
  await a.keyboard.press('KeyE');
  await a.waitForFunction(() =>
    window.__homebound.getSession().room.state.lanterns.has('giant-tree'),
  );
  t.check('the great lantern is lit at the Giant Tree', true);
  await a.waitForTimeout(500);
  await t.shot(a, 'p13-lantern');

  await jump(a, -2.5, -1.4, DOM);
  await talkToDom(a);
  await a.getByRole('button', { name: 'OK!' }).click();
  await a.waitForFunction(() => window.__homebound.getSession().room.state.quest.chapter === 1);
  await play(a);
  await tracker(a).filter({ hasText: 'Chương 2' }).waitFor();
  t.check('telling Đốm ends chapter 1; chapter 2 begins', true);

  await a.keyboard.press('KeyJ');
  await a.getByText('Ngày đầu ở căn nhà gỗ').waitFor();
  t.check('[J] shows grandpa’s first journal page', true);
  await t.shot(a, 'p13-journal');
  await a.context().close();
}
