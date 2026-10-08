import type { ItemId } from './items.js';
import { PETS, type PetKind } from './pets.js';
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
  /** Skittish animals bolt away from whoever startled them. */
  Flee: 'flee',
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
  /**
   * 'hostile' hunts players; 'skittish' bolts away when it notices one (or gets hit) and never
   * attacks: you sneak up (crouch), shoot from afar, or trap it.
   */
  temperament: 'hostile' | 'skittish';
  /** Caught by a snare it walks into. */
  snareable: boolean;
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
  /** Wanders to points this far from its zone centre (m). */
  roamRadius: number;
  /** Never strays farther than this from its zone centre (m). */
  leashRadius: number;
  idleMs: readonly [number, number];
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
  /**
   * 'night' creatures come out after dusk and slink back into the woods at dawn (once nobody is
   * close enough to see them go).
   */
  activeAt: 'always' | 'night';
  /** Time from looted to a fresh one appearing in its zone. */
  respawnMs: number;
  zone: keyof typeof ZONES;
  count: number;
  /**
   * A wild fantasy pet: can't be hurt, doesn't run from someone holding its favorite food, and
   * becomes that player's pet of this kind once fed enough (pets.ts).
   */
  tame?: PetKind;
}

/** Shared tuning of the wild pets: shy, gentle, one of each in its own corner of the world. */
const WILD_PET = {
  temperament: 'skittish',
  snareable: false,
  maxHealth: 20,
  radius: 0.4,
  walkSpeed: 1.2,
  runSpeed: 6,
  detectRange: 7,
  nightDetectMultiplier: 1,
  maxAttackers: [0, 0],
  giveUpRange: 14,
  roamRadius: 9,
  leashRadius: 18,
  idleMs: [2000, 5000],
  alertMs: 600,
  attackRange: 0,
  attackWindupMs: 0,
  attackRecoverMs: 0,
  attackDamage: 0,
  hurtMs: 0,
  knockback: 0,
  loot: [],
  xp: 0,
  activeAt: 'always',
  /** Befriended: another one turns up later (for the partner). */
  respawnMs: 6 * 60_000,
  count: 1,
} as const;

