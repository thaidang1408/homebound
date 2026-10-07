import type { ItemId } from './items.js';
import { ZONES } from './world/layout.js';

/**
 * Creatures are data (ADR-016): one definition per kind, one shared AI on the server. Adding a
 * creature = adding an entry here plus its model on the client.
 */

export const CreatureMode = {
  Idle: 'idle',
  Patrol: 'patrol',
  /** Spotted a player: a short telegraph (snort, head up) before the chase. */
  Alert: 'alert',
  Chase: 'chase',
  /** Wind-up then strike; the wind-up is the player's window to back off. */
  Attack: 'attack',
  Hurt: 'hurt',
  /** A carcass to butcher with [E]; disappears when looted, respawns later. */
  Dead: 'dead',
} as const;
export type CreatureMode = (typeof CreatureMode)[keyof typeof CreatureMode];

export interface LootEntry {
  itemId: ItemId;
  min: number;
  max: number;
}

export interface CreatureDefinition {
  name: string;
  maxHealth: number;
  /** Collision circle and focus size (m). */
  radius: number;
  walkSpeed: number; // m/s
  /** Between player walk and sprint speed: you escape by sprinting. */
  runSpeed: number; // m/s
  /** Sees players this close (m)… */
  detectRange: number;
  /** …this much farther at night. */
  nightDetectMultiplier: number;
  /**
   * How many of this kind may hunt the same player at once, by day and at night. Keeps daytime
   * fights a readable one-on-one; at night the herd gangs up.
   */
  maxAttackers: readonly [day: number, night: number];
  /** Gives up once the target is this far away (m). */
  giveUpRange: number;
  /** Never strays farther than this from its zone centre (m). */
  leashRadius: number;
  idleMs: [number, number];
  alertMs: number;
  /** Reach of its strike, measured from its edge (m). */
  attackRange: number;
  attackWindupMs: number;
  attackRecoverMs: number;
  attackDamage: number;
  hurtMs: number;
  /** Shoved back this far when hit (m). */
  knockback: number;
  loot: readonly LootEntry[];
  xp: number;
  /** Time from looted to a fresh one appearing in its zone. */
  respawnMs: number;
  zone: keyof typeof ZONES;
  count: number;
}

export const CREATURES = {
  boar: {
    name: 'Boar',
    maxHealth: 40,
    radius: 0.55,
    walkSpeed: 1.4,
    runSpeed: 5.4,
    detectRange: 8,
    nightDetectMultiplier: 1.6,
    maxAttackers: [1, 2],
    giveUpRange: 18,
    leashRadius: 24,
    idleMs: [1500, 4000],
    alertMs: 700,
    attackRange: 0.9,
    attackWindupMs: 550,
    attackRecoverMs: 900,
    attackDamage: 12,
    hurtMs: 300,
    knockback: 0.6,
    loot: [{ itemId: 'raw_meat', min: 2, max: 3 }],
    xp: 15,
    respawnMs: 3 * 60_000,
    zone: 'meadow',
    count: 4,
  },
} as const satisfies Record<string, CreatureDefinition>;

export type CreatureKind = keyof typeof CREATURES;

export function isCreatureKind(value: string): value is CreatureKind {
  return Object.hasOwn(CREATURES, value);
}

/** Creature ids are `<kind>-<n>`, stable for the life of a room. */
export function creatureIds(): { id: string; kind: CreatureKind }[] {
  return Object.entries(CREATURES).flatMap(([kind, def]) =>
    Array.from({ length: def.count }, (_, i) => ({
      id: `${kind}-${i}`,
      kind: kind as CreatureKind,
    })),
  );
}

// --- Players vs creatures (Phase 4: bare hands; Phase 5 replaces this with weapons) ---

export const UNARMED_ATTACK = {
  damage: 8,
  /** From the player to the creature's edge (m). */
  range: 1.8,
  cooldownMs: 450,
} as const;
