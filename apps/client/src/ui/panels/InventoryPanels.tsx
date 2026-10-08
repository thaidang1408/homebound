import {
  ClientMessage,
  HOTBAR_SLOTS,
  RECIPES,
  getItem,
  isItemId,
  type Container,
  recipesAt,
  type CraftStation,
  type RecipeDefinition,
} from '@homebound/shared';
import { getSession, useSession } from '../../state/session';
import { Button } from '../components/Button';
import { ItemSlot } from '../components/ItemSlot';
import panel from '../components/Panel.module.css';
import { closePanel } from '../hud/useGameKeys';
import styles from './InventoryPanels.module.css';

type Stack = { itemId: string; qty: number };

/** Drag and drop: inside one container rearranges it; onto the other one moves the stack across. */
function dropOnto(container: Container, to: number, fromId: string): void {
  const room = getSession().room;
  const [fromContainer, rawIndex] = fromId.split(':');
  const from = Number(rawIndex);
  if (!room || !Number.isInteger(from)) return;
  if (fromContainer === container) {
    room.send(ClientMessage.MoveSlot, { container, from, to });
  } else if (fromContainer === 'player' || fromContainer === 'chest') {
    room.send(ClientMessage.Transfer, { from: fromContainer, slot: from });
  }
}

function Grid({
  title,
  container,
  stacks,
  onSlot,
  hotbar = false,
}: {
  title: string;
  container: Container;
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
            dragId={`${container}:${i}`}
            onDropItem={(from) => dropOnto(container, i, from)}
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
    <Shell
      title="Backpack"
      hint="Drag items to rearrange. Click food to eat it. Slots 1–5 are your hotbar. [Tab] to close."
    >
      <Grid title="Your items" container="player" stacks={[...me.inventory]} onSlot={eat} hotbar />
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
    <Shell
      title="Shared storage"
      hint="Click a stack to move it across, or drag it where you want. Both of you can use this chest."
    >
      <Grid title="Chest" container="chest" stacks={[...room.state.chest]} onSlot={move('chest')} />
      <Grid
        title="Your items"
        container="player"
        stacks={[...me.inventory]}
        onSlot={move('player')}
        hotbar
      />
    </Shell>
  );
}

/** Workbench: turn wood and stone into weapons and arrows (from your backpack). */
const STATIONS: Record<CraftStation, { title: string; hint: string; verb: string }> = {
  workbench: {
    title: 'Workbench',
    hint: 'Crafting uses materials from your backpack.',
    verb: 'Craft',
  },
  stove: {
    title: 'Stove — recipes',
    hint: 'Dishes with a bonus. Plain raw meat still cooks with [E].',
    verb: 'Cook',
  },
};

/** The recipes of one station (workbench or stove). */
export function CraftPanel({ station }: { station: CraftStation }) {
  const { room } = useSession();
  const me = room?.state.players.get(room.sessionId);
  if (!room || !me) return null;

  const have = (id: string) =>
    [...me.inventory].filter((s) => s.itemId === id).reduce((n, s) => n + s.qty, 0);

  return (
    <Shell title={STATIONS[station].title} hint={STATIONS[station].hint}>
      <ul className={styles.recipes}>
        {recipesAt(station).map((id) => {
          const r: RecipeDefinition = RECIPES[id];
          const out = getItem(r.output);
          const ready = r.inputs.every((i) => have(i.itemId) >= i.qty);
          return (
            <li key={id} className={styles.recipe}>
              <span className={styles.recipeIcon} aria-hidden>
                {out.icon}
              </span>
              <span className={styles.recipeText}>
                <strong>
                  {out.name}
                  {r.qty > 1 ? ` ×${r.qty}` : ''}
                </strong>
                <span className={styles.inputs}>
                  {r.inputs.map((i) => (
                    <span key={i.itemId} data-short={have(i.itemId) < i.qty}>
                      {getItem(i.itemId).icon} {have(i.itemId)}/{i.qty}
                    </span>
                  ))}
                </span>
              </span>
              <Button
                variant={ready ? 'primary' : 'secondary'}
                disabled={!ready}
                onClick={() => room.send(ClientMessage.Craft, { recipeId: id })}
              >
                {STATIONS[station].verb}
              </Button>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