export const CREATURES = {
  boar: {
    name: 'Heo rừng',
    temperament: 'hostile',
    snareable: false,
    maxHealth: 40,
    radius: 0.55,
    walkSpeed: 1.4,
    runSpeed: 5.4,
    detectRange: 8,
    nightDetectMultiplier: 1.6,
    maxAttackers: [1, 2],
    giveUpRange: 18,
    roamRadius: 15,
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
    activeAt: 'always',
    respawnMs: 3 * 60_000,
    zone: 'meadow',
    count: 4,
  },
  /** Night hunter: comes out of the north woods in a pair; faster than walking, slower than sprinting. */
  wolf: {
    name: 'Sói',
    temperament: 'hostile',
    snareable: false,
    maxHealth: 30,
    radius: 0.45,
    walkSpeed: 1.8,
    runSpeed: 6.2,
    detectRange: 14,
    nightDetectMultiplier: 1,
    maxAttackers: [2, 2],
    giveUpRange: 24,
    /** Prowls the whole north side, right up to the edge of the yard. */
    roamRadius: 34,
    leashRadius: 42,
    idleMs: [800, 2500],
    alertMs: 500,
    attackRange: 0.8,
    attackWindupMs: 450,
    attackRecoverMs: 800,
    attackDamage: 10,
    hurtMs: 250,
    knockback: 0.5,
    loot: [{ itemId: 'raw_meat', min: 1, max: 2 }],
    xp: 20,
    activeAt: 'night',
    respawnMs: 90_000,
    zone: 'forest',
    count: 3,
  },
  /** Grazes the east meadow; bolts faster than you can sprint. Sneak up or use the bow. */
  deer: {
    name: 'Nai',
    temperament: 'skittish',
    snareable: false,
    maxHealth: 35,
    radius: 0.5,
    walkSpeed: 1.3,
    runSpeed: 7.8,
    detectRange: 15,
    nightDetectMultiplier: 0.8,
    maxAttackers: [0, 0],
    /** Runs until the scare is this far behind it. */
    giveUpRange: 26,
    roamRadius: 16,
    leashRadius: 30,
    idleMs: [2500, 6000],
    alertMs: 350,
    attackRange: 0,
    attackWindupMs: 0,
    attackRecoverMs: 0,
    attackDamage: 0,
    hurtMs: 200,
    knockback: 0.3,
    loot: [
      { itemId: 'raw_meat', min: 2, max: 3 },
      { itemId: 'hide', min: 1, max: 2 },
      { itemId: 'antler', min: 0, max: 1 },
    ],
    xp: 25,
    activeAt: 'always',
    respawnMs: 4 * 60_000,
    zone: 'meadow',
    count: 3,
  },
  /** Small and quick among the west grove's bushes; the snare's favorite. */
  rabbit: {
    name: 'Thỏ',
    temperament: 'skittish',
    snareable: true,
    maxHealth: 8,
    radius: 0.25,
    walkSpeed: 1,
    runSpeed: 6.4,
    detectRange: 6,
    nightDetectMultiplier: 1,
    maxAttackers: [0, 0],
    giveUpRange: 14,
    roamRadius: 14,
    leashRadius: 22,
    idleMs: [1500, 4000],
    alertMs: 250,
    attackRange: 0,
    attackWindupMs: 0,
    attackRecoverMs: 0,
    attackDamage: 0,
    hurtMs: 150,
    knockback: 0.4,
    loot: [
      { itemId: 'raw_meat', min: 1, max: 1 },
      { itemId: 'hide', min: 0, max: 1 },
    ],
    xp: 8,
    activeAt: 'always',
    respawnMs: 2 * 60_000,
    zone: 'grove',
    count: 4,
  },
  /**
   * The forest's mini-boss: slow, huge wind-up (dodge it!), hits hard. Slower than a sprint, so
   * stamina is your escape.
   */
  bear: {
    name: 'Gấu',
    temperament: 'hostile',
    snareable: false,
    maxHealth: 160,
    radius: 0.9,
    walkSpeed: 1.1,
    runSpeed: 5.6,
    detectRange: 9,
    nightDetectMultiplier: 1.3,
    maxAttackers: [1, 1],
    giveUpRange: 20,
    roamRadius: 9,
    leashRadius: 20,
    idleMs: [3000, 7000],
    alertMs: 1000,
    attackRange: 1.2,
    attackWindupMs: 900,
    attackRecoverMs: 1200,
    attackDamage: 30,
    hurtMs: 150,
    knockback: 0.15,
    loot: [
      { itemId: 'raw_meat', min: 3, max: 4 },
      { itemId: 'hide', min: 2, max: 3 },
      { itemId: 'bear_claw', min: 1, max: 1 },
    ],
    xp: 80,
    activeAt: 'always',
    respawnMs: 8 * 60_000,
    zone: 'den',
    count: 1,
  },
  dragon: { ...WILD_PET, name: PETS.dragon.name, zone: 'crag', tame: 'dragon' },
  /** Only out at night, drifting between the trees behind the house. */
  ghost: { ...WILD_PET, name: PETS.ghost.name, zone: 'forest', activeAt: 'night', tame: 'ghost' },
  dino: { ...WILD_PET, name: PETS.dino.name, zone: 'meadow', radius: 0.45, tame: 'dino' },
  unicorn: { ...WILD_PET, name: PETS.unicorn.name, zone: 'clearing', runSpeed: 7, tame: 'unicorn' },
  alien: { ...WILD_PET, name: PETS.alien.name, zone: 'hollow', radius: 0.3, tame: 'alien' },
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
