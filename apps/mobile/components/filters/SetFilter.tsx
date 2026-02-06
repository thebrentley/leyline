import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { ChevronDown, ChevronUp, X } from 'lucide-react-native';
import { cardsApi } from '~/lib/api';

interface SetOption {
  setCode: string;
  setName: string;
}

interface SetFilterProps {
  values: string[];
  onChange: (values: string[]) => void;
}

export function SetFilter({ values, onChange }: SetFilterProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [sets, setSets] = useState<SetOption[]>([]);
  const [inputText, setInputText] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [inputHeight, setInputHeight] = useState(44);

  const loadSets = useCallback(async () => {
    if (loaded) return;
    const result = await cardsApi.getSets();
    if (result.data) {
      setSets(result.data);
      setLoaded(true);
    }
  }, [loaded]);

  const handleFocus = useCallback(() => {
    loadSets();
    setDropdownOpen(true);
    setInputText('');
  }, [loadSets]);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setDropdownOpen(false);
      setInputText('');
    }, 150);
  }, []);

  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (!dropdownOpen) {
        setDropdownOpen(true);
        loadSets();
      }
    },
    [dropdownOpen, loadSets],
  );

  const handleToggle = useCallback(
    (set: SetOption) => {
      if (values.includes(set.setCode)) {
        onChange(values.filter((v) => v !== set.setCode));
      } else {
        onChange([...values, set.setCode]);
      }
    },
    [values, onChange],
  );

  const handleRemove = useCallback(
    (code: string) => {
      onChange(values.filter((v) => v !== code));
    },
    [values, onChange],
  );

  const handleClearAll = useCallback(() => {
    onChange([]);
    setInputText('');
    setDropdownOpen(false);
  }, [onChange]);

  const handleInputLayout = useCallback((e: LayoutChangeEvent) => {
    setInputHeight(e.nativeEvent.layout.height);
  }, []);

  // Get display name for a set code
  const getSetName = useCallback(
    (code: string) => {
      const match = sets.find((s) => s.setCode === code);
      return match?.setName ?? code.toUpperCase();
    },
    [sets],
  );

  const filtered = useMemo(() => {
    if (!inputText.trim()) return sets;
    const query = inputText.toLowerCase();
    return sets.filter(
      (s) =>
        s.setName.toLowerCase().includes(query) ||
        s.setCode.toLowerCase().includes(query),
    );
  }, [sets, inputText]);

  const displayedSets = filtered.slice(0, 50);

  return (
    <View className="gap-2" style={{ zIndex: 10, overflow: 'visible' }}>
      <Text
        className={`text-sm font-medium mb-2 ${
          isDark ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        Set / Edition
      </Text>

      {/* Selected set chips */}
      {values.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5">
          {values.map((code) => (
            <Pressable
              key={code}
              onPress={() => handleRemove(code)}
              className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full bg-purple-500"
            >
              <Text className="text-xs text-white font-medium" numberOfLines={1}>
                {getSetName(code)} ({code.toUpperCase()})
              </Text>
              <X size={12} color="#fff" />
            </Pressable>
          ))}
          {values.length > 1 && (
            <Pressable
              onPress={handleClearAll}
              className={`px-2.5 py-1.5 rounded-full ${
                isDark ? 'bg-slate-800' : 'bg-slate-200'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Clear all
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={{ overflow: 'visible' }}>
        {/* Dropdown - absolutely positioned above the input */}
        {dropdownOpen && displayedSets.length > 0 && (
          <View
            style={{
              position: 'absolute',
              bottom: inputHeight + 4,
              left: 0,
              right: 0,
              maxHeight: 200,
              zIndex: 20,
              borderRadius: 8,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: isDark ? '#334155' : '#cbd5e1',
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <FlatList
              data={displayedSets}
              keyExtractor={(item) => item.setCode}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              renderItem={({ item }) => {
                const isSelected = values.includes(item.setCode);
                return (
                  <Pressable
                    onPress={() => handleToggle(item)}
                    className={`px-3 py-2.5 ${
                      isSelected ? 'bg-purple-500/20' : ''
                    }`}
                    style={{
                      borderBottomWidth: 0.5,
                      borderBottomColor: isDark ? '#1e293b' : '#f1f5f9',
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`flex-1 text-sm ${
                          isSelected
                            ? 'text-purple-400 font-medium'
                            : isDark
                            ? 'text-slate-200'
                            : 'text-slate-800'
                        }`}
                        numberOfLines={1}
                      >
                        {item.setName}
                      </Text>
                      <Text
                        className={`text-xs ml-2 ${
                          isSelected
                            ? 'text-purple-400'
                            : isDark
                            ? 'text-slate-500'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.setCode.toUpperCase()}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        {/* Input */}
        <View
          onLayout={handleInputLayout}
          className={`flex-row items-center gap-2 px-3 py-2 rounded-lg border ${
            dropdownOpen
              ? 'border-purple-500'
              : isDark
              ? 'border-slate-700'
              : 'border-slate-300'
          } ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}
        >
          <TextInput
            value={inputText}
            onChangeText={handleTextChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={values.length > 0 ? 'Add another set...' : 'Search sets...'}
            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
            className={`flex-1 ${isDark ? 'text-white' : 'text-slate-900'}`}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {dropdownOpen ? (
            <ChevronUp size={18} color={isDark ? '#64748b' : '#94a3b8'} />
          ) : (
            <ChevronDown size={18} color={isDark ? '#64748b' : '#94a3b8'} />
          )}
        </View>

        {/* No results message */}
        {dropdownOpen && loaded && displayedSets.length === 0 && inputText.trim().length > 0 && (
          <Text
            className={`text-xs text-center py-2 ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            No sets found matching "{inputText}"
          </Text>
        )}
      </View>
    </View>
  );
}
