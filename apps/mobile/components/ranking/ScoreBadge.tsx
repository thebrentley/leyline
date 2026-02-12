import { View, Text } from "react-native";
import { useColorScheme } from "nativewind";
import type { DeckScores } from "~/lib/api";

interface ScoreBadgeProps {
  scores: DeckScores;
  compact?: boolean;
}

const AXIS_COLORS = {
  power: "#a855f7", // purple
  salt: "#ef4444", // red
  fear: "#f97316", // orange
  airtime: "#3b82f6", // blue
};

const AXIS_LABELS = {
  power: "Power",
  salt: "Salt",
  fear: "Fear",
  airtime: "Air",
};

export function ScoreBadge({ scores, compact = false }: ScoreBadgeProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  if (compact) {
    // Compact view - just show the scores as colored bars
    return (
      <View className="flex-row gap-1">
        {(["power", "salt", "fear", "airtime"] as const).map((axis) => (
          <View key={axis} className="items-center">
            <View
              className="rounded-sm"
              style={{
                width: 32,
                height: 4,
                backgroundColor: AXIS_COLORS[axis],
                opacity: 0.3 + (scores[axis] / 100) * 0.7,
              }}
            />
            <Text
              className={`text-[10px] mt-0.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              {scores[axis]}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  // Full view - show axis names and scores
  return (
    <View className="flex-row gap-3">
      {(["power", "salt", "fear", "airtime"] as const).map((axis) => (
        <View key={axis} className="items-center">
          <Text
            className={`text-xs font-medium mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}
          >
            {AXIS_LABELS[axis]}
          </Text>
          <View
            className="rounded px-2 py-1"
            style={{
              backgroundColor: AXIS_COLORS[axis] + "20",
            }}
          >
            <Text
              className="text-sm font-bold"
              style={{ color: AXIS_COLORS[axis] }}
            >
              {scores[axis]}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
