import { GlassView } from "expo-glass-effect";
import type { LucideIcon } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { Platform, Pressable, type ViewStyle } from "react-native";

interface GlassFabProps {
  icon: LucideIcon;
  onPress: () => void;
  bottom: number;
  right?: number;
  size?: number;
  iconSize?: number;
}

export function GlassFab({
  icon: Icon,
  onPress,
  bottom,
  right = 24,
  size = 56,
  iconSize = 24,
}: GlassFabProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const isWeb = Platform.OS === "web";

  const containerStyle: ViewStyle = {
    position: "absolute",
    bottom,
    right,
    height: size,
    width: size,
    borderRadius: size / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: isWeb
      ? isDark
        ? "#7C3AED"
        : "#9333EA"
      : "transparent",
  };

  return (
    <Pressable onPress={onPress} style={containerStyle}>
      {!isWeb && (
        <GlassView
          glassEffectStyle="regular"
          tintColor={
            isDark ? "rgba(124,58,237,0.3)" : "rgba(124,58,237,0.15)"
          }
          colorScheme={isDark ? "dark" : "light"}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      )}
      <Icon
        size={iconSize}
        color={isWeb ? "white" : isDark ? "#c084fc" : "#7c3aed"}
      />
    </Pressable>
  );
}
