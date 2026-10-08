import {
  CHAPTERS,
  domLine,
  getItem,
  questStep,
  stepTarget,
  type HomeState,
  type PlayerState,
  type QuestStep,
} from '@homebound/shared';
import { useSession } from '../../state/session';
import { useUi } from '../../state/ui';
import { Button } from '../components/Button';
import panel from '../components/Panel.module.css';
import { closePanel } from '../hud/useGameKeys';
import styles from './StoryPanels.module.css';

/** The current goal in player words, with counts ("Bring Đốm 5 wood and 2 mushrooms — 3/5 🪵"). */
export function goalText(step: QuestStep, state: HomeState, me: PlayerState | undefined): string {
  if (step.kind === 'bring' && me) {
    const have = step.items.map(({ itemId, qty }) => {
      const n = [...me.inventory]
        .filter((s) => s.itemId === itemId)
        .reduce((sum, s) => sum + s.qty, 0);
      return `${getItem(itemId).icon} ${Math.min(n, qty)}/${qty}`;
    });
    return `${step.goal} (${have.join(' ')})`;
  }
  const target = stepTarget(step);
  return target > 1 ? `${step.goal} (${state.quest.progress}/${target})` : step.goal;
}

/** Top-right, above the daily goals: where the story is. */
export function QuestTracker({ state, me }: { state: HomeState; me: PlayerState | undefined }) {
  const step = questStep(state.quest.chapter, state.quest.step);
  const chapter = CHAPTERS[state.quest.chapter];
  if (!step || !chapter) return null;
  return (
    <div className={styles.tracker} role="status">
      <span className={styles.chapter}>
        📜 Chapter {state.quest.chapter + 1}: {chapter.title}
      </span>
      <span>{goalText(step, state, me)}</span>
    </div>
  );
}

/** [E] on Đốm: what it has to say, and what's next. */
export function DomPanel() {
  const { room } = useSession();
  const { domFrom } = useUi();
  if (!room) return null;
  const s = room.state;
  // What it said when you came over, then (if that moved the story on) what it says now.
  const before = domFrom ? domLine(domFrom.chapter, domFrom.step) : '';
  const now = domLine(s.quest.chapter, s.quest.step);
  const speech = before && before !== now ? `${before}\n\n${now}` : now;
  const step = questStep(s.quest.chapter, s.quest.step);
  const chapter = CHAPTERS[s.quest.chapter];
  return (
    <div className={panel.overlay} onClick={closePanel}>
      <div className={panel.panel} onClick={(e) => e.stopPropagation()}>
        <h2 className={panel.title}>🏮 Đốm</h2>
        {chapter && (
          <p className={panel.subtitle}>
            Chapter {s.quest.chapter + 1}: {chapter.title}
          </p>
        )}
        <p className={styles.speech}>{speech}</p>
        {step && (
          <p className={styles.next}>
            <strong>Next:</strong> {goalText(step, s, s.players.get(room.sessionId))}
          </p>
        )}
        <Button onClick={closePanel}>OK!</Button>
      </div>
    </div>
  );
}

/** [J]: grandpa's journal — a page for every chapter done — and the story so far. */
export function JournalPanel() {
  const { room } = useSession();
  if (!room) return null;
  const s = room.state;
  const pages = CHAPTERS.slice(0, s.quest.chapter);
  const step = questStep(s.quest.chapter, s.quest.step);
  return (
    <div className={panel.overlay} onClick={closePanel}>
      <div className={`${panel.panel} ${styles.journal}`} onClick={(e) => e.stopPropagation()}>
        <h2 className={panel.title}>📖 Grandpa’s journal</h2>
        <p className={panel.subtitle}>
          Lanterns lit: {s.lanterns.size}/{CHAPTERS.length}.{' '}
          {step
            ? `Now: ${goalText(step, s, s.players.get(room.sessionId))}`
            : 'The story is complete!'}
        </p>
        {pages.length === 0 ? (
          <p className={styles.speech}>The pages are blank… Light a great lantern and see.</p>
        ) : (
          pages.map((c, i) => (
            <section key={c.title} className={styles.page}>
              <h3 className={styles.pageTitle}>
                {i + 1}. {c.title}
              </h3>
              <p className={styles.speech}>{c.journal}</p>
            </section>
          ))
        )}
        <Button variant="secondary" onClick={closePanel}>
          Close [J]
        </Button>
      </div>
    </div>
  );
}
