import { AlertCircle, Library, Link } from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";
import type { DeckCard } from "~/lib/api";

export function CardListItem({
  card,
  isDark,
  isDesktop,
  onPress,
  onLongPress,
  onRightClick,
}: {
  card: DeckCard;
  isDark: boolean;
  isDesktop?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onRightClick?: (position: { x: number; y: number }) => void;
}) {
  const handleContextMenu = (e: any) => {
    if (isDesktop && onRightClick) {
      e.preventDefault();
      onRightClick({ x: e.clientX, y: e.clientY });
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      // @ts-ignore - onContextMenu is valid on web
      onContextMenu={handleContextMenu}
      className={`relative flex-row items-center gap-3 pr-4 lg:pr-6 overflow-hidden ${
        isDark
          ? "active:bg-slate-800/50 lg:hover:bg-slate-800/50"
          : "active:bg-slate-50 lg:hover:bg-slate-50"
      }`}
    >
      <View className="relative h-12 w-12">
        {card.imageArtCrop ? (
          <Image
            source={{ uri: card.imageArtCrop }}
            className="h-12 w-12"
            resizeMode="cover"
          />
        ) : (
          <View
            className={`h-10 w-10 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
          />
        )}
        {/* Color tag indicator - diagonal corner */}
        {card.colorTag && (
          <View
            className="absolute top-0 left-0"
            style={{
              width: 0,
              height: 0,
              borderTopWidth: 16,
              borderRightWidth: 16,
              borderTopColor: card.colorTag,
              borderRightColor: "transparent",
            }}
          />
        )}
      </View>
      <View className="flex-1">
        <Text
          className={`text-sm font-medium ${
            isDark ? "text-white" : "text-slate-900"
          }`}
          numberOfLines={1}
        >
          {card.name}
        </Text>
        <View className="flex-row items-center gap-2">
          {card.manaCost && (
            <Text
              className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              {card.manaCost}
            </Text>
          )}
          {card.typeLine && (
            <Text
              className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
              numberOfLines={1}
            >
              {card.typeLine.split("—")[0].trim()}
            </Text>
          )}
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        {/* Collection status icons */}
        {card.isLinkedToCollection ? (
          <View className="flex-row items-center">
            <Link size={14} color="#7C3AED" />
          </View>
        ) : card.inCollection && card.hasAvailableCollectionCard ? (
          <Library size={14} color={isDark ? "#94a3b8" : "#64748b"} />
        ) : card.inCollectionDifferentPrint &&
          card.hasAvailableCollectionCard ? (
          <AlertCircle size={14} color="#f59e0b" />
        ) : null}
        <Text
          className={`text-sm font-medium ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {card.quantity}x
        </Text>
      </View>
    </Pressable>
  );
}
