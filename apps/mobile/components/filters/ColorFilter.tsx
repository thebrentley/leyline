import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';

type ColorMode = 'color' | 'identity';

interface ColorFilterProps {
  selectedColors: string[];
  onColorsChange: (colors: string[]) => void;
  multicolor?: boolean;
  onMulticolorChange?: (multicolor: boolean) => void;
  colorless?: boolean;
  onColorlessChange?: (colorless: boolean) => void;
  colorMode?: ColorMode;
  onColorModeChange?: (mode: ColorMode) => void;
}

const COLORS = [
  { code: 'W', name: 'White', color: '#F9FAFB', darkColor: '#F3F4F6', textColor: '#1F2937' },
  { code: 'U', name: 'Blue', color: '#3B82F6', darkColor: '#2563EB', textColor: '#FFFFFF' },
  { code: 'B', name: 'Black', color: '#1F2937', darkColor: '#111827', textColor: '#FFFFFF' },
  { code: 'R', name: 'Red', color: '#EF4444', darkColor: '#DC2626', textColor: '#FFFFFF' },
  { code: 'G', name: 'Green', color: '#10B981', darkColor: '#059669', textColor: '#FFFFFF' },
];

export function ColorFilter({
  selectedColors,
  onColorsChange,
  multicolor = false,
  onMulticolorChange,
  colorless = false,
  onColorlessChange,
  colorMode = 'color',
  onColorModeChange,
}: ColorFilterProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const toggleColor = (code: string) => {
    if (selectedColors.includes(code)) {
      onColorsChange(selectedColors.filter((c) => c !== code));
    } else {
      onColorsChange([...selectedColors, code]);
    }
  };

  return (
    <View className="gap-4">
      {/* Color / Color Identity Toggle */}
      {onColorModeChange && (
        <View>
          <Text
            className={`text-sm font-medium mb-2 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            Match By
          </Text>
          <View className="flex-row">
            <Pressable
              onPress={() => onColorModeChange('color')}
              className={`flex-1 py-2 rounded-l-lg border ${
                colorMode === 'color'
                  ? 'bg-purple-500 border-purple-500'
                  : isDark
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-slate-100 border-slate-300'
              }`}
            >
              <Text
                className={`text-center text-sm font-medium ${
                  colorMode === 'color'
                    ? 'text-white'
                    : isDark
                    ? 'text-slate-300'
                    : 'text-slate-700'
                }`}
              >
                Color
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onColorModeChange('identity')}
              className={`flex-1 py-2 rounded-r-lg border ${
                colorMode === 'identity'
                  ? 'bg-purple-500 border-purple-500'
                  : isDark
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-slate-100 border-slate-300'
              }`}
            >
              <Text
                className={`text-center text-sm font-medium ${
                  colorMode === 'identity'
                    ? 'text-white'
                    : isDark
                    ? 'text-slate-300'
                    : 'text-slate-700'
                }`}
              >
                Color Identity
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Color Pills */}
      <View>
        <Text
          className={`text-sm font-medium mb-2 ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          Colors
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {COLORS.map((color) => {
            const isSelected = selectedColors.includes(color.code);
            return (
              <Pressable
                key={color.code}
                onPress={() => toggleColor(color.code)}
                style={{
                  backgroundColor: isSelected
                    ? isDark
                      ? color.darkColor
                      : color.color
                    : isDark
                    ? '#1e293b'
                    : '#f1f5f9',
                  borderWidth: 2,
                  borderColor: isSelected
                    ? isDark
                      ? color.darkColor
                      : color.color
                    : isDark
                    ? '#334155'
                    : '#cbd5e1',
                }}
                className="px-4 py-2.5 rounded-full flex-row items-center gap-2"
              >
                {/* Color Circle */}
                <View
                  style={{
                    backgroundColor: isDark ? color.darkColor : color.color,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    borderWidth: color.code === 'W' ? 1 : 0,
                    borderColor: isDark ? '#64748b' : '#94a3b8',
                  }}
                />
                <Text
                  style={{
                    color: isSelected
                      ? color.textColor
                      : isDark
                      ? '#cbd5e1'
                      : '#475569',
                  }}
                  className="font-medium"
                >
                  {color.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Special Filters */}
      <View>
        <Text
          className={`text-sm font-medium mb-2 ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          Special
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {/* Multicolor */}
          <Pressable
            onPress={() => onMulticolorChange?.(!multicolor)}
            className={`px-4 py-2.5 rounded-full border-2 ${
              multicolor
                ? 'bg-purple-500 border-purple-500'
                : isDark
                ? 'bg-slate-800 border-slate-700'
                : 'bg-slate-100 border-slate-300'
            }`}
          >
            <Text
              className={`font-medium ${
                multicolor
                  ? 'text-white'
                  : isDark
                  ? 'text-slate-300'
                  : 'text-slate-700'
              }`}
            >
              🌈 Multicolor
            </Text>
          </Pressable>

          {/* Colorless */}
          <Pressable
            onPress={() => onColorlessChange?.(!colorless)}
            className={`px-4 py-2.5 rounded-full border-2 ${
              colorless
                ? 'bg-slate-400 border-slate-400'
                : isDark
                ? 'bg-slate-800 border-slate-700'
                : 'bg-slate-100 border-slate-300'
            }`}
          >
            <Text
              className={`font-medium ${
                colorless
                  ? 'text-white'
                  : isDark
                  ? 'text-slate-300'
                  : 'text-slate-700'
              }`}
            >
              ◇ Colorless
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export type { ColorMode };
