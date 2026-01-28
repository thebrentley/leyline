import { ArrowLeft, CheckCircle, Search, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cardsApi, type CardSearchResult } from "~/lib/api";
import { showToast } from "~/lib/toast";
import { useResponsive } from "~/hooks/useResponsive";

interface ScryfallSearchProps {
  visible: boolean;
  onClose: () => void;
  onSelectCard: (card: CardSearchResult) => void;
  title?: string;
  placeholder?: string;
}

export function ScryfallSearch({
  visible,
  onClose,
  onSelectCard,
  title = "Search Cards",
  placeholder = "Search Scryfall...",
}: ScryfallSearchProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Edition selection state
  const [selectedCardName, setSelectedCardName] = useState<string | null>(null);
  const [editions, setEditions] = useState<CardSearchResult[]>([]);
  const [loadingEditions, setLoadingEditions] = useState(false);
  const [selectedEdition, setSelectedEdition] = useState<CardSearchResult | null>(null);

  const searchCards = useCallback(
    async (searchQuery: string, pageNum = 1) => {
      if (!searchQuery.trim() || searchQuery.trim().length < 3) {
        setResults([]);
        setHasMore(false);
        return;
      }

      setLoading(true);
      try {
        const result = await cardsApi.search(searchQuery, pageNum);
        if (result.error) {
          showToast.error(result.error);
          setResults([]);
          setHasMore(false);
        } else if (result.data) {
          if (pageNum === 1) {
            setResults(result.data.cards);
          } else {
            setResults((prev) => [...prev, ...result.data.cards]);
          }
          setHasMore(result.data.hasMore);
        }
      } catch (err: any) {
        showToast.error(err?.message || "Search failed");
        setResults([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounced search as user types
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Clear results if query is less than 3 characters
    if (query.trim().length < 3) {
      setResults([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    // Set new timer for debounced search
    debounceTimerRef.current = setTimeout(() => {
      setPage(1);
      searchCards(query, 1);
    }, 500); // 500ms debounce

    // Cleanup on unmount or query change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, searchCards]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      searchCards(query, nextPage);
    }
  }, [hasMore, loading, page, query, searchCards]);

  const handleSelectCardFromSearch = useCallback(async (card: CardSearchResult) => {
    // Dismiss keyboard when navigating to printing selection
    Keyboard.dismiss();

    setSelectedCardName(card.name);
    setLoadingEditions(true);
    setEditions([]);
    setSelectedEdition(null);

    try {
      const result = await cardsApi.getPrints(card.name);
      if (result.error) {
        showToast.error(result.error);
        setSelectedCardName(null);
      } else if (result.data) {
        setEditions(result.data);
        if (result.data.length === 0) {
          showToast.info("No editions found for this card");
          setSelectedCardName(null);
        } else {
          // Auto-select the first edition
          setSelectedEdition(result.data[0]);
        }
      }
    } catch (err: any) {
      showToast.error(err?.message || "Failed to load editions");
      setSelectedCardName(null);
    } finally {
      setLoadingEditions(false);
    }
  }, []);

  const handleSelectEdition = useCallback(
    (card: CardSearchResult) => {
      setSelectedEdition(card);
    },
    [],
  );

  const handleAddEdition = useCallback(() => {
    if (!selectedEdition) return;

    onSelectCard(selectedEdition);
    // Reset all state
    setQuery("");
    setResults([]);
    setPage(1);
    setHasMore(false);
    setSelectedCardName(null);
    setEditions([]);
    setSelectedEdition(null);
  }, [selectedEdition, onSelectCard]);

  const handleBackToSearch = useCallback(() => {
    setSelectedCardName(null);
    setEditions([]);
  }, []);

  const handleClose = useCallback(() => {
    setQuery("");
    setResults([]);
    setPage(1);
    setHasMore(false);
    setSelectedCardName(null);
    setEditions([]);
    onClose();
  }, [onClose]);

  // Content view (shared between modal and panel)
  const content = (
    <View
      className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
      style={isDesktop ? {} : { paddingTop: insets.top }}
    >
        {/* Header */}
        <View
          className={`flex-row items-center gap-3 px-4 py-3 border-b ${
            isDark ? "border-slate-800" : "border-slate-200"
          }`}
        >
          {selectedCardName ? (
            <Pressable onPress={handleBackToSearch} className="p-1">
              <ArrowLeft size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          ) : (
            <Pressable onPress={handleClose} className="p-1">
              <X size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          )}
          <Text
            className={`text-lg font-bold flex-1 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {selectedCardName || title}
          </Text>
        </View>

        {/* Search Bar (always visible) */}
        <View
          className={`px-4 py-3 border-b ${
            isDark ? "border-slate-800" : "border-slate-200"
          }`}
        >
          <View
            className={`flex-row items-center gap-2 px-3 py-2 rounded-lg ${
              isDark ? "bg-slate-900" : "bg-slate-100"
            }`}
          >
            <Search size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => {
                if (selectedCardName) {
                  handleBackToSearch();
                }
              }}
              placeholder={placeholder}
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              className={`flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
              autoFocus={!selectedCardName}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")}>
                <X size={18} color={isDark ? "#64748b" : "#94a3b8"} />
              </Pressable>
            )}
          </View>
          {query.trim().length > 0 && query.trim().length < 3 && !selectedCardName && (
            <Text
              className={`text-xs mt-2 ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Type at least 3 characters to search
            </Text>
          )}
        </View>

        {/* Edition Selection View */}
        {selectedCardName ? (
          <>
            <View
              className={`px-4 py-3 border-b ${
                isDark ? "border-slate-800" : "border-slate-200"
              }`}
            >
              <Text
                className={`text-sm ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {editions.length} printing{editions.length !== 1 ? "s" : ""} available
              </Text>
            </View>

            {loadingEditions ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text
                  className={`mt-4 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Loading editions...
                </Text>
              </View>
            ) : editions.length === 0 ? (
              <View className="flex-1 items-center justify-center px-8">
                <Text
                  className={`text-center ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  No editions found
                </Text>
              </View>
            ) : (
              <>
              <FlatList
                data={editions}
                keyExtractor={(item) => item.scryfallId}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 80 }}
                renderItem={({ item }) => {
                  const isSelected = selectedEdition?.scryfallId === item.scryfallId;
                  return (
                  <Pressable
                    onPress={() => handleSelectEdition(item)}
                    className={`flex-row items-center gap-3 px-4 py-3 border-b ${
                      isDark
                        ? "border-slate-800 active:bg-slate-900"
                        : "border-slate-100 active:bg-slate-50"
                    } ${isSelected ? (isDark ? "bg-purple-950/30 border-l-4 border-l-purple-500" : "bg-purple-50 border-l-4 border-l-purple-500") : ""}`}
                  >
                    {item.imageSmall ? (
                      <Image
                        source={{ uri: item.imageSmall }}
                        className="h-20 w-14 rounded"
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        className={`h-20 w-14 rounded items-center justify-center ${
                          isDark ? "bg-slate-800" : "bg-slate-200"
                        }`}
                      >
                        <Text
                          className={`text-xs ${
                            isDark ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          No Image
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text
                        className={`font-semibold ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {item.setName}
                      </Text>
                      <Text
                        className={`text-xs mt-0.5 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {item.setCode?.toUpperCase()} • #{item.collectorNumber}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        <Text
                          className={`text-xs capitalize ${
                            item.rarity === "mythic"
                              ? "text-orange-500"
                              : item.rarity === "rare"
                              ? "text-yellow-500"
                              : item.rarity === "uncommon"
                              ? "text-slate-400"
                              : "text-slate-500"
                          }`}
                        >
                          {item.rarity}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      {item.priceUsd && (
                        <Text className="text-purple-500 font-medium">
                          ${item.priceUsd}
                        </Text>
                      )}
                      {item.priceUsdFoil && (
                        <Text className="text-purple-400 text-xs mt-0.5">
                          Foil: ${item.priceUsdFoil}
                        </Text>
                      )}
                    </View>
                    {isSelected && (
                      <CheckCircle size={24} color="#7C3AED" />
                    )}
                  </Pressable>
                  );
                }}
              />

              {/* Add Button */}
              <View
                className={`absolute bottom-0 left-0 right-0 p-4 border-t ${
                  isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                }`}
                style={{ paddingBottom: insets.bottom + 16 }}
              >
                <Pressable
                  onPress={handleAddEdition}
                  disabled={!selectedEdition}
                  className={`py-3 px-6 rounded-lg ${
                    selectedEdition
                      ? "bg-purple-500 active:bg-purple-600"
                      : "bg-slate-700"
                  }`}
                >
                  <Text className="text-white text-center font-semibold text-base">
                    Add to {title.includes("Collection") ? "Collection" : "Deck"}
                  </Text>
                </Pressable>
              </View>
              </>
            )}
          </>
        ) :
        /* Search Results */
        loading && results.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text
              className={`mt-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Searching Scryfall...
            </Text>
          </View>
        ) : results.length === 0 && query.trim().length >= 3 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Search size={48} color={isDark ? "#334155" : "#cbd5e1"} />
            <Text
              className={`mt-4 text-center ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              No results found for "{query}"
            </Text>
            <Text
              className={`mt-2 text-center text-sm ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Try a different search term or use Scryfall syntax
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Search size={48} color={isDark ? "#334155" : "#cbd5e1"} />
            <Text
              className={`mt-4 text-center ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Search for Magic cards
            </Text>
            <Text
              className={`mt-2 text-center text-sm ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Type at least 3 characters to start searching
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.scryfallId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelectCardFromSearch(item)}
                className={`flex-row items-center gap-3 px-4 py-3 border-b ${
                  isDark
                    ? "border-slate-800 active:bg-slate-900"
                    : "border-slate-100 active:bg-slate-50"
                }`}
              >
                {item.imageSmall ? (
                  <Image
                    source={{ uri: item.imageSmall }}
                    className="h-16 w-12 rounded"
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    className={`h-16 w-12 rounded items-center justify-center ${
                      isDark ? "bg-slate-800" : "bg-slate-200"
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      No
                    </Text>
                    <Text
                      className={`text-xs ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      Image
                    </Text>
                  </View>
                )}
                <View className="flex-1">
                  <Text
                    className={`font-medium ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {item.name}
                  </Text>
                  <Text
                    className={`text-xs ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {item.setName} • {item.setCode?.toUpperCase()} #
                    {item.collectorNumber}
                  </Text>
                  {item.typeLine && (
                    <Text
                      className={`text-xs mt-0.5 ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      {item.typeLine}
                    </Text>
                  )}
                </View>
                {item.priceUsd && (
                  <Text className="text-purple-500 font-medium">
                    ${item.priceUsd}
                  </Text>
                )}
              </Pressable>
            )}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loading && results.length > 0 ? (
                <View className="py-4">
                  <ActivityIndicator size="small" color="#7C3AED" />
                </View>
              ) : null
            }
          />
        )}
      </View>
  );

  // On desktop, render as a fixed right panel
  if (isDesktop) {
    if (!visible) return null;

    return (
      <>
        {/* Backdrop */}
        <Pressable
          onPress={handleClose}
          className="absolute inset-0 bg-black/50 z-40"
          style={{ position: 'fixed' as any }}
        />
        {/* Right Panel */}
        <View
          className={`absolute top-0 right-0 bottom-0 w-[480px] z-50 shadow-2xl ${
            isDark ? "bg-slate-950" : "bg-white"
          }`}
          style={{ position: 'fixed' as any }}
        >
          {content}
        </View>
      </>
    );
  }

  // On mobile, render as a modal
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {content}
    </Modal>
  );
}
