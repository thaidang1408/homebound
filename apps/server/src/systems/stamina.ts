import {
  DODGE_COOLDOWN_MS,
  DODGE_COST,
  DODGE_IFRAMES_MS,
  STAMINA_MAX,
  STAMINA_RECOVER,
  STAMINA_REGEN,
  STAMINA_REGEN_DELAY_MS,
  STAMINA_SPRINT_DRAIN,
  BUFFS,
  isBuffId,
  type PlayerAction,
  type PlayerState,
} from '@homebound/shared';

function setStamina(player: PlayerState, value: number): void {
  player.staminaExact = Math.max(0, Math.min(STAMINA_MAX, value));
  player.stamina = Math.ceil(player.staminaExact);
  if (player.staminaExact === 0) player.winded = true;
  else if (player.winded && player.staminaExact >= STAMINA_RECOVER) player.winded = false;
}

function spend(player: PlayerState, amount: number, now: number): void {
  setStamina(player, player.staminaExact - amount);
  player.staminaUsedAt = now;
}

/**
 * Sprinting drains stamina by the time spent sprinting (from move messages).
 * ponytail: the speed check still allows sprint speed while winded (the gap to walking is inside
 * the jitter tolerance); stamina is shown and gates dodges, which is where it matters.
 */
export function drainSprint(player: PlayerState, elapsedMs: number, now: number): void {
  if (player.winded) return;
  spend(player, (STAMINA_SPRINT_DRAIN * Math.min(elapsedMs, 250)) / 1000, now);
}

/** Refills after a short rest. */
export function tickStamina(player: PlayerState, dtMs: number, now: number): void {
  if (player.staminaExact >= STAMINA_MAX || now - player.staminaUsedAt < STAMINA_REGEN_DELAY_MS) {
    return;
  }
  const buff = isBuffId(player.buff) ? BUFFS[player.buff] : undefined;
  const rate = STAMINA_REGEN * (buff && 'stamina' in buff ? buff.stamina : 1);
  setStamina(player, player.staminaExact + (rate * dtMs) / 1000);
}

/** A dodge roll if there's breath for it; strikes miss you for DODGE_IFRAMES_MS. */
export function tryDodge(player: PlayerState, now: number): boolean {
  if (player.winded || player.staminaExact < DODGE_COST) return false;
  if (now - player.dodgeAt < DODGE_COOLDOWN_MS) return false;
  spend(player, DODGE_COST, now);
  player.dodgeAt = now;
  player.dodgeUntil = now + DODGE_IFRAMES_MS;
  return true;
}

export const isDodging = (player: PlayerState, now: number): boolean => now < player.dodgeUntil;

/** Announce something the partner should see animate (see PlayerState.action). */
export function act(player: PlayerState, action: PlayerAction): void {
  player.action = action;
  player.actionSeq = (player.actionSeq + 1) % 256;
}
