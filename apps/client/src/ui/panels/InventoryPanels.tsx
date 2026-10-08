import { useState } from 'react';
import {
  ClientMessage,
  EQUIP_SLOTS,
  HOTBAR_SLOTS,
  PLAYER_INVENTORY_SLOTS,
  RECIPES,
  getItem,
  isItemId,
  wearSlotOf,
  type Container,
  recipesAt,
  type CraftStation,
  type RecipeDefinition,
} from '@homebound/shared';
import { getSession, useSession } from '../../state/session';
import { Button } from '../components/Button';
import { EQUIP_LABELS, ItemDetails } from '../components/ItemDetails';
import { DRAG_TYPE, ItemSlot } from '../components/ItemSlot';
import panel from '../components/Panel.module.css';
import { closePanel } from '../hud/useGameKeys';
import styles from './InventoryPanels.module.css';

type Stack = { itemId: string; qty: number };
/** A slot of the backpack ('player'), the chest, or what you wear ('equip'). */
type Spot = { container: Container | 'equip'; index: number };

function parseDragId(id: string): Spot | null {
  const [container, raw] = id.split(':');
  const index = Number(raw);
  if (!Number.isInteger(index)) return null;
  return container === 'player' || container === 'chest' || container === 'equip'
    ? { container, index }
    : null;
}

/**
 * Drag and drop: inside one container rearranges it; onto the other one moves the stack across;
 * onto a wear slot puts it on; a worn piece dragged into the backpack comes off.
 */
function dropOnto(container: Container | 'equip', to: number, fromId: string): void {
  const room = getSession().room;
  const from = parseDragId(fromId);
  if (!room || !from) return;
  if (container === 'equip') {
    if (from.container === 'player') room.send(ClientMessage.Equip, { slot: from.index });
  } else if (from.container === 'equip') {
    if (container === 'player') room.send(ClientMessage.Unequip, { slot: from.index });
  } else if (from.container === container) {
    room.send(ClientMessage.MoveSlot, { container, from: from.index, to });
  } else {
    room.send(ClientMessage.Transfer, { from: from.container, slot: from.index });
  }
}

