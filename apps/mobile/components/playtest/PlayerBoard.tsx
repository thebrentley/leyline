import { useState } from "react";
import { View, Pressable, Text, type LayoutChangeEvent } from "react-native";
import { useColorScheme } from "nativewind";
import { Hand, BookOpen, Skull, Ban } from "lucide-react-native";
import type {
  ExtendedGameCard,
  CombatState,
  PlayerId,
  ManaPool,
} from "~/types/playtesting";
import { Battlefield } from "./Battlefield";
import { CardPile } from "./CardPile";
import { LifeCounter } from "./LifeCounter";
import { ManaPoolDisplay } from "./ManaPoolDisplay";
import { GameCard } from "./GameCard";
import {
  CardDimensionsProvider,
  calculateCardDimensions,
  type CardDimensions,
} from "./CardDimensionsContext";

interface PlayerBoardProps {
  playerId: PlayerId;
  isOpponent: boolean;
  creatures: ExtendedGameCard[];
  artifactsEnchantments: ExtendedGameCard[];
  lands: ExtendedGameCard[];
  allCards?: Record<string, ExtendedGameCard>;
  commander: ExtendedGameCard | null;
  libraryCount: number;
  graveyard: ExtendedGameCard[];
  exile: ExtendedGameCard[];
  life: number;
  previousLife?: number;
  manaPool: ManaPool;
  combat?: CombatState;
  hasPriority: boolean;
  handCount: number;
  onCardPress?: (card: ExtendedGameCard) => void;
  onCardLongPress?: (card: ExtendedGameCard) => void;
  onShowHand?: () => void;
}

export function PlayerBoard({
  playerId,
  isOpponent,
  creatures,
  artifactsEnchantments,
  lands,
  allCards,
  commander,
  libraryCount,
  graveyard,
  exile,
  life,
  previousLife,
  manaPool,
  combat,
  hasPriority,
  handCount,
  onCardPress,
  onCardLongPress,
  onShowHand,
}: PlayerBoardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Track board height and calculate card dimensions
  const [cardDimensions, setCardDimensions] = useState<CardDimensions | null>(
    null
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      const dimensions = calculateCardDimensions(height);
      setCardDimensions(dimensions);
    }
  };

  // Left column order (command zone toward middle of screen)
  // Opponent: graveyard, library, command (top to bottom)
  // Player: command, library, graveyard (top to bottom)
  const leftColumn = isOpponent
    ? (["graveyard", "library", "command"] as const)
    : (["command", "library", "graveyard"] as const);

  // Right column order (life toward middle)
  // Opponent: hand, exile, life (top to bottom)
  // Player: life, exile, hand (top to bottom)
  const rightColumn = isOpponent
    ? (["hand", "exile", "life"] as const)
    : (["life", "exile", "hand"] as const);

  const renderLeftItem = (item: "graveyard" | "library" | "command") => {
    switch (item) {
      case "command":
        return commander ? (
          <GameCard
            card={commander}
            size="pile"
            onPress={() => onCardPress?.(commander)}
            onLongPress={() => onCardLongPress?.(commander)}
          />
        ) : (
          <View
            className={`items-center justify-center rounded ${
              isDark
                ? "border border-dashed border-slate-700"
                : "border border-dashed border-slate-300"
            }`}
            style={{ width: 40, height: 56 }}
          />
        );
      case "library":
        return (
          <CardPile
            cards={[]}
            count={libraryCount}
            isLibrary
            icon={<BookOpen size={10} color="#fff" />}
          />
        );
      case "graveyard":
        return (
          <CardPile cards={graveyard} icon={<Skull size={10} color="#fff" />} />
        );
    }
  };

  const renderRightItem = (item: "life" | "exile" | "hand") => {
    switch (item) {
      case "life":
        return (
          <View className="items-center gap-2">
            <LifeCounter life={life} previousLife={previousLife} />
            <ManaPoolDisplay manaPool={manaPool} />
          </View>
        );
      case "exile":
        return <CardPile cards={exile} icon={<Ban size={10} color="#fff" />} />;
      case "hand":
        return (
          <Pressable
            onPress={onShowHand}
            className={`items-center justify-center rounded-lg p-3 ${
              isDark
                ? "bg-slate-800 active:bg-slate-700"
                : "bg-slate-200 active:bg-slate-300"
            }`}
          >
            <Hand size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            <Text
              className={`text-xs font-bold mt-1 ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}
            >
              {handCount}
            </Text>
          </Pressable>
        );
    }
  };

  return (
    <CardDimensionsProvider dimensions={cardDimensions}>
      <View
        onLayout={handleLayout}
        className={`flex-row px-2 py-2 ${
          hasPriority
            ? isDark
              ? "border-2 border-purple-500"
              : "border-2 border-purple-400"
            : ""
        }`}
        style={{ minHeight: 200, flex: 1 }}
      >
        {/* Left column: command, library, graveyard */}
        <View className="w-fit items-center justify-around py-1 gap-1">
          {leftColumn.map((item) => (
            <View key={item} className="items-center">
              {renderLeftItem(item)}
            </View>
          ))}
        </View>

        {/* Center: Battlefield */}
        <View className="flex-1">
          <Battlefield
            creatures={creatures}
            artifactsEnchantments={artifactsEnchantments}
            lands={lands}
            allCards={allCards}
            combat={combat}
            dimensions={cardDimensions ?? undefined}
            isOpponent={isOpponent}
            onCardPress={onCardPress}
            onCardLongPress={onCardLongPress}
          />
        </View>

        {/* Right column: life, exile, hand button */}
        <View className="w-fit items-center justify-around py-1">
          {rightColumn.map((item) => (
            <View key={item} className="items-center">
              {renderRightItem(item)}
            </View>
          ))}
        </View>
      </View>
    </CardDimensionsProvider>
  );
}
