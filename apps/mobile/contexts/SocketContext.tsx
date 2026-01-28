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

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

interface DeckSyncStatusEvent {
  deckId: string;
  status: "waiting" | "syncing" | "synced" | "error";
  error?: string | null;
  progress?: number; // 0-100
  timestamp: string;
}

interface SocketContextValue {
  isConnected: boolean;
  onDeckSyncStatus: (callback: (event: DeckSyncStatusEvent) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const deckSyncListenersRef = useRef<Set<(event: DeckSyncStatusEvent) => void>>(
    new Set()
  );

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

    // Connect with auth token
    const socket = io(API_URL, {
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

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
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

  return (
    <SocketContext.Provider value={{ isConnected, onDeckSyncStatus }}>
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
