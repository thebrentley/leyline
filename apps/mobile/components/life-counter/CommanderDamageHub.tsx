import { ArrowLeft } from "lucide-react-native";
import * as React from "react";
import { Pressable, View, Text } from "react-native";
import type { PlayerState } from "../../app/life-counter";
import { PLAYER_COLORS } from "./PlayerCounter";

interface CommanderDamageHubProps {
  player: PlayerState;
  rotation: string;
  onExit: () => void;
}

export function CommanderDamageHub({
  player,
  rotation,
  onExit,
}: CommanderDamageHubProps) {
  const [cardSize, setCardSize] = React.useState({ width: 0, height: 0 });

  const backgroundColor = PLAYER_COLORS[player.id % PLAYER_COLORS.length];

  const isRotated90 =
    rotation === "90deg" || rotation === "-90deg" ||
    rotation === "270deg" || rotation === "-270deg";

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
          className="items-center justify-center gap-4 px-6"
        >
          <Text className="text-center text-lg font-semibold text-black/70">
            Tap +/- on other players to adjust commander damage dealt to you
          </Text>

          <Pressable
            onPress={onExit}
            className="flex-row items-center gap-2 rounded-xl bg-black/20 px-6 py-3 active:bg-black/30"
          >
            <ArrowLeft size={20} color="rgba(0,0,0,0.7)" />
            <Text className="text-lg font-bold text-black/70">
              Return to Game
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
