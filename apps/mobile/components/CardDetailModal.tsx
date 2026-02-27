import { Bot, Send, Sparkles, User, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import EventSource from "react-native-sse";
import { MANA_COLORS_WITH_TEXT } from "~/components/deck/deck-detail-constants";
import { Button } from "~/components/ui/button";
import { useResponsive } from "~/hooks/useResponsive";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL, cardsApi, type CardSearchResult, type DeckCard, type DeckChange } from "~/lib/api";
import { KEYBOARD_ACCESSORY_ID } from "~/components/ui/KeyboardDoneAccessory";
import { secureStorage } from "~/lib/storage";

interface SubChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Isolated input component to prevent parent re-renders from unmounting the input
function SubChatInput({
  onSend,
  loading,
  isDark,
  inputRef,
}: {
  onSend: (message: string) => void;
  loading: boolean;
  isDark: boolean;
  inputRef?: React.RefObject<TextInput>;
}) {
  const [localMessage, setLocalMessage] = useState("");

  const handleSend = () => {
    if (localMessage.trim() && !loading) {
      onSend(localMessage.trim());
      setLocalMessage("");
    }
  };

  return (
    <>
      <TextInput
        ref={inputRef}
        value={localMessage}
        onChangeText={setLocalMessage}
        placeholder="Ask about this change..."
        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
        className={`flex-1 px-4 py-2.5 rounded-xl text-sm ${
          isDark ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-900"
        }`}
        editable={!loading}
        onSubmitEditing={handleSend}
        inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
      />
      <Pressable
        onPress={handleSend}
        disabled={!localMessage.trim() || loading}
        className={`p-2.5 rounded-xl ${
          localMessage.trim() && !loading
            ? "bg-purple-600"
            : isDark
              ? "bg-slate-800"
              : "bg-slate-200"
        }`}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#7C3AED" />
        ) : (
          <Send
            size={18}
            color={localMessage.trim() ? "white" : isDark ? "#64748b" : "#94a3b8"}
          />
        )}
      </Pressable>
    </>
  );
}

// Compact version of the input for mobile
function SubChatInputCompact({
  onSend,
  loading,
  isDark,
  inputRef,
}: {
  onSend: (message: string) => void;
  loading: boolean;
  isDark: boolean;
  inputRef?: React.RefObject<TextInput>;
}) {
  const [localMessage, setLocalMessage] = useState("");

  const handleSend = () => {
    if (localMessage.trim() && !loading) {
      onSend(localMessage.trim());
      setLocalMessage("");
    }
  };

  return (
    <>
      <TextInput
        ref={inputRef}
        value={localMessage}
        onChangeText={setLocalMessage}
        placeholder="Ask about this change..."
        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
        className={`flex-1 px-3 py-2 rounded-lg text-sm ${
          isDark ? "bg-slate-700 text-white" : "bg-white text-slate-900"
        }`}
        editable={!loading}
        onSubmitEditing={handleSend}
        inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
      />
      <Pressable
        onPress={handleSend}
        disabled={!localMessage.trim() || loading}
        className={`p-2 rounded-lg ${
          localMessage.trim() && !loading
            ? "bg-purple-600"
            : isDark
              ? "bg-slate-700"
              : "bg-slate-200"
        }`}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#7C3AED" />
        ) : (
          <Send
            size={16}
            color={localMessage.trim() ? "white" : isDark ? "#64748b" : "#94a3b8"}
          />
        )}
      </Pressable>
    </>
  );
}

const { width: screenWidth } = Dimensions.get("window");
const cardWidth = screenWidth - 64;
const cardHeight = cardWidth * (680 / 488);

// Desktop card dimensions
const DESKTOP_CARD_WIDTH = 240;
const DESKTOP_CARD_HEIGHT = DESKTOP_CARD_WIDTH * (680 / 488);
const DESKTOP_MODAL_HEIGHT = 560;

interface ChangeContext {
  change: DeckChange;
  sessionId: string;
  deckName: string;
}

