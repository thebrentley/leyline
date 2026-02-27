import { Pressable, Text, View } from "react-native";
import { Check, ChevronRight, HelpCircle, X } from "lucide-react-native";

interface RsvpSummaryButtonProps {
  goingCount: number;
  notGoingCount: number;
  pendingCount: number;
  myStatus: "accepted" | "declined" | null;
  onPress: () => void;
  isDark: boolean;
}

export function RsvpSummaryButton({
  goingCount,
  notGoingCount,
  pendingCount,
  myStatus,
  onPress,
  isDark,
}: RsvpSummaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between rounded-xl border px-4 py-3 ${
        isDark
          ? "border-slate-800 bg-slate-900 active:bg-slate-800"
          : "border-slate-200 bg-slate-50 active:bg-slate-100"
      }`}
    >
      <View className="flex-row items-center gap-4">
        <View className="flex-row items-center gap-1.5">
          <Check size={16} color="#22c55e" />
          <Text
            className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}
          >
            {goingCount}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <X size={16} color="#ef4444" />
          <Text
            className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}
          >
            {notGoingCount}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <HelpCircle size={16} color={isDark ? "#64748b" : "#94a3b8"} />
          <Text
            className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            {pendingCount}
          </Text>
        </View>
        {myStatus && (
          <View
            className={`rounded-full px-2 py-0.5 ${
              myStatus === "accepted" ? "bg-green-600/20" : "bg-red-600/20"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                myStatus === "accepted" ? "text-green-500" : "text-red-500"
              }`}
            >
              {myStatus === "accepted" ? "Going" : "Not going"}
            </Text>
          </View>
        )}
      </View>
      <ChevronRight size={18} color={isDark ? "#64748b" : "#94a3b8"} />
    </Pressable>
  );
}
