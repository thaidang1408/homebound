import { Room, ServerError, logger, type Client, type Delayed } from '@colyseus/core';
import {
  AUTOSAVE_INTERVAL_MS,
  CREATURES,
  GOAL_XP,
  HOTBAR_SLOTS,
  RESOURCE_KINDS,
  CHEST_SLOTS,
  ClientMessage,
  GamePhase,
  WORLD_COLLIDERS,
  HomeState,
  INTERACT_RANGE,
  INTERACT_TOLERANCE,
  JoinError,
  MAX_MESSAGES_PER_SECOND,
  MAX_PLAYERS,
  NEW_DAY_DELAY_MS,
  PLAYER_INVENTORY_SLOTS,
  PLAYER_RADIUS,
  PlayerState,
  RECONNECT_GRACE_SECONDS,
  SIMULATION_TICK_MS,
  STARTER_CHEST,
  SUNRISE,
  getWeapon,
  isRecipeId,
  weaponOf,
  SPAWN_POINTS,
  ServerMessage,
  WORLD_RADIUS,
  XP_REWARDS,
  clampToWorld,
  createRandom,
  isCreatureKind,
  isItemId,
  collides,
  distanceToBox,
  findFurniture,
  findInteractable,
  findResourceNode,
  isMoveWithinSpeed,
  isValidPlayerId,
  isValidRoomCode,
  normalizeRoomCode,
  parseAttackPayload,
  parseCraftPayload,
  parseInteractPayload,
  parseMoveSlotPayload,
  parseMovePayload,
  parseReadyPayload,
  parseTransferPayload,
  parseUseItemPayload,
  sanitizePlayerName,
  type Box,
  type Point,
  type GoalKind,
  type HitConfirmPayload,
  type TeleportPayload,
} from '@homebound/shared';
import {
  addItem,
  createSlots,
  itemAt,
  moveStack,
  moveWithin,
  removeItem,
} from '../inventory/inventory.js';
import { homeExists, loadHome, saveHome, type SavedPlayer } from '../persistence/homeSaves.js';
import { applyHome, applyPlayer, buildSave, snapshotPlayer } from '../persistence/homeState.js';
import { env } from '../config/env.js';
import { tickClock } from '../systems/clock.js';
import { craft } from '../systems/crafting.js';
import { knockDown, pingRevive, respawn, tickDowned } from '../systems/downed.js';
import { shoot, tickProjectiles } from '../systems/projectiles.js';
import {
  butcherCreature,
  creatureReach,
  initCreatures,
  strikeCreature,
  tickCreatures,
} from '../systems/creatures.js';
import { harvest, initResources, tickResources } from '../systems/harvest.js';
import { eatFromSlot, hurtPlayer, tickNeeds } from '../systems/needs.js';
import { grantXp } from '../systems/progression.js';
import { canToggleSleep, everyoneAsleep, startNewDay, toggleSleep } from '../systems/sleep.js';
import { tickStove, useStove } from '../systems/stove.js';
import { closeDay, goalSeed, progressGoal, setGoals } from '../systems/goals.js';
import { claimCode, claimNewCode, releaseCode } from './roomCode.js';

/** Server-side collision is a hair more lenient than the client's so touching a wall is never "inside" it. */
const SERVER_COLLISION_RADIUS = PLAYER_RADIUS - 0.05;

/** HTTP-like codes on refused joins; the message (JoinError) is what the client maps. */
const NOT_FOUND = 404;
const CONFLICT = 409;
const BAD_REQUEST = 400;

function option(options: unknown, key: string): unknown {
  return typeof options === 'object' && options !== null && key in options
    ? (options as Record<string, unknown>)[key]
    : undefined;
}

/**
 * A home for up to two players. The room ID is the home's code. A home can be played solo; the
 * partner joins any time with the code. Homes are saved to disk (ADR-009) and re-opened by code.
 * Rooms are private: they are only entered with `joinById(code)` or re-opened with `restoreCode`.
 */
export class HomeRoom extends Room<{ state: HomeState }> {
  override maxClients = MAX_PLAYERS;
  override maxMessagesPerSecond = MAX_MESSAGES_PER_SECOND;
  override state = new HomeState();

