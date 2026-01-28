import { Drawer } from "expo-router/drawer";
import { Menu } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";
import { useResponsive } from "~/hooks/useResponsive";
import { DrawerActions } from "@react-navigation/native";
import { useNavigation } from "expo-router";

interface ResponsiveLayoutProps {
  children: ReactNode;
  drawerContent?: (props: any) => ReactNode;
}

/**
 * Responsive layout that switches between mobile drawer and desktop sidebar
 * Mobile (<1024px): Drawer navigation (overlay)
 * Desktop (≥1024px): Persistent sidebar + top bar with user menu
 */
export function ResponsiveLayout({ children, drawerContent }: ResponsiveLayoutProps) {
  const { isDesktop } = useResponsive();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const navigation = useNavigation();

  if (isDesktop) {
    // Desktop Layout: Persistent Sidebar + Content Area
    return (
      <View className="flex-1 flex-row">
        {/* Left Sidebar */}
        <DesktopSidebar />

        {/* Main Content Area */}
        <View className={`flex-1 pt-6 ${isDark ? "bg-slate-950" : "bg-white"}`}>
          {children}
        </View>
      </View>
    );
  }

  // Mobile Layout: Use existing drawer
  // This will be wrapped by Drawer navigator in _layout.tsx
  return (
    <View className="flex-1">
      {/* Mobile Header with Menu Button */}
      <View
        className={`h-16 flex-row items-center justify-between px-4 border-b ${
          isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          className="p-2"
        >
          <Menu size={24} color={isDark ? "#94a3b8" : "#64748b"} />
        </Pressable>
      </View>

      {/* Content */}
      <View className="flex-1">
        {children}
      </View>
    </View>
  );
}
