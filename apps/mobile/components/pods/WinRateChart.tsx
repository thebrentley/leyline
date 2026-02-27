import { View, Text, Pressable } from "react-native";
import { useColorScheme } from "nativewind";

export interface WinRateBar {
  key: string;
  displayName: string;
  winRate: number;
  wins: number;
  gamesPlayed: number;
}

interface WinRateChartProps {
  bars: WinRateBar[];
  mode: "player" | "deck";
  onToggle: () => void;
}

export function WinRateChart({ bars, mode, onToggle }: WinRateChartProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const sorted = [...bars].sort((a, b) => b.winRate - a.winRate);
  const maxRate = Math.max(...sorted.map((m) => m.winRate), 1);

  return (
    <View className="gap-3">
      {/* Header row with label + toggle */}
      <View className="flex-row items-center justify-between mb-1">
        <Text className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Win Rates
        </Text>

        <View className={`flex-row rounded-lg overflow-hidden border ${isDark ? "border-slate-700" : "border-slate-300"}`}>
          <Pressable
            onPress={mode !== "player" ? onToggle : undefined}
            className={`px-3 py-1 ${mode === "player" ? (isDark ? "bg-purple-600" : "bg-violet-500") : (isDark ? "bg-slate-800" : "bg-white")}`}
          >
            <Text className={`text-xs font-medium ${mode === "player" ? "text-white" : (isDark ? "text-slate-400" : "text-slate-500")}`}>
              Player
            </Text>
          </Pressable>
          <Pressable
            onPress={mode !== "deck" ? onToggle : undefined}
            className={`px-3 py-1 ${mode === "deck" ? (isDark ? "bg-purple-600" : "bg-violet-500") : (isDark ? "bg-slate-800" : "bg-white")}`}
          >
            <Text className={`text-xs font-medium ${mode === "deck" ? "text-white" : (isDark ? "text-slate-400" : "text-slate-500")}`}>
              Deck
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Bars */}
      {sorted.map((bar) => {
        const barPercent = (bar.winRate / maxRate) * 100;

        return (
          <View key={bar.key} className="flex-row items-center gap-3">
            {/* Name label */}
            <Text
              numberOfLines={1}
              className={`w-20 text-xs font-medium text-right ${isDark ? "text-slate-300" : "text-slate-600"}`}
            >
              {bar.displayName}
            </Text>

            {/* Bar container */}
            <View className="flex-1 flex-row items-center gap-2">
              <View
                className={`h-6 flex-1 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
              >
                <View
                  style={{ width: `${Math.max(barPercent, 2)}%` }}
                  className={`h-6 rounded ${isDark ? "bg-purple-500" : "bg-violet-500"}`}
                />
              </View>

              {/* Win rate + record */}
              <Text
                className={`w-24 text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}
              >
                {bar.winRate.toFixed(0)}%{" "}
                <Text
                  className={`font-normal ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  ({bar.wins}W / {bar.gamesPlayed}G)
                </Text>
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
