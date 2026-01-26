import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Set<string>> = new Map();

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        console.log('[WS] Client connected without auth, disconnecting');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      // Store socket ID for this user
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Join user-specific room
      client.join(`user:${userId}`);

      // Store userId on socket for disconnect
      (client as any).userId = userId;

      console.log(`[WS] User ${userId} connected (socket: ${client.id})`);
    } catch (error) {
      console.log('[WS] Invalid token, disconnecting');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      console.log(`[WS] User ${userId} disconnected (socket: ${client.id})`);
    }
  }

  @SubscribeMessage('ping')
  handlePing(): string {
    return 'pong';
  }

  /**
   * Emit an event to a specific user
   */
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit deck sync status update
   */
  emitDeckSyncStatus(
    userId: string,
    deckId: string,
    status: 'pending' | 'syncing' | 'synced' | 'error',
    error?: string | null,
    progress?: number, // 0-100
  ) {
    this.emitToUser(userId, 'deck:sync:status', {
      deckId,
      status,
      error,
      progress: progress ?? (status === 'synced' ? 100 : status === 'pending' ? 0 : undefined),
      timestamp: new Date().toISOString(),
    });
  }
}
