import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import type { DeckScores } from "~/lib/api";

interface DeckScoreChipProps {
  deckId: string;
  deckName?: string;
  scores: DeckScores;
  /** "overlay" for use on top of images; "inline" for use in text rows */
  variant?: "overlay" | "inline";
}

const AXIS_COLORS = {
  power: "#a855f7",
  salt: "#ef4444",
  fear: "#f97316",
  airtime: "#3b82f6",
};

const AXIS_LABELS = ["P", "S", "F", "A"] as const;
const AXES = ["power", "salt", "fear", "airtime"] as const;

export function DeckScoreChip({
  deckId,
  deckName,
  scores,
  variant = "overlay",
}: DeckScoreChipProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const isOverlay = variant === "overlay";

  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        router.push(
          `/deck/${deckId}/ranking?name=${encodeURIComponent(deckName || "")}`,
        );
      }}
      className={`flex-row items-center rounded-md ${isOverlay ? "gap-1.5 px-1.5 py-0.5" : "gap-2 px-2 py-1"}`}
      style={{
        backgroundColor: isOverlay
          ? "rgba(0, 0, 0, 0.5)"
          : isDark
            ? "rgba(168, 85, 247, 0.15)"
            : "rgba(168, 85, 247, 0.1)",
      }}
    >
      {AXES.map((axis, i) => (
        <View key={axis} className="flex-row items-center gap-0.5">
          <Text
            className={`font-bold ${isOverlay ? "text-[9px]" : "text-[11px]"}`}
            style={{ color: AXIS_COLORS[axis], opacity: 0.8 }}
          >
            {AXIS_LABELS[i]}
          </Text>
          <Text
            className={`font-semibold ${isOverlay ? "text-[10px]" : "text-xs"}`}
            style={{
              color: isOverlay ? "#ffffff" : isDark ? "#e2e8f0" : "#334155",
            }}
          >
            {scores[axis]}
          </Text>
        </View>
      ))}
    </Pressable>
  );
}
