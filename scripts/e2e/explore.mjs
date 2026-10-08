// Phase 12: out through a pass in the ridge to the wilds; discover landmarks (their waystones
// light), loot a cache, climb the watchtower, mark the shared map, travel home by waystone.
import { hb, play, prompt, walk } from './lib.mjs';

const at = (page) =>
  hb(page, (h) => {
    const { room } = h.getSession();
    const me = room.state.players.get(room.sessionId);
    return { x: me.x, z: me.z };
  });

/** Dev jump (the wilds are a long walk at headless frame rates), then turn to face `lookAt`. */
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
  await walk(page, [await at(page)], lookAt);
  await page.waitForTimeout(400);
}

const LANDMARK_VIEWS = [
  // [where to stand, what to look at, screenshot]
  [{ x: -3, z: -73.5 }, { x: 0, z: -82 }, 'p12-giant-tree'],
  [{ x: 73, z: 4 }, { x: 82, z: 4 }, 'p12-cave'],
  [{ x: 7, z: 61 }, { x: 14, z: 68 }, 'p12-camp'],
  [{ x: -71, z: -6 }, { x: -80, z: -6 }, 'p12-watchtower'],
  [{ x: 43, z: -59 }, { x: 50, z: -66 }, 'p12-shrine'],
];

export default async function explore(t) {
  const a = await t.openPlayer('A');
  await a.getByText('Máy chủ sẵn sàng').waitFor();
  await a.getByLabel('Tên của bạn').fill('Na');
  await a.getByRole('button', { name: 'Xây nhà mới' }).click();
  await a.getByRole('button', { name: 'Bắt đầu chơi' }).click();
  await a.getByRole('heading', { name: 'Tạm dừng' }).waitFor();
  await play(a);

  // From the north pass in the ridge, the giant tree stands over the Deep Forest.
  await jump(a, 0, -54, { x: 0, z: -82 });
  await t.shot(a, 'p12-north-pass');
  const perf = await hb(a, (h) => h.perf());
  t.check(
    `frame budget looking out over the wilds (${perf.calls} calls, ${perf.triangles} tris)`,
    perf.calls <= 250 && perf.triangles <= 250_000,
  );

  for (const [stand, look, shot] of LANDMARK_VIEWS) {
    await jump(a, stand.x, stand.z, look);
    await t.shot(a, shot);
  }
  await a.waitForFunction(() => window.__homebound.getSession().room.state.discovered.size === 5);
  t.check('walking up to each landmark discovers it (5/5)', true);

  // Echo Cave: the cache inside.
  await jump(a, 82.4, 4, { x: 84, z: 4 });
  await prompt(a, 'Mở hòm báu').waitFor();
  await a.keyboard.press('KeyE');
  await a.waitForFunction(() => window.__homebound.getSession().room.state.caches.has('cave'));
  await prompt(a, 'Trống rồi').waitFor();
  t.check('a cache gives its loot once, then waits for the morning', true);

  // The watchtower maps the land around it.
  const before = await hb(a, (h) => h.getSession().room.state.explored.size);
  await jump(a, -78, -6, { x: -80, z: -6 });
  await prompt(a, 'Leo lên').waitFor();
  await a.keyboard.press('KeyE');
  await a.waitForFunction(
    (n) => window.__homebound.getSession().room.state.explored.size > n + 40,
    before,
  );
  t.check('climbing the watchtower reveals the map far around it', true);

  // The shared map: open it, mark a spot.
  await a.keyboard.press('KeyM');
  const map = a.getByLabel('Bản đồ thế giới');
  const box = await map.boundingBox();
  await map.click({ position: { x: box.width * 0.7, y: box.height * 0.3 } });
  await a.waitForFunction(() => window.__homebound.getSession().room.state.markers.size === 1);
  t.check('[M] opens the shared map; a click marks a spot', true);
  await a.waitForTimeout(500);
  await t.shot(a, 'p12-map');
  await a.keyboard.press('KeyM');
  await play(a);

  // Waystone home.
  await jump(a, 73.6, 4, { x: 75, z: 4 });
  await prompt(a, 'Đi tới đá dịch chuyển').waitFor();
  await a.keyboard.press('KeyE');
  await a.getByRole('button', { name: /Nhà/ }).click();
  await a.waitForFunction(() => {
    const { room } = window.__homebound.getSession();
    const me = room.state.players.get(room.sessionId);
    return Math.hypot(me.x - 7, me.z - 7) < 2.5;
  });
  t.check('a lit waystone takes you home', true);
  await a.context().close();
}
