import { ChevronDown, Minus, Plus } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { BASIC_LAND_INFO, STANDARD_LAND_ORDER } from "./deck-detail-constants";

export function BasicLandControls({
  basicLandCounts,
  landsExpanded,
  onToggleExpanded,
  onQuantityChange,
  isDark,
  isReadOnly,
}: {
  basicLandCounts: Record<string, number>;
  landsExpanded: boolean;
  onToggleExpanded: () => void;
  onQuantityChange: (landName: string, delta: number) => void;
  isDark: boolean;
  isReadOnly?: boolean;
}) {
  const sortedEntries = Object.entries(basicLandCounts).sort(([a], [b]) => {
    const aBase = a.replace("Snow-Covered ", "");
    const bBase = b.replace("Snow-Covered ", "");
    const aIdx = STANDARD_LAND_ORDER.indexOf(aBase);
    const bIdx = STANDARD_LAND_ORDER.indexOf(bBase);
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  return (
    <View
      className={`border-b ${
        isDark
          ? "bg-slate-900/50 border-slate-800"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      {/* Title Row - Pressable to toggle */}
      <Pressable
        onPress={onToggleExpanded}
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
          {sortedEntries.map(([landName, count], index, array) => {
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
          {sortedEntries.map(([landName, quantity]) => {
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
                    onPress={() => onQuantityChange(landName, 1)}
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
                    onPress={() => onQuantityChange(landName, -1)}
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
  );
}