interface CardDetailModalProps {
  visible: boolean;
  onClose: () => void;
  card: (CardSearchResult | DeckCard) & {
    oracleText?: string;
    cmc?: number;
  } | null;
  loading?: boolean;
  onAddToCollection?: () => void;
  changeContext?: ChangeContext;
}


function ManaCostDisplay({ manaCost }: { manaCost?: string }) {
  if (!manaCost) return null;

  // Parse mana cost like {2}{U}{U} or {W}{B}
  const symbols = manaCost.match(/\{[^}]+\}/g) || [];

  return (
    <View className="flex-row gap-1">
      {symbols.map((symbol, index) => {
        const code = symbol.replace(/[{}]/g, "");
        const colors = MANA_COLORS_WITH_TEXT[code];
        const isNumber = /^\d+$/.test(code);

        return (
          <View
            key={index}
            className="h-6 w-6 items-center justify-center rounded-full"
            style={{
              backgroundColor: colors?.bg || (isNumber ? "#CAC5C0" : "#CAC5C0"),
            }}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: colors?.text || "#211D15" }}
            >
              {code}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function CardDetailModal({
  visible,
  onClose,
  card,
  loading,
  onAddToCollection,
  changeContext,
}: CardDetailModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();

  // Sub-chat state for change discussion
  const [subChatMessages, setSubChatMessages] = useState<SubChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [subChatLoading, setSubChatLoading] = useState(false);
  const [subChatError, setSubChatError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Enhanced card data with oracle text (fetched from API)
  const [enhancedCard, setEnhancedCard] = useState<CardSearchResult | null>(null);

  // Fetch full card data when modal opens with change context
  useEffect(() => {
    if (!visible || !changeContext || !card) {
      setEnhancedCard(null);
      return;
    }

    const fetchCardData = async () => {
      try {
        const scryfallId = "scryfallId" in card ? card.scryfallId : null;
        if (!scryfallId) return;

        const result = await cardsApi.get(scryfallId);
        if (result.data) {
          setEnhancedCard(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch card data:", err);
      }
    };

    fetchCardData();
  }, [visible, changeContext, card]);

  // Send a message in the sub-chat
  const sendSubChatMessage = async (messageText: string) => {
    if (!messageText.trim() || !changeContext || subChatLoading) return;

    const userMessage: SubChatMessage = {
      id: Math.random().toString(36).substring(2, 15),
      role: "user",
      content: messageText.trim(),
    };

    setSubChatMessages((prev) => [...prev, userMessage]);
    setSubChatLoading(true);
    setStreamingContent("");
    setSubChatError(null);

    try {
      const token = await secureStorage.getItem("auth_token");
      if (!token) {
        setSubChatError("Not authenticated");
        setSubChatLoading(false);
        return;
      }

      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const { sessionId } = changeContext;

      const eventSource = new EventSource(`${API_URL}/advisor/chat/${sessionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: messageText.trim(), skipPersist: true }),
      });

      eventSourceRef.current = eventSource;
      let fullContent = "";

      eventSource.addEventListener("message", (event) => {
        try {
          if (!event.data) return;
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "content":
              if (data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
                // Scroll handled by onContentSizeChange on ScrollView
              }
              break;

            case "done":
              // Add assistant message
              const assistantMessage: SubChatMessage = {
                id: Math.random().toString(36).substring(2, 15),
                role: "assistant",
                content: fullContent,
              };
              setSubChatMessages((prev) => [...prev, assistantMessage]);
              setStreamingContent("");
              setSubChatLoading(false);
              eventSource.close();
              eventSourceRef.current = null;
              // Scroll handled by onContentSizeChange on ScrollView
              break;

            case "error":
              setSubChatError(data.error || "Failed to get response");
              setSubChatLoading(false);
              eventSource.close();
              eventSourceRef.current = null;
              break;
          }
        } catch (parseError) {
          console.warn("Failed to parse SSE data:", event.data, parseError);
        }
      });

      eventSource.addEventListener("error", (error) => {
        console.error("SSE error:", error);
        setSubChatError("Failed to get response");
        setSubChatLoading(false);
        eventSource.close();
        eventSourceRef.current = null;
      });
    } catch (err) {
      console.error("Failed to send sub-chat message:", err);
      setSubChatError("Failed to send message");
      setSubChatLoading(false);
    }
  };

  // Reset sub-chat state when modal closes
  useEffect(() => {
    if (!visible || !changeContext) {
      setSubChatMessages([]);
      setStreamingContent("");
      setSubChatError(null);
    }
  }, [visible, changeContext]);

  // Start explanation on demand
  const startExplanation = () => {
    if (!changeContext || !enhancedCard || subChatLoading) return;

    const { change, deckName } = changeContext;
    const actionText = change.action === "add"
      ? `adding ${change.quantity}x ${change.cardName}`
      : change.action === "remove"
        ? `removing ${change.quantity}x ${change.cardName}`
        : `swapping ${change.cardName} for ${change.targetCardName}`;

    const cardDetails = [
      `Card: ${enhancedCard.name}`,
      enhancedCard.manaCost ? `Mana Cost: ${enhancedCard.manaCost}` : null,
      enhancedCard.typeLine ? `Type: ${enhancedCard.typeLine}` : null,
      enhancedCard.oracleText ? `Oracle Text: ${enhancedCard.oracleText}` : null,
      enhancedCard.cmc !== undefined ? `CMC: ${enhancedCard.cmc}` : null,
    ].filter(Boolean).join("\n");

    const initialPrompt = `I'm looking at the suggested change: ${actionText} to the "${deckName}" deck.

Here are the card details:
${cardDetails}

Explain in 2-3 sentences why this card specifically fits (or doesn't fit) the deck's strategy. Focus on how the card's abilities synergize with the commander and the deck's game plan.`;

    sendSubChatMessage(initialPrompt);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  if (!card) {
    if (!visible || !loading) return null;

    // Show loading state while card data is being fetched
    const LoadingModal = isDesktop ? (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable onPress={onClose} className="flex-1 items-center justify-center bg-black/60">
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className={`rounded-xl overflow-hidden shadow-2xl ${isDark ? "bg-slate-900" : "bg-white"}`}
            style={{ maxWidth: 500, width: "95%", minHeight: 300 }}
          >
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text className={`mt-4 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Loading card...
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    ) : (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`} style={{ paddingTop: insets.top }}>
          <View className={`flex-row items-center justify-end px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
            <Pressable onPress={onClose} className={`rounded-full p-2 ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}>
              <X size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          </View>
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text className={`mt-4 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Loading card...
            </Text>
          </View>
        </View>
      </Modal>
    );

    return LoadingModal;
  }

  const imageUrl = "imageUrl" in card ? card.imageUrl : undefined;
  const name = card.name;
  const manaCost = card.manaCost;
  const typeLine = card.typeLine;
  const rarity = card.rarity;
  const setCode = card.setCode;
  const collectorNumber = card.collectorNumber;
  const priceUsd = "priceUsd" in card ? card.priceUsd : undefined;

  // Change discussion sub-chat component - full height version for desktop
  const ChangeDiscussionFullHeight = () => {
    if (!changeContext) return null;

    const { change } = changeContext;
    const actionLabel = change.action === "add"
      ? "Add"
      : change.action === "remove"
        ? "Remove"
        : "Swap";
    const actionColor = change.action === "add"
      ? "text-purple-400"
      : change.action === "remove"
        ? "text-red-400"
        : "text-amber-400";

    return (
      <View className="flex-1 flex-col">
        {/* Header */}
        <View className={`flex-row items-center gap-3 px-4 py-3 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
          <View className={`px-2 py-1 rounded ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
            <Text className={`text-xs font-medium ${actionColor}`}>
              {actionLabel}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Sparkles size={14} color="#7C3AED" />
            <Text className={`text-sm font-medium ${isDark ? "text-purple-400" : "text-purple-600"}`}>
              Why this change?
            </Text>
          </View>
        </View>

        {/* Explain button or chat messages */}
        {subChatMessages.length === 0 && !subChatLoading && !streamingContent ? (
          <View className="flex-1 items-center justify-center p-6">
            <Pressable
              onPress={startExplanation}
              disabled={!enhancedCard}
              className={`flex-row items-center gap-2 px-5 py-3 rounded-xl ${
                enhancedCard ? "bg-purple-600 active:bg-purple-700" : isDark ? "bg-slate-800" : "bg-slate-200"
              }`}
            >
              {!enhancedCard ? (
                <ActivityIndicator size="small" color="#7C3AED" />
              ) : (
                <Sparkles size={16} color="white" />
              )}
              <Text className={`text-sm font-semibold ${enhancedCard ? "text-white" : isDark ? "text-slate-500" : "text-slate-400"}`}>
                Explain
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Chat messages - flex-1 to fill available space */}
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ padding: 16 }}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
              scrollEventThrottle={16}
            >
              {/* Only show assistant messages in the chat (hide the auto-generated user prompt) */}
              {subChatMessages
                .filter((msg, idx) => !(idx === 0 && msg.role === "user"))
                .map((msg) => (
                  <View
                    key={msg.id}
                    className={`mb-3 ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <View
                      className={`max-w-[90%] rounded-xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-purple-600"
                          : isDark
                            ? "bg-slate-800"
                            : "bg-slate-100"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <View className="flex-row items-center gap-1.5 mb-2">
                          <Bot size={12} color="#7C3AED" />
                          <Text className="text-xs text-purple-400 font-medium">Advisor</Text>
                        </View>
                      )}
                      {msg.role === "user" && (
                        <View className="flex-row items-center gap-1.5 mb-2 justify-end">
                          <Text className="text-xs text-purple-200 font-medium">You</Text>
                          <User size={12} color="#e9d5ff" />
                        </View>
                      )}
                      <Text
                        className={`text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "text-white"
                            : isDark
                              ? "text-slate-300"
                              : "text-slate-700"
                        }`}
                      >
                        {msg.content}
                      </Text>
                    </View>
                  </View>
                ))}

              {/* Streaming content */}
              {streamingContent && (
                <View className="mb-3 items-start">
                  <View className={`max-w-[90%] rounded-xl px-4 py-3 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                    <View className="flex-row items-center gap-1.5 mb-2">
                      <Bot size={12} color="#7C3AED" />
                      <Text className="text-xs text-purple-400 font-medium">Advisor</Text>
                    </View>
                    <Text className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      {streamingContent}
                      <Text className="text-purple-400">▊</Text>
                    </Text>
                  </View>
                </View>
              )}

              {/* Loading indicator for initial load */}
              {subChatLoading && !streamingContent && subChatMessages.length <= 1 && (
                <View className={`rounded-xl px-4 py-4 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color="#7C3AED" />
                    <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Analyzing this change...
                    </Text>
                  </View>
                </View>
              )}

              {/* Error */}
              {subChatError && (
                <View className="rounded-xl px-4 py-3 bg-red-500/10">
                  <Text className="text-sm text-red-400">{subChatError}</Text>
                </View>
              )}
            </ScrollView>

            {/* Input area - fixed at bottom */}
            <View className={`flex-row items-center gap-2 p-3 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
              <SubChatInput
                onSend={sendSubChatMessage}
                loading={subChatLoading}
                isDark={isDark}
              />
            </View>
          </>
        )}
      </View>
    );
  };

  // Change discussion sub-chat component - compact version for mobile
  const ChangeDiscussion = () => {
    if (!changeContext) return null;

    const { change } = changeContext;
    const actionLabel = change.action === "add"
      ? "Add"
      : change.action === "remove"
        ? "Remove"
        : "Swap";
    const actionColor = change.action === "add"
      ? "text-purple-400"
      : change.action === "remove"
        ? "text-red-400"
        : "text-amber-400";

    return (
      <View className={`mt-4 pt-4 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
        {/* Change badge */}
        <View className="flex-row items-center gap-2 mb-3">
          <View className={`px-2 py-1 rounded ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
            <Text className={`text-xs font-medium ${actionColor}`}>
              {actionLabel}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Sparkles size={12} color="#7C3AED" />
            <Text className={`text-xs font-medium ${isDark ? "text-purple-400" : "text-purple-600"}`}>
              Discuss this change
            </Text>
          </View>
        </View>

        {/* Explain button or chat */}
        {subChatMessages.length === 0 && !subChatLoading && !streamingContent ? (
          <View className="items-start py-2">
            <Pressable
              onPress={startExplanation}
              disabled={!enhancedCard}
              className={`flex-row items-center gap-2 px-4 py-2.5 rounded-xl ${
                enhancedCard ? "bg-purple-600 active:bg-purple-700" : isDark ? "bg-slate-800" : "bg-slate-200"
              }`}
            >
              {!enhancedCard ? (
                <ActivityIndicator size="small" color="#7C3AED" />
              ) : (
                <Sparkles size={14} color="white" />
              )}
              <Text className={`text-sm font-semibold ${enhancedCard ? "text-white" : isDark ? "text-slate-500" : "text-slate-400"}`}>
                Explain
              </Text>
            </Pressable>
          </View>
        ) : (
          <View>
            {/* Messages rendered inline in parent scroll */}
            {subChatMessages
              .filter((msg, idx) => !(idx === 0 && msg.role === "user"))
              .map((msg) => (
                <View
                  key={msg.id}
                  className={`mb-3 ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <View
                    className={`rounded-xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-purple-600"
                        : isDark
                          ? "bg-slate-800"
                          : "bg-slate-100"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <View className="flex-row items-center gap-1.5 mb-1.5">
                        <Bot size={12} color="#7C3AED" />
                        <Text className="text-xs text-purple-400 font-medium">Advisor</Text>
                      </View>
                    )}
                    {msg.role === "user" && (
                      <View className="flex-row items-center gap-1.5 mb-1.5 justify-end">
                        <Text className="text-xs text-purple-200 font-medium">You</Text>
                        <User size={12} color="#e9d5ff" />
                      </View>
                    )}
                    <Text
                      className={`text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "text-white"
                          : isDark
                            ? "text-slate-300"
                            : "text-slate-700"
                      }`}
                    >
                      {msg.content}
                    </Text>
                  </View>
                </View>
              ))}

            {/* Streaming content */}
            {streamingContent && (
              <View className="mb-3 items-start">
                <View className={`rounded-xl px-4 py-3 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                  <View className="flex-row items-center gap-1.5 mb-1.5">
                    <Bot size={12} color="#7C3AED" />
                    <Text className="text-xs text-purple-400 font-medium">Advisor</Text>
                  </View>
                  <Text className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    {streamingContent}
                    <Text className="text-purple-400">▊</Text>
                  </Text>
                </View>
              </View>
            )}

            {/* Loading indicator */}
            {subChatLoading && !streamingContent && subChatMessages.length <= 1 && (
              <View className={`flex-row items-center gap-2 rounded-xl px-4 py-3 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                <ActivityIndicator size="small" color="#7C3AED" />
                <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Analyzing...
                </Text>
              </View>
            )}

            {/* Error */}
            {subChatError && (
              <Text className="text-sm text-red-400 py-2">{subChatError}</Text>
            )}

            {/* Follow-up input */}
            <View className={`flex-row items-center gap-2 mt-3 pt-3 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
              <SubChatInputCompact
                onSend={sendSubChatMessage}
                loading={subChatLoading}
                isDark={isDark}
              />
            </View>
          </View>
        )}
      </View>
    );
  };

  // Compact card details for desktop left column
  const CompactCardDetails = () => (
    <View className="gap-2 mt-3">
      {/* Name & Mana Cost */}
      <View className="flex-row items-start justify-between gap-2">
        <Text
          className={`text-base font-bold flex-1 ${
            isDark ? "text-white" : "text-slate-900"
          }`}
          numberOfLines={2}
        >
          {name}
        </Text>
        <ManaCostDisplay manaCost={manaCost} />
      </View>

      {/* Type Line */}
      {typeLine && (
        <Text
          className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}
          numberOfLines={1}
        >
          {typeLine}
        </Text>
      )}

      {/* Set Info & Price Row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text
            className={`text-xs ${
              isDark ? "text-slate-500" : "text-slate-500"
            }`}
          >
            {setCode?.toUpperCase()} #{collectorNumber}
          </Text>
          {rarity && (
            <View
              className="px-1.5 py-0.5 rounded"
              style={{
                backgroundColor:
                  rarity === "mythic"
                    ? "#ff4d00"
                    : rarity === "rare"
                      ? "#c9a227"
                      : rarity === "uncommon"
                        ? "#c0c0c0"
                        : "#1a1a1a",
              }}
            >
              <Text className="text-[10px] font-medium text-white capitalize">
                {rarity}
              </Text>
            </View>
          )}
        </View>
        {priceUsd && (
          <Text
            className={`text-sm font-semibold ${
              isDark ? "text-slate-300" : "text-slate-700"
            }`}
          >
            ${typeof priceUsd === "number" ? priceUsd.toFixed(2) : priceUsd}
          </Text>
        )}
      </View>

      {/* Add to Collection button */}
      {onAddToCollection && (
        <Button onPress={onAddToCollection} className="mt-2">
          <Text className="font-semibold text-white text-sm">Add to Collection</Text>
        </Button>
      )}
    </View>
  );

  // Card details component (for mobile)
  const CardDetails = () => (
    <View className="gap-4 w-full mt-6">
      {/* Name & Mana Cost */}
      <View className="flex-row items-start justify-between gap-3">
        <Text
          className={`text-xl font-bold flex-1 ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {name}
        </Text>
        <ManaCostDisplay manaCost={manaCost} />
      </View>

      {/* Type Line */}
      {typeLine && (
        <Text className={isDark ? "text-slate-300" : "text-slate-700"}>
          {typeLine}
        </Text>
      )}

      {/* Set Info */}
      <View className="flex-row items-center gap-2">
        <Text
          className={`text-sm capitalize ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {setCode?.toUpperCase()} #{collectorNumber}
        </Text>
        {rarity && (
          <View
            className="px-2 py-0.5 rounded"
            style={{
              backgroundColor:
                rarity === "mythic"
                  ? "#ff4d00"
                  : rarity === "rare"
                    ? "#c9a227"
                    : rarity === "uncommon"
                      ? "#c0c0c0"
                      : "#1a1a1a",
            }}
          >
            <Text className="text-xs font-medium text-white capitalize">
              {rarity}
            </Text>
          </View>
        )}
      </View>

      {/* Price */}
      {priceUsd && (
        <View className="flex-row items-center gap-2">
          <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
            Price:
          </Text>
          <Text
            className={`font-semibold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            ${typeof priceUsd === "number" ? priceUsd.toFixed(2) : priceUsd}
          </Text>
        </View>
      )}

      {/* Change discussion sub-chat */}
      <ChangeDiscussion />
    </View>
  );

  // Desktop layout - dialog with side-by-side layout
  if (isDesktop) {
    const hasChangeContext = !!changeContext;
    const modalWidth = hasChangeContext ? 780 : 500;

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        {/* Backdrop */}
        <Pressable
          onPress={onClose}
          className="flex-1 items-center justify-center bg-black/60"
        >
          {/* Dialog container - prevent close when clicking inside */}
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className={`rounded-xl overflow-hidden shadow-2xl ${
              isDark ? "bg-slate-900" : "bg-white"
            }`}
            style={{
              maxWidth: modalWidth,
              width: "95%",
              height: hasChangeContext ? DESKTOP_MODAL_HEIGHT : "auto",
            }}
          >
            {/* Header */}
            <View
              className={`flex-row items-center justify-between px-5 py-3 border-b ${
                isDark ? "border-slate-800" : "border-slate-200"
              }`}
            >
              <Text
                className={`text-base font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
                numberOfLines={1}
              >
                {hasChangeContext ? "Suggested Change" : "Card Details"}
              </Text>
              <Pressable
                onPress={onClose}
                className={`rounded-full p-1.5 ${
                  isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                }`}
              >
                <X size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              </Pressable>
            </View>

            {/* Content */}
            {hasChangeContext ? (
              // Two-column layout: Card on left, Chat on right
              <View className="flex-row flex-1">
                {/* Left column - Card Image + Compact Details */}
                <View
                  className={`p-4 border-r ${isDark ? "border-slate-800" : "border-slate-200"}`}
                  style={{ width: DESKTOP_CARD_WIDTH + 32 }}
                >
                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={{
                        width: DESKTOP_CARD_WIDTH,
                        height: DESKTOP_CARD_HEIGHT,
                      }}
                      className="rounded-xl"
                      resizeMode="contain"
                    />
                  ) : (
                    <View
                      style={{
                        width: DESKTOP_CARD_WIDTH,
                        height: DESKTOP_CARD_HEIGHT,
                      }}
                      className={`items-center justify-center rounded-xl ${
                        isDark ? "bg-slate-800" : "bg-slate-200"
                      }`}
                    >
                      <Text
                        className={`text-lg text-center ${
                          isDark ? "text-slate-500" : "text-slate-400"
                        }`}
                      >
                        No Image
                      </Text>
                    </View>
                  )}
                  <CompactCardDetails />
                </View>

                {/* Right column - Full-height Chat */}
                <View className="flex-1 flex-col">
                  <ChangeDiscussionFullHeight />
                </View>
              </View>
            ) : (
              // Single column layout for regular card details
              <View className="flex-row p-5 gap-5">
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={{
                      width: DESKTOP_CARD_WIDTH,
                      height: DESKTOP_CARD_HEIGHT,
                    }}
                    className="rounded-xl"
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={{
                      width: DESKTOP_CARD_WIDTH,
                      height: DESKTOP_CARD_HEIGHT,
                    }}
                    className={`items-center justify-center rounded-xl ${
                      isDark ? "bg-slate-800" : "bg-slate-200"
                    }`}
                  >
                    <Text
                      className={`text-lg text-center ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      No Image
                    </Text>
                  </View>
                )}
                <CompactCardDetails />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // Mobile layout - Modal that overlays on top of any open bottom sheets
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`} style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          <Text
            className={`text-lg font-semibold flex-1 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Pressable
            onPress={onClose}
            className={`rounded-full p-2 ${
              isDark ? "active:bg-slate-800" : "active:bg-slate-100"
            }`}
          >
            <X size={24} color={isDark ? "#94a3b8" : "#64748b"} />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, alignItems: "center", paddingBottom: Math.max(24, insets.bottom) }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card Image */}
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: cardWidth, height: cardHeight }}
              className="rounded-xl"
              resizeMode="contain"
            />
          ) : (
            <View
              style={{ width: cardWidth, height: cardHeight }}
              className={`items-center justify-center rounded-xl ${
                isDark ? "bg-slate-800" : "bg-slate-200"
              }`}
            >
              <Text
                className={`text-lg text-center ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                No Image
              </Text>
            </View>
          )}

          {/* Card Details */}
          <CardDetails />
        </ScrollView>

        {/* Actions */}
        {onAddToCollection && (
          <View
            className={`px-6 py-4 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}
            style={{ paddingBottom: Math.max(16, insets.bottom) }}
          >
            <Button onPress={onAddToCollection}>
              <Text className="font-semibold text-white">Add to Collection</Text>
            </Button>
          </View>
        )}
      </View>
    </Modal>
  );
}
