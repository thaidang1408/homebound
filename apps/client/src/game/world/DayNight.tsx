import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Fog,
  type DirectionalLight,
  type HemisphereLight,
  type Points,
  type PointsMaterial,
} from 'three';
import { useSession } from '../../state/session';
import { PALETTE } from './palette';

/** Time of day shown behind the menus (no room yet). */
const MENU_TIME = 0.42;

interface Key {
  t: number;
  sky: Color;
  sun: number;
  hemi: number;
  fogNear: number;
  fogFar: number;
  stars: number;
}

const key = (
  t: number,
  sky: string,
  sun: number,
  hemi: number,
  fogNear: number,
  fogFar: number,
  stars: number,
): Key => ({
  t,
  sky: new Color(sky),
  sun,
  hemi,
  fogNear,
  fogFar,
  stars,
});

/**
 * Keyframes over the day (0 = midnight). Night is dark enough for tension but never pitch black:
 * at night the "sun" light becomes a cool moon and the hemisphere keeps a moonlit floor, so
 * players can still find their way home. `sun` = intensity of that sun/moon light.
 */
const KEYS: readonly Key[] = [
  key(0.0, PALETTE.skyNight, 0.45, 0.55, 6, 45, 1),
  key(0.2, PALETTE.skyNight, 0.45, 0.55, 6, 45, 1),
  key(0.27, PALETTE.skyDawn, 0.6, 0.6, 15, 80, 0),
  // By day you see far: the landmarks out in the wilds show from the ridge (Phase 12).
  key(0.36, PALETTE.sky, 1.6, 0.9, 40, 170, 0),
  key(0.66, PALETTE.sky, 1.6, 0.9, 40, 170, 0),
  key(0.76, PALETTE.skyDusk, 0.6, 0.6, 15, 80, 0.2),
  key(0.84, PALETTE.skyNight, 0.45, 0.55, 6, 45, 1),
  key(1.0, PALETTE.skyNight, 0.45, 0.55, 6, 45, 1),
];

const SUN_DISTANCE = 60;
const STAR_COUNT = 400;
const STAR_RADIUS = 140;

function stars(): BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    // Golden-angle spiral over the upper hemisphere: even spread, no randomness needed.
    const y = 0.15 + 0.85 * (i / STAR_COUNT);
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.399963;
    positions.push(Math.cos(a) * r * STAR_RADIUS, y * STAR_RADIUS, Math.sin(a) * r * STAR_RADIUS);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return g;
}

// Scratch objects mutated every frame. Module-level: there is one sky per page, and keeping them
// out of React hooks means no per-frame allocations and nothing React needs to track.
const sky = new Color(PALETTE.sky);
const fog = new Fog(PALETTE.sky, 30, 120);
const daySky = new Color(PALETTE.hemiSky);
const moonSky = new Color(PALETTE.moonlight);
const sunColor = new Color(PALETTE.sun);

/** Sun, moonlit ambient, sky color, fog and stars, driven by the server's time of day. */
export function DayNight() {
  const { room } = useSession();
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const starMaterial = useRef<PointsMaterial>(null);
  const starField = useRef<Points>(null);
  const starGeometry = useMemo(() => stars(), []);

  useFrame(({ scene, camera }) => {
    // The sky goes with you: stars stay far away wherever you walk.
    starField.current?.position.copy(camera.position);
    const t = room ? room.state.timeOfDay : MENU_TIME;
    const i = Math.max(0, KEYS.findIndex((k) => k.t > t) - 1);
    const a = KEYS[i];
    const b = KEYS[i + 1] ?? a;
    if (!a || !b) return;
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
    const mix = (x: number, y: number) => x + (y - x) * f;

    sky.copy(a.sky).lerp(b.sky, f);
    scene.background = sky;
    fog.color.copy(sky);
    fog.near = mix(a.fogNear, b.fogNear);
    fog.far = mix(a.fogFar, b.fogFar);
    scene.fog = fog;

    if (sun.current) {
      // The sun travels east → overhead → west between sunrise and sunset.
      const angle = (t - 0.25) * Math.PI * 2;
      const isDay = t > 0.23 && t < 0.79;
      sun.current.color.copy(isDay ? sunColor : moonSky);
      sun.current.position.set(
        Math.cos(angle) * SUN_DISTANCE,
        Math.max(5, Math.sin(angle) * SUN_DISTANCE),
        18,
      );
      sun.current.intensity = mix(a.sun, b.sun);
    }
    const night = mix(a.stars, b.stars);
    if (hemi.current) {
      hemi.current.intensity = mix(a.hemi, b.hemi);
      hemi.current.color.copy(daySky).lerp(moonSky, night); // warm by day, moonlit blue at night
    }
    if (starMaterial.current) starMaterial.current.opacity = night;
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[PALETTE.hemiSky, PALETTE.hemiGround, 0.9]} />
      <directionalLight ref={sun} color={PALETTE.sun} intensity={1.6} />
      <points ref={starField} geometry={starGeometry}>
        <pointsMaterial
          ref={starMaterial}
          color={PALETTE.star}
          size={1.4}
          sizeAttenuation={false}
          transparent
          opacity={0}
          fog={false}
          depthWrite={false}
        />
      </points>
    </>
  );
}
