import { useFocusEffect, useRouter } from "expo-router";
import {
  Layers,
  Activity,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "~/contexts/AuthContext";
import { useResponsive } from "~/hooks/useResponsive";
import {
  collectionApi,
  CollectionStats,
  decksApi,
  DeckSummary,
  podsApi,
  PodSummary,
  PodEventSummary,
} from "~/lib/api";

export default function HomeScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuth();
  const router = useRouter();
  const { isDesktop } = useResponsive();

  const [collectionStats, setCollectionStats] =
    useState<CollectionStats | null>(null);
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [nextEvent, setNextEvent] = useState<{
    event: PodEventSummary;
    pod: PodSummary;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadData() {
        const [statsRes, decksRes, podsRes] = await Promise.all([
          collectionApi.getStats().catch(() => null),
          decksApi.list().catch(() => null),
          podsApi.list().catch(() => null),
        ]);

        if (cancelled) return;

        if (statsRes?.data) setCollectionStats(statsRes.data);
        if (decksRes?.data) setDecks(decksRes.data);

        // Find the nearest upcoming event across all pods
        if (podsRes?.data) {
          const podsWithEvents = podsRes.data.filter((p) => p.nextEventAt);
          if (podsWithEvents.length > 0) {
            const nearestPod = podsWithEvents.sort(
              (a, b) =>
                new Date(a.nextEventAt!).getTime() -
                new Date(b.nextEventAt!).getTime(),
            )[0];

            const eventsRes = await podsApi
              .listEvents(nearestPod.id, true)
              .catch(() => null);
            if (!cancelled && eventsRes?.data && eventsRes.data.length > 0) {
              const upcoming = eventsRes.data.sort(
                (a, b) =>
                  new Date(a.startsAt).getTime() -
                  new Date(b.startsAt).getTime(),
              )[0];
              setNextEvent({ event: upcoming, pod: nearestPod });
            }
          }
        }

        setLoading(false);
      }

      loadData();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const gainLoss = collectionStats?.gainLoss ?? 0;
  const isPositive = gainLoss >= 0;

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
      edges={[]}
    >
      <View className="flex-1 p-6 lg:px-12 lg:py-8">
        {/* Header */}
        {isDesktop && (
          <View
            className={`mb-8 flex-row items-start gap-3 w-full max-w-content mx-auto px-0`}
          >
            <View className="flex-1">
              <Text
                className={`text-2xl lg:text-3xl font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Welcome,{" "}
                {user?.displayName || user?.email?.split("@")[0] || "User"}!
              </Text>
              <Text
                className={`text-base lg:text-lg ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                What would you like to do today?
              </Text>
            </View>
          </View>
        )}

        <View className="gap-4 lg:gap-6 w-full max-w-content mx-auto">
          {/* Life Counter (mobile only) */}
          {Platform.OS !== "web" && (
            <Pressable
              onPress={() => router.push("/life-counter")}
              className={`rounded-xl p-5 transition-transform lg:hover:scale-105 lg:hover:shadow-xl ${
                isDark
                  ? "bg-slate-900 lg:hover:bg-slate-800"
                  : "bg-slate-50 lg:hover:bg-slate-100"
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <Activity size={22} color="#22c55e" />
                  </View>
                  <View>
                    <Text
                      className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      Life Counter
                    </Text>
                    <Text
                      className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Track life and damage
                    </Text>
                  </View>
                </View>
                <ChevronRight
                  size={20}
                  color={isDark ? "#64748b" : "#94a3b8"}
                />
              </View>
            </Pressable>
          )}

          {/* Upcoming Event Card */}
          {nextEvent && (
            <Pressable
              onPress={() =>
                router.push(
                  `/pod/${nextEvent.pod.id}/event/${nextEvent.event.id}`,
                )
              }
              className={`rounded-xl p-5 transition-transform lg:hover:scale-[1.02] lg:hover:shadow-xl ${
                isDark
                  ? "bg-slate-900 lg:hover:bg-slate-800"
                  : "bg-slate-50 lg:hover:bg-slate-100"
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-2">
                    <View className="h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                      <Calendar size={18} color="#3b82f6" />
                    </View>
                    <Text
                      className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Upcoming Event
                    </Text>
                  </View>
                  <Text
                    className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    {nextEvent.event.name}
                  </Text>
                  <Text
                    className={`text-sm mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    {nextEvent.pod.name} &middot;{" "}
                    {formatEventDate(nextEvent.event.startsAt)}
                  </Text>
                  {nextEvent.event.rsvpCounts && (
                    <Text
                      className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      {nextEvent.event.rsvpCounts.accepted} going
                    </Text>
                  )}
                </View>
                <ChevronRight
                  size={20}
                  color={isDark ? "#64748b" : "#94a3b8"}
                />
              </View>
            </Pressable>
          )}

          {/* Collection & Decks Row */}
          <View className="flex-row gap-4">
            {/* Collection Value */}
            <Pressable
              onPress={() => router.push("/(tabs)/collection")}
              className={`flex-1 rounded-xl p-4 transition-transform lg:hover:scale-105 lg:hover:shadow-xl ${
                isDark
                  ? "bg-slate-900 lg:hover:bg-slate-800"
                  : "bg-slate-50 lg:hover:bg-slate-100"
              }`}
            >
              <View className="h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 mb-3">
                <DollarSign size={20} color="#10b981" />
              </View>
              <Text
                className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {collectionStats
                  ? `$${collectionStats.currentValue.toFixed(2)}`
                  : loading
                    ? "..."
                    : "$0.00"}
              </Text>
              <Text
                className={`text-sm mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Collection
              </Text>
              {collectionStats && gainLoss !== 0 && (
                <View className="flex-row items-center gap-1 mt-1">
                  {isPositive ? (
                    <TrendingUp size={12} color="#10b981" />
                  ) : (
                    <TrendingDown size={12} color="#ef4444" />
                  )}
                  <Text
                    className={`text-xs font-medium ${isPositive ? "text-emerald-500" : "text-red-500"}`}
                  >
                    {isPositive ? "+" : ""}${gainLoss.toFixed(2)}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* My Decks */}
            <Pressable
              onPress={() => router.push("/(tabs)/decks")}
              className={`flex-1 rounded-xl p-4 transition-transform lg:hover:scale-105 lg:hover:shadow-xl ${
                isDark
                  ? "bg-slate-900 lg:hover:bg-slate-800"
                  : "bg-slate-50 lg:hover:bg-slate-100"
              }`}
            >
              <View className="h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 mb-3">
                <Layers size={20} color="#7C3AED" />
              </View>
              <Text
                className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {decks.length}
              </Text>
              <Text
                className={`text-sm mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                {decks.length === 1 ? "Deck" : "Decks"}
              </Text>
            </Pressable>
          </View>

        </View>
      </View>
    </SafeAreaView>
  );
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return (
      "Today at " +
      date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    );
  } else if (diffDays === 1) {
    return (
      "Tomorrow at " +
      date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    );
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], {
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
