import {
  CHAPTERS,
  isPetKind,
  questStep,
  stepTarget,
  type HomeState,
  type PlayerState,
  type QuestStep,
} from '@homebound/shared';
import { countItem, removeItem } from '../inventory/inventory.js';

/**
 * The story (Phase 13, ADR-026): the home is on one shared step of one chapter. Steps finish
 * from game events (hunts, crafts), from the world (a landmark found, a pet made), or from [E]
 * (talking to Đốm, lighting a great lantern).
 */

export interface QuestNews {
  /** The step that just finished, if any. */
  finished: QuestStep | null;
  /** The chapter that just ended (its reward is due), or null. */
  chapterDone: number | null;
}

const NOTHING: QuestNews = { finished: null, chapterDone: null };

/** The step the home is on (null: the story is complete). */
export function currentStep(state: HomeState): QuestStep | null {
  return questStep(state.quest.chapter, state.quest.step);
}

function finish(state: HomeState): QuestNews {
  const q = state.quest;
  const finished = currentStep(state);
  q.progress = 0;
  q.step += 1;
  let chapterDone: number | null = null;
  if (q.step >= (CHAPTERS[q.chapter]?.steps.length ?? 0)) {
    chapterDone = q.chapter;
    q.chapter += 1;
    q.step = 0;
  }
  return { finished, chapterDone };
}

export type QuestEvent = { kind: 'hunt'; creature: string } | { kind: 'craft'; recipe: string };

/** A hunt or a craft happened: counts if the current step asks for it. */
export function questEvent(state: HomeState, event: QuestEvent): QuestNews {
  const step = currentStep(state);
  if (!step || step.kind !== event.kind) return NOTHING;
  if (step.kind === 'hunt' && event.kind === 'hunt') {
    if (step.creature && step.creature !== event.creature) return NOTHING;
  } else if (step.kind === 'craft' && event.kind === 'craft') {
    if (step.recipe !== event.recipe) return NOTHING;
  }
  state.quest.progress += 1;
  return state.quest.progress >= stepTarget(step) ? finish(state) : NOTHING;
}

/** Steps that finish by themselves once the world says so: a landmark found, a pet made. */
export function tickQuests(state: HomeState): QuestNews {
  const step = currentStep(state);
  if (step?.kind === 'visit' && state.discovered.has(step.landmark)) return finish(state);
  if (step?.kind === 'tame' && [...state.pets.values()].some((p) => isPetKind(p.kind))) {
    return finish(state);
  }
  return NOTHING;
}

export type TalkOutcome = 'advanced' | 'missing-items' | 'nothing';

/** [E] on Đốm: a talk step finishes; a bring step takes the things from your backpack. */
export function talk(state: HomeState, player: PlayerState): QuestNews & { outcome: TalkOutcome } {
  const step = currentStep(state);
  if (step?.kind === 'talk') return { ...finish(state), outcome: 'advanced' };
  if (step?.kind !== 'bring') return { ...NOTHING, outcome: 'nothing' };
  if (step.items.some(({ itemId, qty }) => countItem(player.inventory, itemId) < qty)) {
    return { ...NOTHING, outcome: 'missing-items' };
  }
  for (const { itemId, qty } of step.items) removeItem(player.inventory, itemId, qty);
  return { ...finish(state), outcome: 'advanced' };
}

/** [E] on a great lantern: lit, if the story is at that lantern. */
export function lightLantern(state: HomeState, landmarkId: string): QuestNews {
  const step = currentStep(state);
  if (step?.kind !== 'light' || step.landmark !== landmarkId) return NOTHING;
  state.lanterns.set(landmarkId, true);
  return finish(state);
}