  /** Server time of the last accepted move per session, for speed validation. */
  private readonly lastMoveAt = new Map<string, number>();
  /** Server time of each player's last harvest (cooldown). */
  private readonly lastHarvestAt = new Map<string, number>();
  /** Server time of each player's last strike (cooldown). */
  private readonly lastAttackAt = new Map<string, number>();
  /** Creature spawns, wandering and loot rolls. */
  private readonly random = createRandom(Date.now());
  /** sessionId → stable playerId (what saves are keyed by). */
  private readonly playerIds = new Map<string, string>();
  /** Saved data for every player of this home, including those offline right now. */
  private savedPlayers: Record<string, SavedPlayer> = {};
  private createdAt = new Date().toISOString();
  private newDayTimer: Delayed | undefined;
  /** The day today's goals were picked for; a different state.day means a new day began. */
  private goalDay = 0;

  override async onCreate(options: unknown) {
    const restore = option(options, 'restoreCode');
    if (typeof restore === 'string') this.restore(normalizeRoomCode(restore));
    else this.startNewHome();
    await this.setPrivate(true);

    this.onMessage(ClientMessage.Ready, (client, message: unknown) => {
      const payload = parseReadyPayload(message);
      const player = this.state.players.get(client.sessionId);
      if (!payload || !player || this.state.phase !== GamePhase.Lobby) return;
      player.ready = payload.ready;
    });

    this.onMessage(ClientMessage.Start, (client) => {
      if (!this.state.players.has(client.sessionId) || !this.canStart()) return;
      this.state.phase = GamePhase.Playing;
      this.save(); // from now on the code is a saved home
      logger.info(`[room ${this.roomId}] game started`);
    });

    this.onMessage(ClientMessage.Move, (client, message: unknown) =>
      this.handleMove(client, message),
    );
    this.onMessage(ClientMessage.Interact, (client, message: unknown) =>
      this.handleInteract(client, message),
    );
    this.onMessage(ClientMessage.Attack, (client, message: unknown) =>
      this.handleAttack(client, message),
    );
    this.onMessage(ClientMessage.Craft, (client, message: unknown) =>
      this.handleCraft(client, message),
    );
    this.onMessage(ClientMessage.Transfer, (client, message: unknown) =>
      this.handleTransfer(client, message),
    );
    this.onMessage(ClientMessage.MoveSlot, (client, message: unknown) =>
      this.handleMoveSlot(client, message),
    );
    this.onMessage(ClientMessage.SelectSlot, (client, message: unknown) => {
      const payload = parseUseItemPayload(message);
      const player = this.state.players.get(client.sessionId);
      if (payload && player && payload.slot < HOTBAR_SLOTS) player.selectedSlot = payload.slot;
    });
    this.onMessage(ClientMessage.UseItem, (client, message: unknown) => {
      const payload = parseUseItemPayload(message);
      const player = this.activePlayer(client);
      if (payload && player && !player.sleeping && !player.downed) {
        eatFromSlot(player, payload.slot);
      }
    });

    if (env.devCommands) {
      this.onMessage(ClientMessage.DevSetTime, (_client, message: unknown) => {
        const t = option(message, 'timeOfDay');
        if (typeof t === 'number' && t >= 0 && t < 1) this.state.timeOfDay = t;
      });
      this.onMessage(ClientMessage.DevHurt, (client, message: unknown) => {
        const amount = option(message, 'amount');
        const player = this.activePlayer(client);
        if (typeof amount !== 'number' || !player || player.downed) return;
        if (hurtPlayer(player, amount)) this.fall(client.sessionId);
      });
      this.onMessage(ClientMessage.DevGive, (client, message: unknown) => {
        const itemId = option(message, 'itemId');
        const qty = option(message, 'qty');
        const player = this.activePlayer(client);
        if (typeof itemId !== 'string' || !isItemId(itemId) || typeof qty !== 'number') return;
        if (player) addItem(player.inventory, itemId, Math.max(0, Math.floor(qty)));
      });
    }

    this.setSimulationInterval((dtMs) => this.tick(dtMs), SIMULATION_TICK_MS);
    this.clock.setInterval(() => this.save(), AUTOSAVE_INTERVAL_MS);

    logger.info(`[room ${this.roomId}] created${typeof restore === 'string' ? ' (restored)' : ''}`);
  }

  private startNewHome() {
    this.roomId = claimNewCode(homeExists);
    initResources(this.state);
    initCreatures(this.state, this.random);
    this.state.chest = createSlots(CHEST_SLOTS);
    for (const { itemId, qty } of STARTER_CHEST) addItem(this.state.chest, itemId, qty);
    setGoals(this.state, goalSeed(this.roomId));
    this.goalDay = this.state.day;
  }

