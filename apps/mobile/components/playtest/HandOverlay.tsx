import { ScrollView, Text, View, Pressable, useWindowDimensions } from 'react-native';
import { useColorScheme } from 'nativewind';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { X } from 'lucide-react-native';
import type { ExtendedGameCard, PlayerId } from '~/types/playtesting';
import { GameCard } from './GameCard';
import { CARD_SIZES } from '~/types/playtest-ui';

interface HandOverlayProps {
  playerId: PlayerId;
  cards: ExtendedGameCard[];
  isOpen: boolean;
  onClose: () => void;
  onCardPress?: (card: ExtendedGameCard) => void;
  onCardLongPress?: (card: ExtendedGameCard) => void;
  position: 'top' | 'bottom';
}

const CARD_GAP = 8;
const PADDING_HORIZONTAL = 24;
const CLOSE_BUTTON_WIDTH = 48;

export function HandOverlay({
  playerId,
  cards,
  isOpen,
  onClose,
  onCardPress,
  onCardLongPress,
  position,
}: HandOverlayProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width: screenWidth } = useWindowDimensions();

  // Calculate the content width based on number of cards
  const cardWidth = CARD_SIZES.hand.width;
  const cardHeight = CARD_SIZES.hand.height;
  const contentWidth = cards.length > 0
    ? cards.length * cardWidth + (cards.length - 1) * CARD_GAP + PADDING_HORIZONTAL * 2 + CLOSE_BUTTON_WIDTH
    : 120 + CLOSE_BUTTON_WIDTH; // Min width for empty state

  // Cap at screen width
  const overlayWidth = Math.min(contentWidth, screenWidth);
  const needsScroll = contentWidth > screenWidth;

  const translateX = useSharedValue(overlayWidth);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      translateX.value = withTiming(0, { duration: 100 });
      opacity.value = withTiming(1, { duration: 100 });
    } else {
      translateX.value = withTiming(overlayWidth, { duration: 100 });
      opacity.value = withTiming(0, { duration: 80 });
    }
  }, [isOpen, overlayWidth, translateX, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  // GameInfoBar is 48px (h-12), so offset top position to avoid overlap
  const topOffset = position === 'top' ? 48 : 0;

  // Total height: card height + vertical padding
  const overlayHeight = cardHeight + 16;

  if (!isOpen && opacity.value === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: 'absolute',
          right: 0,
          width: overlayWidth,
          height: overlayHeight,
          [position]: topOffset,
          zIndex: 20,
        },
      ]}
      className={`${
        isDark
          ? 'bg-slate-900/95 border-slate-700'
          : 'bg-white/95 border-slate-200'
      } ${position === 'top' ? 'border-b border-l rounded-bl-lg' : 'border-t border-l rounded-tl-lg'}`}
    >
      <View className="flex-1 flex-row items-center">
        {/* Close button on the left */}
        <Pressable
          onPress={onClose}
          className={`ml-2 p-1.5 rounded-full ${
            isDark ? 'bg-slate-800 active:bg-slate-700' : 'bg-slate-100 active:bg-slate-200'
          }`}
        >
          <X size={18} color={isDark ? '#94a3b8' : '#64748b'} />
        </Pressable>

        {/* Cards area */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={needsScroll}
          scrollEnabled={needsScroll}
          contentContainerStyle={{
            paddingHorizontal: PADDING_HORIZONTAL,
            alignItems: 'center',
            gap: CARD_GAP,
          }}
          style={{ flex: 1 }}
        >
          {cards.map((card) => (
            <GameCard
              key={card.instanceId}
              card={card}
              size="hand"
              onPress={() => onCardPress?.(card)}
              onLongPress={() => onCardLongPress?.(card)}
            />
          ))}
          {cards.length === 0 && (
            <Text
              className={`text-sm italic ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              No cards in hand
            </Text>
          )}
        </ScrollView>
      </View>
    </Animated.View>
  );
}
