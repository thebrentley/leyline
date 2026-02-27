import { router, useNavigation } from "expo-router";
import { Compass, Crown, Filter, Layers, Search, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import {
  decksApi,
  type ExploreDeckSummary,
  type ExploreFilters,
} from "~/lib/api";
import { useResponsive } from "~/hooks/useResponsive";
import { HeaderButton, HeaderButtonGroup } from "~/components/ui/HeaderButton";
import { KEYBOARD_ACCESSORY_ID } from "~/components/ui/KeyboardDoneAccessory";
import { DeckScoreChip } from "~/components/ranking/DeckScoreChip";
import { MANA_COLORS } from "~/components/deck/deck-detail-constants";

function ColorIdentityPills({
  colors,
  isDark,
}: {
  colors: string[];
  isDark: boolean;
}) {
  if (colors.length === 0) {
    return (
      <View
        className="h-4 w-4 rounded-full border"
        style={{
          backgroundColor: "#888",
          borderColor: isDark ? "#475569" : "#cbd5e1",
        }}
      />
    );
  }

  return (
    <View className="flex-row gap-1">
      {colors.map((color) => (
        <View
          key={color}
          className="h-4 w-4 rounded-full border"
          style={{
            backgroundColor: MANA_COLORS[color] || "#888",
            borderColor: isDark ? "#475569" : "#cbd5e1",
          }}
        />
      ))}
    </View>
  );
}

const isWeb = Platform.OS === "web";

function ExploreDeckGridItem({
  deck,
  isDark,
  onPress,
  isDesktopView,
  numColumns,
}: {
  deck: ExploreDeckSummary;
  isDark: boolean;
  onPress: () => void;
  isDesktopView?: boolean;
  numColumns: number;
}) {
  const primaryCommander = deck.commanders[0];
  const [hovered, setHovered] = useState(false);

  return (
    <View
      style={{ width: `${100 / numColumns}%` as any, height: 180, padding: 2 }}
    >
      <Pressable
        onPress={onPress}
        // @ts-ignore - onMouseEnter/Leave valid on web
        onMouseEnter={
          isWeb && isDesktopView ? () => setHovered(true) : undefined
        }
        // @ts-ignore
        onMouseLeave={
          isWeb && isDesktopView ? () => setHovered(false) : undefined
        }
        className="flex-1 rounded-xl overflow-hidden"
        style={
          isWeb && isDesktopView
            ? {
                // @ts-ignore - web CSS
                transition: "transform 150ms ease, box-shadow 150ms ease",
                transform: hovered ? [{ scale: 1.05 }] : [{ scale: 1 }],
                zIndex: hovered ? 10 : 0,
              }
            : undefined
        }
      >
        {/* Background image */}
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
            height: 90,
          }}
        >
          {/* Commander name */}
          {primaryCommander && (
            <View className="flex-row items-center gap-1 mb-0.5">
              <Crown size={10} color="#eab308" />
              <Text className="text-xs text-white/70" numberOfLines={1}>
                {primaryCommander}
              </Text>
            </View>
          )}

          {/* Deck name */}
          <Text className="text-sm font-semibold text-white" numberOfLines={1}>
            {deck.name}
          </Text>

          {/* Color identity and card count */}
          <View className="mt-1 flex-row items-center gap-1">
            <ColorIdentityPills colors={deck.colors} isDark={true} />
            <Text className="ml-1 text-xs text-white/60">
              {deck.cardCount} cards
            </Text>
          </View>

          {/* Owner */}
          <Text className="mt-0.5 text-xs text-white/50" numberOfLines={1}>
            by {deck.ownerName}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export default function ExploreScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop, breakpoint } = useResponsive();
  const navigation = useNavigation();

  const [decks, setDecks] = useState<ExploreDeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [nameFilter, setNameFilter] = useState("");
  const [commanderFilter, setCommanderFilter] = useState("");
  const [cardNameFilter, setCardNameFilter] = useState("");

  // Debounce refs
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildFilters = useCallback((): ExploreFilters => {
    const filters: ExploreFilters = {};
    if (nameFilter.trim()) filters.name = nameFilter.trim();
    if (commanderFilter.trim()) filters.commander = commanderFilter.trim();
    if (cardNameFilter.trim()) filters.cardName = cardNameFilter.trim();
    return filters;
  }, [nameFilter, commanderFilter, cardNameFilter]);

  const loadDecks = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      try {
        const filters = buildFilters();
        const result = await decksApi.explore({
          ...filters,
          page: pageNum,
          pageSize: 20,
        });

        if (result.data) {
          if (append) {
            setDecks((prev) => [...prev, ...result.data!.data]);
          } else {
            setDecks(result.data.data);
          }
          setPage(result.data.page);
          setTotalPages(result.data.totalPages);
        }
      } catch (err) {
        console.error("Failed to load explore decks:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildFilters],
  );

  // Debounced search on filter changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadDecks(1, false);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nameFilter, commanderFilter, cardNameFilter]);

  // Initial load
  useEffect(() => {
    loadDecks(1, false);
  }, []);

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      loadDecks(page + 1, true);
    }
  };

  const hasActiveFilters =
    nameFilter.trim() || commanderFilter.trim() || cardNameFilter.trim();

  const clearFilters = () => {
    setNameFilter("");
    setCommanderFilter("");
    setCardNameFilter("");
  };

  // Set the filter button in the navigation header (mobile only)
  useLayoutEffect(() => {
    if (!isDesktop) {
      navigation.setOptions({
        headerRight: () => (
          <HeaderButton
            icon={Filter}
            label="Filters"
            onPress={() => setShowFilters(!showFilters)}
          />
        ),
      });
    }
  }, [navigation, showFilters, isDark, isDesktop]);

  const gridColumns = useMemo(() => {
    switch (breakpoint) {
      case "2xl":
        return 6;
      case "xl":
        return 5;
      case "lg":
        return 4;
      case "md":
        return 3;
      default:
        return 2;
    }
  }, [breakpoint]);

  const inputClass = `flex-1 rounded-lg px-3 py-2 text-sm ${
    isDark
      ? "bg-slate-800 text-white placeholder:text-slate-500"
      : "bg-slate-100 text-slate-900 placeholder:text-slate-400"
  }`;

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
      edges={[]}
    >
      {/* Desktop Header */}
      {isDesktop && (
        <View className="flex-row items-center justify-between px-6 py-4">
          <Text
            className={`text-2xl font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Explore Decks
          </Text>
          <Pressable
            onPress={() => setShowFilters(!showFilters)}
            className={`flex-row items-center gap-1.5 px-3 py-2 rounded-lg ${
              showFilters
                ? "bg-purple-500/20"
                : isDark
                  ? "bg-slate-800 hover:bg-slate-700"
                  : "bg-white border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Filter
              size={18}
              color={showFilters ? "#7C3AED" : isDark ? "#94a3b8" : "#64748b"}
            />
            <Text
              className={`text-sm font-medium ${
                showFilters
                  ? "text-purple-500"
                  : isDark
                    ? "text-slate-300"
                    : "text-slate-600"
              }`}
            >
              Filters
            </Text>
          </Pressable>
        </View>
      )}

      {/* Filters */}
      {showFilters && (
        <View
          className={`px-4 lg:px-6 pb-3 gap-3 border-b ${
            isDark ? "border-slate-800" : "border-slate-200"
          }`}
        >
          {/* Row 1: Name search */}
          <View className="flex-row items-center gap-2 lg:max-w-md">
            <Search size={16} color={isDark ? "#64748b" : "#94a3b8"} />
            <TextInput
              value={nameFilter}
              onChangeText={setNameFilter}
              placeholder="Deck name..."
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              className={inputClass}
              inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
              // @ts-ignore - web style
              style={{ outlineStyle: "none" }}
            />
          </View>

          {/* Row 2: Commander + Card name */}
          <View className="flex-row gap-2 lg:max-w-2xl">
            <TextInput
              value={commanderFilter}
              onChangeText={setCommanderFilter}
              placeholder="Commander..."
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              className={inputClass}
              inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
              // @ts-ignore - web style
              style={{ outlineStyle: "none" }}
            />
            <TextInput
              value={cardNameFilter}
              onChangeText={setCardNameFilter}
              placeholder="Has card..."
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              className={inputClass}
              inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
              // @ts-ignore - web style
              style={{ outlineStyle: "none" }}
            />
          </View>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Pressable
              onPress={clearFilters}
              className="flex-row items-center gap-1 self-start"
            >
              <X size={14} color="#7C3AED" />
              <Text className="text-xs font-medium text-purple-500">
                Clear filters
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Content */}
      {loading && decks.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : decks.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View
            className={`mb-4 h-20 w-20 items-center justify-center rounded-full ${
              isDark ? "bg-slate-800" : "bg-slate-100"
            }`}
          >
            <Compass size={40} color={isDark ? "#64748b" : "#94a3b8"} />
          </View>
          <Text
            className={`mb-2 text-xl font-semibold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            No Public Decks Found
          </Text>
          <Text
            className={`text-center ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {hasActiveFilters
              ? "Try adjusting your filters"
              : "Check back later as more players share their decks"}
          </Text>
        </View>
      ) : (
        <FlatList
          key={`grid-${gridColumns}`}
          data={decks}
          keyExtractor={(item) => item.id}
          numColumns={gridColumns}
          contentContainerClassName="w-full max-w-content mx-auto p-1 lg:px-6 lg:py-6"
          columnWrapperClassName="lg:gap-4"
          renderItem={({ item }) => (
            <ExploreDeckGridItem
              deck={item}
              isDark={isDark}
              isDesktopView={isDesktop}
              numColumns={gridColumns}
              onPress={() => router.push(`/deck/${item.id}/public`)}
            />
          )}
          ListFooterComponent={
            page < totalPages ? (
              <View className="py-4 items-center">
                <Button
                  onPress={handleLoadMore}
                  variant="secondary"
                  disabled={loadingMore}
                >
                  <Text
                    className={`font-medium ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    {loadingMore ? "Loading..." : "Load More"}
                  </Text>
                </Button>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
