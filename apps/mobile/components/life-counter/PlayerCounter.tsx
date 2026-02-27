import { ImageIcon, Minus, Plus } from "lucide-react-native";
import { PillCounter } from "./PillCounter";
import { ScrollView } from "react-native-gesture-handler";
import * as React from "react";
import { Image, Pressable, View, Text, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, Directions } from "react-native-gesture-handler";
import { ArtCropPickerDialog } from "../ArtCropPickerDialog";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  ZoomIn,
} from "react-native-reanimated";
import { useColorScheme } from "nativewind";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { PlayerState } from "../../app/life-counter";

interface PlayerCounterProps {
  player: PlayerState;
  onUpdate: (updates: Partial<PlayerState>) => void;
  rotation: string;
  playerCount: number;
  onSwipe?: () => void;
  menuOpen?: boolean;
  insets?: EdgeInsets;
  showCounters?: boolean;
  allPlayers?: PlayerState[];
}

export const PLAYER_COLORS = [
  "bg-[#1a0f0a]",
  "bg-[#0f0a1a]",
  "bg-[#0a1a1a]",
  "bg-[#1a1a0a]",
  "bg-[#1a0a1a]",
  "bg-[#0a1a0f]",
];

export const PLAYER_COLOR_HEX = [
  "#1a0f0a",
  "#0f0a1a",
  "#0a1a1a",
  "#1a1a0a",
  "#1a0a1a",
  "#0a1a0f",
];

