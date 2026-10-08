// Profiling snapshot: draw calls, triangles and FPS indoors, outdoors by day and at night.
// Headless Chrome renders in software, so FPS here is a floor, not what a real GPU gets.
import { hb, play, setTime, walk } from './lib.mjs';

const BUDGET = { calls: 250, triangles: 250_000 };

export default async function perf(t) {
  const a = await t.openPlayer('A');
  await a.getByText('Máy chủ sẵn sàng').waitFor();
  await a.getByLabel('Tên của bạn').fill('An');
  await a.getByRole('button', { name: 'Xây nhà mới' }).click();
  await a.getByRole('button', { name: 'Bắt đầu chơi' }).click();
  await a.getByRole('heading', { name: 'Tạm dừng' }).waitFor();
  await play(a);

  const measure = async (label) => {
    const p = await hb(a, (h) => h.perf());
    const ok = p.calls <= BUDGET.calls && p.triangles <= BUDGET.triangles;
    t.check(
      `${label} within budget`,
      ok,
      `${p.calls} draw calls, ${p.triangles} triangles, ${p.geometries} geometries, ${p.fps} fps (software)`,
    );
  };

  await measure('indoors');
  await walk(
    a,
    [
      { x: 0, z: 3 },
      { x: 0, z: 6 },
      { x: 0, z: 8 },
      { x: 22, z: 1 },
    ],
    { x: 40, z: -2 },
  );
  await measure('meadow by day');
  await setTime(a, 0.9);
  await a.waitForTimeout(500);
  await measure('meadow at night');
  await a.context().close();
}
