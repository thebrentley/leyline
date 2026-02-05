import { ScrollView, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { GamePhase, GameStep, PlayerId } from '~/types/playtesting';
import { PhaseChip } from './PhaseChip';
import { PHASE_ORDER, STEPS_BY_PHASE } from '~/types/playtest-ui';

interface GameInfoBarProps {
  turnNumber: number;
  activePlayer: PlayerId;
  playerName: string;
  opponentName: string;
  phase: GamePhase;
  step: GameStep;
}

export function GameInfoBar({
  turnNumber,
  activePlayer,
  playerName,
  opponentName,
  phase,
  step,
}: GameInfoBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const activeName = activePlayer === 'player' ? playerName : opponentName;

  // Get all steps for current phase to display
  const currentPhaseSteps = STEPS_BY_PHASE[phase] || [];

  return (
    <View
      className={`border-b ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}
    >
      {/* Top row: Turn info and phases */}
      <View className="h-10 flex-row items-center px-3">
        {/* Turn number */}
        <View
          className={`px-2 py-1 rounded-md mr-2 ${
            isDark ? 'bg-amber-900/30' : 'bg-amber-100'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              isDark ? 'text-amber-400' : 'text-amber-700'
            }`}
          >
            T{turnNumber}
          </Text>
        </View>

        {/* Active player */}
        <Text
          className={`text-sm font-semibold mr-3 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}
          numberOfLines={1}
          style={{ maxWidth: 80 }}
        >
          {activeName}
        </Text>

        {/* Divider */}
        <View
          className={`w-px h-6 mr-3 ${
            isDark ? 'bg-slate-700' : 'bg-slate-300'
          }`}
        />

        {/* Phase chips - always show all phases */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          {phase === 'pregame' ? (
            <PhaseChip phase="pregame" isActive={true} />
          ) : (
            PHASE_ORDER.map((p) => (
              <PhaseChip key={p} phase={p} isActive={phase === p} />
            ))
          )}
        </ScrollView>
      </View>

      {/* Bottom row: Steps of current phase */}
      <View
        className={`h-8 flex-row items-center px-3 ${
          isDark ? 'bg-slate-950' : 'bg-slate-100'
        }`}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          {currentPhaseSteps.map((phaseStep) => (
            <PhaseChip
              key={phaseStep}
              phase={phase}
              step={phaseStep}
              isActive={step === phaseStep}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
