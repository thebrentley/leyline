import { GlassView } from "expo-glass-effect";
import { SeparatorVertical, type LucideIcon } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import React, { useMemo } from "react";
import {
  Platform,
  Pressable,
  Text,
  View,
  type PressableStateCallbackType,
  type ViewStyle,
} from "react-native";
import { useResponsive } from "~/hooks/useResponsive";

type HeaderButtonVariant = "primary" | "secondary" | "ghost";
type ButtonShape = "left" | "right" | "full";

interface HeaderButtonProps {
  icon: LucideIcon;
  label?: string;
  onPress: () => void;
  variant?: HeaderButtonVariant;
  disabled?: boolean;
  iconSize?: number;
  accessibilityLabel?: string;
  hitSlop?: number;
  /** @internal Used by SplitHeaderButton */
  _shape?: ButtonShape;
}

interface SplitHeaderButtonProps {
  primary: Omit<HeaderButtonProps, "_shape">;
  secondary: Omit<HeaderButtonProps, "_shape" | "label">;
  showSecondary?: boolean;
}

interface HeaderButtonGroupProps {
  children: React.ReactNode;
  inNavHeader?: boolean;
}

const isIOS = Platform.OS === "ios";
const isWeb = Platform.OS === "web";

function getVariantStyles(variant: HeaderButtonVariant, isDark: boolean) {
  // iOS native: glass overlay handles background, use semi-transparent base
  if (isIOS) {
    const bg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";

    const iconColors = {
      primary: isDark ? "#c084fc" : "#7c3aed",
      secondary: isDark ? "#94a3b8" : "#64748b",
      ghost: isDark ? "#94a3b8" : "#64748b",
    };

    const bgColors = {
      primary: isDark ? "rgba(124,58,237,0.3)" : "rgba(124,58,237,0.15)",
      secondary: bg,
      ghost: bg,
    };

    return {
      backgroundColor: bgColors[variant],
      iconColor: iconColors[variant],
      textColor: "transparent",
    };
  }

  // Web + Android
  const styles = {
    primary: {
      backgroundColor: isDark
        ? "rgba(124,58,237,0.4)"
        : "rgba(124,58,237,0.25)",
      iconColor: isDark ? "#ffffff" : "#000000",
      textColor: isDark ? "#ffffff" : "#000000",
    },
    secondary: {
      backgroundColor: isDark ? "rgba(30,41,59,0.8)" : "rgba(226,232,240,0.8)",
      iconColor: isDark ? "#94a3b8" : "#64748b",
      textColor: isDark ? "#cbd5e1" : "#475569",
    },
    ghost: {
      backgroundColor: isDark ? "rgba(30,41,59,0.9)" : "rgba(226,232,240,0.9)",
      iconColor: isDark ? "#94a3b8" : "#64748b",
      textColor: isDark ? "#94a3b8" : "#64748b",
    },
  };

  return styles[variant];
}

function getBorderRadius(shape: ButtonShape): ViewStyle {
  // iOS native: pill shape
  const radius = isIOS ? 999 : 8;

  if (shape === "full") {
    return { borderRadius: radius };
  }
  if (shape === "left") {
    return {
      borderTopLeftRadius: radius,
      borderBottomLeftRadius: radius,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    };
  }
  // right
  return {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: radius,
    borderBottomRightRadius: radius,
    marginLeft: 1,
  };
}

function HeaderButton({
  icon: Icon,
  label,
  onPress,
  variant = "primary",
  disabled = false,
  iconSize: iconSizeOverride,
  accessibilityLabel,
  hitSlop,
  _shape = "full",
}: HeaderButtonProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isMobile: isMobileViewport } = useResponsive();

  const showLabel = isWeb && !isMobileViewport && !!label;
  const resolvedIconSize = iconSizeOverride ?? (showLabel ? 18 : 20);

  const { backgroundColor, iconColor, textColor } = useMemo(
    () => getVariantStyles(variant, isDark),
    [variant, isDark],
  );

  const borderRadiusStyle = useMemo(() => getBorderRadius(_shape), [_shape]);

  const dimensions: ViewStyle = showLabel
    ? { height: 36, paddingHorizontal: 12 }
    : { height: 36, width: _shape === "right" ? 28 : 36 };

  const containerStyle: ViewStyle = {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: showLabel ? "row" : undefined,
    gap: showLabel ? 6 : undefined,
    backgroundColor,
    ...dimensions,
    ...borderRadiusStyle,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
    >
      {(state) => {
        const hovered = (
          state as PressableStateCallbackType & { hovered?: boolean }
        ).hovered;
        const interactive = hovered || state.pressed;

        return (
          <View
            style={[
              !isIOS && containerStyle,
              interactive && !disabled && { opacity: 0.8 },
              disabled && { opacity: 0.5 },
            ]}
          >
            <Icon size={resolvedIconSize} color={iconColor} />
            {showLabel && (
              <Text
                style={{ color: textColor, fontSize: 14, fontWeight: "500" }}
              >
                {label}
              </Text>
            )}
          </View>
        );
      }}
    </Pressable>
  );
}

function SplitHeaderButton({
  primary,
  secondary,
  showSecondary = true,
}: SplitHeaderButtonProps) {
  if (!showSecondary) {
    return <HeaderButton {...primary} />;
  }

  return (
    <View
      style={{
        flexDirection: "row",
        paddingHorizontal: 8,
        alignItems: "center",
      }}
    >
      <HeaderButton {...primary} _shape="left" />
      <View
        style={{
          width: 1,
          height: "60%",
          backgroundColor: "rgba(148,163,184,0.4)",
        }}
      />
      <HeaderButton {...secondary} _shape="right" />
    </View>
  );
}

function HeaderButtonGroup({
  children,
  inNavHeader = true,
}: HeaderButtonGroupProps) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap: 4 },
        inNavHeader ? { marginRight: isWeb ? 12 : 8 } : undefined,
      ]}
    >
      {children}
    </View>
  );
}

export { HeaderButton, SplitHeaderButton, HeaderButtonGroup };
export type {
  HeaderButtonProps,
  SplitHeaderButtonProps,
  HeaderButtonGroupProps,
};
