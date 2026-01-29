import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, TextInput } from "react-native";
import EventSource from "react-native-sse";
import {
  advisorApi,
  API_URL,
  type ChatMessage,
  type ChatSession,
  type DeckChange,
  type DeckDetail,
} from "~/lib/api";
import { secureStorage } from "~/lib/storage";
import { showToast } from "~/lib/toast";

export interface UseAdvisorChatProps {
  deck: DeckDetail | null;
  onDeckUpdated?: () => void;
}

export interface UseAdvisorChatReturn {
  // State
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  loading: boolean;
  sending: boolean;
  message: string;
  streamingContent: string;
  includeCollection: boolean;
  statusMessage: string | null;

  // Actions
  setMessage: (msg: string) => void;
  sendMessage: (messageOverride?: string) => Promise<void>;
  createSession: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  selectSession: (session: ChatSession) => void;
  loadSessions: () => Promise<void>;
  handleChangeStatus: (changeId: string, status: "accepted" | "rejected") => Promise<void>;
  handleApplyAllChanges: (changes: DeckChange[]) => Promise<void>;
  handleRejectAllChanges: (changes: DeckChange[]) => Promise<void>;
  setIncludeCollection: (value: boolean) => void;

  // Refs for UI integration
  inputRef: React.RefObject<TextInput | null>;
  scrollViewRef: React.RefObject<ScrollView | null>;

  // Connection state
  connectionState: "disconnected" | "connecting" | "connected";
}

/**
 * Hook for managing AI advisor chat state and logic
 *
 * @example
 * ```tsx
 * const advisorChat = useAdvisorChat({ deck, onDeckUpdated });
 *
 * // Pass to ChatPanel or AdvisorSidePanel
 * <ChatPanel {...advisorChat} />
 * ```
 */
