import { ScrollView, Text, View, ActivityIndicator } from "react-native";
import { useColorScheme } from "nativewind";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";
import { Check, RefreshCw } from "lucide-react-native";
import type { ExtendedGameCard, PlayerId } from "~/types/playtesting";
import { GameCard } from "./GameCard";

interface MulliganViewProps {
  playerHand: ExtendedGameCard[];
  opponentHand: ExtendedGameCard[];
  playerName: string;
  opponentName: string;
  thinkingPlayer: PlayerId | null;
  playerMulliganCount: number;
  opponentMulliganCount: number;
  playerDecision: "keep" | "mulligan" | null;
  opponentDecision: "keep" | "mulligan" | null;
  onCardLongPress?: (card: ExtendedGameCard) => void;
}

interface PlayerHandSectionProps {
  label: string;
  hand: ExtendedGameCard[];
  isThinking: boolean;
  mulliganCount: number;
  decision: "keep" | "mulligan" | null;
  onCardLongPress?: (card: ExtendedGameCard) => void;
  isDark: boolean;
}

function PlayerHandSection({
  label,
  hand,
  isThinking,
  mulliganCount,
  decision,
  onCardLongPress,
  isDark,
}: PlayerHandSectionProps) {
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (isThinking) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [isThinking, pulseOpacity]);

  const animatedBorderStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <View className="flex-1 flex items-center justify-center">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2">
        <View className="flex-row items-center">
          <Text
            className={`text-base font-bold ${
              isDark ? "text-white" : "text-slate-800"
            }`}
          >
            {label}
          </Text>
          {mulliganCount > 0 && (
            <View
              className={`ml-2 px-2 py-0.5 rounded ${
                isDark ? "bg-amber-500/20" : "bg-amber-100"
              }`}
            >
              <Text className="text-amber-500 text-xs font-medium">
                Mulligan to {8 - mulliganCount}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center">
          {decision && (
            <View
              className={`flex-row items-center px-3 py-1 rounded-full ${
                decision === "keep"
                  ? isDark
                    ? "bg-green-500/20"
                    : "bg-green-100"
                  : isDark
                    ? "bg-amber-500/20"
                    : "bg-amber-100"
              }`}
            >
              {decision === "keep" ? (
                <Check size={14} color="#22c55e" strokeWidth={3} />
              ) : (
                <RefreshCw size={14} color="#f59e0b" />
              )}
              <Text
                className={`text-sm font-semibold ml-1 ${
                  decision === "keep" ? "text-green-500" : "text-amber-500"
                }`}
              >
                {decision === "keep" ? "Kept" : "Mulligan"}
              </Text>
            </View>
          )}
        </View>
      </View>

      {isThinking && !decision && (
        <View className="flex-row items-center mr-2">
          <ActivityIndicator size="small" color="#a855f7" />
          <Text className="text-purple-400 text-xs ml-1">
            Evaluating hand...
          </Text>
        </View>
      )}

      {/* Hand display */}
      <Animated.View
        style={isThinking ? animatedBorderStyle : undefined}
        className={`mx-2 rounded-lg p-2 ${
          isThinking
            ? isDark
              ? "border-2 border-purple-500"
              : "border-2 border-purple-400"
            : isDark
              ? "border border-slate-700"
              : "border border-slate-200"
        } ${isDark ? "bg-slate-800/50" : "bg-slate-50"}`}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            gap: 8,
            alignItems: "center",
          }}
        >
          {hand.map((card) => (
            <GameCard
              key={card.instanceId}
              card={card}
              size="hand"
              onLongPress={() => onCardLongPress?.(card)}
            />
          ))}
          {hand.length === 0 && (
            <Text
              className={`text-sm italic py-8 ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Drawing cards...
            </Text>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

export function MulliganView({
  playerHand,
  opponentHand,
  playerName,
  opponentName,
  thinkingPlayer,
  playerMulliganCount,
  opponentMulliganCount,
  playerDecision,
  opponentDecision,
  onCardLongPress,
}: MulliganViewProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
      {/* Title */}
      <View className="items-center py-4">
        <Text
          className={`text-xl font-bold ${
            isDark ? "text-white" : "text-slate-800"
          }`}
        >
          Mulligan Phase
        </Text>
        <Text
          className={`text-sm mt-1 ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}
        >
          Both players are deciding whether to keep their hands
        </Text>
      </View>

      {/* Opponent's hand (top) */}
      <PlayerHandSection
        key={`opponent-${opponentMulliganCount}`}
        label={opponentName}
        hand={opponentHand}
        isThinking={thinkingPlayer === "opponent"}
        mulliganCount={opponentMulliganCount}
        decision={opponentDecision}
        onCardLongPress={onCardLongPress}
        isDark={isDark}
      />

      {/* Divider */}
      <View className="items-center py-4">
        <View
          className={`w-3/4 h-px ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
        />
        <Text
          className={`text-xs mt-2 ${
            isDark ? "text-slate-600" : "text-slate-400"
          }`}
        >
          vs
        </Text>
      </View>

      {/* Player's hand (bottom) */}
      <PlayerHandSection
        key={`player-${playerMulliganCount}`}
        label={playerName}
        hand={playerHand}
        isThinking={thinkingPlayer === "player"}
        mulliganCount={playerMulliganCount}
        decision={playerDecision}
        onCardLongPress={onCardLongPress}
        isDark={isDark}
      />
    </View>
  );
}
