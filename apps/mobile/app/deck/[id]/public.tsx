import { BottomSheetView } from "@gorhom/bottom-sheet";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  DollarSign,
  Grid3X3,
  Layers,
  List,
  Search,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  decksApi,
  deckRankingApi,
  type DeckCard,
  type DeckDetail,
  type DeckScores,
} from "~/lib/api";
import { cache, CACHE_KEYS, CACHE_TTL, cachedFetch } from "~/lib/cache";
import { useResponsive } from "~/hooks/useResponsive";
import { GlassSheet } from "~/components/ui/GlassSheet";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";
import { DeckScoreChip } from "~/components/ranking/DeckScoreChip";
import { MANA_COLORS } from "~/components/deck/deck-detail-constants";
import { KEYBOARD_ACCESSORY_ID } from "~/components/ui/KeyboardDoneAccessory";

// View mode options
type ViewMode = "list" | "grid" | "stacks-text" | "stacks-cards";

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string; desktopOnly?: boolean }[] = [
  { value: "list", label: "List" },
  { value: "grid", label: "Grid" },
  { value: "stacks-text", label: "Stacks (text)", desktopOnly: true },
  { value: "stacks-cards", label: "Stacks (cards)", desktopOnly: true },
];

// Group by options (no colorTag for public view)
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

const BASIC_LAND_NAMES = new Set([
  "Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes",
  "Snow-Covered Plains", "Snow-Covered Island", "Snow-Covered Swamp",
  "Snow-Covered Mountain", "Snow-Covered Forest",
]);

function isBasicLand(cardName: string): boolean {
  return BASIC_LAND_NAMES.has(cardName);
}

const BASIC_LAND_INFO: Record<string, { color: string; textColor: string; symbol: string }> = {
  Plains: { color: "#F9FAF4", textColor: "#000", symbol: "W" },
  Island: { color: "#0E68AB", textColor: "#fff", symbol: "U" },
  Swamp: { color: "#150B00", textColor: "#fff", symbol: "B" },
  Mountain: { color: "#D3202A", textColor: "#fff", symbol: "R" },
  Forest: { color: "#00733E", textColor: "#fff", symbol: "G" },
  Wastes: { color: "#BFA98A", textColor: "#000", symbol: "C" },
  "Snow-Covered Plains": { color: "#F9FAF4", textColor: "#000", symbol: "W" },
  "Snow-Covered Island": { color: "#0E68AB", textColor: "#fff", symbol: "U" },
  "Snow-Covered Swamp": { color: "#150B00", textColor: "#fff", symbol: "B" },
  "Snow-Covered Mountain": { color: "#D3202A", textColor: "#fff", symbol: "R" },
  "Snow-Covered Forest": { color: "#00733E", textColor: "#fff", symbol: "G" },
};

const STANDARD_LAND_ORDER = ["Plains", "Island", "Swamp", "Mountain", "Forest"];

interface CardSection {
  title: string;
  data: DeckCard[];
}

// --- Card display components (read-only) ---

function ColorIdentityPills({ colors, isDark }: { colors: string[]; isDark: boolean }) {
  if (colors.length === 0) {
    return (
      <View
        className="h-5 w-5 rounded-full border"
        style={{ backgroundColor: "#888", borderColor: isDark ? "#475569" : "#cbd5e1" }}
      />
    );
  }
  return (
    <View className="flex-row gap-1">
      {colors.map((color) => (
        <View
          key={color}
          className="h-5 w-5 rounded-full border"
          style={{ backgroundColor: MANA_COLORS[color] || "#888", borderColor: isDark ? "#475569" : "#cbd5e1" }}
        />
      ))}
    </View>
  );
}

