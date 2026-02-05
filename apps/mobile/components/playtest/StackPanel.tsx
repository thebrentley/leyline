import { Pressable, ScrollView, Text, View, Image } from 'react-native';
import { useColorScheme } from 'nativewind';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { ArrowDown, Sparkles, Zap } from 'lucide-react-native';
import type { StackItem, PlayerId } from '~/types/playtesting';

interface StackPanelProps {
  stack: StackItem[];
  playerName: string;
  opponentName: string;
  onItemPress?: (item: StackItem) => void;
}

interface StackItemCardProps {
  item: StackItem;
  index: number;
  isTop: boolean;
  playerName: string;
  opponentName: string;
  onPress?: () => void;
}

function StackItemCard({
  item,
  index,
  isTop,
  playerName,
  opponentName,
  onPress,
}: StackItemCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (isTop) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 100 });
    }
  }, [isTop, pulseScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const controllerName = item.controller === 'player' ? playerName : opponentName;
  const isSpell = item.type === 'spell';

  return (
    <Animated.View style={isTop ? animatedStyle : undefined}>
      <Pressable
        onPress={onPress}
        className={`flex-row items-center p-3 rounded-lg mb-2 ${
          isTop
            ? isDark
              ? 'bg-purple-900/40 border border-purple-500/50'
              : 'bg-purple-100 border border-purple-300'
            : isDark
            ? 'bg-slate-800/80'
            : 'bg-slate-100'
        }`}
      >
        {/* Type icon */}
        <View
          className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
            isSpell
              ? isDark
                ? 'bg-blue-900/50'
                : 'bg-blue-100'
              : isDark
              ? 'bg-amber-900/50'
              : 'bg-amber-100'
          }`}
        >
          {isSpell ? (
            <Sparkles size={16} color={isDark ? '#60a5fa' : '#2563eb'} />
          ) : (
            <Zap size={16} color={isDark ? '#fbbf24' : '#d97706'} />
          )}
        </View>

        {/* Item info */}
        <View className="flex-1">
          <Text
            className={`font-semibold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
            numberOfLines={1}
          >
            {item.cardName || item.abilityText?.slice(0, 30) || 'Ability'}
          </Text>
          <Text
            className={`text-xs mt-0.5 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {isSpell ? 'Spell' : `${item.abilityType || 'Activated'} Ability`} • {controllerName}
          </Text>
          {item.targets && item.targets.length > 0 && (
            <Text
              className={`text-xs mt-1 italic ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {item.targets.length} target{item.targets.length > 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* Stack position indicator */}
        <View
          className={`w-6 h-6 rounded-full items-center justify-center ${
            isTop
              ? 'bg-purple-500'
              : isDark
              ? 'bg-slate-700'
              : 'bg-slate-300'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              isTop ? 'text-white' : isDark ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            {index + 1}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function StackPanel({
  stack,
  playerName,
  opponentName,
  onItemPress,
}: StackPanelProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withSpring(stack.length > 0 ? 1 : 0, { damping: 20, stiffness: 300 });
  }, [stack.length, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (stack.length === 0) {
    return null;
  }

  return (
    <Animated.View
      style={animatedStyle}
      className={`flex-1 border-t border-b ${
        isDark ? 'bg-slate-900/90 border-slate-700' : 'bg-slate-50/90 border-slate-200'
      }`}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2">
        <View className="flex-row items-center">
          <Text
            className={`text-sm font-bold ${
              isDark ? 'text-white' : 'text-slate-800'
            }`}
          >
            The Stack
          </Text>
          <View
            className={`ml-2 px-2 py-0.5 rounded-full ${
              isDark ? 'bg-purple-900/50' : 'bg-purple-100'
            }`}
          >
            <Text className="text-purple-500 text-xs font-medium">
              {stack.length} item{stack.length > 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center">
          <ArrowDown size={14} color={isDark ? '#64748b' : '#94a3b8'} />
          <Text
            className={`text-xs ml-1 ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            resolves first
          </Text>
        </View>
      </View>

      {/* Stack items */}
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        {stack.map((item, index) => (
          <StackItemCard
            key={item.id}
            item={item}
            index={index}
            isTop={index === 0}
            playerName={playerName}
            opponentName={opponentName}
            onPress={() => onItemPress?.(item)}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}
