import { ArrowLeft, CheckCircle, Plus, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cardsApi, type CardSearchResult } from "~/lib/api";
import { showToast } from "~/lib/toast";
import { useResponsive } from "~/hooks/useResponsive";
import { KEYBOARD_ACCESSORY_ID } from "~/components/ui/KeyboardDoneAccessory";
import { useSearchState } from "~/hooks/useSearchState";
import { AdvancedSearchPanel } from "~/components/filters/AdvancedSearchPanel";
import {
  type AdvancedSearchFilters,
  EMPTY_ADVANCED_FILTERS,
  parseQueryToFilters,
} from "~/lib/buildSearchQuery";

interface ScryfallSearchProps {
  visible: boolean;
  onClose: () => void;
  onSelectCard: (card: CardSearchResult) => void;
  title?: string;
  placeholder?: string;
  // Context for persistent search state
  searchContext?: 'deck' | 'collection';
  searchContextId?: string; // deck ID if searchContext is 'deck'
  // Existing cards for visual indicators
  existingCardIds?: Set<string>; // Set of scryfallIds already in deck/collection
}

export function ScryfallSearch({
  visible,
  onClose,
  onSelectCard,
  title = "Search Cards",
  placeholder = "Search with Scryfall syntax (e.g., c:r t:dragon mv>=4)...",
  searchContext = 'collection',
  searchContextId,
  existingCardIds = new Set(),
}: ScryfallSearchProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();

  // Persistent search state
  const {
    query: savedQuery,
    setQuery: setSavedQuery,
    hasSavedSearch,
    clearSearchState,
  } = useSearchState(searchContext, searchContextId);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCards, setTotalCards] = useState(0);
  const [page, setPage] = useState(1);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Edition selection state
  const [selectedCardName, setSelectedCardName] = useState<string | null>(null);
  const [editions, setEditions] = useState<CardSearchResult[]>([]);
  const [loadingEditions, setLoadingEditions] = useState(false);
  const [selectedEdition, setSelectedEdition] = useState<CardSearchResult | null>(null);

  // Card detail modal state
  const [detailCard, setDetailCard] = useState<CardSearchResult | null>(null);
  const [addingCardId, setAddingCardId] = useState<string | null>(null);

  // Advanced search state
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>({ ...EMPTY_ADVANCED_FILTERS });


  const searchCards = useCallback(
    async (searchQuery: string, pageNum = 1) => {
      if (!searchQuery.trim() || searchQuery.trim().length < 2) {
        setResults([]);
        setHasMore(false);
        setTotalCards(0);
        return;
      }

      setLoading(true);
      try {
        // Use local search API with Scryfall syntax
        const result = await cardsApi.searchLocal(searchQuery, pageNum, 50);
        if (result.error) {
          showToast.error(result.error);
          setResults([]);
          setHasMore(false);
          setTotalCards(0);
        } else if (result.data) {
          if (pageNum === 1) {
            setResults(result.data.cards);
          } else {
            setResults((prev) => [...prev, ...result.data.cards]);
          }
          setHasMore(result.data.hasMore);
          setTotalCards(result.data.totalCards);

          // Save search state with result count
          setSavedQuery(searchQuery, result.data.totalCards);
        }
      } catch (err: any) {
        showToast.error(err?.message || "Search failed");
        setResults([]);
        setHasMore(false);
        setTotalCards(0);
      } finally {
        setLoading(false);
      }
    },
    [setSavedQuery],
  );

  // Load saved query when modal opens
  useEffect(() => {
    if (visible && savedQuery && !query) {
      setQuery(savedQuery);
    }
  }, [visible, savedQuery]);

  // Debounced search as user types
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Clear results if query is less than 2 characters (local search is fast!)
    if (query.trim().length < 2) {
      setResults([]);
      setHasMore(false);
      setTotalCards(0);
      setLoading(false);
      return;
    }

    // Set new timer for debounced search
    debounceTimerRef.current = setTimeout(() => {
      setPage(1);
      searchCards(query, 1);
    }, 300); // 300ms debounce (faster for local search)

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

  const handleAddCardDirectly = useCallback(async (card: CardSearchResult) => {
    setAddingCardId(card.scryfallId);
    try {
      onSelectCard(card);
      showToast.success(`Added ${card.name} to ${title.includes("Collection") ? "collection" : "deck"}`);
    } catch (err: any) {
      showToast.error(err?.message || "Failed to add card");
    } finally {
      setAddingCardId(null);
    }
  }, [onSelectCard, title]);

  const handleShowCardDetail = useCallback((card: CardSearchResult) => {
    setDetailCard(card);
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setDetailCard(null);
  }, []);

  const handleOpenAdvancedSearch = useCallback(() => {
    Keyboard.dismiss();
    // Parse the current query into filters so the UI reflects what's in the input
    const parsed = parseQueryToFilters(query);
    setAdvancedFilters(parsed);
    setAdvancedSearchOpen(true);
  }, [query]);

  const handleCloseAdvancedSearch = useCallback(() => {
    setAdvancedSearchOpen(false);
  }, []);

  const handleAdvancedSearchApply = useCallback((builtQuery: string) => {
    setAdvancedSearchOpen(false);
    setQuery(builtQuery);
  }, []);

  const handleClose = useCallback(() => {
    setQuery("");
    setResults([]);
    setPage(1);
    setHasMore(false);
    setSelectedCardName(null);
    setEditions([]);
    setAdvancedSearchOpen(false);
    setAdvancedFilters({ ...EMPTY_ADVANCED_FILTERS });
    onClose();
  }, [onClose]);

  // Content view (shared between modal and panel)
  const content = (
    <Pressable
      className={`flex-1 overflow-hidden ${isDark ? "bg-slate-950" : "bg-white"}`}
      style={isDesktop ? {} : { paddingTop: insets.top }}
      onPress={Keyboard.dismiss}
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
          <View className="flex-row items-center gap-2">
            <View
              className={`flex-row items-center gap-2 px-3 py-2 rounded-lg flex-1 ${
                isDark ? "bg-slate-900" : "bg-slate-100"
              } ${advancedSearchOpen ? "opacity-50" : ""}`}
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
                autoFocus={!selectedCardName && !advancedSearchOpen}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!advancedSearchOpen}
                inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
              />
              {query.length > 0 && !advancedSearchOpen && (
                <Pressable onPress={() => setQuery("")}>
                  <X size={18} color={isDark ? "#64748b" : "#94a3b8"} />
                </Pressable>
              )}
            </View>

            {/* Advanced Search Toggle */}
            <Pressable
              onPress={advancedSearchOpen ? handleCloseAdvancedSearch : handleOpenAdvancedSearch}
              className={`p-2.5 rounded-lg ${
                advancedSearchOpen
                  ? "bg-purple-500"
                  : isDark
                  ? "bg-slate-800"
                  : "bg-slate-200"
              }`}
            >
              <SlidersHorizontal
                size={20}
                color={advancedSearchOpen ? "#fff" : isDark ? "#94a3b8" : "#64748b"}
              />
            </Pressable>
          </View>

          {/* Search hints and result count */}
          {!advancedSearchOpen && (
            <View className="mt-2 flex-row items-center justify-between">
              {query.trim().length > 0 && query.trim().length < 2 && !selectedCardName ? (
                <Text
                  className={`text-xs ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Type at least 2 characters to search
                </Text>
              ) : totalCards > 0 && !selectedCardName ? (
                <Text
                  className={`text-xs ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {totalCards} card{totalCards !== 1 ? 's' : ''} found
                </Text>
              ) : (
                <View />
              )}

              {/* Resume last search button */}
              {hasSavedSearch && !query && !selectedCardName && (
                <Pressable
                  onPress={() => setQuery(savedQuery)}
                  className="flex-row items-center gap-1 px-2 py-1 rounded"
                >
                  <RotateCcw size={14} color="#7C3AED" />
                  <Text className="text-xs text-purple-500 font-medium">
                    Resume last search
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Advanced Search Panel */}
        {advancedSearchOpen ? (
          <AdvancedSearchPanel
            filters={advancedFilters}
            onFiltersChange={setAdvancedFilters}
            onApply={handleAdvancedSearchApply}
            onClose={handleCloseAdvancedSearch}
          />
        ) : /* Edition Selection View */
        selectedCardName ? (
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
              Searching cards...
            </Text>
          </View>
        ) : results.length === 0 && query.trim().length >= 2 ? (
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
              Use Scryfall syntax: c:red t:dragon mv{'>'}=4
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.scryfallId}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => {
              const isInDeck = existingCardIds.has(item.scryfallId);
              return (
              <View
                className={`flex-row items-center gap-3 px-4 py-3 border-b ${
                  isDark ? "border-slate-800" : "border-slate-100"
                }`}
              >
                <Pressable
                  onPress={() => handleShowCardDetail(item)}
                  className={`flex-row items-center gap-3 flex-1 ${
                    isDark ? "active:opacity-70" : "active:opacity-70"
                  }`}
                >
                  <View className="relative">
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
                    {isInDeck && (
                      <View className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5">
                        <CheckCircle size={14} color="#fff" fill="#22c55e" />
                      </View>
                    )}
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text
                        className={`font-medium ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {item.name}
                      </Text>
                      {isInDeck && (
                        <View className="px-1.5 py-0.5 bg-green-500/20 rounded">
                          <Text className="text-xs text-green-600 dark:text-green-400 font-medium">
                            In {searchContext === 'deck' ? 'Deck' : 'Collection'}
                          </Text>
                        </View>
                      )}
                    </View>
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
                    <Text className="text-purple-500 font-medium text-sm">
                      ${item.priceUsd}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => handleAddCardDirectly(item)}
                  disabled={addingCardId === item.scryfallId}
                  className={`px-3 py-2 rounded ${
                    addingCardId === item.scryfallId
                      ? "bg-slate-600"
                      : "bg-purple-500 active:bg-purple-600"
                  }`}
                >
                  {addingCardId === item.scryfallId ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Plus size={18} color="#fff" />
                  )}
                </Pressable>
              </View>
              );
            }}
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
      </Pressable>
  );

  // Card Detail Dialog (desktop) / Sheet (mobile)
  const detailModal = detailCard && (
      <Modal
        visible={!!detailCard}
        transparent={true}
        animationType={isDesktop ? "fade" : "slide"}
        onRequestClose={handleCloseDetailModal}
        statusBarTranslucent
      >
      <View className="flex-1 bg-black/60">
        {/* Backdrop tap to close */}
        <Pressable
          onPress={handleCloseDetailModal}
          className="flex-1"
        />

        {isDesktop ? (
          // Desktop: centered dialog with horizontal layout
          <View className="absolute inset-0 items-center justify-center p-6" pointerEvents="box-none">
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View
                className={`w-full max-w-2xl rounded-lg overflow-hidden ${
                  isDark ? "bg-slate-900" : "bg-white"
                }`}
              >
                {/* Close button */}
                <View className="absolute top-4 right-4 z-10">
                  <Pressable
                    onPress={handleCloseDetailModal}
                    className={`p-2 rounded-full ${
                      isDark ? "bg-slate-800/90" : "bg-white/90"
                    }`}
                  >
                    <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                  </Pressable>
                </View>

                <View className="flex-row p-6 gap-6">
                  {/* Card image */}
                  <View className="flex-shrink-0">
                    {detailCard.imageUrl ? (
                      <Image
                        source={{ uri: detailCard.imageUrl }}
                        className="w-72 h-[28rem] rounded-lg"
                        resizeMode="contain"
                      />
                    ) : (
                      <View
                        className={`w-72 h-[28rem] rounded-lg items-center justify-center ${
                          isDark ? "bg-slate-800" : "bg-slate-200"
                        }`}
                      >
                        <Text
                          className={`text-lg ${
                            isDark ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          No Image Available
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Card details */}
                  <View className="flex-1 justify-between">
                    <View>
                      <Text className={`text-2xl font-bold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
                        {detailCard.name}
                      </Text>
                      {detailCard.manaCost && (
                        <Text className={`text-base mb-3 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                          {detailCard.manaCost}
                        </Text>
                      )}
                      {detailCard.typeLine && (
                        <Text className={`text-base mb-4 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                          {detailCard.typeLine}
                        </Text>
                      )}
                      <View className="mb-4">
                        <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {detailCard.setName}
                        </Text>
                        <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {detailCard.setCode?.toUpperCase()} #{detailCard.collectorNumber}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between mb-4">
                        <Text
                          className={`text-base capitalize ${
                            detailCard.rarity === "mythic"
                              ? "text-orange-500 font-semibold"
                              : detailCard.rarity === "rare"
                              ? "text-yellow-500 font-semibold"
                              : detailCard.rarity === "uncommon"
                              ? isDark ? "text-slate-300" : "text-slate-600"
                              : isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          {detailCard.rarity}
                        </Text>
                        {detailCard.priceUsd && (
                          <Text className="text-xl text-purple-500 font-bold">
                            ${detailCard.priceUsd}
                          </Text>
                        )}
                      </View>
                      {detailCard.priceUsdFoil && (
                        <Text className={`text-base mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          Foil: ${detailCard.priceUsdFoil}
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => handleAddCardDirectly(detailCard)}
                      disabled={addingCardId === detailCard.scryfallId}
                      className={`py-3 px-6 rounded-lg ${
                        addingCardId === detailCard.scryfallId
                          ? "bg-slate-600"
                          : "bg-purple-500 active:bg-purple-600"
                      }`}
                    >
                      {addingCardId === detailCard.scryfallId ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-white text-center font-semibold text-base">
                          Add to {title.includes("Collection") ? "Collection" : "Deck"}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        ) : (
          // Mobile: bottom sheet
          <View
            className={`rounded-t-2xl overflow-hidden ${
              isDark ? "bg-slate-900" : "bg-white"
            }`}
          >
            {/* Drag handle */}
            <View className="items-center pt-3 pb-2">
              <View className={`w-10 h-1 rounded-full ${isDark ? "bg-slate-600" : "bg-slate-300"}`} />
            </View>

            {/* Close button row */}
            <View className="flex-row items-center justify-between px-4 pb-2">
              <Text className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                Card Details
              </Text>
              <Pressable
                onPress={handleCloseDetailModal}
                className={`p-2 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
              >
                <X size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              </Pressable>
            </View>

            <ScrollView className="px-4" contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
              {/* Card image */}
              <View className="items-center mb-4">
                {detailCard.imageUrl ? (
                  <Image
                    source={{ uri: detailCard.imageUrl }}
                    className="w-56 h-80 rounded-lg"
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    className={`w-56 h-80 rounded-lg items-center justify-center ${
                      isDark ? "bg-slate-800" : "bg-slate-200"
                    }`}
                  >
                    <Text className={`text-base ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      No Image Available
                    </Text>
                  </View>
                )}
              </View>

              {/* Card info */}
              <Text className={`text-xl font-bold mb-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                {detailCard.name}
              </Text>

              {detailCard.manaCost && (
                <Text className={`text-base mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  {detailCard.manaCost}
                </Text>
              )}

              {detailCard.typeLine && (
                <Text className={`text-sm mb-3 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  {detailCard.typeLine}
                </Text>
              )}

              <View className="flex-row items-center justify-between mb-2">
                <View>
                  <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {detailCard.setName}
                  </Text>
                  <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {detailCard.setCode?.toUpperCase()} #{detailCard.collectorNumber}
                  </Text>
                </View>
                <Text
                  className={`text-sm capitalize ${
                    detailCard.rarity === "mythic"
                      ? "text-orange-500 font-semibold"
                      : detailCard.rarity === "rare"
                      ? "text-yellow-500 font-semibold"
                      : detailCard.rarity === "uncommon"
                      ? isDark ? "text-slate-300" : "text-slate-600"
                      : isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {detailCard.rarity}
                </Text>
              </View>

              <View className="flex-row items-center gap-3 mb-4">
                {detailCard.priceUsd && (
                  <Text className="text-lg text-purple-500 font-bold">
                    ${detailCard.priceUsd}
                  </Text>
                )}
                {detailCard.priceUsdFoil && (
                  <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Foil: ${detailCard.priceUsdFoil}
                  </Text>
                )}
              </View>

              {/* Add button */}
              <Pressable
                onPress={() => handleAddCardDirectly(detailCard)}
                disabled={addingCardId === detailCard.scryfallId}
                className={`py-3 rounded-lg ${
                  addingCardId === detailCard.scryfallId
                    ? "bg-slate-600"
                    : "bg-purple-500 active:bg-purple-600"
                }`}
              >
                {addingCardId === detailCard.scryfallId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white text-center font-semibold text-base">
                    Add to {title.includes("Collection") ? "Collection" : "Deck"}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        )}
      </View>
      </Modal>
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
        {detailModal}
      </>
    );
  }

  // On mobile, render as a modal
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {content}
      {detailModal}
    </Modal>
  );
}
