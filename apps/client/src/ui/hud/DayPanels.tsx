import { useEffect } from 'react';
import { GOALS, isGoalKind, type DaySummaryPayload, type GoalState } from '@homebound/shared';
import { updateUi } from '../../state/ui';
import styles from './DayPanels.module.css';

/** Today's shared goals, under the clock. */
export function GoalList({ goals }: { goals: readonly GoalState[] }) {
  if (goals.length === 0) return null;
  return (
    <ul className={styles.goals} aria-label="Mục tiêu hôm nay">
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
    ['🐗', 'con thú đã săn', summary.hunted],
    ['🍖', 'món đã nấu', summary.meals],
    ['🪵', 'đồ đã nhặt', summary.gathered],
    ['🔨', 'đồ đã chế tạo', summary.crafted],
    ['🤝', 'lần cứu bạn', summary.revives],
  ];
  return (
    <div className={styles.summary} role="status">
      <p className={styles.summaryTitle}>Đã vượt qua ngày {summary.day}</p>
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
        Mục tiêu {summary.goalsDone}/{summary.goalsTotal}
        {summary.goalsDone === summary.goalsTotal ? ' — đồng đội tuyệt vời!' : ''}
      </p>
    </div>
  );
}
