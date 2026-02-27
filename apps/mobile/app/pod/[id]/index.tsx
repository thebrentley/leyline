import {
  router,
  Stack,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Settings,
  Trophy,
  Users,
  UserX,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

const isWeb = Platform.OS === "web";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  podsApi,
  type PodDetail,
  type PodEventSummary,
  type PodMemberStats,
  type PodDeckStats,
  type PodOfflineMember,
} from "~/lib/api";
import { useResponsive } from "~/hooks/useResponsive";
import { HeaderButton, HeaderButtonGroup } from "~/components/ui/HeaderButton";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";
import { AddMemberDialog } from "~/components/pods/AddMemberDialog";
import { WinRateChart } from "~/components/pods/WinRateChart";
import { CreateEventSheet } from "~/components/ui/CreateEventSheet";

export default function PodDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();
  const [pod, setPod] = useState<PodDetail | null>(null);
  const [events, setEvents] = useState<PodEventSummary[]>([]);
  const [offlineMembers, setOfflineMembers] = useState<PodOfflineMember[]>([]);
  const [memberStats, setMemberStats] = useState<PodMemberStats | null>(null);
  const [deckStats, setDeckStats] = useState<PodDeckStats | null>(null);
  const [winRateMode, setWinRateMode] = useState<"player" | "deck">("player");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  const loadPod = useCallback(async () => {
    if (!id) return;
    const [
      podResult,
      eventsResult,
      offlineMembersResult,
      statsResult,
      deckStatsResult,
    ] = await Promise.all([
      podsApi.get(id),
      podsApi.listEvents(id, true),
      podsApi.listOfflineMembers(id),
      podsApi.getMemberStats(id),
      podsApi.getDeckStats(id),
    ]);
    if (podResult.data) setPod(podResult.data);
    if (eventsResult.data) setEvents(eventsResult.data.slice(0, 3));
    if (offlineMembersResult.data) setOfflineMembers(offlineMembersResult.data);
    if (statsResult.data) setMemberStats(statsResult.data);
    if (deckStatsResult.data) setDeckStats(deckStatsResult.data);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadPod();
    }, [loadPod]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPod();
    setRefreshing(false);
  }, [loadPod]);

  if (loading || !pod) {
    return (
      <View className="flex-1 flex-row">
        <Stack.Screen
          options={{
            headerShown: !isDesktop,
            headerShadowVisible: false,
            title: "Pod",
            headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
            headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
            headerLeft: () => (
              <Pressable
                onPress={() => router.replace("/(tabs)/pods")}
                hitSlop={8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginRight: 8,
                }}
              >
                <ChevronLeft size={28} color="#7C3AED" />
                <Text style={{ color: "#7C3AED", fontSize: 17 }}>Pods</Text>
              </Pressable>
            ),
            ...(isWeb && { headerRightContainerStyle: { paddingRight: 16 } }),
          }}
        />
        {isDesktop && <DesktopSidebar />}
        <SafeAreaView
          className={`flex-1 items-center justify-center ${isDark ? "bg-slate-950" : "bg-white"}`}
          edges={[]}
        >
          <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
            Loading...
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  const isAdmin = pod.role === "admin" || pod.role === "owner";

  return (
    <View className="flex-1 flex-row">
      <Stack.Screen
        options={{
          headerShown: !isDesktop,
          headerShadowVisible: false,
          title: pod.name,
          headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
          headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
          headerLeft: () => (
            <Pressable
              onPress={() => router.replace("/(tabs)/pods")}
              hitSlop={8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginRight: 8,
              }}
            >
              <ChevronLeft size={28} color="#7C3AED" />
              <Text style={{ color: "#7C3AED", fontSize: 17 }}>Pods</Text>
            </Pressable>
          ),
          headerRight: isAdmin
            ? () => (
                <HeaderButton
                  icon={Settings}
                  variant="ghost"
                  onPress={() => router.push(`/pod/${id}/settings`)}
                  iconSize={22}
                  hitSlop={8}
                />
              )
            : undefined,
          ...(isWeb && { headerRightContainerStyle: { paddingRight: 16 } }),
        }}
      />
      {isDesktop && <DesktopSidebar />}
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
        edges={[]}
      >
        {/* Header - desktop only (mobile uses native stack header) */}
        {isDesktop && (
          <View className="flex-row items-center justify-between px-4 lg:px-6 py-3 lg:py-4">
            <View className="flex-row items-center gap-3 flex-1">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Pressable
                    onPress={() => router.push("/(tabs)/pods")}
                    className="hover:underline"
                  >
                    <Text
                      className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      Pods
                    </Text>
                  </Pressable>
                  <Text
                    className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}
                  >
                    /
                  </Text>
                  <Text
                    className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    numberOfLines={1}
                  >
                    {pod.name}
                  </Text>
                </View>
                <Text
                  className={`text-lg lg:text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                  numberOfLines={1}
                >
                  {pod.name}
                </Text>
              </View>
            </View>
            {isAdmin && (
              <Pressable
                onPress={() => router.push(`/pod/${id}/settings`)}
                hitSlop={8}
                className={`flex-row items-center gap-1.5 rounded-lg px-3 py-2 ${
                  isDark
                    ? "active:bg-slate-800 lg:hover:bg-slate-800 lg:bg-slate-800"
                    : "active:bg-slate-100 lg:hover:bg-slate-100 lg:bg-slate-100"
                }`}
              >
                <Settings size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text
                  className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}
                >
                  Settings
                </Text>
              </Pressable>
            )}
          </View>
        )}
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="w-full max-w-content mx-auto"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          {/* Description */}
          {pod.description && (
            <Text
              className={`pb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              {pod.description}
            </Text>
          )}

          {/* Dashboard Grid — 4-col on desktop, stacked on mobile */}
          <View className="gap-4 lg:grid lg:grid-cols-6 lg:grid-rows-[500px_auto]">
            {/* Insights Card — 4 of 6 columns */}
            <View className="lg:col-span-4">
              <View
                className={`lg:flex-1 rounded-2xl border p-5 lg:p-6 ${
                  isDark
                    ? "border-slate-800 bg-slate-900"
                    : "border-slate-200 bg-slate-50"
                }`}
                style={{ minHeight: 200 }}
              >
                <View className="flex-row items-center gap-2 mb-4">
                  <BarChart3 size={18} color={isDark ? "#a855f7" : "#8b5cf6"} />
                  <Text
                    className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    Insights
                  </Text>
                </View>

                {memberStats && memberStats.totalGames > 0 ? (
                  <>
                    <View className="flex-row gap-4 mb-5">
                      <View
                        className={`flex-1 rounded-xl p-3 ${isDark ? "bg-slate-800" : "bg-white"}`}
                      >
                        <Text
                          className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                        >
                          Total Games
                        </Text>
                        <Text
                          className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                        >
                          {memberStats.totalGames}
                        </Text>
                      </View>
                      <View
                        className={`flex-1 rounded-xl p-3 ${isDark ? "bg-slate-800" : "bg-white"}`}
                      >
                        <Text
                          className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                        >
                          Most Wins
                        </Text>
                        <Text
                          className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                          numberOfLines={1}
                        >
                          {(() => {
                            const top = memberStats.memberStats[0];
                            if (!top) return "---";
                            if (top.userId) {
                              const m = pod.members.find(
                                (mem) => mem.userId === top.userId,
                              );
                              return (
                                m?.displayName ||
                                m?.email?.split("@")[0] ||
                                "Unknown"
                              );
                            }
                            return top.name || "Unknown";
                          })()}
                        </Text>
                        <Text
                          className={`text-xs ${isDark ? "text-purple-400" : "text-purple-600"}`}
                        >
                          {memberStats.memberStats[0]?.wins ?? 0} wins
                        </Text>
                      </View>
                    </View>

                    <WinRateChart
                      mode={winRateMode}
                      onToggle={() =>
                        setWinRateMode((m) =>
                          m === "player" ? "deck" : "player",
                        )
                      }
                      bars={
                        winRateMode === "player"
                          ? memberStats.memberStats.map((stat) => {
                              let displayName = "Unknown";
                              if (stat.userId) {
                                const m = pod.members.find(
                                  (mem) => mem.userId === stat.userId,
                                );
                                displayName =
                                  m?.displayName ||
                                  m?.email?.split("@")[0] ||
                                  "Unknown";
                              } else if (stat.name) {
                                displayName = stat.name;
                              }
                              return {
                                key:
                                  stat.userId ||
                                  stat.offlineMemberId ||
                                  "unknown",
                                displayName,
                                winRate: stat.winRate,
                                wins: stat.wins,
                                gamesPlayed: stat.gamesPlayed,
                              };
                            })
                          : (deckStats?.deckStats ?? []).map((stat) => {
                              let owner = "";
                              if (stat.userId) {
                                const m = pod.members.find(
                                  (mem) => mem.userId === stat.userId,
                                );
                                owner =
                                  m?.displayName ||
                                  m?.email?.split("@")[0] ||
                                  "";
                              }
                              return {
                                key: `${stat.deckId || stat.deckName}-${stat.userId || ""}`,
                                displayName: owner
                                  ? `${stat.deckName} (${owner})`
                                  : stat.deckName,
                                winRate: stat.winRate,
                                wins: stat.wins,
                                gamesPlayed: stat.gamesPlayed,
                              };
                            })
                      }
                    />
                  </>
                ) : (
                  <View className="flex-1 items-center justify-center gap-3">
                    <View
                      className={`h-12 w-12 items-center justify-center rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                    >
                      <Trophy
                        size={24}
                        color={isDark ? "#64748b" : "#94a3b8"}
                      />
                    </View>
                    <Text
                      className={`text-sm text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      No games recorded yet.{"\n"}Game stats will appear here.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Upcoming Game Nights Card — 1 of 4 columns */}
            <View className="lg:col-span-2">
              <View className="lg:flex-1 rounded-2xl justify-between">
                <View>
                  <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
                    <Text
                      className={`text-base font-semibold ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      Upcoming Game Nights
                    </Text>
                    <Pressable
                      onPress={() => router.push(`/pod/${id}/events`)}
                      className="lg:hover:opacity-80"
                    >
                      <Text className="text-sm font-medium text-purple-500">
                        See all
                      </Text>
                    </Pressable>
                  </View>

                  {events.length === 0 ? (
                    <View className="items-center px-5 pt-4 gap-3">
                      <View
                        className={`h-12 w-12 items-center justify-center rounded-full ${
                          isDark ? "bg-slate-800" : "bg-slate-200"
                        }`}
                      >
                        <Calendar
                          size={24}
                          color={isDark ? "#64748b" : "#94a3b8"}
                        />
                      </View>
                      <Text
                        className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
                      >
                        No upcoming events
                      </Text>
                    </View>
                  ) : (
                    <View>
                      {events.map((event, idx) => (
                        <Pressable
                          key={event.id}
                          onPress={() =>
                            router.push(`/pod/${id}/event/${event.id}`)
                          }
                          className={`flex-row items-center gap-3 px-5 py-3.5 ${
                            isDark
                              ? "active:bg-slate-800 lg:hover:bg-slate-800/50"
                              : "active:bg-slate-100 lg:hover:bg-slate-50"
                          } ${
                            idx < events.length - 1
                              ? `border-b ${isDark ? "border-slate-800" : "border-slate-200"}`
                              : ""
                          }`}
                        >
                          {/* Date badge */}
                          <View
                            className={`items-center justify-center rounded-xl h-14 w-14 ${
                              isDark ? "bg-slate-800" : "bg-white"
                            }`}
                          >
                            <Text
                              className={`text-xs font-medium uppercase ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {new Date(event.startsAt).toLocaleDateString(
                                undefined,
                                { month: "short" },
                              )}
                            </Text>
                            <Text
                              className={`text-lg font-bold ${
                                isDark ? "text-white" : "text-slate-900"
                              }`}
                            >
                              {new Date(event.startsAt).getDate()}
                            </Text>
                          </View>
                          {/* Event info */}
                          <View className="flex-1">
                            <Text
                              className={`font-semibold ${
                                isDark ? "text-white" : "text-slate-900"
                              }`}
                              numberOfLines={1}
                            >
                              {event.name}
                            </Text>
                            <Text
                              className={`text-sm ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {new Date(event.startsAt).toLocaleTimeString(
                                undefined,
                                {
                                  hour: "numeric",
                                  minute: "2-digit",
                                },
                              )}
                              {event.location
                                ? ` \u00B7 ${event.location}`
                                : ""}
                            </Text>
                            <View className="flex-row items-center gap-3 mt-1">
                              <View className="flex-row items-center gap-1">
                                <Users
                                  size={13}
                                  color={isDark ? "#64748b" : "#94a3b8"}
                                />
                                <Text
                                  className={`text-xs ${
                                    isDark ? "text-slate-500" : "text-slate-400"
                                  }`}
                                >
                                  {event.rsvpCounts.accepted} going
                                </Text>
                              </View>
                            </View>
                          </View>
                          <ChevronRight
                            size={16}
                            color={isDark ? "#475569" : "#cbd5e1"}
                            className="self-center"
                          />
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {/* Create Event button — pinned to bottom */}
                <View className="px-5 pt-2 pb-5">
                  <Pressable
                    onPress={() => setShowCreateEvent(true)}
                    className={`flex-row items-center justify-center gap-2 rounded-lg border py-2.5 ${
                      isDark ? "border-slate-700" : "border-slate-300"
                    }`}
                  >
                    <Calendar
                      size={16}
                      color={isDark ? "#e2e8f0" : "#1e293b"}
                    />
                    <Text
                      className={`text-sm font-semibold ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      Create Event
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Members Card — full width */}
            <View className="rounded-2xl lg:col-span-6">
              <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
                <Text
                  className={`text-base font-semibold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Members
                </Text>
                <View className="flex-row items-center gap-2">
                  <Text
                    className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
                  >
                    {pod.memberCount}
                  </Text>
                  <Pressable
                    onPress={() => setShowAddMemberDialog(true)}
                    className="h-6 w-6 items-center justify-center rounded-full bg-purple-600"
                  >
                    <Plus size={14} color="#ffffff" />
                  </Pressable>
                </View>
              </View>
              <View className="flex-row flex-wrap gap-3 px-5 pb-2">
                {pod.members.map((member) => (
                  <Pressable
                    key={member.id}
                    onPress={() =>
                      router.push(
                        `/user/${member.userId}?podId=${id}&podName=${encodeURIComponent(pod.name)}`,
                      )
                    }
                    className={`flex-row items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                      isDark
                        ? "border-slate-700 active:bg-slate-800 lg:hover:bg-slate-800/50"
                        : "border-slate-200 active:bg-slate-100 lg:hover:bg-slate-50"
                    }`}
                  >
                    {member.profilePicture ? (
                      <Image
                        source={{ uri: member.profilePicture }}
                        className="h-8 w-8 rounded-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-purple-600">
                        <Text className="text-xs font-bold text-white">
                          {(member.displayName || member.email)
                            ?.charAt(0)
                            .toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View>
                      <Text
                        className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                        numberOfLines={1}
                      >
                        {member.displayName || member.email.split("@")[0]}
                      </Text>
                      {member.role === "owner" && (
                        <Text className="text-xs font-medium text-purple-400">
                          Owner
                        </Text>
                      )}
                      {member.role === "admin" && (
                        <Text className="text-xs font-medium text-purple-400">
                          Admin
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
                {pod.pendingInvites?.map((invite) => (
                  <View
                    key={`invite-${invite.id}`}
                    className={`flex-row items-center gap-2.5 rounded-xl border border-dashed px-3 py-2.5 ${
                      isDark ? "border-slate-600" : "border-slate-300"
                    }`}
                  >
                    <View
                      className={`h-8 w-8 items-center justify-center rounded-full ${
                        isDark ? "bg-slate-700" : "bg-slate-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}
                      >
                        {(invite.displayName || invite.email)
                          ?.charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text
                        className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
                        numberOfLines={1}
                      >
                        {invite.displayName || invite.email.split("@")[0]}
                      </Text>
                      <View className="flex-row items-center gap-1">
                        <Clock
                          size={10}
                          color={isDark ? "#f59e0b" : "#d97706"}
                        />
                        <Text className="text-xs font-medium text-amber-500">
                          Invited
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
                {/* Offline members - only show unlinked ones */}
                {offlineMembers
                  .filter((om) => !om.linkedUserId)
                  .map((offlineMember) => (
                    <View
                      key={`offline-${offlineMember.id}`}
                      className={`flex-row items-center gap-2.5 rounded-xl border border-dashed px-3 py-2.5 ${
                        isDark ? "border-slate-600" : "border-slate-300"
                      }`}
                    >
                      <View
                        className={`h-8 w-8 items-center justify-center rounded-full ${
                          isDark ? "bg-slate-700" : "bg-slate-200"
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}
                        >
                          {offlineMember.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text
                          className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
                          numberOfLines={1}
                        >
                          {offlineMember.name}
                        </Text>
                        <View className="flex-row items-center gap-1">
                          <UserX
                            size={10}
                            color={isDark ? "#64748b" : "#94a3b8"}
                          />
                          <Text
                            className={`text-xs font-medium ${isDark ? "text-slate-500" : "text-slate-400"}`}
                          >
                            Offline
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
              </View>
            </View>
          </View>
        </ScrollView>
        {id && (
          <>
            <AddMemberDialog
              visible={showAddMemberDialog}
              podId={id}
              onClose={() => {
                setShowAddMemberDialog(false);
                loadPod();
              }}
            />
            <CreateEventSheet
              visible={showCreateEvent}
              onDismiss={() => setShowCreateEvent(false)}
              podId={id}
            />
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
