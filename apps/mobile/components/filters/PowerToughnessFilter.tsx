import { Pressable, Text, TextInput, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { KEYBOARD_ACCESSORY_ID } from "~/components/ui/KeyboardDoneAccessory";

type Operator = '=' | '>=' | '<=' | '>' | '<';

interface NumericFilterValue {
  value: string;
  operator: Operator;
}

interface PowerToughnessFilterProps {
  power?: NumericFilterValue;
  toughness?: NumericFilterValue;
  onPowerChange: (value?: NumericFilterValue) => void;
  onToughnessChange: (value?: NumericFilterValue) => void;
}

const OPERATORS: { label: string; value: Operator }[] = [
  { label: '=', value: '=' },
  { label: '>=', value: '>=' },
  { label: '<=', value: '<=' },
  { label: '>', value: '>' },
  { label: '<', value: '<' },
];

function NumericWithOperator({
  label,
  filterValue,
  onChange,
  placeholder,
}: {
  label: string;
  filterValue?: NumericFilterValue;
  onChange: (value?: NumericFilterValue) => void;
  placeholder: string;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const currentOperator = filterValue?.operator ?? '=';
  const currentValue = filterValue?.value ?? '';

  const handleValueChange = (text: string) => {
    if (text === '') {
      onChange(undefined);
    } else {
      onChange({ value: text, operator: currentOperator });
    }
  };

  const handleOperatorChange = (op: Operator) => {
    if (currentValue) {
      onChange({ value: currentValue, operator: op });
    }
  };

  return (
    <View className="gap-2">
      <Text
        className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
      >
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        {/* Operator selector - compact row */}
        <View className="flex-row flex-shrink-0">
          {OPERATORS.map((op, index) => {
            const isSelected = currentOperator === op.value;
            const isFirst = index === 0;
            const isLast = index === OPERATORS.length - 1;
            return (
              <Pressable
                key={op.value}
                onPress={() => handleOperatorChange(op.value)}
                className={`px-2 py-1.5 border-t border-b ${
                  isSelected
                    ? 'bg-purple-500 border-purple-500'
                    : isDark
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-slate-100 border-slate-300'
                } ${isFirst ? 'rounded-l border-l' : ''} ${
                  isLast ? 'rounded-r border-r' : ''
                } ${!isFirst && !isSelected ? (isDark ? 'border-l border-l-slate-700' : 'border-l border-l-slate-300') : !isFirst && isSelected ? 'border-l border-l-purple-500' : ''}`}
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
                  {op.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Value input */}
        <TextInput
          value={currentValue}
          onChangeText={handleValueChange}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
          keyboardType="number-pad"
          className={`flex-1 text-center px-3 py-1.5 rounded border ${
            isDark
              ? 'bg-slate-800 border-slate-700 text-white'
              : 'bg-slate-100 border-slate-300 text-slate-900'
          }`}
          inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
        />
      </View>
    </View>
  );
}

export function PowerToughnessFilter({
  power,
  toughness,
  onPowerChange,
  onToughnessChange,
}: PowerToughnessFilterProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className="gap-4">
      <Text
        className={`text-sm font-medium ${
          isDark ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        Power / Toughness
      </Text>

      <View className="gap-4">
        <NumericWithOperator
          label="Power"
          filterValue={power}
          onChange={onPowerChange}
          placeholder="Any"
        />
        <NumericWithOperator
          label="Toughness"
          filterValue={toughness}
          onChange={onToughnessChange}
          placeholder="Any"
        />
      </View>
    </View>
  );
}

export type { NumericFilterValue };
