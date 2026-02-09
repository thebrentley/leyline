import React, { useCallback, useEffect, useRef } from 'react';
import { Image, View, Text, type LayoutChangeEvent } from 'react-native';
import { useColorScheme } from 'nativewind';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import type { ExtendedGameCard, ExtendedGameZone, PlayerId } from '~/types/playtesting';
import { CARD_SIZES } from '~/types/playtest-ui';

const CARD_ASPECT_RATIO = 63 / 88;

// Hand button approximate size (the starting point for the animation)
const HAND_BUTTON_SIZE = 48;

// Hand button positions relative to the overlay container
function getHandButtonPosition(controller: PlayerId, cw: number, ch: number) {
  const x = cw - 40;
  const y = controller === 'player' ? ch - 40 : 40;
  return { x, y };
}

// Approximate left offset where cards start in the battlefield area
// PlayerBoard: px-2 (8px) + left column (~80px for card piles) + CardRow paddingHorizontal (4px)
const CARD_AREA_LEFT = 92;

// Compute horizontal position for the Nth card in a row
function getCardXInRow(cardIndex: number) {
  const cardWidth = CARD_SIZES.battlefield.width; // 96
  const gap = 4; // marginRight between cards
  // Center of the card at this index
  return CARD_AREA_LEFT + cardIndex * (cardWidth + gap) + cardWidth / 2;
}

// Destination positions for exit animation, relative to the overlay container
// The container is the GameView: GameInfoBar (~30px) | Opponent board (flex-1) | StackPanel (44px) | Player board (flex-1)
function getDestinationPosition(
  controller: PlayerId,
  destination: ExtendedGameZone | null,
  typeLine: string | null | undefined,
  ch: number,
  rowCardCount?: number,
) {
  if (destination === 'graveyard') {
    const x = 40;
    const y = controller === 'player' ? ch - 40 : 40;
    return { x, y, size: CARD_SIZES.pile };
  }

  const tl = typeLine?.toLowerCase() ?? '';
  const isLand = tl.includes('land');
  const isCreature = tl.includes('creature');

  // X position: target the last card slot in the row (the new card)
  // rowCardCount includes the new card, so index = count - 1
  const cardIndex = rowCardCount != null && rowCardCount > 0 ? rowCardCount - 1 : 0;
  const x = getCardXInRow(cardIndex);

  if (destination === 'battlefield') {
    if (isLand) {
      const y = controller === 'player' ? ch * 0.9 : ch * 0.1;
      return { x, y, size: CARD_SIZES.battlefield };
    }
    if (isCreature) {
      const y = controller === 'player' ? ch * 0.6 : ch * 0.4;
      return { x, y, size: CARD_SIZES.battlefield };
    }
    const y = controller === 'player' ? ch * 0.75 : ch * 0.25;
    return { x, y, size: CARD_SIZES.battlefield };
  }

  // Fallback
  const y = controller === 'player' ? ch * 0.72 : ch * 0.28;
  return { x, y, size: CARD_SIZES.battlefield };
}

export type StackOverlayPhase = 'entering' | 'visible' | 'exiting';

interface StackCardOverlayProps {
  card: ExtendedGameCard | null;
  phase: StackOverlayPhase | null;
  controller: PlayerId | null;
  destination: ExtendedGameZone | null;
  typeLine?: string | null;
  autoExit?: boolean;
  rowCardCount?: number;
  onEntryComplete: () => void;
  onExitComplete: () => void;
}

