import { BottomSheetTextInput, BottomSheetView } from "@gorhom/bottom-sheet";
import { useNavigation } from "expo-router";
import {
  Camera,
  Check,
  CheckCircle,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  ArrowDownAZ,
  Calendar,
  DollarSign,
  Grid3X3,
  Inbox,
  Library,
  List,
  Layers,
  Minus,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash2,
  X,
  XCircle,
} from "lucide-react-native";
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
  Animated,
  Dimensions,
  FlatList,
  Image,
  InteractionManager,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { DonutChart, getSegmentColor } from "~/components/DonutChart";
import { KEYBOARD_ACCESSORY_ID } from "~/components/ui/KeyboardDoneAccessory";
import { CardScanner } from "~/components/camera/CardScanner";
import { ScryfallSearch } from "~/components/ScryfallSearch";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { GlassFab } from "~/components/ui/GlassFab";
import { GlassSheet } from "~/components/ui/GlassSheet";
import { ImportSettings, type ImportSettingsValue } from "~/components/ui/ImportSettings";
import { Button } from "~/components/ui/button";
import {
  cardsApi,
  collectionApi,
  type CardSearchResult,
  type CollectionCard,
  type CollectionFolder,
  type CollectionStats,
  type DeckGroup,
} from "~/lib/api";
import { cache, CACHE_KEYS } from "~/lib/cache";
import { showToast } from "~/lib/toast";
import { useResponsive } from "~/hooks/useResponsive";
import { HeaderButton } from "~/components/ui/HeaderButton";

// Platform detection
const isWeb = Platform.OS === "web";
const isIOS = Platform.OS === "ios";

// Fixed item heights for virtual scrolling
const LIST_ITEM_HEIGHT = 73; // py-3 (24px) + image h-12 (48px) + border (1px)

function CollectionListItem({
  card,
  isDark,
  onPress,
  onRequestDelete,
  selectionMode,
  isSelected,
  onLongPress,
  onToggleSelect,
  onShowLinkedDecks,
}: {
  card: CollectionCard;
  isDark: boolean;
  onPress?: () => void;
  onRequestDelete?: (card: CollectionCard) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onLongPress?: () => void;
  onToggleSelect?: () => void;
  onShowLinkedDecks?: (cardName: string, decks: Array<{ deckId: string; deckName: string }>) => void;
}) {
  const totalQty = card.quantity + card.foilQuantity;
  // Use current prices for display
  const price = card.currentPriceUsd ? card.currentPriceUsd * card.quantity : 0;
  const foilPrice = card.currentPriceUsdFoil
    ? card.currentPriceUsdFoil * card.foilQuantity
    : 0;
  const currentValue = price + foilPrice;

  // Calculate original value for comparison
  const origPrice = card.originalPriceUsd
    ? card.originalPriceUsd * card.quantity
    : 0;
  const origFoilPrice = card.originalPriceUsdFoil
    ? card.originalPriceUsdFoil * card.foilQuantity
    : 0;
  const originalValue = origPrice + origFoilPrice;

  const gainLoss = currentValue - originalValue;
  const hasGainLoss = originalValue > 0 && currentValue > 0;

  const handleDelete = () => {
    onRequestDelete?.(card);
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
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

  const longPressedRef = useRef(false);

  const cardContent = (
    <Pressable
      onPress={() => {
        if (longPressedRef.current) {
          longPressedRef.current = false;
          return;
        }
        (selectionMode ? onToggleSelect : onPress)?.();
      }}
      onLongPress={!selectionMode ? () => {
        longPressedRef.current = true;
        onLongPress?.();
      } : undefined}
      className={`flex-row items-center gap-3 py-3 px-4 border-b ${
        isSelected
          ? isDark
            ? "border-purple-800 bg-purple-900/20"
            : "border-purple-200 bg-purple-50"
          : isDark
            ? "border-slate-800 active:bg-slate-800/50 bg-slate-950"
            : "border-slate-100 active:bg-slate-50 bg-white"
      }`}
    >
      {selectionMode && (
        <View className="mr-1">
          {isSelected ? (
            <CheckSquare size={22} color="#7C3AED" />
          ) : (
            <Square size={22} color={isDark ? "#475569" : "#94a3b8"} />
          )}
        </View>
      )}
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
          {card.linkedDeckCards && card.linkedDeckCards.length > 0 && (
            card.linkedDeckCards.length === 1 ? (
              <View className="flex-row items-center gap-1">
                <View className="h-2 w-2 rounded-full bg-purple-500" />
                <Text className="text-xs text-purple-500">
                  {card.linkedDeckCards[0].deckName}
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onShowLinkedDecks?.(card.name || "", card.linkedDeckCards!);
                }}
                className="flex-row items-center gap-1"
                hitSlop={8}
              >
                <View className="h-2 w-2 rounded-full bg-purple-500" />
                <Text className="text-xs text-purple-500 underline">
                  Many
                </Text>
              </Pressable>
            )
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
          <Text
            className={`text-xs ${gainLoss >= 0 ? "text-purple-400" : "text-red-400"}`}
          >
            {gainLoss >= 0 ? "+" : ""}
            {gainLoss.toFixed(2)}
          </Text>
        )}
      </View>
    </Pressable>
  );

  if (selectionMode) {
    return cardContent;
  }

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      {cardContent}
    </Swipeable>
  );
}

