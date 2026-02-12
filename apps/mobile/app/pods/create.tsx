import { router, Stack } from "expo-router";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { podsApi } from "~/lib/api";
import { showToast } from "~/lib/toast";

export default function CreatePodScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const result = await podsApi.create(name.trim(), description.trim() || undefined);
    setCreating(false);

    if (result.data) {
      showToast.success("Pod created!");
      router.replace(`/pod/${result.data.id}`);
    } else {
      showToast.error(result.error || "Failed to create pod");
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Create Pod",
          headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
          headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
        }}
      />
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
        edges={[]}
      >
        <View className="gap-6 p-6">
          <View className="gap-2">
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
                  ? "border-slate-700 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-900"
              }`}
              autoFocus
            />
          </View>

          <View className="gap-2">
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
              numberOfLines={3}
              className={`rounded-lg border px-4 py-3 text-base ${
                isDark
                  ? "border-slate-700 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-900"
              }`}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
          </View>

          <Pressable
            onPress={handleCreate}
            disabled={!name.trim() || creating}
            className={`items-center rounded-lg py-3 ${
              !name.trim() || creating
                ? "bg-purple-600/50"
                : "bg-purple-600 active:bg-purple-700"
            }`}
          >
            <Text className="text-base font-semibold text-white">
              {creating ? "Creating..." : "Create Pod"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}