  /** Re-opens a saved home. Throws (refusing the create) if it's unknown or already running. */
  private restore(code: string) {
    if (!isValidRoomCode(code)) throw new ServerError(NOT_FOUND, JoinError.HomeNotFound);
    if (!claimCode(code)) throw new ServerError(CONFLICT, JoinError.HomeAlreadyOpen);
    const save = loadHome(code);
    if (!save) {
      releaseCode(code);
      throw new ServerError(NOT_FOUND, JoinError.HomeNotFound);
    }
    this.roomId = code;
    initResources(this.state);
    initCreatures(this.state, this.random);
    this.state.chest = createSlots(CHEST_SLOTS);
    applyHome(this.state, save);
    if (this.state.goals.length === 0) setGoals(this.state, goalSeed(code)); // pre-Phase 6 save
    this.goalDay = this.state.day;
    this.savedPlayers = save.players;
    this.createdAt = save.createdAt;
    // A saved home was already started: players walk straight in.
    this.state.phase = GamePhase.Playing;
  }

  override onAuth(_client: Client, options: unknown) {
    const playerId = option(options, 'playerId');
    if (!isValidPlayerId(playerId)) throw new ServerError(BAD_REQUEST, JoinError.InvalidPlayer);
    // Same browser in two tabs would fight over one save slot.
    if ([...this.playerIds.values()].includes(playerId)) {
      throw new ServerError(CONFLICT, JoinError.AlreadyInHome);
    }
    return true;
  }

  override onJoin(client: Client, options: unknown) {
    const playerId = option(options, 'playerId') as string; // validated in onAuth
    const saved = this.savedPlayers[playerId];
    const slot = this.freeSlot();
    const spawn = SPAWN_POINTS[slot - 1] ?? { x: 0, z: 0, yaw: 0 };

    const player = new PlayerState();
    player.slot = slot;
    player.inventory = createSlots(PLAYER_INVENTORY_SLOTS);
    player.x = spawn.x;
    player.z = spawn.z;
    player.yaw = spawn.yaw;
    if (saved) {
      applyPlayer(player, saved);
      // Back where you left off, unless that spot is no longer valid (e.g. you left in bed).
      if (!this.isStandable(player))
        Object.assign(player, { x: spawn.x, z: spawn.z, yaw: spawn.yaw });
    }
    player.name = sanitizePlayerName(option(options, 'name')) || saved?.name || `Player ${slot}`;

    this.state.players.set(client.sessionId, player);
    this.playerIds.set(client.sessionId, playerId);
    this.lastMoveAt.set(client.sessionId, this.clock.currentTime);
    logger.info(
      `[room ${this.roomId}] join ${client.sessionId} slot=${slot}${saved ? ' (returning)' : ''}`,
    );
  }

  override onDrop(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    this.allowReconnection(client, RECONNECT_GRACE_SECONDS);
    this.scheduleNewDay(); // a disconnected sleeper no longer counts as asleep
    logger.info(
      `[room ${this.roomId}] drop ${client.sessionId}, holding seat ${RECONNECT_GRACE_SECONDS}s`,
    );
  }

  override onReconnect(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
    // Don't penalize the time spent offline in the speed check.
    this.lastMoveAt.set(client.sessionId, this.clock.currentTime);
    logger.info(`[room ${this.roomId}] reconnect ${client.sessionId}`);
  }