function CollectionGridItem({
  card,
  isDark,
  isDesktopView,
  onPress,
  selectionMode,
  isSelected,
  onLongPress,
  onToggleSelect,
  columns,
}: {
  card: CollectionCard;
  isDark: boolean;
  isDesktopView?: boolean;
  onPress?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onLongPress?: () => void;
  onToggleSelect?: () => void;
  columns?: number;
}) {
  const totalQty = card.quantity + card.foilQuantity;
  const [hovered, setHovered] = useState(false);
  const longPressedRef = useRef(false);

  return (
    <Pressable
      onPress={() => {
        if (longPressedRef.current) {
          longPressedRef.current = false;
          return;
        }
        (selectionMode ? onToggleSelect : onPress)?.();
      }}
      onLongPress={!selectionMode ? () => {
        longPressedRef.current = true;
        onLongPress?.();
      } : undefined}
      // @ts-ignore - onMouseEnter/Leave valid on web
      onMouseEnter={isWeb && isDesktopView ? () => setHovered(true) : undefined}
      // @ts-ignore
      onMouseLeave={
        isWeb && isDesktopView ? () => setHovered(false) : undefined
      }
      className="p-1"
      style={columns ? { width: `${100 / columns}%` } : { flex: 1 }}
    >
      <View
        className="relative"
        style={
          isWeb && isDesktopView
            ? {
                // @ts-ignore - web CSS
                transition: "transform 150ms ease",
                transform: hovered ? [{ scale: 1.05 }] : [{ scale: 1 }],
                zIndex: hovered ? 10 : 0,
              }
            : undefined
        }
      >
        {card.imageUrl ? (
          <Image
            source={{ uri: card.imageUrl }}
            className="aspect-[488/680] w-full rounded-lg"
            resizeMode="cover"
            style={isSelected ? { opacity: 0.7 } : undefined}
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
        {card.linkedDeckCards && card.linkedDeckCards.length > 0 && !selectionMode && (
          <View className="absolute bottom-1 left-1 h-3 w-3 rounded-full bg-purple-500 border border-white" />
        )}
        {selectionMode && (
          <View className="absolute top-1 left-1">
            {isSelected ? (
              <View className="h-6 w-6 rounded-full bg-purple-500 items-center justify-center">
                <Check size={14} color="white" strokeWidth={3} />
              </View>
            ) : (
              <View className="h-6 w-6 rounded-full border-2 border-white/70 bg-black/30" />
            )}
          </View>
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
      <View
        className={`flex-row justify-between pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}
      >
        <View>
          <Text
            className={`text-lg font-semibold ${
              isDark ? "text-slate-300" : "text-slate-700"
            }`}
          >
            ${originalValue.toFixed(2)}
          </Text>
          <Text
            className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
            Original Cost
          </Text>
        </View>
        <View className="items-end">
          <Text className={`text-lg font-bold ${gainLossColor}`}>
            {gainLossSign}${Math.abs(gainLoss).toFixed(2)}
          </Text>
          <Text
            className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
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
  onUpdate: (
    id: string,
    quantity: number,
    foilQuantity: number,
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onRequestRemove?: (card: CollectionCard) => void;
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
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

  // Use desktop dialog layout for web desktop
  const useDesktopLayout = isWeb && isDesktop;

  const hasChanges =
    quantity !== card.quantity || foilQuantity !== card.foilQuantity;

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

  // Calculate card image dimensions based on platform
  const cardImageWidth = useDesktopLayout
    ? 320
    : isWeb
      ? Math.min(400, Dimensions.get("window").width - 80)
      : Dimensions.get("window").width - 80;
  const cardImageHeight = cardImageWidth * (680 / 488);

  // Header component
  const header = (
    <View
      className={`flex-row items-center justify-between px-4 ${isWeb ? "pt-4" : isIOS ? "pt-2" : ""} py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
    >
      <View className="flex-1">
        <Text
          className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}
          numberOfLines={1}
        >
          {card.name}
        </Text>
        <Text
          className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          {card.setName} • #{card.collectorNumber}
        </Text>
      </View>
      <Pressable onPress={onClose} className="rounded-full p-2 ml-2">
        <X size={24} color={isDark ? "white" : "#1e293b"} />
      </Pressable>
    </View>
  );

  // Card image component
  const cardImage = (
    <View className={useDesktopLayout ? "" : "items-center mb-6"}>
      {card.imageUrl ? (
        <Image
          source={{ uri: card.imageUrl }}
          style={{
            width: cardImageWidth,
            height: cardImageHeight,
            borderRadius: 12,
          }}
          resizeMode="contain"
        />
      ) : (
        <View
          className={`rounded-xl items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
          style={{
            width: cardImageWidth,
            height: cardImageHeight,
          }}
        >
          <Text
            className={`text-lg ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
            {card.name}
          </Text>
        </View>
      )}
    </View>
  );

  // Card details component (quantity, price, linked deck)
  const cardDetails = (
    <>
      {/* Quantity Controls */}
      <View
        className={`rounded-xl p-4 mb-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
      >
        <Text
          className={`text-sm font-medium mb-4 ${isDark ? "text-slate-300" : "text-slate-700"}`}
        >
          Quantity
        </Text>

        {/* Regular Quantity */}
        <View className="flex-row items-center justify-between mb-4">
          <Text
            className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}
          >
            Regular
          </Text>
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => setQuantity(Math.max(0, quantity - 1))}
              className={`rounded-full p-2 ${isDark ? "bg-slate-800 active:bg-slate-700" : "bg-slate-200 active:bg-slate-300"}`}
            >
              <Minus size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
            <Text
              className={`text-xl font-bold w-10 text-center ${isDark ? "text-white" : "text-slate-900"}`}
            >
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
            <Text
              className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Foil
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => setFoilQuantity(Math.max(0, foilQuantity - 1))}
              className={`rounded-full p-2 ${isDark ? "bg-slate-800 active:bg-slate-700" : "bg-slate-200 active:bg-slate-300"}`}
            >
              <Minus size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
            <Text
              className={`text-xl font-bold w-10 text-center ${isDark ? "text-white" : "text-slate-900"}`}
            >
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
      {(card.currentPriceUsd ||
        card.currentPriceUsdFoil ||
        card.originalPriceUsd ||
        card.originalPriceUsdFoil) && (
        <View
          className={`rounded-xl p-4 mb-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
        >
          <Text
            className={`text-sm font-medium mb-3 ${isDark ? "text-slate-300" : "text-slate-700"}`}
          >
            Price Information
          </Text>

          {/* Current Prices */}
          <Text
            className={`text-xs font-medium mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            CURRENT MARKET PRICE
          </Text>
          {card.currentPriceUsd != null && (
            <View className="flex-row justify-between mb-1">
              <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
                Regular
              </Text>
              <Text className={isDark ? "text-white" : "text-slate-900"}>
                ${Number(card.currentPriceUsd).toFixed(2)}
              </Text>
            </View>
          )}
          {card.currentPriceUsdFoil != null && (
            <View className="flex-row justify-between mb-2">
              <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
                Foil
              </Text>
              <Text className="text-purple-400">
                ${Number(card.currentPriceUsdFoil).toFixed(2)}
              </Text>
            </View>
          )}

          {/* Original Prices */}
          {(card.originalPriceUsd || card.originalPriceUsdFoil) && (
            <>
              <Text
                className={`text-xs font-medium mb-2 mt-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                ORIGINAL PRICE (WHEN ADDED)
              </Text>
              {card.originalPriceUsd != null && (
                <View className="flex-row justify-between mb-1">
                  <Text
                    className={isDark ? "text-slate-500" : "text-slate-400"}
                  >
                    Regular
                  </Text>
                  <Text
                    className={isDark ? "text-slate-400" : "text-slate-500"}
                  >
                    ${Number(card.originalPriceUsd).toFixed(2)}
                  </Text>
                </View>
              )}
              {card.originalPriceUsdFoil != null && (
                <View className="flex-row justify-between mb-2">
                  <Text
                    className={isDark ? "text-slate-500" : "text-slate-400"}
                  >
                    Foil
                  </Text>
                  <Text
                    className={isDark ? "text-slate-400" : "text-slate-500"}
                  >
                    ${Number(card.originalPriceUsdFoil).toFixed(2)}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Totals */}
          <View
            className={`border-t mt-3 pt-3 ${isDark ? "border-slate-800" : "border-slate-200"}`}
          >
            <View className="flex-row justify-between mb-2">
              <Text
                className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Current Value
              </Text>
              <Text className="text-purple-500 font-bold">
                ${currentValue.toFixed(2)}
              </Text>
            </View>
            {hasGainLoss && (
              <>
                <View className="flex-row justify-between mb-2">
                  <Text
                    className={isDark ? "text-slate-400" : "text-slate-500"}
                  >
                    Original Cost
                  </Text>
                  <Text
                    className={isDark ? "text-slate-400" : "text-slate-500"}
                  >
                    ${originalValue.toFixed(2)}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text
                    className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    {gainLoss >= 0 ? "Gain" : "Loss"}
                  </Text>
                  <Text
                    className={`font-bold ${gainLoss >= 0 ? "text-purple-500" : "text-red-500"}`}
                  >
                    {gainLoss >= 0 ? "+" : ""}
                    {gainLoss.toFixed(2)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Linked Decks */}
      {card.linkedDeckCards && card.linkedDeckCards.length > 0 && (
        <View
          className={`rounded-xl p-4 mb-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
        >
          <Text
            className={`text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}
          >
            {card.linkedDeckCards.length === 1 ? "Linked to Deck" : "Linked to Decks"}
          </Text>
          {card.linkedDeckCards.map((link) => (
            <View key={link.deckId} className="flex-row items-center gap-2 mb-1">
              <View className="h-3 w-3 rounded-full bg-purple-500" />
              <Text className={isDark ? "text-white" : "text-slate-900"}>
                {link.deckName}
              </Text>
            </View>
          ))}
        </View>
      )}
    </>
  );

  // Content component - combines image and details based on layout
  const content = (
    <ScrollView
      className="flex-1"
      contentContainerStyle={
        useDesktopLayout
          ? { padding: 16, paddingBottom: 16, flexDirection: "row", gap: 24 }
          : { padding: 16 }
      }
    >
      {useDesktopLayout ? (
        <>
          {cardImage}
          <View className="flex-1">{cardDetails}</View>
        </>
      ) : (
        <>
          {cardImage}
          {cardDetails}
        </>
      )}
    </ScrollView>
  );

  // Actions footer
  const actions = (
    <View
      className={`px-4 pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}
      style={
        isWeb
          ? { paddingBottom: 16 }
          : { paddingBottom: Math.max(16, insets.bottom) }
      }
    >
      <View className="gap-3">
        {hasChanges && (
          <Button onPress={handleSave} disabled={saving} className="py-3">
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold">Save Changes</Text>
            )}
          </Button>
        )}
        <Button onPress={handleRemove} variant="destructive" className="py-3">
          <View className="flex-row items-center gap-2">
            <Trash2 size={18} color="white" />
            <Text className="text-white font-medium">
              Remove from Collection
            </Text>
          </View>
        </Button>
      </View>
    </View>
  );

  // Conditional rendering based on platform
  return (
    <>
      {!useDesktopLayout ? (
        // Mobile (iOS/Android) or mobile web - use bottom sheet
        <GlassSheet visible={visible} onDismiss={onClose} isDark={isDark}>
          <BottomSheetView style={{ flex: 1 }}>
            {header}
            {content}
            {actions}
          </BottomSheetView>
        </GlassSheet>
      ) : (
        // Desktop web - use centered dialog
        <Modal
          visible={visible}
          transparent
          animationType="fade"
          onRequestClose={onClose}
          statusBarTranslucent
        >
          <View className="flex-1 justify-center items-center">
            <Pressable
              onPress={onClose}
              className="absolute inset-0 bg-black/50"
            />
            <View
              className={`rounded-2xl w-full max-w-4xl max-h-[90%] ${isDark ? "bg-gray-900" : "bg-white"}`}
            >
              {header}
              {content}
              {actions}
            </View>
          </View>
        </Modal>
      )}
    </>
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
  onAdd: (
    scryfallId: string,
    quantity: number,
    foilQuantity: number,
  ) => Promise<void>;
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardSearchResult | null>(
    null,
  );
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
    <GlassSheet visible={visible} onDismiss={handleClose} isDark={isDark}>
      <BottomSheetView style={{ flex: 1 }}>
        {/* Header */}
        <View
          className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
        >
          <Text
            className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}
          >
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
              inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
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
          <View
            className={`mx-4 mb-3 rounded-xl p-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
          >
            <View className="flex-row gap-4">
              {selectedCard.imageSmall && (
                <Image
                  source={{ uri: selectedCard.imageSmall }}
                  className="h-24 w-16 rounded-lg"
                  resizeMode="cover"
                />
              )}
              <View className="flex-1">
                <Text
                  className={`font-bold text-base ${isDark ? "text-white" : "text-slate-900"}`}
                  numberOfLines={2}
                >
                  {selectedCard.name}
                </Text>
                <Text
                  className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {selectedCard.setName}
                </Text>
                {selectedCard.priceUsd && (
                  <Text className="text-purple-500 text-sm mt-1">
                    ${selectedCard.priceUsd}
                  </Text>
                )}
              </View>
            </View>

            {/* Quantity Controls */}
            <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
              <View className="flex-row items-center gap-4">
                <View className="items-center">
                  <Text
                    className={`text-xs mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Regular
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => setQuantity(Math.max(0, quantity - 1))}
                      className={`rounded-full p-1.5 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                    >
                      <Minus size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                    </Pressable>
                    <Text
                      className={`text-lg font-bold w-6 text-center ${isDark ? "text-white" : "text-slate-900"}`}
                    >
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
                    <Text
                      className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Foil
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() =>
                        setFoilQuantity(Math.max(0, foilQuantity - 1))
                      }
                      className={`rounded-full p-1.5 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                    >
                      <Minus size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                    </Pressable>
                    <Text
                      className={`text-lg font-bold w-6 text-center ${isDark ? "text-white" : "text-slate-900"}`}
                    >
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
                  quantity === 0 && foilQuantity === 0
                    ? "bg-slate-600"
                    : "bg-purple-500"
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
            <View
              className={`flex-row items-center gap-3 px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
            >
              <Pressable onPress={handleBackToSearch} className="p-1">
                <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              </Pressable>
              <View className="flex-1">
                <Text
                  className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                  numberOfLines={1}
                >
                  {selectedCardName}
                </Text>
                <Text
                  className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {prints.length} printing{prints.length !== 1 ? "s" : ""}{" "}
                  available
                </Text>
              </View>
            </View>

            {loadingPrints ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text
                  className={`mt-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Loading printings...
                </Text>
              </View>
            ) : (
              <FlatList
                data={prints}
                keyExtractor={(item) => item.scryfallId}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  paddingBottom: Math.max(24, insets.bottom),
                }}
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
                      <View
                        className={`h-16 w-12 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
                      />
                    )}
                    <View className="flex-1">
                      <Text
                        className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                        numberOfLines={1}
                      >
                        {item.setName}
                      </Text>
                      <Text
                        className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
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
                        <Text className="text-purple-500 text-sm font-medium">
                          ${item.priceUsd}
                        </Text>
                      )}
                      {item.priceUsdFoil && (
                        <Text className="text-purple-400 text-xs">
                          Foil: ${item.priceUsdFoil}
                        </Text>
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
            <Text
              className={`mt-4 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Search for cards by name
            </Text>
            <Text
              className={`text-sm mt-1 text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              Type at least 2 characters
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text
              className={`text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              No cards found for "{searchQuery}"
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.scryfallId}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingBottom: Math.max(24, insets.bottom),
            }}
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
                  <View
                    className={`h-12 w-9 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
                  />
                )}
                <View className="flex-1">
                  <Text
                    className={`text-base font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text
                    className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
                  >
                    {item.typeLine}
                  </Text>
                </View>
                <Text
                  className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Select printing →
                </Text>
              </Pressable>
            )}
          />
        )}
      </BottomSheetView>
    </GlassSheet>
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
  const { isDesktop, isTablet } = useResponsive();
  const useDialog = isWeb && (isDesktop || isTablet);
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    linked: number;
    added: number;
    errors: Array<{ line: string; error: string }>;
  } | null>(null);
  const [settings, setSettings] = useState<ImportSettingsValue>({
    folderId: null,
    autoLink: true,
    deckId: null,
    overrideSet: false,
    addMissing: false,
  });

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
      const response = await collectionApi.bulkImport(lines, {
        folderId: settings.folderId || undefined,
        autoLink: settings.autoLink || undefined,
        deckId: !settings.autoLink ? settings.deckId || undefined : undefined,
        overrideSet: !settings.autoLink && settings.deckId ? settings.overrideSet || undefined : undefined,
        addMissing: !settings.autoLink && settings.deckId ? settings.addMissing || undefined : undefined,
      });
      if (response.error) {
        showToast.error(response.error);
      } else if (response.data) {
        setResult(response.data);
        if (response.data.imported > 0 && response.data.errors.length === 0) {
          setText("");
        }
        // Invalidate deck caches if we modified a deck
        if (settings.deckId || settings.autoLink) {
          await cache.remove(CACHE_KEYS.DECKS_LIST);
          if (settings.deckId) {
            await cache.remove(CACHE_KEYS.DECK_DETAIL(settings.deckId));
          }
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

  const header = (
    <View
      className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
    >
      <View className="flex-row items-center gap-2">
        <FileText size={20} color={isDark ? "#94a3b8" : "#64748b"} />
        <Text
          className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}
        >
          Bulk Import
        </Text>
      </View>
      <Pressable onPress={handleClose} className="rounded-full p-2">
        <X size={24} color={isDark ? "white" : "#1e293b"} />
      </Pressable>
    </View>
  );

  const body = (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        padding: 16,
        paddingBottom: useDialog ? 16 : Math.max(16, insets.bottom + 16),
      }}
    >
      {/* Instructions */}
      <View
        className={`rounded-xl p-4 mb-4 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
      >
        <Text
          className={`text-sm font-medium mb-2 ${isDark ? "text-white" : "text-slate-900"}`}
        >
          Format
        </Text>
        <Text
          className={`text-sm mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          One card per line in the format:
        </Text>
        <View
          className={`rounded-lg p-3 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
        >
          <Text
            className={`font-mono text-xs ${isDark ? "text-purple-400" : "text-purple-600"}`}
          >
            {"<count> <name> (<set>) <number>"}
          </Text>
        </View>
        <Text
          className={`text-xs mt-3 ${isDark ? "text-slate-500" : "text-slate-400"}`}
        >
          Example:{"\n"}4 Lightning Bolt (M10) 146{"\n"}2 Counterspell (ICE)
          64{"\n"}1 Sol Ring (C21) 263{"\n\n"}
          Blank lines and comments (# or //) are ignored.
        </Text>
      </View>

      {/* Text Input */}
      <View
        className={`rounded-xl overflow-hidden mb-4 border ${isDark ? "border-slate-700" : "border-slate-200"}`}
      >
        <TextInput
          className={`min-h-[200px] p-4 text-sm font-mono ${isDark ? "bg-slate-800 text-white" : "bg-white text-slate-900"}`}
          placeholder="Paste your card list here..."
          placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
        />
      </View>

      <ImportSettings
        visible={visible}
        isDark={isDark}
        value={settings}
        onChange={setSettings}
      />

      {/* Result */}
      {result && (
        <View
          className={`rounded-xl p-4 mb-4 ${result.errors.length === 0 ? "bg-purple-900/30" : "bg-amber-900/30"}`}
        >
          <View className="flex-row items-center gap-2 mb-2">
            {result.errors.length === 0 ? (
              <CheckCircle size={20} color="#7C3AED" />
            ) : (
              <XCircle size={20} color="#f59e0b" />
            )}
            <Text
              className={`font-medium ${result.errors.length === 0 ? "text-purple-400" : "text-amber-400"}`}
            >
              {result.errors.length === 0
                ? `Successfully imported ${result.imported} card${result.imported !== 1 ? "s" : ""}${result.linked > 0 ? `, linked ${result.linked}` : ""}${result.added > 0 ? `, added ${result.added} to deck` : ""}`
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
            Import{" "}
            {lineCount > 0
              ? `${lineCount} Line${lineCount !== 1 ? "s" : ""}`
              : "Cards"}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );

  return (
    <>
      {!useDialog ? (
        <GlassSheet visible={visible} onDismiss={handleClose} isDark={isDark}>
          <BottomSheetView style={{ flex: 1 }}>
            {header}
            {body}
          </BottomSheetView>
        </GlassSheet>
      ) : (
        <Modal
          visible={visible}
          transparent
          animationType="fade"
          onRequestClose={handleClose}
          statusBarTranslucent
        >
          <View className="flex-1 justify-center items-center">
            <Pressable
              onPress={handleClose}
              className="absolute inset-0 bg-black/50"
            />
            <View
              className={`rounded-2xl w-full max-w-2xl max-h-[90%] ${isDark ? "bg-gray-900" : "bg-white"}`}
            >
              {header}
              {body}
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

// ==================== Folder Name Modal (Create/Rename) ====================

function FolderNameModal({
  visible,
  onClose,
  onSave,
  initialName,
  title,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  initialName?: string;
  title: string;
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(initialName || "");
      setError(null);
    }
  }, [visible, initialName]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/50 items-center justify-center px-6"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={`w-full max-w-sm rounded-2xl p-5 ${isDark ? "bg-slate-900" : "bg-white"}`}
        >
          <Text
            className={`text-lg font-bold mb-4 ${isDark ? "text-white" : "text-slate-900"}`}
          >
            {title}
          </Text>
          <TextInput
            className={`rounded-lg border px-4 py-3 text-base mb-3 ${
              isDark
                ? "border-slate-700 bg-slate-800 text-white"
                : "border-slate-200 bg-slate-50 text-slate-900"
            }`}
            placeholder="Folder name"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={100}
            inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
          />
          {error && <Text className="text-red-500 text-sm mb-3">{error}</Text>}
          <View className="flex-row gap-3">
            <Pressable
              onPress={onClose}
              className={`flex-1 rounded-lg py-3 items-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
            >
              <Text className={isDark ? "text-slate-300" : "text-slate-600"}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving || !name.trim()}
              className={`flex-1 rounded-lg py-3 items-center ${
                !name.trim() ? "bg-slate-600" : "bg-purple-500"
              }`}
            >
              {saving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white font-semibold">Save</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ==================== Folder Picker Modal ====================

function FolderPickerModal({
  visible,
  onClose,
  folders,
  onSelect,
  onCreateAndSelect,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  folders: CollectionFolder[];
  onSelect: (folderId: string | null) => void;
  onCreateAndSelect: (name: string) => Promise<void>;
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [creatingNew, setCreatingNew] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCreatingNew(false);
      setNewFolderName("");
    }
  }, [visible]);

  const handleCreateAndMove = async () => {
    if (!newFolderName.trim()) return;
    setSaving(true);
    try {
      await onCreateAndSelect(newFolderName.trim());
      onClose();
    } catch (err) {
      showToast.error("Failed to create folder");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassSheet visible={visible} onDismiss={onClose} isDark={isDark} enableKeyboardHandling>
      <BottomSheetView style={{ flex: 1 }}>
        {/* Header */}
        <View
          className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
        >
          <Text
            className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}
          >
            Move to Folder
          </Text>
          <Pressable onPress={onClose} className="rounded-full p-2">
            <X size={24} color={isDark ? "white" : "#1e293b"} />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom) }}
        >
          {/* Create New Folder */}
          {creatingNew ? (
            <View
              className={`px-4 py-4 border-b ${isDark ? "border-slate-800" : "border-slate-100"}`}
            >
              <View className="flex-row items-center gap-3">
                <BottomSheetTextInput
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-base ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                  placeholder="New folder name"
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  autoFocus
                  maxLength={100}
                  inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                />
                <Pressable
                  onPress={handleCreateAndMove}
                  disabled={saving || !newFolderName.trim()}
                  className={`rounded-lg px-4 py-2.5 ${!newFolderName.trim() ? "bg-slate-600" : "bg-purple-500"}`}
                >
                  {saving ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white font-semibold">Create</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => setCreatingNew(false)}
                  className="p-1"
                >
                  <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setCreatingNew(true)}
              className={`flex-row items-center gap-3 px-4 py-4 border-b ${
                isDark
                  ? "border-slate-800 active:bg-slate-800/50"
                  : "border-slate-100 active:bg-slate-50"
              }`}
            >
              <FolderPlus size={22} color="#7C3AED" />
              <Text className="text-purple-500 font-medium">New Folder</Text>
            </Pressable>
          )}

          {/* Unfiled option */}
          <Pressable
            onPress={() => {
              onSelect(null);
              onClose();
            }}
            className={`flex-row items-center gap-3 px-4 py-4 border-b ${
              isDark
                ? "border-slate-800 active:bg-slate-800/50"
                : "border-slate-100 active:bg-slate-50"
            }`}
          >
            <Inbox size={22} color={isDark ? "#64748b" : "#94a3b8"} />
            <Text className={isDark ? "text-white" : "text-slate-900"}>
              Unfiled
            </Text>
          </Pressable>

          {/* Existing folders */}
          {folders.map((folder) => (
            <Pressable
              key={folder.id}
              onPress={() => {
                onSelect(folder.id);
                onClose();
              }}
              className={`flex-row items-center gap-3 px-4 py-4 border-b ${
                isDark
                  ? "border-slate-800 active:bg-slate-800/50"
                  : "border-slate-100 active:bg-slate-50"
              }`}
            >
              <FolderOpen size={22} color={isDark ? "#94a3b8" : "#64748b"} />
              <View className="flex-1">
                <Text className={isDark ? "text-white" : "text-slate-900"}>
                  {folder.name}
                </Text>
                <Text
                  className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  {folder.cardCount} card{folder.cardCount !== 1 ? "s" : ""}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheetView>
    </GlassSheet>
  );
}

// ==================== Bulk Actions Content ====================

function BulkActionsContent({
  isDark,
  activeFolderId,
  onSelectAll,
  onDeselect,
  onMove,
  onUnfile,
  onDelete,
}: {
  isDark: boolean;
  activeFolderId?: string | null;
  onSelectAll: () => void;
  onDeselect: () => void;
  onMove: () => void;
  onUnfile: () => void;
  onDelete: () => void;
}) {
  return (
    <View className="py-2">
      <Pressable
        onPress={onSelectAll}
        className={`flex-row items-center gap-3 px-4 py-3 ${isDark ? "active:bg-slate-800" : "active:bg-slate-50"}`}
      >
        <CheckSquare size={20} color={isDark ? "#94a3b8" : "#64748b"} />
        <Text className={isDark ? "text-white" : "text-slate-900"}>Select All</Text>
      </Pressable>

      <Pressable
        onPress={onDeselect}
        className={`flex-row items-center gap-3 px-4 py-3 ${isDark ? "active:bg-slate-800" : "active:bg-slate-50"}`}
      >
        <XCircle size={20} color={isDark ? "#94a3b8" : "#64748b"} />
        <Text className={isDark ? "text-white" : "text-slate-900"}>Deselect All</Text>
      </Pressable>

      <Pressable
        onPress={onMove}
        className={`flex-row items-center gap-3 px-4 py-3 ${isDark ? "active:bg-slate-800" : "active:bg-slate-50"}`}
      >
        <FolderOpen size={20} color={isDark ? "#94a3b8" : "#64748b"} />
        <Text className={isDark ? "text-white" : "text-slate-900"}>Move to Folder</Text>
      </Pressable>

      {activeFolderId && activeFolderId !== "unfiled" && (
        <Pressable
          onPress={onUnfile}
          className={`flex-row items-center gap-3 px-4 py-3 ${isDark ? "active:bg-slate-800" : "active:bg-slate-50"}`}
        >
          <Inbox size={20} color={isDark ? "#94a3b8" : "#64748b"} />
          <Text className={isDark ? "text-white" : "text-slate-900"}>Remove from Folder</Text>
        </Pressable>
      )}

      <View className={`my-1 h-px ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />

      <Pressable
        onPress={onDelete}
        className={`flex-row items-center gap-3 px-4 py-3 ${isDark ? "active:bg-slate-800" : "active:bg-slate-50"}`}
      >
        <Trash2 size={20} color="#ef4444" />
        <Text className="text-red-500 font-medium">Delete from Collection</Text>
      </Pressable>
    </View>
  );
}

// ==================== Bulk Actions Sheet ====================

function BulkActionsSheet({
  visible,
  onDismiss,
  isDark,
  activeFolderId,
  onSelectAll,
  onDeselect,
  onMove,
  onUnfile,
  onDelete,
}: {
  visible: boolean;
  onDismiss: () => void;
  isDark: boolean;
  activeFolderId?: string | null;
  onSelectAll: () => void;
  onDeselect: () => void;
  onMove: () => void;
  onUnfile: () => void;
  onDelete: () => void;
}) {
  return (
    <GlassSheet visible={visible} onDismiss={onDismiss} isDark={isDark}>
      <BottomSheetView>
        <BulkActionsContent
          isDark={isDark}
          activeFolderId={activeFolderId}
          onSelectAll={onSelectAll}
          onDeselect={onDeselect}
          onMove={onMove}
          onUnfile={onUnfile}
          onDelete={onDelete}
        />
      </BottomSheetView>
    </GlassSheet>
  );
}

// ==================== Main Collection Screen ====================

export default function CollectionScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { isDesktop, isTablet, breakpoint } = useResponsive();
  const navigation = useNavigation();

  // ---- Browse vs Card view state ----
  const [browseMode, setBrowseMode] = useState<"folders" | "decks">("folders");
  const [currentView, setCurrentView] = useState<"browse" | "cards">("browse");
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>(
    undefined,
  );
  const [activeDeckId, setActiveDeckId] = useState<string | undefined>(
    undefined,
  );
  const [activeGroupName, setActiveGroupName] = useState("All Cards");
  const [browseSortBy, setBrowseSortBy] = useState<"date" | "name" | "value">("name");

  // ---- Folder/deck data ----
  const [folders, setFolders] = useState<CollectionFolder[]>([]);
  const [folderTotalCards, setFolderTotalCards] = useState(0);
  const [unfiledCount, setUnfiledCount] = useState(0);
  const [unfiledValue, setUnfiledValue] = useState(0);
  const [deckGroups, setDeckGroups] = useState<DeckGroup[]>([]);
  const [deckTotalCards, setDeckTotalCards] = useState(0);
  const [unlinkedCount, setUnlinkedCount] = useState(0);
  const [unlinkedValue, setUnlinkedValue] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(true);

  // ---- Card list state ----
  const [cards, setCards] = useState<(CollectionCard | null)[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">(
    isDesktop || isTablet ? "grid" : "list",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "name" | "value">("date");
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set());
  const pageSize = 50;

  // ---- Linked decks sheet ----
  const [linkedDecksSheet, setLinkedDecksSheet] = useState<{
    visible: boolean;
    cardName: string;
    decks: Array<{ deckId: string; deckName: string }>;
  }>({ visible: false, cardName: "", decks: [] });

  // ---- Selection mode ----
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    new Set(),
  );
  const actionBarAnim = useRef(new Animated.Value(0)).current;
  const [showActionBar, setShowActionBar] = useState(false);

  useEffect(() => {
    const visible = selectionMode && selectedCardIds.size > 0;
    if (visible) {
      setShowActionBar(true);
      Animated.spring(actionBarAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else {
      Animated.timing(actionBarAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => setShowActionBar(false));
    }
  }, [selectionMode, selectedCardIds.size]);

  const [folderPickerVisible, setFolderPickerVisible] = useState(false);
  const [bulkActionsSheetVisible, setBulkActionsSheetVisible] = useState(false);

  // ---- Folder management modals ----
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [renameFolderTarget, setRenameFolderTarget] =
    useState<CollectionFolder | null>(null);

  // ---- Other modal states ----
  const [selectedCard, setSelectedCard] = useState<CollectionCard | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [bulkImportModalVisible, setBulkImportModalVisible] = useState(false);
  const [scryfallSearchVisible, setScryfallSearchVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
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

  const [dropdownVisible, setDropdownVisible] = useState(false);

  // Set the header buttons in the navigation header (mobile browse view only)
  useLayoutEffect(() => {
    if (!isDesktop && currentView === "browse") {
      navigation.setOptions({
        headerRight: () => (
          <HeaderButton
            icon={EllipsisVertical}
            variant="ghost"
            onPress={() => setDropdownVisible((v) => !v)}
          />
        ),
      });
    }
  }, [navigation, currentView, isDark, isDesktop]);

  // ==================== Browse Data Loading ====================

  const loadFolders = useCallback(async () => {
    setBrowseLoading(true);
    try {
      const result = await collectionApi.getFolders();
      if (result.data) {
        setFolders(result.data.folders);
        setFolderTotalCards(result.data.totalCards);
        setUnfiledCount(result.data.unfiledCount);
        setUnfiledValue(result.data.unfiledValue);
      }
    } catch (err) {
      console.error("Failed to load folders:", err);
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  const loadDeckGroups = useCallback(async () => {
    setBrowseLoading(true);
    try {
      const result = await collectionApi.getDeckGroups();
      if (result.data) {
        setDeckGroups(result.data.decks);
        setDeckTotalCards(result.data.totalCards);
        setUnlinkedCount(result.data.unlinkedCount);
        setUnlinkedValue(result.data.unlinkedValue);
      }
    } catch (err) {
      console.error("Failed to load deck groups:", err);
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  const loadBrowseData = useCallback(() => {
    if (browseMode === "folders") {
      loadFolders();
    } else {
      loadDeckGroups();
    }
  }, [browseMode, loadFolders, loadDeckGroups]);

  // ==================== Card List Loading ====================

  const loadPage = useCallback(
    async (
      pageNum: number,
      search?: string,
      folderId?: string,
      deckId?: string,
    ) => {
      if (loadedPages.has(pageNum) || loadingPages.has(pageNum)) return;

      setLoadingPages((prev) => new Set(prev).add(pageNum));

      try {
        const result = await collectionApi.list({
          page: pageNum,
          pageSize,
          search: search || undefined,
          folderId: folderId || undefined,
          deckId: deckId || undefined,
          sort: sortBy,
        });

        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          setCards((prev) => {
            const newCards = [...prev];
            const startIndex = (pageNum - 1) * pageSize;
            result.data!.data.forEach((card, index) => {
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
    [loadedPages, loadingPages, pageSize, sortBy],
  );

  const loadCollection = useCallback(
    async (search?: string, folderId?: string, deckId?: string) => {
      try {
        setError(null);
        setLoading(true);

        const result = await collectionApi.list({
          page: 1,
          pageSize,
          search: search || undefined,
          folderId: folderId || undefined,
          deckId: deckId || undefined,
          sort: sortBy,
        });

        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          const total = result.data.total;
          setTotalCount(total);

          const placeholders = new Array(total).fill(null);
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
    [pageSize, sortBy],
  );

  const loadStats = useCallback(async (folderId?: string, deckId?: string) => {
    try {
      const result = await collectionApi.getStats({
        folderId: folderId || undefined,
        deckId: deckId || undefined,
      });
      if (result.data) {
        setStats(result.data);
      }
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }, []);

  // ==================== Navigation ====================

  const handleOpenFolder = useCallback(
    (folderId: string | undefined, name: string) => {
      setActiveFolderId(folderId);
      setActiveDeckId(undefined);
      setActiveGroupName(name);
      setCurrentView("cards");
      setSearchQuery("");
      setSelectionMode(false);
      setSelectedCardIds(new Set());
      loadCollection(undefined, folderId);
      loadStats(folderId);
    },
    [loadCollection, loadStats],
  );

  const handleOpenDeck = useCallback(
    (deckId: string | undefined, name: string) => {
      setActiveDeckId(deckId);
      setActiveFolderId(undefined);
      setActiveGroupName(name);
      setCurrentView("cards");
      setSearchQuery("");
      setSelectionMode(false);
      setSelectedCardIds(new Set());
      loadCollection(undefined, undefined, deckId);
      loadStats(undefined, deckId);
    },
    [loadCollection, loadStats],
  );

  const handleBackToBrowse = useCallback(() => {
    setCurrentView("browse");
    setSelectionMode(false);
    setSelectedCardIds(new Set());
    setSearchQuery("");
    loadBrowseData();
  }, [loadBrowseData]);

  // ==================== Card Actions ====================

  const existingCardIds = useMemo(() => {
    const ids = new Set<string>();
    for (const card of cards) {
      if (card) ids.add(card.scryfallId);
    }
    return ids;
  }, [cards]);

  const handleCardPress = useCallback((card: CollectionCard) => {
    setSelectedCard(card);
    setDetailModalVisible(true);
  }, []);

  const handleUpdateCard = async (
    id: string,
    quantity: number,
    foilQuantity: number,
  ) => {
    const result = await collectionApi.update(id, { quantity, foilQuantity });
    if (result.error) {
      showToast.error(result.error);
      return;
    }
    setCards((prev) =>
      prev.map((c) =>
        c && c.id === id ? { ...c, quantity, foilQuantity } : c,
      ),
    );
    loadStats(activeFolderId, activeDeckId);
  };

  const handleRemoveCard = async (id: string) => {
    const result = await collectionApi.remove(id);
    if (result.error) {
      showToast.error(result.error);
      return;
    }
    loadCollection(searchQuery, activeFolderId, activeDeckId);
    loadStats(activeFolderId, activeDeckId);
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

  const handleAddCard = async (
    scryfallId: string,
    quantity: number,
    foilQuantity: number,
  ) => {
    // Pass active folder ID so new cards are added to the current folder
    const folderId =
      activeFolderId && activeFolderId !== "unfiled"
        ? activeFolderId
        : undefined;
    const result = await collectionApi.add(
      scryfallId,
      quantity,
      foilQuantity,
      folderId,
    );
    if (result.error) {
      showToast.error(result.error);
      return false;
    }
    if (currentView === "cards") {
      loadCollection(searchQuery, activeFolderId, activeDeckId);
      loadStats(activeFolderId, activeDeckId);
    }
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

  // ==================== Selection Mode ====================

  const handleEnterSelectionMode = useCallback((cardId: string) => {
    setSelectionMode(true);
    setSelectedCardIds(new Set([cardId]));
  }, []);

  const handleToggleSelect = useCallback((cardId: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      if (next.size === 0) {
        setSelectionMode(false);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(async () => {
    const result = await collectionApi.getAllIds({
      search: searchQuery || undefined,
      folderId: activeFolderId || undefined,
      deckId: activeDeckId || undefined,
    });
    if (result.data) {
      setSelectedCardIds(new Set(result.data));
    }
  }, [searchQuery, activeFolderId, activeDeckId]);

  const handleCancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedCardIds(new Set());
  }, []);

  const handleMoveSelectedToFolder = useCallback(
    async (folderId: string | null) => {
      const ids = Array.from(selectedCardIds);
      if (ids.length === 0) return;

      const result = await collectionApi.moveCardsToFolder(ids, folderId);
      if (result.error) {
        showToast.error(result.error);
        return;
      }

      const moved = result.data?.moved ?? ids.length;
      showToast.success(`Moved ${moved} card${moved !== 1 ? "s" : ""}`);
      setSelectionMode(false);
      setSelectedCardIds(new Set());
      // Refresh current view and folder counts
      loadCollection(searchQuery, activeFolderId, activeDeckId);
      loadStats(activeFolderId, activeDeckId);
      loadFolders();
    },
    [
      selectedCardIds,
      searchQuery,
      activeFolderId,
      activeDeckId,
      loadCollection,
      loadStats,
      loadFolders,
    ],
  );

  const handleCreateFolderAndMove = useCallback(
    async (name: string) => {
      const createResult = await collectionApi.createFolder(name);
      if (createResult.error) {
        throw new Error(createResult.error);
      }
      if (createResult.data) {
        await handleMoveSelectedToFolder(createResult.data.id);
      }
    },
    [handleMoveSelectedToFolder],
  );

  const handleBulkDelete = useCallback(() => {
    const count = selectedCardIds.size;
    if (count === 0) return;

    setConfirmDialog({
      visible: true,
      title: "Delete Cards",
      message: `Remove ${count} card${count !== 1 ? "s" : ""} from your collection? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, visible: false }));
        const ids = Array.from(selectedCardIds);
        const result = await collectionApi.bulkRemove(ids);
        if (result.error) {
          showToast.error(result.error);
          return;
        }
        const removed = result.data?.removed ?? ids.length;
        showToast.success(`Removed ${removed} card${removed !== 1 ? "s" : ""}`);
        setSelectionMode(false);
        setSelectedCardIds(new Set());
        loadCollection(searchQuery, activeFolderId, activeDeckId);
        loadStats(activeFolderId, activeDeckId);
        loadFolders();
      },
    });
  }, [
    selectedCardIds,
    searchQuery,
    activeFolderId,
    activeDeckId,
    loadCollection,
    loadStats,
    loadFolders,
  ]);

  // ==================== Folder CRUD ====================

  const handleCreateFolder = useCallback(
    async (name: string) => {
      const result = await collectionApi.createFolder(name);
      if (result.error) {
        throw new Error(result.error);
      }
      loadFolders();
    },
    [loadFolders],
  );

  const handleRenameFolder = useCallback(
    async (name: string) => {
      if (!renameFolderTarget) return;
      const result = await collectionApi.renameFolder(
        renameFolderTarget.id,
        name,
      );
      if (result.error) {
        throw new Error(result.error);
      }
      loadFolders();
    },
    [renameFolderTarget, loadFolders],
  );

  const handleDeleteFolder = useCallback(
    (folder: CollectionFolder) => {
      setConfirmDialog({
        visible: true,
        title: "Delete Folder",
        message: `Delete "${folder.name}"? Cards in this folder will become unfiled.`,
        onConfirm: async () => {
          setConfirmDialog((prev) => ({ ...prev, visible: false }));
          const result = await collectionApi.deleteFolder(folder.id);
          if (result.error) {
            showToast.error(result.error);
            return;
          }
          showToast.success("Folder deleted");
          loadFolders();
        },
      });
    },
    [loadFolders],
  );

  // ==================== Virtual Scrolling ====================

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (currentView === "browse") {
      loadBrowseData();
      setRefreshing(false);
    } else {
      loadCollection(searchQuery, activeFolderId, activeDeckId);
      loadStats(activeFolderId, activeDeckId);
    }
  }, [
    currentView,
    loadBrowseData,
    loadCollection,
    loadStats,
    searchQuery,
    activeFolderId,
    activeDeckId,
  ]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: any[] }) => {
      const visiblePages = new Set<number>();
      viewableItems.forEach((item) => {
        if (item.index !== null && item.index !== undefined) {
          const pageNum = Math.floor(item.index / pageSize) + 1;
          visiblePages.add(pageNum);
          if (pageNum > 1) visiblePages.add(pageNum - 1);
          visiblePages.add(pageNum + 1);
        }
      });

      visiblePages.forEach((pageNum) => {
        const totalPages = Math.ceil(totalCount / pageSize);
        if (pageNum <= totalPages) {
          loadPage(pageNum, searchQuery, activeFolderId, activeDeckId);
        }
      });
    },
    [loadPage, pageSize, searchQuery, totalCount, activeFolderId, activeDeckId],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 0,
    minimumViewTime: 100,
  }).current;

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setLoading(true);
    loadCollection(query, activeFolderId, activeDeckId);
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedCardIds(new Set());
    }
  };

  // Reload when sort changes
  useEffect(() => {
    if (currentView === "cards") {
      loadCollection(searchQuery, activeFolderId, activeDeckId);
    }
  }, [sortBy]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadBrowseData();
      cache.get<"list" | "grid">(CACHE_KEYS.VIEW_MODE).then((mode) => {
        if (mode) {
          setViewMode(mode);
        } else {
          setViewMode(isDesktop || isTablet ? "grid" : "list");
        }
      });
    });
    return () => task.cancel();
  }, [loadBrowseData]);

  const toggleViewMode = () => {
    const newMode = viewMode === "list" ? "grid" : "list";
    setViewMode(newMode);
    cache.set(CACHE_KEYS.VIEW_MODE, newMode, 60 * 24 * 30);
  };

  // Responsive grid columns
  const gridColumns = useMemo(() => {
    switch (breakpoint) {
      case "2xl":
        return 8;
      case "xl":
        return 8;
      case "lg":
        return 7;
      case "md":
        return 5;
      case "sm":
        return 4;
      default:
        return 3;
    }
  }, [breakpoint]);

  // Sorted folders for browse view
  const sortedFolders = useMemo(() => {
    const sorted = [...folders];
    switch (browseSortBy) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "value":
        sorted.sort((a, b) => b.totalValue - a.totalValue);
        break;
      case "date":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }
    return sorted;
  }, [folders, browseSortBy]);

  // Sorted deck groups for browse view
  const sortedDeckGroups = useMemo(() => {
    const sorted = [...deckGroups];
    switch (browseSortBy) {
      case "name":
        sorted.sort((a, b) => a.deckName.localeCompare(b.deckName));
        break;
      case "value":
        sorted.sort((a, b) => b.totalValue - a.totalValue);
        break;
      case "date":
        // DeckGroups don't have a date field, fall back to name
        sorted.sort((a, b) => a.deckName.localeCompare(b.deckName));
        break;
    }
    return sorted;
  }, [deckGroups, browseSortBy]);

  // Donut chart segments for folders
  const folderDonutSegments = useMemo(() => {
    const segs = folders
      .filter((f) => f.totalValue > 0)
      .sort((a, b) => b.totalValue - a.totalValue)
      .map((f, i) => ({
        label: f.name,
        value: f.totalValue,
        color: getSegmentColor(i),
      }));
    if (unfiledValue > 0) {
      segs.push({ label: "Unfiled", value: unfiledValue, color: "#64748b" });
    }
    return segs;
  }, [folders, unfiledValue]);

  // Donut chart segments for decks
  const deckDonutSegments = useMemo(() => {
    const segs = deckGroups
      .filter((d) => d.totalValue > 0)
      .sort((a, b) => b.totalValue - a.totalValue)
      .map((d, i) => ({
        label: d.deckName,
        value: d.totalValue,
        color: getSegmentColor(i),
      }));
    if (unlinkedValue > 0) {
      segs.push({ label: "Unlinked", value: unlinkedValue, color: "#64748b" });
    }
    return segs;
  }, [deckGroups, unlinkedValue]);

  // ==================== Render Helpers ====================

  const getListItemLayout = useCallback(
    (
      _data: ArrayLike<CollectionCard | null> | null | undefined,
      index: number,
    ) => ({
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

  const stableOnViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      onViewableItemsChangedRef.current({ viewableItems });
    },
  ).current;

  const renderListItem = useCallback(
    ({ item }: { item: CollectionCard | null }) => {
      if (!item) {
        return (
          <View
            className={`flex-row items-center gap-3 py-3 px-4 border-b ${
              isDark
                ? "border-slate-800 bg-slate-950"
                : "border-slate-100 bg-white"
            }`}
          >
            <View
              className={`h-12 w-9 rounded ${isDark ? "bg-slate-800 animate-pulse" : "bg-slate-200 animate-pulse"}`}
            />
            <View className="flex-1">
              <View
                className={`h-4 rounded mb-2 ${isDark ? "bg-slate-800 animate-pulse" : "bg-slate-200 animate-pulse"}`}
                style={{ width: "60%" }}
              />
              <View
                className={`h-3 rounded ${isDark ? "bg-slate-800 animate-pulse" : "bg-slate-200 animate-pulse"}`}
                style={{ width: "40%" }}
              />
            </View>
          </View>
        );
      }

      return (
        <CollectionListItem
          card={item}
          isDark={isDark}
          onPress={() => handleCardPress(item)}
          onRequestDelete={handleRequestDelete}
          selectionMode={selectionMode}
          isSelected={selectedCardIds.has(item.id)}
          onLongPress={() => handleEnterSelectionMode(item.id)}
          onToggleSelect={() => handleToggleSelect(item.id)}
          onShowLinkedDecks={(cardName, decks) =>
            setLinkedDecksSheet({ visible: true, cardName, decks })
          }
        />
      );
    },
    [
      isDark,
      handleCardPress,
      handleRequestDelete,
      selectionMode,
      selectedCardIds,
      handleEnterSelectionMode,
      handleToggleSelect,
    ],
  );

  // ==================== Browse Row Component ====================

  const renderBrowseRow = (
    icon: React.ReactNode,
    name: string,
    count: number,
    value: number,
    onPress: () => void,
    options?: { onLongPress?: () => void; swipeActions?: React.ReactNode },
  ) => (
    <Pressable
      onPress={onPress}
      onLongPress={options?.onLongPress}
      className={`flex-row items-center gap-3 px-4 py-4 border-b ${
        isDark
          ? "border-slate-800 active:bg-slate-800/50"
          : "border-slate-100 active:bg-slate-50"
      }`}
    >
      {icon}
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${isDark ? "text-white" : "text-slate-900"}`}
        >
          {name}
        </Text>
        <Text
          className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
        >
          {count} card{count !== 1 ? "s" : ""}
          {value > 0 ? ` \u00B7 $${value.toFixed(2)}` : ""}
        </Text>
      </View>
      <ChevronRight size={20} color={isDark ? "#475569" : "#94a3b8"} />
    </Pressable>
  );

  // ==================== RENDER ====================

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
      edges={[]}
    >
      {/* Dropdown menu for native mobile */}
      {dropdownVisible && !isDesktop && (
        <View
          className={`absolute right-4 top-2 z-50 w-56 rounded-lg border shadow-lg ${
            isDark
              ? "bg-slate-900 border-slate-800"
              : "bg-white border-slate-200"
          }`}
        >
          <View className="py-1">
            {browseMode === "folders" && (
              <Pressable
                onPress={() => {
                  setDropdownVisible(false);
                  setCreateFolderVisible(true);
                }}
                className={`flex-row items-center gap-3 px-4 py-3 ${
                  isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
                }`}
              >
                <FolderPlus size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text
                  className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  New Folder
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                setDropdownVisible(false);
                setBulkImportModalVisible(true);
              }}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
              }`}
            >
              <FileText size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Bulk Import
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ==================== BROWSE VIEW ==================== */}
      {currentView === "browse" ? (
        <>
          {/* Desktop Browse Header */}
          {isDesktop && (
            <View className="flex-row items-center justify-between px-6 py-4">
              <Text
                className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Collection
              </Text>
              <View className="flex-row items-center gap-2">
                {browseMode === "folders" && (
                  <Pressable
                    onPress={() => setCreateFolderVisible(true)}
                    className={`flex-row items-center gap-1.5 px-3 py-2 rounded-lg ${
                      isDark
                        ? "bg-slate-800 hover:bg-slate-700"
                        : "bg-white border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <FolderPlus
                      size={18}
                      color={isDark ? "#94a3b8" : "#64748b"}
                    />
                    <Text
                      className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}
                    >
                      New Folder
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => setBulkImportModalVisible(true)}
                  className={`flex-row items-center gap-1.5 px-3 py-2 rounded-lg ${
                    isDark
                      ? "bg-slate-800 hover:bg-slate-700"
                      : "bg-white border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <FileText size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                  <Text
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}
                  >
                    Import
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Browse Mode Tabs */}
          <View
            className={`flex-row px-4 lg:px-6 ${
              isDark ? "border-b border-slate-800" : "border-b border-slate-200"
            }`}
          >
            <Pressable
              onPress={() => setBrowseMode("folders")}
              className={`flex-row items-center gap-2 px-4 py-3 ${
                browseMode === "folders"
                  ? "border-b-2 border-purple-500"
                  : "border-b-2 border-transparent"
              }`}
            >
              <Folder
                size={16}
                color={
                  browseMode === "folders"
                    ? "#7C3AED"
                    : isDark
                      ? "#94a3b8"
                      : "#64748b"
                }
              />
              <Text
                className={
                  browseMode === "folders"
                    ? "text-purple-500 font-semibold"
                    : isDark
                      ? "text-slate-400"
                      : "text-slate-500"
                }
              >
                Folders
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setBrowseMode("decks")}
              className={`flex-row items-center gap-2 px-4 py-3 ${
                browseMode === "decks"
                  ? "border-b-2 border-purple-500"
                  : "border-b-2 border-transparent"
              }`}
            >
              <Layers
                size={16}
                color={
                  browseMode === "decks"
                    ? "#7C3AED"
                    : isDark
                      ? "#94a3b8"
                      : "#64748b"
                }
              />
              <Text
                className={
                  browseMode === "decks"
                    ? "text-purple-500 font-semibold"
                    : isDark
                      ? "text-slate-400"
                      : "text-slate-500"
                }
              >
                Decks
              </Text>
            </Pressable>
          </View>

          {/* Value Donut Chart */}
          {(browseMode === "folders"
            ? folderDonutSegments
            : deckDonutSegments
          ).length > 0 && (
            <DonutChart
              segments={
                browseMode === "folders"
                  ? folderDonutSegments
                  : deckDonutSegments
              }
            />
          )}

          {/* Divider */}
          <View className={`mx-4 lg:mx-6 h-px ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />

          {/* Sort Pills */}
          <View className="flex-row items-center gap-2 px-4 lg:px-6 py-2">
            {([
              { key: "name", label: "A-Z", icon: ArrowDownAZ },
              { key: "value", label: "Value", icon: DollarSign },
              { key: "date", label: "Date Added", icon: Calendar },
            ] as const).map(({ key, label, icon: Icon }) => {
              const active = browseSortBy === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setBrowseSortBy(key)}
                  className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
                    active
                      ? "bg-purple-500"
                      : isDark
                        ? "bg-slate-800"
                        : "bg-slate-100"
                  }`}
                >
                  <Icon
                    size={14}
                    color={active ? "#ffffff" : isDark ? "#94a3b8" : "#64748b"}
                  />
                  <Text
                    className={`text-xs font-medium ${
                      active
                        ? "text-white"
                        : isDark
                          ? "text-slate-400"
                          : "text-slate-500"
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Browse Content */}
          {browseLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#7C3AED" />
            </View>
          ) : browseMode === "folders" ? (
            <ScrollView
              className="flex-1"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#7C3AED"
                />
              }
            >
              {isDesktop || isTablet ? (
                /* Desktop/Tablet: Grid layout */
                <View className="flex-row flex-wrap px-4 py-3 gap-3">
                  {/* All Cards tile */}
                  <Pressable
                    onPress={() => handleOpenFolder(undefined, "All Cards")}
                    className={`rounded-xl p-4 items-center justify-center ${
                      isDark
                        ? "bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50"
                        : "bg-white hover:bg-slate-50 border border-slate-200"
                    }`}
                    style={{ width: 160, height: 130 }}
                  >
                    <Library size={28} color="#7C3AED" />
                    <Text
                      className={`text-sm font-semibold mt-2.5 text-center ${isDark ? "text-white" : "text-slate-900"}`}
                      numberOfLines={2}
                    >
                      All Cards
                    </Text>
                    <Text
                      className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      {folderTotalCards} card{folderTotalCards !== 1 ? "s" : ""}
                    </Text>
                  </Pressable>

                  {/* Unfiled tile */}
                  <Pressable
                    onPress={() => handleOpenFolder("unfiled", "Unfiled")}
                    className={`rounded-xl p-4 items-center justify-center ${
                      isDark
                        ? "bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50"
                        : "bg-white hover:bg-slate-50 border border-slate-200"
                    }`}
                    style={{ width: 160, height: 130 }}
                  >
                    <Inbox size={28} color={isDark ? "#64748b" : "#94a3b8"} />
                    <Text
                      className={`text-sm font-semibold mt-2.5 text-center ${isDark ? "text-white" : "text-slate-900"}`}
                      numberOfLines={2}
                    >
                      Unfiled
                    </Text>
                    <Text
                      className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      {unfiledCount} card{unfiledCount !== 1 ? "s" : ""}
                      {unfiledValue > 0 ? ` · $${unfiledValue.toFixed(2)}` : ""}
                    </Text>
                  </Pressable>

                  {/* User folder tiles */}
                  {sortedFolders.map((folder) => (
                    <Pressable
                      key={folder.id}
                      onPress={() => handleOpenFolder(folder.id, folder.name)}
                      onLongPress={() => setRenameFolderTarget(folder)}
                      className={`rounded-xl p-4 items-center justify-center ${
                        isDark
                          ? "bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50"
                          : "bg-white hover:bg-slate-50 border border-slate-200"
                      }`}
                      style={{ width: 160, height: 130 }}
                    >
                      <FolderOpen
                        size={28}
                        color={isDark ? "#94a3b8" : "#64748b"}
                      />
                      <Text
                        className={`text-sm font-semibold mt-2.5 text-center ${isDark ? "text-white" : "text-slate-900"}`}
                        numberOfLines={2}
                      >
                        {folder.name}
                      </Text>
                      <Text
                        className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                      >
                        {folder.cardCount} card{folder.cardCount !== 1 ? "s" : ""}
                        {folder.totalValue > 0
                          ? ` · $${folder.totalValue.toFixed(2)}`
                          : ""}
                      </Text>
                    </Pressable>
                  ))}

                  {sortedFolders.length === 0 && (
                    <View className="w-full items-center py-8 px-6">
                      <Text
                        className={`text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}
                      >
                        No folders yet. Click "New Folder" above to create one.
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                /* Mobile: List layout */
                <View>
                  {/* All Cards */}
                  {renderBrowseRow(
                    <Library size={22} color="#7C3AED" />,
                    "All Cards",
                    folderTotalCards,
                    0,
                    () => handleOpenFolder(undefined, "All Cards"),
                  )}

                  {/* Unfiled */}
                  {renderBrowseRow(
                    <Inbox size={22} color={isDark ? "#64748b" : "#94a3b8"} />,
                    "Unfiled",
                    unfiledCount,
                    unfiledValue,
                    () => handleOpenFolder("unfiled", "Unfiled"),
                  )}

                  {/* User folders */}
                  {sortedFolders.map((folder) => (
                    <Swipeable
                      key={folder.id}
                      renderRightActions={() => (
                        <View className="flex-row">
                          <Pressable
                            onPress={() => setRenameFolderTarget(folder)}
                            className="bg-blue-500 items-center justify-center px-5"
                          >
                            <Pencil size={18} color="white" />
                            <Text className="text-white text-xs mt-1">Rename</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteFolder(folder)}
                            className="bg-red-500 items-center justify-center px-5"
                          >
                            <Trash2 size={18} color="white" />
                            <Text className="text-white text-xs mt-1">Delete</Text>
                          </Pressable>
                        </View>
                      )}
                      overshootRight={false}
                      friction={2}
                    >
                      {renderBrowseRow(
                        <FolderOpen
                          size={22}
                          color={isDark ? "#94a3b8" : "#64748b"}
                        />,
                        folder.name,
                        folder.cardCount,
                        folder.totalValue,
                        () => handleOpenFolder(folder.id, folder.name),
                      )}
                    </Swipeable>
                  ))}

                  {sortedFolders.length === 0 && (
                    <View className="items-center py-8 px-6">
                      <Text
                        className={`text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}
                      >
                        No folders yet. Tap the folder icon above to create one.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          ) : (
            <ScrollView
              className="flex-1"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#7C3AED"
                />
              }
            >
              {isDesktop || isTablet ? (
                /* Desktop/Tablet: Grid layout */
                <View className="flex-row flex-wrap px-4 py-3 gap-3">
                  {/* All Cards tile */}
                  <Pressable
                    onPress={() => handleOpenDeck(undefined, "All Cards")}
                    className={`rounded-xl p-4 items-center justify-center ${
                      isDark
                        ? "bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50"
                        : "bg-white hover:bg-slate-50 border border-slate-200"
                    }`}
                    style={{ width: 160, height: 130 }}
                  >
                    <Library size={28} color="#7C3AED" />
                    <Text
                      className={`text-sm font-semibold mt-2.5 text-center ${isDark ? "text-white" : "text-slate-900"}`}
                      numberOfLines={2}
                    >
                      All Cards
                    </Text>
                    <Text
                      className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      {deckTotalCards} card{deckTotalCards !== 1 ? "s" : ""}
                    </Text>
                  </Pressable>

                  {/* Unlinked tile */}
                  <Pressable
                    onPress={() => handleOpenDeck("unlinked", "Unlinked")}
                    className={`rounded-xl p-4 items-center justify-center ${
                      isDark
                        ? "bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50"
                        : "bg-white hover:bg-slate-50 border border-slate-200"
                    }`}
                    style={{ width: 160, height: 130 }}
                  >
                    <Inbox size={28} color={isDark ? "#64748b" : "#94a3b8"} />
                    <Text
                      className={`text-sm font-semibold mt-2.5 text-center ${isDark ? "text-white" : "text-slate-900"}`}
                      numberOfLines={2}
                    >
                      Unlinked
                    </Text>
                    <Text
                      className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      {unlinkedCount} card{unlinkedCount !== 1 ? "s" : ""}
                      {unlinkedValue > 0 ? ` · $${unlinkedValue.toFixed(2)}` : ""}
                    </Text>
                  </Pressable>

                  {/* Deck group tiles */}
                  {sortedDeckGroups.map((deck) => (
                    <Pressable
                      key={deck.deckId}
                      onPress={() => handleOpenDeck(deck.deckId, deck.deckName)}
                      className={`rounded-xl p-4 items-center justify-center ${
                        isDark
                          ? "bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50"
                          : "bg-white hover:bg-slate-50 border border-slate-200"
                      }`}
                      style={{ width: 160, height: 130 }}
                    >
                      <Layers
                        size={28}
                        color={isDark ? "#94a3b8" : "#64748b"}
                      />
                      <Text
                        className={`text-sm font-semibold mt-2.5 text-center ${isDark ? "text-white" : "text-slate-900"}`}
                        numberOfLines={2}
                      >
                        {deck.deckName}
                      </Text>
                      <Text
                        className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                      >
                        {deck.cardCount} card{deck.cardCount !== 1 ? "s" : ""}
                        {deck.totalValue > 0
                          ? ` · $${deck.totalValue.toFixed(2)}`
                          : ""}
                      </Text>
                    </Pressable>
                  ))}

                  {sortedDeckGroups.length === 0 && (
                    <View className="w-full items-center py-8 px-6">
                      <Text
                        className={`text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}
                      >
                        No linked decks. Use "Auto-link to decks" to associate
                        cards.
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                /* Mobile: List layout */
                <View>
                  {/* All Cards */}
                  {renderBrowseRow(
                    <Library size={22} color="#7C3AED" />,
                    "All Cards",
                    deckTotalCards,
                    0,
                    () => handleOpenDeck(undefined, "All Cards"),
                  )}

                  {/* Unlinked */}
                  {renderBrowseRow(
                    <Inbox size={22} color={isDark ? "#64748b" : "#94a3b8"} />,
                    "Unlinked",
                    unlinkedCount,
                    unlinkedValue,
                    () => handleOpenDeck("unlinked", "Unlinked"),
                  )}

                  {/* Deck groups */}
                  {sortedDeckGroups.map((deck) => (
                    <View key={deck.deckId}>
                      {renderBrowseRow(
                        <Layers size={22} color={isDark ? "#94a3b8" : "#64748b"} />,
                        deck.deckName,
                        deck.cardCount,
                        deck.totalValue,
                        () => handleOpenDeck(deck.deckId, deck.deckName),
                      )}
                    </View>
                  ))}

                  {sortedDeckGroups.length === 0 && (
                    <View className="items-center py-8 px-6">
                      <Text
                        className={`text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}
                      >
                        No linked decks. Use "Auto-link to decks" to associate
                        cards.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          )}

          {/* Browse FABs */}
          {!isDesktop && Platform.OS !== "web" && (
            <>
              <GlassFab icon={Plus} onPress={() => setScryfallSearchVisible(true)} bottom={96} />
              <GlassFab icon={Camera} onPress={() => setScannerVisible(true)} bottom={24} />
            </>
          )}
        </>
      ) : (
        /* ==================== CARD LIST VIEW ==================== */
        <>
          {/* Card List Header */}
          <View
            className={`flex-row items-center justify-between px-4 lg:px-6 py-3 ${!isDesktop ? "border-b border-slate-800" : ""}`}
          >
            <View className="flex-row items-center gap-2 flex-1">
              {isDesktop ? (
                <View className="flex-row items-center gap-1 flex-1">
                  <Pressable onPress={handleBackToBrowse}>
                    <Text
                      className={`text-lg font-bold ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      Collection
                    </Text>
                  </Pressable>
                  <ChevronRight
                    size={20}
                    color={isDark ? "#64748b" : "#94a3b8"}
                  />
                  <Text
                    className={`text-lg font-bold flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
                    numberOfLines={1}
                  >
                    {activeGroupName}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={handleBackToBrowse}
                  className="flex-row items-center gap-1 flex-1"
                  hitSlop={8}
                >
                  <ChevronLeft
                    size={24}
                    color={isDark ? "#94a3b8" : "#64748b"}
                  />
                  <Text
                    className={`text-lg font-bold flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
                    numberOfLines={1}
                  >
                    {activeGroupName}
                  </Text>
                </Pressable>
              )}
            </View>
            <View className="flex-row items-center gap-2">
              {Platform.OS === "web" && !activeDeckId && (
                <Pressable
                  onPress={() => {
                    if (selectionMode) {
                      setSelectionMode(false);
                      setSelectedCardIds(new Set());
                    }
                    setScryfallSearchVisible(true);
                  }}
                  className={`flex-row items-center gap-1.5 rounded-full p-2 lg:px-3 lg:py-2 lg:rounded-lg ${
                    isDark
                      ? "active:bg-slate-800 lg:hover:bg-slate-800"
                      : "active:bg-slate-100 lg:hover:bg-slate-100"
                  } lg:bg-purple-500/10`}
                >
                  <Plus size={20} color="#7C3AED" />
                  {isDesktop && (
                    <Text className="text-sm font-medium text-purple-500">
                      Add Card
                    </Text>
                  )}
                </Pressable>
              )}
              <Pressable
                onPress={toggleViewMode}
                className={`rounded-full p-2 ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
              >
                {viewMode === "list" ? (
                  <Grid3X3
                    size={20}
                    color={isDark ? "#94a3b8" : "#64748b"}
                  />
                ) : (
                  <List size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                )}
              </Pressable>
            </View>
          </View>

          {/* Search Bar */}
          <View className="px-4 lg:px-6 pt-3 lg:pt-0 pb-3">
            <View
              className={`flex-row items-center rounded-lg border px-3 lg:max-w-sm ${
                searchFocused
                  ? "border-purple-500"
                  : isDark
                    ? "border-slate-700"
                    : "border-slate-200"
              } ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
            >
              <Search size={18} color={isDark ? "#64748b" : "#94a3b8"} />
              <TextInput
                className={`flex-1 py-2.5 px-2 text-base lg:text-sm ${isDark ? "text-white" : "text-slate-900"}`}
                placeholder="Search cards..."
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={searchQuery}
                onChangeText={handleSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                // @ts-ignore - web style
                style={{ outlineStyle: "none" }}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => handleSearch("")}>
                  <X size={18} color={isDark ? "#64748b" : "#94a3b8"} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Sort Pills */}
          <View className="flex-row items-center gap-2 px-4 lg:px-6 pb-3">
            {([
              { key: "date", label: "Date Added", icon: Calendar },
              { key: "name", label: "A-Z", icon: ArrowDownAZ },
              { key: "value", label: "Value", icon: DollarSign },
            ] as const).map(({ key, label, icon: Icon }) => {
              const active = sortBy === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setSortBy(key)}
                  className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
                    active
                      ? "bg-purple-500"
                      : isDark
                        ? "bg-slate-800"
                        : "bg-slate-100"
                  }`}
                >
                  <Icon
                    size={14}
                    color={active ? "#ffffff" : isDark ? "#94a3b8" : "#64748b"}
                  />
                  <Text
                    className={`text-xs font-medium ${
                      active
                        ? "text-white"
                        : isDark
                          ? "text-slate-400"
                          : "text-slate-500"
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Stats Header */}
          <StatsHeader stats={stats} isDark={isDark} />

          {/* Card Content */}
          {loading && cards.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#7C3AED" />
            </View>
          ) : error ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text
                className={`mb-4 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}
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
            <View className="flex-1 items-center justify-center px-6">
              <Text
                className={`mb-2 text-xl font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {searchQuery ? "No Cards Found" : "No Cards"}
              </Text>
              <Text
                className={`mb-6 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                {searchQuery
                  ? "Try a different search term"
                  : "This folder is empty"}
              </Text>
            </View>
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
              onViewableItemsChanged={stableOnViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              windowSize={21}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={15}
              removeClippedSubviews={true}
              contentContainerStyle={
                selectionMode ? { paddingBottom: 80 } : undefined
              }
            />
          ) : (
            <FlatList
              key={`grid-${gridColumns}`}
              data={cards}
              numColumns={gridColumns}
              keyExtractor={(item, index) => item?.id || `placeholder-${index}`}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#7C3AED"
                />
              }
              contentContainerStyle={
                selectionMode ? { paddingBottom: 80 } : undefined
              }
              contentContainerClassName="w-full max-w-content mx-auto px-2 lg:px-6 pb-24"
              renderItem={({ item: card }) =>
                card ? (
                  <CollectionGridItem
                    card={card}
                    isDark={isDark}
                    isDesktopView={isDesktop}
                    onPress={() => handleCardPress(card)}
                    selectionMode={selectionMode}
                    isSelected={selectedCardIds.has(card.id)}
                    onLongPress={() => handleEnterSelectionMode(card.id)}
                    onToggleSelect={() => handleToggleSelect(card.id)}
                    columns={gridColumns}
                  />
                ) : (
                  <View className="p-1" style={{ width: `${100 / gridColumns}%` }}>
                    <View
                      className={`aspect-[488/680] w-full rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                    />
                  </View>
                )
              }
              onViewableItemsChanged={stableOnViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              windowSize={11}
              maxToRenderPerBatch={12}
              initialNumToRender={18}
              removeClippedSubviews={true}
            />
          )}

          {/* Card View FABs */}
          {!isDesktop &&
            !selectionMode &&
            !activeDeckId &&
            Platform.OS !== "web" && (
              <>
                {activeFolderId !== undefined && (
                  <GlassFab icon={Plus} onPress={() => setScryfallSearchVisible(true)} bottom={96} />
                )}
                <GlassFab icon={Camera} onPress={() => setScannerVisible(true)} bottom={24} />
              </>
            )}
        </>
      )}

      {/* Selection Mode Floating Action Bar */}
      {showActionBar && (
        <Animated.View
          style={{
            position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: "center",
            paddingBottom: Math.max(20, insets.bottom),
            transform: [{
              translateY: actionBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [100, 0],
              }),
            }],
            zIndex: 50,
          }}
        >
          <View
            className="flex-row items-center rounded-full px-5 py-2.5 bg-purple-600"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Text className="text-white font-semibold text-sm pr-2">
              {selectedCardIds.size} selected
            </Text>
            <View className="w-px h-5 bg-white/30 mx-1" />
            {isWeb && isDesktop ? (
              <>
                <Pressable
                  onPress={handleCancelSelection}
                  className="flex-row items-center gap-1.5 px-2 py-1"
                >
                  <XCircle size={16} color="#ffffff" />
                  <Text className="text-white text-sm font-medium">Deselect</Text>
                </Pressable>
                <View className="w-px h-5 bg-white/30 mx-1" />
                <Pressable
                  onPress={handleSelectAll}
                  className="flex-row items-center gap-1.5 px-2 py-1"
                >
                  <CheckSquare size={16} color="#ffffff" />
                  <Text className="text-white text-sm font-medium">All</Text>
                </Pressable>
                <View className="w-px h-5 bg-white/30 mx-1" />
                <Pressable
                  onPress={() => setFolderPickerVisible(true)}
                  className="flex-row items-center gap-1.5 px-2 py-1"
                >
                  <FolderOpen size={16} color="#ffffff" />
                  <Text className="text-white text-sm font-medium">Move</Text>
                </Pressable>
                {activeFolderId && activeFolderId !== "unfiled" && (
                  <>
                    <View className="w-px h-5 bg-white/30 mx-1" />
                    <Pressable
                      onPress={() => handleMoveSelectedToFolder(null)}
                      className="flex-row items-center gap-1.5 px-2 py-1"
                    >
                      <Inbox size={16} color="#ffffff" />
                      <Text className="text-white text-sm font-medium">Unfile</Text>
                    </Pressable>
                  </>
                )}
                <View className="w-px h-5 bg-white/30 mx-1" />
                <Pressable
                  onPress={handleBulkDelete}
                  className="flex-row items-center gap-1.5 px-2 py-1"
                >
                  <Trash2 size={16} color="#ffffff" />
                  <Text className="text-white text-sm font-medium">Delete</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => setBulkActionsSheetVisible(true)}
                className="flex-row items-center gap-1.5 px-2 py-1"
              >
                <EllipsisVertical size={16} color="#ffffff" />
                <Text className="text-white text-sm font-medium">Actions</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}

      {/* ==================== BULK ACTIONS SHEET ==================== */}
      <BulkActionsSheet
        visible={bulkActionsSheetVisible}
        onDismiss={() => setBulkActionsSheetVisible(false)}
        isDark={isDark}
        activeFolderId={activeFolderId}
        onSelectAll={() => { setBulkActionsSheetVisible(false); handleSelectAll(); }}
        onDeselect={() => { setBulkActionsSheetVisible(false); handleCancelSelection(); }}
        onMove={() => { setBulkActionsSheetVisible(false); setFolderPickerVisible(true); }}
        onUnfile={() => { setBulkActionsSheetVisible(false); handleMoveSelectedToFolder(null); }}
        onDelete={() => { setBulkActionsSheetVisible(false); handleBulkDelete(); }}
      />

      {/* ==================== MODALS ==================== */}

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

      <AddCardModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleAddCard}
        isDark={isDark}
      />

      <BulkImportModal
        visible={bulkImportModalVisible}
        onClose={() => setBulkImportModalVisible(false)}
        onImport={() => {
          if (currentView === "browse") {
            loadBrowseData();
          } else {
            loadCollection(searchQuery, activeFolderId, activeDeckId);
            loadStats(activeFolderId, activeDeckId);
          }
        }}
        isDark={isDark}
      />

      <FolderNameModal
        visible={createFolderVisible}
        onClose={() => setCreateFolderVisible(false)}
        onSave={handleCreateFolder}
        title="New Folder"
        isDark={isDark}
      />

      <FolderNameModal
        visible={!!renameFolderTarget}
        onClose={() => setRenameFolderTarget(null)}
        onSave={handleRenameFolder}
        initialName={renameFolderTarget?.name}
        title="Rename Folder"
        isDark={isDark}
      />

      <FolderPickerModal
        visible={folderPickerVisible}
        onClose={() => setFolderPickerVisible(false)}
        folders={folders}
        onSelect={handleMoveSelectedToFolder}
        onCreateAndSelect={handleCreateFolderAndMove}
        isDark={isDark}
      />

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Confirm"
        cancelText="Cancel"
        destructive={true}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() =>
          setConfirmDialog((prev) => ({ ...prev, visible: false }))
        }
      />

      <CardScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onComplete={() => {
          setScannerVisible(false);
          if (currentView === "browse") {
            loadBrowseData();
          } else {
            loadCollection(searchQuery, activeFolderId, activeDeckId);
            loadStats(activeFolderId, activeDeckId);
          }
        }}
      />

      <ScryfallSearch
        visible={scryfallSearchVisible}
        onClose={() => setScryfallSearchVisible(false)}
        onSelectCard={handleAddCardFromSearch}
        title="Add Card to Collection"
        placeholder="Search for a card..."
        searchContext="collection"
        existingCardIds={existingCardIds}
      />

      {/* Linked Decks Bottom Sheet */}
      <GlassSheet
        visible={linkedDecksSheet.visible}
        onDismiss={() => setLinkedDecksSheet((prev) => ({ ...prev, visible: false }))}
        isDark={isDark}
        snapPoints={[280]}
      >
        <BottomSheetView style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <Text
            className={`text-lg font-semibold mb-1 ${isDark ? "text-white" : "text-slate-900"}`}
          >
            Linked Decks
          </Text>
          <Text
            className={`text-sm mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            {linkedDecksSheet.cardName}
          </Text>
          {linkedDecksSheet.decks.map((deck) => (
            <View
              key={deck.deckId}
              className={`flex-row items-center gap-3 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-100"}`}
            >
              <View className="h-3 w-3 rounded-full bg-purple-500" />
              <Text className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}>
                {deck.deckName}
              </Text>
            </View>
          ))}
        </BottomSheetView>
      </GlassSheet>
    </SafeAreaView>
  );
}
