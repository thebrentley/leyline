import { DrawerActions, useNavigation } from "@react-navigation/native";
import {
  CheckCircle,
  FileText,
  Grid3X3,
  List,
  Menu,
  Minus,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ScryfallSearch } from "~/components/ScryfallSearch";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { Button } from "~/components/ui/button";
import { cardsApi, collectionApi, type CardSearchResult, type CollectionCard, type CollectionStats } from "~/lib/api";
import { cache, CACHE_KEYS, CACHE_TTL, cachedFetch } from "~/lib/cache";
import { showToast } from "~/lib/toast";
import { useResponsive } from "~/hooks/useResponsive";

// Fixed item heights for virtual scrolling
const LIST_ITEM_HEIGHT = 73; // py-3 (24px) + image h-12 (48px) + border (1px)

function CollectionListItem({
  card,
  isDark,
  onPress,
  onDelete,
  onRequestDelete,
}: {
  card: CollectionCard;
  isDark: boolean;
  onPress?: () => void;
  onDelete?: (id: string) => void;
  onRequestDelete?: (card: CollectionCard) => void;
}) {
  const totalQty = card.quantity + card.foilQuantity;
  // Use current prices for display
  const price = card.currentPriceUsd ? (card.currentPriceUsd * card.quantity) : 0;
  const foilPrice = card.currentPriceUsdFoil ? (card.currentPriceUsdFoil * card.foilQuantity) : 0;
  const currentValue = price + foilPrice;

  // Calculate original value for comparison
  const origPrice = card.originalPriceUsd ? (card.originalPriceUsd * card.quantity) : 0;
  const origFoilPrice = card.originalPriceUsdFoil ? (card.originalPriceUsdFoil * card.foilQuantity) : 0;
  const originalValue = origPrice + origFoilPrice;

  const gainLoss = currentValue - originalValue;
  const hasGainLoss = originalValue > 0 && currentValue > 0;

  const handleDelete = () => {
    onRequestDelete?.(card);
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: "clamp",
    });

    return (
      <Animated.View
        style={{ transform: [{ translateX }] }}
        className="flex-row"
      >
        <Pressable
          onPress={handleDelete}
          className="bg-red-500 items-center justify-center px-6"
        >
          <Trash2 size={20} color="white" />
          <Text className="text-white text-xs font-medium mt-1">Delete</Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <Pressable
        onPress={onPress}
        className={`flex-row items-center gap-3 py-3 px-4 border-b ${
          isDark
            ? "border-slate-800 active:bg-slate-800/50 bg-slate-950"
            : "border-slate-100 active:bg-slate-50 bg-white"
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
            {card.linkedDeckCard && (
              <View className="flex-row items-center gap-1">
                <View className="h-2 w-2 rounded-full bg-purple-500" />
                <Text className="text-xs text-purple-500">
                  {card.linkedDeckCard.deckName}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View className="items-end">
          <Text
            className={`text-sm font-medium ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {totalQty}x
          </Text>
          {currentValue > 0 && (
            <Text className="text-purple-500 text-xs font-medium">
              ${currentValue.toFixed(2)}
            </Text>
          )}
          {hasGainLoss && gainLoss !== 0 && (
            <Text className={`text-xs ${gainLoss >= 0 ? "text-purple-400" : "text-red-400"}`}>
              {gainLoss >= 0 ? "+" : ""}{gainLoss.toFixed(2)}
            </Text>
          )}
        </View>
      </Pressable>
    </Swipeable>
  );
}

function CollectionGridItem({
  card,
  isDark,
  onPress,
}: {
  card: CollectionCard;
  isDark: boolean;
  onPress?: () => void;
}) {
  const totalQty = card.quantity + card.foilQuantity;

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 p-1 transition-transform lg:hover:scale-105 lg:hover:z-10"
      style={{ maxWidth: "33.33%" }}
    >
      <View className="relative">
        {card.imageUrl ? (
          <Image
            source={{ uri: card.imageUrl }}
            className="aspect-[488/680] w-full rounded-lg"
            resizeMode="cover"
          />
        ) : (
          <View
            className={`aspect-[488/680] w-full items-center justify-center rounded-lg ${
              isDark ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            <Text
              className={`text-xs text-center px-1 ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
              numberOfLines={2}
            >
              {card.name}
            </Text>
          </View>
        )}
        <View className="absolute top-1 right-1 bg-black/70 rounded-full px-1.5 py-0.5">
          <Text className="text-xs font-bold text-white">{totalQty}x</Text>
        </View>
        {card.linkedDeckCard && (
          <View className="absolute bottom-1 left-1 h-3 w-3 rounded-full bg-purple-500 border border-white" />
        )}
      </View>
    </Pressable>
  );
}

