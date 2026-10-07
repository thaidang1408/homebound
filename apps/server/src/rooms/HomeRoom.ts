import { Room, logger, type Client } from '@colyseus/core';
import { MAX_PLAYERS } from '@homebound/shared';

/** The shared home world for two players. Gameplay state arrives in Phase 1. */
export class HomeRoom extends Room {
  override maxClients = MAX_PLAYERS;

  override onCreate() {
    logger.info(`[room ${this.roomId}] created`);
  }

  override onJoin(client: Client) {
    logger.info(`[room ${this.roomId}] join ${client.sessionId}`);
  }

  override onLeave(client: Client) {
    logger.info(`[room ${this.roomId}] leave ${client.sessionId}`);
  }

  override onDispose() {
    logger.info(`[room ${this.roomId}] disposed`);
  }
}
