import { router, useLocalSearchParams } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudDownload,
  Crown,
  DollarSign,
  Grid3X3,
  History,
  Layers,
  Library,
  Link,
  List,
  MessageSquare,
  Minus,
  MoreVertical,
  Palette,
  Plus,
  RefreshCcw,
  Search,
  Sidebar,
  Unlink,
  X,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ChatPanel } from "~/components/ChatPanel";
import { ScryfallSearch } from "~/components/ScryfallSearch";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { showToast } from "~/lib/toast";
import { Spinner } from "~/components/Spinner";
import { ColorTagManager } from "~/components/ColorTagManager";
import { EditionPickerModal } from "~/components/EditionPickerModal";
import {
  cardsApi,
  decksApi,
  type CardSearchResult,
  type DeckCard,
  type DeckDetail,
} from "~/lib/api";
import { cache, CACHE_KEYS, CACHE_TTL, cachedFetch } from "~/lib/cache";
import { useResponsive } from "~/hooks/useResponsive";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";

// Color identity colors
const MANA_COLORS: Record<string, string> = {
  W: "#F9FAF4",
  U: "#0E68AB",
  B: "#150B00",
  R: "#D3202A",
  G: "#00733E",
};

// Group by options
type GroupBy = "category" | "cardType" | "color" | "cmc" | "rarity";

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "category", label: "Category" },
  { value: "cardType", label: "Card Type" },
  { value: "color", label: "Color" },
  { value: "cmc", label: "Mana Value" },
  { value: "rarity", label: "Rarity" },
];

const GROUP_COLORS: Record<GroupBy, Record<string, string>> = {
  category: {
    Commander: "#eab308",
    Mainboard: "#22c55e",
    Sideboard: "#f97316",
  },
  cardType: {
    Creature: "#22c55e",
    Instant: "#3b82f6",
    Sorcery: "#ef4444",
    Enchantment: "#a855f7",
    Artifact: "#78716c",
    Planeswalker: "#f97316",
    Land: "#84cc16",
    Battle: "#ec4899",
    Other: "#64748b",
  },
  color: {
    White: "#F9FAF4",
    Blue: "#0E68AB",
    Black: "#150B00",
    Red: "#D3202A",
    Green: "#00733E",
    Colorless: "#94a3b8",
    Multicolor: "#eab308",
  },
  cmc: {
    "0": "#e2e8f0",
    "1": "#bfdbfe",
    "2": "#93c5fd",
    "3": "#60a5fa",
    "4": "#3b82f6",
    "5": "#2563eb",
    "6": "#1d4ed8",
    "7+": "#1e40af",
  },
  rarity: {
    Common: "#1f2937",
    Uncommon: "#6b7280",
    Rare: "#eab308",
    Mythic: "#ea580c",
  },
};

// Basic land names
const BASIC_LAND_NAMES = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
  "Wastes",
  "Snow-Covered Plains",
  "Snow-Covered Island",
  "Snow-Covered Swamp",
  "Snow-Covered Mountain",
  "Snow-Covered Forest",
]);

// Helper to check if a card is a basic land
function isBasicLand(cardName: string): boolean {
  return BASIC_LAND_NAMES.has(cardName);
}

// Basic land display info
const BASIC_LAND_INFO: Record<
  string,
  { color: string; textColor: string; symbol: string; displayColor: string }
> = {
  Plains: {
    color: "#F9FAF4",
    textColor: "#000",
    symbol: "W",
    displayColor: "#FFF8DC",
  },
  Island: {
    color: "#0E68AB",
    textColor: "#fff",
    symbol: "U",
    displayColor: "#4A9FDF",
  },
  Swamp: {
    color: "#150B00",
    textColor: "#fff",
    symbol: "B",
    displayColor: "#8A7C64",
  },
  Mountain: {
    color: "#D3202A",
    textColor: "#fff",
    symbol: "R",
    displayColor: "#F87171",
  },
  Forest: {
    color: "#00733E",
    textColor: "#fff",
    symbol: "G",
    displayColor: "#4ADE80",
  },
  Wastes: {
    color: "#BFA98A",
    textColor: "#000",
    symbol: "C",
    displayColor: "#BFA98A",
  },
  "Snow-Covered Plains": {
    color: "#F9FAF4",
    textColor: "#000",
    symbol: "W",
    displayColor: "#FFF8DC",
  },
  "Snow-Covered Island": {
    color: "#0E68AB",
    textColor: "#fff",
    symbol: "U",
    displayColor: "#4A9FDF",
  },
  "Snow-Covered Swamp": {
    color: "#150B00",
    textColor: "#fff",
    symbol: "B",
    displayColor: "#8A7C64",
  },
  "Snow-Covered Mountain": {
    color: "#D3202A",
    textColor: "#fff",
    symbol: "R",
    displayColor: "#F87171",
  },
  "Snow-Covered Forest": {
    color: "#00733E",
    textColor: "#fff",
    symbol: "G",
    displayColor: "#4ADE80",
  },
};

// Standard land order for display
const STANDARD_LAND_ORDER = ["Plains", "Island", "Swamp", "Mountain", "Forest"];

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
        className="h-5 w-5 rounded-full border"
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
          className="h-5 w-5 rounded-full border"
          style={{
            backgroundColor: MANA_COLORS[color] || "#888",
            borderColor: isDark ? "#475569" : "#cbd5e1",
          }}
        />
      ))}
    </View>
  );
}

