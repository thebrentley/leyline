import { ScrollView, Text, View, Pressable, useWindowDimensions } from 'react-native';
import { useColorScheme } from 'nativewind';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { X } from 'lucide-react-native';
import type { ExtendedGameCard } from '~/types/playtesting';
import { GameCard } from './GameCard';
import { CARD_SIZES } from '~/types/playtest-ui';

interface GraveyardOverlayProps {
  cards: ExtendedGameCard[];
  isOpen: boolean;
  onClose: () => void;
  onCardPress?: (card: ExtendedGameCard) => void;
  position: 'top' | 'bottom';
}

const CARD_GAP = 8;
const PADDING_HORIZONTAL = 24;
const CLOSE_BUTTON_WIDTH = 48;

export function GraveyardOverlay({
  cards,
  isOpen,
  onClose,
  onCardPress,
  position,
}: GraveyardOverlayProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width: screenWidth } = useWindowDimensions();

  const cardWidth = CARD_SIZES.hand.width;
  const cardHeight = CARD_SIZES.hand.height;
  const contentWidth = cards.length > 0
    ? cards.length * cardWidth + (cards.length - 1) * CARD_GAP + PADDING_HORIZONTAL * 2 + CLOSE_BUTTON_WIDTH
    : 120 + CLOSE_BUTTON_WIDTH;

  const overlayWidth = Math.min(contentWidth, screenWidth);
  const needsScroll = contentWidth > screenWidth;

  const overlayHeight = cardHeight + 16;

  const translateY = useSharedValue(overlayHeight);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      translateY.value = withTiming(0, { duration: 100 });
      opacity.value = withTiming(1, { duration: 100 });
    } else {
      translateY.value = withTiming(overlayHeight, { duration: 100 });
      opacity.value = withTiming(0, { duration: 80 });
    }
  }, [isOpen, overlayHeight, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: position === 'top' ? -translateY.value : translateY.value }],
    opacity: opacity.value,
  }));

  // GameInfoBar is 48px (h-12), so offset top position to avoid overlap
  const topOffset = position === 'top' ? 48 : 0;

  if (!isOpen && opacity.value === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: 'absolute',
          left: 0,
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
      } ${position === 'top' ? 'border-b border-r rounded-br-lg' : 'border-t border-r rounded-tr-lg'}`}
    >
      <View className="flex-1 flex-row items-center">
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
            />
          ))}
          {cards.length === 0 && (
            <Text
              className={`text-sm italic ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              No cards in graveyard
            </Text>
          )}
        </ScrollView>

        {/* Close button on the right */}
        <Pressable
          onPress={onClose}
          className={`mr-2 p-1.5 rounded-full ${
            isDark ? 'bg-slate-800 active:bg-slate-700' : 'bg-slate-100 active:bg-slate-200'
          }`}
        >
          <X size={18} color={isDark ? '#94a3b8' : '#64748b'} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
