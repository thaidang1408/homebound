import { Room, ServerError, logger, type Client, type Delayed } from '@colyseus/core';
import {
  AUTOSAVE_INTERVAL_MS,
  CHEST_SLOTS,
  ClientMessage,
  GamePhase,
  HOUSE_COLLIDERS,
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
  SPAWN_POINTS,
  ServerMessage,
  WORLD_RADIUS,
  XP_REWARDS,
  clampToWorld,
  collides,
  distanceToBox,
  findFurniture,
  isMoveWithinSpeed,
  isValidPlayerId,
  isValidRoomCode,
  normalizeRoomCode,
  parseInteractPayload,
  parseMovePayload,
  parseReadyPayload,
  parseTransferPayload,
  parseUseItemPayload,
  sanitizePlayerName,
  type FurnitureDefinition,
  type Point,
  type TeleportPayload,
} from '@homebound/shared';
import { addItem, createSlots, moveStack } from '../inventory/inventory.js';
import { homeExists, loadHome, saveHome, type SavedPlayer } from '../persistence/homeSaves.js';
import { applyHome, applyPlayer, buildSave, snapshotPlayer } from '../persistence/homeState.js';
import { eatFromSlot, tickNeeds } from '../systems/needs.js';
import { grantXp } from '../systems/progression.js';
import { everyoneAsleep, startNewDay, toggleSleep } from '../systems/sleep.js';
import { tickStove, useStove } from '../systems/stove.js';
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
  /** sessionId → stable playerId (what saves are keyed by). */
  private readonly playerIds = new Map<string, string>();
  /** Saved data for every player of this home, including those offline right now. */
  private savedPlayers: Record<string, SavedPlayer> = {};
  private createdAt = new Date().toISOString();
  private newDayTimer: Delayed | undefined;

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
    this.onMessage(ClientMessage.Transfer, (client, message: unknown) =>
      this.handleTransfer(client, message),
    );
    this.onMessage(ClientMessage.UseItem, (client, message: unknown) => {
      const payload = parseUseItemPayload(message);
      const player = this.activePlayer(client);
      if (payload && player && !player.sleeping) eatFromSlot(player, payload.slot);
    });

    this.setSimulationInterval((dtMs) => this.tick(dtMs), SIMULATION_TICK_MS);
    this.clock.setInterval(() => this.save(), AUTOSAVE_INTERVAL_MS);

    logger.info(`[room ${this.roomId}] created${typeof restore === 'string' ? ' (restored)' : ''}`);
  }

  private startNewHome() {
    this.roomId = claimNewCode(homeExists);
    this.state.chest = createSlots(CHEST_SLOTS);
    for (const { itemId, qty } of STARTER_CHEST) addItem(this.state.chest, itemId, qty);
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
    this.state.chest = createSlots(CHEST_SLOTS);
    applyHome(this.state, save);
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
    tickNeeds(this.state, dtMs / 1000);
    const cook = tickStove(this.state, dtMs);
    if (cook) this.rewardPlayer(cook, XP_REWARDS.cookMeal);
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
      Math.hypot(p.x, p.z) <= WORLD_RADIUS && !collides(p, SERVER_COLLISION_RADIUS, HOUSE_COLLIDERS)
    );
  }

  private isNear(player: PlayerState, furniture: FurnitureDefinition): boolean {
    return distanceToBox(player, furniture.box) <= INTERACT_RANGE + INTERACT_TOLERANCE;
  }

  private teleport(client: Client, target: Point) {
    const payload: TeleportPayload = { x: target.x, z: target.z };
    client.send(ServerMessage.Teleport, payload);
    this.lastMoveAt.set(client.sessionId, this.clock.currentTime);
  }

  private handleMove(client: Client, message: unknown) {
    const player = this.activePlayer(client);
    const move = parseMovePayload(message);
    if (!player || !move || player.sleeping) return;

    const now = this.clock.currentTime;
    const elapsed = now - (this.lastMoveAt.get(client.sessionId) ?? now);
    const target = clampToWorld(move.x, move.z);

    const blocked = collides(target, SERVER_COLLISION_RADIUS, HOUSE_COLLIDERS);
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

  private handleInteract(client: Client, message: unknown) {
    const payload = parseInteractPayload(message);
    const player = this.activePlayer(client);
    const target = payload ? findFurniture(payload.targetId) : undefined;
    const playerId = this.playerIds.get(client.sessionId);
    if (!player || !playerId || !target || !this.isNear(player, target)) return;
    // In bed, the only thing you can do is get up.
    if (player.sleeping && target.kind !== 'bed') return;

    switch (target.kind) {
      case 'stove':
        logger.debug(`[room ${this.roomId}] stove: ${useStove(this.state, player, playerId)}`);
        break;
      case 'bed':
        this.teleport(client, toggleSleep(player));
        this.scheduleNewDay();
        break;
      // Chest and workbench are opened client-side; chest moves go through Transfer.
      case 'chest':
      case 'workbench':
      case 'decor':
        break;
    }
  }

  private handleTransfer(client: Client, message: unknown) {
    const payload = parseTransferPayload(message);
    const player = this.activePlayer(client);
    const chest = findFurniture('chest');
    if (!payload || !player || !chest || player.sleeping || !this.isNear(player, chest)) return;

    const [from, to] =
      payload.from === 'player'
        ? [player.inventory, this.state.chest]
        : [this.state.chest, player.inventory];
    moveStack(from, payload.slot, to);
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
