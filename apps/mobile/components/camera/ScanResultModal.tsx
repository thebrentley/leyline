import { Search, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { FlatList, Image, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CardSearchResult } from "~/lib/api";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface ScanResultModalProps {
  visible: boolean;
  ocrText: string;
  matches: Array<CardSearchResult & { distance: number; confidence: number }>;
  onSelectCard: (card: CardSearchResult) => void;
  onClose: () => void;
  onManualSearch: () => void;
}

export function ScanResultModal({
  visible,
  ocrText,
  matches,
  onSelectCard,
  onClose,
  onManualSearch,
}: ScanResultModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
        style={{ paddingTop: insets.top }}
      >
        {/* Header */}
        <View
          className={`flex-row items-center justify-between px-4 py-3 border-b ${
            isDark ? "border-slate-800" : "border-slate-200"
          }`}
        >
          <Text
            className={`text-lg font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Card Detected
          </Text>
          <Pressable onPress={onClose} className="p-1">
            <X size={24} color={isDark ? "#94a3b8" : "#64748b"} />
          </Pressable>
        </View>

        {/* OCR Result */}
        <View
          className={`px-4 py-3 border-b ${
            isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-slate-50"
          }`}
        >
          <Text
            className={`text-xs font-semibold mb-1 ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Detected Text:
          </Text>
          <Text
            className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}
          >
            "{ocrText}"
          </Text>
        </View>

        {/* Instructions */}
        <View className="px-4 py-3">
          <Text
            className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}
          >
            {matches.length > 0
              ? "Select the correct card from the matches below:"
              : "No matches found. Try manual search."}
          </Text>
        </View>

        {/* Match List */}
        {matches.length > 0 ? (
          <FlatList
            data={matches}
            keyExtractor={(item) => item.scryfallId}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onSelectCard(item)}
                className={`flex-row items-center gap-3 px-4 py-3 border-b ${
                  isDark
                    ? "border-slate-800 active:bg-slate-900"
                    : "border-slate-100 active:bg-slate-50"
                }`}
              >
                {/* Card Image */}
                {item.imageSmall ? (
                  <Image
                    source={{ uri: item.imageSmall }}
                    className="h-20 w-14 rounded"
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    className={`h-20 w-14 rounded items-center justify-center ${
                      isDark ? "bg-slate-800" : "bg-slate-200"
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      No Image
                    </Text>
                  </View>
                )}

                {/* Card Info */}
                <View className="flex-1">
                  <Text
                    className={`font-semibold mb-1 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {item.name}
                  </Text>
                  <Text
                    className={`text-xs mb-1 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {item.setName} • {item.setCode?.toUpperCase()} #
                    {item.collectorNumber}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <ConfidenceBadge confidence={item.confidence} />
                    {item.priceUsd && (
                      <Text className="text-xs text-purple-500 font-medium">
                        ${item.priceUsd}
                      </Text>
                    )}
                  </View>
                </View>
              </Pressable>
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <Search size={48} color={isDark ? "#334155" : "#cbd5e1"} />
            <Text
              className={`mt-4 text-center ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              No matches found for "{ocrText}"
            </Text>
          </View>
        )}

        {/* Manual Search Button */}
        <View
          className={`absolute bottom-0 left-0 right-0 p-4 border-t ${
            isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
          }`}
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Pressable
            onPress={onManualSearch}
            className={`py-3 px-6 rounded-lg border ${
              isDark
                ? "border-slate-700 active:bg-slate-800"
                : "border-slate-300 active:bg-slate-100"
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Card Not Listed - Search Manually
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
