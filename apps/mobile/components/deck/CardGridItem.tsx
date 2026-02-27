import { AlertCircle, Library, Link } from "lucide-react-native";
import { useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import type { DeckCard } from "~/lib/api";

export function CardGridItem({
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
  const imageUri = card.imageUrl || card.imageSmall;
  const [hovered, setHovered] = useState(false);

  const handleContextMenu = (e: any) => {
    if (isDesktop && onRightClick) {
      e.preventDefault();
      onRightClick({ x: e.clientX, y: e.clientY });
    }
  };

  const isWeb = Platform.OS === "web";

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      // @ts-ignore - onContextMenu is valid on web
      onContextMenu={handleContextMenu}
      // @ts-ignore - onMouseEnter/Leave valid on web
      onMouseEnter={isWeb && isDesktop ? () => setHovered(true) : undefined}
      // @ts-ignore
      onMouseLeave={isWeb && isDesktop ? () => setHovered(false) : undefined}
      className="p-1 w-1/3 sm:w-1/4 md:w-1/5 lg:w-[14.28%] xl:w-[12.5%]"
    >
      <View
        className="relative"
        style={
          isWeb && isDesktop
            ? {
                // @ts-ignore - web CSS
                transition: "transform 150ms ease",
                transform: hovered ? [{ scale: 1.05 }] : [{ scale: 1 }],
                zIndex: hovered ? 10 : 0,
              }
            : undefined
        }
      >
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
        {/* Color tag indicator - diagonal corner using border trick */}
        {card.colorTag && (
          <View
            className="absolute top-0 left-0"
            style={{
              width: 0,
              height: 0,
              borderTopWidth: 28,
              borderRightWidth: 28,
              borderTopColor: card.colorTag,
              borderRightColor: "transparent",
            }}
          />
        )}
        {/* Collection status icon */}
        {(card.isLinkedToCollection ||
          (card.inCollection && card.hasAvailableCollectionCard) ||
          (card.inCollectionDifferentPrint &&
            card.hasAvailableCollectionCard)) && (
          <View className="absolute bottom-1 left-1 bg-black/70 rounded-full p-1">
            {card.isLinkedToCollection ? (
              <Link size={16} color="#7C3AED" />
            ) : card.inCollection ? (
              <Library size={16} color="#94a3b8" />
            ) : (
              <AlertCircle size={16} color="#f59e0b" />
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}
