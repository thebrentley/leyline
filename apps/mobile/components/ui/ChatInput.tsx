import { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Plus } from "lucide-react-native";

interface ChatInputProps {
  onSend: (content: string) => void;
  placeholder?: string;
  sending?: boolean;
  isDark: boolean;
  onPlusPress?: () => void;
}

export function ChatInput({
  onSend,
  placeholder = "Message...",
  sending,
  isDark,
  onPlusPress,
}: ChatInputProps) {
  const [text, setText] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed && !sending) {
      onSend(trimmed);
      setText("");
    }
  }, [text, sending, onSend]);

  const hasText = text.trim().length > 0;

  return (
    <View className="flex-row items-end gap-2">
      <View
        className={`flex-1 flex-row items-end rounded-2xl px-3 py-1.5 ${
          isDark ? "bg-slate-800" : "bg-slate-100"
        }`}
      >
        <TextInput
          className={`flex-1 py-1.5 text-base ${
            isDark ? "text-white" : "text-slate-900"
          }`}
          style={{ maxHeight: 100 }}
          placeholder={placeholder}
          placeholderTextColor={isDark ? "#64748b" : "#9ca3af"}
          value={text}
          onChangeText={setText}
          multiline
          editable={!sending}
        />
        {onPlusPress && (
          <Pressable
            onPress={onPlusPress}
            className={`h-7 w-7 rounded-full items-center justify-center ml-1 mb-0.5 ${
              isDark ? "bg-slate-700" : "bg-slate-200"
            }`}
          >
            <Plus size={16} color={isDark ? "#94a3b8" : "#64748b"} />
          </Pressable>
        )}
      </View>
      <Pressable
        onPress={handleSend}
        disabled={!hasText || sending}
        className={`rounded-full px-4 py-2.5 ${
          hasText && !sending
            ? "bg-purple-600"
            : isDark
              ? "bg-slate-800"
              : "bg-slate-200"
        }`}
      >
        <Text
          className={`text-sm font-semibold ${
            hasText && !sending
              ? "text-white"
              : isDark
                ? "text-slate-600"
                : "text-slate-400"
          }`}
        >
          Send
        </Text>
      </Pressable>
    </View>
  );
}
