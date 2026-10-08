import { useEffect, useRef } from 'react';
import {
  BIOMES,
  ClientMessage,
  HOME_WAYSTONE,
  HOUSE_HALF_DEPTH,
  HOUSE_HALF_WIDTH,
  LANDMARKS,
  MAP_CELL,
  MAP_CELLS,
  ROAD,
  TRAIL_HALF_WIDTH,
  WAYSTONES,
  WORLD_RADIUS,
  biomeAt,
  cellCenter,
  inLake,
  trailDistance,
  type HomeState,
} from '@homebound/shared';
import type { Room } from '@colyseus/sdk';
import { playerColor } from '../../game/player/playerColors';
import { PALETTE } from '../../game/world/palette';
import { useSession } from '../../state/session';
import { useUi } from '../../state/ui';
import panel from '../components/Panel.module.css';
import { Button } from '../components/Button';
import { closePanel } from '../hud/useGameKeys';
import styles from './MapPanel.module.css';

/** Canvas pixels across the whole world. */
const MAP_PX = 400;
const SCALE = MAP_PX / (WORLD_RADIUS * 2);
const REDRAW_MS = 400;

const toPx = (v: number) => (v + WORLD_RADIUS) * SCALE;

/** The land itself (biomes, lake, trails, house), drawn once: it never changes. */
let land: ImageData | null = null;
function drawLand(ctx: CanvasRenderingContext2D): ImageData {
  if (land) return land;
  const image = ctx.createImageData(MAP_PX, MAP_PX);
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const colors = {
    ...Object.fromEntries(Object.entries(BIOMES).map(([id, b]) => [id, rgb(b.ground)])),
    water: rgb(PALETTE.water),
    road: rgb(PALETTE.road),
    house: rgb(PALETTE.roof),
    edge: rgb(PALETTE.skyNight),
  } as Record<string, number[]>;
  for (let py = 0; py < MAP_PX; py++) {
    for (let px = 0; px < MAP_PX; px++) {
      const x = px / SCALE - WORLD_RADIUS;
      const z = py / SCALE - WORLD_RADIUS;
      const p = { x, z };
      let key: string = biomeAt(x, z);
      if (Math.hypot(x, z) > WORLD_RADIUS) key = 'edge';
      else if (Math.abs(x) < HOUSE_HALF_WIDTH && Math.abs(z) < HOUSE_HALF_DEPTH) key = 'house';
      else if (inLake(p)) key = 'water';
      else if (
        trailDistance(p) < TRAIL_HALF_WIDTH ||
        (Math.abs(x) < ROAD.halfWidth && z > ROAD.fromZ && z < ROAD.toZ)
      ) {
        key = 'road';
      }
      const [r = 0, g = 0, b = 0] = colors[key] ?? [];
      image.data.set([r, g, b, 255], (py * MAP_PX + px) * 4);
    }
  }
  land = image;
  return image;
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function draw(ctx: CanvasRenderingContext2D, room: Room<HomeState>): void {
  const s = room.state;
  ctx.putImageData(drawLand(ctx), 0, 0);
  // Fog of war over every cell nobody has seen yet.
  ctx.fillStyle = token('--color-night');
  const cell = MAP_CELL * SCALE;
  for (let i = 0; i < MAP_CELLS * MAP_CELLS; i++) {
    if (s.explored.has(String(i))) continue;
    const c = cellCenter(i);
    ctx.fillRect(toPx(c.x) - cell / 2, toPx(c.z) - cell / 2, cell + 0.5, cell + 0.5);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `16px ${token('--font-family')}`;
  for (const l of LANDMARKS) if (s.discovered.has(l.id)) ctx.fillText(l.icon, toPx(l.x), toPx(l.z));
  ctx.fillText('🏠', toPx(0), toPx(0));
  ctx.fillStyle = token('--color-stamina');
  for (const w of WAYSTONES) {
    if (w.id !== HOME_WAYSTONE.id && !s.discovered.has(w.landmark)) continue;
    ctx.fillRect(toPx(w.at.x) - 2.5, toPx(w.at.z) - 2.5, 5, 5);
  }
  ctx.font = `14px ${token('--font-family')}`;
  s.markers.forEach((m) => ctx.fillText('📍', toPx(m.x), toPx(m.z) - 6));
  // Players: a dot with a nose pointing where they look (yaw 0 = north, up the map).
  s.players.forEach((p, id) => {
    const x = toPx(p.x);
    const y = toPx(p.z);
    ctx.fillStyle = playerColor(p.slot);
    ctx.strokeStyle = token('--color-text');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, id === room.sessionId ? 6 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.sin(p.yaw) * 11, y - Math.cos(p.yaw) * 11);
    ctx.stroke();
  });
}

/** [M]: the shared map. Both players lift the fog; click to mark (or unmark) a spot. */
export function MapPanel() {
  const { room } = useSession();
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !room) return;
    draw(ctx, room);
    const timer = setInterval(() => draw(ctx, room), REDRAW_MS);
    return () => clearInterval(timer);
  }, [room]);

  if (!room) return null;
  const found = LANDMARKS.filter((l) => room.state.discovered.has(l.id));

  return (
    <div className={panel.overlay} onClick={closePanel}>
      <div className={`${panel.panel} ${styles.wide}`} onClick={(e) => e.stopPropagation()}>
        <h2 className={panel.title}>Map</h2>
        <p className={panel.subtitle}>
          Click to mark a spot for both of you (click it again to remove it). [M] to close.
        </p>
        <canvas
          ref={canvas}
          className={styles.map}
          width={MAP_PX}
          height={MAP_PX}
          aria-label="Map of the world"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * MAP_PX;
            const y = ((e.clientY - rect.top) / rect.height) * MAP_PX;
            room.send(ClientMessage.MapMark, {
              x: x / SCALE - WORLD_RADIUS,
              z: y / SCALE - WORLD_RADIUS,
            });
          }}
        />
        <p className={panel.subtitle}>
          {found.length === 0
            ? 'Nothing discovered yet — the trails lead out through the low passes in the ridge.'
            : `Discovered ${found.length}/${LANDMARKS.length}: ${found.map((l) => `${l.icon} ${l.name}`).join(' · ')}`}
        </p>
        <Button variant="secondary" onClick={closePanel}>
          Back to game
        </Button>
      </div>
    </div>
  );
}

/** [E] at a waystone: hop to any other lit one. */
export function TravelPanel() {
  const { room } = useSession();
  const { waystoneId } = useUi();
  if (!room) return null;
  const lit = WAYSTONES.filter(
    (w) => w.id !== waystoneId && (w.landmark === '' || room.state.discovered.has(w.landmark)),
  );
  return (
    <div className={panel.overlay} onClick={closePanel}>
      <div className={panel.panel} onClick={(e) => e.stopPropagation()}>
        <h2 className={panel.title}>Waystone</h2>
        <p className={panel.subtitle}>
          Lit waystones are linked. Discover a landmark to light its stone.
        </p>
        <div className={styles.trips}>
          {lit.length === 0 && <p className={panel.subtitle}>No other waystone is lit yet.</p>}
          {lit.map((w) => (
            <Button
              key={w.id}
              onClick={() => {
                room.send(ClientMessage.Travel, { to: w.id });
                closePanel();
              }}
            >
              {w.landmark ? (LANDMARKS.find((l) => l.id === w.landmark)?.icon ?? '') : '🏠'}{' '}
              {w.name}
            </Button>
          ))}
        </div>
        <Button variant="ghost" onClick={closePanel}>
          Stay here
        </Button>
      </div>
    </div>
  );
}
