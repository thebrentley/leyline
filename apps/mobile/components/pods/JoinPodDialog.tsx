import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  useColorScheme,
} from "react-native";

interface JoinPodDialogProps {
  visible: boolean;
  onJoined: (podId: string) => void;
  onCancel: () => void;
  joinByCode: (
    code: string,
  ) => Promise<{
    data?: { podId: string; podName: string } | null;
    error?: string | null;
  }>;
}

export function JoinPodDialog({
  visible,
  onJoined,
  onCancel,
  joinByCode,
}: JoinPodDialogProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setJoining(true);
    const result = await joinByCode(code.trim());
    setJoining(false);

    if (result.data) {
      setCode("");
      onJoined(result.data.podId);
    }
  };

  const handleCancel = () => {
    setCode("");
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <Pressable
        className="flex-1 bg-black/50 items-center justify-center p-4"
        onPress={handleCancel}
      >
        <Pressable
          className={`w-full max-w-sm rounded-2xl p-6 ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            className={`text-xl font-semibold mb-2 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Join Pod
          </Text>
          <Text
            className={`text-base mb-4 ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Enter the invite code shared by a pod admin.
          </Text>

          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="e.g. Ab3xK9mQ"
            placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
            className={`rounded-lg border px-4 py-3 text-center text-lg tracking-widest mb-6 ${
              isDark
                ? "border-slate-600 bg-slate-700 text-white"
                : "border-slate-300 bg-slate-100 text-slate-900"
            }`}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onSubmitEditing={handleJoin}
          />

          <View className="flex-row gap-3">
            <Pressable
              className={`flex-1 py-3 px-4 rounded-lg ${
                isDark ? "bg-slate-700" : "bg-slate-200"
              }`}
              onPress={handleCancel}
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
                !code.trim() || joining
                  ? "bg-purple-600/50"
                  : "bg-purple-600"
              }`}
              onPress={handleJoin}
              disabled={!code.trim() || joining}
            >
              <Text className="text-center font-medium text-white">
                {joining ? "Joining..." : "Join"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
