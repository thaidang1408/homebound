import {
  OBSTACLE_HEIGHT,
  PLAYER_EYE_HEIGHT,
  PROJECTILE_GRAVITY,
  PROJECTILE_LIFETIME_MS,
  PROJECTILE_STEP,
  ProjectileState,
  WORLD_COLLIDERS,
  WORLD_RADIUS,
  collides,
  terrainHeight,
  type HomeState,
  type PlayerState,
  type RangedWeapon,
} from '@homebound/shared';
import { creatureAt, damageCreature, type HitOutcome } from './creatures.js';

/** Arrows are server-simulated (ADR-017): the client sends only the aim; the server decides hits. */

let nextId = 0;

/** Looses an arrow from the player's eyes along yaw/pitch (yaw 0 looks toward −Z). */
export function shoot(
  state: HomeState,
  shooterId: string,
  player: PlayerState,
  weapon: RangedWeapon,
  yaw: number,
  pitch: number,
): void {
  const p = new ProjectileState();
  const flat = Math.cos(pitch);
  p.x = player.x;
  p.z = player.z;
  p.y = terrainHeight(player.x, player.z) + PLAYER_EYE_HEIGHT;
  p.vx = -Math.sin(yaw) * flat * weapon.speed;
  p.vz = -Math.cos(yaw) * flat * weapon.speed;
  p.vy = Math.sin(pitch) * weapon.speed;
  p.damage = weapon.damage;
  p.owner = shooterId;
  state.projectiles.set(String(++nextId), p);
}

export interface ProjectileHit {
  owner: string;
  creatureId: string;
  outcome: HitOutcome;
}

/** Stopped by the ground, a tree/rock/wall or the world's edge. */
function blocked(x: number, y: number, z: number): boolean {
  if (y <= terrainHeight(x, z)) return true;
  if (Math.hypot(x, z) > WORLD_RADIUS) return true;
  return y < OBSTACLE_HEIGHT + terrainHeight(x, z) && collides({ x, z }, 0, WORLD_COLLIDERS);
}

/** Moves every arrow, sweeping in small steps; returns the creatures they hit. */
export function tickProjectiles(state: HomeState, dtMs: number): ProjectileHit[] {
  const hits: ProjectileHit[] = [];
  const dt = dtMs / 1000;
  for (const [id, p] of state.projectiles) {
    p.ageMs += dtMs;
    const speed = Math.hypot(p.vx, p.vy, p.vz);
    const steps = Math.max(1, Math.ceil((speed * dt) / PROJECTILE_STEP));
    const h = dt / steps;
    let done = p.ageMs > PROJECTILE_LIFETIME_MS;
    let { x, y, z } = p;
    for (let i = 0; i < steps && !done; i++) {
      p.vy -= PROJECTILE_GRAVITY * h;
      x += p.vx * h;
      y += p.vy * h;
      z += p.vz * h;
      const creatureId = creatureAt(state, { x, y, z });
      if (creatureId) {
        hits.push({
          owner: p.owner,
          creatureId,
          outcome: damageCreature(state, creatureId, p.owner, { x, z }, p.damage),
        });
        done = true;
      } else if (blocked(x, y, z)) done = true;
    }
    p.x = x;
    p.y = y;
    p.z = z;
    if (done) state.projectiles.delete(id);
  }
  return hits;
}
