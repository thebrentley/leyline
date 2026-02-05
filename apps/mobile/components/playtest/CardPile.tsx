import type { ReactNode } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import type { ExtendedGameCard } from "~/types/playtesting";
import { CARD_SIZES } from "~/types/playtest-ui";
import {
  useCardDimensions,
  type CardDimensions,
} from "./CardDimensionsContext";

interface CardPileProps {
  cards: ExtendedGameCard[];
  count?: number;
  isLibrary?: boolean;
  icon: ReactNode;
  dimensions?: CardDimensions;
  onPress?: () => void;
}

export function CardPile({
  cards,
  count,
  isLibrary = false,
  icon,
  dimensions: propDimensions,
  onPress,
}: CardPileProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Use provided dimensions, then context, then fall back to CARD_SIZES.pile
  const contextDimensions = useCardDimensions();
  const dimensions = propDimensions ?? contextDimensions ?? CARD_SIZES.pile;
  const displayCount = count ?? cards.length;
  const topCard = cards[0];

  return (
    <Pressable onPress={onPress} className="items-center">
      <View
        style={{
          width: dimensions.width,
          height: dimensions.height,
        }}
        className={`rounded overflow-hidden ${
          isDark ? "border border-slate-700" : "border border-slate-300"
        }`}
      >
        {isLibrary ? (
          // Show card back for library
          <View
            className={`flex-1 items-center justify-center p-1 ${
              isDark ? "bg-slate-800" : "bg-slate-300"
            }`}
          >
            <View
              className={`w-full h-full rounded ${
                isDark ? "bg-purple-900" : "bg-purple-200"
              }`}
            />
          </View>
        ) : topCard?.imageUrl ? (
          <Image
            source={{ uri: topCard.imageUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <View
            className={`flex-1 items-center justify-center ${
              isDark ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            {displayCount > 0 && (
              <Text
                className={`text-xs ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                {displayCount}
              </Text>
            )}
          </View>
        )}

        {/* Icon badge with count */}
        <View
          className={`absolute flex-row items-center rounded-full px-1 ${
            isDark ? "bg-slate-700/90" : "bg-slate-600/90"
          }`}
          style={{ minHeight: 16, top: 4, right: 4 }}
        >
          {icon}
          {displayCount > 0 && (
            <Text className="text-white text-xs font-bold ml-0.5">
              {displayCount}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
