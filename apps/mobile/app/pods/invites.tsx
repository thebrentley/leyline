import { router, Stack, useFocusEffect } from "expo-router";
import { ArrowLeft, Check, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { podsApi, type PodInviteInfo } from "~/lib/api";
import { showToast } from "~/lib/toast";
import { useResponsive } from "~/hooks/useResponsive";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";

export default function PendingInvitesScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();
  const [invites, setInvites] = useState<PodInviteInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInvites = useCallback(async () => {
    const result = await podsApi.getPendingInvites();
    if (result.data) {
      setInvites(result.data);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInvites();
    }, [loadInvites]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInvites();
    setRefreshing(false);
  }, [loadInvites]);

  const handleRespond = async (inviteId: string, accept: boolean) => {
    const result = await podsApi.respondToInvite(inviteId, accept);
    if (result.data) {
      showToast.success(accept ? "Joined pod!" : "Invite declined");
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } else {
      showToast.error(result.error || "Failed to respond");
    }
  };

  return (
    <View className="flex-1 flex-row">
      <Stack.Screen options={{ headerShown: false }} />
      {isDesktop && <DesktopSidebar />}
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
        edges={isDesktop ? [] : ["top"]}
      >
        {/* Header */}
        <View className="flex-row items-center px-4 lg:px-6 py-3 lg:py-4">
          <View className="flex-row items-center gap-3 flex-1">
            {!isDesktop && (
              <Pressable
                onPress={() => router.back()}
                className={`rounded-full p-2 ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
              >
                <ArrowLeft size={24} color={isDark ? "#94a3b8" : "#64748b"} />
              </Pressable>
            )}
            <View className="flex-1">
              {isDesktop && (
                <View className="flex-row items-center gap-2 mb-1">
                  <Pressable onPress={() => router.push("/(tabs)/pods")} className="hover:underline">
                    <Text className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
                      Pods
                    </Text>
                  </Pressable>
                  <Text className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>/</Text>
                  <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Pending Invites
                  </Text>
                </View>
              )}
              <Text
                className={`text-lg lg:text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Pending Invites
              </Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
              Loading...
            </Text>
          </View>
        ) : invites.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-2">
            <Text
              className={`text-lg ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              No pending invites
            </Text>
          </View>
        ) : (
          <FlatList
            data={invites}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => (
              <View
                className={`mx-4 mb-3 rounded-xl border p-4 ${
                  isDark
                    ? "border-slate-800 bg-slate-900"
                    : "border-slate-200 bg-white"
                }`}
              >
                <Text
                  className={`text-lg font-semibold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {item.pod.name}
                </Text>
                {item.pod.description && (
                  <Text
                    className={`mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    numberOfLines={2}
                  >
                    {item.pod.description}
                  </Text>
                )}
                <Text
                  className={`mt-1 text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  Invited by{" "}
                  {item.inviter.displayName || item.inviter.email} &middot;{" "}
                  {item.pod.memberCount} members
                </Text>
                <View className="mt-3 flex-row gap-2">
                  <Pressable
                    onPress={() => handleRespond(item.id, true)}
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-purple-600 py-2"
                  >
                    <Check size={18} color="#ffffff" />
                    <Text className="font-semibold text-white">Accept</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRespond(item.id, false)}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg border py-2 ${
                      isDark ? "border-slate-700" : "border-slate-300"
                    }`}
                  >
                    <X
                      size={18}
                      color={isDark ? "#e2e8f0" : "#1e293b"}
                    />
                    <Text
                      className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      Decline
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
