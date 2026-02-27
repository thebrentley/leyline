import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { X, RotateCcw } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassSheet } from '~/components/ui/GlassSheet';
import { ColorFilter } from './ColorFilter';
import { RarityFilter } from './RarityFilter';
import { ManaValueFilter } from './ManaValueFilter';
import { TypeFilter } from './TypeFilter';

export interface SearchFilters {
  colors: string[];
  multicolor: boolean;
  colorless: boolean;
  rarities: string[];
  minMv?: number;
  maxMv?: number;
  cardTypes: string[];
}

interface AdvancedFiltersModalProps {
  visible: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onApply: () => void;
  onClear: () => void;
}

export function AdvancedFiltersModal({
  visible,
  onClose,
  filters,
  onFiltersChange,
  onApply,
  onClear,
}: AdvancedFiltersModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const hasActiveFilters =
    filters.colors.length > 0 ||
    filters.multicolor ||
    filters.colorless ||
    filters.rarities.length > 0 ||
    filters.minMv !== undefined ||
    filters.maxMv !== undefined ||
    filters.cardTypes.length > 0;

  return (
    <GlassSheet visible={visible} onDismiss={onClose} isDark={isDark}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View
          className={`flex-row items-center justify-between px-4 py-3 border-b ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <View className="flex-row items-center gap-2">
            <Text
              className={`text-lg font-bold ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Advanced Filters
            </Text>
            {hasActiveFilters && (
              <View className="px-2 py-0.5 rounded-full bg-purple-500">
                <Text className="text-xs text-white font-medium">
                  {[
                    filters.colors.length,
                    filters.multicolor ? 1 : 0,
                    filters.colorless ? 1 : 0,
                    filters.rarities.length,
                    filters.minMv !== undefined ? 1 : 0,
                    filters.maxMv !== undefined ? 1 : 0,
                    filters.cardTypes.length,
                  ].reduce((a, b) => a + b, 0)}
                </Text>
              </View>
            )}
          </View>
          <Pressable onPress={onClose} className="p-1">
            <X size={24} color={isDark ? '#94a3b8' : '#64748b'} />
          </Pressable>
        </View>

        {/* Filters Content */}
        <BottomSheetScrollView
          contentContainerStyle={{
            padding: 16,
            gap: 24,
            paddingBottom: insets.bottom + 100,
          }}
        >
          {/* Color Filter */}
          <ColorFilter
            selectedColors={filters.colors}
            onColorsChange={(colors) =>
              onFiltersChange({ ...filters, colors })
            }
            multicolor={filters.multicolor}
            onMulticolorChange={(multicolor) =>
              onFiltersChange({ ...filters, multicolor })
            }
            colorless={filters.colorless}
            onColorlessChange={(colorless) =>
              onFiltersChange({ ...filters, colorless })
            }
          />

          {/* Divider */}
          <View
            className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}
          />

          {/* Rarity Filter */}
          <RarityFilter
            selectedRarities={filters.rarities}
            onRaritiesChange={(rarities) =>
              onFiltersChange({ ...filters, rarities })
            }
          />

          {/* Divider */}
          <View
            className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}
          />

          {/* Mana Value Filter */}
          <ManaValueFilter
            minValue={filters.minMv}
            maxValue={filters.maxMv}
            onMinChange={(minMv) => onFiltersChange({ ...filters, minMv })}
            onMaxChange={(maxMv) => onFiltersChange({ ...filters, maxMv })}
          />

          {/* Divider */}
          <View
            className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}
          />

          {/* Type Filter */}
          <TypeFilter
            values={filters.cardTypes}
            onChange={(cardTypes) => onFiltersChange({ ...filters, cardTypes })}
          />
        </BottomSheetScrollView>

        {/* Action Buttons */}
        <View
          className={`absolute bottom-0 left-0 right-0 p-4 border-t flex-row gap-3 ${
            isDark
              ? 'bg-slate-950 border-slate-800'
              : 'bg-white border-slate-200'
          }`}
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          {/* Clear Button */}
          {hasActiveFilters && (
            <Pressable
              onPress={onClear}
              className={`py-3 px-6 rounded-lg border-2 flex-row items-center gap-2 ${
                isDark
                  ? 'border-slate-700 bg-slate-900'
                  : 'border-slate-300 bg-slate-50'
              }`}
            >
              <RotateCcw size={18} color={isDark ? '#cbd5e1' : '#475569'} />
              <Text
                className={`font-semibold ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Clear
              </Text>
            </Pressable>
          )}

          {/* Apply Button */}
          <Pressable
            onPress={() => {
              onApply();
              onClose();
            }}
            className="flex-1 py-3 px-6 rounded-lg bg-purple-500 active:bg-purple-600"
          >
            <Text className="text-white text-center font-semibold text-base">
              Apply Filters
            </Text>
          </Pressable>
        </View>
      </View>
    </GlassSheet>
  );
}
