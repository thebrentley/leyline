import { Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { GamePhase, GameStep } from '~/types/playtesting';
import { PHASE_LABELS, STEP_LABELS } from '~/types/playtest-ui';

interface PhaseChipProps {
  phase: GamePhase;
  step?: GameStep;
  isActive: boolean;
}

export function PhaseChip({ phase, step, isActive }: PhaseChipProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const label = step ? STEP_LABELS[step] : PHASE_LABELS[phase];

  return (
    <View
      className={`px-2 py-1 rounded-full mr-1 ${
        isActive
          ? 'bg-purple-500'
          : isDark
          ? 'bg-slate-800'
          : 'bg-slate-200'
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          isActive
            ? 'text-white'
            : isDark
            ? 'text-slate-400'
            : 'text-slate-600'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
