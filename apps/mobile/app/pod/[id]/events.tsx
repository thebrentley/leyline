import { router, Stack, useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  Calendar,
  Check,
  ChevronLeft,
  MapPin,
  Plus,
  Users,
  X,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { podsApi, type PodEventSummary } from "~/lib/api";
import { useResponsive } from "~/hooks/useResponsive";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";
import { CreateEventSheet } from "~/components/ui/CreateEventSheet";
import { HeaderButton } from "~/components/ui/HeaderButton";

const isWeb = Platform.OS === "web";

function EventCard({
  event,
  podId,
  isDark,
}: {
  event: PodEventSummary;
  podId: string;
  isDark: boolean;
}) {
  const isPast = new Date(event.startsAt) < new Date();

  return (
    <Pressable
      onPress={() => router.push(`/pod/${podId}/event/${event.id}`)}
      className={`mx-4 mb-3 rounded-xl border p-4 ${
        isDark
          ? "border-slate-800 bg-slate-900 active:bg-slate-800"
          : "border-slate-200 bg-white active:bg-slate-50"
      } ${isPast ? "opacity-60" : ""}`}
    >
      <Text
        className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
      >
        {event.name}
      </Text>

      <View className="mt-2 gap-1">
        <View className="flex-row items-center gap-2">
          <Calendar size={14} color={isDark ? "#94a3b8" : "#64748b"} />
          <Text
            className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
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
            <MapPin size={14} color={isDark ? "#94a3b8" : "#64748b"} />
            <Text
              className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              {event.location}
            </Text>
          </View>
        )}
      </View>

      {/* RSVP Summary */}
      <View className="mt-3 flex-row items-center gap-4">
        <View className="flex-row items-center gap-1">
          <Check size={14} color="#22c55e" />
          <Text className="text-sm text-green-500">
            {event.rsvpCounts.accepted}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <X size={14} color="#ef4444" />
          <Text className="text-sm text-red-500">
            {event.rsvpCounts.declined}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Users size={14} color={isDark ? "#64748b" : "#94a3b8"} />
          <Text
            className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
            {event.rsvpCounts.pending} pending
          </Text>
        </View>

        {/* My RSVP status */}
        {event.myRsvp && (
          <View
            className={`ml-auto rounded-full px-2 py-0.5 ${
              event.myRsvp === "accepted"
                ? "bg-green-600/20"
                : "bg-red-600/20"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                event.myRsvp === "accepted"
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {event.myRsvp === "accepted" ? "Going" : "Not going"}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function EventsListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();
  const [events, setEvents] = useState<PodEventSummary[]>([]);
  const [podName, setPodName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!id) return;
    const [eventsResult, podResult] = await Promise.all([
      podsApi.listEvents(id),
      podsApi.get(id),
    ]);
    if (eventsResult.data) setEvents(eventsResult.data);
    if (podResult.data) setPodName(podResult.data.name);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  return (
    <View className="flex-1 flex-row">
      <Stack.Screen
        options={{
          headerShown: !isDesktop,
          headerShadowVisible: false,
          title: "Events",
          headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
          headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
          headerLeft: () => (
            <Pressable
              onPress={() => router.push(`/pod/${id}`)}
              hitSlop={8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginRight: 8,
              }}
            >
              <ChevronLeft size={28} color="#7C3AED" />
              <Text style={{ color: "#7C3AED", fontSize: 17 }}>{podName || "Back"}</Text>
            </Pressable>
          ),
          headerRight: () => (
            <HeaderButton
              icon={Plus}
              variant="ghost"
              onPress={() => setShowCreateEvent(true)}
              iconSize={22}
              hitSlop={8}
            />
          ),
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
                  <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Events
                  </Text>
                </View>
                <Text
                  className={`text-lg lg:text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Events
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setShowCreateEvent(true)}
              hitSlop={8}
              className={`rounded-full p-2 ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
            >
              <Plus size={22} color={isDark ? "#e2e8f0" : "#1e293b"} />
            </Pressable>
          </View>
        )}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
              Loading...
            </Text>
          </View>
        ) : events.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-4">
            <Calendar size={48} color={isDark ? "#475569" : "#cbd5e1"} />
            <Text
              className={`text-lg ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              No events yet
            </Text>
            <Pressable
              onPress={() => setShowCreateEvent(true)}
              className="rounded-lg bg-purple-600 px-6 py-3"
            >
              <Text className="font-semibold text-white">
                Create Game Night
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <EventCard event={item} podId={id!} isDark={isDark} />
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
          />
        )}
      </SafeAreaView>
      <CreateEventSheet
        visible={showCreateEvent}
        onDismiss={() => setShowCreateEvent(false)}
        podId={id!}
      />
    </View>
  );
}
