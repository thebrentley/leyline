import { useColorScheme } from "nativewind";
import { Text, View } from "react-native";

interface ConfidenceBadgeProps {
  confidence: number; // 0-1
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Determine color based on confidence level
  const getConfidenceColor = () => {
    if (confidence >= 0.95) return { bg: "bg-emerald-500", text: "text-white" };
    if (confidence >= 0.8) return { bg: "bg-green-500", text: "text-white" };
    if (confidence >= 0.6) return { bg: "bg-yellow-500", text: "text-slate-900" };
    return { bg: "bg-orange-500", text: "text-white" };
  };

  const getConfidenceLabel = () => {
    if (confidence >= 0.95) return "Excellent";
    if (confidence >= 0.8) return "Good";
    if (confidence >= 0.6) return "Fair";
    return "Low";
  };

  const colors = getConfidenceColor();
  const label = getConfidenceLabel();
  const percentage = Math.round(confidence * 100);

  return (
    <View className={`px-2 py-0.5 rounded ${colors.bg}`}>
      <Text className={`text-xs font-semibold ${colors.text}`}>
        {percentage}% • {label}
      </Text>
    </View>
  );
}
