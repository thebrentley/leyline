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

interface CreatePodDialogProps {
  visible: boolean;
  onCreated: (podId: string) => void;
  onCancel: () => void;
  createPod: (
    name: string,
    description?: string,
  ) => Promise<{ data?: { id: string } | null; error?: string | null }>;
}

export function CreatePodDialog({
  visible,
  onCreated,
  onCancel,
  createPod,
}: CreatePodDialogProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const result = await createPod(name.trim(), description.trim() || undefined);
    setCreating(false);

    if (result.data) {
      setName("");
      setDescription("");
      onCreated(result.data.id);
    }
  };

  const handleCancel = () => {
    setName("");
    setDescription("");
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
            className={`text-xl font-semibold mb-4 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Create Pod
          </Text>

          <View className="gap-4 mb-6">
            <View className="gap-1">
              <Text
                className={`text-sm font-medium ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Pod Name *
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Friday Night MTG"
                placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                className={`rounded-lg border px-4 py-3 text-base ${
                  isDark
                    ? "border-slate-600 bg-slate-700 text-white"
                    : "border-slate-300 bg-slate-100 text-slate-900"
                }`}
                autoFocus
                inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
              />
            </View>

            <View className="gap-1">
              <Text
                className={`text-sm font-medium ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Description
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="What's this pod about?"
                placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                multiline
                className={`rounded-lg border px-4 py-3 text-base ${
                  isDark
                    ? "border-slate-600 bg-slate-700 text-white"
                    : "border-slate-300 bg-slate-100 text-slate-900"
                }`}
                style={{ minHeight: 60, textAlignVertical: "top" }}
                inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
              />
            </View>
          </View>

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
                !name.trim() || creating
                  ? "bg-purple-600/50"
                  : "bg-purple-600"
              }`}
              onPress={handleCreate}
              disabled={!name.trim() || creating}
            >
              <Text className="text-center font-medium text-white">
                {creating ? "Creating..." : "Create"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
