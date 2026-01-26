import { useColorScheme } from "nativewind";
import { Text, View } from "react-native";

interface ScanProgressBarProps {
  current: number;
  total: number;
}

export function ScanProgressBar({ current, total }: ScanProgressBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <View className="w-full">
      <View className="flex-row justify-between mb-1">
        <Text
          className={`text-sm font-medium ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}
        >
          Adding cards to collection...
        </Text>
        <Text
          className={`text-sm font-medium ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}
        >
          {current}/{total}
        </Text>
      </View>
      <View
        className={`h-2 rounded-full overflow-hidden ${
          isDark ? "bg-slate-800" : "bg-slate-200"
        }`}
      >
        <View
          className="h-full bg-emerald-500 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </View>
    </View>
  );
}
