import {
  ArrowUp,
  Bot,
  FolderOpen,
  GripVertical,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Plus,
  Sparkles,
  User,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";
import { Button } from "~/components/ui/button";
import { AdvisorQuickActions } from "~/components/AdvisorQuickActions";
import {
  cardsApi,
  type CardSearchResult,
  type ChatMessage,
  type ChatSession,
  type DeckChange,
  type DeckDetail,
} from "~/lib/api";
import { showToast } from "~/lib/toast";
import { CardDetailModal } from "./CardDetailModal";
import { ChatHistoryModal } from "./ChatHistoryModal";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import type { UseAdvisorChatReturn } from "~/hooks/useAdvisorChat";

const PANEL_WIDTH_KEY = "advisor_panel_width";
const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 320;
const MAX_WIDTH = 600;

interface AdvisorSidePanelProps extends UseAdvisorChatReturn {
  deck: DeckDetail;
  visible: boolean;
  onClose: () => void;
}

// Input component with internal state to prevent parent re-renders on typing
interface SidePanelInputProps {
  onSend: (message: string) => void;
  sending: boolean;
  includeCollection: boolean;
  setIncludeCollection: (value: boolean) => void;
  isDark: boolean;
}

function SidePanelInput({
  onSend,
  sending,
  includeCollection,
  setIncludeCollection,
  isDark,
}: SidePanelInputProps) {
  const [localMessage, setLocalMessage] = useState("");

  const handleSend = useCallback(() => {
    if (localMessage.trim() && !sending) {
      onSend(localMessage.trim());
      setLocalMessage("");
    }
  }, [localMessage, sending, onSend]);

  return (
    <View className={`px-4 py-3 ${isDark ? "bg-gray-950" : "bg-gray-50"}`}>
      <Pressable
        onPress={() => setIncludeCollection(!includeCollection)}
        className={`flex-row items-center gap-2 mb-3 px-3 py-2 rounded-full self-start border ${
          includeCollection
            ? isDark
              ? "border-purple-500/50 bg-purple-900/20"
              : "border-purple-300 bg-purple-50"
            : isDark
              ? "border-slate-700 bg-transparent"
              : "border-slate-200 bg-white"
        }`}
        accessibilityRole="switch"
        accessibilityState={{ checked: includeCollection }}
        accessibilityLabel="Consider my collection when making suggestions"
      >
        <FolderOpen
          size={14}
          color={includeCollection ? "#7C3AED" : isDark ? "#64748b" : "#94a3b8"}
        />
        <Text
          className={`text-xs ${
            includeCollection
              ? "text-purple-400 font-medium"
              : isDark
                ? "text-slate-400"
                : "text-slate-500"
          }`}
        >
          Consider my collection
        </Text>
      </Pressable>
      <View
        className={`flex-row items-end rounded-2xl border px-3 py-2 ${
          isDark
            ? "border-slate-700 bg-slate-900/50"
            : "border-slate-200 bg-white"
        }`}
      >
        <TextInput
          value={localMessage}
          onChangeText={setLocalMessage}
          placeholder="Ask about your deck..."
          placeholderTextColor={isDark ? "#64748b" : "#9ca3af"}
          multiline
          maxLength={2000}
          onSubmitEditing={handleSend}
          className={`flex-1 min-h-[40px] max-h-[100px] px-2 py-2 text-base ${
            isDark ? "text-white" : "text-slate-900"
          }`}
          editable={!sending}
          accessibilityLabel="Message input"
          accessibilityHint="Type your question about the deck"
        />
        <Pressable
          onPress={handleSend}
          disabled={!localMessage.trim() || sending}
          className={`h-10 w-10 rounded-xl items-center justify-center ml-2 focus-visible:ring-2 focus-visible:ring-purple-500 ${
            !localMessage.trim() || sending
              ? isDark
                ? "bg-slate-700"
                : "bg-slate-100"
              : isDark
                ? "bg-white"
                : "bg-slate-900"
          }`}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !localMessage.trim() || sending }}
        >
          {sending ? (
            <Loader2 size={20} color="#7C3AED" className="animate-spin" style={{ transformOrigin: 'center' }} />
          ) : (
            <ArrowUp
              size={20}
              color={
                !localMessage.trim()
                  ? isDark
                    ? "#64748b"
                    : "#94a3b8"
                  : isDark
                    ? "#1f2937"
                    : "white"
              }
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function AdvisorSidePanel({
  deck,
  visible,
  onClose,
  // Hook state
  sessions,
  activeSession,
  loading,
  sending,
  streamingContent,
  includeCollection,
  statusMessage,
  // Hook actions
  sendMessage,
  createSession,
  deleteSession,
  selectSession,
  handleChangeStatus,
  handleApplyAllChanges,
  handleRejectAllChanges,
  setIncludeCollection,
  // Hook refs
  scrollViewRef,
}: AdvisorSidePanelProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Panel width state
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // UI state
  const [showHistory, setShowHistory] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardSearchResult | null>(
    null,
  );
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [loadingCard, setLoadingCard] = useState(false);
  const [selectedChangeContext, setSelectedChangeContext] = useState<
    | {
        change: DeckChange;
        sessionId: string;
        deckName: string;
      }
    | undefined
  >(undefined);

  // Confirmation dialogs
  const [confirmApplyAll, setConfirmApplyAll] = useState<{
    visible: boolean;
    changes: DeckChange[];
  }>({ visible: false, changes: [] });
  const [confirmRejectAll, setConfirmRejectAll] = useState<{
    visible: boolean;
    changes: DeckChange[];
  }>({ visible: false, changes: [] });

  // Load saved panel width
  useEffect(() => {
    AsyncStorage.getItem(PANEL_WIDTH_KEY).then((saved) => {
      if (saved) {
        const width = parseInt(saved, 10);
        if (width >= MIN_WIDTH && width <= MAX_WIDTH) {
          setPanelWidth(width);
        }
      }
    });
  }, []);

  // Save panel width on change
  useEffect(() => {
    if (!isResizing) {
      AsyncStorage.setItem(PANEL_WIDTH_KEY, panelWidth.toString());
    }
  }, [panelWidth, isResizing]);

  // Keyboard handling for Escape
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, onClose]);

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      resizeRef.current = { startX: e.clientX, startWidth: panelWidth };
    },
    [panelWidth],
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startX - e.clientX;
      const newWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, resizeRef.current.startWidth + delta),
      );
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleCardClick = async (cardName: string, change?: DeckChange) => {
    setLoadingCard(true);
    setCardModalVisible(true);

    // Set change context if provided
    if (change && activeSession) {
      setSelectedChangeContext({
        change,
        sessionId: activeSession.id,
        deckName: deck.name,
      });
    } else {
      setSelectedChangeContext(undefined);
    }

    try {
      const result = await cardsApi.search(cardName);
      if (result.data && result.data.cards && result.data.cards.length > 0) {
        setSelectedCard(result.data.cards[0]);
      } else {
        showToast.error(`Could not find card: ${cardName}`);
        setCardModalVisible(false);
        setSelectedChangeContext(undefined);
      }
    } catch (err) {
      console.error("Failed to load card:", err);
      showToast.error("Failed to load card details");
      setCardModalVisible(false);
      setSelectedChangeContext(undefined);
    } finally {
      setLoadingCard(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleApplyAllClick = (changes: DeckChange[]) => {
    const pendingChanges = changes.filter((c) => c.status === "pending");
    if (pendingChanges.length === 0) return;
    setConfirmApplyAll({ visible: true, changes: pendingChanges });
  };

  const confirmApplyAllHandler = async () => {
    const { changes } = confirmApplyAll;
    setConfirmApplyAll({ visible: false, changes: [] });
    await handleApplyAllChanges(changes);
  };

  const handleRejectAllClick = (changes: DeckChange[]) => {
    const pendingChanges = changes.filter((c) => c.status === "pending");
    if (pendingChanges.length === 0) return;
    setConfirmRejectAll({ visible: true, changes: pendingChanges });
  };

  const confirmRejectAllHandler = async () => {
    const { changes } = confirmRejectAll;
    setConfirmRejectAll({ visible: false, changes: [] });
    await handleRejectAllChanges(changes);
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
              isUser
                ? "bg-purple-600"
                : isDark
                  ? "bg-slate-700"
                  : "bg-slate-300"
            }`}
          >
            {isUser ? (
              <User size={14} color="white" />
            ) : (
              <Bot size={14} color={isDark ? "#A78BFA" : "#7C3AED"} />
            )}
          </View>
          <Text
            className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}
          >
            {isUser ? "You" : "Deck Advisor"}
          </Text>
          <Text
            className={`text-xs ml-auto ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
            {formatTime(msg.timestamp)}
          </Text>
        </View>
        <Text
          className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}
        >
          {msg.content}
        </Text>

        {/* Suggested Changes */}
        {msg.suggestedChanges && msg.suggestedChanges.length > 0 && (
          <View
            className={`mt-3 pt-3 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}
          >
            <Text
              className={`text-xs font-medium mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Suggested Changes ({msg.suggestedChanges.length})
            </Text>
            {msg.suggestedChanges.map((change) => (
              <View
                key={change.id}
                className={`flex-row items-center gap-2 py-2 ${
                  change.status !== "pending" ? "opacity-50" : ""
                }`}
              >
                <Text
                  className={`text-xs font-mono ${
                    change.action === "add"
                      ? "text-purple-400"
                      : change.action === "remove"
                        ? "text-red-500"
                        : "text-amber-500"
                  }`}
                >
                  {change.action === "add"
                    ? "+"
                    : change.action === "remove"
                      ? "-"
                      : "↔"}
                </Text>
                <View className="flex-1 flex-row flex-wrap items-center">
                  {change.action === "swap" ? (
                    <>
                      <Pressable
                        onPress={() => handleCardClick(change.cardName, change)}
                      >
                        <Text
                          className={`text-sm underline ${isDark ? "text-white" : "text-slate-900"}`}
                        >
                          {change.cardName}
                        </Text>
                      </Pressable>
                      <Text
                        className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        {" "}
                        →{" "}
                      </Text>
                      <Pressable
                        onPress={() =>
                          handleCardClick(change.targetCardName || "", change)
                        }
                      >
                        <Text
                          className={`text-sm underline ${isDark ? "text-white" : "text-slate-900"}`}
                        >
                          {change.targetCardName}
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text
                        className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        {change.quantity}x{" "}
                      </Text>
                      <Pressable
                        onPress={() => handleCardClick(change.cardName, change)}
                      >
                        <Text
                          className={`text-sm underline ${isDark ? "text-white" : "text-slate-900"}`}
                        >
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
                      className="px-3 py-2 rounded bg-purple-600 focus-visible:ring-2 focus-visible:ring-purple-500"
                      accessibilityRole="button"
                      accessibilityLabel={`Apply ${change.cardName}`}
                    >
                      <Text className="text-white text-xs">Apply</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleChangeStatus(change.id, "rejected")}
                      className={`px-3 py-2 rounded focus-visible:ring-2 focus-visible:ring-purple-500 ${isDark ? "bg-slate-600" : "bg-slate-200"}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Reject ${change.cardName}`}
                    >
                      <Text
                        className={`text-xs ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        Reject
                      </Text>
                    </Pressable>
                  </View>
                )}
                {change.status !== "pending" && (
                  <Text
                    className={`text-xs ${change.status === "accepted" ? "text-purple-400" : "text-red-500"}`}
                  >
                    {change.status}
                  </Text>
                )}
              </View>
            ))}

            {/* Apply All / Reject All Buttons */}
            {msg.suggestedChanges.some((c) => c.status === "pending") && (
              <View className="flex-row gap-2 mt-3 pt-2 border-t border-slate-700/50">
                <Pressable
                  onPress={() =>
                    handleApplyAllClick(msg.suggestedChanges || [])
                  }
                  className="flex-1 px-3 py-2 rounded-lg bg-purple-600 items-center focus-visible:ring-2 focus-visible:ring-purple-500"
                  accessibilityRole="button"
                  accessibilityLabel="Apply all suggested changes"
                >
                  <Text className="text-white text-xs font-medium">
                    Apply All
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    handleRejectAllClick(msg.suggestedChanges || [])
                  }
                  className={`flex-1 px-3 py-2 rounded-lg items-center focus-visible:ring-2 focus-visible:ring-purple-500 ${
                    isDark ? "bg-slate-700" : "bg-slate-200"
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel="Reject all suggested changes"
                >
                  <Text
                    className={`text-xs font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                  >
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

  if (!visible) return null;

  return (
    <>
      <View
        role="complementary"
        aria-label="AI Deck Advisor"
        className={`flex-col h-full border-l ${isDark ? "border-slate-800 bg-gray-950" : "border-slate-200 bg-white"}`}
        style={{ width: panelWidth }}
      >
        {/* Resize handle */}
        <View
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-purple-600/50"
          // @ts-ignore - Web-specific mouse events
          onMouseDown={handleResizeStart}
        >
          <View className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 p-1">
            <GripVertical size={12} color={isDark ? "#475569" : "#94a3b8"} />
          </View>
        </View>

        {/* Header with gradient */}
        <View
          className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-800 bg-gradient-to-r from-purple-950 to-gray-900" : "border-slate-200 bg-slate-50"}`}
        >
          <View className="flex-row items-center gap-2">
            <Sparkles size={20} color="#7C3AED" />
            <Text
              className={`text-lg font-light tracking-wide ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Deck advisor
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setShowHistory(true)}
              className={`rounded-full p-2 focus-visible:ring-2 focus-visible:ring-purple-500 ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
              accessibilityRole="button"
              accessibilityLabel="View chat history"
            >
              <MessagesSquare size={20} color="#7C3AED" />
            </Pressable>
            <Pressable
              onPress={createSession}
              className={`rounded-full p-2 focus-visible:ring-2 focus-visible:ring-purple-500 ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
              accessibilityRole="button"
              accessibilityLabel="Create new chat session"
            >
              <Plus size={20} color="#7C3AED" />
            </Pressable>
            <Pressable
              onPress={onClose}
              className="rounded-full p-2 focus-visible:ring-2 focus-visible:ring-purple-500"
              accessibilityRole="button"
              accessibilityLabel="Close advisor panel"
            >
              <X size={24} color={isDark ? "white" : "#1e293b"} />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : (
          <>
            {/* Chat messages */}
            <ScrollView
              ref={scrollViewRef}
              className="flex-1 px-4 py-3"
              role="log"
              aria-live="polite"
              aria-atomic={false}
            >
              {!activeSession || activeSession.messages.length === 0 ? (
                <View className="flex-1 py-8">
                  <View className="items-center mb-6">
                    <View
                      className={`p-4 rounded-full mb-4 ${isDark ? "bg-purple-900/30" : "bg-purple-100"}`}
                    >
                      <MessageSquare size={32} color="#7C3AED" />
                    </View>
                    <Text
                      className={`text-lg font-medium text-center mb-2 ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      Welcome to Deck Advisor
                    </Text>
                    <Text
                      className={`text-sm text-center px-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Ask me anything about improving your "{deck.name}" deck.
                    </Text>
                  </View>
                  <View className="px-2">
                    <Text
                      className={`text-xs font-medium mb-2 px-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      Quick Actions
                    </Text>
                    <AdvisorQuickActions
                      onActionSelect={(prompt) => sendMessage(prompt)}
                      disabled={sending}
                      isDark={isDark}
                    />
                  </View>
                </View>
              ) : (
                <>
                  {activeSession.messages.map(renderMessage)}
                  {/* Status indicator - shows while processing before streaming starts */}
                  {sending && !streamingContent && (
                    <View
                      className={`flex-row items-center gap-3 p-4 rounded-xl mb-3 ${isDark ? "bg-purple-900/30" : "bg-purple-50"}`}
                      role="status"
                      aria-live="polite"
                    >
                      <Loader2
                        size={18}
                        color="#7C3AED"
                        className="animate-spin"
                        style={{ transformOrigin: 'center' }}
                      />
                      <Text
                        className={`text-sm font-medium ${isDark ? "text-purple-300" : "text-purple-600"}`}
                      >
                        {statusMessage || "Thinking..."}
                      </Text>
                    </View>
                  )}
                  {/* Streaming content */}
                  {sending && streamingContent && (
                    <View
                      className={`p-4 rounded-xl mb-3 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
                      role="status"
                      aria-live="polite"
                      accessibilityLabel="Advisor is responding"
                    >
                      <View className="flex-row items-center gap-2 mb-2">
                        <View
                          className={`h-6 w-6 rounded-full items-center justify-center ${isDark ? "bg-slate-700" : "bg-slate-300"}`}
                        >
                          <Bot
                            size={14}
                            color={isDark ? "#A78BFA" : "#7C3AED"}
                          />
                        </View>
                        <Text
                          className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                        >
                          Deck Advisor
                        </Text>
                        <View className="flex-row items-center gap-1 ml-auto">
                          <Loader2
                            size={12}
                            color="#7C3AED"
                            className="animate-spin"
                            style={{ transformOrigin: 'center' }}
                          />
                          <Text className="text-xs text-purple-400">
                            thinking
                          </Text>
                        </View>
                      </View>
                      <Text
                        className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}
                      >
                        {streamingContent}
                        <Text className="text-purple-400">▊</Text>
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <SidePanelInput
              onSend={sendMessage}
              sending={sending}
              includeCollection={includeCollection}
              setIncludeCollection={setIncludeCollection}
              isDark={isDark}
            />
          </>
        )}
      </View>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        visible={confirmApplyAll.visible}
        title="Apply All Changes"
        message={`Apply ${confirmApplyAll.changes.length} ${confirmApplyAll.changes.length === 1 ? "change" : "changes"} to your deck?`}
        confirmText="Apply All"
        cancelText="Cancel"
        onConfirm={confirmApplyAllHandler}
        onCancel={() => setConfirmApplyAll({ visible: false, changes: [] })}
      />
      <ConfirmDialog
        visible={confirmRejectAll.visible}
        title="Reject All Changes"
        message={`Reject ${confirmRejectAll.changes.length} ${confirmRejectAll.changes.length === 1 ? "change" : "changes"}?`}
        confirmText="Reject All"
        cancelText="Cancel"
        onConfirm={confirmRejectAllHandler}
        onCancel={() => setConfirmRejectAll({ visible: false, changes: [] })}
        destructive
      />

      {/* Card Detail Modal */}
      <CardDetailModal
        visible={cardModalVisible}
        onClose={() => {
          setCardModalVisible(false);
          setSelectedCard(null);
          setSelectedChangeContext(undefined);
        }}
        card={selectedCard}
        loading={loadingCard}
        changeContext={selectedChangeContext}
      />

      {/* Chat History Modal */}
      <ChatHistoryModal
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        sessions={sessions}
        activeSessionId={activeSession?.id}
        onSelectSession={selectSession}
        onCreateSession={createSession}
        onDeleteSession={deleteSession}
        isDark={isDark}
      />
    </>
  );
}
