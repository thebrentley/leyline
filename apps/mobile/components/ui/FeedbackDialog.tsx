import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { feedbackApi } from "~/lib/api";

interface FeedbackDialogProps {
  visible: boolean;
  onClose: () => void;
}

export function FeedbackDialog({ visible, onClose }: FeedbackDialogProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError("");
    const result = await feedbackApi.send(message.trim());
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
  };

  const handleClose = () => {
    setMessage("");
    setSent(false);
    setError("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
      <Pressable
        className="flex-1 bg-black/50 items-center justify-center p-4"
        onPress={handleClose}
      >
        <Pressable
          className={`w-full max-w-sm rounded-2xl p-6 ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}
          onPress={(e) => e.stopPropagation()}
        >
          {sent ? (
            <>
              <Text
                className={`text-xl font-semibold mb-2 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Thanks!
              </Text>
              <Text
                className={`text-base mb-6 ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}
              >
                Your feedback has been sent.
              </Text>
              <Pressable
                className="py-3 px-4 rounded-lg bg-purple-600"
                onPress={handleClose}
              >
                <Text className="text-center font-medium text-white">
                  Done
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text
                className={`text-xl font-semibold mb-2 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Send Feedback
              </Text>
              <Text
                className={`text-base mb-4 ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}
              >
                Let us know what you think
              </Text>
              <TextInput
                className={`w-full px-4 py-3 rounded-lg mb-4 ${
                  isDark
                    ? "bg-slate-700 text-white border border-slate-600"
                    : "bg-slate-100 text-slate-900 border border-slate-300"
                }`}
                placeholder="Your feedback..."
                placeholderTextColor={isDark ? "#94a3b8" : "#64748b"}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{ minHeight: 120 }}
                autoFocus
              />
              {error ? (
                <Text className="text-red-500 text-sm mb-3">{error}</Text>
              ) : null}
              <View className="flex-row gap-3">
                <Pressable
                  className={`flex-1 py-3 px-4 rounded-lg ${
                    isDark ? "bg-slate-700" : "bg-slate-200"
                  }`}
                  onPress={handleClose}
                  disabled={loading}
                >
                  <Text
                    className={`text-center font-medium ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  className={`flex-1 py-3 px-4 rounded-lg ${
                    !message.trim() || loading
                      ? "bg-purple-400"
                      : "bg-purple-600"
                  }`}
                  onPress={handleSubmit}
                  disabled={!message.trim() || loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-center font-medium text-white">
                      Submit
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
