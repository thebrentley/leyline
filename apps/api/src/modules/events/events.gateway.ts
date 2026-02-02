import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
  PlaytestMessage,
  PlaytestClientEvents,
  PlaytestEvent,
  FullPlaytestGameState,
} from "@decktutor/shared";

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Set<string>> = new Map();
  // Track active playtest sessions: deckId -> sessionId
  private activePlaytestSessions: Map<string, string> = new Map();

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        console.log("[WS] Client connected without auth, disconnecting");
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
      console.log("[WS] Invalid token, disconnecting");
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

  @SubscribeMessage("ping")
  handlePing(): string {
    return "pong";
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
    status: "waiting" | "syncing" | "synced" | "error",
    error?: string | null,
    progress?: number, // 0-100
  ) {
    this.emitToUser(userId, "deck:sync:status", {
      deckId,
      status,
      error,
      progress:
        progress ??
        (status === "synced" ? 100 : status === "waiting" ? 0 : undefined),
      timestamp: new Date().toISOString(),
    });
  }

  // =====================
  // Playtesting WebSocket Methods
  // =====================

  /**
   * Join a playtest room for a specific deck
   */
  @SubscribeMessage("playtest:join")
  handlePlaytestJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PlaytestClientEvents["playtest:join"],
  ) {
    const { deckId } = data;
    const roomName = `playtest:${deckId}`;

    client.join(roomName);

    const sessionId = this.activePlaytestSessions.get(deckId) || null;
    console.log(
      `[WS] Client ${client.id} joined playtest room ${roomName}, session: ${sessionId}`,
    );

    client.emit("playtest:joined", { deckId, sessionId });
    return { success: true, deckId, sessionId };
  }

  /**
   * Leave a playtest room
   */
  @SubscribeMessage("playtest:leave")
  handlePlaytestLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PlaytestClientEvents["playtest:leave"],
  ) {
    const { deckId } = data;
    const roomName = `playtest:${deckId}`;

    client.leave(roomName);
    console.log(`[WS] Client ${client.id} left playtest room ${roomName}`);

    client.emit("playtest:left", { deckId });
    return { success: true, deckId };
  }

  /**
   * Emit a playtest message to all clients in a deck's playtest room
   */
  emitPlaytestMessage(deckId: string, message: PlaytestMessage) {
    const roomName = `playtest:${deckId}`;
    this.server.to(roomName).emit("playtest:message", message);
  }

  /**
   * Emit a granular playtest event to all clients in a deck's playtest room
   * All events are sent on the unified 'playtest:message' channel
   */
  emitPlaytestEvent(deckId: string, event: PlaytestEvent) {
    const roomName = `playtest:${deckId}`;

    // Flatten the event structure to match PlaytestMessage format
    const message = {
      ...event,
      deckId,
      timestamp: new Date().toISOString(),
    };

    // Debug: check how many clients are in the room
    const room = this.server.sockets.adapter.rooms.get(roomName);
    const clientCount = room ? room.size : 0;
    console.log(
      `[WS] Emitting playtest:message to ${roomName} (${clientCount} clients): ${event.type}`,
    );

    if (clientCount === 0) {
      console.log(
        `[WS] WARNING: No clients in room ${roomName}. Make sure frontend calls playtest:join first.`,
      );
    }

    this.server.to(roomName).emit("playtest:message", message);
  }

  /**
   * Emit multiple playtest events in batch
   */
  emitPlaytestEvents(deckId: string, events: PlaytestEvent[]) {
    for (const event of events) {
      this.emitPlaytestEvent(deckId, event);
    }
  }

  /**
   * Emit a full game state sync (for reconnection or initial load)
   */
  emitPlaytestGameState(deckId: string, gameState: FullPlaytestGameState) {
    this.emitPlaytestEvent(deckId, {
      type: "gamestate:full",
      gameState,
    });
  }

  /**
   * Start a playtest session for a deck
   * Returns the session ID, or null if a session is already active
   */
  startPlaytestSession(deckId: string): string | null {
    if (this.activePlaytestSessions.has(deckId)) {
      return null; // Already has an active session
    }

    const sessionId = `playtest-${deckId}-${Date.now()}`;
    this.activePlaytestSessions.set(deckId, sessionId);

    this.emitPlaytestMessage(deckId, {
      type: "session:started",
      deckId,
      sessionId,
      timestamp: new Date().toISOString(),
    });

    return sessionId;
  }

  /**
   * End a playtest session for a deck
   */
  endPlaytestSession(deckId: string): boolean {
    const sessionId = this.activePlaytestSessions.get(deckId);
    if (!sessionId) {
      return false;
    }

    this.activePlaytestSessions.delete(deckId);

    this.emitPlaytestMessage(deckId, {
      type: "session:ended",
      deckId,
      sessionId,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Get active session ID for a deck (if any)
   */
  getActivePlaytestSession(deckId: string): string | null {
    return this.activePlaytestSessions.get(deckId) || null;
  }
}
