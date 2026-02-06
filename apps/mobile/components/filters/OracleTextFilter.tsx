import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Plus, X } from 'lucide-react-native';

interface OracleTextFilterProps {
  values: string[];
  onChange: (values: string[]) => void;
}

const COMMON_KEYWORDS = [
  'draw',
  'destroy',
  'exile',
  'counter',
  'flying',
  'trample',
  'deathtouch',
  'lifelink',
];

export function OracleTextFilter({ values, onChange }: OracleTextFilterProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [inputText, setInputText] = useState('');

  const addValue = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed && !values.includes(trimmed)) {
        onChange([...values, trimmed]);
      }
      setInputText('');
    },
    [values, onChange],
  );

  const removeValue = useCallback(
    (text: string) => {
      onChange(values.filter((v) => v !== text));
    },
    [values, onChange],
  );

  const toggleKeyword = useCallback(
    (keyword: string) => {
      if (values.includes(keyword)) {
        onChange(values.filter((v) => v !== keyword));
      } else {
        onChange([...values, keyword]);
      }
    },
    [values, onChange],
  );

  const handleSubmit = useCallback(() => {
    if (inputText.trim()) {
      addValue(inputText);
    }
  }, [inputText, addValue]);

  return (
    <View className="gap-2">
      <Text
        className={`text-sm font-medium mb-2 ${
          isDark ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        Oracle Text
      </Text>

      {/* Selected text chips */}
      {values.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5">
          {values.map((text) => (
            <Pressable
              key={text}
              onPress={() => removeValue(text)}
              className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full bg-purple-500"
            >
              <Text className="text-xs text-white font-medium" numberOfLines={1}>
                {text}
              </Text>
              <X size={12} color="#fff" />
            </Pressable>
          ))}
        </View>
      )}

      {/* Text Input with add button */}
      <View
        className={`flex-row items-center gap-2 px-3 py-2 rounded-lg border ${
          isDark
            ? 'bg-slate-900 border-slate-700'
            : 'bg-slate-50 border-slate-300'
        }`}
      >
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSubmit}
          placeholder={values.length > 0 ? 'Add another term...' : 'draw a card, destroy target...'}
          placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
          className={`flex-1 ${isDark ? 'text-white' : 'text-slate-900'}`}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
        />
        {inputText.trim().length > 0 && (
          <Pressable onPress={handleSubmit}>
            <Plus size={18} color="#a855f7" />
          </Pressable>
        )}
      </View>

      {/* Quick Keyword Buttons */}
      <View className="flex-row flex-wrap gap-2">
        {COMMON_KEYWORDS.map((keyword) => {
          const isSelected = values.includes(keyword);
          return (
            <Pressable
              key={keyword}
              onPress={() => toggleKeyword(keyword)}
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
                {keyword}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
