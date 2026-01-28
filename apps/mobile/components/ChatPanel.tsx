import {
  Bot,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  advisorApi,
  API_URL,
  cardsApi,
  type CardSearchResult,
  type ChatMessage,
  type ChatSession,
  type DeckChange,
  type DeckDetail,
} from "~/lib/api";
import { secureStorage } from "~/lib/storage";
import { CardDetailModal } from "./CardDetailModal";
import EventSource from "react-native-sse";
import { showToast } from "~/lib/toast";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";

interface ChatPanelProps {
  deck: DeckDetail;
  visible: boolean;
  onClose: () => void;
  onDeckUpdated?: () => void;
  isDark: boolean;
}

export function ChatPanel({ deck, visible, onClose, onDeckUpdated, isDark }: ChatPanelProps) {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [showSessions, setShowSessions] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardSearchResult | null>(null);
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [loadingCard, setLoadingCard] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<{
    visible: boolean;
    sessionId: string;
  }>({ visible: false, sessionId: "" });
  const [confirmApplyAll, setConfirmApplyAll] = useState<{
    visible: boolean;
    changes: DeckChange[];
  }>({ visible: false, changes: [] });
  const [confirmRejectAll, setConfirmRejectAll] = useState<{
    visible: boolean;
    changes: DeckChange[];
  }>({ visible: false, changes: [] });

  // Load sessions on mount
  useEffect(() => {
    if (visible) {
      loadSessions();
    }
  }, [visible, deck.id]);

  // Cleanup EventSource on unmount or modal close
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [visible]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const result = await advisorApi.getSessions(deck.id);
      if (result.data) {
        setSessions(result.data);
        // Auto-select most recent session if available
        if (result.data.length > 0 && !activeSession) {
          setActiveSession(result.data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    try {
      const result = await advisorApi.createSession(deck.id);
      if (result.data) {
        setSessions((prev) => [result.data!, ...prev]);
        setActiveSession(result.data);
        setShowSessions(false);
      }
    } catch (err) {
      showToast.error("Failed to create session");
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setConfirmDeleteSession({ visible: true, sessionId });
  };

  const confirmDeleteSessionHandler = async () => {
    const { sessionId } = confirmDeleteSession;
    setConfirmDeleteSession({ visible: false, sessionId: "" });

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
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !activeSession || sending) return;

    const userMessage = message.trim();
    setMessage("");
    setSending(true);
    setStreamingContent("");

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
        return;
      }

      // Close any existing EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Create EventSource for SSE
      const eventSource = new EventSource(`${API_URL}/advisor/chat/${activeSession.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userMessage }),
      });

      eventSourceRef.current = eventSource;

      // Handle incoming messages
      eventSource.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "start":
              // Stream started
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
              setSending(false);
              inputRef.current?.focus();

              // Close the connection
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
              }
              break;

            case "error":
              showToast.error(data.error || "An error occurred");
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
              }
              setSending(false);
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
        inputRef.current?.focus();
      });

      // Handle connection open
      eventSource.addEventListener("open", () => {
        console.log("SSE connection opened");
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
      inputRef.current?.focus();
    }
  };

  const handleChangeStatus = async (changeId: string, status: "accepted" | "rejected") => {
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
        // Trigger deck refresh in parent component
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
  };

  const handleApplyAllChanges = async (changes: DeckChange[]) => {
    if (!activeSession) return;

    const pendingChanges = changes.filter((c) => c.status === "pending");
    if (pendingChanges.length === 0) return;

    setConfirmApplyAll({ visible: true, changes: pendingChanges });
  };

  const confirmApplyAllHandler = async () => {
    const pendingChanges = confirmApplyAll.changes;
    setConfirmApplyAll({ visible: false, changes: [] });

    if (!activeSession) return;

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
  };

  const handleRejectAllChanges = async (changes: DeckChange[]) => {
    if (!activeSession) return;

    const pendingChanges = changes.filter((c) => c.status === "pending");
    if (pendingChanges.length === 0) return;

    setConfirmRejectAll({ visible: true, changes: pendingChanges });
  };

  const confirmRejectAllHandler = async () => {
    const pendingChanges = confirmRejectAll.changes;
    setConfirmRejectAll({ visible: false, changes: [] });

    if (!activeSession) return;

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
  };

  const handleCardClick = async (cardName: string) => {
    setLoadingCard(true);
    setCardModalVisible(true);

    try {
      // Search for the card
      const result = await cardsApi.search(cardName);
      if (result.data && result.data.cards && result.data.cards.length > 0) {
        setSelectedCard(result.data.cards[0]);
      } else {
        showToast.error(`Could not find card: ${cardName}`);
        setCardModalVisible(false);
      }
    } catch (err) {
      console.error("Failed to load card:", err);
      showToast.error("Failed to load card details");
      setCardModalVisible(false);
    } finally {
      setLoadingCard(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.role === "user";

    return (
      <View
        key={msg.id}
        className={`p-4 rounded-xl mb-3 ${
          isUser
            ? isDark
              ? "bg-purple-900/30"
              : "bg-purple-50"
            : isDark
              ? "bg-slate-800"
              : "bg-slate-100"
        }`}
      >
        <View className="flex-row items-center gap-2 mb-2">
          <View
            className={`h-6 w-6 rounded-full items-center justify-center ${
              isUser ? "bg-purple-500" : isDark ? "bg-slate-700" : "bg-slate-300"
            }`}
          >
            {isUser ? (
              <User size={14} color="white" />
            ) : (
              <Bot size={14} color={isDark ? "#94a3b8" : "#64748b"} />
            )}
          </View>
          <Text className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
            {isUser ? "You" : "Deck Advisor"}
          </Text>
          <Text className={`text-xs ml-auto ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            {formatTime(msg.timestamp)}
          </Text>
        </View>
        <Text className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
          {msg.content}
        </Text>

        {/* Suggested Changes */}
        {msg.suggestedChanges && msg.suggestedChanges.length > 0 && (
          <View className={`mt-3 pt-3 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
            <Text className={`text-xs font-medium mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Suggested Changes ({msg.suggestedChanges.length})
            </Text>
            {msg.suggestedChanges.map((change) => (
              <View
                key={change.id}
                className={`flex-row items-center gap-2 py-1 ${
                  change.status !== "pending" ? "opacity-50" : ""
                }`}
              >
                <Text className={`text-xs font-mono ${
                  change.action === "add"
                    ? "text-purple-500"
                    : change.action === "remove"
                      ? "text-red-500"
                      : "text-amber-500"
                }`}>
                  {change.action === "add" ? "+" : change.action === "remove" ? "-" : "↔"}
                </Text>
                <View className="flex-1 flex-row flex-wrap items-center">
                  {change.action === "swap" ? (
                    <>
                      <Pressable onPress={() => handleCardClick(change.cardName)}>
                        <Text className={`text-sm underline ${isDark ? "text-white" : "text-slate-900"}`}>
                          {change.cardName}
                        </Text>
                      </Pressable>
                      <Text className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}> → </Text>
                      <Pressable onPress={() => handleCardClick(change.targetCardName || "")}>
                        <Text className={`text-sm underline ${isDark ? "text-white" : "text-slate-900"}`}>
                          {change.targetCardName}
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                        {change.quantity}x{" "}
                      </Text>
                      <Pressable onPress={() => handleCardClick(change.cardName)}>
                        <Text className={`text-sm underline ${isDark ? "text-white" : "text-slate-900"}`}>
                          {change.cardName}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
                {change.status === "pending" && (
                  <View className="flex-row gap-1">
                    <Pressable
                      onPress={() => handleChangeStatus(change.id, "accepted")}
                      className="px-2 py-1 rounded bg-purple-500"
                    >
                      <Text className="text-white text-xs">Apply</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleChangeStatus(change.id, "rejected")}
                      className={`px-2 py-1 rounded ${isDark ? "bg-slate-600" : "bg-slate-200"}`}
                    >
                      <Text className={`text-xs ${isDark ? "text-white" : "text-slate-900"}`}>Reject</Text>
                    </Pressable>
                  </View>
                )}
                {change.status !== "pending" && (
                  <Text className={`text-xs ${change.status === "accepted" ? "text-purple-500" : "text-red-500"}`}>
                    {change.status}
                  </Text>
                )}
              </View>
            ))}

            {/* Apply All / Reject All Buttons */}
            {msg.suggestedChanges.some((c) => c.status === "pending") && (
              <View className="flex-row gap-2 mt-3 pt-2 border-t border-slate-700/50">
                <Pressable
                  onPress={() => handleApplyAllChanges(msg.suggestedChanges || [])}
                  className="flex-1 px-3 py-2 rounded-lg bg-purple-500 items-center"
                >
                  <Text className="text-white text-xs font-medium">Apply All</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleRejectAllChanges(msg.suggestedChanges || [])}
                  className={`flex-1 px-3 py-2 rounded-lg items-center ${
                    isDark ? "bg-slate-700" : "bg-slate-200"
                  }`}
                >
                  <Text className={`text-xs font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                    Reject All
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`} style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          <View className="flex-row items-center gap-2">
            <MessageSquare size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            <Text className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              AI Advisor
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={handleCreateSession}
              className={`rounded-full p-2 ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
            >
              <Plus size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
            <Pressable onPress={onClose} className="rounded-full p-2">
              <X size={24} color={isDark ? "white" : "#1e293b"} />
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#7C3AED" />
            </View>
          ) : (
            <>
              {/* Sessions dropdown */}
              {sessions.length > 0 && (
                <Pressable
                  onPress={() => setShowSessions(!showSessions)}
                  className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
                >
                  <Text className={isDark ? "text-white" : "text-slate-900"}>
                    {activeSession?.name || "Select Session"}
                  </Text>
                  {showSessions ? (
                    <ChevronDown size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                  ) : (
                    <ChevronRight size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                  )}
                </Pressable>
              )}

              {showSessions && (
                <View className={`border-b ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
                  {sessions.map((session) => (
                    <Pressable
                      key={session.id}
                      onPress={() => {
                        setActiveSession(session);
                        setShowSessions(false);
                      }}
                      className={`flex-row items-center justify-between px-4 py-3 ${
                        activeSession?.id === session.id
                          ? isDark
                            ? "bg-purple-900/30"
                            : "bg-purple-50"
                          : ""
                      }`}
                    >
                      <Text
                        className={`flex-1 ${
                          activeSession?.id === session.id
                            ? "text-purple-500 font-medium"
                            : isDark
                              ? "text-white"
                              : "text-slate-900"
                        }`}
                      >
                        {session.name}
                      </Text>
                      <Pressable
                        onPress={() => handleDeleteSession(session.id)}
                        className="p-1"
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </Pressable>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Chat area */}
              {activeSession ? (
                <>
                  <ScrollView
                    ref={scrollViewRef}
                    className="flex-1 px-4 pt-4"
                    contentContainerStyle={{ paddingBottom: 16 }}
                  >
                    {activeSession.messages.length === 0 && !streamingContent ? (
                      <View className="items-center py-12">
                        <Bot size={48} color={isDark ? "#334155" : "#cbd5e1"} />
                        <Text className={`mt-4 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          Ask me about improving your deck!
                        </Text>
                        <Text className={`text-sm mt-2 text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                          I can suggest card additions, removals, and swaps.
                        </Text>
                      </View>
                    ) : (
                      <>
                        {activeSession.messages.map(renderMessage)}
                        {/* Streaming message */}
                        {sending && streamingContent && (
                          <View className={`p-4 rounded-xl mb-3 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                            <View className="flex-row items-center gap-2 mb-2">
                              <View className={`h-6 w-6 rounded-full items-center justify-center ${isDark ? "bg-slate-700" : "bg-slate-300"}`}>
                                <Bot size={14} color={isDark ? "#94a3b8" : "#64748b"} />
                              </View>
                              <Text className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                                Deck Advisor
                              </Text>
                            </View>
                            <Text className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                              {streamingContent}
                              <Text className="text-purple-500">▊</Text>
                            </Text>
                          </View>
                        )}
                        {sending && !streamingContent && (
                          <View className="flex-row items-center gap-2 p-4">
                            <Loader2 size={16} color="#7C3AED" className="animate-spin" />
                            <Text className={isDark ? "text-slate-400" : "text-slate-500"}>Thinking...</Text>
                          </View>
                        )}
                      </>
                    )}
                  </ScrollView>

                  {/* Input area */}
                  <View
                    className={`flex-row items-end gap-2 px-4 pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}
                    style={{ paddingBottom: Math.max(12, insets.bottom) }}
                  >
                    <TextInput
                      ref={inputRef}
                      className={`flex-1 rounded-xl px-4 py-3 min-h-[48px] max-h-[120px] ${
                        isDark ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-900"
                      }`}
                      placeholder="Ask about your deck..."
                      placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                      value={message}
                      onChangeText={setMessage}
                      multiline
                      editable={!sending}
                    />
                    <Pressable
                      onPress={handleSendMessage}
                      disabled={!message.trim() || sending}
                      className={`h-12 w-12 rounded-full items-center justify-center ${
                        !message.trim() || sending
                          ? isDark
                            ? "bg-slate-800"
                            : "bg-slate-200"
                          : "bg-purple-500"
                      }`}
                    >
                      {sending ? (
                        <ActivityIndicator color={isDark ? "#64748b" : "#94a3b8"} size="small" />
                      ) : (
                        <Send
                          size={20}
                          color={!message.trim() ? (isDark ? "#64748b" : "#94a3b8") : "white"}
                        />
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                <View className="flex-1 items-center justify-center px-6">
                  <MessageSquare size={48} color={isDark ? "#334155" : "#cbd5e1"} />
                  <Text className={`mt-4 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    No chat session selected
                  </Text>
                  <Pressable
                    onPress={handleCreateSession}
                    className="mt-4 bg-purple-500 px-6 py-3 rounded-xl flex-row items-center gap-2"
                  >
                    <Plus size={18} color="white" />
                    <Text className="text-white font-medium">Start New Chat</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </KeyboardAvoidingView>
      </View>

      {/* Card Detail Modal */}
      <CardDetailModal
        visible={cardModalVisible}
        onClose={() => {
          setCardModalVisible(false);
          setSelectedCard(null);
        }}
        card={selectedCard}
      />

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        visible={confirmDeleteSession.visible}
        title="Delete Session"
        message="Are you sure you want to delete this session?"
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        onConfirm={confirmDeleteSessionHandler}
        onCancel={() => setConfirmDeleteSession({ visible: false, sessionId: "" })}
      />

      <ConfirmDialog
        visible={confirmApplyAll.visible}
        title="Apply All Changes"
        message={`Apply all ${confirmApplyAll.changes.length} suggested ${confirmApplyAll.changes.length === 1 ? "change" : "changes"}?`}
        confirmText="Apply All"
        cancelText="Cancel"
        onConfirm={confirmApplyAllHandler}
        onCancel={() => setConfirmApplyAll({ visible: false, changes: [] })}
      />

      <ConfirmDialog
        visible={confirmRejectAll.visible}
        title="Reject All Changes"
        message={`Reject all ${confirmRejectAll.changes.length} suggested ${confirmRejectAll.changes.length === 1 ? "change" : "changes"}?`}
        confirmText="Reject All"
        cancelText="Cancel"
        destructive
        onConfirm={confirmRejectAllHandler}
        onCancel={() => setConfirmRejectAll({ visible: false, changes: [] })}
      />
    </Modal>
  );
}
