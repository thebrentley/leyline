import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  useColorScheme,
} from "react-native";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        className="flex-1 bg-black/50 items-center justify-center p-4"
        onPress={onCancel}
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
            {title}
          </Text>
          <Text
            className={`text-base mb-6 ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            {message}
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              className={`flex-1 py-3 px-4 rounded-lg ${
                isDark ? "bg-slate-700" : "bg-slate-200"
              }`}
              onPress={onCancel}
            >
              <Text
                className={`text-center font-medium ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {cancelText}
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 py-3 px-4 rounded-lg ${
                destructive
                  ? "bg-red-600"
                  : isDark
                  ? "bg-blue-600"
                  : "bg-blue-500"
              }`}
              onPress={onConfirm}
            >
              <Text className="text-center font-medium text-white">
                {confirmText}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
