import { Image, Pressable, Text, View } from "react-native";
import type { DeckCard } from "~/lib/api";

export function StacksCardItem({
  card,
  isDark,
  isLast,
  onPress,
  onLongPress,
  onRightClick,
  onHover,
}: {
  card: DeckCard;
  isDark: boolean;
  isLast?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onRightClick?: (position: { x: number; y: number }) => void;
  onHover?: (card: DeckCard | null) => void;
}) {
  const imageUri = card.imageUrl || card.imageSmall;

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
      style={!isLast ? { height: 30, overflow: "hidden" as any } : undefined}
    >
      <View className="relative">
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            className="aspect-[488/680] w-full rounded-lg"
            resizeMode="contain"
          />
        ) : (
          <View
            className={`aspect-[488/680] w-full items-center justify-center rounded-lg ${
              isDark ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            <Text
              className={`text-xs text-center px-1 ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
              numberOfLines={2}
            >
              {card.name}
            </Text>
          </View>
        )}
        {card.quantity > 1 && (
          <View className="absolute top-1 right-1 bg-black/70 rounded-full px-1.5 py-0.5">
            <Text className="text-xs font-bold text-white">
              {card.quantity}x
            </Text>
          </View>
        )}
        {card.colorTag && (
          <View
            className="absolute top-0 left-0"
            style={{
              width: 0,
              height: 0,
              borderTopWidth: 20,
              borderRightWidth: 20,
              borderTopColor: card.colorTag,
              borderRightColor: "transparent",
            }}
          />
        )}
      </View>
    </Pressable>
  );
}
