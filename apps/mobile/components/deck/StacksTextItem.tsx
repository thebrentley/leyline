import { AlertCircle, Library, Link } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import type { DeckCard } from "~/lib/api";

export function StacksTextItem({
  card,
  isDark,
  onPress,
  onLongPress,
  onRightClick,
  onHover,
}: {
  card: DeckCard;
  isDark: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onRightClick?: (position: { x: number; y: number }) => void;
  onHover?: (card: DeckCard | null) => void;
}) {
  const handleContextMenu = (e: any) => {
    if (onRightClick) {
      e.preventDefault();
      onRightClick({ x: e.clientX, y: e.clientY });
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      // @ts-ignore
      onContextMenu={handleContextMenu}
      // @ts-ignore
      onMouseEnter={() => onHover?.(card)}
      className={`flex-row items-center justify-between py-1 px-2 rounded ${
        isDark ? "lg:hover:bg-slate-800/50" : "lg:hover:bg-slate-100"
      }`}
    >
      <View className="flex-row items-center gap-1 flex-1 min-w-0">
        <Text
          className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          {card.quantity}
        </Text>
        <Text
          className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
          numberOfLines={1}
        >
          {card.name}
        </Text>
      </View>
      {card.isLinkedToCollection ? (
        <Link size={12} color="#7C3AED" />
      ) : card.inCollection && card.hasAvailableCollectionCard ? (
        <Library size={12} color={isDark ? "#94a3b8" : "#64748b"} />
      ) : card.inCollectionDifferentPrint && card.hasAvailableCollectionCard ? (
        <AlertCircle size={12} color="#f59e0b" />
      ) : null}
    </Pressable>
  );
}
