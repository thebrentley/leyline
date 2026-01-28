import { Pressable, ScrollView, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { X } from 'lucide-react-native';

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  color?: string;
}

interface ActiveFiltersBarProps {
  filters: ActiveFilter[];
  onRemoveFilter: (key: string) => void;
  onClearAll?: () => void;
}

export function ActiveFiltersBar({
  filters,
  onRemoveFilter,
  onClearAll,
}: ActiveFiltersBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (filters.length === 0) {
    return null;
  }

  return (
    <View
      className={`px-4 py-2 border-b ${
        isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'
      }`}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {filters.map((filter) => (
          <Pressable
            key={filter.key}
            onPress={() => onRemoveFilter(filter.key)}
            className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
              isDark
                ? 'bg-slate-800 border-slate-700'
                : 'bg-slate-100 border-slate-300'
            }`}
            style={
              filter.color
                ? {
                    backgroundColor: isDark
                      ? `${filter.color}20`
                      : `${filter.color}10`,
                    borderColor: filter.color,
                  }
                : undefined
            }
          >
            <Text
              className={`text-xs font-medium ${
                isDark ? 'text-slate-200' : 'text-slate-700'
              }`}
              style={filter.color ? { color: filter.color } : undefined}
            >
              {filter.label}: {filter.value}
            </Text>
            <X
              size={14}
              color={filter.color || (isDark ? '#cbd5e1' : '#475569')}
            />
          </Pressable>
        ))}

        {/* Clear All Button */}
        {filters.length > 1 && onClearAll && (
          <Pressable
            onPress={onClearAll}
            className={`px-3 py-1.5 rounded-full ${
              isDark ? 'bg-red-900/30' : 'bg-red-50'
            }`}
          >
            <Text className="text-xs font-medium text-red-500">Clear All</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
