import { Image, Platform, Pressable, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { useCallback, useEffect } from "react";
import { Sword, Shield } from "lucide-react-native";
import type { ExtendedGameCard } from "~/types/playtesting";
import { CARD_SIZES, type CardSize } from "~/types/playtest-ui";
import {
  useCardDimensions,
  type CardDimensions,
} from "./CardDimensionsContext";

interface GameCardProps {
  card: ExtendedGameCard;
  attachments?: ExtendedGameCard[];
  size?: CardSize;
  dimensions?: CardDimensions;
  onPress?: () => void;
  onLongPress?: () => void;
  isAttacking?: boolean;
  isBlocking?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GameCard({
  card,
  attachments = [],
  size,
  dimensions: propDimensions,
  onPress,
  onLongPress,
  isAttacking,
  isBlocking,
}: GameCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Use provided dimensions, then context, then fall back to CARD_SIZES
  const contextDimensions = useCardDimensions();
  const dimensions =
    propDimensions ?? contextDimensions ?? (size ? CARD_SIZES[size] : CARD_SIZES.battlefield);
  const hasCounters = card.counters && Object.keys(card.counters).length > 0;
  const counterCount = hasCounters
    ? Object.values(card.counters as Record<string, number>).reduce(
        (a, b) => a + b,
        0,
      )
    : 0;
  const hasDamage = card.damage > 0;
  const isSaga = card.typeLine?.includes('Saga') ?? false;
  const loreCounters = card.counters?.['lore'] || 0;

  // Animated rotation for tap state
  const tapProgress = useSharedValue(card.isTapped ? 1 : 0);

  // Combat animation
  const combatPulse = useSharedValue(1);

  useEffect(() => {
    tapProgress.value = withSpring(card.isTapped ? 1 : 0, {
      damping: 20,
      stiffness: 300,
    });
  }, [card.isTapped, tapProgress]);

  useEffect(() => {
    if (isAttacking || isBlocking) {
      combatPulse.value = withRepeat(
        withSequence(
          withTiming(1.05, {
            duration: 200,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, { duration: 200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      combatPulse.value = withTiming(1, { duration: 100 });
    }
  }, [isAttacking, isBlocking, combatPulse]);

  const animatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(tapProgress.value, [0, 1], [0, 90]);
    return {
      transform: [{ rotate: `${rotation}deg` }, { scale: combatPulse.value }],
    };
  });

  const imageUrl = card.imageUrl;

  // Handle right-click on web to trigger the same action as long press
  const handleContextMenu = useCallback(
    (e: { preventDefault: () => void }) => {
      if (Platform.OS === "web" && onLongPress) {
        e.preventDefault();
        onLongPress();
      }
    },
    [onLongPress]
  );

  const hasAttachments = attachments.length > 0;

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      // @ts-expect-error - onContextMenu is valid on web but not typed in RN
      onContextMenu={handleContextMenu}
      style={[
        animatedStyle,
        {
          width: dimensions.width,
          height: dimensions.height,
          marginRight: card.isTapped ? 12 : 4,
          // Add top margin to make room for stacked attachments
          marginTop: hasAttachments ? attachments.length * 6 : 0,
        },
      ]}
    >
      {/* Render attachments stacked behind (lower z-index) */}
      {hasAttachments && (
        <View style={{ position: 'absolute', zIndex: -1, width: '100%' }}>
          {attachments.map((att, index) => (
            <View
              key={att.instanceId}
              style={{
                position: 'absolute',
                top: -(index + 1) * 6,
                left: (index + 1) * 2,
                width: dimensions.width - (index + 1) * 4,
                height: 14,
                overflow: 'hidden',
              }}
            >
              {att.imageUrl ? (
                <Image
                  source={{ uri: att.imageUrl }}
                  style={{ width: '100%', height: dimensions.height }}
                  resizeMode="cover"
                />
              ) : (
                <View className="bg-purple-600 rounded-t h-full justify-center">
                  <Text className="text-white text-[8px] px-1" numberOfLines={1}>
                    {att.name}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      <View
        className={`flex-1 rounded overflow-hidden ${
          isAttacking
            ? "border-2 border-red-500"
            : isBlocking
              ? "border-2 border-blue-500"
              : isDark
                ? "border border-slate-700"
                : "border border-slate-300"
        }`}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <View
            className={`flex-1 items-center justify-center ${
              isDark ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            <Text
              className={`text-center text-xs px-1 ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}
              numberOfLines={2}
            >
              {card.name}
            </Text>
          </View>
        )}

        {/* Attack indicator */}
        {isAttacking && (
          <View className="absolute top-0 left-0 right-0 bg-red-500/90 py-0.5 flex-row items-center justify-center">
            <Sword size={10} color="white" />
            <Text className="text-white text-xs font-bold ml-1">ATK</Text>
          </View>
        )}

        {/* Block indicator */}
        {isBlocking && (
          <View className="absolute top-0 left-0 right-0 bg-blue-500/90 py-0.5 flex-row items-center justify-center">
            <Shield size={10} color="white" />
            <Text className="text-white text-xs font-bold ml-1">BLK</Text>
          </View>
        )}

        {/* Lore counter badge for Sagas (amber) */}
        {isSaga && loreCounters > 0 && (
          <View className="absolute top-0 right-0 bg-amber-500 rounded-bl px-1">
            <Text className="text-white text-xs font-bold">{loreCounters}</Text>
          </View>
        )}

        {/* Generic counters badge for non-Sagas (green) */}
        {!isSaga && counterCount > 0 && (
          <View className="absolute top-0 right-0 bg-green-500 rounded-bl px-1">
            <Text className="text-white text-xs font-bold">{counterCount}</Text>
          </View>
        )}

        {/* Damage badge */}
        {hasDamage && (
          <View className="absolute bottom-0 right-0 bg-red-500 rounded-tl px-1">
            <Text className="text-white text-xs font-bold">{card.damage}</Text>
          </View>
        )}

        {/* Summoning sickness indicator */}
        {card.summoningSickness && !isAttacking && !isBlocking && (
          <View className="absolute inset-0 bg-black/20" />
        )}

        {/* Attachment count badge */}
        {hasAttachments && (
          <View className="absolute bottom-0 left-0 bg-purple-500 rounded-tr px-1">
            <Text className="text-white text-xs font-bold">{attachments.length}</Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}
