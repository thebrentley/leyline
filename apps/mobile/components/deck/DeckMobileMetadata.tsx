import { Text, View } from "react-native";
import type { DeckDetail } from "~/lib/api";
import { MANA_COLORS } from "~/components/deck";

interface DeckMobileMetadataProps {
  deck: DeckDetail;
  isDark: boolean;
}

export function DeckMobileMetadata({ deck, isDark }: DeckMobileMetadataProps) {
  return (
    <View
      className={`flex-row items-center gap-2 px-3 py-2 border-b ${
        isDark ? "border-slate-800" : "border-slate-200"
      }`}
    >
      {deck.colorIdentity.length > 0 && (
        <View className="flex-row gap-1 mr-1">
          {deck.colorIdentity.map((color) => (
            <View
              key={color}
              className="h-4 w-4 rounded-full border"
              style={{
                backgroundColor: MANA_COLORS[color] || "#888",
                borderColor: isDark ? "#475569" : "#cbd5e1",
              }}
            />
          ))}
        </View>
      )}
      {deck.format && (
        <Text
          className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          {deck.format}
        </Text>
      )}
      <Text
        className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
      >
        {deck.cardCount} cards
      </Text>
      {deck.isReadOnly && deck.ownerName && (
        <Text
          className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          by {deck.ownerName}
        </Text>
      )}
    </View>
  );
}
