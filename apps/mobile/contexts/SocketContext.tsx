import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

// Socket.io connects to the server root, not the /api path
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";
const SOCKET_URL = API_URL.replace(/\/api$/, "");

interface DeckSyncStatusEvent {
  deckId: string;
  status: "waiting" | "syncing" | "synced" | "error";
  error?: string | null;
  progress?: number; // 0-100
  timestamp: string;
}

// =====================
// Playtesting Types
// =====================

interface PlaytestMessageBase {
  type: string;
  deckId: string;
  timestamp: string;
  seq: number;
}

interface PlaytestSessionStartedMessage extends PlaytestMessageBase {
  type: "session:started";
  sessionId: string;
}

interface PlaytestSessionEndedMessage extends PlaytestMessageBase {
  type: "session:ended";
  sessionId: string;
}

interface PlaytestErrorMessage extends PlaytestMessageBase {
  type: "error";
  error: string;
}

// =====================
// Playtesting Game State Types
// =====================

export type GameZone =
  | "library"
  | "hand"
  | "battlefield"
  | "graveyard"
  | "exile"
  | "command";

export interface GameCard {
  instanceId: string;
  scryfallId: string;
  name: string;
  zone: GameZone;
  isTapped: boolean;
  isFaceDown: boolean;
  imageUrl: string | null;
  manaCost: string | null;
  typeLine: string | null;
  isCommander: boolean;
}

export interface PlaytestGameState {
  sessionId: string;
  deckId: string;
  deckName: string;
  turn: number;
  life: number;
  cards: Record<string, GameCard>;
  libraryOrder: string[];
  handOrder: string[];
  updatedAt: string;
}

interface PlaytestGameStateUpdateMessage extends PlaytestMessageBase {
  type: "gamestate:update";
  gameState: PlaytestGameState;
}

/**
 * Union of all playtest message types.
 * Add new message types here as the feature expands.
 */
export type PlaytestMessage =
  | PlaytestSessionStartedMessage
  | PlaytestSessionEndedMessage
  | PlaytestErrorMessage
  | PlaytestGameStateUpdateMessage;

export interface PlaytestJoinedEvent {
  deckId: string;
  sessionId: string | null;
}

export interface PlaytestLeftEvent {
  deckId: string;
}

