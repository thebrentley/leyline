import { X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Button } from "~/components/ui/button";
import type { CardSearchResult, DeckCard } from "~/lib/api";

const { width: screenWidth } = Dimensions.get("window");
const cardWidth = screenWidth - 64;
const cardHeight = cardWidth * (680 / 488);

interface CardDetailModalProps {
  visible: boolean;
  onClose: () => void;
  card: (CardSearchResult | DeckCard) & {
    oracleText?: string;
    cmc?: number;
  } | null;
  onAddToCollection?: () => void;
}

// Mana symbol colors
const MANA_COLORS: Record<string, { bg: string; text: string }> = {
  W: { bg: "#F9FAF4", text: "#211D15" },
  U: { bg: "#0E68AB", text: "#FFFFFF" },
  B: { bg: "#150B00", text: "#FFFFFF" },
  R: { bg: "#D3202A", text: "#FFFFFF" },
  G: { bg: "#00733E", text: "#FFFFFF" },
};

function ManaCostDisplay({ manaCost }: { manaCost?: string }) {
  if (!manaCost) return null;

  // Parse mana cost like {2}{U}{U} or {W}{B}
  const symbols = manaCost.match(/\{[^}]+\}/g) || [];

  return (
    <View className="flex-row gap-1">
      {symbols.map((symbol, index) => {
        const code = symbol.replace(/[{}]/g, "");
        const colors = MANA_COLORS[code];
        const isNumber = /^\d+$/.test(code);

        return (
          <View
            key={index}
            className="h-6 w-6 items-center justify-center rounded-full"
            style={{
              backgroundColor: colors?.bg || (isNumber ? "#CAC5C0" : "#CAC5C0"),
            }}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: colors?.text || "#211D15" }}
            >
              {code}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function CardDetailModal({
  visible,
  onClose,
  card,
  onAddToCollection,
}: CardDetailModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  if (!card) return null;

  const imageUrl = "imageUrl" in card ? card.imageUrl : undefined;
  const name = card.name;
  const manaCost = card.manaCost;
  const typeLine = card.typeLine;
  const rarity = card.rarity;
  const setCode = card.setCode;
  const collectorNumber = card.collectorNumber;
  const priceUsd = "priceUsd" in card ? card.priceUsd : undefined;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Text
            className={`text-lg font-semibold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
            numberOfLines={1}
          >
            {name}
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

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, alignItems: "center" }}
        >
          {/* Card Image */}
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: cardWidth, height: cardHeight }}
              className="rounded-xl"
              resizeMode="contain"
            />
          ) : (
            <View
              style={{ width: cardWidth, height: cardHeight }}
              className={`items-center justify-center rounded-xl ${
                isDark ? "bg-slate-800" : "bg-slate-200"
              }`}
            >
              <Text
                className={`text-lg text-center ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                No Image
              </Text>
            </View>
          )}

          {/* Card Details */}
          <View className="w-full mt-6 gap-4">
            {/* Name & Mana Cost */}
            <View className="flex-row items-start justify-between">
              <Text
                className={`text-xl font-bold flex-1 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {name}
              </Text>
              <ManaCostDisplay manaCost={manaCost} />
            </View>

            {/* Type Line */}
            {typeLine && (
              <Text className={isDark ? "text-slate-300" : "text-slate-700"}>
                {typeLine}
              </Text>
            )}

            {/* Set Info */}
            <View className="flex-row items-center gap-2">
              <Text
                className={`text-sm capitalize ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {setCode?.toUpperCase()} #{collectorNumber}
              </Text>
              {rarity && (
                <View
                  className="px-2 py-0.5 rounded"
                  style={{
                    backgroundColor:
                      rarity === "mythic"
                        ? "#ff4d00"
                        : rarity === "rare"
                          ? "#c9a227"
                          : rarity === "uncommon"
                            ? "#c0c0c0"
                            : "#1a1a1a",
                  }}
                >
                  <Text className="text-xs font-medium text-white capitalize">
                    {rarity}
                  </Text>
                </View>
              )}
            </View>

            {/* Price */}
            {priceUsd && (
              <View className="flex-row items-center gap-2">
                <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
                  Price:
                </Text>
                <Text
                  className={`font-semibold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  ${typeof priceUsd === "number" ? priceUsd.toFixed(2) : priceUsd}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Actions */}
        {onAddToCollection && (
          <View className="px-6 py-4 border-t border-slate-200 dark:border-slate-800">
            <Button onPress={onAddToCollection}>
              <Text className="font-semibold text-white">Add to Collection</Text>
            </Button>
          </View>
        )}
      </View>
    </Modal>
  );
}
