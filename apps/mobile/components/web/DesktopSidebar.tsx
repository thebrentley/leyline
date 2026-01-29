import Constants from "expo-constants";
import { router, usePathname } from "expo-router";
import {
  ChevronRight,
  CircleHelp,
  Home,
  Layers,
  Library,
  Link2,
  LogOut,
  MessageSquarePlus,
  Moon,
  Settings,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { StyledSwitch } from "~/components/ui/StyledSwitch";
import { useAuth } from "~/contexts/AuthContext";
import { usePersistedColorScheme } from "~/hooks/usePersistedColorScheme";

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  rightText?: string;
  isDark: boolean;
  isActive?: boolean;
}

function SidebarItem({
  icon,
  label,
  onPress,
  rightText,
  isDark,
  isActive,
}: SidebarItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between px-6 py-3 transition-colors ${
        isActive
          ? isDark
            ? "bg-slate-800"
            : "bg-slate-100"
          : isDark
            ? "hover:bg-slate-800/50 active:bg-slate-800/50"
            : "hover:bg-slate-50 active:bg-slate-50"
      }`}
    >
      <View className="flex-row items-center gap-3">
        {icon}
        <Text
          className={`text-sm ${
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
      {rightText && (
        <View className="flex-row items-center gap-2 ml-2 flex-shrink">
          <Text
            className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {rightText}
          </Text>
          <ChevronRight size={16} color={isDark ? "#475569" : "#cbd5e1"} />
        </View>
      )}
    </Pressable>
  );
}

function Divider({ isDark }: { isDark: boolean }) {
  return (
    <View className={`h-px mx-4 ${isDark ? "bg-slate-800" : "bg-slate-100"}`} />
  );
}

export function DesktopSidebar() {
  const { isDark, toggleColorScheme } = usePersistedColorScheme();
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const iconColor = isDark ? "#94a3b8" : "#64748b";
  const appVersion = Constants.expoConfig?.version || "1.0.0";

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  // Determine current route from pathname
  const getCurrentRoute = () => {
    if (pathname === "/" || pathname === "/(tabs)") return "index";
    if (pathname.includes("/decks")) return "decks";
    if (pathname.includes("/collection")) return "collection";
    if (pathname.includes("/profile")) return "profile";
    if (pathname.includes("/connections")) return "connections";
    return "";
  };

  const currentRoute = getCurrentRoute();

  return (
    <View
      className={`w-60 flex-shrink-0 h-full flex-col border-r ${
        isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
      }`}
    >
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* User Profile Header */}
        <Pressable
          onPress={() => router.push("/(tabs)/profile")}
          className={`mb-4 mt-6 flex-row items-center gap-3 px-6 py-3 ${
            isDark
              ? "hover:bg-slate-800/50 active:bg-slate-800/50"
              : "hover:bg-slate-50 active:bg-slate-50"
          }`}
        >
          {/* Avatar */}
          <View className="h-12 w-12 items-center justify-center rounded-full bg-purple-600">
            <Text className="text-lg font-bold text-white">
              {(user?.displayName || user?.email)?.charAt(0).toUpperCase() ||
                "U"}
            </Text>
          </View>
          {/* Name & Edit */}
          <View className="flex-1">
            <Text
              className={`text-base font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
              numberOfLines={1}
            >
              {user?.displayName || user?.email?.split("@")[0] || "User"}
            </Text>
            <View className="flex-row items-center gap-1">
              <Text
                className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Edit profile
              </Text>
              <ChevronRight size={12} color={isDark ? "#94a3b8" : "#64748b"} />
            </View>
          </View>
        </Pressable>

        <Divider isDark={isDark} />

        {/* Navigation Items */}
        <View className="py-2">
          <SidebarItem
            icon={
              <Home
                size={20}
                color={currentRoute === "index" ? "#7C3AED" : iconColor}
              />
            }
            label="Home"
            onPress={() => router.push("/(tabs)/")}
            isDark={isDark}
            isActive={currentRoute === "index"}
          />

          <SidebarItem
            icon={
              <Layers
                size={20}
                color={currentRoute === "decks" ? "#7C3AED" : iconColor}
              />
            }
            label="Decks"
            onPress={() => router.push("/(tabs)/decks")}
            isDark={isDark}
            isActive={currentRoute === "decks"}
          />

          <SidebarItem
            icon={
              <Library
                size={20}
                color={currentRoute === "collection" ? "#7C3AED" : iconColor}
              />
            }
            label="Collection"
            onPress={() => router.push("/(tabs)/collection")}
            isDark={isDark}
            isActive={currentRoute === "collection"}
          />
        </View>

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

        <SidebarItem
          icon={<Link2 size={20} color={currentRoute === "connections" ? "#7C3AED" : iconColor} />}
          label="Connections"
          onPress={() => router.push("/(tabs)/connections")}
          isDark={isDark}
          isActive={currentRoute === "connections"}
        />

        {/* <SidebarItem
          icon={<Settings size={20} color={iconColor} />}
          label="Settings"
          isDark={isDark}
        /> */}

        {/* Dark Mode Toggle */}
        <View className={`flex-row items-center justify-between px-6 py-3`}>
          <View className="flex-row items-center gap-3">
            <Moon size={20} color={iconColor} />
            <Text
              className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
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

        {/* <SidebarItem
          icon={<CircleHelp size={20} color={iconColor} />}
          label="Help Center"
          isDark={isDark}
        /> */}

        {/* <SidebarItem
          icon={<MessageSquarePlus size={20} color={iconColor} />}
          label="Give us feedback"
          isDark={isDark}
        /> */}

        {/* <Divider isDark={isDark} /> */}

        {/* Log out */}
        <Pressable
          onPress={handleLogout}
          className={`flex-row items-center gap-3 px-6 py-3 ${
            isDark
              ? "hover:bg-slate-800/50 active:bg-slate-800/50"
              : "hover:bg-slate-50 active:bg-slate-50"
          }`}
        >
          <LogOut size={20} color={iconColor} />
          <Text
            className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
          >
            Log out
          </Text>
        </Pressable>
      </ScrollView>

      {/* Footer */}
      <View
        className={`items-center gap-1 py-4 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}
      >
        <Text
          className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}
        >
          Version {appVersion}
        </Text>
        <Pressable>
          <Text
            className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
            Terms of Service
          </Text>
        </Pressable>
      </View>

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
