import { Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { ManaPool } from '~/types/playtesting';

interface ManaPoolDisplayProps {
  manaPool: ManaPool;
}

// Mana colors matching the standard MTG colors
const MANA_COLORS: Record<keyof ManaPool, { bg: string; text: string; border: string }> = {
  W: { bg: '#F9FAF4', text: '#1a1a1a', border: '#e2e8f0' },
  U: { bg: '#0E68AB', text: '#ffffff', border: '#0E68AB' },
  B: { bg: '#150B00', text: '#ffffff', border: '#4a4a4a' },
  R: { bg: '#D3202A', text: '#ffffff', border: '#D3202A' },
  G: { bg: '#00733E', text: '#ffffff', border: '#00733E' },
  C: { bg: '#9ca3af', text: '#1a1a1a', border: '#6b7280' },
};

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
              backgroundColor: MANA_COLORS[color].bg,
              borderWidth: 1,
              borderColor: MANA_COLORS[color].border,
            }}
          >
            <Text
              className="text-[8px] font-bold"
              style={{ color: MANA_COLORS[color].text }}
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
