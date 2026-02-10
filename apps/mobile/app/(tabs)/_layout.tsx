import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from "@react-navigation/drawer";
import { Slot } from "expo-router";
import { Drawer } from "expo-router/drawer";
import {
  ChevronRight,
  Home,
  Layers,
  Library,
  Link2,
  LogOut,
  Moon,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyledSwitch } from "~/components/ui/StyledSwitch";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { useAuth } from "~/contexts/AuthContext";
import { useResponsive } from "~/hooks/useResponsive";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";
import { usePersistedColorScheme } from "~/hooks/usePersistedColorScheme";

interface DrawerItemProps {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  rightText?: string;
  isDark: boolean;
  isActive?: boolean;
}

function DrawerItem({ icon, label, onPress, rightText, isDark, isActive }: DrawerItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between px-6 py-4 ${
        isActive
          ? isDark
            ? "bg-slate-800"
            : "bg-slate-100"
          : isDark
            ? "active:bg-slate-800/50"
            : "active:bg-slate-50"
      }`}
    >
      <View className="flex-row items-center gap-4">
        {icon}
        <Text
          className={`text-base ${
            isActive
              ? "font-semibold text-purple-500"
              : isDark
                ? "text-white"
                : "text-slate-900"
          }`}
        >
          {label}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {rightText && (
          <Text className={isDark ? "text-slate-500" : "text-slate-400"}>
            {rightText}
          </Text>
        )}
        <ChevronRight size={20} color={isDark ? "#475569" : "#cbd5e1"} />
      </View>
    </Pressable>
  );
}

function Divider({ isDark }: { isDark: boolean }) {
  return <View className={`h-px ${isDark ? "bg-slate-800" : "bg-slate-100"}`} />;
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { isDark, toggleColorScheme } = usePersistedColorScheme();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const iconColor = isDark ? "#94a3b8" : "#64748b";
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const currentRoute = props.state.routes[props.state.index]?.name;

  return (
    <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Header */}
        <Pressable
          onPress={() => props.navigation.navigate("profile")}
          className={`mb-6 flex-row items-center gap-4 px-6 py-4 ${
            isDark ? "active:bg-slate-800/50" : "active:bg-slate-50"
          }`}
        >
          {/* Avatar */}
          <View className="h-14 w-14 items-center justify-center rounded-full bg-purple-600">
            <Text className="text-xl font-bold text-white">
              {(user?.displayName || user?.email)?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>
          {/* Name & Edit */}
          <View className="flex-1">
            <Text
              className={`text-lg font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {user?.displayName || user?.email?.split("@")[0] || "User"}
            </Text>
            <View className="flex-row items-center gap-1">
              <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
                Edit profile
              </Text>
              <ChevronRight size={14} color={isDark ? "#94a3b8" : "#64748b"} />
            </View>
          </View>
        </Pressable>

        <Divider isDark={isDark} />

        {/* Navigation Items */}
        <DrawerItem
          icon={<Home size={24} color={currentRoute === "index" ? "#7C3AED" : iconColor} />}
          label="Home"
          onPress={() => props.navigation.navigate("index")}
          isDark={isDark}
          isActive={currentRoute === "index"}
        />
        <Divider isDark={isDark} />

        <DrawerItem
          icon={<Layers size={24} color={currentRoute === "decks" ? "#7C3AED" : iconColor} />}
          label="Decks"
          onPress={() => props.navigation.navigate("decks")}
          isDark={isDark}
          isActive={currentRoute === "decks"}
        />
        <Divider isDark={isDark} />

        <DrawerItem
          icon={<Library size={24} color={currentRoute === "collection" ? "#7C3AED" : iconColor} />}
          label="Collection"
          onPress={() => props.navigation.navigate("collection")}
          isDark={isDark}
          isActive={currentRoute === "collection"}
        />
        <Divider isDark={isDark} />

        {/* Settings Section */}
        <View className="mt-4">
          <Text
            className={`px-6 pb-2 text-xs font-medium uppercase tracking-wider ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            Settings
          </Text>
        </View>

        <DrawerItem
          icon={<Link2 size={24} color={currentRoute === "connections" ? "#7C3AED" : iconColor} />}
          label="Connections"
          onPress={() => props.navigation.navigate("connections")}
          isDark={isDark}
          isActive={currentRoute === "connections"}
        />
        <Divider isDark={isDark} />

        {/* Dark Mode Toggle */}
        <View
          className={`flex-row items-center justify-between px-6 py-4`}
        >
          <View className="flex-row items-center gap-4">
            <Moon size={24} color={iconColor} />
            <Text
              className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Dark mode
            </Text>
          </View>
          <StyledSwitch
            value={isDark}
            onValueChange={toggleColorScheme}
            isDark={isDark}
          />
        </View>
        <Divider isDark={isDark} />

        {/* Log out */}
        <Pressable
          onPress={handleLogout}
          className={`flex-row items-center gap-4 px-6 py-4 ${
            isDark ? "active:bg-slate-800/50" : "active:bg-slate-50"
          }`}
        >
          <LogOut size={24} color={iconColor} />
          <Text className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}>
            Log out
          </Text>
        </Pressable>
      </DrawerContentScrollView>

      {/* Logout Confirmation */}
      <ConfirmDialog
        visible={showLogoutConfirm}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmText="Log out"
        cancelText="Cancel"
        destructive={true}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          signOut();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </View>
  );
}

export default function DrawerLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();

  // Desktop Layout: No drawer, use persistent sidebar
  if (isDesktop) {
    return (
      <View className="flex-1 flex-row">
        {/* Left Sidebar */}
        <DesktopSidebar />

        {/* Main Content Area */}
        <View className={`flex-1 pt-6 ${isDark ? "bg-slate-950" : "bg-white"}`}>
          <Slot />
        </View>
      </View>
    );
  }

  // Mobile Layout: Standard drawer navigation
  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: isDark ? "#020617" : "#ffffff",
          width: 320,
        },
        swipeEnabled: true,
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          drawerLabel: "Home",
        }}
      />
      <Drawer.Screen
        name="decks"
        options={{
          drawerLabel: "Decks",
        }}
      />
      <Drawer.Screen
        name="collection"
        options={{
          drawerLabel: "Collection",
        }}
      />
      <Drawer.Screen
        name="profile"
        options={{
          drawerItemStyle: { display: "none" },
        }}
      />
      <Drawer.Screen
        name="connections"
        options={{
          drawerItemStyle: { display: "none" },
        }}
      />
    </Drawer>
  );
}
