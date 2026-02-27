import { Stack, useLocalSearchParams, useFocusEffect } from "expo-router";
import { router } from "expo-router";
import {
  Calendar,
  Check,
  ChevronLeft,
  MapPin,
  Play,
  UserX,
  X,
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
import { podsApi, type PodEventDetail, type RsvpStatus } from "~/lib/api";
import { useAuth } from "~/contexts/AuthContext";
import { showToast } from "~/lib/toast";
import { useResponsive } from "~/hooks/useResponsive";
import { useEventChat } from "~/hooks/useEventChat";

import { DesktopSidebar } from "~/components/web/DesktopSidebar";
import { EventChat } from "~/components/pods/EventChat";
import { RsvpSummaryButton } from "~/components/pods/RsvpSummaryButton";
import { RsvpSheet } from "~/components/pods/RsvpSheet";

export default function EventDetailScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();
  const { user } = useAuth();
  const [event, setEvent] = useState<PodEventDetail | null>(null);
  const [podName, setPodName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null);
  const [rsvpSheetVisible, setRsvpSheetVisible] = useState(false);

  const chat = useEventChat({ podId: id!, eventId: eventId! });

  const loadEvent = useCallback(async () => {
    if (!id || !eventId) return;
    const [eventResult, podResult] = await Promise.all([
      podsApi.getEvent(id, eventId),
      podsApi.get(id),
    ]);
    if (eventResult.data) {
      setEvent(eventResult.data);
      const myRsvp = eventResult.data.rsvps.find((r) => r.userId === user?.id);
      setMyStatus(myRsvp?.status ?? null);
    }
    if (podResult.data) {
      setPodName(podResult.data.name);
      setIsAdmin(podResult.data.role === "admin" || podResult.data.role === "owner");
    }
    setLoading(false);
  }, [id, eventId]);

  useFocusEffect(
    useCallback(() => {
      loadEvent();
    }, [loadEvent]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvent();
    setRefreshing(false);
  }, [loadEvent]);

  const handleRsvp = async (status: RsvpStatus) => {
    if (!id || !eventId) return;
    const result = await podsApi.rsvp(id, eventId, status);
    if (result.data) {
      setMyStatus(status);
      showToast.success(status === "accepted" ? "You're going!" : "Marked as not going");
      loadEvent();
    } else {
      showToast.error(result.error || "Failed to RSVP");
    }
  };

  const handleOfflineRsvp = async (offlineMemberId: string, status: RsvpStatus) => {
    if (!id || !eventId) return;
    const result = await podsApi.setOfflineRsvp(id, eventId, offlineMemberId, status);
    if (result.data) {
      showToast.success("RSVP updated");
      loadEvent();
    } else {
      showToast.error(result.error || "Failed to update RSVP");
    }
  };

  if (loading || !event) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: !isDesktop,
            headerShadowVisible: false,
            title: "Event",
            headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
            headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
            headerLeft: () => (
              <Pressable
                onPress={() => router.push(`/pod/${id}/events`)}
                hitSlop={8}
                style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}
              >
                <ChevronLeft size={28} color="#7C3AED" />
                <Text style={{ color: "#7C3AED", fontSize: 17 }}>Events</Text>
              </Pressable>
            ),
            ...(isWeb && { headerRightContainerStyle: { paddingRight: 16 } }),
          }}
        />
        <SafeAreaView
          className={`flex-1 items-center justify-center ${isDark ? "bg-slate-950" : "bg-white"}`}
          edges={[]}
        >
          <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
            Loading...
          </Text>
        </SafeAreaView>
      </>
    );
  }

  const going = event.rsvps.filter((r) => r.status === "accepted");
  const notGoing = event.rsvps.filter((r) => r.status === "declined");
  const offlineGoing = event.offlineRsvps.filter((r) => r.status === "accepted");
  const offlineNotGoing = event.offlineRsvps.filter((r) => r.status === "declined");
  const goingCount = going.length + offlineGoing.length;
  const notGoingCount = notGoing.length + offlineNotGoing.length;
  const pendingCount = event.notResponded.length + event.offlineNotResponded.length;

  // ==================== Desktop Layout ====================
  if (isDesktop) {
    return (
      <View className="flex-1 flex-row">
        <Stack.Screen
          options={{
            headerShown: false,
            ...(isWeb && { headerRightContainerStyle: { paddingRight: 16 } }),
          }}
        />
        <DesktopSidebar />
        <SafeAreaView
          className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
          edges={[]}
        >
          {/* Breadcrumb header */}
          <View className="flex-row items-center px-4 lg:px-6 py-3 lg:py-4">
            <View className="flex-row items-center gap-3 flex-1">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Pressable onPress={() => router.push("/(tabs)/pods")} className="hover:underline">
                    <Text className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
                      Pods
                    </Text>
                  </Pressable>
                  <Text className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>/</Text>
                  <Pressable onPress={() => router.push(`/pod/${id}`)} className="hover:underline">
                    <Text className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`} numberOfLines={1}>
                      {podName || "..."}
                    </Text>
                  </Pressable>
                  <Text className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>/</Text>
                  <Pressable onPress={() => router.push(`/pod/${id}/events`)} className="hover:underline">
                    <Text className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
                      Events
                    </Text>
                  </Pressable>
                  <Text className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>/</Text>
                  <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`} numberOfLines={1}>
                    {event.name}
                  </Text>
                </View>
                <Text
                  className={`text-lg lg:text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                  numberOfLines={1}
                >
                  {event.name}
                </Text>
              </View>
            </View>
          </View>

          {/* Split layout: 2/3 chat | 1/3 event detail */}
          <View className="flex-1 flex-row">
            {/* Left: Chat */}
            <View
              className={`border-r ${isDark ? "border-slate-800" : "border-slate-200"}`}
              style={{ flex: 2 }}
            >
              <EventChat
                messages={chat.messages}
                loading={chat.loading}
                loadingMore={chat.loadingMore}
                hasMore={chat.hasMore}
                sending={chat.sending}
                currentUserId={chat.currentUserId}
                onSend={chat.sendMessage}
                onLoadMore={chat.loadMore}
                isDark={isDark}
                noBottomInset
              />
            </View>

            {/* Right: Event detail */}
            <ScrollView
              style={{ flex: 1 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}
            >
              {/* Event Info */}
              <View className="gap-3">
                <View className="flex-row items-center gap-2">
                  <Calendar size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                  <Text
                    className={`text-base ${isDark ? "text-slate-300" : "text-slate-700"}`}
                  >
                    {new Date(event.startsAt).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                {event.location && (
                  <View className="flex-row items-center gap-2">
                    <MapPin size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                    <Text
                      className={`text-base ${isDark ? "text-slate-300" : "text-slate-700"}`}
                    >
                      {event.location}
                    </Text>
                  </View>
                )}
                {event.description && (
                  <Text
                    className={`mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    {event.description}
                  </Text>
                )}
              </View>

              {/* RSVP Section */}
              <View
                className={`rounded-xl border p-4 ${
                  isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-50"
                }`}
              >
                <Text
                  className={`mb-3 text-sm font-medium uppercase tracking-wider ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Your RSVP
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => handleRsvp("accepted")}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg py-3 ${
                      myStatus === "accepted"
                        ? "bg-green-600"
                        : isDark
                          ? "border border-slate-700 bg-slate-800"
                          : "border border-slate-300 bg-white"
                    }`}
                  >
                    <Check
                      size={18}
                      color={
                        myStatus === "accepted"
                          ? "#ffffff"
                          : isDark
                            ? "#e2e8f0"
                            : "#1e293b"
                      }
                    />
                    <Text
                      className={`font-semibold ${
                        myStatus === "accepted"
                          ? "text-white"
                          : isDark
                            ? "text-white"
                            : "text-slate-900"
                      }`}
                    >
                      Going
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRsvp("declined")}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg py-3 ${
                      myStatus === "declined"
                        ? "bg-red-600"
                        : isDark
                          ? "border border-slate-700 bg-slate-800"
                          : "border border-slate-300 bg-white"
                    }`}
                  >
                    <X
                      size={18}
                      color={
                        myStatus === "declined"
                          ? "#ffffff"
                          : isDark
                            ? "#e2e8f0"
                            : "#1e293b"
                      }
                    />
                    <Text
                      className={`font-semibold ${
                        myStatus === "declined"
                          ? "text-white"
                          : isDark
                            ? "text-white"
                            : "text-slate-900"
                      }`}
                    >
                      Not Going
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Going */}
              <View className="gap-2">
                <Text
                  className={`text-sm font-medium uppercase tracking-wider ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Going ({goingCount})
                </Text>
                {goingCount === 0 ? (
                  <Text
                    className={`text-sm ${isDark ? "text-slate-600" : "text-slate-400"}`}
                  >
                    No one yet
                  </Text>
                ) : (
                  <>
                    {going.map((rsvp) => (
                      <Pressable
                        key={rsvp.userId}
                        onPress={() => router.push(`/user/${rsvp.userId}`)}
                        className={`flex-row items-center gap-3 rounded-lg px-3 py-2 ${
                          isDark ? "active:bg-slate-900" : "active:bg-slate-50"
                        }`}
                      >
                        {rsvp.profilePicture ? (
                          <Image
                            source={{ uri: rsvp.profilePicture }}
                            className="h-8 w-8 rounded-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="h-8 w-8 items-center justify-center rounded-full bg-green-600">
                            <Text className="text-sm font-bold text-white">
                              {(rsvp.displayName || rsvp.email || "?").charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View className="flex-1">
                          <Text
                            className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                          >
                            {rsvp.displayName || rsvp.email || "Unknown"}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                    {offlineGoing.map((rsvp) => (
                      <View
                        key={`offline-${rsvp.offlineMemberId}`}
                        className={`flex-row items-center gap-3 rounded-lg px-3 py-2 ${
                          isDark ? "bg-slate-900" : "bg-slate-50"
                        }`}
                      >
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-green-600/60">
                          <Text className="text-sm font-bold text-white">
                            {rsvp.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center gap-1.5">
                            <Text
                              className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                            >
                              {rsvp.name}
                            </Text>
                            <UserX size={12} color={isDark ? "#64748b" : "#94a3b8"} />
                          </View>
                          <Text className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                            Set by {rsvp.setBy.displayName || "admin"}
                          </Text>
                        </View>
                        {isAdmin && (
                          <Pressable
                            onPress={() => handleOfflineRsvp(rsvp.offlineMemberId, "declined")}
                            className={`rounded-lg px-2 py-1 ${
                              isDark ? "bg-slate-800" : "bg-white"
                            }`}
                          >
                            <X size={14} color={isDark ? "#94a3b8" : "#64748b"} />
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </>
                )}
              </View>

              {/* Not Going */}
              <View className="gap-2">
                <Text
                  className={`text-sm font-medium uppercase tracking-wider ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Not Going ({notGoingCount})
                </Text>
                {notGoingCount === 0 ? (
                  <Text
                    className={`text-sm ${isDark ? "text-slate-600" : "text-slate-400"}`}
                  >
                    No one
                  </Text>
                ) : (
                  <>
                    {notGoing.map((rsvp) => (
                      <Pressable
                        key={rsvp.userId}
                        onPress={() => router.push(`/user/${rsvp.userId}`)}
                        className={`flex-row items-center gap-3 rounded-lg px-3 py-2 ${
                          isDark ? "active:bg-slate-900" : "active:bg-slate-50"
                        }`}
                      >
                        {rsvp.profilePicture ? (
                          <Image
                            source={{ uri: rsvp.profilePicture }}
                            className="h-8 w-8 rounded-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="h-8 w-8 items-center justify-center rounded-full bg-red-600">
                            <Text className="text-sm font-bold text-white">
                              {(rsvp.displayName || rsvp.email || "?").charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View className="flex-1">
                          <Text
                            className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                          >
                            {rsvp.displayName || rsvp.email || "Unknown"}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                    {offlineNotGoing.map((rsvp) => (
                      <View
                        key={`offline-${rsvp.offlineMemberId}`}
                        className={`flex-row items-center gap-3 rounded-lg px-3 py-2 ${
                          isDark ? "bg-slate-900" : "bg-slate-50"
                        }`}
                      >
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-red-600/60">
                          <Text className="text-sm font-bold text-white">
                            {rsvp.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center gap-1.5">
                            <Text
                              className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                            >
                              {rsvp.name}
                            </Text>
                            <UserX size={12} color={isDark ? "#64748b" : "#94a3b8"} />
                          </View>
                          <Text className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                            Set by {rsvp.setBy.displayName || "admin"}
                          </Text>
                        </View>
                        {isAdmin && (
                          <Pressable
                            onPress={() => handleOfflineRsvp(rsvp.offlineMemberId, "accepted")}
                            className={`rounded-lg px-2 py-1 ${
                              isDark ? "bg-slate-800" : "bg-white"
                            }`}
                          >
                            <Check size={14} color={isDark ? "#94a3b8" : "#64748b"} />
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </>
                )}
              </View>

              {/* Not Responded */}
              {(event.notResponded.length > 0 || event.offlineNotResponded.length > 0) && (
                <View className="gap-2">
                  <Text
                    className={`text-sm font-medium uppercase tracking-wider ${
                      isDark ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    No Response ({pendingCount})
                  </Text>
                  {event.notResponded.map((u) => (
                    <Pressable
                      key={u.userId}
                      onPress={() => router.push(`/user/${u.userId}`)}
                      className={`flex-row items-center gap-3 rounded-lg px-3 py-2 ${
                        isDark ? "active:bg-slate-900" : "active:bg-slate-50"
                      }`}
                    >
                      {u.profilePicture ? (
                        <Image
                          source={{ uri: u.profilePicture }}
                          className="h-8 w-8 rounded-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          className={`h-8 w-8 items-center justify-center rounded-full ${
                            isDark ? "bg-slate-700" : "bg-slate-300"
                          }`}
                        >
                          <Text
                            className={`text-sm font-bold ${isDark ? "text-slate-300" : "text-slate-600"}`}
                          >
                            {(u.displayName || u.email || "?").charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text
                        className={`font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
                      >
                        {u.displayName || u.email || "Unknown"}
                      </Text>
                    </Pressable>
                  ))}
                  {event.offlineNotResponded.map((offlineMember) => (
                    <View
                      key={`offline-pending-${offlineMember.offlineMemberId}`}
                      className={`flex-row items-center gap-3 rounded-lg px-3 py-2 ${
                        isDark ? "bg-slate-900" : "bg-slate-50"
                      }`}
                    >
                      <View
                        className={`h-8 w-8 items-center justify-center rounded-full ${
                          isDark ? "bg-slate-700" : "bg-slate-300"
                        }`}
                      >
                        <Text
                          className={`text-sm font-bold ${isDark ? "text-slate-300" : "text-slate-600"}`}
                        >
                          {offlineMember.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1.5">
                          <Text
                            className={`font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
                          >
                            {offlineMember.name}
                          </Text>
                          <UserX size={12} color={isDark ? "#64748b" : "#94a3b8"} />
                        </View>
                      </View>
                      {isAdmin && (
                        <View className="flex-row gap-1">
                          <Pressable
                            onPress={() => handleOfflineRsvp(offlineMember.offlineMemberId, "accepted")}
                            className={`rounded-lg px-2 py-1 ${
                              isDark ? "bg-green-600/20" : "bg-green-50"
                            }`}
                          >
                            <Check size={14} color="#22c55e" />
                          </Pressable>
                          <Pressable
                            onPress={() => handleOfflineRsvp(offlineMember.offlineMemberId, "declined")}
                            className={`rounded-lg px-2 py-1 ${
                              isDark ? "bg-red-600/20" : "bg-red-50"
                            }`}
                          >
                            <X size={14} color="#ef4444" />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ==================== Mobile Layout ====================
  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          title: event.name,
          headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
          headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
          headerLeft: () => (
            <Pressable
              onPress={() => router.push(`/pod/${id}/events`)}
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}
            >
              <ChevronLeft size={28} color="#7C3AED" />
              <Text style={{ color: "#7C3AED", fontSize: 17 }}>Events</Text>
            </Pressable>
          ),
          ...(isWeb && { headerRightContainerStyle: { paddingRight: 16 } }),
        }}
      />
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
        edges={[]}
      >
        {/* Event info (pinned at top) */}
        <View className="px-4 pt-3 pb-2 gap-2">
          <View className="flex-row items-center gap-2">
            <Calendar size={16} color={isDark ? "#94a3b8" : "#64748b"} />
            <Text
              className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}
            >
              {new Date(event.startsAt).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
          </View>
          {event.location && (
            <View className="flex-row items-center gap-2">
              <MapPin size={16} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                {event.location}
              </Text>
            </View>
          )}
          {event.description && (
            <Text
              className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
              numberOfLines={2}
            >
              {event.description}
            </Text>
          )}
        </View>

        {/* RSVP Summary Button */}
        <View className="px-4 pb-2">
          <RsvpSummaryButton
            goingCount={goingCount}
            notGoingCount={notGoingCount}
            pendingCount={pendingCount}
            myStatus={myStatus}
            onPress={() => setRsvpSheetVisible(true)}
            isDark={isDark}
          />
        </View>

        {/* Start Game - native only */}
        {Platform.OS !== "web" && (
          <View className="px-4 pb-2">
            <Pressable
              onPress={() => {
                const allGoing = [
                  ...going.map((r) => ({
                    name: r.displayName || r.email || "Unknown",
                    profilePicture: r.profilePicture,
                    userId: r.userId,
                  })),
                  ...offlineGoing.map((r) => ({
                    name: r.name,
                    profilePicture: null as string | null,
                    userId: null as string | null,
                    offlineMemberId: r.offlineMemberId,
                  })),
                ];
                if (allGoing.length >= 2) {
                  router.push(
                    `/life-counter?players=${encodeURIComponent(JSON.stringify(allGoing.slice(0, 4)))}&podId=${id}&eventId=${eventId}`,
                  );
                } else {
                  router.push("/life-counter");
                }
              }}
              className="flex-row items-center justify-center gap-2 rounded-xl bg-green-600 py-3 active:bg-green-700"
            >
              <Play size={20} color="#ffffff" />
              <Text className="text-base font-bold text-white">Start Game</Text>
            </Pressable>
          </View>
        )}

        {/* Chat fills remaining space */}
        <EventChat
          messages={chat.messages}
          loading={chat.loading}
          loadingMore={chat.loadingMore}
          hasMore={chat.hasMore}
          sending={chat.sending}
          currentUserId={chat.currentUserId}
          onSend={chat.sendMessage}
          onLoadMore={chat.loadMore}
          isDark={isDark}
        />

        {/* RSVP Bottom Sheet */}
        <RsvpSheet
          visible={rsvpSheetVisible}
          onDismiss={() => setRsvpSheetVisible(false)}
          event={event}
          isDark={isDark}
          isAdmin={isAdmin}
          myStatus={myStatus}
          onRsvp={handleRsvp}
          onOfflineRsvp={handleOfflineRsvp}
        />
      </SafeAreaView>
    </View>
  );
}
