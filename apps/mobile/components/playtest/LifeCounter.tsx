import { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Heart } from 'lucide-react-native';

interface LifeCounterProps {
  life: number;
  previousLife?: number;
}

export function LifeCounter({ life, previousLife }: LifeCounterProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [showChange, setShowChange] = useState(false);
  const [lifeChange, setLifeChange] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (previousLife !== undefined && previousLife !== life) {
      const change = life - previousLife;
      setLifeChange(change);
      setShowChange(true);

      // Animate the change indicator
      fadeAnim.setValue(1);
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowChange(false);
      });
    }
  }, [life, previousLife, fadeAnim]);

  const isLow = life <= 10;

  return (
    <View className="items-center">
      <View className="flex-row items-center gap-1">
        <Heart
          size={14}
          color={isLow ? '#ef4444' : isDark ? '#94a3b8' : '#64748b'}
          fill={isLow ? '#ef4444' : 'transparent'}
        />
        <Text
          className={`text-lg font-bold ${
            isLow
              ? 'text-red-500'
              : isDark
              ? 'text-white'
              : 'text-slate-900'
          }`}
        >
          {life}
        </Text>
      </View>

      {/* Life change indicator */}
      {showChange && (
        <Animated.View
          style={{ opacity: fadeAnim }}
          className="absolute -top-4"
        >
          <Text
            className={`text-sm font-bold ${
              lifeChange > 0 ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {lifeChange > 0 ? `+${lifeChange}` : lifeChange}
          </Text>
        </Animated.View>
      )}

      <Text
        className={`text-xs ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}
      >
        Life
      </Text>
    </View>
  );
}
