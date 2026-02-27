import { DrawerToggleButton } from "@react-navigation/drawer";
import { Stack } from "expo-router";
import { useColorScheme } from "nativewind";
import { Platform } from "react-native";
import { useResponsive } from "~/hooks/useResponsive";

const isWeb = Platform.OS === "web";

export default function HomeLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();

  return (
    <Stack
      screenOptions={{
        headerShown: !isDesktop,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
        headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
        headerLeft: () => <DrawerToggleButton tintColor="#7C3AED" />,
        ...(isWeb && { headerRightContainerStyle: { paddingRight: 16 } }),
      }}
    >
      <Stack.Screen name="index" options={{ title: "Home" }} />
    </Stack>
  );
}
