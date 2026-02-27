import { router, Stack } from "expo-router";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { podsApi } from "~/lib/api";
import { showToast } from "~/lib/toast";
import { KEYBOARD_ACCESSORY_ID } from "~/components/ui/KeyboardDoneAccessory";

export default function JoinPodScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setJoining(true);
    const result = await podsApi.joinByCode(code.trim());
    setJoining(false);

    if (result.data) {
      showToast.success(`Joined ${result.data.podName}!`);
      router.replace(`/pod/${result.data.podId}`);
    } else {
      showToast.error(result.error || "Invalid invite code");
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          title: "Join Pod",
          headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
          headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
          headerBackTitle: "Pods",
        }}
      />
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
        edges={["bottom"]}
      >
        <View className="gap-6 p-6">
          <Text
            className={`text-base ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Enter the invite code shared by a pod admin to join their group.
          </Text>

          <View className="gap-2">
            <Text
              className={`text-sm font-medium ${
                isDark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              Invite Code
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="e.g. Ab3xK9mQ"
              placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
              className={`rounded-lg border px-4 py-3 text-center text-lg font-mono tracking-widest ${
                isDark
                  ? "border-slate-700 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-900"
              }`}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
            />
          </View>

          <Pressable
            onPress={handleJoin}
            disabled={!code.trim() || joining}
            className={`items-center rounded-lg py-3 ${
              !code.trim() || joining
                ? "bg-purple-600/50"
                : "bg-purple-600 active:bg-purple-700"
            }`}
          >
            <Text className="text-base font-semibold text-white">
              {joining ? "Joining..." : "Join Pod"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}
