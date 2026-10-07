import { ClientMessage, HOTBAR_SLOTS, getItem, isItemId, type Container } from '@homebound/shared';
import { useSession } from '../../state/session';
import { Button } from '../components/Button';
import { ItemSlot } from '../components/ItemSlot';
import panel from '../components/Panel.module.css';
import { closePanel } from '../hud/useGameKeys';
import styles from './InventoryPanels.module.css';

type Stack = { itemId: string; qty: number };

function Grid({
  title,
  stacks,
  onSlot,
  hotbar = false,
}: {
  title: string;
  stacks: readonly Stack[];
  onSlot: (index: number) => void;
  hotbar?: boolean;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>{title}</h3>
      <div className={styles.grid}>
        {stacks.map((s, i) => (
          <ItemSlot
            key={i}
            itemId={s.itemId}
            qty={s.qty}
            label={title}
            {...(hotbar && i < HOTBAR_SLOTS ? { hint: String(i + 1) } : {})}
            onClick={() => onSlot(i)}
          />
        ))}
      </div>
    </section>
  );
}

function Shell({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className={panel.overlay} onClick={closePanel}>
      <div className={`${panel.panel} ${styles.wide}`} onClick={(e) => e.stopPropagation()}>
        <h2 className={panel.title}>{title}</h2>
        <p className={panel.subtitle}>{hint}</p>
        {children}
        <Button variant="secondary" onClick={closePanel}>
          Back to game
        </Button>
      </div>
    </div>
  );
}

/** Tab: your backpack. Click food to eat it. */
export function InventoryPanel() {
  const { room } = useSession();
  const me = room?.state.players.get(room.sessionId);
  if (!room || !me) return null;

  const eat = (slot: number) => {
    const id = me.inventory.at(slot)?.itemId ?? '';
    if (isItemId(id) && getItem(id).hunger !== undefined)
      room.send(ClientMessage.UseItem, { slot });
  };

  return (
    <Shell title="Backpack" hint="Click food to eat it. Slots 1–5 are your hotbar. [Tab] to close.">
      <Grid title="Your items" stacks={[...me.inventory]} onSlot={eat} hotbar />
    </Shell>
  );
}

/** Shared chest: what either of you puts in, both can take. Click a stack to move it across. */
export function StoragePanel() {
  const { room } = useSession();
  const me = room?.state.players.get(room.sessionId);
  if (!room || !me) return null;

  const move = (from: Container) => (slot: number) =>
    room.send(ClientMessage.Transfer, { from, slot });

  return (
    <Shell title="Shared storage" hint="Click a stack to move it. Both of you can use this chest.">
      <Grid title="Chest" stacks={[...room.state.chest]} onSlot={move('chest')} />
      <Grid title="Your items" stacks={[...me.inventory]} onSlot={move('player')} hotbar />
    </Shell>
  );
}