function CardListItem({ card, isDark, onPress }: { card: DeckCard; isDark: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`relative flex-row items-center gap-3 pr-4 lg:pr-6 overflow-hidden ${
        isDark ? "active:bg-slate-800/50 lg:hover:bg-slate-800/50" : "active:bg-slate-50 lg:hover:bg-slate-50"
      }`}
    >
      <View className="relative h-12 w-12">
        {card.imageArtCrop ? (
          <Image source={{ uri: card.imageArtCrop }} className="h-12 w-12" resizeMode="cover" />
        ) : (
          <View className={`h-10 w-10 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
        )}
      </View>
      <View className="flex-1">
        <Text className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`} numberOfLines={1}>
          {card.name}
        </Text>
        <View className="flex-row items-center gap-2">
          {card.manaCost && (
            <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>{card.manaCost}</Text>
          )}
          {card.typeLine && (
            <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`} numberOfLines={1}>
              {card.typeLine.split("—")[0].trim()}
            </Text>
          )}
        </View>
      </View>
      <Text className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>{card.quantity}x</Text>
    </Pressable>
  );
}

function CardGridItem({ card, isDark, onPress }: { card: DeckCard; isDark: boolean; onPress?: () => void }) {
  const imageUri = card.imageUrl || card.imageSmall;
  return (
    <Pressable onPress={onPress} className="p-1" style={{ width: "25%" }}>
      <View className="relative">
        {imageUri ? (
          <Image source={{ uri: imageUri }} className="aspect-[488/680] w-full rounded-lg" resizeMode="contain" />
        ) : (
          <View
            className={`aspect-[488/680] w-full items-center justify-center rounded-lg ${
              isDark ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            <Text className={`text-xs text-center px-1 ${isDark ? "text-slate-500" : "text-slate-400"}`} numberOfLines={2}>
              {card.name}
            </Text>
          </View>
        )}
        {card.quantity > 1 && (
          <View className="absolute top-1 right-1 bg-black/70 rounded-full px-1.5 py-0.5">
            <Text className="text-xs font-bold text-white">{card.quantity}x</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function StacksTextItem({
  card,
  isDark,
  onPress,
  onHover,
}: {
  card: DeckCard;
  isDark: boolean;
  onPress?: () => void;
  onHover?: (card: DeckCard | null) => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      // @ts-ignore
      onMouseEnter={() => onHover?.(card)}
      className={`flex-row items-center justify-between py-1 px-2 rounded ${
        isDark ? "lg:hover:bg-slate-800/50" : "lg:hover:bg-slate-100"
      }`}
    >
      <View className="flex-row items-center gap-1 flex-1 min-w-0">
        <Text className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{card.quantity}</Text>
        <Text className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`} numberOfLines={1}>
          {card.name}
        </Text>
      </View>
    </Pressable>
  );
}

function StacksCardItem({
  card,
  isDark,
  isLast,
  onPress,
  onHover,
}: {
  card: DeckCard;
  isDark: boolean;
  isLast?: boolean;
  onPress?: () => void;
  onHover?: (card: DeckCard | null) => void;
}) {
  const imageUri = card.imageUrl || card.imageSmall;
  return (
    <Pressable
      onPress={onPress}
      // @ts-ignore
      onMouseEnter={() => onHover?.(card)}
      style={!isLast ? { height: 30, overflow: "hidden" as any } : undefined}
    >
      <View className="relative">
        {imageUri ? (
          <Image source={{ uri: imageUri }} className="aspect-[488/680] w-full rounded-lg" resizeMode="contain" />
        ) : (
          <View
            className={`aspect-[488/680] w-full items-center justify-center rounded-lg ${
              isDark ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            <Text className={`text-xs text-center px-1 ${isDark ? "text-slate-500" : "text-slate-400"}`} numberOfLines={2}>
              {card.name}
            </Text>
          </View>
        )}
        {card.quantity > 1 && (
          <View className="absolute top-1 right-1 bg-black/70 rounded-full px-1.5 py-0.5">
            <Text className="text-xs font-bold text-white">{card.quantity}x</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// --- Main Component ---

export default function PublicDeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();

  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["Commander", "Mainboard", "Sideboard"]),
  );
  const [landsExpanded, setLandsExpanded] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [groupByMenuVisible, setGroupByMenuVisible] = useState(false);
  const groupByButtonRef = useRef<View>(null);
  const [groupByMenuPosition, setGroupByMenuPosition] = useState({ top: 0, left: 0 });
  const [viewModeMenuVisible, setViewModeMenuVisible] = useState(false);
  const viewModeButtonRef = useRef<View>(null);
  const [viewModeMenuPosition, setViewModeMenuPosition] = useState({ top: 0, left: 0 });
  const [hoveredCard, setHoveredCard] = useState<DeckCard | null>(null);
  const [stacksContainerWidth, setStacksContainerWidth] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);

  // Card modal state
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [cardModalVisible, setCardModalVisible] = useState(false);

  // Deck scores
  const [deckScores, setDeckScores] = useState<DeckScores | null>(null);

  // --- Data loading ---

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

  useEffect(() => {
    loadDeck();
    if (id) {
      deckRankingApi
        .getScores(id)
        .then((res) => {
          if (res.data) setDeckScores(res.data.scores);
        })
        .catch(() => {});
    }
  }, [loadDeck, id]);

  // --- Grouping logic ---

  const getGroupKey = useCallback(
    (card: DeckCard): string => {
      switch (groupBy) {
        case "category":
          if (card.isCommander) return "Commander";
          return "Mainboard";
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
        case "color": {
          const colors = card.colors || [];
          if (colors.length === 0) {
            if (card.typeLine?.toLowerCase().includes("land")) return "Land";
            return "Colorless";
          }
          if (colors.length > 1) return "Multicolor";
          const colorMap: Record<string, string> = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
          return colorMap[colors[0]] || "Other";
        }
        case "cmc": {
          const manaCost = card.manaCost || "";
          let cmc = 0;
          const matches = manaCost.match(/\{([^}]+)\}/g) || [];
          for (const match of matches) {
            const symbol = match.replace(/[{}]/g, "");
            if (symbol === "X") continue;
            const num = parseInt(symbol);
            if (!isNaN(num)) cmc += num;
            else if (symbol !== "") cmc += 1;
          }
          if (cmc >= 7) return "7+";
          return String(cmc);
        }
        case "rarity": {
          const rarity = card.rarity?.toLowerCase() || "common";
          return rarity.charAt(0).toUpperCase() + rarity.slice(1);
        }
        default:
          return "Other";
      }
    },
    [groupBy],
  );

  // Separate basic lands from other cards
  const { basicLands, nonBasicCards } = useMemo(() => {
    if (!deck)
      return { basicLands: [] as DeckCard[], nonBasicCards: { commanders: [] as DeckCard[], mainboard: [] as DeckCard[], sideboard: [] as DeckCard[] } };

    const basics: DeckCard[] = [];
    const commanders: DeckCard[] = [];
    const mainboard: DeckCard[] = [];
    const sideboard: DeckCard[] = [];

    for (const card of deck.commanders) {
      if (isBasicLand(card.name)) basics.push(card);
      else commanders.push(card);
    }
    for (const card of deck.mainboard) {
      if (isBasicLand(card.name)) basics.push(card);
      else mainboard.push(card);
    }
    for (const card of deck.sideboard) {
      if (isBasicLand(card.name)) basics.push(card);
      else sideboard.push(card);
    }

    return { basicLands: basics, nonBasicCards: { commanders, mainboard, sideboard } };
  }, [deck]);

  const basicLandCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const land of STANDARD_LAND_ORDER) counts[land] = 0;
    for (const card of basicLands) {
      if (!counts.hasOwnProperty(card.name)) counts[card.name] = 0;
      counts[card.name] += card.quantity;
    }
    return counts;
  }, [basicLands]);

  // Build sections
  const sections: CardSection[] = useMemo(() => {
    if (!deck) return [];
    const result: CardSection[] = [];

    if (groupBy === "category") {
      if (nonBasicCards.commanders.length > 0) result.push({ title: "Commander", data: nonBasicCards.commanders });
      if (nonBasicCards.mainboard.length > 0) result.push({ title: "Mainboard", data: nonBasicCards.mainboard });
      if (nonBasicCards.sideboard.length > 0) result.push({ title: "Sideboard", data: nonBasicCards.sideboard });
    } else {
      if (nonBasicCards.commanders.length > 0) result.push({ title: "Commander", data: nonBasicCards.commanders });
      const allGroupCards = [...nonBasicCards.mainboard, ...nonBasicCards.sideboard];
      const grouped: Record<string, DeckCard[]> = {};
      for (const card of allGroupCards) {
        const key = getGroupKey(card);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(card);
      }
      const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
        if (groupBy === "cmc") {
          const aNum = a === "7+" ? 7 : parseInt(a);
          const bNum = b === "7+" ? 7 : parseInt(b);
          return aNum - bNum;
        }
        if (groupBy === "rarity") {
          const rarityOrder = ["Common", "Uncommon", "Rare", "Mythic"];
          return rarityOrder.indexOf(a) - rarityOrder.indexOf(b);
        }
        return a.localeCompare(b);
      });
      for (const [title, data] of sortedGroups) {
        if (data.length > 0) result.push({ title, data });
      }
    }
    return result;
  }, [deck, groupBy, getGroupKey, nonBasicCards]);

  const getGroupColor = useCallback(
    (groupName: string): string => GROUP_COLORS[groupBy]?.[groupName] || "#64748b",
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
      if (matchingCards.length > 0) result.push({ title: section.title, data: matchingCards });
    }
    return result;
  }, [sections, searchQuery]);

  // Stacks sections (include basic lands as column)
  const stacksSections = useMemo(() => {
    const result = [...filteredSections];
    if (basicLands.length > 0) {
      const landsData = searchQuery.trim()
        ? basicLands.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
        : basicLands;
      if (landsData.length > 0) result.push({ title: "Basic Lands", data: landsData });
    }
    return result;
  }, [filteredSections, basicLands, searchQuery]);

  // Pack stacks into columns
  const stacksColumns = useMemo(() => {
    if (stacksSections.length === 0) return [] as { sections: CardSection[] }[];

    const COLUMN_WIDTH = viewMode === "stacks-text" ? 220 : 200;
    const COLUMN_TOTAL_WIDTH = COLUMN_WIDTH + 8;
    const HORIZONTAL_PADDING = 16;
    const maxColumns =
      stacksContainerWidth > 0
        ? Math.max(1, Math.floor((stacksContainerWidth - HORIZONTAL_PADDING) / COLUMN_TOTAL_WIDTH))
        : stacksSections.length;
    const numColumns = Math.min(stacksSections.length, maxColumns);

    if (numColumns >= stacksSections.length) {
      const commanderIdx = stacksSections.findIndex((s) => s.title === "Commander");
      const ordered: CardSection[] = [];
      if (commanderIdx >= 0) ordered.push(stacksSections[commanderIdx]);
      for (let i = 0; i < stacksSections.length; i++) {
        if (i !== commanderIdx) ordered.push(stacksSections[i]);
      }
      return ordered.map((s) => ({ sections: [s] }));
    }

    const CARD_IMAGE_HEIGHT = 279;
    const CARD_OVERLAP_HEIGHT = 30;
    const TEXT_ITEM_HEIGHT = 26;
    const HEADER_HEIGHT = 28;
    const SECTION_GAP = 16;

    const getSectionHeight = (section: CardSection): number => {
      const n = section.data.length;
      if (n === 0) return HEADER_HEIGHT;
      if (viewMode === "stacks-cards") return HEADER_HEIGHT + (n - 1) * CARD_OVERLAP_HEIGHT + CARD_IMAGE_HEIGHT;
      return HEADER_HEIGHT + n * TEXT_ITEM_HEIGHT;
    };

    const sectionHeights = stacksSections.map(getSectionHeight);
    const columns: { sections: CardSection[]; totalHeight: number }[] = [];
    for (let i = 0; i < numColumns; i++) columns.push({ sections: [], totalHeight: 0 });

    const commanderIdx = stacksSections.findIndex((s) => s.title === "Commander");
    if (commanderIdx >= 0) {
      columns[0].sections.push(stacksSections[commanderIdx]);
      columns[0].totalHeight = sectionHeights[commanderIdx];
    }

    for (let i = 0; i < stacksSections.length; i++) {
      if (i === commanderIdx) continue;
      let shortestIdx = 0;
      let shortestHeight = columns[0].totalHeight;
      for (let c = 1; c < columns.length; c++) {
        if (columns[c].totalHeight < shortestHeight) {
          shortestHeight = columns[c].totalHeight;
          shortestIdx = c;
        }
      }
      const gap = columns[shortestIdx].sections.length > 0 ? SECTION_GAP : 0;
      columns[shortestIdx].sections.push(stacksSections[i]);
      columns[shortestIdx].totalHeight += gap + sectionHeights[i];
    }

    return columns.filter((c) => c.sections.length > 0);
  }, [stacksSections, viewMode, stacksContainerWidth]);

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

  // Flatten all cards for navigation
  const allCards = useMemo(() => filteredSections.flatMap((section) => section.data), [filteredSections]);

  const selectedCardIndex = useMemo(() => {
    if (!selectedCard) return -1;
    return allCards.findIndex((c) => c.id === selectedCard.id);
  }, [allCards, selectedCard]);

  const handleCardPress = useCallback((card: DeckCard) => {
    setSelectedCard(card);
    setCardModalVisible(true);
  }, []);

  const handlePrevCard = useCallback(() => {
    if (selectedCardIndex > 0) setSelectedCard(allCards[selectedCardIndex - 1]);
  }, [selectedCardIndex, allCards]);

  const handleNextCard = useCallback(() => {
    if (selectedCardIndex < allCards.length - 1) setSelectedCard(allCards[selectedCardIndex + 1]);
  }, [selectedCardIndex, allCards]);

  const closeCardModal = useCallback(() => {
    setCardModalVisible(false);
    setSelectedCard(null);
  }, []);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const changeViewMode = (newMode: ViewMode) => {
    setViewMode(newMode);
    setHoveredCard(null);
  };

  // --- Render ---

  const pageContent = (
    <>
      {/* Header - Desktop only (mobile uses native Stack header) */}
      {isDesktop && (
        <View className="flex-row items-center justify-between px-6 py-4">
          <View className="flex-row items-center gap-3 flex-1">
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-1">
                <Pressable onPress={() => router.push("/(tabs)/explore")} className="hover:underline">
                  <Text className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
                    Explore
                  </Text>
                </Pressable>
                <Text className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>/</Text>
                <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`} numberOfLines={1}>
                  {deck?.name || "Loading..."}
                </Text>
              </View>
              <Text
                className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                numberOfLines={1}
                style={{ flexShrink: 1 }}
              >
                {deck?.name || "Loading..."}
              </Text>
            {deck && (
              <View className="flex-row items-center gap-2 lg:gap-3 mt-0.5 lg:mt-1">
                {isDesktop && <ColorIdentityPills colors={deck.colorIdentity} isDark={isDark} />}
                {deck.format && (
                  <Text className={`text-xs lg:text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>{deck.format}</Text>
                )}
                <Text className={`text-xs lg:text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  {deck.cardCount} cards
                </Text>
                {isDesktop && deckScores && <DeckScoreChip deckId={id!} deckName={deck.name} scores={deckScores} variant="inline" />}
                {deck.ownerName && (
                  <Text className={`text-xs lg:text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    by {deck.ownerName}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
      )}

      {/* Mobile metadata strip */}
      {!isDesktop && deck && (
        <View
          className={`flex-row items-center gap-2 px-3 py-2 border-b ${
            isDark ? "border-slate-800" : "border-slate-200"
          }`}
        >
          <ColorIdentityPills colors={deck.colorIdentity} isDark={isDark} />
          {deck.format && (
            <Text className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {deck.format}
            </Text>
          )}
          <Text className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {deck.cardCount} cards
          </Text>
          {deckScores && (
            <DeckScoreChip deckId={id!} deckName={deck.name} scores={deckScores} variant="inline" />
          )}
          {deck.ownerName && (
            <Text className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              by {deck.ownerName}
            </Text>
          )}
        </View>
      )}

      {/* Sticky Toolbar */}
      <View
        className={`flex-row items-center justify-between px-3 lg:px-6 py-2 lg:py-3 border-b ${
          isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
        }`}
      >
        <View className="flex-row items-center gap-2 lg:gap-3">
          {/* Group By Button */}
          <View ref={groupByButtonRef} className="relative">
            <Pressable
              onPress={() => {
                groupByButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                  const screenW = Dimensions.get("window").width;
                  const menuW = 200;
                  setGroupByMenuPosition({ top: pageY + height + 4, left: Math.max(8, Math.min(pageX, screenW - menuW - 8)) });
                  setGroupByMenuVisible(true);
                });
              }}
              className={`flex-row items-center gap-1.5 p-2.5 lg:px-4 lg:py-2 rounded-lg ${
                isDark ? "bg-slate-800 lg:hover:bg-slate-700" : "bg-white border border-slate-200 lg:hover:bg-slate-50"
              }`}
            >
              <Layers size={18} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          </View>

          {/* Search Toggle */}
          <Pressable
            onPress={() => {
              setSearchVisible(!searchVisible);
              if (searchVisible) setSearchQuery("");
            }}
            className={`flex-row items-center gap-1.5 p-2.5 lg:px-4 lg:py-2 rounded-lg ${
              searchVisible
                ? "bg-purple-500/20"
                : isDark
                  ? "bg-slate-800 lg:hover:bg-slate-700"
                  : "bg-white border border-slate-200 lg:hover:bg-slate-50"
            }`}
          >
            <Search size={18} color={searchVisible ? "#7C3AED" : isDark ? "#94a3b8" : "#64748b"} />
          </Pressable>
        </View>

        <View className="flex-row items-center gap-2 lg:gap-3">
          {/* Ranking Button */}
          <Pressable
            onPress={() => router.push(`/deck/${id}/ranking?name=${encodeURIComponent(deck?.name || "")}`)}
            className="flex-row items-center gap-1.5 p-2.5 lg:px-4 lg:py-2 rounded-lg bg-purple-500/10 lg:hover:bg-purple-500/20"
          >
            <BarChart3 size={18} color="#a855f7" />
          </Pressable>

          {/* Price Button */}
          <Pressable
            onPress={() => router.push(`/deck/${id}/price?name=${encodeURIComponent(deck?.name || "")}`)}
            className="flex-row items-center gap-1.5 p-2.5 lg:px-4 lg:py-2 rounded-lg bg-blue-500/10 lg:hover:bg-blue-500/20"
          >
            <DollarSign size={18} color="#7C3AED" />
          </Pressable>

          {/* View Mode Dropdown */}
          <View ref={viewModeButtonRef} className="relative">
            <Pressable
              onPress={() => {
                viewModeButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                  const screenW = Dimensions.get("window").width;
                  const menuW = 200;
                  setViewModeMenuPosition({ top: pageY + height + 4, left: Math.max(8, Math.min(pageX, screenW - menuW - 8)) });
                  setViewModeMenuVisible(true);
                });
              }}
              className={`flex-row items-center gap-1.5 p-2.5 lg:px-4 lg:py-2 rounded-lg ${
                isDark ? "bg-slate-800 lg:hover:bg-slate-700" : "bg-white border border-slate-200 lg:hover:bg-slate-50"
              }`}
            >
              {viewMode === "list" ? (
                <List size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              ) : viewMode === "grid" ? (
                <Grid3X3 size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              ) : (
                <Layers size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      {searchVisible && (
        <View className={`px-4 py-2 border-b ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
          <View className={`flex-row items-center rounded-lg px-3 py-2 ${isDark ? "bg-slate-800" : "bg-white border border-slate-200"}`}>
            <Search size={16} color={isDark ? "#64748b" : "#94a3b8"} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search cards..."
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              className={`flex-1 ml-2 text-sm ${isDark ? "text-white" : "text-slate-900"}`}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <X size={16} color={isDark ? "#64748b" : "#94a3b8"} />
              </Pressable>
            )}
          </View>
          {searchQuery.trim() && (
            <Text className={`mt-1 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
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
          <Text className={`mb-4 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>{error}</Text>
          <Pressable onPress={() => loadDeck(true)} className="rounded-lg bg-purple-500 px-4 py-2">
            <Text className="font-medium text-white">Retry</Text>
          </Pressable>
        </View>
      ) : sections.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className={`mb-2 text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>No cards in this deck</Text>
          <Text className={`text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            This deck doesn't have any cards yet
          </Text>
        </View>
      ) : filteredSections.length === 0 && searchQuery.trim() ? (
        <View className="flex-1 items-center justify-center px-6">
          <Search size={48} color={isDark ? "#475569" : "#cbd5e1"} />
          <Text className={`mt-4 text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>No cards found</Text>
          <Text className={`mt-1 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            No cards match "{searchQuery}"
          </Text>
          <Pressable
            onPress={() => setSearchQuery("")}
            className={`mt-4 px-4 py-2 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
          >
            <Text className={isDark ? "text-white" : "text-slate-900"}>Clear search</Text>
          </Pressable>
        </View>
      ) : viewMode.startsWith("stacks") ? (
        /* Stacks View */
        <View className="flex-1 flex-row">
          {/* Card Preview Panel */}
          <View className="px-4 py-4 items-center" style={{ width: 280 }}>
            {hoveredCard ? (
              <>
                <Image
                  source={{ uri: hoveredCard.imageUrl || hoveredCard.imageSmall || "" }}
                  className="rounded-xl"
                  style={{ width: 250, height: 349 }}
                  resizeMode="contain"
                />
                {hoveredCard.priceUsd != null && (
                  <Text className={`mt-2 text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    ${Number(hoveredCard.priceUsd).toFixed(2)}
                  </Text>
                )}
              </>
            ) : (
              <View
                className={`items-center justify-center rounded-xl ${isDark ? "bg-slate-800/50" : "bg-slate-100"}`}
                style={{ width: 250, height: 349 }}
              >
                <Text className={`text-sm text-center px-4 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  Hover over a card to preview
                </Text>
              </View>
            )}
          </View>

          {/* Stacks Columns */}
          <ScrollView className="flex-1" onLayout={(e) => setStacksContainerWidth(e.nativeEvent.layout.width)}>
            <ScrollView
              horizontal
              contentContainerStyle={{
                paddingHorizontal: 8,
                paddingVertical: 12,
                alignItems: "flex-start",
                flexGrow: 1,
                justifyContent: "flex-end",
              }}
            >
              {stacksColumns.map((column) => (
                <View
                  key={column.sections.map((s) => s.title).join("-")}
                  className="mx-1"
                  style={{ width: viewMode === "stacks-text" ? 220 : 200 }}
                >
                  {column.sections.map((section, secIdx) => (
                    <View key={section.title} style={secIdx > 0 ? { marginTop: 16 } : undefined}>
                      <View className="flex-row items-center gap-1.5 px-2 mb-2">
                        {groupBy !== "category" && (
                          <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: getGroupColor(section.title) }} />
                        )}
                        <Text className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{section.title}</Text>
                        <Text className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                          ({section.data.reduce((sum, c) => sum + c.quantity, 0)})
                        </Text>
                      </View>
                      {viewMode === "stacks-text"
                        ? section.data.map((card, index) => (
                            <StacksTextItem
                              key={`${card.name}-${index}`}
                              card={card}
                              isDark={isDark}
                              onPress={() => handleCardPress(card)}
                              onHover={setHoveredCard}
                            />
                          ))
                        : section.data.map((card, index) => (
                            <StacksCardItem
                              key={`${card.name}-${index}`}
                              card={card}
                              isDark={isDark}
                              isLast={index === section.data.length - 1}
                              onPress={() => handleCardPress(card)}
                              onHover={setHoveredCard}
                            />
                          ))}
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </ScrollView>
        </View>
      ) : (
        /* List / Grid View */
        <SectionList
          sections={filteredSections}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#7C3AED" />}
          ListHeaderComponent={
            <View className={`border-b ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
              <Pressable
                onPress={() => setLandsExpanded(!landsExpanded)}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  isDark ? "active:bg-slate-800" : "active:bg-slate-100"
                }`}
              >
                <Text className={`text-sm font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>
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
                    .map(([landName, count]) => {
                      if (count === 0) return null;
                      const info = BASIC_LAND_INFO[landName] || { symbol: "?" };
                      return (
                        <Text
                          key={landName}
                          className={`text-sm font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}
                        >
                          {count}
                          {info.symbol}{" "}
                        </Text>
                      );
                    })}
                  )
                </Text>
                <ChevronDown
                  size={16}
                  color={isDark ? "#64748b" : "#94a3b8"}
                  style={{ transform: [{ rotate: landsExpanded ? "180deg" : "0deg" }] }}
                />
              </Pressable>

              {/* Land Display Row (read-only) */}
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
                      const info = BASIC_LAND_INFO[landName] || { color: "#888", textColor: "#fff", symbol: "?" };
                      return (
                        <View key={landName} className={`items-center ${quantity === 0 ? "opacity-50" : ""}`}>
                          <View
                            className="w-8 h-8 rounded-full items-center justify-center mb-1"
                            style={{ backgroundColor: info.color }}
                          >
                            <Text className="text-sm font-bold" style={{ color: info.textColor }}>
                              {info.symbol}
                            </Text>
                          </View>
                          <Text
                            className={`text-base font-bold text-center ${
                              quantity === 0
                                ? isDark ? "text-slate-600" : "text-slate-400"
                                : isDark ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {quantity}
                          </Text>
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
              className={`flex-row items-center justify-between px-4 py-3 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
            >
              <View className="flex-row items-center gap-2">
                {groupBy !== "category" && (
                  <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: getGroupColor(section.title) }} />
                )}
                <Text className={`text-sm font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {section.title} ({section.data.reduce((sum, c) => sum + c.quantity, 0)})
                </Text>
              </View>
              <ChevronDown
                size={16}
                color={isDark ? "#64748b" : "#94a3b8"}
                style={{ transform: [{ rotate: expandedSections.has(section.title) ? "180deg" : "0deg" }] }}
              />
            </Pressable>
          )}
          renderItem={({ item, section }) => {
            if (!expandedSections.has(section.title)) return null;
            return viewMode === "list" ? (
              <CardListItem card={item} isDark={isDark} onPress={() => handleCardPress(item)} />
            ) : null;
          }}
          renderSectionFooter={({ section }) => {
            if (!expandedSections.has(section.title) || viewMode !== "grid") return null;
            return (
              <View className="flex-row flex-wrap px-3 lg:px-5 pb-2">
                {section.data.map((card, index) => (
                  <CardGridItem key={`${card.name}-${index}`} card={card} isDark={isDark} onPress={() => handleCardPress(card)} />
                ))}
              </View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      {/* Group By Menu Modal */}
      <Modal visible={groupByMenuVisible} transparent animationType="fade" onRequestClose={() => setGroupByMenuVisible(false)}>
        <Pressable className="flex-1" onPress={() => setGroupByMenuVisible(false)}>
          <View
            style={{ position: "absolute", top: groupByMenuPosition.top, left: groupByMenuPosition.left }}
            className={`min-w-[200px] rounded-lg border shadow-lg ${
              isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
            }`}
          >
            {GROUP_BY_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  setGroupBy(option.value);
                  setGroupByMenuVisible(false);
                }}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  isDark ? "active:bg-slate-700" : "active:bg-slate-100"
                }`}
              >
                <Text className={isDark ? "text-white" : "text-slate-900"}>{option.label}</Text>
                {groupBy === option.value && (
                  <View className="h-2 w-2 rounded-full bg-purple-500" />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* View Mode Menu Modal */}
      <Modal visible={viewModeMenuVisible} transparent animationType="fade" onRequestClose={() => setViewModeMenuVisible(false)}>
        <Pressable className="flex-1" onPress={() => setViewModeMenuVisible(false)}>
          <View
            style={{ position: "absolute", top: viewModeMenuPosition.top, left: viewModeMenuPosition.left }}
            className={`min-w-[200px] rounded-lg border shadow-lg ${
              isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
            }`}
          >
            {VIEW_MODE_OPTIONS.filter((o) => !o.desktopOnly || isDesktop).map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  changeViewMode(option.value);
                  setViewModeMenuVisible(false);
                }}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  isDark ? "active:bg-slate-700" : "active:bg-slate-100"
                }`}
              >
                <Text className={isDark ? "text-white" : "text-slate-900"}>{option.label}</Text>
                {viewMode === option.value && (
                  <View className="h-2 w-2 rounded-full bg-purple-500" />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Card Detail Modal */}
      {isDesktop ? (
        <Modal visible={cardModalVisible} transparent animationType="fade" onRequestClose={closeCardModal}>
          {/* Desktop: Dialog with backdrop */}
          <Pressable className="flex-1 bg-black/70 items-center justify-start pt-16 px-6 pb-6" onPress={closeCardModal}>
            <Pressable
              className={`max-w-5xl w-full max-h-[90vh] rounded-2xl ${isDark ? "bg-slate-900" : "bg-white"} shadow-2xl`}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <View className={`flex-row items-center justify-between px-6 py-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                <View className="flex-row items-center gap-2 flex-1">
                  {selectedCard?.isCommander && <Crown size={20} color="#eab308" />}
                  <Text className={`text-lg font-bold flex-1 ${isDark ? "text-white" : "text-slate-900"}`} numberOfLines={1}>
                    {selectedCard?.name}
                  </Text>
                  {selectedCard && selectedCard.quantity > 1 && (
                    <View className="bg-purple-500/20 rounded-full px-2 py-0.5">
                      <Text className="text-purple-500 text-xs font-medium">{selectedCard.quantity}x</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={handlePrevCard}
                    disabled={selectedCardIndex <= 0}
                    className={`rounded-full p-2 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"} ${selectedCardIndex <= 0 ? "opacity-30" : ""}`}
                  >
                    <ChevronLeft size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                  </Pressable>
                  <Text className={`text-sm min-w-[50px] text-center ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    {selectedCardIndex + 1} / {allCards.length}
                  </Text>
                  <Pressable
                    onPress={handleNextCard}
                    disabled={selectedCardIndex >= allCards.length - 1}
                    className={`rounded-full p-2 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"} ${selectedCardIndex >= allCards.length - 1 ? "opacity-30" : ""}`}
                  >
                    <ChevronRight size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                  </Pressable>
                  <Pressable onPress={closeCardModal} className={`rounded-full p-2 ml-2 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}>
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
                          source={{ uri: selectedCard.imageUrl || selectedCard.imageSmall }}
                          style={{ width: 320, height: 445, borderRadius: 12 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <View
                          className={`rounded-xl items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
                          style={{ width: 320, height: 445 }}
                        >
                          <Text className={`text-lg ${isDark ? "text-slate-500" : "text-slate-400"}`}>{selectedCard.name}</Text>
                        </View>
                      )}
                    </View>

                    {/* Right: Card Details (read-only) */}
                    <View className="flex-1 gap-4">
                      <View className={`rounded-xl p-4 gap-3 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}>
                        {selectedCard.typeLine && (
                          <View>
                            <Text className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}>Type</Text>
                            <Text className={isDark ? "text-white" : "text-slate-900"}>{selectedCard.typeLine}</Text>
                          </View>
                        )}
                        {selectedCard.manaCost && (
                          <View>
                            <Text className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}>Mana Cost</Text>
                            <Text className={`font-mono ${isDark ? "text-white" : "text-slate-900"}`}>{selectedCard.manaCost}</Text>
                          </View>
                        )}
                        {selectedCard.setCode && (
                          <View>
                            <Text className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}>Set</Text>
                            <Text className={isDark ? "text-white" : "text-slate-900"}>
                              {selectedCard.setCode.toUpperCase()}
                              {selectedCard.collectorNumber && ` #${selectedCard.collectorNumber}`}
                            </Text>
                          </View>
                        )}
                        {selectedCard.rarity && (
                          <View>
                            <Text className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}>Rarity</Text>
                            <Text className={`capitalize ${isDark ? "text-white" : "text-slate-900"}`}>{selectedCard.rarity}</Text>
                          </View>
                        )}
                        {selectedCard.priceUsd != null && (
                          <View>
                            <Text className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}>Price (USD)</Text>
                            <Text className="text-purple-500 font-semibold">${Number(selectedCard.priceUsd).toFixed(2)}</Text>
                          </View>
                        )}
                        {selectedCard.colorIdentity && selectedCard.colorIdentity.length > 0 && (
                          <View>
                            <Text className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}>Color Identity</Text>
                            <View className="flex-row gap-1">
                              {selectedCard.colorIdentity.map((color) => (
                                <View
                                  key={color}
                                  className="h-5 w-5 rounded-full border border-slate-300"
                                  style={{ backgroundColor: MANA_COLORS[color] || "#888" }}
                                />
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      ) : (
        <GlassSheet visible={cardModalVisible} onDismiss={closeCardModal} isDark={isDark}>
          <BottomSheetView style={{ flex: 1 }}>
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800">
              <View className="flex-row items-center gap-2 flex-1">
                {selectedCard?.isCommander && <Crown size={20} color="#eab308" />}
                <Text className="text-white text-lg font-bold flex-1" numberOfLines={1}>
                  {selectedCard?.name}
                </Text>
                {selectedCard && selectedCard.quantity > 1 && (
                  <View className="bg-white/20 rounded-full px-2 py-0.5">
                    <Text className="text-white text-xs font-medium">{selectedCard.quantity}x</Text>
                  </View>
                )}
              </View>
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
                <Pressable onPress={closeCardModal} className="rounded-full p-2 ml-2">
                  <X size={24} color="white" />
                </Pressable>
              </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(24, insets.bottom + 16) }}>
              {selectedCard && (
                <>
                  {/* Card Image */}
                  <View className="items-center mb-6">
                    {selectedCard.imageUrl || selectedCard.imageSmall ? (
                      <Image
                        source={{ uri: selectedCard.imageUrl || selectedCard.imageSmall }}
                        style={{
                          width: Dimensions.get("window").width - 64,
                          height: (Dimensions.get("window").width - 64) * (680 / 488),
                          borderRadius: 12,
                        }}
                        resizeMode="contain"
                      />
                    ) : (
                      <View
                        className="bg-slate-800 rounded-xl items-center justify-center"
                        style={{
                          width: Dimensions.get("window").width - 64,
                          height: (Dimensions.get("window").width - 64) * (680 / 488),
                        }}
                      >
                        <Text className="text-slate-500 text-lg">{selectedCard.name}</Text>
                      </View>
                    )}
                  </View>

                  {/* Card Details */}
                  <View className="bg-slate-900 rounded-xl p-4 gap-3">
                    {selectedCard.typeLine && (
                      <View>
                        <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">Type</Text>
                        <Text className="text-white">{selectedCard.typeLine}</Text>
                      </View>
                    )}
                    {selectedCard.manaCost && (
                      <View>
                        <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">Mana Cost</Text>
                        <Text className="text-white font-mono">{selectedCard.manaCost}</Text>
                      </View>
                    )}
                    {selectedCard.setCode && (
                      <View>
                        <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">Set</Text>
                        <Text className="text-white">
                          {selectedCard.setCode.toUpperCase()}
                          {selectedCard.collectorNumber && ` #${selectedCard.collectorNumber}`}
                        </Text>
                      </View>
                    )}
                    {selectedCard.rarity && (
                      <View>
                        <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">Rarity</Text>
                        <Text className="text-white capitalize">{selectedCard.rarity}</Text>
                      </View>
                    )}
                    {selectedCard.priceUsd != null && (
                      <View>
                        <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">Price (USD)</Text>
                        <Text className="text-purple-500 font-semibold">${Number(selectedCard.priceUsd).toFixed(2)}</Text>
                      </View>
                    )}
                    {selectedCard.colorIdentity && selectedCard.colorIdentity.length > 0 && (
                      <View>
                        <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">Color Identity</Text>
                        <View className="flex-row gap-1">
                          {selectedCard.colorIdentity.map((color) => (
                            <View
                              key={color}
                              className="h-5 w-5 rounded-full border border-slate-600"
                              style={{ backgroundColor: MANA_COLORS[color] || "#888" }}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </BottomSheetView>
        </GlassSheet>
      )}
    </>
  );

  // Render with appropriate wrapper based on screen size
  if (isDesktop) {
    return (
      <View className="flex-1 flex-row">
        <Stack.Screen options={{ headerShown: false }} />
        <DesktopSidebar />
        <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>{pageContent}</View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          title: deck?.name || "Deck",
          headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
          headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
          headerBackTitle: "Explore",
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}>
              <ChevronLeft size={28} color="#7C3AED" />
              <Text style={{ color: "#7C3AED", fontSize: 17 }}>
                Explore
              </Text>
            </Pressable>
          ),
        }}
      />
      <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
        {pageContent}
      </View>
    </>
  );
}
