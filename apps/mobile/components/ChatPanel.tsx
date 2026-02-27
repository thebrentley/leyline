import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  ArrowUp,
  Bot,
  FolderOpen,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Plus,
  Sparkles,
  User,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KEYBOARD_ACCESSORY_ID } from "~/components/ui/KeyboardDoneAccessory";
import { Button } from "~/components/ui/button";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  cardsApi,
  type CardSearchResult,
  type ChatMessage,
  type DeckChange,
  type DeckDetail,
} from "~/lib/api";
import { CardDetailModal } from "./CardDetailModal";
import { GlassSheet } from "./ui/GlassSheet";
import { showToast } from "~/lib/toast";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { AdvisorQuickActions } from "~/components/AdvisorQuickActions";
import { ChatHistoryModal } from "~/components/ChatHistoryModal";
import type { UseAdvisorChatReturn } from "~/hooks/useAdvisorChat";

interface ChatPanelProps extends UseAdvisorChatReturn {
  deck: DeckDetail;
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
}

// Input component with internal state to prevent parent re-renders on typing
interface ChatInputProps {
  onSend: (message: string) => void;
  sending: boolean;
  includeCollection: boolean;
  setIncludeCollection: (value: boolean) => void;
  isDark: boolean;
  bottomInset: number;
}