  override onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    const playerId = this.playerIds.get(client.sessionId);
    // Keep what they carry, their XP and hunger for next time.
    if (player && playerId) {
      player.sleeping = false;
      this.savedPlayers[playerId] = snapshotPlayer(player);
    }
    this.state.players.delete(client.sessionId);
    this.playerIds.delete(client.sessionId);
    this.lastMoveAt.delete(client.sessionId);
    this.lastHarvestAt.delete(client.sessionId);
    this.lastAttackAt.delete(client.sessionId);
    this.save();
    this.scheduleNewDay(); // the one still in bed may now be the only player
    logger.info(`[room ${this.roomId}] leave ${client.sessionId}`);
  }

  override onDispose() {
    this.save();
    releaseCode(this.roomId);
    logger.info(`[room ${this.roomId}] disposed`);
  }

  /** Writes the home to disk. Lobby-only homes (never started) are not saved. */
  private save() {
    if (this.state.phase !== GamePhase.Playing) return;
    for (const [sessionId, player] of this.state.players) {
      const playerId = this.playerIds.get(sessionId);
      if (playerId) this.savedPlayers[playerId] = snapshotPlayer(player);
    }
    try {
      // ponytail: synchronous write of a few KB every 30 s; switch to async/DB (Phase 8) if it shows in profiles.
      saveHome(buildSave(this.state, this.roomId, this.createdAt, this.savedPlayers));
    } catch (error) {
      logger.error(`[room ${this.roomId}] save failed`, error);
    }
  }

  private tick(dtMs: number) {
    if (this.state.phase !== GamePhase.Playing) return;
    tickClock(this.state, dtMs);
    this.maybeBeginDay(); // stayed up all night: the day closes at sunrise
    for (const id of tickNeeds(this.state, dtMs / 1000)) this.fall(id);
    tickResources(this.state, dtMs);
    const cook = tickStove(this.state, dtMs);
    if (cook) {
      this.rewardPlayer(cook, XP_REWARDS.cookMeal);
      this.state.today.meals += 1;
      this.advanceGoal('cook');
    }
    for (const hit of tickCreatures(this.state, dtMs, this.random)) {
      const player = this.state.players.get(hit.sessionId);
      if (player && hurtPlayer(player, hit.damage)) this.fall(hit.sessionId);
    }
    for (const hit of tickProjectiles(this.state, dtMs)) {
      this.confirmHit(hit.owner, hit.creatureId, hit.outcome);
    }
    for (const event of tickDowned(this.state, dtMs, this.clock.currentTime)) {
      if (event.type === 'died') this.die(event.sessionId);
      else {
        const reviver = this.state.players.get(event.reviverId);
        if (reviver) grantXp(reviver, XP_REWARDS.revive);
        this.state.today.revives += 1;
        logger.info(`[room ${this.roomId}] ${event.reviverId} revived ${event.sessionId}`);
      }
    }
  }

  /** Health reached 0: downed (the partner can help), or straight to death when alone. */
  private fall(sessionId: string) {
    if (knockDown(this.state, sessionId) === 'dead') this.die(sessionId);
    else logger.info(`[room ${this.roomId}] ${sessionId} is down`);
  }

  /** Wake up at home with items kept. */
  private die(sessionId: string) {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const spawn = respawn(player);
    const client = this.clients.find((c) => c.sessionId === sessionId);
    if (client) {
      this.teleport(client, spawn);
      client.send(ServerMessage.Died);
    }
    logger.info(`[room ${this.roomId}] ${sessionId} died`);
  }

  /** Hitmarker for the attacker, and the kill XP. */
  private confirmHit(attackerId: string, creatureId: string, outcome: string) {
    if (outcome !== 'hit' && outcome !== 'killed') return;
    const client = this.clients.find((c) => c.sessionId === attackerId);
    const payload: HitConfirmPayload = { killed: outcome === 'killed' };
    client?.send(ServerMessage.HitConfirm, payload);
    const kind = this.state.creatures.get(creatureId)?.kind ?? '';
    const player = this.state.players.get(attackerId);
    if (outcome === 'killed' && player && isCreatureKind(kind)) {
      grantXp(player, CREATURES[kind].xp);
      this.state.today.hunted += 1;
      this.advanceGoal('hunt');
    }
  }

  /** Progress on a shared goal; a completed goal rewards everyone in the home. */
  private advanceGoal(kind: GoalKind, amount = 1) {
    if (progressGoal(this.state, kind, amount) === 0) return;
    for (const player of this.state.players.values()) grantXp(player, GOAL_XP);
    logger.info(`[room ${this.roomId}] goal done: ${kind}`);
  }

  /**
   * A day closes in the morning (waking up, or sunrise if nobody slept), not at midnight: staying
   * up late still ends with the summary over breakfast.
   */
  private maybeBeginDay() {
    if (this.state.day === this.goalDay || this.state.timeOfDay < SUNRISE) return;
    this.beginDay();
  }

  /** Tell everyone how yesterday went, then set today's goals. */
  private beginDay() {
    const summary = closeDay(this.state, this.goalDay);
    this.broadcast(ServerMessage.DaySummary, summary);
    setGoals(this.state, goalSeed(this.roomId));
    this.goalDay = this.state.day;
  }

  /** XP for a playerId, whether they're in the room or offline (their save is updated). */
  private rewardPlayer(playerId: string, xp: number) {
    const sessionId = [...this.playerIds].find(([, id]) => id === playerId)?.[0];
    const player = sessionId ? this.state.players.get(sessionId) : undefined;
    if (player) grantXp(player, xp);
    else if (this.savedPlayers[playerId]) this.savedPlayers[playerId].xp += xp;
  }

  /** The player behind a client, only while the game is running. */
  private activePlayer(client: Client): PlayerState | undefined {
    if (this.state.phase !== GamePhase.Playing) return undefined;
    return this.state.players.get(client.sessionId);
  }

  private isStandable(p: Point): boolean {
    return (
      Math.hypot(p.x, p.z) <= WORLD_RADIUS && !collides(p, SERVER_COLLISION_RADIUS, WORLD_COLLIDERS)
    );
  }

  private isNear(player: PlayerState, box: Box): boolean {
    return distanceToBox(player, box) <= INTERACT_RANGE + INTERACT_TOLERANCE;
  }

  private teleport(client: Client, target: Point) {
    const payload: TeleportPayload = { x: target.x, z: target.z };
    client.send(ServerMessage.Teleport, payload);
    this.lastMoveAt.set(client.sessionId, this.clock.currentTime);
  }

  private handleMove(client: Client, message: unknown) {
    const player = this.activePlayer(client);
    const move = parseMovePayload(message);
    if (!player || !move || player.sleeping || player.downed) return;

    const now = this.clock.currentTime;
    const elapsed = now - (this.lastMoveAt.get(client.sessionId) ?? now);
    const target = clampToWorld(move.x, move.z);

    const blocked = collides(target, SERVER_COLLISION_RADIUS, WORLD_COLLIDERS);
    if (blocked || !isMoveWithinSpeed(player, target, elapsed)) {
      // Impossible move: keep the authoritative position and pull the client back.
      this.teleport(client, player);
      logger.warn(
        `[room ${this.roomId}] rejected move from ${client.sessionId} (${blocked ? 'wall' : 'speed'})`,
      );
      return;
    }

    player.x = target.x;
    player.z = target.z;
    player.yaw = move.yaw;
    player.pitch = move.pitch;
    this.lastMoveAt.set(client.sessionId, now);
  }

  /** The held hotbar weapon: melee strikes the named creature, ranged looses an arrow. */
  private handleAttack(client: Client, message: unknown) {
    const payload = parseAttackPayload(message);
    const player = this.activePlayer(client);
    if (!payload || !player || player.sleeping || player.downed) return;
    const slot = payload.slot < HOTBAR_SLOTS ? payload.slot : -1;
    const weapon = getWeapon(weaponOf(itemAt(player.inventory, slot) ?? ''));
    const now = this.clock.currentTime;
    if (now - (this.lastAttackAt.get(client.sessionId) ?? -Infinity) < weapon.cooldownMs) return;

    if (weapon.kind === 'ranged') {
      if (!removeItem(player.inventory, weapon.ammo, 1)) return; // out of arrows
      shoot(this.state, client.sessionId, player, weapon, payload.yaw, payload.pitch);
      this.lastAttackAt.set(client.sessionId, now);
      return;
    }
    this.lastAttackAt.set(client.sessionId, now); // a swing at thin air still takes time
    if (!payload.targetId) return;
    const outcome = strikeCreature(
      this.state,
      payload.targetId,
      { sessionId: client.sessionId, player },
      weapon,
    );
    this.confirmHit(client.sessionId, payload.targetId, outcome);
  }

  private handleCraft(client: Client, message: unknown) {
    const payload = parseCraftPayload(message);
    const player = this.activePlayer(client);
    const bench = findFurniture('workbench');
    if (!payload || !player || !bench || player.sleeping || player.downed) return;
    if (!isRecipeId(payload.recipeId) || !this.isNear(player, bench.box)) return;
    if (craft(player.inventory, payload.recipeId) !== 'crafted') return;
    grantXp(player, XP_REWARDS.craft);
    this.state.today.crafted += 1;
    this.advanceGoal('craft');
  }

  /** [E] on a carcass. Creatures are dynamic, so they aren't in the static interactable list. */
  private handleButcher(player: PlayerState, creatureId: string) {
    if (creatureReach(this.state, creatureId, player) > INTERACT_RANGE + INTERACT_TOLERANCE) return;
    butcherCreature(this.state, creatureId, player, this.random);
  }

  private handleInteract(client: Client, message: unknown) {
    const payload = parseInteractPayload(message);
    const player = this.activePlayer(client);
    if (!payload || !player || player.downed) return;
    if (!player.sleeping && this.state.creatures.has(payload.targetId)) {
      this.handleButcher(player, payload.targetId);
      return;
    }
    // [E] held on a downed partner (their sessionId).
    if (this.state.players.has(payload.targetId)) {
      if (!player.sleeping) {
        pingRevive(this.state, client.sessionId, payload.targetId, this.clock.currentTime);
      }
      return;
    }
    const target = findInteractable(payload.targetId);
    const playerId = this.playerIds.get(client.sessionId);
    if (!playerId || !target || !this.isNear(player, target.box)) return;
    // In bed, the only thing you can do is get up.
    if (player.sleeping && target.kind !== 'bed') return;

    switch (target.kind) {
      case 'stove':
        logger.debug(`[room ${this.roomId}] stove: ${useStove(this.state, player, playerId)}`);
        break;
      case 'bed':
        if (!canToggleSleep(this.state, player)) break; // daytime: the prompt says why
        this.teleport(client, toggleSleep(player));
        this.scheduleNewDay();
        break;
      // Chest and workbench are opened client-side; chest moves go through Transfer.
      case 'chest':
      case 'workbench':
        break;
      case 'tree':
      case 'rock':
      case 'bush':
        this.handleHarvest(client, player, target.id);
        break;
    }
  }

  private handleHarvest(client: Client, player: PlayerState, nodeId: string) {
    const node = findResourceNode(nodeId);
    if (!node) return;
    const now = this.clock.currentTime;
    const last = this.lastHarvestAt.get(client.sessionId) ?? -Infinity;
    if (harvest(this.state, player, node, now, last) !== 'harvested') return;
    this.lastHarvestAt.set(client.sessionId, now);
    grantXp(player, XP_REWARDS.gather);
    const { drop, qty } = RESOURCE_KINDS[node.kind];
    this.state.today.gathered += qty;
    if (drop === 'wood' || drop === 'stone') this.advanceGoal('gather', qty);
  }

  private handleTransfer(client: Client, message: unknown) {
    const payload = parseTransferPayload(message);
    const player = this.activePlayer(client);
    const chest = findFurniture('chest');
    if (!payload || !player || !chest || player.sleeping || !this.isNear(player, chest.box)) return;

    const [from, to] =
      payload.from === 'player'
        ? [player.inventory, this.state.chest]
        : [this.state.chest, player.inventory];
    moveStack(from, payload.slot, to);
  }

  /** Drag and drop inside the backpack, or inside the chest (only while standing at it). */
  private handleMoveSlot(client: Client, message: unknown) {
    const payload = parseMoveSlotPayload(message);
    const player = this.activePlayer(client);
    if (!payload || !player || player.sleeping || player.downed) return;
    if (payload.container === 'player') {
      moveWithin(player.inventory, payload.from, payload.to);
      return;
    }
    const chest = findFurniture('chest');
    if (chest && this.isNear(player, chest.box))
      moveWithin(this.state.chest, payload.from, payload.to);
  }

  /** Everyone in bed → short fade, then morning (cancelled if someone gets up meanwhile). */
  private scheduleNewDay() {
    this.newDayTimer?.clear();
    this.newDayTimer = undefined;
    if (!everyoneAsleep(this.state)) return;

    this.newDayTimer = this.clock.setTimeout(() => {
      this.newDayTimer = undefined;
      if (!everyoneAsleep(this.state)) return;
      for (const { player, target } of startNewDay(this.state)) {
        grantXp(player, XP_REWARDS.sleepNight);
        const client = this.clients.find((c) => this.state.players.get(c.sessionId) === player);
        if (client) this.teleport(client, target);
      }
      this.maybeBeginDay();
      this.save();
      logger.info(`[room ${this.roomId}] day ${this.state.day} begins`);
    }, NEW_DAY_DELAY_MS);
  }

  /** Alone you can start right away; together, both must be ready. */
  private canStart(): boolean {
    const players = [...this.state.players.values()];
    if (this.state.phase !== GamePhase.Lobby || players.length === 0) return false;
    if (!players.every((p) => p.connected)) return false;
    return players.length === 1 || players.every((p) => p.ready);
  }

  /** Lowest slot number not taken, so a rejoining player fills the free spot. */
  private freeSlot(): number {
    const taken = new Set([...this.state.players.values()].map((p) => p.slot));
    for (let slot = 1; slot <= MAX_PLAYERS; slot++) {
      if (!taken.has(slot)) return slot;
    }
    return MAX_PLAYERS;
  }
}