function StatsHeader({
  stats,
  isDark,
}: {
  stats: CollectionStats | null;
  isDark: boolean;
}) {
  if (!stats) return null;

  // Safe defaults for stats that might be undefined
  const currentValue = stats.currentValue ?? 0;
  const originalValue = stats.originalValue ?? 0;
  const gainLoss = stats.gainLoss ?? 0;
  
  const gainLossColor = gainLoss >= 0 ? "text-purple-500" : "text-red-500";
  const gainLossSign = gainLoss >= 0 ? "+" : "";

  return (
    <View
      className={`mx-4 mb-4 rounded-xl p-4 ${
        isDark ? "bg-slate-900" : "bg-slate-50"
      }`}
    >
      {/* Top row - Cards and Current Value */}
      <View className="flex-row justify-between mb-3">
        <View>
          <Text
            className={`text-2xl font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {stats.totalCards}
          </Text>
          <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
            Total Cards
          </Text>
        </View>
        <View className="items-end">
          <Text
            className={`text-2xl font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            ${currentValue.toFixed(2)}
          </Text>
          <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
            Current Value
          </Text>
        </View>
      </View>

      {/* Bottom row - Original Value and Gain/Loss */}
      <View className={`flex-row justify-between pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}>
        <View>
          <Text
            className={`text-lg font-semibold ${
              isDark ? "text-slate-300" : "text-slate-700"
            }`}
          >
            ${originalValue.toFixed(2)}
          </Text>
          <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            Original Cost
          </Text>
        </View>
        <View className="items-end">
          <Text className={`text-lg font-bold ${gainLossColor}`}>
            {gainLossSign}${Math.abs(gainLoss).toFixed(2)}
          </Text>
          <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            {gainLoss >= 0 ? "Gain" : "Loss"}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ==================== Card Detail Modal ====================

function CardDetailModal({
  card,
  visible,
  onClose,
  onUpdate,
  onRemove,
  onRequestRemove,
  isDark,
}: {
  card: CollectionCard | null;
  visible: boolean;
  onClose: () => void;
  onUpdate: (id: string, quantity: number, foilQuantity: number) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onRequestRemove?: (card: CollectionCard) => void;
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [quantity, setQuantity] = useState(0);
  const [foilQuantity, setFoilQuantity] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (card) {
      setQuantity(card.quantity);
      setFoilQuantity(card.foilQuantity);
    }
  }, [card]);

  if (!card) return null;

  const hasChanges = quantity !== card.quantity || foilQuantity !== card.foilQuantity;
  
  // Calculate current value
  const currentValue =
    (card.currentPriceUsd ? card.currentPriceUsd * quantity : 0) +
    (card.currentPriceUsdFoil ? card.currentPriceUsdFoil * foilQuantity : 0);
  
  // Calculate original value
  const originalValue =
    (card.originalPriceUsd ? card.originalPriceUsd * quantity : 0) +
    (card.originalPriceUsdFoil ? card.originalPriceUsdFoil * foilQuantity : 0);
  
  const gainLoss = currentValue - originalValue;
  const hasGainLoss = originalValue > 0 && currentValue > 0;

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      await onUpdate(card.id, quantity, foilQuantity);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    onClose();
    onRequestRemove?.(card);
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`} style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          <View className="flex-1">
            <Text className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`} numberOfLines={1}>
              {card.name}
            </Text>
            <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {card.setName} • #{card.collectorNumber}
            </Text>
          </View>
          <Pressable onPress={onClose} className="rounded-full p-2 ml-2">
            <X size={24} color={isDark ? "white" : "#1e293b"} />
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {/* Card Image */}
          <View className="items-center mb-6">
            {card.imageUrl ? (
              <Image
                source={{ uri: card.imageUrl }}
                style={{
                  width: Dimensions.get("window").width - 80,
                  height: (Dimensions.get("window").width - 80) * (680 / 488),
                  borderRadius: 12,
                }}
                resizeMode="contain"
              />
            ) : (
              <View
                className={`rounded-xl items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                style={{
                  width: Dimensions.get("window").width - 80,
                  height: (Dimensions.get("window").width - 80) * (680 / 488),
                }}
              >
                <Text className={`text-lg ${isDark ? "text-slate-500" : "text-slate-400"}`}>{card.name}</Text>
              </View>
            )}
          </View>

          {/* Quantity Controls */}
          <View className={`rounded-xl p-4 mb-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
            <Text className={`text-sm font-medium mb-4 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Quantity
            </Text>

            {/* Regular Quantity */}
            <View className="flex-row items-center justify-between mb-4">
              <Text className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}>Regular</Text>
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={() => setQuantity(Math.max(0, quantity - 1))}
                  className={`rounded-full p-2 ${isDark ? "bg-slate-800 active:bg-slate-700" : "bg-slate-200 active:bg-slate-300"}`}
                >
                  <Minus size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                </Pressable>
                <Text className={`text-xl font-bold w-10 text-center ${isDark ? "text-white" : "text-slate-900"}`}>
                  {quantity}
                </Text>
                <Pressable
                  onPress={() => setQuantity(quantity + 1)}
                  className={`rounded-full p-2 ${isDark ? "bg-slate-800 active:bg-slate-700" : "bg-slate-200 active:bg-slate-300"}`}
                >
                  <Plus size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                </Pressable>
              </View>
            </View>

            {/* Foil Quantity */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Sparkles size={16} color="#a855f7" />
                <Text className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}>Foil</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={() => setFoilQuantity(Math.max(0, foilQuantity - 1))}
                  className={`rounded-full p-2 ${isDark ? "bg-slate-800 active:bg-slate-700" : "bg-slate-200 active:bg-slate-300"}`}
                >
                  <Minus size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                </Pressable>
                <Text className={`text-xl font-bold w-10 text-center ${isDark ? "text-white" : "text-slate-900"}`}>
                  {foilQuantity}
                </Text>
                <Pressable
                  onPress={() => setFoilQuantity(foilQuantity + 1)}
                  className={`rounded-full p-2 ${isDark ? "bg-slate-800 active:bg-slate-700" : "bg-slate-200 active:bg-slate-300"}`}
                >
                  <Plus size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Price Info */}
          {(card.currentPriceUsd || card.currentPriceUsdFoil || card.originalPriceUsd || card.originalPriceUsdFoil) && (
            <View className={`rounded-xl p-4 mb-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
              <Text className={`text-sm font-medium mb-3 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Price Information
              </Text>

              {/* Current Prices */}
              <Text className={`text-xs font-medium mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                CURRENT MARKET PRICE
              </Text>
              {card.currentPriceUsd != null && (
                <View className="flex-row justify-between mb-1">
                  <Text className={isDark ? "text-slate-400" : "text-slate-500"}>Regular</Text>
                  <Text className={isDark ? "text-white" : "text-slate-900"}>${Number(card.currentPriceUsd).toFixed(2)}</Text>
                </View>
              )}
              {card.currentPriceUsdFoil != null && (
                <View className="flex-row justify-between mb-2">
                  <Text className={isDark ? "text-slate-400" : "text-slate-500"}>Foil</Text>
                  <Text className="text-purple-400">${Number(card.currentPriceUsdFoil).toFixed(2)}</Text>
                </View>
              )}

              {/* Original Prices */}
              {(card.originalPriceUsd || card.originalPriceUsdFoil) && (
                <>
                  <Text className={`text-xs font-medium mb-2 mt-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    ORIGINAL PRICE (WHEN ADDED)
                  </Text>
                  {card.originalPriceUsd != null && (
                    <View className="flex-row justify-between mb-1">
                      <Text className={isDark ? "text-slate-500" : "text-slate-400"}>Regular</Text>
                      <Text className={isDark ? "text-slate-400" : "text-slate-500"}>${Number(card.originalPriceUsd).toFixed(2)}</Text>
                    </View>
                  )}
                  {card.originalPriceUsdFoil != null && (
                    <View className="flex-row justify-between mb-2">
                      <Text className={isDark ? "text-slate-500" : "text-slate-400"}>Foil</Text>
                      <Text className={isDark ? "text-slate-400" : "text-slate-500"}>${Number(card.originalPriceUsdFoil).toFixed(2)}</Text>
                    </View>
                  )}
                </>
              )}

              {/* Totals */}
              <View className={`border-t mt-3 pt-3 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                <View className="flex-row justify-between mb-2">
                  <Text className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}>Current Value</Text>
                  <Text className="text-purple-500 font-bold">${currentValue.toFixed(2)}</Text>
                </View>
                {hasGainLoss && (
                  <>
                    <View className="flex-row justify-between mb-2">
                      <Text className={isDark ? "text-slate-400" : "text-slate-500"}>Original Cost</Text>
                      <Text className={isDark ? "text-slate-400" : "text-slate-500"}>${originalValue.toFixed(2)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                        {gainLoss >= 0 ? "Gain" : "Loss"}
                      </Text>
                      <Text className={`font-bold ${gainLoss >= 0 ? "text-purple-500" : "text-red-500"}`}>
                        {gainLoss >= 0 ? "+" : ""}{gainLoss.toFixed(2)}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Linked Deck */}
          {card.linkedDeckCard && (
            <View className={`rounded-xl p-4 mb-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Linked to Deck
              </Text>
              <View className="flex-row items-center gap-2">
                <View className="h-3 w-3 rounded-full bg-purple-500" />
                <Text className={isDark ? "text-white" : "text-slate-900"}>{card.linkedDeckCard.deckName}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Actions - Fixed at bottom with safe area */}
        <View
          className={`px-4 pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}
          style={{ paddingBottom: Math.max(16, insets.bottom) }}
        >
          <View className="gap-3">
            {hasChanges && (
              <Button
                onPress={handleSave}
                disabled={saving}
                className="py-3"
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold">Save Changes</Text>
                )}
              </Button>
            )}
            <Button
              onPress={handleRemove}
              variant="destructive"
              className="py-3"
            >
              <View className="flex-row items-center gap-2">
                <Trash2 size={18} color="white" />
                <Text className="text-white font-medium">Remove from Collection</Text>
              </View>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ==================== Add Card Modal ====================

function AddCardModal({
  visible,
  onClose,
  onAdd,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (scryfallId: string, quantity: number, foilQuantity: number) => Promise<void>;
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardSearchResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [foilQuantity, setFoilQuantity] = useState(0);
  const [adding, setAdding] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Printing selection state
  const [prints, setPrints] = useState<CardSearchResult[]>([]);
  const [loadingPrints, setLoadingPrints] = useState(false);
  const [selectedCardName, setSelectedCardName] = useState<string | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const result = await cardsApi.search(query);
      if (result.data) {
        setResults(result.data.cards || []);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setSelectedCard(null);
    setSelectedCardName(null);
    setPrints([]);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(text);
    }, 300);
  };

  // When user selects a card from search results, fetch all printings
  const handleSelectCardName = async (card: CardSearchResult) => {
    setSelectedCardName(card.name);
    setLoadingPrints(true);
    Keyboard.dismiss();
    
    try {
      const result = await cardsApi.getPrints(card.name);
      if (result.data) {
        setPrints(result.data);
        // If only one printing, auto-select it
        if (result.data.length === 1) {
          setSelectedCard(result.data[0]);
          setQuantity(1);
          setFoilQuantity(0);
        }
      }
    } catch (err) {
      console.error("Failed to fetch prints:", err);
      // Fallback to just using the selected card
      setPrints([card]);
      setSelectedCard(card);
      setQuantity(1);
      setFoilQuantity(0);
    } finally {
      setLoadingPrints(false);
    }
  };

  const handleSelectPrint = (card: CardSearchResult) => {
    setSelectedCard(card);
    setQuantity(1);
    setFoilQuantity(0);
  };

  const handleBackToSearch = () => {
    setSelectedCardName(null);
    setPrints([]);
    setSelectedCard(null);
  };

  const handleAdd = async () => {
    if (!selectedCard) return;
    setAdding(true);
    try {
      await onAdd(selectedCard.scryfallId, quantity, foilQuantity);
      // Reset state
      setSearchQuery("");
      setResults([]);
      setSelectedCard(null);
      setSelectedCardName(null);
      setPrints([]);
      setQuantity(1);
      setFoilQuantity(0);
      onClose();
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setResults([]);
    setSelectedCard(null);
    setSelectedCardName(null);
    setPrints([]);
    setQuantity(1);
    setFoilQuantity(0);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`} style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          <Text className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
            Add Card
          </Text>
          <Pressable onPress={handleClose} className="rounded-full p-2">
            <X size={24} color={isDark ? "white" : "#1e293b"} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View className="px-4 py-3">
          <View
            className={`flex-row items-center rounded-lg border px-3 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"}`}
          >
            <Search size={18} color={isDark ? "#64748b" : "#94a3b8"} />
            <TextInput
              className={`flex-1 py-2.5 px-2 text-base ${isDark ? "text-white" : "text-slate-900"}`}
              placeholder="Search Scryfall..."
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => handleSearchChange("")}>
                <X size={18} color={isDark ? "#64748b" : "#94a3b8"} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Selected Card Preview */}
        {selectedCard && (
          <View className={`mx-4 mb-3 rounded-xl p-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
            <View className="flex-row gap-4">
              {selectedCard.imageSmall && (
                <Image
                  source={{ uri: selectedCard.imageSmall }}
                  className="h-24 w-16 rounded-lg"
                  resizeMode="cover"
                />
              )}
              <View className="flex-1">
                <Text className={`font-bold text-base ${isDark ? "text-white" : "text-slate-900"}`} numberOfLines={2}>
                  {selectedCard.name}
                </Text>
                <Text className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {selectedCard.setName}
                </Text>
                {selectedCard.priceUsd && (
                  <Text className="text-purple-500 text-sm mt-1">${selectedCard.priceUsd}</Text>
                )}
              </View>
            </View>

            {/* Quantity Controls */}
            <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
              <View className="flex-row items-center gap-4">
                <View className="items-center">
                  <Text className={`text-xs mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Regular</Text>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => setQuantity(Math.max(0, quantity - 1))}
                      className={`rounded-full p-1.5 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                    >
                      <Minus size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                    </Pressable>
                    <Text className={`text-lg font-bold w-6 text-center ${isDark ? "text-white" : "text-slate-900"}`}>
                      {quantity}
                    </Text>
                    <Pressable
                      onPress={() => setQuantity(quantity + 1)}
                      className={`rounded-full p-1.5 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                    >
                      <Plus size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                    </Pressable>
                  </View>
                </View>

                <View className="items-center">
                  <View className="flex-row items-center gap-1 mb-1">
                    <Sparkles size={12} color="#a855f7" />
                    <Text className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Foil</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => setFoilQuantity(Math.max(0, foilQuantity - 1))}
                      className={`rounded-full p-1.5 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                    >
                      <Minus size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                    </Pressable>
                    <Text className={`text-lg font-bold w-6 text-center ${isDark ? "text-white" : "text-slate-900"}`}>
                      {foilQuantity}
                    </Text>
                    <Pressable
                      onPress={() => setFoilQuantity(foilQuantity + 1)}
                      className={`rounded-full p-1.5 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                    >
                      <Plus size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                    </Pressable>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={handleAdd}
                disabled={adding || (quantity === 0 && foilQuantity === 0)}
                className={`rounded-lg px-4 py-2 ${
                  quantity === 0 && foilQuantity === 0 ? "bg-slate-600" : "bg-purple-500"
                }`}
              >
                {adding ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-semibold">Add</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* Printing Selection or Search Results */}
        {selectedCardName ? (
          // Show printings for selected card
          <>
            {/* Back button and card name header */}
            <View className={`flex-row items-center gap-3 px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
              <Pressable onPress={handleBackToSearch} className="p-1">
                <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              </Pressable>
              <View className="flex-1">
                <Text className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`} numberOfLines={1}>
                  {selectedCardName}
                </Text>
                <Text className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {prints.length} printing{prints.length !== 1 ? 's' : ''} available
                </Text>
              </View>
            </View>

            {loadingPrints ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text className={`mt-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Loading printings...
                </Text>
              </View>
            ) : (
              <FlatList
                data={prints}
                keyExtractor={(item) => item.scryfallId}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom) }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleSelectPrint(item)}
                    className={`flex-row items-center gap-3 py-3 px-4 border-b ${
                      selectedCard?.scryfallId === item.scryfallId
                        ? isDark
                          ? "bg-purple-900/30 border-purple-700"
                          : "bg-purple-50 border-purple-200"
                        : isDark
                          ? "border-slate-800 active:bg-slate-800/50"
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
                      <View className={`h-16 w-12 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
                    )}
                    <View className="flex-1">
                      <Text
                        className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                        numberOfLines={1}
                      >
                        {item.setName}
                      </Text>
                      <Text className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {item.setCode?.toUpperCase()} • #{item.collectorNumber}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        <Text className={`text-xs capitalize ${
                          item.rarity === 'mythic' ? 'text-orange-500' :
                          item.rarity === 'rare' ? 'text-yellow-500' :
                          item.rarity === 'uncommon' ? 'text-slate-400' :
                          'text-slate-500'
                        }`}>
                          {item.rarity}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      {item.priceUsd && (
                        <Text className="text-purple-500 text-sm font-medium">${item.priceUsd}</Text>
                      )}
                      {item.priceUsdFoil && (
                        <Text className="text-purple-400 text-xs">Foil: ${item.priceUsdFoil}</Text>
                      )}
                    </View>
                    {selectedCard?.scryfallId === item.scryfallId && (
                      <CheckCircle size={20} color="#7C3AED" />
                    )}
                  </Pressable>
                )}
              />
            )}
          </>
        ) : loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : searchQuery.length < 2 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Search size={48} color={isDark ? "#334155" : "#cbd5e1"} />
            <Text className={`mt-4 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Search for cards by name
            </Text>
            <Text className={`text-sm mt-1 text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Type at least 2 characters
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className={`text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              No cards found for "{searchQuery}"
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.scryfallId}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom) }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelectCardName(item)}
                className={`flex-row items-center gap-3 py-3 px-4 border-b ${
                  isDark
                    ? "border-slate-800 active:bg-slate-800/50"
                    : "border-slate-100 active:bg-slate-50"
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
                    {item.typeLine}
                  </Text>
                </View>
                <Text className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Select printing →
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

// ==================== Bulk Import Modal ====================

function BulkImportModal({
  visible,
  onClose,
  onImport,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onImport: () => void;
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [autoLink, setAutoLink] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    linked: number;
    errors: Array<{ line: string; error: string }>;
  } | null>(null);

  const filterLines = (lines: string[]) => {
    return lines.filter((l) => {
      const trimmed = l.trim();
      // Filter out blank lines and commented lines (# or //)
      return trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("//");
    });
  };

  const lineCount = filterLines(text.split("\n")).length;

  const handleImport = async () => {
    const lines = filterLines(text.split("\n"));
    if (lines.length === 0) return;

    setImporting(true);
    setResult(null);

    try {
      const response = await collectionApi.bulkImport(lines, { autoLink });
      if (response.error) {
        showToast.error(response.error);
      } else if (response.data) {
        setResult(response.data);
        if (response.data.imported > 0 && response.data.errors.length === 0) {
          setText("");
        }
        onImport();
      }
    } catch (err) {
      showToast.error("Failed to import cards");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setText("");
    setResult(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`} style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          <View className="flex-row items-center gap-2">
            <FileText size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            <Text className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Bulk Import
            </Text>
          </View>
          <Pressable onPress={handleClose} className="rounded-full p-2">
            <X size={24} color={isDark ? "white" : "#1e293b"} />
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: Math.max(16, insets.bottom + 16) }}>
          {/* Instructions */}
          <View className={`rounded-xl p-4 mb-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
            <Text className={`text-sm font-medium mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
              Format
            </Text>
            <Text className={`text-sm mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              One card per line in the format:
            </Text>
            <View className={`rounded-lg p-3 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
              <Text className={`font-mono text-xs ${isDark ? "text-purple-400" : "text-purple-600"}`}>
                {"<count> <name> (<set>) <number>"}
              </Text>
            </View>
            <Text className={`text-xs mt-3 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Example:{"\n"}4 Lightning Bolt (M10) 146{"\n"}2 Counterspell (ICE) 64{"\n"}1 Sol Ring (C21) 263{"\n\n"}
              Blank lines and comments (# or //) are ignored.
            </Text>
          </View>

          {/* Text Input */}
          <View className={`rounded-xl overflow-hidden mb-4 border ${isDark ? "border-slate-700" : "border-slate-200"}`}>
            <TextInput
              className={`min-h-[200px] p-4 text-sm font-mono ${isDark ? "bg-slate-800 text-white" : "bg-white text-slate-900"}`}
              placeholder="Paste your card list here..."
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Options */}
          <Pressable
            onPress={() => setAutoLink(!autoLink)}
            className={`flex-row items-center justify-between rounded-xl p-4 mb-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
          >
            <Text className={isDark ? "text-white" : "text-slate-900"}>Auto-link to decks</Text>
            <View className={`h-6 w-11 rounded-full ${autoLink ? "bg-purple-500" : isDark ? "bg-slate-700" : "bg-slate-300"}`}>
              <View
                className={`h-5 w-5 mt-0.5 rounded-full bg-white shadow ${autoLink ? "ml-5" : "ml-0.5"}`}
              />
            </View>
          </Pressable>

          {/* Result */}
          {result && (
            <View className={`rounded-xl p-4 mb-4 ${result.errors.length === 0 ? "bg-purple-900/30" : "bg-amber-900/30"}`}>
              <View className="flex-row items-center gap-2 mb-2">
                {result.errors.length === 0 ? (
                  <CheckCircle size={20} color="#7C3AED" />
                ) : (
                  <XCircle size={20} color="#f59e0b" />
                )}
                <Text className={`font-medium ${result.errors.length === 0 ? "text-purple-400" : "text-amber-400"}`}>
                  {result.errors.length === 0
                    ? `Successfully imported ${result.imported} card${result.imported !== 1 ? "s" : ""}${result.linked > 0 ? ` and linked ${result.linked}` : ""}`
                    : `Imported ${result.imported} card${result.imported !== 1 ? "s" : ""} with ${result.errors.length} error${result.errors.length !== 1 ? "s" : ""}`}
                </Text>
              </View>
              {result.errors.length > 0 && (
                <ScrollView className="max-h-32">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <Text key={i} className="text-red-400 text-xs mb-1">
                      {err.line}: {err.error}
                    </Text>
                  ))}
                  {result.errors.length > 10 && (
                    <Text className="text-slate-400 text-xs italic">
                      ...and {result.errors.length - 10} more errors
                    </Text>
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {/* Import Button */}
          <Pressable
            onPress={handleImport}
            disabled={importing || lineCount === 0}
            className={`rounded-xl py-4 items-center ${lineCount === 0 ? "bg-slate-600" : "bg-purple-500"}`}
          >
            {importing ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white font-semibold">Importing...</Text>
              </View>
            ) : (
              <Text className="text-white font-semibold">
                Import {lineCount > 0 ? `${lineCount} Line${lineCount !== 1 ? "s" : ""}` : "Cards"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function CollectionScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const navigation = useNavigation();
  const { isDesktop } = useResponsive();

  const [cards, setCards] = useState<(CollectionCard | null)[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set());
  const pageSize = 50;

  // Modal states
  const [selectedCard, setSelectedCard] = useState<CollectionCard | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [bulkImportModalVisible, setBulkImportModalVisible] = useState(false);
  const [scryfallSearchVisible, setScryfallSearchVisible] = useState(false);
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  // Compute existing card IDs for visual indicators in search
  const existingCardIds = useMemo(() => {
    const ids = new Set<string>();
    for (const card of cards) {
      if (card) {
        ids.add(card.scryfallId);
      }
    }
    return ids;
  }, [cards]);

  const handleCardPress = useCallback((card: CollectionCard) => {
    setSelectedCard(card);
    setDetailModalVisible(true);
  }, []);

  const handleUpdateCard = async (id: string, quantity: number, foilQuantity: number) => {
    const result = await collectionApi.update(id, { quantity, foilQuantity });
    if (result.error) {
      showToast.error(result.error);
      return;
    }
    // Update local state
    setCards((prev) =>
      prev.map((c) =>
        c && c.id === id ? { ...c, quantity, foilQuantity } : c
      )
    );
    // Clear cache and refresh stats
    cache.remove(CACHE_KEYS.COLLECTION_STATS);
    loadStats();
  };

  const handleRemoveCard = async (id: string) => {
    const result = await collectionApi.remove(id);
    if (result.error) {
      showToast.error(result.error);
      return;
    }

    // Reload collection and stats
    cache.remove(CACHE_KEYS.COLLECTION_STATS);
    loadCollection(true, searchQuery);
    loadStats();
  };

  const handleRequestDelete = (card: CollectionCard) => {
    setConfirmDialog({
      visible: true,
      title: "Remove Card",
      message: `Remove "${card.name}" from your collection?`,
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, visible: false }));
        handleRemoveCard(card.id);
      },
    });
  };

  const handleAddCard = async (scryfallId: string, quantity: number, foilQuantity: number) => {
    const result = await collectionApi.add(scryfallId, quantity, foilQuantity);
    if (result.error) {
      showToast.error(result.error);
      return false;
    }
    // Refresh the collection
    cache.remove(CACHE_KEYS.COLLECTION_STATS);
    loadCollection(true, searchQuery);
    loadStats();
    return true;
  };

  const handleAddCardFromSearch = useCallback(
    async (card: CardSearchResult) => {
      const success = await handleAddCard(card.scryfallId, 1, 0);
      if (success) {
        showToast.success(`Added ${card.name} to collection`);
      }
    },
    [handleAddCard],
  );

  const loadPage = useCallback(
    async (pageNum: number, search?: string) => {
      // Don't load if already loaded or loading
      if (loadedPages.has(pageNum) || loadingPages.has(pageNum)) {
        return;
      }

      setLoadingPages((prev) => new Set(prev).add(pageNum));

      try {
        const result = await collectionApi.list({
          page: pageNum,
          pageSize,
          search: search || undefined,
        });

        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          // Insert cards at the correct position
          setCards((prev) => {
            const newCards = [...prev];
            const startIndex = (pageNum - 1) * pageSize;
            result.data.data.forEach((card, index) => {
              newCards[startIndex + index] = card;
            });
            return newCards;
          });

          setLoadedPages((prev) => new Set(prev).add(pageNum));
        }
      } catch (err) {
        console.error("Failed to load page:", err);
      } finally {
        setLoadingPages((prev) => {
          const next = new Set(prev);
          next.delete(pageNum);
          return next;
        });
      }
    },
    [loadedPages, loadingPages, pageSize]
  );

  const loadCollection = useCallback(
    async (reset = false, search?: string) => {
      try {
        setError(null);
        setLoading(true);

        // Load first page to get total count
        const result = await collectionApi.list({
          page: 1,
          pageSize,
          search: search || undefined,
        });

        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          const total = result.data.total;
          setTotalCount(total);

          // Create array with placeholders
          const placeholders = new Array(total).fill(null);

          // Insert first page data
          result.data.data.forEach((card, index) => {
            placeholders[index] = card;
          });

          setCards(placeholders);
          setLoadedPages(new Set([1]));
          setLoadingPages(new Set());
        }
      } catch (err) {
        setError("Failed to load collection");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pageSize]
  );

  const loadStats = useCallback(async () => {
    const result = await cachedFetch(
      CACHE_KEYS.COLLECTION_STATS,
      CACHE_TTL.COLLECTION_STATS,
      () => collectionApi.getStats()
    );
    if (result.data) {
      setStats(result.data);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    cache.remove(CACHE_KEYS.COLLECTION_STATS);
    loadCollection(true, searchQuery);
    loadStats();
  }, [loadCollection, loadStats, searchQuery]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: any[] }) => {
      // Find which pages are visible
      const visiblePages = new Set<number>();
      viewableItems.forEach((item) => {
        if (item.index !== null && item.index !== undefined) {
          const pageNum = Math.floor(item.index / pageSize) + 1;
          visiblePages.add(pageNum);
          // Prefetch adjacent pages
          if (pageNum > 1) visiblePages.add(pageNum - 1);
          visiblePages.add(pageNum + 1);
        }
      });

      // Load visible pages
      visiblePages.forEach((pageNum) => {
        const totalPages = Math.ceil(totalCount / pageSize);
        if (pageNum <= totalPages) {
          loadPage(pageNum, searchQuery);
        }
      });
    },
    [loadPage, pageSize, searchQuery, totalCount]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 0,
    minimumViewTime: 100,
  }).current;

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setLoading(true);
    loadCollection(true, query);
  };

  useEffect(() => {
    loadCollection(true);
    loadStats();

    cache.get<"list" | "grid">(CACHE_KEYS.VIEW_MODE).then((mode) => {
      if (mode) setViewMode(mode);
    });
  }, []);

  const toggleViewMode = () => {
    const newMode = viewMode === "list" ? "grid" : "list";
    setViewMode(newMode);
    cache.set(CACHE_KEYS.VIEW_MODE, newMode, 60 * 24 * 30);
  };

  // Memoized render callbacks for better performance
  const renderListItem = useCallback(
    ({ item }: { item: CollectionCard | null }) => {
      if (!item) {
        // Placeholder/skeleton while loading
        return (
          <View
            className={`flex-row items-center gap-3 py-3 px-4 border-b ${
              isDark ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-white"
            }`}
          >
            <View className={`h-12 w-9 rounded ${isDark ? "bg-slate-800 animate-pulse" : "bg-slate-200 animate-pulse"}`} />
            <View className="flex-1">
              <View className={`h-4 rounded mb-2 ${isDark ? "bg-slate-800 animate-pulse" : "bg-slate-200 animate-pulse"}`} style={{ width: "60%" }} />
              <View className={`h-3 rounded ${isDark ? "bg-slate-800 animate-pulse" : "bg-slate-200 animate-pulse"}`} style={{ width: "40%" }} />
            </View>
          </View>
        );
      }

      return (
        <CollectionListItem
          card={item}
          isDark={isDark}
          onPress={() => handleCardPress(item)}
          onDelete={handleRemoveCard}
          onRequestDelete={handleRequestDelete}
        />
      );
    },
    [isDark, handleCardPress, handleRemoveCard, handleRequestDelete],
  );

  const renderGridItem = useCallback(
    ({ item }: { item: CollectionCard | null }) => {
      if (!item) {
        // Placeholder/skeleton while loading
        return (
          <View className="flex-1 p-1" style={{ maxWidth: "33.33%" }}>
            <View className={`aspect-[488/680] w-full rounded-lg ${isDark ? "bg-slate-800 animate-pulse" : "bg-slate-200 animate-pulse"}`} />
          </View>
        );
      }

      return (
        <CollectionGridItem
          card={item}
          isDark={isDark}
          onPress={() => handleCardPress(item)}
        />
      );
    },
    [isDark, handleCardPress],
  );

  // getItemLayout for list view - enables true virtual scrolling
  const getListItemLayout = useCallback(
    (_data: ArrayLike<CollectionCard | null> | null | undefined, index: number) => ({
      length: LIST_ITEM_HEIGHT,
      offset: LIST_ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const onViewableItemsChangedRef = useRef(onViewableItemsChanged);
  useEffect(() => {
    onViewableItemsChangedRef.current = onViewableItemsChanged;
  }, [onViewableItemsChanged]);

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-6">
      <Text
        className={`mb-2 text-xl font-semibold ${
          isDark ? "text-white" : "text-slate-900"
        }`}
      >
        {searchQuery ? "No Cards Found" : "Empty Collection"}
      </Text>
      <Text
        className={`mb-6 text-center ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}
      >
        {searchQuery
          ? "Try a different search term"
          : "Add cards to your collection to track what you own"}
      </Text>
    </View>
  );

  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
      {/* Header */}
      <View className={`flex-row items-center justify-between px-4 lg:px-6 py-3 ${!isDesktop ? 'border-b border-slate-800' : ''}`}>
        <View className="flex-row items-center gap-3">
          {!isDesktop && (
            <Pressable
              onPress={openDrawer}
              className={`rounded-full p-2 ${
                isDark ? "active:bg-slate-800" : "active:bg-slate-100"
              }`}
            >
              <Menu size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          )}
          <Text
            className={`text-2xl font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Collection
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setScryfallSearchVisible(true)}
            className={`rounded-full p-2 ${
              isDark ? "active:bg-slate-800" : "active:bg-slate-100"
            }`}
          >
            <Plus size={20} color={isDark ? "#94a3b8" : "#64748b"} />
          </Pressable>
          <Pressable
            onPress={() => setBulkImportModalVisible(true)}
            className={`rounded-full p-2 ${
              isDark ? "active:bg-slate-800" : "active:bg-slate-100"
            }`}
          >
            <FileText size={20} color={isDark ? "#94a3b8" : "#64748b"} />
          </Pressable>
          <Pressable
            onPress={toggleViewMode}
            className={`rounded-full p-2 ${
              isDark ? "active:bg-slate-800" : "active:bg-slate-100"
            }`}
          >
            {viewMode === "list" ? (
              <Grid3X3 size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            ) : (
              <List size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            )}
          </Pressable>
        </View>
      </View>

      {/* Search Bar */}
      <View className="px-4 pb-3">
        <View
          className={`flex-row items-center rounded-lg border px-3 ${
            searchFocused
              ? "border-purple-500"
              : isDark
                ? "border-slate-700"
                : "border-slate-200"
          } ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
        >
          <Search size={18} color={isDark ? "#64748b" : "#94a3b8"} />
          <TextInput
            className={`flex-1 py-2.5 px-2 text-base ${
              isDark ? "text-white" : "text-slate-900"
            }`}
            placeholder="Search cards..."
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => handleSearch("")}>
              <X size={18} color={isDark ? "#64748b" : "#94a3b8"} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Stats Header */}
      <StatsHeader stats={stats} isDark={isDark} />

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text
            className={`mb-4 text-center ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {error}
          </Text>
          <Pressable
            onPress={handleRefresh}
            className="rounded-lg bg-purple-500 px-4 py-2"
          >
            <Text className="font-medium text-white">Retry</Text>
          </Pressable>
        </View>
      ) : cards.length === 0 ? (
        renderEmptyState()
      ) : viewMode === "list" ? (
        <FlatList
          key="list"
          data={cards}
          keyExtractor={(item, index) => item?.id || `placeholder-${index}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#7C3AED"
            />
          }
          renderItem={renderListItem}
          getItemLayout={getListItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          // Virtual scrolling optimizations
          windowSize={21}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={15}
          removeClippedSubviews={true}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="w-full max-w-content mx-auto px-3 lg:px-6 pb-24"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#7C3AED"
            />
          }
        >
          <View className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {cards.map((card, index) =>
              card ? (
                <CollectionGridItem
                  key={card.id}
                  card={card}
                  isDark={isDark}
                  onPress={() => handleCardPress(card)}
                />
              ) : (
                <View key={`placeholder-${index}`} className="flex-1 p-1" style={{ maxWidth: "33.33%" }}>
                  <View className={`aspect-[488/680] w-full rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                </View>
              )
            )}
          </View>
        </ScrollView>
      )}

      {/* FAB - Add Card Button */}
      {!isDesktop && (
        <Pressable
          onPress={() => setAddModalVisible(true)}
          className="absolute bottom-6 right-6 h-14 w-14 rounded-full bg-purple-500 items-center justify-center shadow-lg"
          style={{
            shadowColor: "#7C3AED",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Plus size={28} color="white" />
        </Pressable>
      )}

      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCard}
        visible={detailModalVisible}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedCard(null);
        }}
        onUpdate={handleUpdateCard}
        onRemove={handleRemoveCard}
        onRequestRemove={handleRequestDelete}
        isDark={isDark}
      />

      {/* Add Card Modal */}
      <AddCardModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleAddCard}
        isDark={isDark}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        visible={bulkImportModalVisible}
        onClose={() => setBulkImportModalVisible(false)}
        onImport={() => {
          cache.remove(CACHE_KEYS.COLLECTION_STATS);
          loadCollection(true, searchQuery);
          loadStats();
        }}
        isDark={isDark}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Remove"
        cancelText="Cancel"
        destructive={true}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() =>
          setConfirmDialog((prev) => ({ ...prev, visible: false }))
        }
      />

      {/* Scryfall Search */}
      <ScryfallSearch
        visible={scryfallSearchVisible}
        onClose={() => setScryfallSearchVisible(false)}
        onSelectCard={handleAddCardFromSearch}
        title="Add Card to Collection"
        placeholder="Search for a card..."
        searchContext="collection"
        existingCardIds={existingCardIds}
      />

    </SafeAreaView>
  );
}
