import { Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { CircleDot } from 'lucide-react-native';

interface PriorityIndicatorProps {
  hasPriority: boolean;
  playerName: string;
  isThinking?: boolean;
}

export function PriorityIndicator({
  hasPriority,
  playerName,
  isThinking,
}: PriorityIndicatorProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const glowOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (hasPriority) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      glowOpacity.value = withTiming(0, { duration: 300 });
      pulseScale.value = withTiming(1, { duration: 300 });
    }
  }, [hasPriority, glowOpacity, pulseScale]);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  if (!hasPriority) {
    return null;
  }

  return (
    <View className="flex-row items-center">
      {/* Glow effect behind the badge */}
      <Animated.View
        style={[
          animatedGlowStyle,
          {
            position: 'absolute',
            left: -4,
            right: -4,
            top: -4,
            bottom: -4,
            borderRadius: 16,
            backgroundColor: '#a855f7',
            opacity: 0.3,
          },
        ]}
      />

      <View
        className={`flex-row items-center px-3 py-1.5 rounded-full ${
          isDark ? 'bg-purple-900/60' : 'bg-purple-100'
        }`}
      >
        <Animated.View style={animatedIconStyle}>
          <CircleDot size={14} color="#a855f7" />
        </Animated.View>
        <Text className="text-purple-500 text-xs font-semibold ml-1.5">
          Priority
        </Text>
      </View>

      {isThinking && (
        <View
          className={`ml-2 px-2 py-1 rounded-full ${
            isDark ? 'bg-slate-800' : 'bg-slate-200'
          }`}
        >
          <Text
            className={`text-xs ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Thinking...
          </Text>
        </View>
      )}
    </View>
  );
}
