import { Pressable, Text, TextInput, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Minus, Plus } from 'lucide-react-native';

interface ManaValueFilterProps {
  minValue?: number;
  maxValue?: number;
  onMinChange: (value?: number) => void;
  onMaxChange: (value?: number) => void;
}

export function ManaValueFilter({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: ManaValueFilterProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleMinIncrement = () => {
    const current = minValue ?? 0;
    onMinChange(current + 1);
  };

  const handleMinDecrement = () => {
    const current = minValue ?? 0;
    if (current > 0) {
      onMinChange(current - 1);
    } else {
      onMinChange(undefined);
    }
  };

  const handleMaxIncrement = () => {
    const current = maxValue ?? 0;
    onMaxChange(current + 1);
  };

  const handleMaxDecrement = () => {
    const current = maxValue ?? 0;
    if (current > 0) {
      onMaxChange(current - 1);
    } else {
      onMaxChange(undefined);
    }
  };

  const handleMinTextChange = (text: string) => {
    if (text === '') {
      onMinChange(undefined);
    } else {
      const value = parseInt(text, 10);
      if (!isNaN(value) && value >= 0) {
        onMinChange(value);
      }
    }
  };

  const handleMaxTextChange = (text: string) => {
    if (text === '') {
      onMaxChange(undefined);
    } else {
      const value = parseInt(text, 10);
      if (!isNaN(value) && value >= 0) {
        onMaxChange(value);
      }
    }
  };

  return (
    <View className="gap-2">
      <Text
        className={`text-sm font-medium mb-2 ${
          isDark ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        Mana Value (CMC)
      </Text>

      <View className="flex-row items-center gap-4">
        {/* Min Value */}
        <View className="flex-1">
          <Text
            className={`text-xs mb-1 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Min
          </Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={handleMinDecrement}
              className={`p-2 rounded ${
                isDark ? 'bg-slate-800' : 'bg-slate-200'
              }`}
            >
              <Minus size={16} color={isDark ? '#cbd5e1' : '#475569'} />
            </Pressable>
            <TextInput
              value={minValue !== undefined ? minValue.toString() : ''}
              onChangeText={handleMinTextChange}
              placeholder="Any"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              keyboardType="number-pad"
              className={`flex-1 text-center px-3 py-2 rounded ${
                isDark
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-900'
              }`}
            />
            <Pressable
              onPress={handleMinIncrement}
              className={`p-2 rounded ${
                isDark ? 'bg-slate-800' : 'bg-slate-200'
              }`}
            >
              <Plus size={16} color={isDark ? '#cbd5e1' : '#475569'} />
            </Pressable>
          </View>
        </View>

        {/* Separator */}
        <Text
          className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
        >
          to
        </Text>

        {/* Max Value */}
        <View className="flex-1">
          <Text
            className={`text-xs mb-1 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Max
          </Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={handleMaxDecrement}
              className={`p-2 rounded ${
                isDark ? 'bg-slate-800' : 'bg-slate-200'
              }`}
            >
              <Minus size={16} color={isDark ? '#cbd5e1' : '#475569'} />
            </Pressable>
            <TextInput
              value={maxValue !== undefined ? maxValue.toString() : ''}
              onChangeText={handleMaxTextChange}
              placeholder="Any"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              keyboardType="number-pad"
              className={`flex-1 text-center px-3 py-2 rounded ${
                isDark
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-900'
              }`}
            />
            <Pressable
              onPress={handleMaxIncrement}
              className={`p-2 rounded ${
                isDark ? 'bg-slate-800' : 'bg-slate-200'
              }`}
            >
              <Plus size={16} color={isDark ? '#cbd5e1' : '#475569'} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Quick Presets */}
      <View className="flex-row flex-wrap gap-2 mt-2">
        <Pressable
          onPress={() => {
            onMinChange(undefined);
            onMaxChange(3);
          }}
          className={`px-3 py-1.5 rounded-full ${
            isDark ? 'bg-slate-800' : 'bg-slate-200'
          }`}
        >
          <Text
            className={`text-xs ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            0-3 (Low)
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            onMinChange(4);
            onMaxChange(6);
          }}
          className={`px-3 py-1.5 rounded-full ${
            isDark ? 'bg-slate-800' : 'bg-slate-200'
          }`}
        >
          <Text
            className={`text-xs ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            4-6 (Mid)
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            onMinChange(7);
            onMaxChange(undefined);
          }}
          className={`px-3 py-1.5 rounded-full ${
            isDark ? 'bg-slate-800' : 'bg-slate-200'
          }`}
        >
          <Text
            className={`text-xs ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            7+ (High)
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
