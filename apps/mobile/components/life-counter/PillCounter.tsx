import { Minus, Plus } from "lucide-react-native";
import { Pressable, View, Text, useWindowDimensions } from "react-native";

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
  const dimensions = useWindowDimensions();
  const isTablet = Math.min(dimensions.width, dimensions.height) > 600;

  // Responsive sizing
  const iconSize = isTablet ? 22 : 18;
  const numberFontSize = isTablet ? 30 : 24;
  const circlePadding = isTablet ? 8 : 6;
  const verticalPadding = isTablet ? 10 : 6;
  const maxCircleWidth = isTablet ? 80 : 60;

  return (
    <View style={{ alignSelf: "center", alignItems: "center", flex: 1 }}>
      <View style={{ borderRadius: 999, backgroundColor: "rgba(0,0,0,0.35)", paddingHorizontal: 10, paddingVertical: verticalPadding, alignItems: "center", justifyContent: "space-between", flex: 1 }}>
        <Pressable
          onPress={onIncrement}
          onLongPress={onLongIncrement}
          className="active:opacity-50"
          style={{ padding: circlePadding }}
        >
          <Plus size={iconSize} color="rgba(255,255,255,0.5)" />
        </Pressable>
        <View style={{ aspectRatio: 1, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", width: "100%", maxWidth: maxCircleWidth }}>
          <Text className="font-black text-white" style={{ fontSize: numberFontSize }}>{value}</Text>
        </View>
        <Pressable
          onPress={onDecrement}
          onLongPress={onLongDecrement}
          className="active:opacity-50"
          style={{ padding: circlePadding }}
        >
          <Minus size={iconSize} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>
      <Text className="text-[9px] font-semibold text-white/40 mt-2">{label}</Text>
    </View>
  );
}