export function StackCardOverlay({
  card,
  phase,
  controller,
  destination,
  typeLine,
  autoExit,
  rowCardCount,
  onEntryComplete,
  onExitComplete,
}: StackCardOverlayProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Measure the overlay container so all positions are relative to it, not the screen
  const layoutRef = useRef({ width: 0, height: 0 });
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    layoutRef.current = { width, height };
  }, []);

  // Animate position (relative to center of the container)
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // Animate scale (1 = full center-card size)
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (!controller) return;
    const { width: cw, height: ch } = layoutRef.current;
    if (cw === 0 || ch === 0) return;

    const centerX = cw / 2;
    const centerY = ch / 2;
    const cardHeight = ch * 0.7;

    if (phase === 'entering') {
      const handPos = getHandButtonPosition(controller, cw, ch);
      const startScale = HAND_BUTTON_SIZE / cardHeight;

      translateX.value = handPos.x - centerX;
      translateY.value = handPos.y - centerY;
      scale.value = startScale;
      opacity.value = 1;
      overlayOpacity.value = 0;

      if (autoExit) {
        // Fast fly-through for lands
        const dur = 250;
        const easing = Easing.out(Easing.ease);
        translateX.value = withTiming(0, { duration: dur, easing });
        translateY.value = withTiming(0, { duration: dur, easing });
        scale.value = withTiming(1, { duration: dur, easing }, (finished) => {
          if (finished) {
            runOnJS(onEntryComplete)();
          }
        });
        overlayOpacity.value = withTiming(0.3, { duration: dur });
      } else {
        // Normal spring animation for stack spells
        translateX.value = withSpring(0, { damping: 14, stiffness: 60 });
        translateY.value = withSpring(0, { damping: 14, stiffness: 60 });
        scale.value = withSpring(1, { damping: 12, stiffness: 50 }, (finished) => {
          if (finished) {
            runOnJS(onEntryComplete)();
          }
        });
        overlayOpacity.value = withTiming(0.4, { duration: 600 });
      }
    } else if (phase === 'exiting') {
      const dest = getDestinationPosition(controller, destination, typeLine, ch, rowCardCount);
      const cardHeight2 = ch * 0.7;
      const destScale = dest.size.height / cardHeight2;

      if (autoExit) {
        // Fast exit for lands — quick swoop to destination
        const duration = 300;
        const easing = Easing.inOut(Easing.ease);
        translateX.value = withTiming(dest.x - centerX, { duration, easing });
        translateY.value = withTiming(dest.y - centerY, { duration, easing });
        scale.value = withTiming(destScale, { duration, easing });
        opacity.value = withDelay(150, withTiming(0, { duration: 150 }));
        overlayOpacity.value = withTiming(0, { duration }, (finished) => {
          if (finished) {
            runOnJS(onExitComplete)();
          }
        });
      } else {
        const duration = 500;
        const fadeDelay = 300;
        const easing = Easing.inOut(Easing.ease);
        translateX.value = withTiming(dest.x - centerX, { duration, easing });
        translateY.value = withTiming(dest.y - centerY, { duration, easing });
        scale.value = withTiming(destScale, { duration, easing });
        opacity.value = withDelay(fadeDelay, withTiming(0, { duration: 200 }));
        overlayOpacity.value = withTiming(0, { duration }, (finished) => {
          if (finished) {
            runOnJS(onExitComplete)();
          }
        });
      }
    }
  }, [phase]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const isActive = !!card && !!phase;

  // Compute card display size from layout (fallback to reasonable defaults)
  const { height: ch } = layoutRef.current;
  const displayHeight = ch > 0 ? ch * 0.7 : 500;
  const displayWidth = displayHeight * CARD_ASPECT_RATIO;

  // Always render the container so onLayout fires and we have measurements ready
  return (
    <View
      onLayout={handleLayout}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: isActive ? 100 : -1,
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {isActive && (
        <>
          {/* Semi-transparent backdrop */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#000',
              },
              backdropStyle,
            ]}
          />

          {/* Card */}
          <Animated.View
            style={[
              {
                width: displayWidth,
                height: displayHeight,
                borderRadius: 12,
                overflow: 'hidden',
                shadowColor: '#7c3aed',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 20,
                elevation: 15,
              },
              cardStyle,
            ]}
          >
            {card.imageUrl ? (
              <Image
                source={{ uri: card.imageUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <View
                className={`flex-1 items-center justify-center ${
                  isDark ? 'bg-slate-800' : 'bg-slate-200'
                }`}
              >
                <Text
                  className={`text-center text-lg font-bold px-4 ${
                    isDark ? 'text-white' : 'text-slate-800'
                  }`}
                >
                  {card.name}
                </Text>
              </View>
            )}
          </Animated.View>
        </>
      )}
    </View>
  );
}
