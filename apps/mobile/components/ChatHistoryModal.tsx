import { BottomSheetView } from "@gorhom/bottom-sheet";
import {
  MessageSquare,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";
import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { GlassSheet } from "~/components/ui/GlassSheet";
import type { ChatSession } from "~/lib/api";

const isWeb = Platform.OS === "web";
const isIOS = Platform.OS === "ios";

interface ChatHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string | undefined;
  onSelectSession: (session: ChatSession) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  isDark: boolean;
}

export function ChatHistoryModal({
  visible,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  isDark,
}: ChatHistoryModalProps) {
  const insets = useSafeAreaInsets();
  const [confirmDelete, setConfirmDelete] = useState<{ visible: boolean; sessionId: string }>({
    visible: false,
    sessionId: "",
  });

  const handleDeleteClick = (sessionId: string) => {
    setConfirmDelete({ visible: true, sessionId });
  };

  const confirmDeleteHandler = () => {
    const { sessionId } = confirmDelete;
    setConfirmDelete({ visible: false, sessionId: "" });
    onDeleteSession(sessionId);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "long" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const handleSelectSession = (session: ChatSession) => {
    onSelectSession(session);
    onClose();
  };

  const handleCreateSession = () => {
    onCreateSession();
    onClose();
  };

  const sessionsList = (
    <ScrollView className="px-4 py-3" contentContainerStyle={isWeb ? { paddingBottom: 16 } : undefined}>
      {sessions.length === 0 ? (
        <View className="items-center py-8">
          <View className={`p-4 rounded-full mb-3 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
            <MessageSquare size={24} color={isDark ? "#64748b" : "#94a3b8"} />
          </View>
          <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            No chat history yet
          </Text>
          <Text className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            Start a new chat to get deck advice
          </Text>
        </View>
      ) : (
        sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const lastMessage = session.messages[session.messages.length - 1];
          const preview = lastMessage?.content?.slice(0, 60) || "No messages yet";

          return (
            <Pressable
              key={session.id}
              onPress={() => handleSelectSession(session)}
              className={`flex-row items-center p-3 rounded-xl mb-2 ${
                isActive
                  ? isDark
                    ? "bg-purple-900/30 border border-purple-500/30"
                    : "bg-purple-50 border border-purple-200"
                  : isDark
                    ? "bg-slate-800/50"
                    : "bg-slate-50"
              }`}
            >
              <View className={`p-2 rounded-full mr-3 ${
                isActive
                  ? "bg-purple-600"
                  : isDark
                    ? "bg-slate-700"
                    : "bg-slate-200"
              }`}>
                <MessageSquare
                  size={16}
                  color={isActive ? "white" : isDark ? "#94a3b8" : "#64748b"}
                />
              </View>
              <View className="flex-1 mr-2">
                <View className="flex-row items-center justify-between mb-1">
                  <Text
                    className={`font-medium ${
                      isActive
                        ? "text-purple-400"
                        : isDark
                          ? "text-white"
                          : "text-slate-900"
                    }`}
                    numberOfLines={1}
                  >
                    {session.name}
                  </Text>
                  <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    {formatDate(session.updatedAt || session.createdAt)}
                  </Text>
                </View>
                <Text
                  className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  numberOfLines={1}
                >
                  {preview}{preview.length >= 60 ? "..." : ""}
                </Text>
              </View>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  handleDeleteClick(session.id);
                }}
                className={`p-2 rounded-full ${isDark ? "active:bg-slate-700" : "active:bg-slate-200"}`}
                hitSlop={8}
              >
                <Trash2 size={16} color={isDark ? "#ef4444" : "#dc2626"} />
              </Pressable>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );

  const header = (
    <View className={`flex-row items-center justify-between px-4 ${isWeb ? "pt-4" : isIOS ? "pt-2" : ""} pb-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
      <Text className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
        Chat History
      </Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={handleCreateSession}
          className={`flex-row items-center gap-2 px-3 py-2 rounded-lg ${isDark ? "bg-purple-900/30" : "bg-purple-50"}`}
        >
          <Plus size={16} color="#7C3AED" />
          <Text className="text-purple-500 text-sm font-medium">New Chat</Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          className="p-2"
        >
          <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <>
      {isIOS && !isWeb ? (
        <GlassSheet visible={visible} onDismiss={onClose} isDark={isDark}>
          <BottomSheetView style={{ flex: 1 }}>
            {header}
            {sessionsList}
          </BottomSheetView>
        </GlassSheet>
      ) : (
        <Modal
          visible={visible}
          transparent
          animationType={isWeb ? "fade" : "slide"}
          onRequestClose={onClose}
          statusBarTranslucent
        >
          {/* Android / Web: existing layout */}
          <View className={`flex-1 ${isWeb ? "justify-center items-center" : "justify-end"}`}>
            <Pressable
              onPress={onClose}
              className="absolute inset-0 bg-black/50"
            />
            <View
              className={`${
                isWeb
                  ? "rounded-2xl w-full max-w-md max-h-[80%]"
                  : "rounded-t-3xl max-h-[70%]"
              } ${isDark ? "bg-gray-900" : "bg-white"}`}
              style={isWeb ? undefined : { paddingBottom: Math.max(16, insets.bottom) }}
            >
              {!isWeb && (
                <View className="items-center pt-3 pb-2">
                  <View className={`w-10 h-1 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-300"}`} />
                </View>
              )}
              {header}
              {sessionsList}
            </View>
          </View>
        </Modal>
      )}

      <ConfirmDialog
        visible={confirmDelete.visible}
        title="Delete Session"
        message="Are you sure you want to delete this chat session? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteHandler}
        onCancel={() => setConfirmDelete({ visible: false, sessionId: "" })}
        destructive
      />
    </>
  );
}
