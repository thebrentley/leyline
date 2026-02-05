import { View } from "react-native";
import { useColorScheme } from "nativewind";
import type { ExtendedGameCard, CombatState } from "~/types/playtesting";
import { CardRow } from "./CardRow";
import type { CardDimensions } from "./CardDimensionsContext";

interface BattlefieldProps {
  creatures: ExtendedGameCard[];
  artifactsEnchantments: ExtendedGameCard[];
  lands: ExtendedGameCard[];
  allCards?: Record<string, ExtendedGameCard>;
  combat?: CombatState;
  dimensions?: CardDimensions;
  isOpponent?: boolean;
  onCardPress?: (card: ExtendedGameCard) => void;
  onCardLongPress?: (card: ExtendedGameCard) => void;
}

export function Battlefield({
  creatures,
  artifactsEnchantments,
  lands,
  allCards,
  combat,
  dimensions,
  isOpponent = false,
  onCardPress,
  onCardLongPress,
}: BattlefieldProps) {
  // Creatures face each other in the middle, lands on the outside
  // Opponent board: Lands at top (far from center), Creatures at bottom (near center)
  // Player board: Creatures at top (near center), Lands at bottom (far from center)
  const rows = isOpponent
    ? [
        { cards: lands, key: "lands" },
        { cards: artifactsEnchantments, key: "artifacts" },
        { cards: creatures, key: "creatures" },
      ]
    : [
        { cards: creatures, key: "creatures" },
        { cards: artifactsEnchantments, key: "artifacts" },
        { cards: lands, key: "lands" },
      ];

  return (
    <View className="flex-1 gap-1">
      {rows.map((row) => (
        <CardRow
          key={row.key}
          cards={row.cards}
          allCards={allCards}
          combat={combat}
          dimensions={dimensions}
          onCardPress={onCardPress}
          onCardLongPress={onCardLongPress}
        />
      ))}
    </View>
  );
}
