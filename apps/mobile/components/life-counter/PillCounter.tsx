import { Minus, Plus } from "lucide-react-native";
import { Pressable, View, Text } from "react-native";

interface PillCounterProps {
  value: number;
  label: string;
  onIncrement: () => void;
  onDecrement: () => void;
  onLongIncrement?: () => void;
  onLongDecrement?: () => void;
}

export function PillCounter({
  value,
  label,
  onIncrement,
  onDecrement,
  onLongIncrement,
  onLongDecrement,
}: PillCounterProps) {
  return (
    <View style={{ alignSelf: "center", alignItems: "center", flex: 1 }}>
      <View style={{ borderRadius: 999, backgroundColor: "rgba(0,0,0,0.35)", paddingHorizontal: 10, paddingVertical: 14, alignItems: "center", justifyContent: "space-between", flex: 1 }}>
        <Pressable
          onPress={onIncrement}
          onLongPress={onLongIncrement}
          className="active:opacity-50"
          style={{ padding: 8 }}
        >
          <Plus size={22} color="rgba(255,255,255,0.5)" />
        </Pressable>
        <View style={{ aspectRatio: 1, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", width: "100%", maxWidth: 80 }}>
          <Text className="text-3xl font-black text-white">{value}</Text>
        </View>
        <Pressable
          onPress={onDecrement}
          onLongPress={onLongDecrement}
          className="active:opacity-50"
          style={{ padding: 8 }}
        >
          <Minus size={22} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>
      <Text className="text-[9px] font-semibold text-white/40 mt-2">{label}</Text>
    </View>
  );
}
