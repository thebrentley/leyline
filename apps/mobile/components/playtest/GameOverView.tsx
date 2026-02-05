import { Text, View, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
  SlideInUp,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Trophy, Skull, Swords, RotateCcw } from 'lucide-react-native';
import type { PlayerId } from '~/types/playtesting';

interface GameOverViewProps {
  winner: PlayerId | null;
  playerName: string;
  opponentName: string;
  playerLife: number;
  opponentLife: number;
  turnNumber: number;
  reason?: string | null;
  onPlayAgain?: () => void;
  onEndGame?: () => void;
}

export function GameOverView({
  winner,
  playerName,
  opponentName,
  playerLife,
  opponentLife,
  turnNumber,
  reason,
  onPlayAgain,
  onEndGame,
}: GameOverViewProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const trophyScale = useSharedValue(0);
  const trophyRotation = useSharedValue(0);

  useEffect(() => {
    // Trophy entrance animation
    trophyScale.value = withDelay(
      300,
      withSpring(1, { damping: 8, stiffness: 100 })
    );
    trophyRotation.value = withDelay(
      300,
      withSequence(
        withTiming(-10, { duration: 100 }),
        withTiming(10, { duration: 200 }),
        withTiming(-5, { duration: 150 }),
        withTiming(5, { duration: 150 }),
        withTiming(0, { duration: 100 })
      )
    );
  }, [trophyScale, trophyRotation]);

  const animatedTrophyStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: trophyScale.value },
      { rotate: `${trophyRotation.value}deg` },
    ],
  }));

  const winnerName = winner === 'player' ? playerName : winner === 'opponent' ? opponentName : null;
  const isDraw = winner === null;

  return (
    <View
      className={`flex-1 items-center justify-center px-6 ${
        isDark ? 'bg-slate-950' : 'bg-white'
      }`}
    >
      {/* Overlay background */}
      <Animated.View
        entering={FadeIn.duration(500)}
        className="absolute inset-0"
        style={{
          backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
        }}
      />

      {/* Content */}
      <Animated.View
        entering={SlideInUp.delay(200).springify()}
        className={`items-center p-8 rounded-3xl ${
          isDark ? 'bg-slate-900' : 'bg-white'
        }`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 10,
        }}
      >
        {/* Trophy/Icon */}
        <Animated.View style={animatedTrophyStyle} className="mb-4">
          <View
            className={`w-24 h-24 rounded-full items-center justify-center ${
              isDraw
                ? isDark
                  ? 'bg-slate-700'
                  : 'bg-slate-200'
                : winner === 'player'
                ? 'bg-green-500/20'
                : 'bg-red-500/20'
            }`}
          >
            {isDraw ? (
              <Swords size={48} color={isDark ? '#94a3b8' : '#64748b'} />
            ) : winner === 'player' ? (
              <Trophy size={48} color="#22c55e" />
            ) : (
              <Skull size={48} color="#ef4444" />
            )}
          </View>
        </Animated.View>

        {/* Result text */}
        <Animated.Text
          entering={FadeIn.delay(400)}
          className={`text-3xl font-bold mb-2 ${
            isDraw
              ? isDark
                ? 'text-slate-400'
                : 'text-slate-600'
              : winner === 'player'
              ? 'text-green-500'
              : 'text-red-500'
          }`}
        >
          {isDraw ? 'Draw!' : winner === 'player' ? 'Victory!' : 'Defeat'}
        </Animated.Text>

        {/* Winner name */}
        {winnerName && (
          <Animated.Text
            entering={FadeIn.delay(500)}
            className={`text-lg mb-4 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {winnerName} wins!
          </Animated.Text>
        )}

        {/* Game stats */}
        <Animated.View
          entering={FadeIn.delay(600)}
          className={`w-full rounded-xl p-4 mb-6 ${
            isDark ? 'bg-slate-800' : 'bg-slate-100'
          }`}
        >
          <View className="flex-row justify-between mb-3">
            <View className="flex-1 items-center">
              <Text
                className={`text-sm ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {playerName}
              </Text>
              <Text
                className={`text-2xl font-bold ${
                  winner === 'player' ? 'text-green-500' : isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {playerLife}
              </Text>
              <Text
                className={`text-xs ${
                  isDark ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                life
              </Text>
            </View>

            <View className="items-center justify-center px-4">
              <Text
                className={`text-sm font-medium ${
                  isDark ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                vs
              </Text>
            </View>

            <View className="flex-1 items-center">
              <Text
                className={`text-sm ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {opponentName}
              </Text>
              <Text
                className={`text-2xl font-bold ${
                  winner === 'opponent' ? 'text-green-500' : isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {opponentLife}
              </Text>
              <Text
                className={`text-xs ${
                  isDark ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                life
              </Text>
            </View>
          </View>

          <View
            className={`border-t pt-3 ${
              isDark ? 'border-slate-700' : 'border-slate-200'
            }`}
          >
            <Text
              className={`text-center text-sm ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Game ended on turn {turnNumber}
            </Text>
            {reason && (
              <Text
                className={`text-center text-xs mt-1 italic ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {reason}
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Action buttons */}
        <Animated.View entering={FadeIn.delay(700)} className="w-full gap-3">
          {onPlayAgain && (
            <Pressable
              onPress={onPlayAgain}
              className={`flex-row items-center justify-center py-4 rounded-xl ${
                isDark
                  ? 'bg-green-600 active:bg-green-700'
                  : 'bg-green-500 active:bg-green-600'
              }`}
            >
              <RotateCcw size={20} color="white" />
              <Text className="text-white font-semibold text-lg ml-2">
                Play Again
              </Text>
            </Pressable>
          )}

          {onEndGame && (
            <Pressable
              onPress={onEndGame}
              className={`flex-row items-center justify-center py-4 rounded-xl ${
                isDark
                  ? 'bg-slate-700 active:bg-slate-600'
                  : 'bg-slate-200 active:bg-slate-300'
              }`}
            >
              <Text
                className={`font-semibold text-lg ${
                  isDark ? 'text-white' : 'text-slate-700'
                }`}
              >
                Back to Deck
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}