function Grid({
  title,
  container,
  stacks,
  onSlot,
  onHover,
  onDouble,
  selected,
  hotbar = false,
}: {
  title: string;
  container: Container;
  stacks: readonly Stack[];
  onSlot: (index: number) => void;
  onHover?: (index: number) => void;
  onDouble?: (index: number) => void;
  selected?: number | undefined;
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
            selected={i === selected}
            {...(hotbar && i < HOTBAR_SLOTS ? { hint: String(i + 1) } : {})}
            onClick={() => onSlot(i)}
            {...(onHover ? { onHover: () => onHover(i) } : {})}
            {...(onDouble ? { onDoubleClick: () => onDouble(i) } : {})}
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
  onDropOutside,
  children,
}: {
  title: string;
  hint: string;
  /** A stack dragged out of the panel and let go over the world. */
  onDropOutside?: (fromDragId: string) => void;
  children: React.ReactNode;
}) {
  const accepts = (e: React.DragEvent) =>
    onDropOutside !== undefined && e.dataTransfer.types.includes(DRAG_TYPE);
  return (
    <div
      className={panel.overlay}
      onClick={closePanel}
      onDragOver={(e) => {
        if (accepts(e)) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        onDropOutside?.(e.dataTransfer.getData(DRAG_TYPE));
      }}
    >
      <div
        className={`${panel.panel} ${styles.wide}`}
        onClick={(e) => e.stopPropagation()}
        // Let go over the panel itself (not a slot): nothing is dropped.
        onDragOver={(e) => e.stopPropagation()}
        onDrop={(e) => e.stopPropagation()}
      >
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

/** What you wear: one labeled slot per EQUIP_SLOTS entry. */
function WornGrid({
  equipment,
  selected,
  onPick,
  onHover,
}: {
  equipment: readonly Stack[];
  selected: number | undefined;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>Wearing</h3>
      <div className={styles.worn}>
        {EQUIP_SLOTS.map((slot, i) => (
          <div key={slot} className={styles.wornSlot}>
            <ItemSlot
              itemId={equipment[i]?.itemId ?? ''}
              qty={equipment[i]?.qty ?? 0}
              label={EQUIP_LABELS[slot].label}
              placeholder={EQUIP_LABELS[slot].glyph}
              selected={i === selected}
              onClick={() => onPick(i)}
              onDoubleClick={() => getSession().room?.send(ClientMessage.Unequip, { slot: i })}
              onHover={() => onHover(i)}
              dragId={`equip:${i}`}
              onDropItem={(from) => dropOnto('equip', i, from)}
            />
            <span className={styles.wornLabel}>{EQUIP_LABELS[slot].label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Tab: your backpack and what you wear. Point at an item to read about it. */
export function InventoryPanel() {
  const { room } = useSession();
  const me = room?.state.players.get(room.sessionId);
  const [picked, setPicked] = useState<Spot | null>(null);
  const [hovered, setHoveredRaw] = useState<Spot | null>(null);
  const setHovered = (s: Spot) =>
    setHoveredRaw((h) => (h?.container === s.container && h.index === s.index ? h : s));
  if (!room || !me) return null;

  const stackAt = (s: Spot | null) =>
    !s ? undefined : s.container === 'equip' ? me.equipment.at(s.index) : me.inventory.at(s.index);
  // The details box shows what you point at, else what you clicked.
  const shown = [hovered, picked].find((s) => (stackAt(s)?.qty ?? 0) > 0) ?? null;
  const stack = stackAt(shown);
  const itemId = stack && stack.qty > 0 ? stack.itemId : null;
  const edible = !!itemId && isItemId(itemId) && getItem(itemId).hunger !== undefined;
  const gear = !!itemId && wearSlotOf(itemId) !== null;

  const send = (type: string, slot: number) => room.send(type, { slot });
  /** Double-click: eat food, put gear on. */
  const quick = (slot: number) => {
    const id = me.inventory.at(slot)?.itemId ?? '';
    if (isItemId(id) && getItem(id).hunger !== undefined) send(ClientMessage.UseItem, slot);
    else if (wearSlotOf(id)) send(ClientMessage.Equip, slot);
  };
  const dropOut = (fromId: string) => {
    const from = parseDragId(fromId);
    if (from?.container === 'player') send(ClientMessage.DropItem, from.index);
  };
  const extra = me.inventory.length - PLAYER_INVENTORY_SLOTS;

  return (
    <Shell
      title="Backpack"
      hint="Double-click to eat or wear. Drag an item out of this window to drop it. [Tab] to close."
      onDropOutside={dropOut}
    >
      <ItemDetails itemId={itemId} qty={stack?.qty ?? 0}>
        {shown?.container === 'equip' ? (
          <Button variant="secondary" onClick={() => send(ClientMessage.Unequip, shown.index)}>
            Take off
          </Button>
        ) : (
          shown && (
            <>
              {edible && (
                <Button onClick={() => send(ClientMessage.UseItem, shown.index)}>Eat</Button>
              )}
              {gear && <Button onClick={() => send(ClientMessage.Equip, shown.index)}>Wear</Button>}
              <Button
                variant="ghost"
                onClick={() => {
                  send(ClientMessage.DropItem, shown.index);
                  setPicked(null);
                }}
              >
                Drop
              </Button>
            </>
          )
        )}
      </ItemDetails>
      <div className={styles.bag}>
        <WornGrid
          equipment={[...me.equipment]}
          selected={picked?.container === 'equip' ? picked.index : undefined}
          onPick={(index) => setPicked({ container: 'equip', index })}
          onHover={(index) => setHovered({ container: 'equip', index })}
        />
        <Grid
          title={extra > 0 ? `Your items (+${extra} from your bag)` : 'Your items'}
          container="player"
          stacks={[...me.inventory]}
          selected={picked?.container === 'player' ? picked.index : undefined}
          onSlot={(index) => setPicked({ container: 'player', index })}
          onHover={(index) => setHovered({ container: 'player', index })}
          onDouble={quick}
          hotbar
        />
      </div>
    </Shell>
  );
}

/** Shared chest: what either of you puts in, both can take. Click a stack to move it across. */
export function StoragePanel() {
  const { room } = useSession();
  const me = room?.state.players.get(room.sessionId);
  const [hovered, setHoveredRaw] = useState<Spot | null>(null);
  const setHovered = (s: Spot) =>
    setHoveredRaw((h) => (h?.container === s.container && h.index === s.index ? h : s));
  if (!room || !me) return null;

  const move = (from: Container) => (slot: number) =>
    room.send(ClientMessage.Transfer, { from, slot });
  const shown =
    hovered?.container === 'chest'
      ? room.state.chest.at(hovered.index)
      : hovered
        ? me.inventory.at(hovered.index)
        : undefined;

  return (
    <Shell
      title="Shared storage"
      hint="Click a stack to move it across, or drag it where you want. Both of you can use this chest."
    >
      <Grid
        title="Chest"
        container="chest"
        stacks={[...room.state.chest]}
        onSlot={move('chest')}
        onHover={(index) => setHovered({ container: 'chest', index })}
      />
      <Grid
        title="Your items"
        container="player"
        stacks={[...me.inventory]}
        onSlot={move('player')}
        onHover={(index) => setHovered({ container: 'player', index })}
        hotbar
      />
      <ItemDetails itemId={shown && shown.qty > 0 ? shown.itemId : null} qty={shown?.qty ?? 0} />
    </Shell>
  );
}

/** Workbench: turn wood and stone into weapons and arrows (from your backpack). */
const STATIONS: Record<CraftStation, { title: string; hint: string; verb: string }> = {
  workbench: {
    title: 'Workbench',
    hint: 'Crafting uses materials from your backpack. Wear what you make from the backpack [Tab].',
    verb: 'Craft',
  },
  stove: {
    title: 'Stove — recipes',
    hint: 'Dishes with a bonus. Raw meat (or the mushroom in your hand) cooks with [E], three at once.',
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
                <span className={styles.desc}>{out.description}</span>
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
