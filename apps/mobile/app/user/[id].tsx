import { router, Stack, useLocalSearchParams } from "expo-router";
import { Crown, Layers } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { podsApi, type PodUserProfile } from "~/lib/api";
import { useResponsive } from "~/hooks/useResponsive";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";
import { useAuth } from "~/contexts/AuthContext";
import { DeckScoreChip } from "~/components/ranking/DeckScoreChip";
import { MANA_COLORS } from "~/components/deck/deck-detail-constants";

export default function UserProfileScreen() {
  const { id, podId, podName } = useLocalSearchParams<{
    id: string;
    podId?: string;
    podName?: string;
  }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PodUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    podsApi.getUserProfile(id).then((result) => {
      if (result.data) setProfile(result.data);
      setLoading(false);
    });
  }, [id]);

  const displayName = profile
    ? profile.displayName || profile.email.split("@")[0]
    : "Profile";

  const isOwnProfile = user?.id === id;
  const deckListLabel = isOwnProfile ? "My Decks" : "Decks";

  if (loading || !profile) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: !isDesktop,
          headerShadowVisible: false,
            title: "Profile",
            headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
            headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
            headerBackTitle: "Back",
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

  return (
    <View className="flex-1 flex-row">
      <Stack.Screen
        options={{
          headerShown: !isDesktop,
          headerShadowVisible: false,
          title: displayName,
          headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
          headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
          headerBackTitle: "Back",
        }}
      />
      {isDesktop && <DesktopSidebar />}
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
        edges={[]}
      >
        {/* Header - desktop only (mobile uses native stack header) */}
        {isDesktop && (
          <View className="flex-row items-center px-4 lg:px-6 py-3 lg:py-4">
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
                  {podId && podName && (
                    <>
                      <Text
                        className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}
                      >
                        /
                      </Text>
                      <Pressable
                        onPress={() => router.push(`/pod/${podId}`)}
                        className="hover:underline"
                      >
                        <Text
                          className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
                          numberOfLines={1}
                        >
                          {podName}
                        </Text>
                      </Pressable>
                    </>
                  )}
                  <Text
                    className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}
                  >
                    /
                  </Text>
                  <Text
                    className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                </View>
                <Text
                  className={`text-lg lg:text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
              </View>
            </View>
          </View>
        )}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* Profile Header */}
          <View className="items-center gap-3 pb-6 pt-4">
            {profile.profilePicture ? (
              <Image
                source={{ uri: profile.profilePicture }}
                className="h-20 w-20 rounded-full"
                resizeMode="cover"
              />
            ) : (
              <View className="h-20 w-20 items-center justify-center rounded-full bg-purple-600">
                <Text className="text-3xl font-bold text-white">
                  {(profile.displayName || profile.email)
                    ?.charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
            )}
            <View className="items-center">
              <Text
                className={`text-xl font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {displayName}
              </Text>
              <Text
                className={`mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                {profile.email}
              </Text>
              <Text
                className={`mt-1 text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
              >
                Member since{" "}
                {new Date(profile.createdAt).toLocaleDateString()}
              </Text>
            </View>

            {/* Decks Header */}
            <View className="mt-4 w-full px-4">
              <Text
                className={`text-sm font-medium uppercase tracking-wider ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                {deckListLabel} ({profile.publicDecks.length})
              </Text>
            </View>
          </View>

          {/* Deck Grid */}
          {profile.publicDecks.length > 0 ? (
            <View className="flex-row flex-wrap p-1 lg:px-6">
              {profile.publicDecks.map((deck) => (
                <View key={deck.id} style={{ width: isDesktop ? '25%' : '50%', height: 160, padding: 2 }}>
                  <Pressable
                    onPress={() => router.push(`/deck/${deck.id}/public`)}
                    className="flex-1 rounded-xl overflow-hidden"
                  >
                    {/* Full card background image */}
                    <View className="absolute inset-0">
                      {deck.commanderImageCrop ? (
                        <Image
                          source={{ uri: deck.commanderImageCrop }}
                          style={{
                            width: "100%",
                            height: "100%",
                            resizeMode: "cover",
                          }}
                        />
                      ) : (
                        <View
                          className={`w-full h-full items-center justify-center ${
                            isDark ? "bg-slate-800" : "bg-slate-200"
                          }`}
                        >
                          <Layers size={40} color={isDark ? "#64748b" : "#94a3b8"} />
                        </View>
                      )}
                    </View>

                    {/* Score chip overlay */}
                    {deck.scores && (
                      <View className="absolute top-2 left-2 z-10">
                        <DeckScoreChip
                          deckId={deck.id}
                          deckName={deck.name}
                          scores={deck.scores}
                        />
                      </View>
                    )}

                    <View
                      className="absolute bottom-0 left-0 right-0 p-2.5 justify-end"
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.75)",
                        height: 80,
                      }}
                    >
                      {/* Commander name */}
                      {deck.commanders[0] && (
                        <View className="flex-row items-center gap-1 mb-1">
                          <Crown size={10} color="#eab308" />
                          <Text className="text-xs text-white/70" numberOfLines={1}>
                            {deck.commanders[0]}
                          </Text>
                        </View>
                      )}

                      {/* Deck name */}
                      <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                        {deck.name}
                      </Text>

                      {/* Color identity and card count */}
                      <View className="mt-1.5 flex-row items-center gap-1">
                        <View className="flex-row gap-1">
                          {deck.colors.length === 0 ? (
                            <View
                              className="h-4 w-4 rounded-full border"
                              style={{
                                backgroundColor: "#888",
                                borderColor: "#475569",
                              }}
                            />
                          ) : (
                            deck.colors.map((color) => (
                              <View
                                key={color}
                                className="h-4 w-4 rounded-full border"
                                style={{
                                  backgroundColor: MANA_COLORS[color] || "#888",
                                  borderColor: "#475569",
                                }}
                              />
                            ))
                          )}
                        </View>
                        <Text className="ml-1 text-xs text-white/60">
                          {deck.cardCount} cards
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View className="items-center py-8">
              <Text className={isDark ? "text-slate-500" : "text-slate-400"}>
                {isOwnProfile ? "No decks yet" : "No visible decks"}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
