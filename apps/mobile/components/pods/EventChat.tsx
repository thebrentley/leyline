import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { EventChatMessageData } from "~/lib/api";
import { ChatInput } from "~/components/ui/ChatInput";

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) return time;
  if (msgDay.getTime() === yesterday.getTime()) return `Yesterday ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

interface EventChatProps {
  messages: EventChatMessageData[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  sending: boolean;
  currentUserId: string | null;
  onSend: (content: string) => void;
  onLoadMore: () => void;
  isDark: boolean;
  noBottomInset?: boolean;
}

function ChatBubble({
  message,
  isOwnMessage,
  isDark,
}: {
  message: EventChatMessageData;
  isOwnMessage: boolean;
  isDark: boolean;
}) {
  const time = formatTimestamp(message.createdAt);

  return (
    <View
      className={`mb-2 px-3 ${isOwnMessage ? "items-end" : "items-start"}`}
    >
      <View
        className={`flex-row ${isOwnMessage ? "flex-row-reverse" : ""}`}
        style={{ maxWidth: "80%" }}
      >
        {/* Avatar (other users only) */}
        {!isOwnMessage && (
          <View className="mr-2 mt-1">
            {message.profilePicture ? (
              <Image
                source={{ uri: message.profilePicture }}
                className="h-7 w-7 rounded-full"
                resizeMode="cover"
              />
            ) : (
              <View
                className={`h-7 w-7 rounded-full items-center justify-center ${
                  isDark ? "bg-slate-700" : "bg-slate-300"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-600"}`}
                >
                  {(message.displayName || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}
        <View className="flex-shrink">
          {/* Sender name (other users only) */}
          {!isOwnMessage && (
            <Text
              className={`text-xs mb-0.5 ml-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              {message.displayName || "Unknown"}
            </Text>
          )}
          {/* Bubble */}
          <View
            className={`px-3 py-2 rounded-2xl ${isOwnMessage ? "self-end" : "self-start"} ${
              isOwnMessage
                ? "bg-purple-600 rounded-br-sm"
                : isDark
                  ? "bg-slate-800 rounded-bl-sm"
                  : "bg-slate-200 rounded-bl-sm"
            }`}
          >
            <Text
              className={`text-sm ${
                isOwnMessage
                  ? "text-white"
                  : isDark
                    ? "text-slate-200"
                    : "text-slate-900"
              }`}
            >
              {message.content}
            </Text>
          </View>
          {/* Timestamp */}
          <Text
            className={`text-[10px] mt-0.5 ${isOwnMessage ? "text-right mr-1" : "ml-1"} ${
              isDark ? "text-slate-600" : "text-slate-400"
            }`}
          >
            {time}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SystemMessage({
  message,
  isDark,
}: {
  message: EventChatMessageData;
  isDark: boolean;
}) {
  const time = formatTimestamp(message.createdAt);

  return (
    <View className="my-1.5 px-6 items-center">
      <Text
        className={`text-xs text-center ${
          isDark ? "text-slate-500" : "text-slate-400"
        }`}
      >
        {message.displayName || "Someone"} {message.content}
        {"  "}
        <Text
          className={isDark ? "text-slate-600" : "text-slate-300"}
          style={{ fontSize: 10 }}
        >
          {time}
        </Text>
      </Text>
    </View>
  );
}

export function EventChat({
  messages,
  loading,
  loadingMore,
  hasMore,
  sending,
  currentUserId,
  onSend,
  onLoadMore,
  isDark,
  noBottomInset,
}: EventChatProps) {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#7C3AED" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          item.isSystem ? (
            <SystemMessage message={item} isDark={isDark} />
          ) : (
            <ChatBubble
              message={item}
              isOwnMessage={item.userId === currentUserId}
              isDark={isDark}
            />
          )
        }
        contentContainerStyle={{
          paddingVertical: 8,
          flexGrow: 1,
          justifyContent: messages.length === 0 ? "center" : undefined,
        }}
        ListEmptyComponent={
          <View className="items-center gap-2">
            <Text
              className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              No messages yet. Start the conversation!
            </Text>
          </View>
        }
        ListHeaderComponent={
          hasMore ? (
            <Pressable onPress={onLoadMore} className="items-center py-2">
              {loadingMore ? (
                <ActivityIndicator size="small" color="#7C3AED" />
              ) : (
                <Text
                  className={`text-sm ${isDark ? "text-purple-400" : "text-purple-600"}`}
                >
                  Load earlier messages
                </Text>
              )}
            </Pressable>
          ) : null
        }
      />
      <View
        className={`px-3 pt-2 border-t ${
          isDark ? "border-slate-800" : "border-slate-200"
        }`}
        style={{
          paddingBottom: noBottomInset ? 8 : Math.max(8, insets.bottom),
        }}
      >
        <ChatInput
          onSend={onSend}
          placeholder="Message..."
          sending={sending}
          isDark={isDark}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
