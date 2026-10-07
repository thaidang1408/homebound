// Phase 3: out of the front door, down the road, chop a tree (hold E), dusk and night atmosphere.
import {
  PLAYER_RADIUS,
  RESOURCE_KINDS,
  RESOURCE_NODES,
  ROAD,
  WORLD_COLLIDERS,
  collides,
} from '@homebound/shared';
import { countItem, myPlayer, play, prompt, roomOf, setTime, walk } from './lib.mjs';

const clearLine = (a, b) => {
  for (let t = 0; t <= 1; t += 0.05) {
    const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    if (collides(p, PLAYER_RADIUS + 0.05, WORLD_COLLIDERS)) return false;
  }
  return true;
};

/** The tree nearest the road that you can walk straight to from it. */
function treeByTheRoad() {
  const pick = RESOURCE_NODES.filter(
    (n) => n.kind === 'tree' && n.z > ROAD.fromZ + 2 && n.z < ROAD.toZ,
  )
    .map((n) => {
      const side = Math.sign(n.x) || 1;
      const stand = { x: n.x - side * (RESOURCE_KINDS.tree.reachHalf * n.scale + 0.6), z: n.z };
      return { node: n, stand, road: { x: 0, z: n.z } };
    })
    .filter((c) => clearLine(c.road, c.stand) && clearLine({ x: 0, z: 6 }, c.road))
    .sort((a, b) => Math.abs(a.node.x) - Math.abs(b.node.x))[0];
  if (!pick) throw new Error('no reachable tree by the road');
  return pick;
}

export default async function outdoors(t) {
  const a = await t.openPlayer('A');
  await a.getByText('Server online').waitFor();
  await a.getByLabel('Your name').fill('An');
  await a.getByRole('button', { name: 'Build a new home' }).click();
  await a.getByRole('button', { name: 'Start game' }).click();
  await a.getByText('Paused').waitFor();
  t.check('home code', true, await roomOf(a));
  await play(a);

  const tree = treeByTheRoad();
  await walk(a, [{ x: 0, z: 3 }, { x: 0, z: 6 }, tree.road], { x: 0, z: 60 });
  await t.shot(a, 'p3-road');
  await walk(a, [tree.stand], tree.node);
  await prompt(a, 'Chop wood').waitFor();
  t.check('prompt at a tree', true, tree.node.id);

  await a.keyboard.down('KeyE');
  await a
    .getByText(/\+1 🪵 Wood/)
    .first()
    .waitFor();
  await a.waitForTimeout(1800);
  await a.keyboard.up('KeyE');
  const wood = countItem((await myPlayer(a)).items, 'wood');
  t.check('holding E keeps chopping', wood >= 2, `${wood} wood`);
  await t.shot(a, 'p3-chopping');

  await setTime(a, 0.745);
  await a.getByText(/sun is setting/).waitFor({ timeout: 20000 });
  t.check('dusk warns to head home', true);
  await t.shot(a, 'p3-dusk');
  await setTime(a, 0.95);
  await a.waitForTimeout(800);
  await t.shot(a, 'p3-night');
  t.check('the HUD clock shows night', (await a.getByText('🌙', { exact: false }).count()) > 0);

  await a.context().close();
}
