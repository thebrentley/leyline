import {
  BarChart3,
  DollarSign,
  Grid3X3,
  History,
  Layers,
  List,
  Play,
  Search,
  X,
} from "lucide-react-native";
import { useRef } from "react";
import { Dimensions, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { KEYBOARD_ACCESSORY_ID } from "~/components/ui/KeyboardDoneAccessory";
import type { DeckDetail } from "~/lib/api";
import type { ViewMode } from "~/components/deck";

const QUICK_FILTER_TYPES = [
  "Creature",
  "Instant",
  "Sorcery",
  "Enchantment",
  "Artifact",
  "Planeswalker",
  "Land",
];

interface DeckToolbarProps {
  id: string;
  deck: DeckDetail | null;
  isDark: boolean;
  viewMode: ViewMode;
  searchVisible: boolean;
  searchQuery: string;
  allCardsCount: number;
  isDesktop?: boolean;
  typeFilters?: Set<string>;
  onToggleSearch: () => void;
  onSearchChange: (query: string) => void;
  onToggleTypeFilter?: (type: string) => void;
  onOpenGroupByMenu: (position: { top: number; left: number }) => void;
  onOpenViewModeMenu: (position: { top: number; left: number }) => void;
}

export function DeckToolbar({
  id,
  deck,
  isDark,
  viewMode,
  searchVisible,
  searchQuery,
  allCardsCount,
  isDesktop,
  typeFilters,
  onToggleSearch,
  onSearchChange,
  onToggleTypeFilter,
  onOpenGroupByMenu,
  onOpenViewModeMenu,
}: DeckToolbarProps) {
  const groupByButtonRef = useRef<View>(null);
  const viewModeButtonRef = useRef<View>(null);

  const iconColor = isDark ? "#94a3b8" : "#64748b";
  const labelClass = `text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`;
  const btnBase = `flex-row items-center gap-1.5 p-2.5 lg:px-4 lg:py-2 rounded-lg`;
  const btnNeutral = `${btnBase} ${
    isDark
      ? "bg-slate-800 lg:hover:bg-slate-700"
      : "bg-white border border-slate-200 lg:hover:bg-slate-50"
  }`;

  return (
    <>
      {/* Sticky Toolbar */}
      <View
        className={`flex-row items-center justify-between px-3 lg:px-6 py-2 lg:py-3 border-b ${
          isDark
            ? "bg-slate-900 border-slate-800"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <View className="flex-row items-center gap-2 lg:gap-3 flex-1 mr-4 lg:mr-6">
          {/* Group By Button */}
          <View ref={groupByButtonRef} className="relative">
            <Pressable
              onPress={() => {
                groupByButtonRef.current?.measure(
                  (x, y, width, height, pageX, pageY) => {
                    const screenW = Dimensions.get("window").width;
                    const menuW = 200;
                    onOpenGroupByMenu({
                      top: pageY + height + 4,
                      left: Math.max(8, Math.min(pageX, screenW - menuW - 8)),
                    });
                  },
                );
              }}
              className={btnNeutral}
            >
              <Layers size={18} color={iconColor} />
              {isDesktop && <Text className={labelClass}>Group</Text>}
            </Pressable>
          </View>

          {/* Search: inline on desktop, toggle on mobile */}
          {isDesktop ? (
            <View
              className={`flex-row items-center rounded-lg px-3 py-1.5 flex-1 max-w-xs ${
                isDark
                  ? "bg-slate-800 border border-slate-700"
                  : "bg-white border border-slate-200"
              }`}
            >
              <Search size={16} color={isDark ? "#64748b" : "#94a3b8"} />
              <TextInput
                value={searchQuery}
                onChangeText={onSearchChange}
                placeholder="Search cards..."
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                className={`flex-1 ml-2 text-sm ${isDark ? "text-white" : "text-slate-900"}`}
                autoCapitalize="none"
                autoCorrect={false}
                // @ts-ignore - web style
                style={{ outlineStyle: "none" }}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => onSearchChange("")}>
                  <X size={16} color={isDark ? "#64748b" : "#94a3b8"} />
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable
              onPress={onToggleSearch}
              className={`${btnBase} ${
                searchVisible
                  ? "bg-purple-500/20"
                  : isDark
                    ? "bg-slate-800 lg:hover:bg-slate-700"
                    : "bg-white border border-slate-200 lg:hover:bg-slate-50"
              }`}
            >
              <Search
                size={18}
                color={searchVisible ? "#7C3AED" : iconColor}
              />
            </Pressable>
          )}

          {/* Version Dropdown - owner only */}
          {!deck?.isReadOnly && (
            <Pressable
              onPress={() =>
                router.push(
                  `/deck/${id}/versions?name=${encodeURIComponent(deck?.name || "")}`,
                )
              }
              className={btnNeutral}
            >
              <History size={18} color={iconColor} />
              {isDesktop && <Text className={labelClass}>Versions</Text>}
            </Pressable>
          )}
        </View>

        <View className="flex-row items-center gap-2 lg:gap-3">
          {/* Playtest Button */}
          <Pressable
            onPress={() =>
              router.push(
                `/deck/${id}/playtest?name=${encodeURIComponent(deck?.name || "")}`,
              )
            }
            className={`${btnBase} bg-green-500/10 lg:hover:bg-green-500/20`}
          >
            <Play size={18} color="#22c55e" />
            {isDesktop && (
              <Text className="text-sm font-medium text-green-500">
                Playtest
              </Text>
            )}
          </Pressable>

          {/* Ranking Button - only show if deck has cards */}
          {allCardsCount > 0 && (
            <Pressable
              onPress={() =>
                router.push(
                  `/deck/${id}/ranking?name=${encodeURIComponent(deck?.name || "")}`,
                )
              }
              className={`${btnBase} bg-purple-500/10 lg:hover:bg-purple-500/20`}
            >
              <BarChart3 size={18} color="#a855f7" />
              {isDesktop && (
                <Text className="text-sm font-medium text-purple-400">
                  Ranking
                </Text>
              )}
            </Pressable>
          )}

          {/* Price Button */}
          <Pressable
            onPress={() =>
              router.push(
                `/deck/${id}/price?name=${encodeURIComponent(deck?.name || "")}`,
              )
            }
            className={`${btnBase} bg-blue-500/10 lg:hover:bg-blue-500/20`}
          >
            <DollarSign size={18} color="#7C3AED" />
            {isDesktop && (
              <Text className="text-sm font-medium text-purple-500">
                Price
              </Text>
            )}
          </Pressable>

          {/* View Mode Dropdown */}
          <View ref={viewModeButtonRef} className="relative">
            <Pressable
              onPress={() => {
                viewModeButtonRef.current?.measure(
                  (x, y, width, height, pageX, pageY) => {
                    const screenW = Dimensions.get("window").width;
                    const menuW = 200;
                    onOpenViewModeMenu({
                      top: pageY + height + 4,
                      left: Math.max(8, Math.min(pageX, screenW - menuW - 8)),
                    });
                  },
                );
              }}
              className={btnNeutral}
            >
              {viewMode === "list" ? (
                <List size={18} color={iconColor} />
              ) : viewMode === "grid" ? (
                <Grid3X3 size={18} color={iconColor} />
              ) : (
                <Layers size={18} color={iconColor} />
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Quick Filter Chips (desktop only) */}
      {isDesktop && onToggleTypeFilter && (
        <View
          className={`flex-row items-center gap-2 px-6 py-2 border-b ${
            isDark
              ? "bg-slate-900/50 border-slate-800"
              : "bg-slate-50/50 border-slate-200"
          }`}
        >
          <Text
            className={`text-xs font-medium ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
            Filter:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {QUICK_FILTER_TYPES.map((type) => {
              const active = typeFilters?.has(type);
              return (
                <Pressable
                  key={type}
                  onPress={() => onToggleTypeFilter(type)}
                  className={`px-3 py-1 rounded-full border ${
                    active
                      ? "bg-purple-500/20 border-purple-500/50"
                      : isDark
                        ? "bg-slate-800 border-slate-700 lg:hover:bg-slate-700"
                        : "bg-white border-slate-200 lg:hover:bg-slate-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      active
                        ? "text-purple-400"
                        : isDark
                          ? "text-slate-300"
                          : "text-slate-600"
                    }`}
                  >
                    {type}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {typeFilters && typeFilters.size > 0 && (
            <Pressable
              onPress={() => {
                typeFilters.forEach((t) => onToggleTypeFilter(t));
              }}
              className="px-2 py-1"
            >
              <Text className="text-xs font-medium text-slate-500">Clear</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Mobile Search Bar */}
      {searchVisible && !isDesktop && (
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
              onChangeText={onSearchChange}
              placeholder="search your collection"
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              className={`flex-1 ml-2 text-sm ${isDark ? "text-white" : "text-slate-900"}`}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => onSearchChange("")}>
                <X size={16} color={isDark ? "#64748b" : "#94a3b8"} />
              </Pressable>
            )}
          </View>
          {searchQuery.trim() && (
            <Text
              className={`mt-1 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              {allCardsCount} {allCardsCount === 1 ? "card" : "cards"} found
            </Text>
          )}
        </View>
      )}
    </>
  );
}
