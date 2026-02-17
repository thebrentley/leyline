import { Minus, Plus } from "lucide-react-native";
import * as React from "react";
import { Pressable, View, Text, useWindowDimensions } from "react-native";
import type { PlayerState } from "../../app/life-counter";
import { PLAYER_COLORS } from "./PlayerCounter";

interface CommanderDamageCounterProps {
  player: PlayerState;
  focusedPlayer: PlayerState;
  onUpdateFocusedPlayer: (updates: Partial<PlayerState>) => void;
  rotation: string;
}

export function CommanderDamageCounter({
  player,
  focusedPlayer,
  onUpdateFocusedPlayer,
  rotation,
}: CommanderDamageCounterProps) {
  const [cardSize, setCardSize] = React.useState({ width: 0, height: 0 });
  const dimensions = useWindowDimensions();

  const isTablet = Math.min(dimensions.width, dimensions.height) > 600;
  const damageFontSize = isTablet ? 140 : 90;

  const backgroundColor = PLAYER_COLORS[player.id % PLAYER_COLORS.length];

  const isRotated90 =
    rotation === "90deg" || rotation === "-90deg" ||
    rotation === "270deg" || rotation === "-270deg";

  const damage = focusedPlayer.commanderDamage[player.id] || 0;

  const longPressInterval = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressActive = React.useRef(false);
  const damageRef = React.useRef(damage);
  damageRef.current = damage;
  const focusedLifeRef = React.useRef(focusedPlayer.life);
  focusedLifeRef.current = focusedPlayer.life;

  const clearLongPress = () => {
    longPressActive.current = false;
    if (longPressInterval.current) {
      clearInterval(longPressInterval.current);
      longPressInterval.current = null;
    }
  };

  const applyDamage = (newValue: number, currentDamage: number, currentLife: number) => {
    const lifeDelta = currentDamage - newValue;
    onUpdateFocusedPlayer({
      life: Math.max(0, currentLife + lifeDelta),
      commanderDamage: {
        ...focusedPlayer.commanderDamage,
        [player.id]: newValue,
      },
    });
  };

  const changeDamage = (delta: number) => {
    const newValue = Math.max(0, damage + delta);
    if (newValue === damage) return;
    applyDamage(newValue, damage, focusedPlayer.life);
  };

  const startLongPress = (delta: number) => {
    longPressActive.current = true;
    changeDamage(delta);
    longPressInterval.current = setInterval(() => {
      const newValue = Math.max(0, damageRef.current + delta);
      if (newValue === damageRef.current) { clearLongPress(); return; }
      applyDamage(newValue, damageRef.current, focusedLifeRef.current);
    }, 1000);
  };

  return (
    <View
      className={`relative flex-1 ${backgroundColor}`}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setCardSize({ width, height });
      }}
    >
      {cardSize.width > 0 && (
        <View
          style={{
            position: "absolute",
            width: isRotated90 ? cardSize.height : cardSize.width,
            height: isRotated90 ? cardSize.width : cardSize.height,
            left: isRotated90 ? (cardSize.width - cardSize.height) / 2 : 0,
            top: isRotated90 ? (cardSize.height - cardSize.width) / 2 : 0,
            transform: [{ rotate: rotation }],
          }}
          className="items-center justify-center"
        >
          {/* Damage Total */}
          <View style={{ height: damageFontSize, justifyContent: "center" }}>
            <Text
              className="font-black text-black drop-shadow-lg text-center"
              style={{ fontSize: damageFontSize, lineHeight: damageFontSize }}
            >
              {damage}
            </Text>
          </View>

          {/* Label */}
          <Text className="text-sm font-semibold text-black/50 mt-1">
            CMD DMG
          </Text>

          {/* Minus Button (Left) */}
          <Pressable
            onPress={() => { if (!longPressActive.current) changeDamage(-1); }}
            onLongPress={() => startLongPress(-10)}
            onPressOut={clearLongPress}
            className="absolute left-0 top-0 bottom-0 w-1/2 items-center justify-center active:bg-black/10"
          >
            <Minus size={64} color="rgba(0,0,0,0.3)" strokeWidth={3} />
          </Pressable>

          {/* Plus Button (Right) */}
          <Pressable
            onPress={() => { if (!longPressActive.current) changeDamage(1); }}
            onLongPress={() => startLongPress(10)}
            onPressOut={clearLongPress}
            className="absolute right-0 top-0 bottom-0 w-1/2 items-center justify-center active:bg-black/10"
          >
            <Plus size={64} color="rgba(0,0,0,0.3)" strokeWidth={3} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
