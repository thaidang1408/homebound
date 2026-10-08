import type { CreatureKind } from './creatures.js';
import type { ItemId } from './items.js';
import type { RecipeId } from './recipes.js';

/**
 * The story (Phase 13, ADR-026): five chapters, one per great lantern. Data only; the server
 * tracks one shared step for the whole home and the client words it.
 *
 * Premise: the family has moved into grandpa's old cabin at the edge of the Wild. The forest's
 * great lanterns went out one by one, and the night creatures grew bold. On the kitchen table a
 * little lantern called Đốm wakes up and asks for help to light them again.
 */

export type QuestStep =
  /** Talk to Đốm (in the kitchen). */
  | { kind: 'talk'; goal: string; done: string }
  /** Bring things to Đốm: they're taken from your backpack when you talk. */
  | { kind: 'bring'; goal: string; done: string; items: readonly { itemId: ItemId; qty: number }[] }
  /** Find a landmark (discovered by either player). */
  | { kind: 'visit'; goal: string; done: string; landmark: string }
  /** Hunt animals (any kind, or one kind). */
  | { kind: 'hunt'; goal: string; done: string; count: number; creature?: CreatureKind }
  /** Craft something at the workbench or stove. */
  | { kind: 'craft'; goal: string; done: string; recipe: RecipeId }
  /** Have a pet (either player). */
  | { kind: 'tame'; goal: string; done: string }
  /** Light the great lantern at a landmark ([E]). */
  | { kind: 'light'; goal: string; done: string; landmark: string };

export interface ChapterDefinition {
  title: string;
  /** Đốm, when the chapter begins. */
  intro: string;
  steps: readonly QuestStep[];
  /** For the whole home when the chapter ends (each player present gets it). */
  reward: readonly { itemId: ItemId; qty: number }[];
  /** A page of grandpa's journal, readable once the chapter is done (J). */
  journal: string;
}

