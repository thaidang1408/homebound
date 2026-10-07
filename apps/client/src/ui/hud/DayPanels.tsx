import { useEffect } from 'react';
import { GOALS, isGoalKind, type DaySummaryPayload, type GoalState } from '@homebound/shared';
import { updateUi } from '../../state/ui';
import styles from './DayPanels.module.css';

/** Today's shared goals, under the clock. */
export function GoalList({ goals }: { goals: readonly GoalState[] }) {
  if (goals.length === 0) return null;
  return (
    <ul className={styles.goals} aria-label="Today's goals">
      {goals.map((g) => {
        if (!isGoalKind(g.kind)) return null;
        const done = g.progress >= g.target;
        return (
          <li key={g.kind} className={styles.goal} data-done={done}>
            <span aria-hidden>{done ? '✅' : GOALS[g.kind].icon}</span>
            <span>{GOALS[g.kind].label(g.target)}</span>
            <span className={styles.count}>
              {g.progress}/{g.target}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const SUMMARY_MS = 9000;

/** The morning card: how yesterday went. Fades on its own. */
export function DaySummaryCard({ summary }: { summary: DaySummaryPayload }) {
  useEffect(() => {
    const timer = setTimeout(() => updateUi({ summary: null }), SUMMARY_MS);
    return () => clearTimeout(timer);
  }, [summary]);

  const lines: [string, string, number][] = [
    ['🐗', 'hunted', summary.hunted],
    ['🍖', 'meals cooked', summary.meals],
    ['🪵', 'gathered', summary.gathered],
    ['🔨', 'crafted', summary.crafted],
    ['🤝', 'revives', summary.revives],
  ];
  return (
    <div className={styles.summary} role="status">
      <p className={styles.summaryTitle}>Day {summary.day} survived</p>
      <ul className={styles.stats}>
        {lines
          .filter(([, , n]) => n > 0)
          .map(([icon, label, n]) => (
            <li key={label}>
              <span aria-hidden>{icon}</span> {n} {label}
            </li>
          ))}
      </ul>
      <p className={styles.summaryGoals}>
        Goals {summary.goalsDone}/{summary.goalsTotal}
        {summary.goalsDone === summary.goalsTotal ? ' — great teamwork!' : ''}
      </p>
    </div>
  );
}
