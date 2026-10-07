import { Room, logger, type Client, type Delayed } from '@colyseus/core';
import {
  CHEST_SLOTS,
  ClientMessage,
  GamePhase,
  HOUSE_COLLIDERS,
  HomeState,
  INTERACT_RANGE,
  INTERACT_TOLERANCE,
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
  clampToWorld,
  collides,
  distanceToBox,
  findFurniture,
  isMoveWithinSpeed,
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
import { eatFromSlot, tickNeeds } from '../systems/needs.js';
import { everyoneAsleep, startNewDay, toggleSleep } from '../systems/sleep.js';
import { tickStove, useStove } from '../systems/stove.js';
import { releaseRoomCode, reserveRoomCode } from './roomCode.js';

/** Server-side collision is a hair more lenient than the client's so touching a wall is never "inside" it. */
const SERVER_COLLISION_RADIUS = PLAYER_RADIUS - 0.05;

/**
 * The shared home world for two players. The room ID is the human room code; rooms are private,
 * so they can only be entered with `joinById(code)`.
 */
export class HomeRoom extends Room<{ state: HomeState }> {
  override maxClients = MAX_PLAYERS;
  override maxMessagesPerSecond = MAX_MESSAGES_PER_SECOND;
  override state = new HomeState();

  /** Server time of the last accepted move per session, for speed validation. */
  private readonly lastMoveAt = new Map<string, number>();
  private newDayTimer: Delayed | undefined;

  override async onCreate() {
    this.roomId = await reserveRoomCode(this.presence);
    await this.setPrivate(true);

    this.state.chest = createSlots(CHEST_SLOTS);
    for (const { itemId, qty } of STARTER_CHEST) addItem(this.state.chest, itemId, qty);

    this.onMessage(ClientMessage.Ready, (client, message: unknown) => {
      const payload = parseReadyPayload(message);
      const player = this.state.players.get(client.sessionId);
      if (!payload || !player || this.state.phase !== GamePhase.Lobby) return;
      player.ready = payload.ready;
    });

    this.onMessage(ClientMessage.Start, (client) => {
      const player = this.state.players.get(client.sessionId);
      // Either player may start once both are ready (no host to lose if one leaves the lobby).
      if (!player || !this.canStart()) return;
      this.state.phase = GamePhase.Playing;
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

    logger.info(`[room ${this.roomId}] created`);
  }

  override onJoin(client: Client, options: unknown) {
    const slot = this.freeSlot();
    const spawn = SPAWN_POINTS[slot - 1] ?? { x: 0, z: 0, yaw: 0 };
    const requestedName =
      typeof options === 'object' && options !== null && 'name' in options ? options.name : '';

    const player = new PlayerState();
    player.name = sanitizePlayerName(requestedName) || `Player ${slot}`;
    player.slot = slot;
    player.x = spawn.x;
    player.z = spawn.z;
    player.yaw = spawn.yaw;
    player.inventory = createSlots(PLAYER_INVENTORY_SLOTS);
    this.state.players.set(client.sessionId, player);
    this.lastMoveAt.set(client.sessionId, this.clock.currentTime);

    logger.info(`[room ${this.roomId}] join ${client.sessionId} slot=${slot}`);
  }

  override onDrop(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    this.allowReconnection(client, RECONNECT_GRACE_SECONDS);
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
    // What a departing player carried goes back into the shared chest (as much as fits).
    if (player) {
      for (let i = 0; i < player.inventory.length; i++) {
        moveStack(player.inventory, i, this.state.chest);
      }
    }
    this.state.players.delete(client.sessionId);
    this.lastMoveAt.delete(client.sessionId);
    logger.info(`[room ${this.roomId}] leave ${client.sessionId}`);
  }

  override async onDispose() {
    await releaseRoomCode(this.presence, this.roomId);
    logger.info(`[room ${this.roomId}] disposed`);
  }

  private tick(dtMs: number) {
    if (this.state.phase !== GamePhase.Playing) return;
    tickNeeds(this.state, dtMs / 1000);
    tickStove(this.state, dtMs);
  }

  /** The player behind a client, only while the game is running. */
  private activePlayer(client: Client): PlayerState | undefined {
    if (this.state.phase !== GamePhase.Playing) return undefined;
    return this.state.players.get(client.sessionId);
  }

  private isNear(player: PlayerState, furniture: FurnitureDefinition): boolean {
    return distanceToBox(player, furniture.box) <= INTERACT_RANGE + INTERACT_TOLERANCE;
  }

  private teleport(client: Client, player: PlayerState, target: Point) {
    const payload: TeleportPayload = { x: target.x, z: target.z };
    client.send(ServerMessage.Teleport, payload);
    this.lastMoveAt.set(client.sessionId, this.clock.currentTime);
    logger.debug(`[room ${this.roomId}] teleport ${player.name} → ${target.x},${target.z}`);
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
      this.teleport(client, player, player);
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
    if (!player || !target || !this.isNear(player, target)) return;
    // In bed, the only thing you can do is get up.
    if (player.sleeping && target.kind !== 'bed') return;

    switch (target.kind) {
      case 'stove': {
        const outcome = useStove(this.state, player);
        logger.debug(`[room ${this.roomId}] stove: ${outcome} by ${player.name}`);
        break;
      }
      case 'bed':
        this.teleport(client, player, toggleSleep(player));
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

  /** Both in bed → short fade, then morning (cancelled if someone gets up meanwhile). */
  private scheduleNewDay() {
    this.newDayTimer?.clear();
    this.newDayTimer = undefined;
    if (!everyoneAsleep(this.state)) return;

    this.newDayTimer = this.clock.setTimeout(() => {
      this.newDayTimer = undefined;
      if (!everyoneAsleep(this.state)) return;
      for (const { player, target } of startNewDay(this.state)) {
        const client = this.clients.find((c) => this.state.players.get(c.sessionId) === player);
        if (client) this.teleport(client, player, target);
      }
      logger.info(`[room ${this.roomId}] day ${this.state.day} begins`);
    }, NEW_DAY_DELAY_MS);
  }

  private canStart(): boolean {
    const players = [...this.state.players.values()];
    return (
      this.state.phase === GamePhase.Lobby &&
      players.length === MAX_PLAYERS &&
      players.every((p) => p.ready && p.connected)
    );
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
