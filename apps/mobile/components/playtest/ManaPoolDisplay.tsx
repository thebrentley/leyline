import { Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { ManaPool } from '~/types/playtesting';
import { MANA_POOL_COLORS } from '~/components/deck/deck-detail-constants';

interface ManaPoolDisplayProps {
  manaPool: ManaPool;
}

const MANA_ORDER: (keyof ManaPool)[] = ['W', 'U', 'B', 'R', 'G', 'C'];

export function ManaPoolDisplay({ manaPool }: ManaPoolDisplayProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Calculate total mana
  const totalMana = MANA_ORDER.reduce((sum, color) => sum + (manaPool[color] || 0), 0);

  // If no mana, show empty state
  if (totalMana === 0) {
    return (
      <View className="items-center">
        <View className="flex-row items-center gap-0.5">
          <View
            className={`w-4 h-4 rounded-full items-center justify-center ${
              isDark ? 'bg-slate-800' : 'bg-slate-200'
            }`}
          >
            <Text
              className={`text-[8px] font-bold ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              0
            </Text>
          </View>
        </View>
        <Text
          className={`text-xs mt-0.5 ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          Mana
        </Text>
      </View>
    );
  }

  // Get mana colors that have value > 0
  const activeMana = MANA_ORDER.filter((color) => manaPool[color] > 0);

  return (
    <View className="items-center">
      <View className="flex-row flex-wrap items-center justify-center gap-0.5">
        {activeMana.map((color) => (
          <View
            key={color}
            className="w-4 h-4 rounded-full items-center justify-center"
            style={{
              backgroundColor: MANA_POOL_COLORS[color].bg,
              borderWidth: 1,
              borderColor: MANA_POOL_COLORS[color].border,
            }}
          >
            <Text
              className="text-[8px] font-bold"
              style={{ color: MANA_POOL_COLORS[color].text }}
            >
              {manaPool[color]}
            </Text>
          </View>
        ))}
      </View>
      <Text
        className={`text-xs mt-0.5 ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}
      >
        Mana
      </Text>
    </View>
  );
}
