import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  useColorScheme,
} from "react-native";
import { KEYBOARD_ACCESSORY_ID } from "~/components/ui/KeyboardDoneAccessory";
import { Button } from "./button";

interface CreateDeckDialogProps {
  visible: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function CreateDeckDialog({
  visible,
  onConfirm,
  onCancel,
}: CreateDeckDialogProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [deckName, setDeckName] = useState("");

  const handleConfirm = () => {
    if (deckName.trim()) {
      onConfirm(deckName.trim());
      setDeckName(""); // Reset for next time
    }
  };

  const handleCancel = () => {
    setDeckName(""); // Reset on cancel
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
            Create New Deck
          </Text>
          <Text
            className={`text-base mb-4 ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Enter a name for your deck
          </Text>
          <TextInput
            className={`w-full px-4 py-3 rounded-lg mb-6 ${
              isDark
                ? "bg-slate-700 text-white border border-slate-600"
                : "bg-slate-100 text-slate-900 border border-slate-300"
            }`}
            placeholder="Deck name"
            placeholderTextColor={isDark ? "#94a3b8" : "#64748b"}
            value={deckName}
            onChangeText={setDeckName}
            autoFocus
            onSubmitEditing={handleConfirm}
            inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
          />
          <View className="flex-row gap-3">
            <Button
              className="flex-1 py-3 px-4"
              variant="secondary"
              onPress={handleCancel}
            >
              <Text
                className={`text-center font-medium ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Cancel
              </Text>
            </Button>
            <Button
              className="flex-1 py-3 px-4"
              onPress={handleConfirm}
              disabled={!deckName.trim()}
            >
              <Text className="text-center font-medium text-white">
                Create
              </Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