interface SocketContextValue {
  isConnected: boolean;
  onDeckSyncStatus: (callback: (event: DeckSyncStatusEvent) => void) => () => void;
  // Playtesting methods
  joinPlaytest: (deckId: string) => void;
  leavePlaytest: (deckId: string) => void;
  onPlaytestMessage: (callback: (message: PlaytestMessage) => void) => () => void;
  onPlaytestJoined: (callback: (data: PlaytestJoinedEvent) => void) => () => void;
  onPlaytestLeft: (callback: (data: PlaytestLeftEvent) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const deckSyncListenersRef = useRef<Set<(event: DeckSyncStatusEvent) => void>>(
    new Set()
  );
  // Playtesting listeners
  const playtestMessageListenersRef = useRef<Set<(message: PlaytestMessage) => void>>(
    new Set()
  );
  const playtestJoinedListenersRef = useRef<Set<(data: PlaytestJoinedEvent) => void>>(
    new Set()
  );
  const playtestLeftListenersRef = useRef<Set<(data: PlaytestLeftEvent) => void>>(
    new Set()
  );
  // Ordered message delivery: don't enforce ordering until we see session:started
  const orderingActiveRef = useRef<boolean>(false);
  const nextExpectedSeqRef = useRef<number>(1);
  const messageBufferRef = useRef<Map<number, PlaytestMessage>>(new Map());
  const gapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token || !user) {
      // Disconnect if logged out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Connect with auth token to the server root (not /api path)
    console.log("[Socket] Connecting to:", SOCKET_URL);
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("[Socket] Connected");
      setIsConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.log("[Socket] Connection error:", error.message);
      setIsConnected(false);
    });

    // Listen for deck sync status updates
    socket.on("deck:sync:status", (event: DeckSyncStatusEvent) => {
      console.log("[Socket] Deck sync status:", event);
      deckSyncListenersRef.current.forEach((listener) => listener(event));
    });

    // Helper: deliver a message to all listeners
    const deliver = (msg: PlaytestMessage) => {
      playtestMessageListenersRef.current.forEach((listener) => listener(msg));
    };

    // Helper: drain contiguous buffered messages starting from `from`
    const drainBuffer = (from: number): number => {
      const buffer = messageBufferRef.current;
      let next = from;
      while (buffer.has(next)) {
        deliver(buffer.get(next)!);
        buffer.delete(next);
        next++;
      }
      return next;
    };

    // Helper: skip gap and flush all buffered messages in seq order
    const flushBufferSkippingGap = () => {
      const buffer = messageBufferRef.current;
      if (buffer.size === 0) return;

      const sortedSeqs = Array.from(buffer.keys()).sort((a, b) => a - b);
      const lowestSeq = sortedSeqs[0];
      console.log("[Socket] Gap timeout: skipping from seq %d to %d (%d messages buffered)",
        nextExpectedSeqRef.current, lowestSeq, buffer.size);

      nextExpectedSeqRef.current = lowestSeq;
      nextExpectedSeqRef.current = drainBuffer(lowestSeq);

      if (gapTimeoutRef.current) {
        clearTimeout(gapTimeoutRef.current);
        gapTimeoutRef.current = null;
      }
    };

    // Listen for playtest events — deliver to listeners in seq order
    socket.on("playtest:message", (message: PlaytestMessage) => {
      console.log("[Socket] Playtest message seq=%d type=%s", message.seq, message.type);

      // session:started activates ordering and resets state
      if (message.type === "session:started") {
        orderingActiveRef.current = true;
        nextExpectedSeqRef.current = message.seq;
        messageBufferRef.current.clear();
        if (gapTimeoutRef.current) {
          clearTimeout(gapTimeoutRef.current);
          gapTimeoutRef.current = null;
        }
      }

      // Before first session:started, pass messages through without ordering
      if (!orderingActiveRef.current) {
        deliver(message);
        return;
      }

      const expected = nextExpectedSeqRef.current;

      if (message.seq === expected) {
        // In order — deliver immediately, then flush any buffered follow-ups
        deliver(message);
        nextExpectedSeqRef.current = drainBuffer(expected + 1);

        // Clear gap timeout since we caught up
        if (gapTimeoutRef.current && messageBufferRef.current.size === 0) {
          clearTimeout(gapTimeoutRef.current);
          gapTimeoutRef.current = null;
        }
      } else if (message.seq > expected) {
        // Arrived early — buffer it
        console.log("[Socket] Buffering out-of-order message seq=%d (expected %d)", message.seq, expected);
        messageBufferRef.current.set(message.seq, message);

        // Start a gap timeout — if the missing message doesn't arrive in 2s, skip ahead
        if (!gapTimeoutRef.current) {
          gapTimeoutRef.current = setTimeout(flushBufferSkippingGap, 2000);
        }
      }
      // seq < expected means duplicate — ignore
    });

    socket.on("playtest:joined", (data: PlaytestJoinedEvent) => {
      console.log("[Socket] Playtest joined:", data);
      playtestJoinedListenersRef.current.forEach((listener) => listener(data));
    });

    socket.on("playtest:left", (data: PlaytestLeftEvent) => {
      console.log("[Socket] Playtest left:", data);
      playtestLeftListenersRef.current.forEach((listener) => listener(data));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      if (gapTimeoutRef.current) {
        clearTimeout(gapTimeoutRef.current);
        gapTimeoutRef.current = null;
      }
    };
  }, [token, user]);

  const onDeckSyncStatus = useCallback(
    (callback: (event: DeckSyncStatusEvent) => void) => {
      deckSyncListenersRef.current.add(callback);
      return () => {
        deckSyncListenersRef.current.delete(callback);
      };
    },
    []
  );

  // Playtesting methods
  const joinPlaytest = useCallback((deckId: string) => {
    if (socketRef.current?.connected) {
      console.log("[Socket] Joining playtest:", deckId);
      socketRef.current.emit("playtest:join", { deckId });
    }
  }, []);

  const leavePlaytest = useCallback((deckId: string) => {
    if (socketRef.current?.connected) {
      console.log("[Socket] Leaving playtest:", deckId);
      socketRef.current.emit("playtest:leave", { deckId });
    }
  }, []);

  const onPlaytestMessage = useCallback(
    (callback: (message: PlaytestMessage) => void) => {
      playtestMessageListenersRef.current.add(callback);
      return () => {
        playtestMessageListenersRef.current.delete(callback);
      };
    },
    []
  );

  const onPlaytestJoined = useCallback(
    (callback: (data: PlaytestJoinedEvent) => void) => {
      playtestJoinedListenersRef.current.add(callback);
      return () => {
        playtestJoinedListenersRef.current.delete(callback);
      };
    },
    []
  );

  const onPlaytestLeft = useCallback(
    (callback: (data: PlaytestLeftEvent) => void) => {
      playtestLeftListenersRef.current.add(callback);
      return () => {
        playtestLeftListenersRef.current.delete(callback);
      };
    },
    []
  );

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        onDeckSyncStatus,
        joinPlaytest,
        leavePlaytest,
        onPlaytestMessage,
        onPlaytestJoined,
        onPlaytestLeft,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}

export type { DeckSyncStatusEvent };