export function useAdvisorChat({ deck, onDeckUpdated }: UseAdvisorChatProps): UseAdvisorChatReturn {
  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Message state
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [includeCollection, setIncludeCollection] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Connection state
  const [connectionState, setConnectionState] = useState<"disconnected" | "connecting" | "connected">("disconnected");

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load sessions when deck changes
  useEffect(() => {
    if (deck?.id) {
      loadSessions();
    }
  }, [deck?.id]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setConnectionState("disconnected");
      }
    };
  }, []);

  const loadSessions = useCallback(async () => {
    if (!deck?.id) return;

    setLoading(true);
    try {
      const result = await advisorApi.getSessions(deck.id);
      if (result.data) {
        setSessions(result.data);
        // Auto-select most recent session if available, or create one if none exist
        if (result.data.length > 0 && !activeSession) {
          setActiveSession(result.data[0]);
        } else if (result.data.length === 0) {
          // Auto-create a session if none exist
          const newSession = await advisorApi.createSession(deck.id);
          if (newSession.data) {
            setSessions([newSession.data]);
            setActiveSession(newSession.data);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [deck?.id, activeSession]);

  const createSession = useCallback(async () => {
    if (!deck?.id) return;

    try {
      const result = await advisorApi.createSession(deck.id);
      if (result.data) {
        setSessions((prev) => [result.data!, ...prev]);
        setActiveSession(result.data);
      }
    } catch (err) {
      showToast.error("Failed to create session");
    }
  }, [deck?.id]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      // Optimistically remove from UI
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        const remainingSessions = sessions.filter((s) => s.id !== sessionId);
        setActiveSession(remainingSessions[0] || null);
      }

      // Delete from backend
      const result = await advisorApi.deleteSession(sessionId);
      if (result.error) {
        throw new Error(result.error);
      }
      showToast.success("Session deleted successfully");
    } catch (err: any) {
      console.error("Failed to delete session:", err);
      showToast.error(err.message || "Failed to delete session");
      // Reload sessions to restore on error
      loadSessions();
    }
  }, [activeSession?.id, sessions, loadSessions]);

  const selectSession = useCallback((session: ChatSession) => {
    setActiveSession(session);
  }, []);

  const sendMessage = useCallback(async (messageOverride?: string) => {
    const msgToSend = messageOverride ?? message;
    if (!msgToSend.trim() || sending) return;

    // If no active session, create one first
    let sessionToUse = activeSession;
    if (!sessionToUse && deck?.id) {
      try {
        const result = await advisorApi.createSession(deck.id);
        if (result.data) {
          setSessions((prev) => [result.data!, ...prev]);
          setActiveSession(result.data);
          sessionToUse = result.data;
        }
      } catch (err) {
        showToast.error("Failed to create session");
        return;
      }
    }

    if (!sessionToUse) return;

    const userMessage = msgToSend.trim();
    setMessage("");
    setSending(true);
    setStreamingContent("");
    setConnectionState("connecting");

    // Optimistically add user message to UI
    const tempUserMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 15),
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    };

    setActiveSession((prev) =>
      prev
        ? {
            ...prev,
            messages: [...prev.messages, tempUserMessage],
          }
        : null
    );

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    let fullContent = "";
    let changes: DeckChange[] = [];

    try {
      const token = await secureStorage.getItem("auth_token");
      if (!token) {
        showToast.error("Not authenticated");
        setSending(false);
        setConnectionState("disconnected");
        return;
      }

      // Close any existing EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Create EventSource for SSE
      const eventSource = new EventSource(`${API_URL}/advisor/chat/${sessionToUse.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userMessage, includeCollection }),
      });

      eventSourceRef.current = eventSource;

      // Handle incoming messages
      eventSource.addEventListener("message", (event) => {
        try {
          console.log("[SSE] Raw event received:", event.data);
          if (!event.data) return;
          const data = JSON.parse(event.data);
          console.log("[SSE] Parsed event:", data.type, data);

          switch (data.type) {
            case "start":
              setConnectionState("connected");
              break;

            case "status":
              console.log("[ADVISOR] Status update:", data.message);
              setStatusMessage(data.message || null);
              // Scroll to show status indicator
              if (data.message) {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 50);
              }
              break;

            case "content":
              if (data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
                // Scroll on content update
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: false });
                }, 0);
              }
              break;

            case "changes":
              if (data.changes) {
                changes = data.changes;
              }
              break;

            case "done":
              // Stream completed - add assistant message
              const assistantMessage: ChatMessage = {
                id: Math.random().toString(36).substring(2, 15),
                role: "assistant",
                content: fullContent,
                timestamp: new Date().toISOString(),
                suggestedChanges: changes,
              };

              setActiveSession((prev) =>
                prev
                  ? {
                      ...prev,
                      messages: [...prev.messages, assistantMessage],
                      pendingChanges: [...prev.pendingChanges, ...changes],
                    }
                  : null
              );
              setStreamingContent("");
              setStatusMessage(null);
              setSending(false);
              setConnectionState("disconnected");
              inputRef.current?.focus();

              // Close the connection
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
              }
              break;

            case "session_updated":
              // Backend updated the session (e.g., renamed after first message)
              if (data.name) {
                setActiveSession((prev) =>
                  prev ? { ...prev, name: data.name } : null
                );
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === sessionToUse.id ? { ...s, name: data.name } : s
                  )
                );
              }
              break;

            case "error":
              showToast.error(data.error || "An error occurred");
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
              }
              setStatusMessage(null);
              setSending(false);
              setConnectionState("disconnected");
              break;
          }
        } catch (parseError) {
          console.warn("Failed to parse SSE data:", event.data, parseError);
        }
      });

      // Handle errors
      eventSource.addEventListener("error", (error) => {
        console.error("SSE error:", error);

        // Remove optimistic user message on error
        setActiveSession((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.slice(0, -1),
              }
            : null
        );

        showToast.error("Failed to send message");
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        setSending(false);
        setStreamingContent("");
        setStatusMessage(null);
        setConnectionState("disconnected");
        inputRef.current?.focus();
      });

      // Handle connection open
      eventSource.addEventListener("open", () => {
        console.log("SSE connection opened");
        setConnectionState("connected");
      });

    } catch (err: any) {
      console.error("Chat error:", err);
      showToast.error(err.message || "Failed to send message");

      // Remove optimistic user message on error
      setActiveSession((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.slice(0, -1),
            }
          : null
      );

      setSending(false);
      setStreamingContent("");
      setStatusMessage(null);
      setConnectionState("disconnected");
      inputRef.current?.focus();
    }
  }, [message, activeSession, sending, includeCollection, deck?.id]);

  const handleChangeStatus = useCallback(async (changeId: string, status: "accepted" | "rejected") => {
    if (!activeSession) return;

    try {
      // Optimistically update the UI
      setActiveSession((prev) => {
        if (!prev) return prev;

        // Update the status in messages' suggestedChanges
        const updatedMessages = prev.messages.map((msg) => {
          if (msg.suggestedChanges) {
            return {
              ...msg,
              suggestedChanges: msg.suggestedChanges.map((c) =>
                c.id === changeId ? { ...c, status } : c
              ),
            };
          }
          return msg;
        });

        // Remove from pending if accepted or rejected
        const updatedPending = prev.pendingChanges.filter((c) => c.id !== changeId);

        return {
          ...prev,
          messages: updatedMessages,
          pendingChanges: updatedPending,
        };
      });

      // Make the API call
      const result = await advisorApi.updateChangeStatus(activeSession.id, changeId, status);
      if (result.error) {
        throw new Error(result.error);
      }

      // Show success message and refresh deck
      if (status === "accepted") {
        showToast.success("Change applied to deck");
        onDeckUpdated?.();
      }
    } catch (err: any) {
      console.error("Failed to update change status:", err);
      showToast.error(err.message || "Failed to update change status");

      // Revert optimistic update on error - reload session
      try {
        const session = await advisorApi.getSession(activeSession.id);
        if (session.data) {
          setActiveSession(session.data);
        }
      } catch {
        // Ignore reload errors
      }
    }
  }, [activeSession, onDeckUpdated]);

  const handleApplyAllChanges = useCallback(async (changes: DeckChange[]) => {
    if (!activeSession) return;

    const pendingChanges = changes.filter((c) => c.status === "pending");
    if (pendingChanges.length === 0) return;

    try {
      const changeIds = pendingChanges.map((c) => c.id);
      console.log(`[FRONTEND] Applying ${changeIds.length} changes via bulk API`);

      // Optimistically update the UI
      setActiveSession((prev) => {
        if (!prev) return prev;

        // Update the status in messages' suggestedChanges
        const updatedMessages = prev.messages.map((msg) => {
          if (msg.suggestedChanges) {
            return {
              ...msg,
              suggestedChanges: msg.suggestedChanges.map((c) =>
                changeIds.includes(c.id) ? { ...c, status: "accepted" as const } : c
              ),
            };
          }
          return msg;
        });

        // Remove from pending
        const updatedPending = prev.pendingChanges.filter((c) => !changeIds.includes(c.id));

        return {
          ...prev,
          messages: updatedMessages,
          pendingChanges: updatedPending,
        };
      });

      // Make the bulk API call
      const result = await advisorApi.bulkUpdateChangeStatus(
        activeSession.id,
        changeIds,
        "accepted"
      );

      if (result.error) {
        throw new Error(result.error);
      }

      // Show success message and refresh deck
      showToast.success(`Applied ${pendingChanges.length} ${pendingChanges.length === 1 ? "change" : "changes"} to deck`);
      onDeckUpdated?.();
    } catch (err: any) {
      console.error("Failed to apply all changes:", err);
      showToast.error(err.message || "Failed to apply changes");

      // Revert optimistic update on error - reload session
      try {
        const session = await advisorApi.getSession(activeSession.id);
        if (session.data) {
          setActiveSession(session.data);
        }
      } catch {
        // Ignore reload errors
      }
    }
  }, [activeSession, onDeckUpdated]);

  const handleRejectAllChanges = useCallback(async (changes: DeckChange[]) => {
    if (!activeSession) return;

    const pendingChanges = changes.filter((c) => c.status === "pending");
    if (pendingChanges.length === 0) return;

    try {
      const changeIds = pendingChanges.map((c) => c.id);

      // Optimistically update the UI
      setActiveSession((prev) => {
        if (!prev) return prev;

        // Update the status in messages' suggestedChanges
        const updatedMessages = prev.messages.map((msg) => {
          if (msg.suggestedChanges) {
            return {
              ...msg,
              suggestedChanges: msg.suggestedChanges.map((c) =>
                changeIds.includes(c.id) ? { ...c, status: "rejected" as const } : c
              ),
            };
          }
          return msg;
        });

        // Remove from pending
        const updatedPending = prev.pendingChanges.filter((c) => !changeIds.includes(c.id));

        return {
          ...prev,
          messages: updatedMessages,
          pendingChanges: updatedPending,
        };
      });

      // Make the bulk API call
      const result = await advisorApi.bulkUpdateChangeStatus(
        activeSession.id,
        changeIds,
        "rejected"
      );

      if (result.error) {
        throw new Error(result.error);
      }
      showToast.success("Changes rejected");
    } catch (err: any) {
      console.error("Failed to reject all changes:", err);
      showToast.error(err.message || "Failed to reject changes");

      // Revert optimistic update on error - reload session
      try {
        const session = await advisorApi.getSession(activeSession.id);
        if (session.data) {
          setActiveSession(session.data);
        }
      } catch {
        // Ignore reload errors
      }
    }
  }, [activeSession]);

  return {
    // State
    sessions,
    activeSession,
    loading,
    sending,
    message,
    streamingContent,
    includeCollection,
    statusMessage,

    // Actions
    setMessage,
    sendMessage,
    createSession,
    deleteSession,
    selectSession,
    loadSessions,
    handleChangeStatus,
    handleApplyAllChanges,
    handleRejectAllChanges,
    setIncludeCollection,

    // Refs
    inputRef,
    scrollViewRef,

    // Connection state
    connectionState,
  };
}