function CardListItem({
  card,
  isDark,
  isDesktop,
  onPress,
  onLongPress,
  onRightClick,
}: {
  card: DeckCard;
  isDark: boolean;
  isDesktop?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onRightClick?: (position: { x: number; y: number }) => void;
}) {
  const handleContextMenu = (e: any) => {
    if (isDesktop && onRightClick) {
      e.preventDefault();
      onRightClick({ x: e.clientX, y: e.clientY });
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      // @ts-ignore - onContextMenu is valid on web
      onContextMenu={handleContextMenu}
      className={`relative flex-row items-center gap-3 pr-4 lg:pr-6 overflow-hidden ${
        isDark
          ? "active:bg-slate-800/50 lg:hover:bg-slate-800/50"
          : "active:bg-slate-50 lg:hover:bg-slate-50"
      }`}
    >
      <View className="relative h-12 w-12">
        {card.imageArtCrop ? (
          <Image
            source={{ uri: card.imageArtCrop }}
            className="h-12 w-12"
            resizeMode="cover"
          />
        ) : (
          <View
            className={`h-10 w-10 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
          />
        )}
        {/* Color tag indicator - diagonal corner */}
        {card.colorTag && (
          <View
            className="absolute top-0 left-0"
            style={{
              width: 0,
              height: 0,
              borderTopWidth: 16,
              borderRightWidth: 16,
              borderTopColor: card.colorTag,
              borderRightColor: "transparent",
            }}
          />
        )}
      </View>
      <View className="flex-1">
        <Text
          className={`text-sm font-medium ${
            isDark ? "text-white" : "text-slate-900"
          }`}
          numberOfLines={1}
        >
          {card.name}
        </Text>
        <View className="flex-row items-center gap-2">
          {card.manaCost && (
            <Text
              className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              {card.manaCost}
            </Text>
          )}
          {card.typeLine && (
            <Text
              className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
              numberOfLines={1}
            >
              {card.typeLine.split("—")[0].trim()}
            </Text>
          )}
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        {/* Collection status icons */}
        {card.isLinkedToCollection ? (
          <View className="flex-row items-center">
            <Link size={14} color="#7C3AED" />
          </View>
        ) : card.inCollection && card.hasAvailableCollectionCard ? (
          <Library size={14} color={isDark ? "#94a3b8" : "#64748b"} />
        ) : card.inCollectionDifferentPrint &&
          card.hasAvailableCollectionCard ? (
          <AlertCircle size={14} color="#f59e0b" />
        ) : null}
        <Text
          className={`text-sm font-medium ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {card.quantity}x
        </Text>
      </View>
    </Pressable>
  );
}

function CardGridItem({
  card,
  isDark,
  isDesktop,
  onPress,
  onLongPress,
  onRightClick,
}: {
  card: DeckCard;
  isDark: boolean;
  isDesktop?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onRightClick?: (position: { x: number; y: number }) => void;
}) {
  // Use full card image for grid view
  const imageUri = card.imageUrl || card.imageSmall;

  const handleContextMenu = (e: any) => {
    if (isDesktop && onRightClick) {
      e.preventDefault();
      onRightClick({ x: e.clientX, y: e.clientY });
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      // @ts-ignore - onContextMenu is valid on web
      onContextMenu={handleContextMenu}
      className="p-1"
      style={{ width: "25%" }}
    >
      <View className="relative">
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            className="aspect-[488/680] w-full rounded-lg"
            resizeMode="contain"
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
        {card.quantity > 1 && (
          <View className="absolute top-1 right-1 bg-black/70 rounded-full px-1.5 py-0.5">
            <Text className="text-xs font-bold text-white">
              {card.quantity}x
            </Text>
          </View>
        )}
        {/* Color tag indicator - diagonal corner using border trick */}
        {card.colorTag && (
          <View
            className="absolute top-0 left-0"
            style={{
              width: 0,
              height: 0,
              borderTopWidth: 28,
              borderRightWidth: 28,
              borderTopColor: card.colorTag,
              borderRightColor: "transparent",
            }}
          />
        )}
        {/* Collection status icon */}
        {(card.isLinkedToCollection ||
          (card.inCollection && card.hasAvailableCollectionCard) ||
          (card.inCollectionDifferentPrint &&
            card.hasAvailableCollectionCard)) && (
          <View className="absolute bottom-1 left-1 bg-black/70 rounded-full p-1">
            {card.isLinkedToCollection ? (
              <Link size={16} color="#7C3AED" />
            ) : card.inCollection ? (
              <Library size={16} color="#94a3b8" />
            ) : (
              <AlertCircle size={16} color="#f59e0b" />
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

interface CardSection {
  title: string;
  data: DeckCard[];
}

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();

  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["Commander", "Mainboard", "Sideboard"]),
  );
  const [landsExpanded, setLandsExpanded] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const menuButtonRef = useRef<View>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [groupByMenuVisible, setGroupByMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [scryfallSearchVisible, setScryfallSearchVisible] = useState(false);
  const [colorTagManagerVisible, setColorTagManagerVisible] = useState(false);
  const [chatPanelVisible, setChatPanelVisible] = useState(false);

  // Card action sheet state
  const [actionSheetCard, setActionSheetCard] = useState<DeckCard | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [colorTagPickerVisible, setColorTagPickerVisible] = useState(false);
  const [colorTagSubmenuOpen, setColorTagSubmenuOpen] = useState(false);
  const [headerColorTagDropdownOpen, setHeaderColorTagDropdownOpen] = useState(false);
  const [editionPickerVisible, setEditionPickerVisible] = useState(false);
  const [editionPickerModalVisible, setEditionPickerModalVisible] =
    useState(false);
  const [editions, setEditions] = useState<CardSearchResult[]>([]);
  const [loadingEditions, setLoadingEditions] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Printing selection modal state
  const [printingSelection, setPrintingSelection] = useState<{
    visible: boolean;
    cardName: string;
    printings: Array<{
      id: string;
      setCode: string;
      collectorNumber: string;
      quantity: number;
      foilQuantity: number;
      scryfallId: string;
      linkedTo?: { deckId: string; deckName: string };
    }>;
    currentScryfallId: string;
  }>({
    visible: false,
    cardName: "",
    printings: [],
    currentScryfallId: "",
  });

  // Already linked confirmation state
  const [alreadyLinkedConfirm, setAlreadyLinkedConfirm] = useState<{
    visible: boolean;
    cardName: string;
    linkedDeck: { deckId: string; deckName: string };
    collectionCardId?: string;
  }>({
    visible: false,
    cardName: "",
    linkedDeck: { deckId: "", deckName: "" },
  });

  const loadDeck = useCallback(
    async (skipCache = false) => {
      if (!id) return;

      try {
        setError(null);

        if (skipCache) {
          await cache.remove(CACHE_KEYS.DECK_DETAIL(id));
        }

        const result = await cachedFetch(
          CACHE_KEYS.DECK_DETAIL(id),
          CACHE_TTL.DECK_DETAIL,
          () => decksApi.get(id),
        );

        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          setDeck(result.data);
        }
      } catch (err) {
        setError("Failed to load deck");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadDeck(true);
  }, [loadDeck]);

  const pollForSyncComplete = useCallback(() => {
    const checkSync = async () => {
      const result = await decksApi.get(id!);
      if (result.data) {
        setDeck(result.data);
        // Check if sync is complete
        if (
          result.data.syncStatus === "synced" ||
          result.data.syncStatus === "error"
        ) {
          setSyncing(false);
          setRefreshing(false);
        } else {
          // Keep polling
          setTimeout(checkSync, 2000);
        }
      } else {
        setSyncing(false);
      }
    };
    checkSync();
  }, [id]);

  const performSync = useCallback(async () => {
    if (!deck?.archidektId) return;

    setSyncing(true);
    try {
      const result = await decksApi.syncFromArchidekt(deck.archidektId);
      if (result.error) {
        setError(result.error);
      } else {
        // Clear cache and reload to get fresh data
        await cache.remove(CACHE_KEYS.DECK_DETAIL(id!));
        await cache.remove(CACHE_KEYS.DECKS_LIST);
        // Poll for sync completion
        pollForSyncComplete();
      }
    } catch (err) {
      setError("Failed to sync deck");
      setSyncing(false);
    }
  }, [deck?.archidektId, id, pollForSyncComplete]);

  const handlePullFromArchidekt = useCallback(() => {
    setMenuVisible(false);

    // If deck has been synced before, show confirmation
    if (deck?.syncStatus === "synced") {
      setConfirmDialog({
        visible: true,
        title: "Pull from Archidekt",
        message:
          "This will overwrite any local changes you've made to this deck. Are you sure?",
        onConfirm: () => {
          setConfirmDialog((prev) => ({ ...prev, visible: false }));
          performSync();
        },
      });
    } else {
      // First sync, no confirmation needed
      performSync();
    }
  }, [deck?.syncStatus, performSync]);

  const openMenu = useCallback(() => {
    menuButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setMenuPosition({ top: pageY + height + 4, right: 16 });
      setMenuVisible(true);
    });
  }, []);

  useEffect(() => {
    loadDeck();

    // Load saved view mode preference
    cache.get<"list" | "grid">(CACHE_KEYS.VIEW_MODE).then((mode) => {
      if (mode) setViewMode(mode);
    });
  }, [loadDeck]);

  const toggleViewMode = () => {
    const newMode = viewMode === "list" ? "grid" : "list";
    setViewMode(newMode);
    cache.set(CACHE_KEYS.VIEW_MODE, newMode, 60 * 24 * 30);
  };

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  // Group cards based on groupBy setting
  const getGroupKey = useCallback(
    (card: DeckCard): string => {
      switch (groupBy) {
        case "category":
          if (card.isCommander) return "Commander";
          return "Mainboard"; // We handle sideboard separately in sections

        case "cardType":
          if (!card.typeLine) return "Other";
          const typeLine = card.typeLine.toLowerCase();
          if (typeLine.includes("creature")) return "Creature";
          if (typeLine.includes("instant")) return "Instant";
          if (typeLine.includes("sorcery")) return "Sorcery";
          if (typeLine.includes("enchantment")) return "Enchantment";
          if (typeLine.includes("artifact")) return "Artifact";
          if (typeLine.includes("planeswalker")) return "Planeswalker";
          if (typeLine.includes("land")) return "Land";
          if (typeLine.includes("battle")) return "Battle";
          return "Other";

        case "color":
          const colors = card.colors || [];
          if (colors.length === 0) {
            // Check if it's a land
            if (card.typeLine?.toLowerCase().includes("land")) return "Land";
            return "Colorless";
          }
          if (colors.length > 1) return "Multicolor";
          const colorMap: Record<string, string> = {
            W: "White",
            U: "Blue",
            B: "Black",
            R: "Red",
            G: "Green",
          };
          return colorMap[colors[0]] || "Other";

        case "cmc":
          const manaCost = card.manaCost || "";
          // Parse mana cost to get CMC
          let cmc = 0;
          const matches = manaCost.match(/\{([^}]+)\}/g) || [];
          for (const match of matches) {
            const symbol = match.replace(/[{}]/g, "");
            if (symbol === "X") continue;
            const num = parseInt(symbol);
            if (!isNaN(num)) {
              cmc += num;
            } else if (symbol !== "") {
              cmc += 1; // Colored mana symbols
            }
          }
          if (cmc >= 7) return "7+";
          return String(cmc);

        case "rarity":
          const rarity = card.rarity?.toLowerCase() || "common";
          return rarity.charAt(0).toUpperCase() + rarity.slice(1);

        default:
          return "Other";
      }
    },
    [groupBy],
  );

  // Separate basic lands from other cards
  const { basicLands, nonBasicCards } = useMemo(() => {
    if (!deck)
      return {
        basicLands: [] as DeckCard[],
        nonBasicCards: {
          commanders: [] as DeckCard[],
          mainboard: [] as DeckCard[],
          sideboard: [] as DeckCard[],
        },
      };

    const basics: DeckCard[] = [];
    const commanders: DeckCard[] = [];
    const mainboard: DeckCard[] = [];
    const sideboard: DeckCard[] = [];

    // Process commanders (shouldn't have basic lands, but just in case)
    for (const card of deck.commanders) {
      if (isBasicLand(card.name)) {
        basics.push(card);
      } else {
        commanders.push(card);
      }
    }

    // Process mainboard
    for (const card of deck.mainboard) {
      if (isBasicLand(card.name)) {
        basics.push(card);
      } else {
        mainboard.push(card);
      }
    }

    // Process sideboard
    for (const card of deck.sideboard) {
      if (isBasicLand(card.name)) {
        basics.push(card);
      } else {
        sideboard.push(card);
      }
    }

    return {
      basicLands: basics,
      nonBasicCards: { commanders, mainboard, sideboard },
    };
  }, [deck]);

  // Group basic lands by name with counts - always include all 5 standard types
  const basicLandCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    // Start with all standard land types at 0
    for (const land of STANDARD_LAND_ORDER) {
      counts[land] = 0;
    }

    // Add counts from deck
    for (const card of basicLands) {
      if (!counts.hasOwnProperty(card.name)) {
        counts[card.name] = 0;
      }
      counts[card.name] += card.quantity;
    }

    return counts;
  }, [basicLands]);

  const totalBasicLands = useMemo(() => {
    return Object.values(basicLandCounts).reduce((sum, qty) => sum + qty, 0);
  }, [basicLandCounts]);

  // Build sections from deck data (excluding basic lands)
  const sections: CardSection[] = useMemo(() => {
    if (!deck) return [];

    const result: CardSection[] = [];

    if (groupBy === "category") {
      // Use original category-based grouping
      if (nonBasicCards.commanders.length > 0) {
        result.push({ title: "Commander", data: nonBasicCards.commanders });
      }
      if (nonBasicCards.mainboard.length > 0) {
        result.push({ title: "Mainboard", data: nonBasicCards.mainboard });
      }
      if (nonBasicCards.sideboard.length > 0) {
        result.push({ title: "Sideboard", data: nonBasicCards.sideboard });
      }
    } else {
      // Group all cards by the selected criteria (excluding basic lands)
      const allCards = [
        ...nonBasicCards.commanders,
        ...nonBasicCards.mainboard,
        ...nonBasicCards.sideboard,
      ];
      const grouped: Record<string, DeckCard[]> = {};

      for (const card of allCards) {
        const key = getGroupKey(card);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(card);
      }

      // Sort groups and create sections
      const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
        // Custom sort order for CMC
        if (groupBy === "cmc") {
          const aNum = a === "7+" ? 7 : parseInt(a);
          const bNum = b === "7+" ? 7 : parseInt(b);
          return aNum - bNum;
        }
        // Custom sort order for rarity
        if (groupBy === "rarity") {
          const rarityOrder = ["Common", "Uncommon", "Rare", "Mythic"];
          return rarityOrder.indexOf(a) - rarityOrder.indexOf(b);
        }
        return a.localeCompare(b);
      });

      for (const [title, data] of sortedGroups) {
        if (data.length > 0) {
          result.push({ title, data });
        }
      }
    }

    return result;
  }, [deck, groupBy, getGroupKey, nonBasicCards]);

  // Get color for a group based on groupBy type
  const getGroupColor = useCallback(
    (groupName: string): string => {
      return GROUP_COLORS[groupBy]?.[groupName] || "#64748b";
    },
    [groupBy],
  );

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;

    const query = searchQuery.toLowerCase().trim();
    const result: CardSection[] = [];

    for (const section of sections) {
      const matchingCards = section.data.filter(
        (card) =>
          card.name.toLowerCase().includes(query) ||
          card.typeLine?.toLowerCase().includes(query) ||
          card.manaCost?.toLowerCase().includes(query),
      );
      if (matchingCards.length > 0) {
        result.push({ title: section.title, data: matchingCards });
      }
    }

    return result;
  }, [sections, searchQuery]);

  // Expand all matching groups when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedSections(new Set(filteredSections.map((s) => s.title)));
    }
  }, [searchQuery, filteredSections]);

  // Expand all sections when groupBy changes
  useEffect(() => {
    if (sections.length > 0 && !searchQuery.trim()) {
      setExpandedSections(new Set(sections.map((s) => s.title)));
    }
  }, [groupBy, sections, searchQuery]);

  // Flatten all cards for navigation (use filtered sections for card detail navigation)
  const allCards = useMemo(() => {
    return filteredSections.flatMap((section) => section.data);
  }, [filteredSections]);

  const selectedCardIndex = useMemo(() => {
    if (!selectedCard) return -1;
    return allCards.findIndex((c) => c.id === selectedCard.id);
  }, [allCards, selectedCard]);

  const handleCardPress = useCallback((card: DeckCard) => {
    setSelectedCard(card);
    setCardModalVisible(true);
  }, []);

  const handlePrevCard = useCallback(() => {
    if (selectedCardIndex > 0) {
      setSelectedCard(allCards[selectedCardIndex - 1]);
    }
  }, [selectedCardIndex, allCards]);

  const handleNextCard = useCallback(() => {
    if (selectedCardIndex < allCards.length - 1) {
      setSelectedCard(allCards[selectedCardIndex + 1]);
    }
  }, [selectedCardIndex, allCards]);

  const closeCardModal = useCallback(() => {
    setCardModalVisible(false);
    setSelectedCard(null);
  }, []);

  // Long press to open action sheet
  const handleCardLongPress = useCallback((card: DeckCard) => {
    setActionSheetCard(card);
    setActionSheetVisible(true);
  }, []);

  // Right-click to open context menu (desktop)
  const handleCardRightClick = useCallback(
    (card: DeckCard, position: { x: number; y: number }) => {
      setActionSheetCard(card);
      setContextMenuPosition(position);
    },
    [],
  );

  const closeActionSheet = useCallback(() => {
    setActionSheetVisible(false);
    setContextMenuPosition(null);
    setActionSheetCard(null);
    setColorTagPickerVisible(false);
    setColorTagSubmenuOpen(false);
    setEditionPickerVisible(false);
    setEditions([]);
  }, []);

  // Action sheet handlers
  const handleSetCommander = useCallback(
    async (cardOverride?: DeckCard) => {
      const card = cardOverride ?? actionSheetCard;
      if (!card || !deck) return;
      setActionLoading(true);
      try {
        const result = await decksApi.setCardCommander(
          deck.id,
          card.name,
          !card.isCommander,
        );
        if (result.error) {
          showToast.error(result.error);
        } else {
          await cache.remove(CACHE_KEYS.DECK_DETAIL(id!));
          loadDeck(true);
          closeActionSheet();
        }
      } catch (err) {
        showToast.error("Failed to update commander status");
      } finally {
        setActionLoading(false);
      }
    },
    [actionSheetCard, deck, id, loadDeck, closeActionSheet],
  );

  const handleMoveToSideboard = useCallback(
    async (cardOverride?: DeckCard) => {
      const card = cardOverride ?? actionSheetCard;
      if (!card || !deck) return;
      const isSideboard = card.categories?.includes("Sideboard");
      const newCategory = isSideboard ? "mainboard" : "sideboard";

      setActionLoading(true);
      try {
        const result = await decksApi.setCardCategory(
          deck.id,
          card.name,
          newCategory,
        );
        if (result.error) {
          showToast.error(result.error);
        } else {
          await cache.remove(CACHE_KEYS.DECK_DETAIL(id!));
          loadDeck(true);
          closeActionSheet();
        }
      } catch (err) {
        showToast.error("Failed to move card");
      } finally {
        setActionLoading(false);
      }
    },
    [actionSheetCard, deck, id, loadDeck, closeActionSheet],
  );

  const handleSetColorTag = useCallback(
    async (tag: string | null) => {
      if (!actionSheetCard || !deck) return;
      const cardName = actionSheetCard.name;
      const deckId = deck.id;

      // Close menus immediately for better UX
      setColorTagPickerVisible(false);
      setColorTagSubmenuOpen(false);
      setContextMenuPosition(null);
      setActionSheetVisible(false);

      setActionLoading(true);
      try {
        const result = await decksApi.updateCardTag(deckId, cardName, tag);
        if (result.error) {
          showToast.error(result.error);
        } else {
          await cache.remove(CACHE_KEYS.DECK_DETAIL(id!));
          loadDeck(true);
        }
      } catch (err) {
        showToast.error("Failed to update color tag");
      } finally {
        setActionLoading(false);
        setActionSheetCard(null);
      }
    },
    [actionSheetCard, deck, id, loadDeck],
  );

  const handleHeaderSetColorTag = useCallback(
    async (tag: string | null) => {
      if (!selectedCard || !deck) return;
      const cardName = selectedCard.name;
      const deckId = deck.id;

      setHeaderColorTagDropdownOpen(false);

      // Optimistically update the selected card immediately
      setSelectedCard((prev) =>
        prev ? { ...prev, colorTag: tag ?? undefined } : null
      );

      setActionLoading(true);
      try {
        const result = await decksApi.updateCardTag(deckId, cardName, tag);
        if (result.error) {
          showToast.error(result.error);
          // Revert on error
          setSelectedCard((prev) =>
            prev ? { ...prev, colorTag: selectedCard.colorTag } : null
          );
        } else {
          await cache.remove(CACHE_KEYS.DECK_DETAIL(id!));
          loadDeck(true);
        }
      } catch (err) {
        showToast.error("Failed to update color tag");
        // Revert on error
        setSelectedCard((prev) =>
          prev ? { ...prev, colorTag: selectedCard.colorTag } : null
        );
      } finally {
        setActionLoading(false);
      }
    },
    [selectedCard, deck, id, loadDeck],
  );

  const handleShowEditions = useCallback(async () => {
    if (!actionSheetCard) return;
    setEditionPickerVisible(true);
    setLoadingEditions(true);
    setEditions([]); // Clear previous editions
    try {
      console.log(`[Editions] Fetching editions for: ${actionSheetCard.name}`);
      const result = await cardsApi.getPrints(actionSheetCard.name);
      console.log(`[Editions] Result:`, result);
      if (result.error) {
        showToast.error(result.error);
      } else if (result.data) {
        console.log(`[Editions] Found ${result.data.length} editions`);
        setEditions(result.data);
        if (result.data.length === 0) {
          showToast.info("No editions found for this card");
        }
      }
    } catch (err: any) {
      console.error("[Editions] Error:", err);
      showToast.error(err?.message || "Failed to load editions");
    } finally {
      setLoadingEditions(false);
    }
  }, [actionSheetCard]);

  const handleChangeEdition = useCallback(
    async (scryfallId: string) => {
      if (!actionSheetCard || !deck) return;
      setActionLoading(true);
      try {
        const result = await decksApi.changeCardEdition(
          deck.id,
          actionSheetCard.name,
          scryfallId,
        );
        if (result.error) {
          showToast.error(result.error);
        } else {
          await cache.remove(CACHE_KEYS.DECK_DETAIL(id!));
          loadDeck(true);
          closeActionSheet();
        }
      } catch (err) {
        showToast.error("Failed to change edition");
      } finally {
        setActionLoading(false);
      }
    },
    [actionSheetCard, deck, id, loadDeck, closeActionSheet],
  );

  const handleLinkToCollection = useCallback(
    async (collectionCardId?: string, forceUnlink?: boolean) => {
      if (!actionSheetCard || !deck) return;
      setActionLoading(true);
      try {
        const result = await decksApi.linkCardToCollection(
          deck.id,
          actionSheetCard.name,
          collectionCardId,
          forceUnlink,
        );

        console.log(
          "[LinkToCollection] Result:",
          JSON.stringify(result, null, 2),
        );

        if (result.error) {
          console.error("[LinkToCollection] Error:", result.error);
          showToast.error(result.error);
        } else if (result.data?.alreadyLinked) {
          // Card is already linked to another deck - show confirmation
          setActionLoading(false);
          setAlreadyLinkedConfirm({
            visible: true,
            cardName: actionSheetCard.name,
            linkedDeck: result.data.alreadyLinked,
            collectionCardId,
          });
          return;
        } else if (
          result.data?.needsSelection &&
          result.data.availablePrintings
        ) {
          // Multiple printings available - show selection dialog
          setActionLoading(false);
          const printings = result.data.availablePrintings;

          setPrintingSelection({
            visible: true,
            cardName: actionSheetCard.name,
            printings,
            currentScryfallId: actionSheetCard.scryfallId,
          });
          return;
        } else {
          const message = result.data?.editionChanged
            ? "Card edition updated and linked to collection"
            : "Card linked to collection";
          showToast.success(message);
          // Refresh deck to update collection status
          cache.remove(CACHE_KEYS.DECK_DETAIL(deck.id));
          loadDeck(true);
          closeActionSheet();
        }
      } catch (err: any) {
        console.error("[LinkToCollection] Exception:", err);
        showToast.error(err?.message || "Failed to link card");
      } finally {
        setActionLoading(false);
      }
    },
    [actionSheetCard, deck, closeActionSheet, loadDeck],
  );

  const handleAddCardFromSearch = useCallback(
    async (card: CardSearchResult) => {
      if (!deck) return;

      // Close the search modal and dismiss keyboard
      setScryfallSearchVisible(false);

      try {
        const result = await decksApi.addCardToDeck(
          deck.id,
          card.scryfallId,
          1,
        );
        if (result.error) {
          showToast.error(result.error);
        } else if (result.data) {
          showToast.success(`Added ${result.data.cardName} to deck`);
          // Refresh deck
          cache.remove(CACHE_KEYS.DECK_DETAIL(deck.id));
          loadDeck(true);
        }
      } catch (err: any) {
        showToast.error(err?.message || "Failed to add card");
      }
    },
    [deck, loadDeck],
  );

  const handleUnlinkFromCollection = useCallback(async () => {
    if (!actionSheetCard || !deck) return;
    setActionLoading(true);
    try {
      const result = await decksApi.unlinkCardFromCollection(
        deck.id,
        actionSheetCard.name,
      );
      if (result.error) {
        showToast.error(result.error);
      } else {
        showToast.success("Card unlinked from collection");
        // Refresh deck to update collection status
        cache.remove(CACHE_KEYS.DECK_DETAIL(deck.id));
        loadDeck(true);
        closeActionSheet();
      }
    } catch (err) {
      showToast.error("Failed to unlink card");
    } finally {
      setActionLoading(false);
    }
  }, [actionSheetCard, deck, closeActionSheet, loadDeck]);

  const handleRemoveCard = useCallback(() => {
    if (!actionSheetCard || !deck) return;

    const cardToRemove = actionSheetCard.name;
    const deckId = deck.id;

    closeActionSheet();

    setConfirmDialog({
      visible: true,
      title: "Remove Card",
      message: `Remove ${cardToRemove} from this deck?`,
      confirmText: "Remove",
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, visible: false }));

        const performRemove = async () => {
          try {
            const result = await decksApi.removeCardFromDeck(
              deckId,
              cardToRemove,
            );
            if (result.error) {
              showToast.error(result.error);
            } else {
              showToast.success(`Removed ${cardToRemove} from deck`);
              cache.remove(CACHE_KEYS.DECK_DETAIL(deckId));
              loadDeck(true);
            }
          } catch (err: any) {
            showToast.error(err?.message || "Failed to remove card");
          }
        };

        performRemove();
      },
    });
  }, [actionSheetCard, deck, closeActionSheet, loadDeck]);

  // Handle land quantity change
  const handleLandQuantityChange = useCallback(
    async (landName: string, delta: number) => {
      if (!deck) return;

      try {
        const result = await decksApi.updateCardQuantity(
          deck.id,
          landName,
          delta,
        );
        if (result.error) {
          showToast.error(result.error);
          return;
        }

        // Reload the deck to get updated data
        await cache.remove(CACHE_KEYS.DECK_DETAIL(id!));
        await cache.remove(CACHE_KEYS.DECKS_LIST);
        loadDeck(true);
      } catch (err) {
        showToast.error("Failed to update land quantity");
      }
    },
    [deck, id, loadDeck],
  );

  // Define page content once to avoid duplication
  const pageContent = (
    <>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 lg:px-6 py-3 lg:py-4">
        <View className="flex-row items-center gap-3 flex-1">
          {/* Mobile: Back arrow */}
          {!isDesktop && (
            <Pressable
              onPress={() => router.push("/(tabs)/decks")}
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
                <Text
                  className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  numberOfLines={1}
                >
                  {deck?.name || "Loading..."}
                </Text>
              </View>
            )}
            <Text
              className={`text-lg lg:text-2xl font-bold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
              numberOfLines={1}
            >
              {deck?.name || "Loading..."}
            </Text>
            {deck && (
              <View className="flex-row items-center gap-2 lg:gap-3 mt-0.5 lg:mt-1">
                <ColorIdentityPills
                  colors={deck.colorIdentity}
                  isDark={isDark}
                />
                {deck.format && (
                  <Text
                    className={`text-xs lg:text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
                  >
                    {deck.format}
                  </Text>
                )}
                <Text
                  className={`text-xs lg:text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  {deck.cardCount} cards
                </Text>
              </View>
            )}
          </View>
        </View>
        <View className="flex-row items-center gap-1 lg:gap-2">
          {/* Add Card from Scryfall */}
          <Pressable
            onPress={() => setScryfallSearchVisible(true)}
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
          {/* Color Tag Manager */}
          <Pressable
            onPress={() => setColorTagManagerVisible(true)}
            className={`flex-row items-center gap-1.5 rounded-full p-2 lg:px-3 lg:py-2 lg:rounded-lg ${
              isDark
                ? "active:bg-slate-800 lg:hover:bg-slate-800 lg:bg-slate-800"
                : "active:bg-slate-100 lg:hover:bg-slate-100 lg:bg-slate-100"
            }`}
          >
            <Palette size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            {isDesktop && (
              <Text
                className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}
              >
                Tags
              </Text>
            )}
          </Pressable>
          {/* Menu */}
          <View ref={menuButtonRef} collapsable={false}>
            <Pressable
              onPress={openMenu}
              disabled={syncing}
              className={`flex-row items-center gap-1.5 rounded-full p-2 lg:px-3 lg:py-2 lg:rounded-lg ${
                isDark
                  ? "active:bg-slate-800 lg:hover:bg-slate-800 lg:bg-slate-800"
                  : "active:bg-slate-100 lg:hover:bg-slate-100 lg:bg-slate-100"
              }`}
            >
              {syncing ? (
                <Spinner
                  size={20}
                  strokeWidth={2}
                  color="#7C3AED"
                  backgroundColor={
                    isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
                  }
                />
              ) : (
                <>
                  <MoreVertical
                    size={20}
                    color={isDark ? "#94a3b8" : "#64748b"}
                  />
                  {isDesktop && (
                    <Text
                      className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}
                    >
                      More
                    </Text>
                  )}
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Sticky Toolbar */}
      <View
        className={`flex-row items-center justify-between px-3 lg:px-6 py-2 lg:py-3 border-b ${
          isDark
            ? "bg-slate-900 border-slate-800"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <View className="flex-row items-center gap-2 lg:gap-3">
          {/* Group By Button with Desktop Dropdown */}
          <View className="relative">
            <Pressable
              onPress={() => setGroupByMenuVisible(true)}
              className={`flex-row items-center gap-1.5 px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg ${
                isDark
                  ? "bg-slate-800 lg:hover:bg-slate-700"
                  : "bg-white border border-slate-200 lg:hover:bg-slate-50"
              }`}
            >
              <Layers size={14} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-xs lg:text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                {GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label ||
                  "Group"}
              </Text>
            </Pressable>

            {/* Desktop Dropdown */}
            {isDesktop && groupByMenuVisible && (
              <>
                {/* Backdrop to close on outside click */}
                <Pressable
                  className="fixed inset-0 z-40"
                  onPress={() => setGroupByMenuVisible(false)}
                />
                <View
                  className={`absolute left-0 top-full mt-1 w-[200px] rounded-xl border shadow-xl z-50 ${
                    isDark
                      ? "border-slate-700 bg-slate-800"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <Text
                    className={`px-4 py-3 text-sm font-semibold border-b ${
                      isDark
                        ? "text-slate-300 border-slate-700"
                        : "text-slate-700 border-slate-200"
                    }`}
                  >
                    Group Cards By
                  </Text>
                  {GROUP_BY_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setGroupBy(option.value);
                        setGroupByMenuVisible(false);
                        if (deck) {
                          const allTitles = new Set<string>();
                          if (option.value === "category") {
                            allTitles.add("Commander");
                            allTitles.add("Mainboard");
                            allTitles.add("Sideboard");
                          } else {
                            Object.keys(
                              GROUP_COLORS[option.value] || {},
                            ).forEach((k) => allTitles.add(k));
                          }
                          setExpandedSections(allTitles);
                        }
                      }}
                      className={`flex-row items-center justify-between px-4 py-3 ${
                        isDark ? "hover:bg-slate-700" : "hover:bg-slate-100"
                      }`}
                    >
                      <Text
                        className={isDark ? "text-white" : "text-slate-900"}
                      >
                        {option.label}
                      </Text>
                      {groupBy === option.value && (
                        <Check size={18} color="#7C3AED" />
                      )}
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>

          {/* Search Toggle */}
          <Pressable
            onPress={() => {
              setSearchVisible(!searchVisible);
              if (searchVisible) setSearchQuery("");
            }}
            className={`flex-row items-center gap-1.5 p-2 lg:px-4 lg:py-2 rounded-lg ${
              searchVisible
                ? "bg-purple-500/20"
                : isDark
                  ? "bg-slate-800 lg:hover:bg-slate-700"
                  : "bg-white border border-slate-200 lg:hover:bg-slate-50"
            }`}
          >
            <Search
              size={14}
              color={searchVisible ? "#7C3AED" : isDark ? "#94a3b8" : "#64748b"}
            />
            {isDesktop && (
              <Text
                className={`text-sm font-medium ${searchVisible ? "text-purple-500" : isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                Search
              </Text>
            )}
          </Pressable>

          {/* Version Dropdown */}
          <Pressable
            onPress={() =>
              router.push(
                `/deck/${id}/versions?name=${encodeURIComponent(deck?.name || "")}`,
              )
            }
            className={`flex-row items-center gap-1.5 px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg ${
              isDark
                ? "bg-slate-800 lg:hover:bg-slate-700"
                : "bg-white border border-slate-200 lg:hover:bg-slate-50"
            }`}
          >
            <History size={14} color={isDark ? "#94a3b8" : "#64748b"} />
            <Text
              className={`text-xs lg:text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}
            >
              Versions
            </Text>
          </Pressable>
        </View>

        <View className="flex-row items-center gap-2 lg:gap-3">
          {/* Price Button */}
          <Pressable
            onPress={() =>
              router.push(
                `/deck/${id}/price?name=${encodeURIComponent(deck?.name || "")}`,
              )
            }
            className="flex-row items-center gap-1.5 px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg bg-purple-500/10 lg:hover:bg-purple-500/20"
          >
            <DollarSign size={14} color="#7C3AED" />
            <Text className="text-xs lg:text-sm font-medium text-purple-500">
              Price
            </Text>
          </Pressable>

          {/* View Mode Toggle */}
          <Pressable
            onPress={toggleViewMode}
            className={`flex-row items-center gap-1.5 p-2 lg:px-4 lg:py-2 rounded-lg ${
              isDark
                ? "bg-slate-800 lg:hover:bg-slate-700"
                : "bg-white border border-slate-200 lg:hover:bg-slate-50"
            }`}
          >
            {viewMode === "list" ? (
              <>
                <Grid3X3 size={14} color={isDark ? "#94a3b8" : "#64748b"} />
                {isDesktop && (
                  <Text
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}
                  >
                    Grid
                  </Text>
                )}
              </>
            ) : (
              <>
                <List size={14} color={isDark ? "#94a3b8" : "#64748b"} />
                {isDesktop && (
                  <Text
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}
                  >
                    List
                  </Text>
                )}
              </>
            )}
          </Pressable>
        </View>
      </View>

      {/* Search Bar */}
      {searchVisible && (
        <View
          className={`px-4 py-2 border-b ${
            isDark
              ? "bg-slate-900 border-slate-800"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <View
            className={`flex-row items-center rounded-lg px-3 py-2 ${
              isDark ? "bg-slate-800" : "bg-white border border-slate-200"
            }`}
          >
            <Search size={16} color={isDark ? "#64748b" : "#94a3b8"} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="search your collection"
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              className={`flex-1 ml-2 text-sm ${isDark ? "text-white" : "text-slate-900"}`}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <X size={16} color={isDark ? "#64748b" : "#94a3b8"} />
              </Pressable>
            )}
          </View>
          {searchQuery.trim() && (
            <Text
              className={`mt-1 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              {allCards.length} {allCards.length === 1 ? "card" : "cards"} found
            </Text>
          )}
        </View>
      )}

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
            onPress={() => loadDeck(true)}
            className="rounded-lg bg-purple-500 px-4 py-2"
          >
            <Text className="font-medium text-white">Retry</Text>
          </Pressable>
        </View>
      ) : sections.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text
            className={`mb-2 text-lg font-semibold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            No cards synced yet
          </Text>
          <Text
            className={`mb-4 text-center ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Pull this deck from Archidekt to see the cards
          </Text>
          <Pressable
            onPress={performSync}
            disabled={syncing}
            className="flex-row items-center gap-2 rounded-lg bg-purple-500 px-6 py-3"
          >
            <CloudDownload size={18} color="white" />
            <Text className="font-medium text-white">
              {syncing ? "Pulling..." : "Pull from Archidekt"}
            </Text>
          </Pressable>
        </View>
      ) : filteredSections.length === 0 && searchQuery.trim() ? (
        <View className="flex-1 items-center justify-center px-6">
          <Search size={48} color={isDark ? "#475569" : "#cbd5e1"} />
          <Text
            className={`mt-4 text-lg font-semibold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            No cards found
          </Text>
          <Text
            className={`mt-1 text-center ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            No cards match "{searchQuery}"
          </Text>
          <Pressable
            onPress={() => setSearchQuery("")}
            className={`mt-4 px-4 py-2 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
          >
            <Text className={isDark ? "text-white" : "text-slate-900"}>
              Clear search
            </Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={filteredSections}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#7C3AED"
            />
          }
          ListHeaderComponent={
            <View
              className={`border-b ${
                isDark
                  ? "bg-slate-900/50 border-slate-800"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              {/* Title Row - Pressable to toggle */}
              <Pressable
                onPress={() => setLandsExpanded(!landsExpanded)}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  isDark ? "active:bg-slate-800" : "active:bg-slate-100"
                }`}
              >
                <Text
                  className={`text-sm font-semibold uppercase tracking-wide ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Lands (
                  {Object.entries(basicLandCounts)
                    .sort(([a], [b]) => {
                      const aBase = a.replace("Snow-Covered ", "");
                      const bBase = b.replace("Snow-Covered ", "");
                      const aIdx = STANDARD_LAND_ORDER.indexOf(aBase);
                      const bIdx = STANDARD_LAND_ORDER.indexOf(bBase);
                      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
                      if (aIdx === -1) return 1;
                      if (bIdx === -1) return -1;
                      return aIdx - bIdx;
                    })
                    .map(([landName, count], index, array) => {
                      if (count === 0) return null;
                      const info = BASIC_LAND_INFO[landName] || {
                        symbol: "?",
                      };
                      // Filter out nulls to get actual items for spacing
                      const nonZeroItems = array.filter(([_, c]) => c > 0);
                      const currentIndex = nonZeroItems.findIndex(
                        ([n]) => n === landName,
                      );
                      const isLast = currentIndex === nonZeroItems.length - 1;

                      return (
                        <Text
                          key={landName}
                          className={`text-sm font-semibold ${
                            isDark ? "text-slate-300" : "text-slate-600"
                          }`}
                        >
                          {count}
                          {info.symbol}
                          {!isLast && " "}
                        </Text>
                      );
                    })}
                  )
                </Text>
                <ChevronDown
                  size={16}
                  color={isDark ? "#64748b" : "#94a3b8"}
                  style={{
                    transform: [{ rotate: landsExpanded ? "180deg" : "0deg" }],
                  }}
                />
              </Pressable>

              {/* Land Controls Row - Collapsible */}
              {landsExpanded && (
                <View className="flex-row justify-around px-2 pb-3">
                  {Object.entries(basicLandCounts)
                    .sort(([a], [b]) => {
                      const aBase = a.replace("Snow-Covered ", "");
                      const bBase = b.replace("Snow-Covered ", "");
                      const aIdx = STANDARD_LAND_ORDER.indexOf(aBase);
                      const bIdx = STANDARD_LAND_ORDER.indexOf(bBase);
                      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
                      if (aIdx === -1) return 1;
                      if (bIdx === -1) return -1;
                      return aIdx - bIdx;
                    })
                    .map(([landName, quantity]) => {
                      const info = BASIC_LAND_INFO[landName] || {
                        color: "#888",
                        textColor: "#fff",
                        symbol: "?",
                      };
                      return (
                        <View
                          key={landName}
                          className={`items-center ${quantity === 0 ? "opacity-50" : ""}`}
                        >
                          {/* Mana Symbol */}
                          <View
                            className="w-8 h-8 rounded-full items-center justify-center mb-1"
                            style={{ backgroundColor: info.color }}
                          >
                            <Text
                              className="text-sm font-bold"
                              style={{ color: info.textColor }}
                            >
                              {info.symbol}
                            </Text>
                          </View>

                          {/* Controls - Vertical layout: plus on top, count, minus on bottom */}
                          <View
                            className={`items-center rounded-lg ${
                              isDark
                                ? "bg-slate-800"
                                : "bg-white border border-slate-200"
                            }`}
                          >
                            <Pressable
                              onPress={() =>
                                handleLandQuantityChange(landName, 1)
                              }
                              className={`p-2 rounded-t-lg ${
                                isDark
                                  ? "active:bg-slate-700"
                                  : "active:bg-slate-100"
                              }`}
                            >
                              <Plus
                                size={16}
                                color={isDark ? "#94a3b8" : "#64748b"}
                              />
                            </Pressable>
                            <Text
                              className={`text-base font-bold w-8 text-center py-1 ${
                                quantity === 0
                                  ? isDark
                                    ? "text-slate-600"
                                    : "text-slate-400"
                                  : isDark
                                    ? "text-white"
                                    : "text-slate-900"
                              }`}
                            >
                              {quantity}
                            </Text>
                            <Pressable
                              onPress={() =>
                                handleLandQuantityChange(landName, -1)
                              }
                              disabled={quantity <= 0}
                              className={`p-2 rounded-b-lg ${
                                isDark
                                  ? "active:bg-slate-700"
                                  : "active:bg-slate-100"
                              }`}
                            >
                              <Minus
                                size={16}
                                color={
                                  quantity <= 0
                                    ? isDark
                                      ? "#374151"
                                      : "#d1d5db"
                                    : isDark
                                      ? "#94a3b8"
                                      : "#64748b"
                                }
                              />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                </View>
              )}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Pressable
              onPress={() => toggleSection(section.title)}
              className={`flex-row items-center justify-between px-4 py-3 ${
                isDark ? "bg-slate-900" : "bg-slate-50"
              }`}
            >
              <View className="flex-row items-center gap-2">
                {/* Color indicator for non-category groups */}
                {groupBy !== "category" && (
                  <View
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: getGroupColor(section.title) }}
                  />
                )}
                <Text
                  className={`text-sm font-semibold uppercase tracking-wide ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {section.title} (
                  {section.data.reduce((sum, c) => sum + c.quantity, 0)})
                </Text>
              </View>
              <ChevronDown
                size={16}
                color={isDark ? "#64748b" : "#94a3b8"}
                style={{
                  transform: [
                    {
                      rotate: expandedSections.has(section.title)
                        ? "180deg"
                        : "0deg",
                    },
                  ],
                }}
              />
            </Pressable>
          )}
          renderItem={({ item, section }) => {
            if (!expandedSections.has(section.title)) return null;

            return viewMode === "list" ? (
              <CardListItem
                card={item}
                isDark={isDark}
                isDesktop={isDesktop}
                onPress={() => handleCardPress(item)}
                onLongPress={() => handleCardLongPress(item)}
                onRightClick={(pos) => handleCardRightClick(item, pos)}
              />
            ) : null;
          }}
          renderSectionFooter={({ section }) => {
            if (!expandedSections.has(section.title) || viewMode !== "grid")
              return null;

            return (
              <View className="flex-row flex-wrap px-3 lg:px-5 pb-2">
                {section.data.map((card, index) => (
                  <CardGridItem
                    key={`${card.name}-${index}`}
                    card={card}
                    isDark={isDark}
                    isDesktop={isDesktop}
                    onPress={() => handleCardPress(card)}
                    onLongPress={() => handleCardLongPress(card)}
                    onRightClick={(pos) => handleCardRightClick(card, pos)}
                  />
                ))}
              </View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      {/* Options Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable className="flex-1" onPress={() => setMenuVisible(false)}>
          <View
            style={{
              position: "absolute",
              top: menuPosition.top,
              right: menuPosition.right,
            }}
            className={`min-w-[200px] rounded-lg border shadow-lg ${
              isDark
                ? "border-slate-700 bg-slate-800"
                : "border-slate-200 bg-white"
            }`}
          >
            <Pressable
              onPress={handlePullFromArchidekt}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                isDark ? "active:bg-slate-700" : "active:bg-slate-100"
              }`}
            >
              <CloudDownload size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text className={isDark ? "text-white" : "text-slate-900"}>
                Pull from Archidekt
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Group By Menu Modal - Mobile only */}
      <Modal
        visible={!isDesktop && groupByMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGroupByMenuVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/50"
          onPress={() => setGroupByMenuVisible(false)}
        >
          <View className="flex-1 justify-center items-center px-8">
            <View
              className={`w-full max-w-[280px] rounded-xl border shadow-xl ${
                isDark
                  ? "border-slate-700 bg-slate-800"
                  : "border-slate-200 bg-white"
              }`}
              onStartShouldSetResponder={() => true}
            >
              <Text
                className={`px-4 py-3 text-sm font-semibold border-b ${
                  isDark
                    ? "text-slate-300 border-slate-700"
                    : "text-slate-700 border-slate-200"
                }`}
              >
                Group Cards By
              </Text>
              {GROUP_BY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setGroupBy(option.value);
                    setGroupByMenuVisible(false);
                    // Expand all groups when changing grouping
                    if (deck) {
                      const allTitles = new Set<string>();
                      if (option.value === "category") {
                        allTitles.add("Commander");
                        allTitles.add("Mainboard");
                        allTitles.add("Sideboard");
                      } else {
                        // Will be updated when sections recalculate
                        Object.keys(GROUP_COLORS[option.value] || {}).forEach(
                          (k) => allTitles.add(k),
                        );
                      }
                      setExpandedSections(allTitles);
                    }
                  }}
                  className={`flex-row items-center justify-between px-4 py-3 ${
                    isDark ? "active:bg-slate-700" : "active:bg-slate-100"
                  }`}
                >
                  <Text className={isDark ? "text-white" : "text-slate-900"}>
                    {option.label}
                  </Text>
                  {groupBy === option.value && (
                    <Check size={18} color="#7C3AED" />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Card Detail Modal */}
      <Modal
        visible={cardModalVisible}
        transparent={isDesktop}
        animationType={isDesktop ? "fade" : "slide"}
        onRequestClose={closeCardModal}
      >
        {isDesktop ? (
          // Desktop: Dialog with backdrop
          <Pressable
            className="flex-1 bg-black/70 items-center justify-start pt-16 px-6 pb-6"
            onPress={closeCardModal}
          >
            <Pressable
              className={`max-w-5xl w-full max-h-[90vh] rounded-2xl ${isDark ? "bg-slate-900" : "bg-white"} shadow-2xl`}
              style={{ overflow: "visible" as any }}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <View
                className={`flex-row items-center justify-between px-6 py-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
                style={{ zIndex: 100, overflow: "visible" as any }}
              >
                <View className="flex-row items-center gap-2 flex-1">
                  {selectedCard?.isCommander && (
                    <Crown size={20} color="#eab308" />
                  )}
                  <Text
                    className={`text-lg font-bold flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
                    numberOfLines={1}
                  >
                    {selectedCard?.name}
                  </Text>
                  {selectedCard && selectedCard.quantity > 1 && (
                    <View className="bg-purple-500/20 rounded-full px-2 py-0.5">
                      <Text className="text-purple-500 text-xs font-medium">
                        {selectedCard.quantity}x
                      </Text>
                    </View>
                  )}
                </View>

                {/* Navigation */}
                <View className="flex-row items-center gap-2" style={{ zIndex: 50 }}>
                  {/* Color Tag Chip with Dropdown */}
                  <View style={{ position: "relative" as any, zIndex: headerColorTagDropdownOpen ? 1000 : 1 }}>
                    <Pressable
                      onPress={() => setHeaderColorTagDropdownOpen(!headerColorTagDropdownOpen)}
                      className={`flex-row items-center gap-1.5 rounded-full px-3 py-1 mr-2 ${
                        selectedCard?.colorTag
                          ? ""
                          : isDark
                            ? "bg-slate-700"
                            : "bg-slate-100"
                      }`}
                      style={selectedCard?.colorTag ? { backgroundColor: `${selectedCard.colorTag}20` } : undefined}
                    >
                      {selectedCard?.colorTag ? (
                        <>
                          <View
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: selectedCard.colorTag }}
                          />
                          <Text
                            className="text-xs font-medium"
                            style={{ color: selectedCard.colorTag }}
                          >
                            {deck?.colorTags?.find(t => t.color === selectedCard.colorTag)?.name || 'Tagged'}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Palette size={12} color={isDark ? "#94a3b8" : "#64748b"} />
                          <Text className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Tag
                          </Text>
                        </>
                      )}
                      <ChevronDown size={12} color={selectedCard?.colorTag || (isDark ? "#94a3b8" : "#64748b")} />
                    </Pressable>

                    {/* Dropdown Menu */}
                    {headerColorTagDropdownOpen && (
                      <>
                        {/* Backdrop to close dropdown */}
                        <Pressable
                          style={{
                            position: "fixed" as any,
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 9998,
                          }}
                          onPress={() => setHeaderColorTagDropdownOpen(false)}
                        />
                        <View
                          className={`rounded-lg shadow-xl border ${
                            isDark
                              ? "bg-slate-800 border-slate-700"
                              : "bg-white border-slate-200"
                          }`}
                          style={{
                            position: "absolute" as any,
                            top: "100%",
                            right: 0,
                            marginTop: 4,
                            minWidth: 160,
                            zIndex: 9999,
                          }}
                        >
                          {/* No Tag option */}
                          <Pressable
                            onPress={() => handleHeaderSetColorTag(null)}
                            disabled={actionLoading}
                            className={`flex-row items-center gap-2 px-3 py-2 ${
                              isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                            }`}
                          >
                            <View className="h-4 w-4 rounded-full border border-dashed border-slate-400" />
                            <Text
                              className={`text-sm flex-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                            >
                              No Tag
                            </Text>
                            {!selectedCard?.colorTag && (
                              <Check size={14} color="#7C3AED" />
                            )}
                          </Pressable>

                          {/* Color tag options */}
                          {deck?.colorTags?.map((tag) => (
                            <Pressable
                              key={tag.name}
                              onPress={() => handleHeaderSetColorTag(tag.color)}
                              disabled={actionLoading}
                              className={`flex-row items-center gap-2 px-3 py-2 ${
                                isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                              }`}
                            >
                              <View
                                className="h-4 w-4 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              <Text
                                className={`text-sm flex-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                              >
                                {tag.name}
                              </Text>
                              {selectedCard?.colorTag === tag.color && (
                                <Check size={14} color="#7C3AED" />
                              )}
                            </Pressable>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                  <Pressable
                    onPress={handlePrevCard}
                    disabled={selectedCardIndex <= 0}
                    className={`rounded-full p-2 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"} ${selectedCardIndex <= 0 ? "opacity-30" : ""}`}
                  >
                    <ChevronLeft
                      size={20}
                      color={isDark ? "#94a3b8" : "#64748b"}
                    />
                  </Pressable>
                  <Text
                    className={`text-sm min-w-[50px] text-center ${isDark ? "text-slate-400" : "text-slate-600"}`}
                  >
                    {selectedCardIndex + 1} / {allCards.length}
                  </Text>
                  <Pressable
                    onPress={handleNextCard}
                    disabled={selectedCardIndex >= allCards.length - 1}
                    className={`rounded-full p-2 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"} ${selectedCardIndex >= allCards.length - 1 ? "opacity-30" : ""}`}
                  >
                    <ChevronRight
                      size={20}
                      color={isDark ? "#94a3b8" : "#64748b"}
                    />
                  </Pressable>
                  <Pressable
                    onPress={closeCardModal}
                    className={`rounded-full p-2 ml-2 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
                  >
                    <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                  </Pressable>
                </View>
              </View>

              {/* Card Content - Side by Side */}
              <ScrollView className="flex-1">
                {selectedCard && (
                  <View className="flex-row p-6 gap-6">
                    {/* Left: Card Image */}
                    <View className="w-80 flex-shrink-0">
                      {selectedCard.imageUrl || selectedCard.imageSmall ? (
                        <Image
                          source={{
                            uri:
                              selectedCard.imageUrl || selectedCard.imageSmall,
                          }}
                          style={{
                            width: 320,
                            height: 445,
                            borderRadius: 12,
                          }}
                          resizeMode="contain"
                        />
                      ) : (
                        <View
                          className={`rounded-xl items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
                          style={{
                            width: 320,
                            height: 445,
                          }}
                        >
                          <Text
                            className={`text-lg ${isDark ? "text-slate-500" : "text-slate-400"}`}
                          >
                            {selectedCard.name}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Right: Card Details and Actions */}
                    <View className="flex-1 gap-4">
                      {/* Collection Status */}
                      {(selectedCard.isLinkedToCollection ||
                        selectedCard.inCollection ||
                        selectedCard.inCollectionDifferentPrint) && (
                        <View
                          className={`rounded-xl p-4 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
                        >
                          <View className="flex-row items-center gap-2">
                            {selectedCard.isLinkedToCollection ? (
                              <>
                                <Link size={18} color="#7C3AED" />
                                <View className="flex-1">
                                  <Text className="text-purple-500 font-medium">
                                    Linked to Collection
                                  </Text>
                                  <Text
                                    className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}
                                  >
                                    This card is linked and tracked in your
                                    collection
                                  </Text>
                                </View>
                              </>
                            ) : selectedCard.inCollection ? (
                              <>
                                <CheckCircle size={18} color="#7C3AED" />
                                <View className="flex-1">
                                  <Text className="text-purple-500 font-medium">
                                    In Your Collection
                                  </Text>
                                  <Text
                                    className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}
                                  >
                                    You own this exact printing
                                  </Text>
                                </View>
                              </>
                            ) : (
                              <>
                                <AlertCircle size={18} color="#f59e0b" />
                                <View className="flex-1">
                                  <Text className="text-amber-500 font-medium">
                                    Different Printing in Collection
                                  </Text>
                                  <Text
                                    className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}
                                  >
                                    You own this card but a different
                                    set/printing
                                  </Text>
                                </View>
                              </>
                            )}
                          </View>
                        </View>
                      )}

                      {/* Card Details */}
                      <View
                        className={`rounded-xl p-4 gap-3 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
                      >
                        {/* Type Line */}
                        {selectedCard.typeLine && (
                          <View>
                            <Text
                              className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                            >
                              Type
                            </Text>
                            <Text
                              className={
                                isDark ? "text-white" : "text-slate-900"
                              }
                            >
                              {selectedCard.typeLine}
                            </Text>
                          </View>
                        )}

                        {/* Mana Cost */}
                        {selectedCard.manaCost && (
                          <View>
                            <Text
                              className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                            >
                              Mana Cost
                            </Text>
                            <Text
                              className={`font-mono ${isDark ? "text-white" : "text-slate-900"}`}
                            >
                              {selectedCard.manaCost}
                            </Text>
                          </View>
                        )}

                        {/* Set Info */}
                        {selectedCard.setCode && (
                          <View>
                            <Text
                              className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                            >
                              Set
                            </Text>
                            <Text
                              className={
                                isDark ? "text-white" : "text-slate-900"
                              }
                            >
                              {selectedCard.setCode.toUpperCase()}
                              {selectedCard.collectorNumber &&
                                ` #${selectedCard.collectorNumber}`}
                            </Text>
                          </View>
                        )}

                        {/* Rarity */}
                        {selectedCard.rarity && (
                          <View>
                            <Text
                              className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                            >
                              Rarity
                            </Text>
                            <Text
                              className={`capitalize ${isDark ? "text-white" : "text-slate-900"}`}
                            >
                              {selectedCard.rarity}
                            </Text>
                          </View>
                        )}

                        {/* Price */}
                        {selectedCard.priceUsd != null && (
                          <View>
                            <Text
                              className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                            >
                              Price (USD)
                            </Text>
                            <Text className="text-purple-500 font-semibold">
                              ${Number(selectedCard.priceUsd).toFixed(2)}
                            </Text>
                          </View>
                        )}

                        {/* Color Identity */}
                        {selectedCard.colorIdentity &&
                          selectedCard.colorIdentity.length > 0 && (
                            <View>
                              <Text
                                className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                              >
                                Color Identity
                              </Text>
                              <View className="flex-row gap-1">
                                {selectedCard.colorIdentity.map((color) => (
                                  <View
                                    key={color}
                                    className="h-5 w-5 rounded-full border border-slate-300"
                                    style={{
                                      backgroundColor:
                                        MANA_COLORS[color] || "#888",
                                    }}
                                  />
                                ))}
                              </View>
                            </View>
                          )}
                      </View>

                      {/* Action Buttons */}
                      <View className="gap-2">
                        {/* Set as Commander */}
                        <Pressable
                          onPress={() => {
                            setCardModalVisible(false);
                            if (selectedCard) handleSetCommander(selectedCard);
                          }}
                          className={`rounded-xl p-3 flex-row items-center gap-3 ${isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"}`}
                        >
                          <Crown
                            size={18}
                            color={
                              selectedCard?.isCommander ? "#eab308" : "#94a3b8"
                            }
                          />
                          <Text
                            className={`flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
                          >
                            {selectedCard?.isCommander
                              ? "Remove as Commander"
                              : "Set as Commander"}
                          </Text>
                        </Pressable>

                        {/* Change Edition */}
                        <Pressable
                          onPress={() => {
                            setCardModalVisible(false);
                            setActionSheetCard(selectedCard);
                            setTimeout(() => handleShowEditions(), 100);
                            setTimeout(() => setActionSheetVisible(true), 100);
                          }}
                          className={`rounded-xl p-3 flex-row items-center gap-3 ${isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"}`}
                        >
                          <RefreshCcw size={18} color="#94a3b8" />
                          <Text
                            className={isDark ? "text-white" : "text-slate-900"}
                          >
                            Change Edition
                          </Text>
                        </Pressable>

                        {/* Move to Sideboard/Mainboard */}
                        <Pressable
                          onPress={() => {
                            setCardModalVisible(false);
                            if (selectedCard)
                              handleMoveToSideboard(selectedCard);
                          }}
                          className={`rounded-xl p-3 flex-row items-center gap-3 ${isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"}`}
                        >
                          <Sidebar size={18} color="#94a3b8" />
                          <Text
                            className={isDark ? "text-white" : "text-slate-900"}
                          >
                            {selectedCard?.categories?.includes("Sideboard")
                              ? "Move to Mainboard"
                              : "Move to Sideboard"}
                          </Text>
                        </Pressable>

                        {/* Link/Unlink Collection */}
                        {selectedCard?.isLinkedToCollection ? (
                          <Pressable
                            onPress={() => {
                              setCardModalVisible(false);
                              setActionSheetCard(selectedCard);
                              setTimeout(
                                () => handleUnlinkFromCollection(),
                                100,
                              );
                            }}
                            className={`rounded-xl p-3 flex-row items-center gap-3 ${isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"}`}
                          >
                            <Unlink size={18} color="#94a3b8" />
                            <Text
                              className={
                                isDark ? "text-white" : "text-slate-900"
                              }
                            >
                              Unlink from Collection
                            </Text>
                          </Pressable>
                        ) : (selectedCard?.inCollection ||
                            selectedCard?.inCollectionDifferentPrint) &&
                          selectedCard?.hasAvailableCollectionCard ? (
                          <Pressable
                            onPress={() => {
                              setCardModalVisible(false);
                              setActionSheetCard(selectedCard);
                              setTimeout(() => handleLinkToCollection(), 100);
                            }}
                            className={`rounded-xl p-3 flex-row items-center gap-3 ${isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"}`}
                          >
                            <Link size={18} color="#7C3AED" />
                            <View className="flex-1">
                              <Text className="text-purple-500 font-medium">
                                Link to Collection
                              </Text>
                              {selectedCard?.inCollectionDifferentPrint &&
                                !selectedCard?.inCollection && (
                                  <Text
                                    className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}
                                  >
                                    Will change to your collection edition
                                  </Text>
                                )}
                            </View>
                          </Pressable>
                        ) : null}

                        {/* Remove from Deck */}
                        <Pressable
                          onPress={() => {
                            setCardModalVisible(false);
                            setActionSheetCard(selectedCard);
                            setTimeout(() => handleRemoveCard(), 100);
                          }}
                          className="bg-red-500/10 hover:bg-red-500/20 rounded-xl p-3 flex-row items-center gap-3"
                        >
                          <X size={18} color="#ef4444" />
                          <Text className="text-red-500 font-medium">
                            Remove from Deck
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        ) : (
          // Mobile: Full screen modal
          <View
            className="flex-1 bg-slate-950"
            style={{ paddingTop: insets.top }}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800">
              <View className="flex-row items-center gap-2 flex-1">
                {selectedCard?.isCommander && (
                  <Crown size={20} color="#eab308" />
                )}
                <Text
                  className="text-white text-lg font-bold flex-1"
                  numberOfLines={1}
                >
                  {selectedCard?.name}
                </Text>
                {selectedCard && selectedCard.quantity > 1 && (
                  <View className="bg-white/20 rounded-full px-2 py-0.5">
                    <Text className="text-white text-xs font-medium">
                      {selectedCard.quantity}x
                    </Text>
                  </View>
                )}
              </View>

              {/* Navigation */}
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={handlePrevCard}
                  disabled={selectedCardIndex <= 0}
                  className={`rounded-full p-2 ${selectedCardIndex <= 0 ? "opacity-30" : ""}`}
                >
                  <ChevronLeft size={24} color="white" />
                </Pressable>
                <Text className="text-white/70 text-sm min-w-[50px] text-center">
                  {selectedCardIndex + 1} / {allCards.length}
                </Text>
                <Pressable
                  onPress={handleNextCard}
                  disabled={selectedCardIndex >= allCards.length - 1}
                  className={`rounded-full p-2 ${selectedCardIndex >= allCards.length - 1 ? "opacity-30" : ""}`}
                >
                  <ChevronRight size={24} color="white" />
                </Pressable>
                <Pressable
                  onPress={closeCardModal}
                  className="rounded-full p-2 ml-2"
                >
                  <X size={24} color="white" />
                </Pressable>
              </View>
            </View>

            {/* Card Content */}
            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: Math.max(24, insets.bottom + 16),
              }}
            >
              {selectedCard && (
                <>
                  {/* Card Image */}
                  <View className="items-center mb-6">
                    {selectedCard.imageUrl || selectedCard.imageSmall ? (
                      <Image
                        source={{
                          uri: selectedCard.imageUrl || selectedCard.imageSmall,
                        }}
                        style={{
                          width: Dimensions.get("window").width - 64,
                          height:
                            (Dimensions.get("window").width - 64) * (680 / 488),
                          borderRadius: 12,
                        }}
                        resizeMode="contain"
                      />
                    ) : (
                      <View
                        className="bg-slate-800 rounded-xl items-center justify-center"
                        style={{
                          width: Dimensions.get("window").width - 64,
                          height:
                            (Dimensions.get("window").width - 64) * (680 / 488),
                        }}
                      >
                        <Text className="text-slate-500 text-lg">
                          {selectedCard.name}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Collection Status */}
                  {(selectedCard.isLinkedToCollection ||
                    selectedCard.inCollection ||
                    selectedCard.inCollectionDifferentPrint) && (
                    <View className="bg-slate-900 rounded-xl p-4 mb-4">
                      <View className="flex-row items-center gap-2">
                        {selectedCard.isLinkedToCollection ? (
                          <>
                            <Link size={18} color="#7C3AED" />
                            <View className="flex-1">
                              <Text className="text-purple-500 font-medium">
                                Linked to Collection
                              </Text>
                              <Text className="text-slate-400 text-xs mt-1">
                                This card is linked and tracked in your
                                collection
                              </Text>
                            </View>
                          </>
                        ) : selectedCard.inCollection ? (
                          <>
                            <CheckCircle size={18} color="#7C3AED" />
                            <View className="flex-1">
                              <Text className="text-purple-500 font-medium">
                                In Your Collection
                              </Text>
                              <Text className="text-slate-400 text-xs mt-1">
                                You own this exact printing
                              </Text>
                            </View>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={18} color="#f59e0b" />
                            <View className="flex-1">
                              <Text className="text-amber-500 font-medium">
                                Different Printing in Collection
                              </Text>
                              <Text className="text-slate-400 text-xs mt-1">
                                You own this card but a different set/printing
                              </Text>
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Card Details */}
                  <View className="bg-slate-900 rounded-xl p-4 gap-3">
                    {/* Type Line */}
                    {selectedCard.typeLine && (
                      <View>
                        <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                          Type
                        </Text>
                        <Text className="text-white">
                          {selectedCard.typeLine}
                        </Text>
                      </View>
                    )}

                    {/* Mana Cost */}
                    {selectedCard.manaCost && (
                      <View>
                        <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                          Mana Cost
                        </Text>
                        <Text className="text-white font-mono">
                          {selectedCard.manaCost}
                        </Text>
                      </View>
                    )}

                    {/* Set Info */}
                    {selectedCard.setCode && (
                      <View>
                        <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                          Set
                        </Text>
                        <Text className="text-white">
                          {selectedCard.setCode.toUpperCase()}
                          {selectedCard.collectorNumber &&
                            ` #${selectedCard.collectorNumber}`}
                        </Text>
                      </View>
                    )}

                    {/* Rarity */}
                    {selectedCard.rarity && (
                      <View>
                        <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                          Rarity
                        </Text>
                        <Text className="text-white capitalize">
                          {selectedCard.rarity}
                        </Text>
                      </View>
                    )}

                    {/* Price */}
                    {selectedCard.priceUsd != null && (
                      <View>
                        <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                          Price (USD)
                        </Text>
                        <Text className="text-purple-400 font-semibold">
                          ${Number(selectedCard.priceUsd).toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {/* Color Identity */}
                    {selectedCard.colorIdentity &&
                      selectedCard.colorIdentity.length > 0 && (
                        <View>
                          <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                            Color Identity
                          </Text>
                          <View className="flex-row gap-1">
                            {selectedCard.colorIdentity.map((color) => (
                              <View
                                key={color}
                                className="h-5 w-5 rounded-full border border-white/20"
                                style={{
                                  backgroundColor: MANA_COLORS[color] || "#888",
                                }}
                              />
                            ))}
                          </View>
                        </View>
                      )}
                  </View>

                  {/* Action Buttons */}
                  <View className="mt-6 gap-2">
                    {/* Set as Commander */}
                    <Pressable
                      onPress={() => {
                        setCardModalVisible(false);
                        if (selectedCard) handleSetCommander(selectedCard);
                      }}
                      className="bg-slate-800 rounded-xl p-4 flex-row items-center gap-3 active:bg-slate-700"
                    >
                      <Crown
                        size={20}
                        color={
                          selectedCard?.isCommander ? "#eab308" : "#94a3b8"
                        }
                      />
                      <Text className="text-white flex-1">
                        {selectedCard?.isCommander
                          ? "Remove as Commander"
                          : "Set as Commander"}
                      </Text>
                    </Pressable>

                    {/* Set Color Tag */}
                    <Pressable
                      onPress={() => {
                        setCardModalVisible(false);
                        setActionSheetCard(selectedCard);
                        setTimeout(() => setColorTagPickerVisible(true), 100);
                        setTimeout(() => setActionSheetVisible(true), 100);
                      }}
                      className="bg-slate-800 rounded-xl p-4 flex-row items-center gap-3 active:bg-slate-700"
                    >
                      <Palette size={20} color="#94a3b8" />
                      <Text className="text-white flex-1">Set Color Tag</Text>
                      {selectedCard?.colorTag && (
                        <View
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: selectedCard.colorTag }}
                        />
                      )}
                    </Pressable>

                    {/* Change Edition */}
                    <Pressable
                      onPress={() => {
                        setCardModalVisible(false);
                        setActionSheetCard(selectedCard);
                        setTimeout(() => handleShowEditions(), 100);
                        setTimeout(() => setActionSheetVisible(true), 100);
                      }}
                      className="bg-slate-800 rounded-xl p-4 flex-row items-center gap-3 active:bg-slate-700"
                    >
                      <RefreshCcw size={20} color="#94a3b8" />
                      <Text className="text-white">Change Edition</Text>
                    </Pressable>

                    {/* Move to Sideboard/Mainboard */}
                    <Pressable
                      onPress={() => {
                        setCardModalVisible(false);
                        if (selectedCard) handleMoveToSideboard(selectedCard);
                      }}
                      className="bg-slate-800 rounded-xl p-4 flex-row items-center gap-3 active:bg-slate-700"
                    >
                      <Sidebar size={20} color="#94a3b8" />
                      <Text className="text-white">
                        {selectedCard?.categories?.includes("Sideboard")
                          ? "Move to Mainboard"
                          : "Move to Sideboard"}
                      </Text>
                    </Pressable>

                    {/* Link/Unlink Collection */}
                    {selectedCard?.isLinkedToCollection ? (
                      <Pressable
                        onPress={() => {
                          setCardModalVisible(false);
                          setActionSheetCard(selectedCard);
                          setTimeout(() => handleUnlinkFromCollection(), 100);
                        }}
                        className="bg-slate-800 rounded-xl p-4 flex-row items-center gap-3 active:bg-slate-700"
                      >
                        <Unlink size={20} color="#94a3b8" />
                        <Text className="text-white">
                          Unlink from Collection
                        </Text>
                      </Pressable>
                    ) : (selectedCard?.inCollection ||
                        selectedCard?.inCollectionDifferentPrint) &&
                      selectedCard?.hasAvailableCollectionCard ? (
                      <Pressable
                        onPress={() => {
                          setCardModalVisible(false);
                          setActionSheetCard(selectedCard);
                          setTimeout(() => handleLinkToCollection(), 100);
                        }}
                        className="bg-slate-800 rounded-xl p-4 flex-row items-center gap-3 active:bg-slate-700"
                      >
                        <Link size={20} color="#7C3AED" />
                        <View className="flex-1">
                          <Text className="text-purple-500 font-medium">
                            Link to Collection
                          </Text>
                          {selectedCard?.inCollectionDifferentPrint &&
                            !selectedCard?.inCollection && (
                              <Text className="text-slate-400 text-xs mt-0.5">
                                Will change to your collection edition
                              </Text>
                            )}
                        </View>
                      </Pressable>
                    ) : null}

                    {/* Remove from Deck */}
                    <Pressable
                      onPress={() => {
                        setCardModalVisible(false);
                        setActionSheetCard(selectedCard);
                        setTimeout(() => handleRemoveCard(), 100);
                      }}
                      className="bg-red-900/30 rounded-xl p-4 flex-row items-center gap-3 active:bg-red-900/40"
                    >
                      <X size={20} color="#ef4444" />
                      <Text className="text-red-500 font-medium">
                        Remove from Deck
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Card Action Sheet */}
      <Modal
        visible={actionSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeActionSheet}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={closeActionSheet}
        >
          <View
            className={`rounded-t-2xl ${isDark ? "bg-slate-900" : "bg-white"}`}
            onStartShouldSetResponder={() => true}
            style={{ paddingBottom: insets.bottom }}
          >
            {/* Card Header */}
            {actionSheetCard && (
              <View
                className={`flex-row items-center gap-3 p-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
              >
                {actionSheetCard.imageSmall && (
                  <Image
                    source={{ uri: actionSheetCard.imageSmall }}
                    className="h-14 w-10 rounded"
                    resizeMode="cover"
                  />
                )}
                <View className="flex-1">
                  <Text
                    className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                    numberOfLines={1}
                  >
                    {actionSheetCard.name}
                  </Text>
                  <Text
                    className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    {actionSheetCard.setCode?.toUpperCase()} #
                    {actionSheetCard.collectorNumber}
                  </Text>
                </View>
                <Pressable onPress={closeActionSheet} className="p-2">
                  <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                </Pressable>
              </View>
            )}

            {/* Edition Picker View */}
            {editionPickerVisible ? (
              <View style={{ maxHeight: 400 }}>
                <View
                  className={`flex-row items-center gap-2 p-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
                >
                  <Pressable
                    onPress={() => setEditionPickerVisible(false)}
                    className="p-1"
                  >
                    <ArrowLeft
                      size={20}
                      color={isDark ? "#94a3b8" : "#64748b"}
                    />
                  </Pressable>
                  <Text
                    className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    Select Edition
                  </Text>
                </View>
                {loadingEditions ? (
                  <View className="p-8 items-center">
                    <ActivityIndicator size="large" color="#7C3AED" />
                  </View>
                ) : editions.length === 0 ? (
                  <View className="p-8 items-center">
                    <Text
                      className={`text-center ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      No editions found for this card
                    </Text>
                  </View>
                ) : (
                  <ScrollView>
                    {editions.map((edition) => {
                      const isCurrent =
                        actionSheetCard?.scryfallId === edition.scryfallId;
                      return (
                        <Pressable
                          key={edition.scryfallId}
                          onPress={() =>
                            handleChangeEdition(edition.scryfallId)
                          }
                          disabled={actionLoading || isCurrent}
                          className={`flex-row items-center gap-3 p-3 border-b ${
                            isCurrent
                              ? isDark
                                ? "bg-slate-800/50 border-slate-700"
                                : "bg-slate-100 border-slate-200"
                              : isDark
                                ? "border-slate-800 active:bg-slate-800"
                                : "border-slate-100 active:bg-slate-50"
                          }`}
                        >
                          {edition.imageSmall && (
                            <Image
                              source={{ uri: edition.imageSmall }}
                              className="h-12 w-9 rounded"
                              resizeMode="cover"
                            />
                          )}
                          <View className="flex-1">
                            <Text
                              className={`font-medium ${
                                isCurrent
                                  ? "text-purple-500"
                                  : isDark
                                    ? "text-white"
                                    : "text-slate-900"
                              }`}
                            >
                              {edition.setName}
                              {isCurrent && " (Current)"}
                            </Text>
                            <Text
                              className={`text-xs ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {edition.setCode?.toUpperCase()} #
                              {edition.collectorNumber}
                            </Text>
                          </View>
                          {edition.priceUsd && (
                            <Text className="text-purple-500 text-sm">
                              ${edition.priceUsd}
                            </Text>
                          )}
                          {isCurrent && <Check size={18} color="#7C3AED" />}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            ) : colorTagPickerVisible ? (
              /* Color Tag Picker View */
              <View>
                <View
                  className={`flex-row items-center gap-2 p-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
                >
                  <Pressable
                    onPress={() => setColorTagPickerVisible(false)}
                    className="p-1"
                  >
                    <ArrowLeft
                      size={20}
                      color={isDark ? "#94a3b8" : "#64748b"}
                    />
                  </Pressable>
                  <Text
                    className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    Set Color Tag
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleSetColorTag(null)}
                  disabled={actionLoading}
                  className={`flex-row items-center gap-3 p-4 border-b ${
                    isDark
                      ? "border-slate-800 active:bg-slate-800"
                      : "border-slate-100 active:bg-slate-50"
                  }`}
                >
                  <View className="h-6 w-6 rounded-full border-2 border-dashed border-slate-400" />
                  <Text className={isDark ? "text-white" : "text-slate-900"}>
                    No Tag
                  </Text>
                  {!actionSheetCard?.colorTag && (
                    <Check size={18} color="#7C3AED" />
                  )}
                </Pressable>
                {deck?.colorTags?.map((tag) => (
                  <Pressable
                    key={tag.name}
                    onPress={() => handleSetColorTag(tag.color)}
                    disabled={actionLoading}
                    className={`flex-row items-center gap-3 p-4 border-b ${
                      isDark
                        ? "border-slate-800 active:bg-slate-800"
                        : "border-slate-100 active:bg-slate-50"
                    }`}
                  >
                    <View
                      className="h-6 w-6 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <Text
                      className={`flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      {tag.name}
                    </Text>
                    {actionSheetCard?.colorTag === tag.color && (
                      <Check size={18} color="#7C3AED" />
                    )}
                  </Pressable>
                ))}
              </View>
            ) : (
              /* Main Actions */
              <View className="py-2">
                {/* Set as Commander */}
                <Pressable
                  onPress={() => handleSetCommander()}
                  disabled={actionLoading}
                  className={`flex-row items-center gap-3 px-4 py-3 ${
                    isDark ? "active:bg-slate-800" : "active:bg-slate-50"
                  }`}
                >
                  <Crown
                    size={20}
                    color={
                      actionSheetCard?.isCommander
                        ? "#eab308"
                        : isDark
                          ? "#94a3b8"
                          : "#64748b"
                    }
                  />
                  <Text className={isDark ? "text-white" : "text-slate-900"}>
                    {actionSheetCard?.isCommander
                      ? "Remove as Commander"
                      : "Set as Commander"}
                  </Text>
                </Pressable>

                {/* Set Color Tag */}
                <Pressable
                  onPress={() => setColorTagPickerVisible(true)}
                  className={`flex-row items-center gap-3 px-4 py-3 ${
                    isDark ? "active:bg-slate-800" : "active:bg-slate-50"
                  }`}
                >
                  <Palette size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                  <Text
                    className={`flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    Set Color Tag
                  </Text>
                  {actionSheetCard?.colorTag && (
                    <View
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: actionSheetCard.colorTag }}
                    />
                  )}
                </Pressable>

                {/* Change Edition */}
                <Pressable
                  onPress={handleShowEditions}
                  className={`flex-row items-center gap-3 px-4 py-3 ${
                    isDark ? "active:bg-slate-800" : "active:bg-slate-50"
                  }`}
                >
                  <RefreshCcw
                    size={20}
                    color={isDark ? "#94a3b8" : "#64748b"}
                  />
                  <Text className={isDark ? "text-white" : "text-slate-900"}>
                    Change Edition
                  </Text>
                </Pressable>

                {/* Move to Sideboard/Mainboard */}
                <Pressable
                  onPress={() => handleMoveToSideboard()}
                  disabled={actionLoading}
                  className={`flex-row items-center gap-3 px-4 py-3 ${
                    isDark ? "active:bg-slate-800" : "active:bg-slate-50"
                  }`}
                >
                  <Sidebar size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                  <Text className={isDark ? "text-white" : "text-slate-900"}>
                    {actionSheetCard?.categories?.includes("Sideboard")
                      ? "Move to Mainboard"
                      : "Move to Sideboard"}
                  </Text>
                </Pressable>

                {/* Collection linking/unlinking - only show if applicable */}
                {((actionSheetCard?.inCollection ||
                  actionSheetCard?.inCollectionDifferentPrint) &&
                  !actionSheetCard?.isLinkedToCollection) ||
                actionSheetCard?.isLinkedToCollection ? (
                  <>
                    {/* Separator */}
                    <View
                      className={`my-2 h-px ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                    />

                    {/* Link to Collection - show if card is in collection but not linked and available */}
                    {(actionSheetCard?.inCollection ||
                      actionSheetCard?.inCollectionDifferentPrint) &&
                      !actionSheetCard?.isLinkedToCollection &&
                      actionSheetCard?.hasAvailableCollectionCard && (
                        <Pressable
                          onPress={() => handleLinkToCollection()}
                          disabled={actionLoading}
                          className={`flex-row items-center gap-3 px-4 py-3 ${
                            isDark
                              ? "active:bg-slate-800"
                              : "active:bg-slate-50"
                          }`}
                        >
                          <Link size={20} color="#7C3AED" />
                          <View className="flex-1">
                            <Text className="text-purple-500 font-medium">
                              Link to Collection
                            </Text>
                            {actionSheetCard?.inCollectionDifferentPrint &&
                              !actionSheetCard?.inCollection && (
                                <Text
                                  className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                                >
                                  Will change to your collection edition
                                </Text>
                              )}
                          </View>
                        </Pressable>
                      )}

                    {/* Unlink from Collection - show if card is linked */}
                    {actionSheetCard?.isLinkedToCollection && (
                      <Pressable
                        onPress={handleUnlinkFromCollection}
                        disabled={actionLoading}
                        className={`flex-row items-center gap-3 px-4 py-3 ${
                          isDark ? "active:bg-slate-800" : "active:bg-slate-50"
                        }`}
                      >
                        <Unlink
                          size={20}
                          color={isDark ? "#94a3b8" : "#64748b"}
                        />
                        <Text
                          className={isDark ? "text-white" : "text-slate-900"}
                        >
                          Unlink from Collection
                        </Text>
                      </Pressable>
                    )}
                  </>
                ) : null}

                {/* Remove Card from Deck */}
                <View
                  className={`my-2 h-px ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                />
                <Pressable
                  onPress={handleRemoveCard}
                  disabled={actionLoading}
                  className={`flex-row items-center gap-3 px-4 py-3 ${
                    isDark ? "active:bg-slate-800" : "active:bg-slate-50"
                  }`}
                >
                  <X size={20} color="#ef4444" />
                  <Text className="text-red-500 font-medium">
                    Remove from Deck
                  </Text>
                </Pressable>
              </View>
            )}

            {actionLoading && (
              <View className="absolute inset-0 bg-black/20 items-center justify-center">
                <ActivityIndicator size="large" color="#7C3AED" />
              </View>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Desktop Context Menu */}
      {isDesktop && contextMenuPosition && actionSheetCard && (
        <Pressable
          style={{
            position: "fixed" as any,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
          }}
          onPress={closeActionSheet}
        >
          <View
            className={`rounded-lg shadow-xl border ${
              isDark
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-slate-200"
            }`}
            style={{
              position: "fixed" as any,
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
              minWidth: 200,
              maxWidth: 280,
              zIndex: 51,
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* Card name header */}
            <View
              className={`px-3 py-2 border-b ${isDark ? "border-slate-700" : "border-slate-100"}`}
            >
              <Text
                className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}
                numberOfLines={1}
              >
                {actionSheetCard.name}
              </Text>
            </View>

            {/* Set as Commander */}
            <Pressable
              onPress={() => handleSetCommander()}
              disabled={actionLoading}
              className={`flex-row items-center gap-2 px-3 py-2 ${
                isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
              }`}
            >
              <Crown
                size={16}
                color={
                  actionSheetCard.isCommander
                    ? "#eab308"
                    : isDark
                      ? "#94a3b8"
                      : "#64748b"
                }
              />
              <Text
                className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {actionSheetCard.isCommander
                  ? "Remove as Commander"
                  : "Set as Commander"}
              </Text>
            </Pressable>

            {/* Set Color Tag - with hover submenu */}
            <View
              style={{ position: "relative" as any }}
              // @ts-ignore - web-only hover events
              onMouseEnter={() => setColorTagSubmenuOpen(true)}
              onMouseLeave={() => setColorTagSubmenuOpen(false)}
            >
              <View
                className={`flex-row items-center gap-2 px-3 py-2 ${
                  colorTagSubmenuOpen
                    ? isDark
                      ? "bg-slate-700"
                      : "bg-slate-50"
                    : ""
                }`}
              >
                <Palette size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text
                  className={`text-sm flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Set Color Tag
                </Text>
                {actionSheetCard.colorTag && (
                  <View
                    className="h-3 w-3 rounded-full mr-1"
                    style={{ backgroundColor: actionSheetCard.colorTag }}
                  />
                )}
                <ChevronRight
                  size={14}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              </View>

              {/* Color Tag Submenu - positioned to the right */}
              {colorTagSubmenuOpen && (
                <View
                  className={`rounded-lg shadow-xl border ${
                    isDark
                      ? "bg-slate-800 border-slate-700"
                      : "bg-white border-slate-200"
                  }`}
                  style={{
                    position: "absolute" as any,
                    left: "100%",
                    top: 0,
                    minWidth: 160,
                    zIndex: 52,
                  }}
                >
                  {/* No Tag option */}
                  <Pressable
                    onPress={() => handleSetColorTag(null)}
                    disabled={actionLoading}
                    className={`flex-row items-center gap-2 px-3 py-2 ${
                      isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                    }`}
                  >
                    <View className="h-4 w-4 rounded-full border border-dashed border-slate-400" />
                    <Text
                      className={`text-sm flex-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                    >
                      No Tag
                    </Text>
                    {!actionSheetCard.colorTag && (
                      <Check size={14} color="#7C3AED" />
                    )}
                  </Pressable>

                  {/* Color tag options */}
                  {deck?.colorTags?.map((tag) => (
                    <Pressable
                      key={tag.name}
                      onPress={() => handleSetColorTag(tag.color)}
                      disabled={actionLoading}
                      className={`flex-row items-center gap-2 px-3 py-2 ${
                        isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                      }`}
                    >
                      <View
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <Text
                        className={`text-sm flex-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                      >
                        {tag.name}
                      </Text>
                      {actionSheetCard.colorTag === tag.color && (
                        <Check size={14} color="#7C3AED" />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Change Edition */}
            <Pressable
              onPress={() => {
                setContextMenuPosition(null);
                setEditionPickerModalVisible(true);
              }}
              className={`flex-row items-center gap-2 px-3 py-2 ${
                isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
              }`}
            >
              <RefreshCcw size={16} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Change Edition
              </Text>
            </Pressable>

            {/* Move to Sideboard/Mainboard */}
            <Pressable
              onPress={() => handleMoveToSideboard()}
              disabled={actionLoading}
              className={`flex-row items-center gap-2 px-3 py-2 ${
                isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
              }`}
            >
              <Sidebar size={16} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {actionSheetCard.categories?.includes("Sideboard")
                  ? "Move to Mainboard"
                  : "Move to Sideboard"}
              </Text>
            </Pressable>

            {/* Collection linking */}
            {(actionSheetCard.inCollection ||
              actionSheetCard.inCollectionDifferentPrint) &&
              !actionSheetCard.isLinkedToCollection &&
              actionSheetCard.hasAvailableCollectionCard && (
                <Pressable
                  onPress={() => handleLinkToCollection()}
                  disabled={actionLoading}
                  className={`flex-row items-center gap-2 px-3 py-2 ${
                    isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                  }`}
                >
                  <Link size={16} color="#7C3AED" />
                  <Text className="text-sm text-purple-500 font-medium">
                    Link to Collection
                  </Text>
                </Pressable>
              )}

            {actionSheetCard.isLinkedToCollection && (
              <Pressable
                onPress={handleUnlinkFromCollection}
                disabled={actionLoading}
                className={`flex-row items-center gap-2 px-3 py-2 ${
                  isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                }`}
              >
                <Unlink size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text
                  className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Unlink from Collection
                </Text>
              </Pressable>
            )}

            {/* Separator */}
            <View
              className={`my-1 h-px ${isDark ? "bg-slate-700" : "bg-slate-100"}`}
            />

            {/* Remove Card */}
            <Pressable
              onPress={handleRemoveCard}
              disabled={actionLoading}
              className={`flex-row items-center gap-2 px-3 py-2 ${
                isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
              }`}
            >
              <X size={16} color="#ef4444" />
              <Text className="text-sm text-red-500">Remove from Deck</Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* Floating Chat Button (FAB) */}
      {!isDesktop && (
        <Pressable
          onPress={() => setChatPanelVisible(true)}
          className="absolute bottom-6 right-6 h-14 w-14 rounded-full bg-purple-500 items-center justify-center shadow-lg"
          style={{
            shadowColor: "#7C3AED",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <MessageSquare size={24} color="white" />
        </Pressable>
      )}

      {/* Edition Picker Modal (Desktop) */}
      <EditionPickerModal
        visible={editionPickerModalVisible}
        onClose={() => {
          setEditionPickerModalVisible(false);
          setActionSheetCard(null);
        }}
        card={actionSheetCard}
        onSelectEdition={async (scryfallId) => {
          if (!actionSheetCard || !deck) return;
          setActionLoading(true);
          try {
            const result = await decksApi.changeCardEdition(
              deck.id,
              actionSheetCard.name,
              scryfallId,
            );
            if (result.error) {
              showToast.error(result.error);
            } else {
              // Directly fetch fresh data bypassing cache
              await cache.remove(CACHE_KEYS.DECK_DETAIL(id!));
              const freshDeck = await decksApi.get(deck.id);
              if (freshDeck.data) {
                setDeck(freshDeck.data);
              }
              setEditionPickerModalVisible(false);
              setActionSheetCard(null);
            }
          } catch {
            showToast.error("Failed to change edition");
          } finally {
            setActionLoading(false);
          }
        }}
        loading={actionLoading}
      />

      {/* Color Tag Manager */}
      {deck && (
        <ColorTagManager
          deck={deck}
          visible={colorTagManagerVisible}
          onClose={() => setColorTagManagerVisible(false)}
          onTagsChanged={(colorTags) => {
            setDeck((prev) => (prev ? { ...prev, colorTags } : null));
            // Clear cache to ensure fresh data on next load
            cache.remove(CACHE_KEYS.DECK_DETAIL(id!));
          }}
          isDark={isDark}
        />
      )}

      {/* AI Advisor Chat Panel */}
      {deck && (
        <ChatPanel
          deck={deck}
          visible={chatPanelVisible}
          onClose={() => setChatPanelVisible(false)}
          onDeckUpdated={() => {
            // Reload deck after AI advisor changes are applied
            cache.remove(CACHE_KEYS.DECK_DETAIL(id!));
            loadDeck(true);
          }}
          isDark={isDark}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText || "Pull"}
        cancelText="Cancel"
        destructive={true}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() =>
          setConfirmDialog((prev) => ({ ...prev, visible: false }))
        }
      />

      {/* Printing Selection Modal */}
      <Modal
        visible={printingSelection.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPrintingSelection((prev) => ({ ...prev, visible: false }))
        }
      >
        <Pressable
          className="flex-1 bg-black/50 items-center justify-center p-4"
          onPress={() =>
            setPrintingSelection((prev) => ({ ...prev, visible: false }))
          }
        >
          <Pressable
            className={`w-full max-w-sm rounded-2xl p-6 ${
              isDark ? "bg-slate-800" : "bg-white"
            }`}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              className={`text-xl font-semibold mb-2 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Select Printing
            </Text>
            <Text
              className={`text-base mb-4 ${
                isDark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              You own {printingSelection.printings.length} different printings
              of "{printingSelection.cardName}". Select which one to link.
            </Text>
            {printingSelection.printings.some(
              (p) => p.scryfallId !== printingSelection.currentScryfallId,
            ) && (
              <Text
                className={`text-sm mb-4 ${
                  isDark ? "text-amber-400" : "text-amber-600"
                }`}
              >
                Note: Selecting a different printing will change the card in
                your deck to match.
              </Text>
            )}
            <ScrollView className="max-h-96 mb-4">
              {printingSelection.printings.map((printing) => {
                const totalQty = printing.quantity + printing.foilQuantity;
                const foilText =
                  printing.foilQuantity > 0
                    ? ` (${printing.foilQuantity} foil)`
                    : "";
                const isLinked = !!printing.linkedTo;
                return (
                  <Pressable
                    key={printing.id}
                    className={`p-4 mb-2 rounded-lg ${
                      isLinked
                        ? isDark
                          ? "bg-slate-700 border border-amber-500/50"
                          : "bg-slate-100 border border-amber-500/50"
                        : isDark
                          ? "bg-slate-700"
                          : "bg-slate-100"
                    }`}
                    onPress={() => {
                      setPrintingSelection((prev) => ({
                        ...prev,
                        visible: false,
                      }));
                      handleLinkToCollection(printing.id);
                    }}
                  >
                    <Text
                      className={`font-medium ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {printing.setCode.toUpperCase()} #
                      {printing.collectorNumber}
                    </Text>
                    <Text
                      className={`text-sm ${
                        isDark ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {totalQty}x{foilText}
                    </Text>
                    {isLinked && (
                      <Text
                        className={`text-xs mt-1 ${
                          isDark ? "text-amber-400" : "text-amber-600"
                        }`}
                      >
                        Already linked to {printing.linkedTo.deckName}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              className={`py-3 px-4 rounded-lg ${
                isDark ? "bg-slate-700" : "bg-slate-200"
              }`}
              onPress={() =>
                setPrintingSelection((prev) => ({ ...prev, visible: false }))
              }
            >
              <Text
                className={`text-center font-medium ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Already Linked Confirmation */}
      <ConfirmDialog
        visible={alreadyLinkedConfirm.visible}
        title="Card Already Linked"
        message={`This card is already linked to your collection in "${alreadyLinkedConfirm.linkedDeck.deckName}". Unlink it from that deck and link to this deck instead?`}
        confirmText="Unlink & Link Here"
        cancelText="Cancel"
        destructive={false}
        onConfirm={() => {
          setAlreadyLinkedConfirm((prev) => ({ ...prev, visible: false }));
          handleLinkToCollection(
            alreadyLinkedConfirm.collectionCardId,
            true, // forceUnlink
          );
        }}
        onCancel={() =>
          setAlreadyLinkedConfirm((prev) => ({ ...prev, visible: false }))
        }
      />

      {/* Scryfall Search */}
      <ScryfallSearch
        visible={scryfallSearchVisible}
        onClose={() => setScryfallSearchVisible(false)}
        onSelectCard={handleAddCardFromSearch}
        title="Add Card to Deck"
        placeholder="Search for a card..."
      />
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