export const CHAPTERS: readonly ChapterDefinition[] = [
  {
    title: 'The Sleeping Forest',
    intro:
      'Oh! Hello! I’m Đốm. Grandpa lit me every evening… then he was gone, and the great lanterns went out one by one. Will you help me light them again?',
    steps: [
      {
        kind: 'talk',
        goal: 'Talk to Đốm, the little lantern in the kitchen',
        done: 'Yay! First, a lantern needs a stand and something to burn. Bring me some wood and mushrooms.',
      },
      {
        kind: 'bring',
        goal: 'Bring Đốm 5 wood and 2 mushrooms',
        done: 'Perfect! Now we need the great lantern of the forest: north, past the ridge, under the Giant Tree.',
        items: [
          { itemId: 'wood', qty: 5 },
          { itemId: 'mushroom', qty: 2 },
        ],
      },
      {
        kind: 'visit',
        goal: 'Find the Giant Tree in the Deep Forest (north)',
        done: 'You found it! Its lantern is hanging by the roots — give it a little light.',
        landmark: 'giant-tree',
      },
      {
        kind: 'light',
        goal: 'Light the great lantern at the Giant Tree',
        done: 'Look how it glows! Night creatures won’t hunt you near a lit lantern. Come and tell me!',
        landmark: 'giant-tree',
      },
      {
        kind: 'talk',
        goal: 'Go home and tell Đốm',
        done: 'One lantern lit! I found a page of grandpa’s journal in my glass — read it with [J].',
      },
    ],
    reward: [
      { itemId: 'cooked_meat', qty: 3 },
      { itemId: 'arrow', qty: 10 },
    ],
    journal:
      'Day one at the cabin. The forest is old and kind, if you are kind to it. I hung a lantern under the Giant Tree so the little creatures can find their way at night. — Grandpa',
  },
  {
    title: 'Echoes in the Hills',
    intro:
      'The hills to the east are rocky and the boars there are grumpy. The great lantern sits in Echo Cave. We’ll need to be brave — and well armed!',
    steps: [
      {
        kind: 'craft',
        goal: 'Craft a spear at the workbench',
        done: 'A fine spear! The boars have been scaring everything away from the cave.',
        recipe: 'spear',
      },
      {
        kind: 'hunt',
        goal: 'Hunt 2 boars',
        done: 'That’s calmer. Now head east, through the low pass, to Echo Cave.',
        count: 2,
        creature: 'boar',
      },
      {
        kind: 'visit',
        goal: 'Find Echo Cave in the Rocky Hills (east)',
        done: 'Hello… hello… hello! The lantern is right inside.',
        landmark: 'cave',
      },
      {
        kind: 'light',
        goal: 'Light the great lantern in Echo Cave',
        done: 'Two lanterns! Can you feel the nights getting a little brighter?',
        landmark: 'cave',
      },
    ],
    reward: [
      { itemId: 'stone', qty: 6 },
      { itemId: 'snare', qty: 2 },
    ],
    journal:
      'The cave sings back whatever you say. I told it a joke; it told it back, twice. Some of grandma’s best songs were written here. — Grandpa',
  },
  {
    title: 'A Friend by the Lake',
    intro:
      'Grandpa always said the Misty Lake is lonely. It would be happier with a friend around. Do you have a pet yet? Eggs hide in nests far away, and shy wild ones love their favorite food.',
    steps: [
      {
        kind: 'tame',
        goal: 'Make a pet friend (hatch an egg or befriend a wild one)',
        done: 'How cute! Bring your friend south to the lake — the old camp is on the shore.',
      },
      {
        kind: 'visit',
        goal: 'Find the Abandoned Camp by the Misty Lake (south)',
        done: 'Grandpa camped here every summer. The lantern hangs by the tent.',
        landmark: 'camp',
      },
      {
        kind: 'light',
        goal: 'Light the great lantern at the camp',
        done: 'The mist is lifting! Three lanterns!',
        landmark: 'camp',
      },
    ],
    reward: [
      { itemId: 'berries', qty: 8 },
      { itemId: 'pet_egg', qty: 1 },
    ],
    journal:
      'Caught nothing all day, but a little ghost sat with me by the fire and we watched the stars. Best fishing trip ever. — Grandpa',
  },
  {
    title: 'The Old Watch',
    intro:
      'In the west there are ruins older than the cabin, and a tall watchtower. The way is cold and the wolves are bold. Wear something warm!',
    steps: [
      {
        kind: 'craft',
        goal: 'Make leather armor at the workbench (3 hides)',
        done: 'Snug! Now to the ruins in the west.',
        recipe: 'leather_armor',
      },
      {
        kind: 'visit',
        goal: 'Find the Old Watchtower in the ruins (west)',
        done: 'Climb it to see far away! The lantern hangs under the platform.',
        landmark: 'watchtower',
      },
      {
        kind: 'light',
        goal: 'Light the great lantern at the watchtower',
        done: 'Four! Only one left — the Spirit Shrine, where the forest’s heart is.',
        landmark: 'watchtower',
      },
    ],
    reward: [
      { itemId: 'arrow', qty: 15 },
      { itemId: 'spike_trap', qty: 2 },
    ],
    journal:
      'From the top of the tower you can see the whole Wild: the lake, the hills, the Giant Tree, and our little roof. Home looks small and warm from up here. — Grandpa',
  },
  {
    title: 'The Heart of the Wild',
    intro:
      'The last lantern is at the Spirit Shrine, but a great bear guards the old den in the north-west. It’s scared, and scared bears are dangerous. Be careful — together!',
    steps: [
      {
        kind: 'hunt',
        goal: 'Face the bear in its den (north-west)',
        done: 'You were so brave. Now the shrine — north-east, where the light goes up to the sky.',
        count: 1,
        creature: 'bear',
      },
      {
        kind: 'visit',
        goal: 'Find the Spirit Shrine (north-east)',
        done: 'This is the heart of the Wild. Light the last lantern…',
        landmark: 'shrine',
      },
      {
        kind: 'light',
        goal: 'Light the great lantern at the Spirit Shrine',
        done: 'ALL FIVE! The Wild is glowing again! Come home — I have something to tell you.',
        landmark: 'shrine',
      },
      {
        kind: 'talk',
        goal: 'Go home to Đốm',
        done: 'Grandpa would be so proud. This cabin is your home now, and the Wild is your friend. Thank you! (The story is complete — the Wild is yours to explore.)',
      },
    ],
    reward: [
      { itemId: 'bear_coat', qty: 1 },
      { itemId: 'stew', qty: 2 },
    ],
    journal:
      'If you are reading this, the lanterns are lit again and the cabin has a family. Look after the Wild, and it will look after you. With all my love. — Grandpa',
  },
];

/** Night creatures won't hunt anyone this close to a lit great lantern. */
export const LANTERN_SAFE_RADIUS = 14; // m
/** Where each landmark's great lantern stands (relative to the landmark). */
export const LANTERN_OFFSET = { x: -2.5, z: 2.5 } as const;
export const lanternId = (landmark: string) => `lantern-${landmark}`;

/** The step the home is on, or null when the story is complete. */
export function questStep(chapter: number, step: number): QuestStep | null {
  return CHAPTERS[chapter]?.steps[step] ?? null;
}

/** How many of the step's things count ("3/5"); 1 for one-off steps. */
export function stepTarget(s: QuestStep): number {
  return s.kind === 'hunt' ? s.count : 1;
}

/** What Đốm says at a story position: the chapter's opening, or the line that closed the last step. */
export function domLine(chapter: number, step: number): string {
  if (step > 0) return CHAPTERS[chapter]?.steps[step - 1]?.done ?? '';
  const last = CHAPTERS[chapter - 1]?.steps.at(-1)?.done;
  const intro = CHAPTERS[chapter]?.intro;
  if (!intro) return last ?? ''; // the story is complete
  return last ? `${last}\n\n${intro}` : intro;
}
