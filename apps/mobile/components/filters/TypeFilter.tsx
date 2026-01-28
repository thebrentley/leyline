import { Pressable, Text, TextInput, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { X } from 'lucide-react-native';

interface TypeFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const COMMON_TYPES = [
  'Creature',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Planeswalker',
  'Land',
  'Legendary',
];

export function TypeFilter({ value, onChange }: TypeFilterProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className="gap-2">
      <Text
        className={`text-sm font-medium mb-2 ${
          isDark ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        Card Type
      </Text>

      {/* Text Input */}
      <View
        className={`flex-row items-center gap-2 px-3 py-2 rounded-lg border ${
          isDark
            ? 'bg-slate-900 border-slate-700'
            : 'bg-slate-50 border-slate-300'
        }`}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="creature, instant, legendary..."
          placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
          className={`flex-1 ${isDark ? 'text-white' : 'text-slate-900'}`}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {value.length > 0 && (
          <Pressable onPress={() => onChange('')}>
            <X size={18} color={isDark ? '#64748b' : '#94a3b8'} />
          </Pressable>
        )}
      </View>

      {/* Quick Type Buttons */}
      <View className="flex-row flex-wrap gap-2">
        {COMMON_TYPES.map((type) => {
          const isSelected = value.toLowerCase() === type.toLowerCase();
          return (
            <Pressable
              key={type}
              onPress={() => onChange(isSelected ? '' : type.toLowerCase())}
              className={`px-3 py-1.5 rounded-full border ${
                isSelected
                  ? 'bg-purple-500 border-purple-500'
                  : isDark
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-slate-100 border-slate-300'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  isSelected
                    ? 'text-white'
                    : isDark
                    ? 'text-slate-300'
                    : 'text-slate-700'
                }`}
              >
                {type}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
