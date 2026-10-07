import { Room, logger, type Client } from '@colyseus/core';
import {
  ClientMessage,
  GamePhase,
  HomeState,
  MAX_MESSAGES_PER_SECOND,
  MAX_PLAYERS,
  PlayerState,
  RECONNECT_GRACE_SECONDS,
  ServerMessage,
  SPAWN_POINTS,
  clampToWorld,
  isMoveWithinSpeed,
  parseMovePayload,
  parseReadyPayload,
  sanitizePlayerName,
  type TeleportPayload,
} from '@homebound/shared';
import { releaseRoomCode, reserveRoomCode } from './roomCode.js';

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

  override async onCreate() {
    this.roomId = await reserveRoomCode(this.presence);
    await this.setPrivate(true);

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

    logger.info(`[room ${this.roomId}] created`);
  }

  override onJoin(client: Client, options: unknown) {
    const slot = this.freeSlot();
    const spawn = SPAWN_POINTS[slot - 1] ?? SPAWN_POINTS[0]!;
    const requestedName =
      typeof options === 'object' && options !== null && 'name' in options ? options.name : '';

    const player = new PlayerState();
    player.name = sanitizePlayerName(requestedName) || `Player ${slot}`;
    player.slot = slot;
    player.x = spawn.x;
    player.z = spawn.z;
    player.yaw = spawn.yaw;
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
    this.state.players.delete(client.sessionId);
    this.lastMoveAt.delete(client.sessionId);
    logger.info(`[room ${this.roomId}] leave ${client.sessionId}`);
  }

  override async onDispose() {
    await releaseRoomCode(this.presence, this.roomId);
    logger.info(`[room ${this.roomId}] disposed`);
  }

  private handleMove(client: Client, message: unknown) {
    const player = this.state.players.get(client.sessionId);
    const move = parseMovePayload(message);
    if (!player || !move || this.state.phase !== GamePhase.Playing) return;

    const now = this.clock.currentTime;
    const elapsed = now - (this.lastMoveAt.get(client.sessionId) ?? now);
    const target = clampToWorld(move.x, move.z);

    if (!isMoveWithinSpeed(player, target, elapsed)) {
      // Too fast: keep the authoritative position and pull the client back.
      const correction: TeleportPayload = { x: player.x, z: player.z };
      client.send(ServerMessage.Teleport, correction);
      logger.warn(`[room ${this.roomId}] rejected move from ${client.sessionId}`);
      return;
    }

    player.x = target.x;
    player.z = target.z;
    player.yaw = move.yaw;
    player.pitch = move.pitch;
    this.lastMoveAt.set(client.sessionId, now);
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
