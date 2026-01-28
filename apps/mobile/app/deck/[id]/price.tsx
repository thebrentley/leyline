import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  DollarSign,
  ExternalLink,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { decksApi, type DeckCard, type DeckDetail } from "~/lib/api";
import { useResponsive } from "~/hooks/useResponsive";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";

interface PriceBreakdown {
  totalValue: number;
  totalFoilValue: number;
  averageCardPrice: number;
  mostExpensive: (DeckCard & { totalPrice: number })[];
  leastExpensive: (DeckCard & { totalPrice: number })[];
  byRarity: Record<string, { count: number; value: number }>;
}

const rarityColors: Record<string, string> = {
  mythic: "#d97706",
  rare: "#eab308",
  uncommon: "#94a3b8",
  common: "#475569",
};

export default function PricePage() {
  const { id, name: deckNameParam } = useLocalSearchParams<{ id: string; name?: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();

  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "expensive" | "cheap">("overview");

  // Use param name immediately, fall back to loaded deck name
  const deckName = deck?.name || deckNameParam || "Deck";

  const loadDeck = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await decksApi.get(id);
      if (response.data) {
        setDeck(response.data);
      }
    } catch (err) {
      console.error("Failed to load deck:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  // Combine all cards from deck
  const allCards = useMemo(() => {
    if (!deck) return [];
    return [
      ...(deck.commanders || []),
      ...(deck.mainboard || []),
      ...(deck.sideboard || []),
    ];
  }, [deck]);

  const priceBreakdown: PriceBreakdown = useMemo(() => {
    let totalValue = 0;
    let totalFoilValue = 0;
    const byRarity: Record<string, { count: number; value: number }> = {};
    const cardsWithPrices: (DeckCard & { totalPrice: number })[] = [];

    for (const card of allCards) {
      const cardPrice = card.priceUsd ? Number(card.priceUsd) : 0;
      const cardTotal = cardPrice * card.quantity;
      totalValue += cardTotal;

      if (card.priceUsdFoil) {
        totalFoilValue += Number(card.priceUsdFoil) * card.quantity;
      }

      const rarity = card.rarity || "unknown";
      if (!byRarity[rarity]) {
        byRarity[rarity] = { count: 0, value: 0 };
      }
      byRarity[rarity].count += card.quantity;
      byRarity[rarity].value += cardTotal;

      if (cardPrice > 0) {
        cardsWithPrices.push({ ...card, totalPrice: cardTotal });
      }
    }

    // Sort by total price
    cardsWithPrices.sort((a, b) => b.totalPrice - a.totalPrice);

    return {
      totalValue,
      totalFoilValue,
      averageCardPrice: cardsWithPrices.length > 0
        ? totalValue / cardsWithPrices.reduce((sum, c) => sum + c.quantity, 0)
        : 0,
      mostExpensive: cardsWithPrices.slice(0, 10),
      leastExpensive: [...cardsWithPrices].reverse().slice(0, 10),
      byRarity,
    };
  }, [allCards]);

  const openTCGPlayer = (cardName: string) => {
    const searchUrl = `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(cardName)}`;
    Linking.openURL(searchUrl);
  };

  const renderCardItem = ({ item }: { item: DeckCard & { totalPrice: number } }) => (
    <Pressable
      onPress={() => openTCGPlayer(item.name)}
      className={`flex-row items-center gap-3 py-3 px-4 lg:px-6 border-b ${
        isDark ? "border-slate-800 active:bg-slate-800/50 lg:hover:bg-slate-800/50" : "border-slate-100 active:bg-slate-50 lg:hover:bg-slate-50"
      }`}
    >
      {item.imageSmall ? (
        <Image
          source={{ uri: item.imageSmall }}
          className="h-12 w-9 rounded"
          resizeMode="cover"
        />
      ) : (
        <View className={`h-12 w-9 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
      )}
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${isDark ? "text-white" : "text-slate-900"}`}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          {item.quantity}x @ ${Number(item.priceUsd || 0).toFixed(2)} each
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-purple-500 font-bold">
          ${item.totalPrice.toFixed(2)}
        </Text>
        <ExternalLink size={14} color={isDark ? "#64748b" : "#94a3b8"} />
      </View>
    </Pressable>
  );

  const pageContent = (
    <>
      {/* Header */}
      <View className={`flex-row items-center justify-between px-4 lg:px-6 py-3 lg:py-4 ${!isDesktop ? "border-b border-slate-200 dark:border-slate-800" : ""}`}>
        <View className="flex-row items-center gap-3 flex-1">
          {/* Mobile: Back arrow */}
          {!isDesktop && (
            <Pressable
              onPress={() => router.back()}
              className={`rounded-full p-2 ${
                isDark ? "active:bg-slate-800" : "active:bg-slate-100"
              }`}
            >
              <ArrowLeft size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          )}
          <View className="flex-1">
            {/* Desktop: Breadcrumb */}
            {isDesktop && (
              <View className="flex-row items-center gap-2 mb-1">
                <Pressable
                  onPress={() => router.push("/(tabs)/decks")}
                  className="hover:underline"
                >
                  <Text className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
                    My Decks
                  </Text>
                </Pressable>
                <Text className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>/</Text>
                <Pressable
                  onPress={() => router.push(`/deck/${id}`)}
                  className="hover:underline"
                >
                  <Text className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`} numberOfLines={1}>
                    {deckName}
                  </Text>
                </Pressable>
                <Text className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>/</Text>
                <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Price Analysis
                </Text>
              </View>
            )}
            <View className="flex-row items-center gap-2">
              <DollarSign size={isDesktop ? 28 : 20} color="#7C3AED" />
              <Text
                className={`text-lg lg:text-2xl font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Price Analysis
              </Text>
            </View>
            <Text
              className={`text-xs lg:text-sm mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              {deckName}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <>
          {/* Total Value Header */}
          <View className={`px-4 lg:px-6 py-6 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
            <Text className={`text-center text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Total Deck Value
            </Text>
            <Text className="text-center text-4xl font-bold text-purple-500 mt-1">
              ${priceBreakdown.totalValue.toFixed(2)}
            </Text>
            <View className="flex-row justify-center gap-6 mt-4">
              <View className="items-center">
                <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  Cards
                </Text>
                <Text className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {allCards.reduce((sum, c) => sum + c.quantity, 0)}
                </Text>
              </View>
              <View className="items-center">
                <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  Avg. Price
                </Text>
                <Text className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  ${priceBreakdown.averageCardPrice.toFixed(2)}
                </Text>
              </View>
              {priceBreakdown.totalFoilValue > 0 && (
                <View className="items-center">
                  <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    Foil Value
                  </Text>
                  <Text className="font-bold text-purple-400">
                    ${priceBreakdown.totalFoilValue.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Tabs */}
          <View className={`flex-row border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
            <Pressable
              onPress={() => setActiveTab("overview")}
              className={`flex-1 py-3 items-center ${
                activeTab === "overview"
                  ? "border-b-2 border-purple-500"
                  : ""
              }`}
            >
              <Text
                className={`font-medium ${
                  activeTab === "overview"
                    ? "text-purple-500"
                    : isDark
                      ? "text-slate-400"
                      : "text-slate-500"
                }`}
              >
                By Rarity
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("expensive")}
              className={`flex-1 py-3 items-center ${
                activeTab === "expensive"
                  ? "border-b-2 border-purple-500"
                  : ""
              }`}
            >
              <Text
                className={`font-medium ${
                  activeTab === "expensive"
                    ? "text-purple-500"
                    : isDark
                      ? "text-slate-400"
                      : "text-slate-500"
                }`}
              >
                Most Expensive
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("cheap")}
              className={`flex-1 py-3 items-center ${
                activeTab === "cheap"
                  ? "border-b-2 border-purple-500"
                  : ""
              }`}
            >
              <Text
                className={`font-medium ${
                  activeTab === "cheap"
                    ? "text-purple-500"
                    : isDark
                      ? "text-slate-400"
                      : "text-slate-500"
                }`}
              >
                Budget Cards
              </Text>
            </Pressable>
          </View>

          {/* Tab Content */}
          {activeTab === "overview" ? (
            <ScrollView className="flex-1 px-4 lg:px-6 pt-4">
              {/* Rarity Breakdown */}
              {Object.entries(priceBreakdown.byRarity)
                .sort((a, b) => b[1].value - a[1].value)
                .map(([rarity, data]) => (
                  <View
                    key={rarity}
                    className={`flex-row items-center justify-between py-4 border-b ${
                      isDark ? "border-slate-800" : "border-slate-200"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: rarityColors[rarity] || "#64748b" }}
                      />
                      <Text className={`capitalize font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                        {rarity}
                      </Text>
                      <Text className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        ({data.count} cards)
                      </Text>
                    </View>
                    <Text className="text-purple-500 font-bold">
                      ${data.value.toFixed(2)}
                    </Text>
                  </View>
                ))}

              {/* TCGPlayer Link */}
              <Pressable
                onPress={() => Linking.openURL("https://www.tcgplayer.com")}
                className={`flex-row items-center justify-center gap-2 mt-6 mb-6 py-4 rounded-xl ${
                  isDark ? "bg-slate-800 lg:hover:bg-slate-700" : "bg-slate-100 lg:hover:bg-slate-200"
                }`}
              >
                <ExternalLink size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text className={isDark ? "text-slate-300" : "text-slate-600"}>
                  Shop on TCGPlayer
                </Text>
              </Pressable>
            </ScrollView>
          ) : (
            <FlatList
              data={activeTab === "expensive" ? priceBreakdown.mostExpensive : priceBreakdown.leastExpensive}
              keyExtractor={(item) => `${item.name}-${item.setCode}`}
              renderItem={renderCardItem}
              ListEmptyComponent={
                <View className="items-center py-12">
                  <DollarSign size={48} color={isDark ? "#334155" : "#cbd5e1"} />
                  <Text className={`mt-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    No price data available
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}
    </>
  );

  // Render with appropriate wrapper based on screen size
  if (isDesktop) {
    return (
      <View className="flex-1 flex-row">
        <DesktopSidebar />
        <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
          {pageContent}
        </View>
      </View>
    );
  }

  // Mobile Layout
  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
      {pageContent}
    </SafeAreaView>
  );
}
