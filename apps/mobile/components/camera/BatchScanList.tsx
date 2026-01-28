import { Trash2, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ScannedCard } from "~/hooks/useCamera";
import { ScanProgressBar } from "./ScanProgressBar";

interface BatchScanListProps {
  cards: ScannedCard[];
  onRemove: (cardId: string) => void;
  onFinish: () => void;
  isAdding: boolean;
  addingProgress?: { current: number; total: number };
}

export function BatchScanList({
  cards,
  onRemove,
  onFinish,
  isAdding,
  addingProgress,
}: BatchScanListProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  if (cards.length === 0) return null;

  return (
    <View
      className={`absolute bottom-0 left-0 right-0 rounded-t-2xl border-t ${
        isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
      }`}
      style={{
        paddingBottom: insets.bottom + 16,
        maxHeight: "50%",
      }}
    >
      {/* Header */}
      <View
        className={`px-4 py-3 border-b ${
          isDark ? "border-slate-800" : "border-slate-200"
        }`}
      >
        <Text
          className={`text-lg font-bold ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          Scanned Cards ({cards.length})
        </Text>
      </View>

      {/* Progress Bar (shown when adding) */}
      {isAdding && addingProgress && (
        <View
          className={`px-4 py-3 border-b ${
            isDark ? "border-slate-800" : "border-slate-200"
          }`}
        >
          <ScanProgressBar
            current={addingProgress.current}
            total={addingProgress.total}
          />
        </View>
      )}

      {/* Card List */}
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        style={{ maxHeight: 200 }}
        renderItem={({ item }) => (
          <View
            className={`flex-row items-center justify-between px-4 py-3 border-b ${
              isDark ? "border-slate-800" : "border-slate-100"
            }`}
          >
            <View className="flex-row items-center gap-3 flex-1">
              {/* Card Image */}
              {item.imageSmall ? (
                <Image
                  source={{ uri: item.imageSmall }}
                  className="h-12 w-9 rounded"
                  resizeMode="cover"
                />
              ) : (
                <View
                  className={`h-12 w-9 rounded items-center justify-center ${
                    isDark ? "bg-slate-800" : "bg-slate-200"
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      isDark ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    ?
                  </Text>
                </View>
              )}

              {/* Card Info */}
              <View className="flex-1">
                <Text
                  className={`font-medium ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  className={`text-xs ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                  numberOfLines={1}
                >
                  {item.setName} • {item.setCode?.toUpperCase()}
                </Text>
              </View>

              {/* Quantity */}
              {item.quantity > 1 && (
                <Text
                  className={`text-sm font-semibold ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  x{item.quantity}
                </Text>
              )}
            </View>

            {/* Remove Button */}
            <Pressable
              onPress={() => onRemove(item.id)}
              disabled={isAdding}
              className="p-2 ml-2"
            >
              <Trash2
                size={18}
                color={isAdding ? "#64748b" : "#ef4444"}
              />
            </Pressable>
          </View>
        )}
      />

      {/* Action Button */}
      <View className="px-4 pt-3">
        <Pressable
          onPress={onFinish}
          disabled={isAdding || cards.length === 0}
          className={`py-3 px-6 rounded-lg ${
            isAdding || cards.length === 0
              ? "bg-slate-600"
              : isDark
              ? "bg-purple-600 active:bg-purple-700"
              : "bg-purple-500 active:bg-purple-600"
          }`}
        >
          {isAdding ? (
            <View className="flex-row items-center justify-center gap-2">
              <ActivityIndicator color="white" size="small" />
              <Text className="text-white text-center font-semibold text-base">
                Adding...
              </Text>
            </View>
          ) : (
            <Text className="text-white text-center font-semibold text-base">
              Add {cards.length} Card{cards.length !== 1 ? "s" : ""} to
              Collection
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
