import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Sparkles, Gem, Circle, Square } from 'lucide-react-native';

interface RarityFilterProps {
  selectedRarities: string[];
  onRaritiesChange: (rarities: string[]) => void;
}

const RARITIES = [
  { value: 'common', label: 'Common', icon: Circle, color: '#64748b' },
  { value: 'uncommon', label: 'Uncommon', icon: Square, color: '#94a3b8' },
  { value: 'rare', label: 'Rare', icon: Gem, color: '#eab308' },
  { value: 'mythic', label: 'Mythic', icon: Sparkles, color: '#f97316' },
];

export function RarityFilter({
  selectedRarities,
  onRaritiesChange,
}: RarityFilterProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const toggleRarity = (value: string) => {
    if (selectedRarities.includes(value)) {
      onRaritiesChange(selectedRarities.filter((r) => r !== value));
    } else {
      onRaritiesChange([...selectedRarities, value]);
    }
  };

  return (
    <View className="gap-2">
      <Text
        className={`text-sm font-medium mb-2 ${
          isDark ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        Rarity
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {RARITIES.map((rarity) => {
          const isSelected = selectedRarities.includes(rarity.value);
          const Icon = rarity.icon;

          return (
            <Pressable
              key={rarity.value}
              onPress={() => toggleRarity(rarity.value)}
              className={`px-4 py-2.5 rounded-full border-2 flex-row items-center gap-2 ${
                isSelected
                  ? 'border-purple-500'
                  : isDark
                  ? 'border-slate-700'
                  : 'border-slate-300'
              }`}
              style={{
                backgroundColor: isSelected
                  ? isDark
                    ? '#7c3aed20'
                    : '#7c3aed10'
                  : isDark
                  ? '#1e293b'
                  : '#f1f5f9',
              }}
            >
              <Icon size={16} color={isSelected ? rarity.color : isDark ? '#94a3b8' : '#64748b'} />
              <Text
                className={`font-medium ${
                  isSelected
                    ? isDark
                      ? 'text-white'
                      : 'text-slate-900'
                    : isDark
                    ? 'text-slate-300'
                    : 'text-slate-700'
                }`}
              >
                {rarity.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
