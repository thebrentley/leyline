import { ScrollView, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { ExtendedGameCard, CombatState } from '~/types/playtesting';
import { GameCard } from './GameCard';
import type { CardDimensions } from './CardDimensionsContext';

interface CardRowProps {
  cards: ExtendedGameCard[];
  allCards?: Record<string, ExtendedGameCard>;
  combat?: CombatState;
  dimensions?: CardDimensions;
  onCardPress?: (card: ExtendedGameCard) => void;
  onCardLongPress?: (card: ExtendedGameCard) => void;
}

export function CardRow({
  cards,
  allCards,
  combat,
  dimensions,
  onCardPress,
  onCardLongPress,
}: CardRowProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isAttacking = (cardId: string) =>
    combat?.attackers.some(a => a.cardId === cardId) ?? false;

  const isBlocking = (cardId: string) =>
    combat?.blockers.some(b => b.cardId === cardId) ?? false;

  // Filter out cards that are attached to something else (they render with their host)
  const visibleCards = cards.filter(card => !card.attachedTo);

  // Empty row still takes up space for layout consistency
  if (visibleCards.length === 0) {
    return <View className="flex-1" />;
  }

  return (
    <View className="flex-1">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 4,
          paddingVertical: 2,
          alignItems: 'center',
        }}
      >
        {visibleCards.map((card) => {
          // Get attachments for this card
          const attachments = allCards
            ? card.attachments
                .map(id => allCards[id])
                .filter((c): c is ExtendedGameCard => !!c)
            : [];

          return (
            <GameCard
              key={card.instanceId}
              card={card}
              attachments={attachments}
              dimensions={dimensions}
              isAttacking={isAttacking(card.instanceId)}
              isBlocking={isBlocking(card.instanceId)}
              onPress={() => onCardPress?.(card)}
              onLongPress={() => onCardLongPress?.(card)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
