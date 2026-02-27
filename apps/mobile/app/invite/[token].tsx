import { router, Stack, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mail, Users } from "lucide-react-native";
import { podsApi, InviteTokenInfo } from "~/lib/api";
import { useAuth } from "~/contexts/AuthContext";
import { secureStorage } from "~/lib/storage";
import { showToast } from "~/lib/toast";

const PENDING_INVITE_TOKEN_KEY = "pending_invite_token";

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuth();

  const [invite, setInvite] = useState<InviteTokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const result = await podsApi.getInviteByToken(token);
      if (result.data) {
        setInvite(result.data);
      } else {
        setError(result.error || "Invite not found");
      }
      setLoading(false);
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    const result = await podsApi.acceptInviteByToken(token);
    setAccepting(false);

    if (result.data) {
      showToast.success(`Joined ${invite?.podName}!`);
      router.replace(`/pod/${result.data.podId}`);
    } else {
      showToast.error(result.error || "Failed to accept invite");
    }
  };

  const handleSignUp = async () => {
    if (token) {
      await secureStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
    }
    router.push("/(auth)/signup");
  };

  const handleLogIn = async () => {
    if (token) {
      await secureStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
    }
    router.push("/(auth)/login");
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          title: "Pod Invite",
          headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
          headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
        }}
      />
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
        edges={["bottom"]}
      >
        <View className="flex-1 items-center justify-center p-6">
          {loading ? (
            <ActivityIndicator size="large" color="#8B5CF6" />
          ) : error ? (
            <View className="items-center gap-4">
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Invite Not Found
              </Text>
              <Text
                className={`text-center text-base ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {error}
              </Text>
              <Pressable
                onPress={() => router.replace("/(tabs)")}
                className="mt-4 rounded-lg bg-purple-600 px-6 py-3"
              >
                <Text className="font-semibold text-white">Go Home</Text>
              </Pressable>
            </View>
          ) : invite?.expired ? (
            <View className="items-center gap-4">
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Invite Expired
              </Text>
              <Text
                className={`text-center text-base ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                This invite to {invite.podName} has expired. Ask the pod admin
                to send a new one.
              </Text>
            </View>
          ) : invite?.status !== "pending" ? (
            <View className="items-center gap-4">
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Invite Already Used
              </Text>
              <Text
                className={`text-center text-base ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                This invite has already been {invite?.status}.
              </Text>
              <Pressable
                onPress={() => router.replace("/(tabs)")}
                className="mt-4 rounded-lg bg-purple-600 px-6 py-3"
              >
                <Text className="font-semibold text-white">Go Home</Text>
              </Pressable>
            </View>
          ) : (
            <View className="w-full items-center gap-6">
              {/* Pod info card */}
              <View
                className={`w-full rounded-2xl p-6 ${
                  isDark ? "bg-slate-800" : "bg-slate-50"
                }`}
              >
                <View className="items-center gap-4">
                  <View className="h-16 w-16 items-center justify-center rounded-full bg-purple-600/20">
                    <Users size={32} color="#8B5CF6" />
                  </View>
                  <View className="items-center gap-1">
                    <Text
                      className={`text-xl font-bold ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {invite?.podName}
                    </Text>
                    {invite?.podDescription && (
                      <Text
                        className={`text-center text-sm ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {invite.podDescription}
                      </Text>
                    )}
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Mail size={14} color={isDark ? "#94a3b8" : "#64748b"} />
                    <Text
                      className={`text-sm ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Invited by {invite?.inviterName}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action buttons */}
              {user ? (
                <Pressable
                  onPress={handleAccept}
                  disabled={accepting}
                  className={`w-full items-center rounded-lg py-3.5 ${
                    accepting
                      ? "bg-purple-600/50"
                      : "bg-purple-600 active:bg-purple-700"
                  }`}
                >
                  <Text className="text-base font-semibold text-white">
                    {accepting ? "Joining..." : "Accept Invite"}
                  </Text>
                </Pressable>
              ) : (
                <View className="w-full gap-3">
                  <Pressable
                    onPress={handleSignUp}
                    className="w-full items-center rounded-lg bg-purple-600 py-3.5 active:bg-purple-700"
                  >
                    <Text className="text-base font-semibold text-white">
                      Sign Up to Join
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleLogIn}
                    className={`w-full items-center rounded-lg border py-3.5 ${
                      isDark
                        ? "border-slate-600 active:bg-slate-800"
                        : "border-slate-300 active:bg-slate-100"
                    }`}
                  >
                    <Text
                      className={`text-base font-semibold ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      Log In to Join
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}
