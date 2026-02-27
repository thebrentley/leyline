import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { RotateCcw, X } from 'lucide-react-native';
import { KEYBOARD_ACCESSORY_ID } from "~/components/ui/KeyboardDoneAccessory";
import { ColorFilter } from './ColorFilter';
import { RarityFilter } from './RarityFilter';
import { ManaValueFilter } from './ManaValueFilter';
import { TypeFilter } from './TypeFilter';
import { OracleTextFilter } from './OracleTextFilter';
import { PowerToughnessFilter } from './PowerToughnessFilter';
import { SetFilter } from './SetFilter';
import {
  type AdvancedSearchFilters,
  EMPTY_ADVANCED_FILTERS,
  buildSearchQuery,
} from '~/lib/buildSearchQuery';

interface AdvancedSearchPanelProps {
  filters: AdvancedSearchFilters;
  onFiltersChange: (filters: AdvancedSearchFilters) => void;
  onApply: (query: string) => void;
  onClose: () => void;
}

export function AdvancedSearchPanel({
  filters,
  onFiltersChange,
  onApply,
  onClose,
}: AdvancedSearchPanelProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const hasActiveFilters =
    filters.name.trim().length > 0 ||
    filters.colors.length > 0 ||
    filters.multicolor ||
    filters.colorless ||
    filters.rarities.length > 0 ||
    filters.minMv !== undefined ||
    filters.maxMv !== undefined ||
    filters.cardTypes.length > 0 ||
    filters.oracleTexts.length > 0 ||
    (filters.power?.value ?? '') !== '' ||
    (filters.toughness?.value ?? '') !== '' ||
    filters.setCodes.length > 0;

  const handleClear = () => {
    onFiltersChange({ ...EMPTY_ADVANCED_FILTERS });
  };

  const handleApply = () => {
    const query = buildSearchQuery(filters);
    onApply(query);
  };

  return (
    <View className="flex-1">
      {/* Header */}
      <View
        className={`flex-row items-center justify-between px-4 py-3 border-b ${
          isDark ? 'border-slate-800' : 'border-slate-200'
        }`}
      >
        <View className="flex-row items-center gap-2">
          <Text
            className={`text-base font-bold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            Advanced Search
          </Text>
          {hasActiveFilters && (
            <View className="px-2 py-0.5 rounded-full bg-purple-500">
              <Text className="text-xs text-white font-medium">
                {[
                  filters.name.trim() ? 1 : 0,
                  filters.colors.length > 0 ? 1 : 0,
                  filters.multicolor ? 1 : 0,
                  filters.colorless ? 1 : 0,
                  filters.rarities.length,
                  filters.minMv !== undefined ? 1 : 0,
                  filters.maxMv !== undefined ? 1 : 0,
                  filters.cardTypes.length,
                  filters.oracleTexts.length,
                  filters.power?.value ? 1 : 0,
                  filters.toughness?.value ? 1 : 0,
                  filters.setCodes.length,
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
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          gap: 24,
          paddingBottom: 100,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Card Name */}
        <View className="gap-2">
          <Text
            className={`text-sm font-medium mb-2 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            Card Name
          </Text>
          <View
            className={`flex-row items-center gap-2 px-3 py-2 rounded-lg border ${
              isDark
                ? 'bg-slate-900 border-slate-700'
                : 'bg-slate-50 border-slate-300'
            }`}
          >
            <TextInput
              value={filters.name}
              onChangeText={(name) => onFiltersChange({ ...filters, name })}
              placeholder="Card name..."
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              className={`flex-1 ${isDark ? 'text-white' : 'text-slate-900'}`}
              autoCapitalize="none"
              autoCorrect={false}
              inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
            />
            {filters.name.length > 0 && (
              <Pressable onPress={() => onFiltersChange({ ...filters, name: '' })}>
                <X size={18} color={isDark ? '#64748b' : '#94a3b8'} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Divider */}
        <View className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

        {/* Color Filter */}
        <ColorFilter
          selectedColors={filters.colors}
          onColorsChange={(colors) => onFiltersChange({ ...filters, colors })}
          multicolor={filters.multicolor}
          onMulticolorChange={(multicolor) =>
            onFiltersChange({ ...filters, multicolor })
          }
          colorless={filters.colorless}
          onColorlessChange={(colorless) =>
            onFiltersChange({ ...filters, colorless })
          }
          colorMode={filters.colorMode}
          onColorModeChange={(colorMode) =>
            onFiltersChange({ ...filters, colorMode })
          }
        />

        {/* Divider */}
        <View className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

        {/* Type Filter */}
        <TypeFilter
          values={filters.cardTypes}
          onChange={(cardTypes) => onFiltersChange({ ...filters, cardTypes })}
        />

        {/* Divider */}
        <View className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

        {/* Oracle Text Filter */}
        <OracleTextFilter
          values={filters.oracleTexts}
          onChange={(oracleTexts) => onFiltersChange({ ...filters, oracleTexts })}
        />

        {/* Divider */}
        <View className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

        {/* Mana Value Filter */}
        <ManaValueFilter
          minValue={filters.minMv}
          maxValue={filters.maxMv}
          onMinChange={(minMv) => onFiltersChange({ ...filters, minMv })}
          onMaxChange={(maxMv) => onFiltersChange({ ...filters, maxMv })}
          onRangeChange={(minMv, maxMv) => onFiltersChange({ ...filters, minMv, maxMv })}
        />

        {/* Divider */}
        <View className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

        {/* Rarity Filter */}
        <RarityFilter
          selectedRarities={filters.rarities}
          onRaritiesChange={(rarities) =>
            onFiltersChange({ ...filters, rarities })
          }
        />

        {/* Divider */}
        <View className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

        {/* Power/Toughness Filter */}
        <PowerToughnessFilter
          power={filters.power}
          toughness={filters.toughness}
          onPowerChange={(power) => onFiltersChange({ ...filters, power })}
          onToughnessChange={(toughness) =>
            onFiltersChange({ ...filters, toughness })
          }
        />

        {/* Divider */}
        <View className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

        {/* Set Filter */}
        <SetFilter
          values={filters.setCodes}
          onChange={(setCodes) => onFiltersChange({ ...filters, setCodes })}
        />
      </ScrollView>

      {/* Action Buttons */}
      <View
        className={`p-4 border-t flex-row gap-3 ${
          isDark
            ? 'bg-slate-950 border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        {/* Clear Button */}
        {hasActiveFilters && (
          <Pressable
            onPress={handleClear}
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

        {/* Apply/Search Button */}
        <Pressable
          onPress={handleApply}
          disabled={!hasActiveFilters}
          className={`flex-1 py-3 px-6 rounded-lg ${
            hasActiveFilters
              ? 'bg-purple-500 active:bg-purple-600'
              : isDark
              ? 'bg-slate-800'
              : 'bg-slate-200'
          }`}
        >
          <Text
            className={`text-center font-semibold text-base ${
              hasActiveFilters
                ? 'text-white'
                : isDark
                ? 'text-slate-600'
                : 'text-slate-400'
            }`}
          >
            Search
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export type { AdvancedSearchFilters };
