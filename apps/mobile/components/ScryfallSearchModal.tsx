import { Search, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { CircularProgress } from "~/components/CircularProgress";
import { cardsApi, collectionApi, type CardSearchResult } from "~/lib/api";

interface ScryfallSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onCardAdded?: () => void;
}

function SearchResultItem({
  card,
  isDark,
  onPress,
  adding,
}: {
  card: CardSearchResult;
  isDark: boolean;
  onPress: () => void;
  adding: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={adding}
      className={`flex-row items-center gap-3 py-3 px-4 border-b ${
        isDark
          ? "border-slate-800 active:bg-slate-800/50"
          : "border-slate-100 active:bg-slate-50"
      }`}
    >
      {card.imageSmall ? (
        <Image
          source={{ uri: card.imageSmall }}
          className="h-12 w-9 rounded"
          resizeMode="cover"
        />
      ) : (
        <View
          className={`h-12 w-9 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
        />
      )}
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${
            isDark ? "text-white" : "text-slate-900"
          }`}
          numberOfLines={1}
        >
          {card.name}
        </Text>
        <View className="flex-row items-center gap-2">
          <Text
            className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
            {card.setCode?.toUpperCase()} #{card.collectorNumber}
          </Text>
          {card.priceUsd && (
            <Text
              className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              ${card.priceUsd.toFixed(2)}
            </Text>
          )}
        </View>
      </View>
      {adding ? (
        <CircularProgress size={18} strokeWidth={2} color="#10b981" backgroundColor="rgba(16,185,129,0.2)" />
      ) : (
        <View className="bg-emerald-500 rounded-lg px-3 py-1.5">
          <Text className="text-xs font-medium text-white">Add</Text>
        </View>
      )}
    </Pressable>
  );
}

export function ScryfallSearchModal({
  visible,
  onClose,
  onCardAdded,
}: ScryfallSearchModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingCard, setAddingCard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await cardsApi.search(query);
      if (result.error) {
        setError(result.error);
        setResults([]);
      } else if (result.data) {
        setResults(result.data.cards);
      }
    } catch {
      setError("Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (query: string) => {
    setSearchQuery(query);

    // Debounce search
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const timer = setTimeout(() => {
      handleSearch(query);
    }, 300);

    setDebounceTimer(timer);
  };

  const handleAddCard = async (card: CardSearchResult) => {
    setAddingCard(card.scryfallId);

    try {
      const result = await collectionApi.add(card.scryfallId, 1);
      if (result.error) {
        setError(result.error);
      } else {
        // Success feedback
        onCardAdded?.();
      }
    } catch {
      setError("Failed to add card");
    } finally {
      setAddingCard(null);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setResults([]);
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
        {/* Header */}
        <View className="flex-row items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Text
            className={`text-lg font-semibold flex-1 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Search Cards
          </Text>
          <Pressable
            onPress={handleClose}
            className={`rounded-full p-2 ${
              isDark ? "active:bg-slate-800" : "active:bg-slate-100"
            }`}
          >
            <X size={24} color={isDark ? "#94a3b8" : "#64748b"} />
          </Pressable>
        </View>

        {/* Search Input */}
        <View className="px-4 py-3">
          <View
            className={`flex-row items-center rounded-lg border px-3 ${
              isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"
            }`}
          >
            <Search size={18} color={isDark ? "#64748b" : "#94a3b8"} />
            <TextInput
              className={`flex-1 py-3 px-2 text-base ${
                isDark ? "text-white" : "text-slate-900"
              }`}
              placeholder="Search by card name..."
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              value={searchQuery}
              onChangeText={handleQueryChange}
              autoFocus
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => handleQueryChange("")}>
                <X size={18} color={isDark ? "#64748b" : "#94a3b8"} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Error */}
        {error && (
          <View className="mx-4 mb-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <Text className="text-red-500 text-sm">{error}</Text>
          </View>
        )}

        {/* Results */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        ) : results.length === 0 && searchQuery.length >= 2 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
              No cards found
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text
              className={`text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Start typing to search for cards
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.scryfallId}
            renderItem={({ item }) => (
              <SearchResultItem
                card={item}
                isDark={isDark}
                onPress={() => handleAddCard(item)}
                adding={addingCard === item.scryfallId}
              />
            )}
          />
        )}
      </View>
    </Modal>
  );
}
