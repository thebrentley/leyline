import { Modal, Pressable, View, Image, Text } from 'react-native';
import { useColorScheme } from 'nativewind';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';
import type { ExtendedGameCard } from '~/types/playtesting';
import { CARD_SIZES } from '~/types/playtest-ui';

interface CardPreviewModalProps {
  card: ExtendedGameCard | null;
  attachments?: ExtendedGameCard[];
  visible: boolean;
  onClose: () => void;
}

export function CardPreviewModal({ card, attachments = [], visible, onClose }: CardPreviewModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Track which card we're viewing (0 = host, 1+ = attachments)
  const [activeIndex, setActiveIndex] = useState(0);
  // Track whether we're showing the back face of a DFC
  const [showBackFace, setShowBackFace] = useState(false);

  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  // Combine host card + attachments for cycling
  const allCards = card ? [card, ...attachments] : [];
  const activeCard = allCards[activeIndex] || card;
  const hasMultipleCards = allCards.length > 1;

  // Check if active card is a DFC with multiple faces
  const isDFC = activeCard?.layout === 'modal_dfc' && activeCard?.cardFaces && activeCard.cardFaces.length > 1;

  // Get the display image and info based on flip state
  const displayFace = isDFC && showBackFace ? activeCard.cardFaces![1] : null;
  const displayImageUrl = displayFace?.imageUri || activeCard?.imageUrl;
  const displayName = displayFace?.name || activeCard?.name;
  const displayTypeLine = displayFace?.typeLine || activeCard?.typeLine;

  // Reset to host card and front face when the main card changes
  useEffect(() => {
    setActiveIndex(0);
    setShowBackFace(false);
  }, [card?.instanceId]);

  // Reset flip state when cycling between cards
  useEffect(() => {
    setShowBackFace(false);
  }, [activeIndex]);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 20, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 100 });
    } else {
      scale.value = withTiming(0.8, { duration: 80 });
      opacity.value = withTiming(0, { duration: 80 });
    }
  }, [visible, scale, opacity]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handlePrevious = () => setActiveIndex((i) => Math.max(0, i - 1));
  const handleNext = () => setActiveIndex((i) => Math.min(allCards.length - 1, i + 1));

  if (!card || !activeCard) return null;

  const cardWidth = CARD_SIZES.full.width * 2;
  const cardHeight = CARD_SIZES.full.height * 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center"
        onPress={onClose}
      >
        <Animated.View
          style={animatedOverlayStyle}
          className={`absolute inset-0 ${
            isDark ? 'bg-black/80' : 'bg-black/60'
          }`}
        />

        <Animated.View style={animatedCardStyle}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              className={`rounded-xl overflow-hidden ${
                isDark ? 'bg-slate-800' : 'bg-white'
              }`}
              style={{ width: cardWidth, height: cardHeight + 120 }}
            >
              {/* Navigation arrows (if multiple cards) */}
              {hasMultipleCards && (
                <View
                  className="absolute left-0 right-0 flex-row justify-between px-2 z-10"
                  style={{ top: cardHeight / 2 - 16 }}
                >
                  <Pressable
                    onPress={handlePrevious}
                    disabled={activeIndex === 0}
                    className={`p-2 rounded-full ${
                      activeIndex === 0
                        ? 'bg-black/20'
                        : 'bg-black/50 active:bg-black/70'
                    }`}
                  >
                    <ChevronLeft
                      size={24}
                      color={activeIndex === 0 ? '#666' : '#fff'}
                    />
                  </Pressable>
                  <Pressable
                    onPress={handleNext}
                    disabled={activeIndex === allCards.length - 1}
                    className={`p-2 rounded-full ${
                      activeIndex === allCards.length - 1
                        ? 'bg-black/20'
                        : 'bg-black/50 active:bg-black/70'
                    }`}
                  >
                    <ChevronRight
                      size={24}
                      color={activeIndex === allCards.length - 1 ? '#666' : '#fff'}
                    />
                  </Pressable>
                </View>
              )}

              {/* DFC flip button */}
              {isDFC && (
                <Pressable
                  onPress={() => setShowBackFace((prev) => !prev)}
                  className="absolute top-2 right-2 p-2 rounded-full bg-black/50 active:bg-black/70 z-20"
                >
                  <RefreshCw size={20} color="#fff" />
                </Pressable>
              )}

              {/* Card image */}
              {displayImageUrl ? (
                <Image
                  source={{ uri: displayImageUrl }}
                  style={{ width: cardWidth, height: cardHeight }}
                  resizeMode="contain"
                />
              ) : (
                <View
                  className={`items-center justify-center ${
                    isDark ? 'bg-slate-700' : 'bg-slate-200'
                  }`}
                  style={{ width: cardWidth, height: cardHeight }}
                >
                  <Text
                    className={`text-lg font-bold text-center px-4 ${
                      isDark ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    {displayName}
                  </Text>
                  <Text
                    className={`text-sm mt-2 text-center px-4 ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {displayTypeLine}
                  </Text>
                </View>
              )}

              {/* Copy overlay — shows the copy card's own art */}
              {activeCard.copyOf && activeCard.originalImageUrl && (
                <View
                  style={{
                    position: 'absolute',
                    top: 48,
                    left: 48,
                    width: cardWidth * 0.35,
                    height: cardHeight * 0.35,
                    borderRadius: 8,
                    overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                  }}
                >
                  <Image
                    source={{ uri: activeCard.originalImageUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="contain"
                  />
                </View>
              )}

              {/* Pagination dots (if multiple cards) */}
              {hasMultipleCards && (
                <View className="flex-row justify-center py-2 gap-1">
                  {allCards.map((c, i) => (
                    <Pressable key={c.instanceId} onPress={() => setActiveIndex(i)}>
                      <View
                        className={`w-2 h-2 rounded-full ${
                          i === activeIndex ? 'bg-purple-500' : 'bg-slate-500'
                        }`}
                      />
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Back face label (when viewing the back of a DFC) */}
              {isDFC && showBackFace && (
                <View className="bg-blue-500/80 mx-4 px-2 py-1 rounded">
                  <Text className="text-white text-xs text-center">
                    Back face — {activeCard.cardFaces![1].name}
                  </Text>
                </View>
              )}

              {/* Attachment label (when viewing an attachment) */}
              {activeIndex > 0 && (
                <View className="bg-purple-500/80 mx-4 px-2 py-1 rounded">
                  <Text className="text-white text-xs text-center">
                    Attached to: {card.name}
                  </Text>
                </View>
              )}

              {/* Card info footer */}
              <View className="px-4 py-2">
                {/* Stats row */}
                <View className="flex-row justify-between items-center">
                  {activeCard.power !== undefined && activeCard.toughness !== undefined && (
                    <Text
                      className={`text-base font-bold ${
                        isDark ? 'text-white' : 'text-slate-800'
                      }`}
                    >
                      {activeCard.power}/{activeCard.toughness}
                      {activeCard.damage > 0 && (
                        <Text className="text-red-500"> ({activeCard.damage} dmg)</Text>
                      )}
                    </Text>
                  )}

                  {activeCard.isTapped && (
                    <View className="px-2 py-1 rounded bg-amber-500/20">
                      <Text className="text-amber-500 text-xs font-medium">
                        Tapped
                      </Text>
                    </View>
                  )}

                  {Object.entries(activeCard.counters)
                    .filter(([, v]) => v > 0)
                    .map(([type, count]) => (
                    <View key={type} className="px-2 py-1 rounded bg-purple-500/20">
                      <Text className="text-purple-400 text-xs font-medium">
                        {count} {type}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Zone info */}
                <Text
                  className={`text-xs mt-1 ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Zone: {activeCard.zone} | Controller: {activeCard.controller}
                </Text>

                {/* Copy info */}
                {activeCard.copyOf && activeCard.originalName && (
                  <Text
                    className={`text-xs mt-1 ${
                      isDark ? 'text-blue-400' : 'text-blue-600'
                    }`}
                  >
                    {activeCard.originalName} (copying {activeCard.name})
                  </Text>
                )}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
