import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckCard, DeckDetail } from "~/lib/api";
import {
  type ViewMode,
  type GroupBy,
  type CardSection,
  GROUP_BY_OPTIONS,
  GROUP_COLORS,
  isBasicLand,
  STANDARD_LAND_ORDER,
} from "~/components/deck";

export function useDeckSections(deck: DeckDetail | null, viewMode: ViewMode) {
  const [groupBy, setGroupBy] = useState<GroupBy>(() => {
    try {
      const saved = localStorage.getItem("deck_group_by");
      if (saved && GROUP_BY_OPTIONS.some((o) => o.value === saved)) {
        return saved as GroupBy;
      }
    } catch {}
    return "category";
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["Commander", "Mainboard", "Sideboard"]),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [stacksContainerWidth, setStacksContainerWidth] = useState(0);
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());

  const toggleTypeFilter = useCallback((type: string) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Group cards based on groupBy setting
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

        case "color":
          const colors = card.colors || [];
          if (colors.length === 0) {
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
          let cmc = 0;
          const matches = manaCost.match(/\{([^}]+)\}/g) || [];
          for (const match of matches) {
            const symbol = match.replace(/[{}]/g, "");
            if (symbol === "X") continue;
            const num = parseInt(symbol);
            if (!isNaN(num)) {
              cmc += num;
            } else if (symbol !== "") {
              cmc += 1;
            }
          }
          if (cmc >= 7) return "7+";
          return String(cmc);

        case "rarity":
          const rarity = card.rarity?.toLowerCase() || "common";
          return rarity.charAt(0).toUpperCase() + rarity.slice(1);

        case "colorTag":
          if (!card.colorTagId || !deck) return "Untagged";
          const tag = deck.colorTags.find((t) => t.id === card.colorTagId);
          return tag ? tag.name : "Untagged";

        default:
          return "Other";
      }
    },
    [groupBy, deck],
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

    return {
      basicLands: basics,
      nonBasicCards: { commanders, mainboard, sideboard },
    };
  }, [deck]);

  // Group basic lands by name with counts
  const basicLandCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const land of STANDARD_LAND_ORDER) {
      counts[land] = 0;
    }
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

  // Compute existing card IDs for visual indicators in search
  const existingCardIds = useMemo(() => {
    if (!deck) return new Set<string>();
    const ids = new Set<string>();
    for (const card of deck.commanders) ids.add(card.scryfallId);
    for (const card of deck.mainboard) ids.add(card.scryfallId);
    for (const card of deck.sideboard) ids.add(card.scryfallId);
    return ids;
  }, [deck]);

  // Build sections from deck data (excluding basic lands)
  const sections: CardSection[] = useMemo(() => {
    if (!deck) return [];

    const result: CardSection[] = [];

    if (groupBy === "category") {
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
      if (nonBasicCards.commanders.length > 0) {
        result.push({ title: "Commander", data: nonBasicCards.commanders });
      }

      const allCards = [...nonBasicCards.mainboard, ...nonBasicCards.sideboard];
      const grouped: Record<string, DeckCard[]> = {};

      for (const card of allCards) {
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
        if (groupBy === "colorTag") {
          if (a === "Untagged") return 1;
          if (b === "Untagged") return -1;
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
      if (groupBy === "colorTag") {
        const tag = deck?.colorTags.find((t) => t.name === groupName);
        return tag?.color || "#64748b";
      }
      return GROUP_COLORS[groupBy]?.[groupName] || "#64748b";
    },
    [groupBy, deck?.colorTags],
  );

  // Filter sections based on search query and type filters
  const filteredSections = useMemo(() => {
    const hasSearch = searchQuery.trim().length > 0;
    const hasTypeFilter = typeFilters.size > 0;
    if (!hasSearch && !hasTypeFilter) return sections;

    const query = searchQuery.toLowerCase().trim();
    const result: CardSection[] = [];

    for (const section of sections) {
      const matchingCards = section.data.filter((card) => {
        if (hasSearch) {
          const matchesSearch =
            card.name.toLowerCase().includes(query) ||
            card.typeLine?.toLowerCase().includes(query) ||
            card.manaCost?.toLowerCase().includes(query);
          if (!matchesSearch) return false;
        }
        if (hasTypeFilter) {
          const typeLine = card.typeLine?.toLowerCase() || "";
          const matchesType = Array.from(typeFilters).some((type) =>
            typeLine.includes(type.toLowerCase()),
          );
          if (!matchesType) return false;
        }
        return true;
      });
      if (matchingCards.length > 0) {
        result.push({ title: section.title, data: matchingCards });
      }
    }

    return result;
  }, [sections, searchQuery, typeFilters]);

  // Sections for stacks view: include basic lands as a column
  const stacksSections = useMemo(() => {
    const result = [...filteredSections];
    if (basicLands.length > 0) {
      const landsData = searchQuery.trim()
        ? basicLands.filter((c) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
          )
        : basicLands;
      if (landsData.length > 0) {
        result.push({ title: "Basic Lands", data: landsData });
      }
    }
    return result;
  }, [filteredSections, basicLands, searchQuery]);

  // Pack stacks sections into columns
  const stacksColumns = useMemo(() => {
    if (stacksSections.length === 0) return [] as { sections: CardSection[] }[];

    const COLUMN_WIDTH = viewMode === "stacks-text" ? 220 : 200;
    const COLUMN_TOTAL_WIDTH = COLUMN_WIDTH + 8;
    const HORIZONTAL_PADDING = 16;

    const maxColumns =
      stacksContainerWidth > 0
        ? Math.max(
            1,
            Math.floor(
              (stacksContainerWidth - HORIZONTAL_PADDING) / COLUMN_TOTAL_WIDTH,
            ),
          )
        : stacksSections.length;
    const numColumns = Math.min(stacksSections.length, maxColumns);

    if (numColumns >= stacksSections.length) {
      const commanderIdx = stacksSections.findIndex(
        (s) => s.title === "Commander",
      );
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
      if (viewMode === "stacks-cards") {
        return (
          HEADER_HEIGHT + (n - 1) * CARD_OVERLAP_HEIGHT + CARD_IMAGE_HEIGHT
        );
      }
      return HEADER_HEIGHT + n * TEXT_ITEM_HEIGHT;
    };

    const sectionHeights = stacksSections.map(getSectionHeight);

    const columns: { sections: CardSection[]; totalHeight: number }[] = [];
    for (let i = 0; i < numColumns; i++) {
      columns.push({ sections: [], totalHeight: 0 });
    }

    const commanderIdx = stacksSections.findIndex(
      (s) => s.title === "Commander",
    );
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

  // Flatten all cards for navigation
  const allCards = useMemo(() => {
    return filteredSections.flatMap((section) => section.data);
  }, [filteredSections]);

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

  const toggleSection = useCallback((title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchVisible((prev) => {
      if (prev) setSearchQuery("");
      return !prev;
    });
  }, []);

  return {
    groupBy,
    setGroupBy,
    expandedSections,
    setExpandedSections,
    searchQuery,
    setSearchQuery,
    searchVisible,
    toggleSearch,
    stacksContainerWidth,
    setStacksContainerWidth,
    basicLands,
    basicLandCounts,
    totalBasicLands,
    existingCardIds,
    sections,
    filteredSections,
    stacksSections,
    stacksColumns,
    allCards,
    getGroupColor,
    toggleSection,
    typeFilters,
    toggleTypeFilter,
  };
}
