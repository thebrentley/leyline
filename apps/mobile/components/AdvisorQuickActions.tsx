import { Sparkles, Scissors, PlusCircle, Droplets } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon: React.ReactNode;
}

interface AdvisorQuickActionsProps {
  onActionSelect: (prompt: string) => void;
  disabled?: boolean;
  isDark: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "analyze",
    label: "Analyze",
    prompt: "Analyze this deck and identify its strengths, weaknesses, and key synergies. What is the overall strategy and how well does the deck execute it?",
    icon: <Sparkles size={16} color="#7C3AED" />,
  },
  {
    id: "cuts",
    label: "Suggest Cuts",
    prompt: "What cards should I cut from this deck? Focus on underperformers and cards that don't synergize well with the commander or overall strategy.",
    icon: <Scissors size={16} color="#7C3AED" />,
  },
  {
    id: "adds",
    label: "Suggest Adds",
    prompt: "What cards should I add to improve this deck? Consider my commander's strategy, the deck's weaknesses, and cards that would create strong synergies.",
    icon: <PlusCircle size={16} color="#7C3AED" />,
  },
  {
    id: "mana",
    label: "Fix Mana Base",
    prompt: "Analyze my mana base. Do I have the right land count and color balance? Suggest any changes to lands or mana rocks that would improve consistency.",
    icon: <Droplets size={16} color="#7C3AED" />,
  },
];

export function AdvisorQuickActions({ onActionSelect, disabled, isDark }: AdvisorQuickActionsProps) {
  return (
    <View className="flex-row flex-wrap gap-2 px-4 py-3">
      {QUICK_ACTIONS.map((action) => (
        <Pressable
          key={action.id}
          onPress={() => onActionSelect(action.prompt)}
          disabled={disabled}
          className={`flex-row items-center gap-1.5 px-3 py-2 rounded-full border ${
            disabled
              ? "opacity-50"
              : isDark
                ? "border-purple-800/50 bg-purple-900/20 active:bg-purple-900/40"
                : "border-purple-200 bg-purple-50 active:bg-purple-100"
          }`}
          accessibilityRole="button"
          accessibilityLabel={`${action.label} - ${action.prompt.substring(0, 50)}...`}
          accessibilityState={{ disabled }}
        >
          {action.icon}
          <Text className={`text-sm font-medium ${isDark ? "text-purple-300" : "text-purple-700"}`}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