function ChatInput({
  onSend,
  sending,
  includeCollection,
  setIncludeCollection,
  isDark,
  bottomInset,
}: ChatInputProps) {
  const [localMessage, setLocalMessage] = useState("");

  const handleSend = useCallback(() => {
    if (localMessage.trim() && !sending) {
      onSend(localMessage.trim());
      setLocalMessage("");
    }
  }, [localMessage, sending, onSend]);

  return (
    <View
      className={`border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}
      style={{ paddingBottom: Math.max(8, bottomInset) }}
    >
      <View className="flex-row items-end gap-2 px-3 pt-2 pb-1">
        <Pressable
          onPress={() => setIncludeCollection(!includeCollection)}
          className="items-center justify-center pb-2.5"
          accessibilityRole="switch"
          accessibilityState={{ checked: includeCollection }}
          accessibilityLabel="Consider my collection when making suggestions"
          hitSlop={8}
        >
          <FolderOpen
            size={22}
            color={includeCollection ? "#7C3AED" : isDark ? "#64748b" : "#94a3b8"}
          />
        </Pressable>
        <View
          className={`flex-1 flex-row items-end rounded-2xl px-3 py-1.5 ${
            isDark
              ? "bg-slate-800"
              : "bg-slate-100"
          }`}
        >
          <TextInput
            className={`flex-1 min-h-[36px] max-h-[100px] py-1.5 text-base ${
              isDark ? "text-white" : "text-slate-900"
            }`}
            placeholder="Ask about your deck..."
            placeholderTextColor={isDark ? "#64748b" : "#9ca3af"}
            value={localMessage}
            onChangeText={setLocalMessage}
            multiline
            editable={!sending}
            inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
          />
        </View>
        <Pressable
          onPress={handleSend}
          disabled={!localMessage.trim() || sending}
          className={`h-8 w-8 rounded-full items-center justify-center mb-1 ${
            !localMessage.trim() || sending
              ? "opacity-0"
              : "bg-purple-600"
          }`}
        >
          {sending ? (
            <ActivityIndicator
              color="white"
              size="small"
            />
          ) : (
            <ArrowUp
              size={18}
              color="white"
              strokeWidth={2.5}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function ChatPanel({
  deck,
  visible,
  onClose,
  isDark,
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
}: ChatPanelProps) {
  const insets = useSafeAreaInsets();

  // Local UI state
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
  const [showHistory, setShowHistory] = useState(false);

  // Confirmation dialogs
  const [confirmApplyAll, setConfirmApplyAll] = useState<{
    visible: boolean;
    changes: DeckChange[];
  }>({ visible: false, changes: [] });
  const [confirmRejectAll, setConfirmRejectAll] = useState<{
    visible: boolean;
    changes: DeckChange[];
  }>({ visible: false, changes: [] });

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
                      className="px-3 py-2 rounded bg-purple-600"
                    >
                      <Text className="text-white text-xs">Apply</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleChangeStatus(change.id, "rejected")}
                      className={`px-3 py-2 rounded ${isDark ? "bg-slate-600" : "bg-slate-200"}`}
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
                  className="flex-1 px-3 py-2 rounded-lg bg-purple-600 items-center"
                >
                  <Text className="text-white text-xs font-medium">
                    Apply All
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    handleRejectAllClick(msg.suggestedChanges || [])
                  }
                  className={`flex-1 px-3 py-2 rounded-lg items-center ${
                    isDark ? "bg-slate-700" : "bg-slate-200"
                  }`}
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

  return (
    <GlassSheet visible={visible} onDismiss={onClose} isDark={isDark} snapPoints={["90%"]} enableKeyboardHandling>
      {/* Header */}
      <View
        className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
      >
        <View className="flex-row items-center gap-2">
          <Sparkles size={20} color="#7C3AED" />
          <Text
            className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
          >
            Deck Advisor
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => setShowHistory(true)}
            className={`rounded-full p-2 ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
          >
            <MessagesSquare size={20} color={isDark ? "#94a3b8" : "#64748b"} />
          </Pressable>
          <Pressable
            onPress={createSession}
            className={`rounded-full p-2 ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
          >
            <Plus size={20} color={isDark ? "#94a3b8" : "#64748b"} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : activeSession ? (
        <>
          <BottomSheetScrollView
            ref={scrollViewRef}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          >
            {activeSession.messages.length === 0 &&
            !streamingContent ? (
              <View className="py-8">
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
                    Ask me anything about improving your "{deck.name}"
                    deck.
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
                {/* Streaming message */}
                {sending && streamingContent && (
                  <View
                    className={`p-4 rounded-xl mb-3 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
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
                {sending && !streamingContent && (
                  <View
                    className={`flex-row items-center gap-3 p-4 rounded-xl mb-3 ${isDark ? "bg-purple-900/30" : "bg-purple-50"}`}
                  >
                    <Loader2
                      size={18}
                      color="#7C3AED"
                      className="animate-spin"
                    />
                    <Text
                      className={`text-sm font-medium ${isDark ? "text-purple-300" : "text-purple-600"}`}
                    >
                      {statusMessage || "Thinking..."}
                    </Text>
                  </View>
                )}
              </>
            )}
          </BottomSheetScrollView>

          <ChatInput
            onSend={sendMessage}
            sending={sending}
            includeCollection={includeCollection}
            setIncludeCollection={setIncludeCollection}
            isDark={isDark}
            bottomInset={insets.bottom}
          />
        </>
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <View
            className={`p-4 rounded-full mb-4 ${isDark ? "bg-purple-900/30" : "bg-purple-100"}`}
          >
            <MessageSquare size={48} color="#7C3AED" />
          </View>
          <Text
            className={`text-lg font-medium text-center mb-2 ${isDark ? "text-white" : "text-slate-900"}`}
          >
            No chat session selected
          </Text>
          <Text
            className={`text-sm text-center mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            Start a new chat to get AI-powered deck advice
          </Text>
          <Button
            onPress={createSession}
            className="px-6 py-3 bg-purple-600"
          >
            <View className="flex-row items-center gap-2">
              <Plus size={18} color="white" />
              <Text className="text-white font-medium">
                Start New Chat
              </Text>
            </View>
          </Button>
        </View>
      )}

      {/* Card Detail Modal */}
      <CardDetailModal
        visible={cardModalVisible}
        onClose={() => {
          setCardModalVisible(false);
          setSelectedCard(null);
          setSelectedChangeContext(undefined);
        }}
        card={selectedCard}
        changeContext={selectedChangeContext}
      />

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
        destructive
        onConfirm={confirmRejectAllHandler}
        onCancel={() => setConfirmRejectAll({ visible: false, changes: [] })}
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
    </GlassSheet>
  );
}
