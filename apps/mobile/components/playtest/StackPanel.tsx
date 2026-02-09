import { Pressable, ScrollView, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Sparkles, Zap } from 'lucide-react-native';
import type { StackItem } from '~/types/playtesting';

interface StackPanelProps {
  stack: StackItem[];
  playerName: string;
  opponentName: string;
  onItemPress?: (item: StackItem) => void;
}

export function StackPanel({
  stack,
  playerName,
  opponentName,
  onItemPress,
}: StackPanelProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const hasItems = stack.length > 0;

  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    contentOpacity.value = withSpring(hasItems ? 1 : 0, { damping: 20, stiffness: 300 });
  }, [hasItems, contentOpacity]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <View
      style={{ height: 44 }}
      className={`border-t border-b ${
        isDark ? 'border-slate-700' : 'border-slate-200'
      }`}
    >
      {hasItems ? (
        <Animated.View style={[{ flex: 1 }, contentStyle]} className={isDark ? 'bg-slate-900/90' : 'bg-slate-50/90'}>
          {/* Header + items in a single row for compact display */}
          <ScrollView
            horizontal
            className="flex-1 px-3"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center', gap: 8 }}
          >
            {/* Label */}
            <View className="flex-row items-center mr-1">
              <Text
                className={`text-xs font-bold ${
                  isDark ? 'text-white' : 'text-slate-800'
                }`}
              >
                Stack
              </Text>
              <View
                className={`ml-1.5 px-1.5 py-0.5 rounded-full ${
                  isDark ? 'bg-purple-900/50' : 'bg-purple-100'
                }`}
              >
                <Text className="text-purple-500 text-[10px] font-medium">
                  {stack.length}
                </Text>
              </View>
            </View>

            {/* Stack items as compact chips */}
            {stack.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => onItemPress?.(item)}
                className={`flex-row items-center px-2 py-1 rounded-md ${
                  index === 0
                    ? isDark
                      ? 'bg-purple-900/40 border border-purple-500/50'
                      : 'bg-purple-100 border border-purple-300'
                    : isDark
                    ? 'bg-slate-800/80'
                    : 'bg-slate-100'
                }`}
              >
                {item.type === 'spell' ? (
                  <Sparkles size={12} color={isDark ? '#60a5fa' : '#2563eb'} />
                ) : (
                  <Zap size={12} color={isDark ? '#fbbf24' : '#d97706'} />
                )}
                <Text
                  className={`text-xs font-semibold ml-1 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                  numberOfLines={1}
                >
                  {item.cardName || item.abilityText?.slice(0, 20) || 'Ability'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      ) : (
        <View className={`flex-1 items-center justify-center ${isDark ? 'bg-slate-900/40' : 'bg-slate-50/40'}`}>
          <Text className={`text-xs ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>
            Stack
          </Text>
        </View>
      )}
    </View>
  );
}
