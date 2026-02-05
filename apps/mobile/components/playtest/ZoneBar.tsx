import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { ExtendedGameCard } from '~/types/playtesting';
import { CardPile } from './CardPile';
import { LifeCounter } from './LifeCounter';
import { GameCard } from './GameCard';

interface ZoneBarProps {
  commander: ExtendedGameCard | null;
  libraryCount: number;
  graveyard: ExtendedGameCard[];
  exile: ExtendedGameCard[];
  life: number;
  previousLife?: number;
  onCommanderPress?: () => void;
  onLibraryPress?: () => void;
  onGraveyardPress?: () => void;
  onExilePress?: () => void;
}

export function ZoneBar({
  commander,
  libraryCount,
  graveyard,
  exile,
  life,
  previousLife,
  onCommanderPress,
  onLibraryPress,
  onGraveyardPress,
  onExilePress,
}: ZoneBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      className={`flex-row items-center justify-between px-2 py-2 ${
        isDark ? 'bg-slate-900/50' : 'bg-slate-100/50'
      }`}
    >
      {/* Commander zone */}
      <View className="items-center">
        {commander ? (
          <GameCard
            card={commander}
            size="pile"
            onPress={onCommanderPress}
          />
        ) : (
          <View
            className={`items-center justify-center rounded ${
              isDark ? 'border border-dashed border-slate-700' : 'border border-dashed border-slate-300'
            }`}
            style={{ width: 40, height: 56 }}
          />
        )}
      </View>

      {/* Library */}
      <CardPile
        cards={[]}
        count={libraryCount}
        isLibrary
        label="Library"
        onPress={onLibraryPress}
      />

      {/* Life counter */}
      <LifeCounter life={life} previousLife={previousLife} />

      {/* Graveyard */}
      <CardPile
        cards={graveyard}
        label="Grave"
        onPress={onGraveyardPress}
      />

      {/* Exile */}
      <CardPile
        cards={exile}
        label="Exile"
        onPress={onExilePress}
      />
    </View>
  );
}
