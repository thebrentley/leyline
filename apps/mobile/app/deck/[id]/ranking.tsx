import { useLocalSearchParams, router, Stack } from "expo-router";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { GlassSheet } from "~/components/ui/GlassSheet";
import { useColorScheme } from "nativewind";
import {
  ChevronDown,
  ChevronRight,
  RefreshCcw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react-native";
import { deckRankingApi, type DeckScoreResponse } from "~/lib/api";
import { showToast } from "~/lib/toast";
import { RadarChart } from "~/components/ranking/RadarChart";
import { useResponsive } from "~/hooks/useResponsive";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";

const AXIS_COLORS = {
  power: "#a855f7",
  salt: "#ef4444",
  fear: "#f97316",
  airtime: "#3b82f6",
};

const AXIS_LABELS = {
  power: "Power",
  salt: "Salt",
  fear: "Fear",
  airtime: "Airtime",
};

const AXIS_DESCRIPTIONS = {
  power: "Win efficiency, consistency, interaction density",
  salt: "Annoyance factor — stax, counters, theft, MLD",
  fear: "Board presence, psychological pressure",
  airtime: "Time/spotlight demanded — triggers, storm, tutoring",
};

export default function DeckRankingScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scores, setScores] = useState<DeckScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["scores"]),
  );

  const loadScores = useCallback(
    async (force = false) => {
      if (!id) return;
      try {
        setError(null);
        const response = await deckRankingApi.getScores(id);
        if (response.error) {
          setError(response.error);
          showToast.error(response.error);
        } else if (response.data) {
          setScores(response.data);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load scores";
        setError(message);
        showToast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setRecomputing(false);
      }
    },
    [id],
  );

  const handleRecompute = async () => {
    if (!id || recomputing) return;
    setRecomputing(true);
    try {
      const response = await deckRankingApi.recompute(id);
      if (response.error) {
        showToast.error(response.error);
      } else if (response.data) {
        setScores(response.data);
        showToast.success("Scores recomputed!");
      }
    } catch (err) {
      showToast.error("Failed to recompute scores");
    } finally {
      setRecomputing(false);
    }
  };

  useEffect(() => {
    loadScores();
  }, [loadScores]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Shared header for loading/error states - Desktop only (mobile uses native Stack header)
  const stateHeader = isDesktop ? (
    <View className="px-6 mb-4 mt-4">
      <View className="flex-row items-center flex-1">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Pressable
              onPress={() => router.push("/(tabs)/decks")}
              className="hover:underline"
            >
              <Text
                className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
              >
                My Decks
              </Text>
            </Pressable>
            <Text
              className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}
            >
              /
            </Text>
            <Pressable
              onPress={() => router.push(`/deck/${id}`)}
              className="hover:underline"
            >
              <Text
                className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
                numberOfLines={1}
              >
                {name ? decodeURIComponent(name) : "Deck"}
              </Text>
            </Pressable>
            <Text
              className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}
            >
              /
            </Text>
            <Text
              className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Ranking
            </Text>
          </View>
          <Text
            className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
            numberOfLines={1}
          >
            Deck Ranking
          </Text>
        </View>
      </View>
    </View>
  ) : null;

  // Loading or error: desktop early return only
  if ((loading || error || !scores) && isDesktop) {
    const statusBody = loading ? (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#a855f7" />
        <Text
          className={`mt-4 ${isDark ? "text-slate-400" : "text-slate-600"}`}
        >
          Computing deck scores...
        </Text>
        <Text
          className={`mt-1 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
        >
          This continues in the background if you leave
        </Text>
      </View>
    ) : (
      <View className="flex-1 items-center justify-center">
        <Text
          className={`text-center ${isDark ? "text-slate-400" : "text-slate-600"}`}
        >
          {error || "Failed to load scores"}
        </Text>
        <Pressable
          onPress={() => loadScores()}
          className="mt-4 bg-purple-500 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-semibold">Retry</Text>
        </Pressable>
      </View>
    );

    const content = (
      <View className="flex-1">
        {stateHeader}
        {statusBody}
      </View>
    );

    return (
      <View className="flex-1 flex-row">
        <Stack.Screen options={{ headerShown: false }} />
        <DesktopSidebar />
        <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
          {content}
        </View>
      </View>
    );
  }

  // Main page content
  const pageContent = !scores ? null : (
    <>
      {/* Header - Desktop only (mobile uses native Stack header) */}
      {isDesktop && (
        <View className="px-6 mb-4 mt-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Pressable
                    onPress={() => router.push("/(tabs)/decks")}
                    className="hover:underline"
                  >
                    <Text
                      className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      My Decks
                    </Text>
                  </Pressable>
                  <Text
                    className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}
                  >
                    /
                  </Text>
                  <Pressable
                    onPress={() => router.push(`/deck/${id}`)}
                    className="hover:underline"
                  >
                    <Text
                      className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
                      numberOfLines={1}
                    >
                      {name ? decodeURIComponent(name) : "Deck"}
                    </Text>
                  </Pressable>
                  <Text
                    className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}
                  >
                    /
                  </Text>
                  <Text
                    className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Ranking
                  </Text>
                </View>
                <Text
                  className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                  numberOfLines={1}
                >
                  Deck Ranking
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleRecompute}
              disabled={recomputing}
              className={`ml-2 px-3 py-2 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
            >
              {recomputing ? (
                <ActivityIndicator size="small" color="#a855f7" />
              ) : (
                <RefreshCcw size={18} color="#a855f7" />
              )}
            </Pressable>
          </View>
        </View>
      )}

      {scores.isStale && (
        <View className="mx-4 lg:mx-6 mt-2 bg-yellow-500/20 px-3 py-2 rounded-lg">
          <Text className="text-yellow-600 text-xs">
            Scores are outdated. Tap refresh to recompute.
          </Text>
        </View>
      )}

      {/* Radar Chart */}
      <View className="px-4 lg:px-6 mb-6">
        <View
          className={`rounded-xl p-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
        >
          <View className="items-center">
            <RadarChart scores={scores.scores} size={280} />
          </View>
        </View>
      </View>

      {/* Score Cards */}
      <View className="px-4 lg:px-6 mb-6">
        <View className="flex-row flex-wrap gap-3">
          {(["power", "salt", "fear", "airtime"] as const).map((axis) => (
            <View
              key={axis}
              className={`flex-1 min-w-[45%] rounded-xl p-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
            >
              <Text
                className="text-xs font-semibold mb-1"
                style={{ color: AXIS_COLORS[axis] }}
              >
                {AXIS_LABELS[axis].toUpperCase()}
              </Text>
              <Text
                className="text-3xl font-bold mb-2"
                style={{ color: AXIS_COLORS[axis] }}
              >
                {scores.scores[axis]}
              </Text>
              <Text
                className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}
              >
                {AXIS_DESCRIPTIONS[axis]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Layer Breakdown */}
      <View className="px-4 lg:px-6 mb-4">
        <Pressable
          onPress={() => toggleSection("layers")}
          className={`rounded-xl p-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Zap size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Layer Breakdown
              </Text>
            </View>
            {expandedSections.has("layers") ? (
              <ChevronDown size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            ) : (
              <ChevronRight size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            )}
          </View>

          {expandedSections.has("layers") && (
            <View className="mt-4 gap-4">
              {Object.entries(scores.layerBreakdown).map(
                ([layer, layerScores]) => (
                  <View
                    key={layer}
                    className={`p-3 rounded-lg ${isDark ? "bg-slate-800" : "bg-white"}`}
                  >
                    <Text
                      className={`text-sm font-semibold mb-3 ${isDark ? "text-slate-200" : "text-slate-800"}`}
                    >
                      {layer
                        .replace(/([A-Z])/g, " $1")
                        .trim()
                        .replace(/^./, (str) => str.toUpperCase())}
                    </Text>
                    <View className="flex-row justify-between">
                      {(["power", "salt", "fear", "airtime"] as const).map(
                        (axis) => (
                          <View key={axis} className="items-center">
                            <Text
                              className={`text-xs mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}
                            >
                              {AXIS_LABELS[axis]}
                            </Text>
                            <Text
                              className="text-lg font-bold"
                              style={{ color: AXIS_COLORS[axis] }}
                            >
                              {Math.round(layerScores[axis])}
                            </Text>
                          </View>
                        ),
                      )}
                    </View>
                  </View>
                ),
              )}
            </View>
          )}
        </Pressable>
      </View>

      {/* Notable Cards */}
      {scores.notableCards && (
        <View className="px-4 lg:px-6 mb-4">
          <Pressable
            onPress={() => toggleSection("notable")}
            className={`rounded-xl p-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Sparkles size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text
                  className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Notable Cards
                </Text>
              </View>
              {expandedSections.has("notable") ? (
                <ChevronDown size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              ) : (
                <ChevronRight
                  size={20}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              )}
            </View>

            {expandedSections.has("notable") && (
              <View className="mt-4 gap-3">
                {scores.notableCards.highPower.length > 0 && (
                  <View>
                    <Text
                      className="text-sm font-medium mb-1"
                      style={{ color: AXIS_COLORS.power }}
                    >
                      High Power
                    </Text>
                    <Text
                      className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}
                    >
                      {scores.notableCards.highPower.join(", ")}
                    </Text>
                  </View>
                )}
                {scores.notableCards.highSalt.length > 0 && (
                  <View>
                    <Text
                      className="text-sm font-medium mb-1"
                      style={{ color: AXIS_COLORS.salt }}
                    >
                      High Salt
                    </Text>
                    <Text
                      className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}
                    >
                      {scores.notableCards.highSalt.join(", ")}
                    </Text>
                  </View>
                )}
                {scores.notableCards.highFear.length > 0 && (
                  <View>
                    <Text
                      className="text-sm font-medium mb-1"
                      style={{ color: AXIS_COLORS.fear }}
                    >
                      High Fear
                    </Text>
                    <Text
                      className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}
                    >
                      {scores.notableCards.highFear.join(", ")}
                    </Text>
                  </View>
                )}
                {scores.notableCards.highAirtime.length > 0 && (
                  <View>
                    <Text
                      className="text-sm font-medium mb-1"
                      style={{ color: AXIS_COLORS.airtime }}
                    >
                      High Airtime
                    </Text>
                    <Text
                      className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}
                    >
                      {scores.notableCards.highAirtime.join(", ")}
                    </Text>
                  </View>
                )}
                {scores.notableCards.synergyHubs.length > 0 && (
                  <View>
                    <Text
                      className={`text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}
                    >
                      Synergy Hubs
                    </Text>
                    <Text
                      className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}
                    >
                      {scores.notableCards.synergyHubs.join(", ")}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        </View>
      )}

      {/* Detected Combos */}
      {scores.detectedCombos && scores.detectedCombos.length > 0 && (
        <View className="px-4 lg:px-6 mb-4">
          <Pressable
            onPress={() => toggleSection("combos")}
            className={`rounded-xl p-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Target size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text
                  className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Detected Combos ({scores.detectedCombos.length})
                </Text>
              </View>
              {expandedSections.has("combos") ? (
                <ChevronDown size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              ) : (
                <ChevronRight
                  size={20}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              )}
            </View>

            {expandedSections.has("combos") && (
              <View className="mt-4 space-y-2">
                {scores.detectedCombos.map((combo, index) => (
                  <View
                    key={index}
                    className={`p-3 rounded-lg ${isDark ? "bg-slate-800" : "bg-white"}`}
                  >
                    <View className="flex-row items-center mb-1">
                      <Text
                        className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        {combo.cardNames.join(" + ")}
                      </Text>
                      {combo.isGameWinning && (
                        <View className="ml-2 bg-yellow-500/20 px-2 py-0.5 rounded">
                          <Text className="text-yellow-600 text-xs font-semibold">
                            WIN
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}
                    >
                      {combo.description}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        </View>
      )}

      {/* Detected Engines */}
      {scores.detectedEngines && scores.detectedEngines.length > 0 && (
        <View className="px-4 lg:px-6 mb-6">
          <Pressable
            onPress={() => toggleSection("engines")}
            className={`rounded-xl p-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <TrendingUp size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text
                  className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Synergy Engines ({scores.detectedEngines.length})
                </Text>
              </View>
              {expandedSections.has("engines") ? (
                <ChevronDown size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              ) : (
                <ChevronRight
                  size={20}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              )}
            </View>

            {expandedSections.has("engines") && (
              <View className="mt-4 space-y-2">
                {scores.detectedEngines.map((engine, index) => (
                  <View
                    key={index}
                    className={`p-3 rounded-lg ${isDark ? "bg-slate-800" : "bg-white"}`}
                  >
                    <Text
                      className={`text-sm font-semibold mb-1 ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      {engine.cards.join(" • ")}
                    </Text>
                    <Text
                      className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}
                    >
                      {engine.description}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        </View>
      )}

      {/* Footer info */}
      <View className="px-4 lg:px-6 pb-6">
        <Text
          className={`text-xs text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}
        >
          Computed {new Date(scores.computedAt).toLocaleString()}
        </Text>
      </View>
    </>
  );

  // Desktop Layout
  if (isDesktop) {
    return (
      <View className="flex-1 flex-row">
        <Stack.Screen options={{ headerShown: false }} />
        <DesktopSidebar />
        <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
          <ScrollView
            className="flex-1"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadScores();
                }}
              />
            }
          >
            {pageContent}
          </ScrollView>
        </View>
      </View>
    );
  }

  // Mobile Layout - GlassSheet inline inside transparentModal (presentation set in _layout)
  return (
    <GlassSheet visible={true} onDismiss={() => router.back()} isDark={isDark} snapPoints={["90%"]} inline>
      <BottomSheetScrollView contentContainerStyle={loading || error || !scores ? { flex: 1 } : { paddingBottom: 32 }}>
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#a855f7" />
            <Text className={`mt-4 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Computing deck scores...
            </Text>
            <Text className={`mt-1 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              This continues in the background if you leave
            </Text>
          </View>
        ) : error || !scores ? (
          <View className="flex-1 items-center justify-center">
            <Text className={`text-center ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {error || "Failed to load scores"}
            </Text>
            <Pressable
              onPress={() => loadScores()}
              className="mt-4 bg-purple-500 px-6 py-3 rounded-lg"
            >
              <Text className="text-white font-semibold">Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
              <Text className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                Deck Ranking
              </Text>
              <Pressable onPress={handleRecompute} disabled={recomputing} hitSlop={8}>
                {recomputing ? (
                  <ActivityIndicator size="small" color="#a855f7" />
                ) : (
                  <RefreshCcw size={20} color="#a855f7" />
                )}
              </Pressable>
            </View>
            {pageContent}
          </>
        )}
      </BottomSheetScrollView>
    </GlassSheet>
  );
}