export function PlayerCounter({
  player,
  onUpdate,
  rotation,
  playerCount,
  onSwipe,
  menuOpen,
  insets,
  showCounters = true,
  allPlayers = [],
}: PlayerCounterProps) {
  const { colorScheme } = useColorScheme();
  const [countersOpen, setCountersOpen] = React.useState(false);
  const [artPickerOpen, setArtPickerOpen] = React.useState(false);

  React.useEffect(() => {
    if (menuOpen) setCountersOpen(false);
  }, [menuOpen]);
  const [recentChange, setRecentChange] = React.useState<number | null>(null);
  const [cardSize, setCardSize] = React.useState({ width: 0, height: 0 });
  const dimensions = useWindowDimensions();

  // Adjust font size based on screen size
  const isTablet = Math.min(dimensions.width, dimensions.height) > 600;
  const lifeFontSize = isTablet ? 180 : playerCount >= 5 ? 70 : 120;
  const changeFontSize = isTablet ? 60 : playerCount >= 5 ? 24 : 40;

  const backgroundColor = PLAYER_COLORS[player.id % PLAYER_COLORS.length];

  // For 90° rotations, we need to swap width/height so the rotated view fills the parent
  const isRotated90 =
    rotation === "90deg" || rotation === "-90deg" ||
    rotation === "270deg" || rotation === "-270deg";

  // Map screen-space safe area insets to the rotated content view's coordinate system
  const rotatedInsets = React.useMemo(() => {
    const i = insets ?? { top: 0, bottom: 0, left: 0, right: 0 };
    switch (rotation) {
      case "180deg":
        return { top: i.bottom, bottom: i.top, left: i.right, right: i.left };
      case "90deg":
      case "-270deg":
        return { top: i.right, bottom: i.left, left: i.top, right: i.bottom };
      case "-90deg":
      case "270deg":
        return { top: i.left, bottom: i.right, left: i.bottom, right: i.top };
      default: // 0deg
        return { top: i.top, bottom: i.bottom, left: i.left, right: i.right };
    }
  }, [insets, rotation]);

  // Settings overlay slide animation
  const overlayOpen = useSharedValue(0);
  const rotatedHeight = useSharedValue(0);

  React.useEffect(() => {
    rotatedHeight.value = isRotated90 ? cardSize.width : cardSize.height;
  }, [cardSize, isRotated90]);

  React.useEffect(() => {
    overlayOpen.value = withTiming(countersOpen ? 1 : 0, { duration: 250 });
  }, [countersOpen]);

  const animatedOverlayStyle = useAnimatedStyle(() => {
    const slideDistance = rotatedHeight.value * 0.85;
    return {
      transform: [{ translateY: slideDistance * (1 - overlayOpen.value) }],
    };
  });

  // Swipe along the counter's orientation axis → commander damage
  const flingCmdA = Gesture.Fling()
    .direction(isRotated90 ? Directions.UP : Directions.LEFT)
    .onEnd(() => { if (onSwipe) onSwipe(); })
    .runOnJS(true);
  const flingCmdB = Gesture.Fling()
    .direction(isRotated90 ? Directions.DOWN : Directions.RIGHT)
    .onEnd(() => { if (onSwipe) onSwipe(); })
    .runOnJS(true);

  // Swipe along the perpendicular axis → player settings
  const flingSettingsA = Gesture.Fling()
    .direction(isRotated90 ? Directions.LEFT : Directions.UP)
    .onEnd(() => { setCountersOpen(true); })
    .runOnJS(true);
  const flingSettingsB = Gesture.Fling()
    .direction(isRotated90 ? Directions.RIGHT : Directions.DOWN)
    .onEnd(() => { setCountersOpen(true); })
    .runOnJS(true);

  const flingGesture = Gesture.Race(flingCmdA, flingCmdB, flingSettingsA, flingSettingsB);

  const longPressInterval = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressActive = React.useRef(false);
  const playerLifeRef = React.useRef(player.life);
  playerLifeRef.current = player.life;

  const clearLongPress = () => {
    longPressActive.current = false;
    if (longPressInterval.current) {
      clearInterval(longPressInterval.current);
      longPressInterval.current = null;
    }
  };

  const startLongPress = (delta: number) => {
    longPressActive.current = true;
    changeLife(delta);
    longPressInterval.current = setInterval(() => {
      const newLife = Math.max(0, playerLifeRef.current + delta);
      if (newLife === playerLifeRef.current) { clearLongPress(); return; }
      onUpdate({ life: newLife });
      setRecentChange(delta);
      setTimeout(() => setRecentChange(null), 1000);
    }, 1000);
  };

  const changeLife = (delta: number) => {
    const newLife = Math.max(0, player.life + delta);
    if (newLife === player.life) return;
    onUpdate({ life: newLife });
    setRecentChange(delta);
    setTimeout(() => setRecentChange(null), 1000);
  };

  const totalPoison = player.poison;
  const totalCommanderDamage = Object.values(player.commanderDamage).reduce((sum, dmg) => sum + dmg, 0);

  const [deadDismissed, setDeadDismissed] = React.useState(false);

  React.useEffect(() => {
    if (player.life > 0) setDeadDismissed(false);
    if (player.life <= 0) clearLongPress();
  }, [player.life]);

  const isDead = player.life <= 0 && !deadDismissed;

  const hasCounters = showCounters && (totalPoison > 0 || player.commanderTax > 0 || totalCommanderDamage > 0);

  const animatedLifeStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(recentChange !== null ? 1.1 : 1, {
            damping: 8,
            stiffness: 100,
          }),
        },
      ],
    };
  });

  return (
    <>
    <GestureDetector gesture={flingGesture}>
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
          overflow: "hidden",
        }}
        className="items-center justify-center"
      >
        {/* Background Image */}
        {player.backgroundImage && (
          <>
            <Image
              source={{ uri: player.backgroundImage }}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
              resizeMode="cover"
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.3)", "transparent"]}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 0 }}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: "50%" }}
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.3)", "transparent"]}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: "absolute", top: "50%", left: 0, right: 0, bottom: 0 }}
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.3)", "transparent"]}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0, y: 0.5 }}
              style={{ position: "absolute", top: 0, left: 0, right: "50%", bottom: 0 }}
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.3)", "transparent"]}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ position: "absolute", top: 0, left: "50%", right: 0, bottom: 0 }}
            />
          </>
        )}

        {/* Life Total */}
        {!isDead && (
          <Animated.View style={[animatedLifeStyle, { height: lifeFontSize, justifyContent: "center" }]}>
            <Text
              className="font-black drop-shadow-lg text-center text-white"
              style={{ fontSize: lifeFontSize, lineHeight: lifeFontSize }}
            >
              {player.life}
            </Text>
            {recentChange !== null && (
              <Text
                className={`absolute font-bold ${
                  recentChange > 0 ? "text-green-400" : "text-red-400"
                }`}
                style={{
                  fontSize: changeFontSize,
                  bottom: -changeFontSize * 0.8,
                }}
              >
                {recentChange > 0 ? "+" : ""}
                {recentChange}
              </Text>
            )}
          </Animated.View>
        )}

        {/* Minus Button (Left) */}
        {!isDead && (
          <Pressable
            unstable_pressDelay={150}
            onPress={() => { if (!longPressActive.current) changeLife(-1); }}
            onLongPress={() => startLongPress(-10)}
            onPressOut={clearLongPress}
            className="absolute left-0 top-0 bottom-0 w-1/2 items-center justify-center"
          >
            <View className="rounded-full bg-black/20 p-2">
              <Minus size={28} color="white" strokeWidth={3} />
            </View>
          </Pressable>
        )}

        {/* Plus Button (Right) */}
        {!isDead && (
          <Pressable
            unstable_pressDelay={150}
            onPress={() => { if (!longPressActive.current) changeLife(1); }}
            onLongPress={() => startLongPress(10)}
            onPressOut={clearLongPress}
            className="absolute right-0 top-0 bottom-0 w-1/2 items-center justify-center"
          >
            <View className="rounded-full bg-black/20 p-2">
              <Plus size={28} color="white" strokeWidth={3} />
            </View>
          </Pressable>
        )}

        {/* Player Name */}
        {player.playerName && !isDead && (
          <View className="absolute top-8 items-center" style={{ paddingTop: rotatedInsets.top }}>
            <View className="rounded-full bg-black/40 px-3 py-1">
              <Text className="text-xs font-semibold text-white" numberOfLines={1}>
                {player.playerName}
              </Text>
            </View>
          </View>
        )}

        {/* Counter Indicators */}
        {hasCounters && (
          <View className="absolute bottom-2 flex-row flex-wrap gap-1">
            {totalPoison > 0 && (
              <View className="rounded-full bg-black/50 px-2 py-0.5">
                <Text className="font-bold text-white" style={{ fontSize: isTablet ? 14 : 11 }}>
                  ☠ {totalPoison}
                </Text>
              </View>
            )}
            {Object.entries(player.commanderDamage)
              .filter(([_, dmg]) => dmg > 0)
              .map(([playerId, dmg]) => {
                const opponentId = Number.parseInt(playerId);
                const opponent = allPlayers.find(p => p.id === opponentId);
                const opponentColor = PLAYER_COLOR_HEX[opponentId % PLAYER_COLOR_HEX.length];
                const hasBackground = opponent?.backgroundImage;

                return (
                  <View
                    key={playerId}
                    className="flex-row items-center gap-1 rounded-full overflow-hidden"
                    style={{ backgroundColor: hasBackground ? 'transparent' : opponentColor }}
                  >
                    {hasBackground ? (
                      <Image
                        source={{ uri: opponent.backgroundImage }}
                        className="absolute inset-0"
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : null}
                    <View className="flex-row items-center gap-1 px-2 py-0.5" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                      <View className="h-3 w-3 rounded-full bg-white/30" />
                      <Text className="font-bold text-white" style={{ fontSize: isTablet ? 14 : 11 }}>
                        {dmg}
                      </Text>
                    </View>
                  </View>
                );
              })}
            {player.commanderTax > 0 && (
              <View className="rounded-full bg-black/50 px-2 py-0.5">
                <Text className="font-bold text-white" style={{ fontSize: isTablet ? 14 : 11 }}>
                  T {player.commanderTax}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Inline Settings Overlay */}
        <View
          className="absolute inset-0"
          style={{ justifyContent: "flex-end" }}
          pointerEvents={countersOpen ? "auto" : "none"}
        >
          {/* Tap-to-dismiss area */}
          <Pressable
            onPress={() => setCountersOpen(false)}
            style={{ height: "15%" }}
          />

          <Animated.View style={[{ height: "85%" }, animatedOverlayStyle]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ alignItems: "stretch", paddingTop: rotatedInsets.top + 16, paddingBottom: rotatedInsets.bottom + 16, paddingLeft: rotatedInsets.left + 16, paddingRight: rotatedInsets.right + 16, gap: 12 }}
              style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#0f172a" : "#ffffff" }}
            >
              {/* Background */}
              <View style={{ height: "80%", alignSelf: "center", alignItems: "center" }}>
              <Pressable
                onPress={() => setArtPickerOpen(true)}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  borderRadius: 6,
                  overflow: "hidden",
                  backgroundColor: PLAYER_COLOR_HEX[player.id % PLAYER_COLOR_HEX.length],
                }}
                className="items-center justify-center active:opacity-80"
              >
                {player.backgroundImage ? (
                  <Image
                    source={{ uri: player.backgroundImage }}
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 6 }}
                    resizeMode="cover"
                  />
                ) : (
                  <ImageIcon size={28} color="rgba(0,0,0,0.3)" />
                )}
              </Pressable>
              <Text className="text-[9px] font-semibold text-white/40 mt-2">BACKGROUND</Text>
              </View>

              <PillCounter
                value={player.poison}
                label="POISON"
                onIncrement={() => onUpdate({ poison: player.poison + 1 })}
                onDecrement={() => onUpdate({ poison: Math.max(0, player.poison - 1) })}
                onLongIncrement={() => onUpdate({ poison: player.poison + 10 })}
                onLongDecrement={() => onUpdate({ poison: Math.max(0, player.poison - 10) })}
              />

              <PillCounter
                value={player.commanderTax}
                label="CMD TAX"
                onIncrement={() => onUpdate({ commanderTax: player.commanderTax + 1 })}
                onDecrement={() => onUpdate({ commanderTax: Math.max(0, player.commanderTax - 1) })}
                onLongIncrement={() => onUpdate({ commanderTax: player.commanderTax + 10 })}
                onLongDecrement={() => onUpdate({ commanderTax: Math.max(0, player.commanderTax - 10) })}
              />

            </ScrollView>
          </Animated.View>
        </View>

        {/* Dead Overlay */}
        {isDead && (
          <Animated.View
            entering={FadeIn.duration(600)}
            exiting={FadeOut.duration(200)}
            className="absolute inset-0"
          >
            <LinearGradient
              colors={["rgba(120,0,0,0.7)", "rgba(0,0,0,0.9)", "rgba(120,0,0,0.7)"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <Pressable
              onPress={() => setDeadDismissed(true)}
              className="absolute inset-0 items-center justify-center"
            >
              <Animated.View entering={ZoomIn.delay(200).springify().damping(8)}>
                <Text className="text-3xl font-black tracking-widest text-red-400/80">
                  DEFEATED
                </Text>
              </Animated.View>
              <Animated.View entering={FadeIn.delay(800).duration(300)}>
                <Text className="mt-3 text-sm font-medium text-white/40">
                  Tap to revive
                </Text>
              </Animated.View>
            </Pressable>
          </Animated.View>
        )}
      </View>
      )}
    </View>
    </GestureDetector>
    <ArtCropPickerDialog
      visible={artPickerOpen}
      onClose={() => setArtPickerOpen(false)}
      onSelect={(url) => onUpdate({ backgroundImage: url })}
    />
    </>
  );
}
