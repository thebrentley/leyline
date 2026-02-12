import { X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
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
import { cardsApi, type CardSearchResult } from "~/lib/api";

interface ArtCropPickerDialogProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
}

export function ArtCropPickerDialog({
  visible,
  onClose,
  onSelect,
}: ArtCropPickerDialogProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [search, setSearch] = useState("");
  const [cards, setCards] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (visible) {
      setSearch("");
      setCards([]);
      setPage(1);
      setHasMore(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !search.trim()) return;

    const timeoutId = setTimeout(() => {
      searchCards(search, 1);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search, visible]);

  const searchCards = async (query: string, pageNum: number) => {
    if (!query.trim()) return;

    setLoading(true);
    const result = await cardsApi.searchLocal(query, pageNum, 50);

    if (result.data) {
      if (pageNum === 1) {
        setCards(result.data.cards.filter((c) => c.imageArtCrop));
      } else {
        setCards((prev) => [
          ...prev,
          ...result.data!.cards.filter((c) => c.imageArtCrop),
        ]);
      }
      setHasMore(result.data.hasMore);
    }
    setLoading(false);
  };

  const loadMore = () => {
    if (loading || !hasMore || !search.trim()) return;
    const nextPage = page + 1;
    setPage(nextPage);
    searchCards(search, nextPage);
  };

  const handleSelect = (card: CardSearchResult) => {
    if (card.imageArtCrop) {
      onSelect(card.imageArtCrop);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
      >
        {/* Header */}
        <View
          className={`flex-row items-center justify-between border-b px-4 py-4 ${
            isDark ? "border-slate-800" : "border-slate-200"
          }`}
        >
          <Text
            className={`text-xl font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Choose Profile Picture
          </Text>
          <Pressable
            onPress={onClose}
            className={`rounded-full p-2 ${
              isDark ? "active:bg-slate-800" : "active:bg-slate-100"
            }`}
          >
            <X size={24} color={isDark ? "#94a3b8" : "#64748b"} />
          </Pressable>
        </View>

        {/* Search Input */}
        <View className="px-4 py-3">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search for a card..."
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            className={`rounded-lg border px-4 py-3 text-base ${
              isDark
                ? "border-slate-700 bg-slate-800 text-white"
                : "border-slate-200 bg-white text-slate-900"
            }`}
            autoFocus
          />
        </View>

        {/* Cards Grid */}
        {!search.trim() ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text
              className={`text-center ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Search for a card to use its art as your profile picture
            </Text>
          </View>
        ) : loading && cards.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator
              size="large"
              color={isDark ? "#a78bfa" : "#9333ea"}
            />
          </View>
        ) : cards.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text
              className={`text-center ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              No cards found
            </Text>
          </View>
        ) : (
          <FlatList
            data={cards}
            keyExtractor={(item) => item.scryfallId}
            numColumns={3}
            columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loading && cards.length > 0 ? (
                <View className="py-4">
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#a78bfa" : "#9333ea"}
                  />
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                className="flex-1 aspect-square"
              >
                <Image
                  source={{ uri: item.imageArtCrop }}
                  className="h-full w-full rounded-lg"
                  resizeMode="cover"
                />
                <View
                  className={`absolute bottom-0 left-0 right-0 rounded-b-lg px-1 py-1 ${
                    isDark ? "bg-black/70" : "bg-black/50"
                  }`}
                >
                  <Text
                    className="text-center text-xs font-medium text-white"
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
