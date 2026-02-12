import { router } from "expo-router";
import { LogOut, Settings, User } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { useAuth } from "~/contexts/AuthContext";

export function UserMenu() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const iconColor = isDark ? "#94a3b8" : "#64748b";

  const handleLogout = () => {
    setIsOpen(false);
    setShowLogoutConfirm(true);
  };

  return (
    <View className="relative">
      {/* Avatar Button */}
      <Pressable
        onPress={() => setIsOpen(!isOpen)}
        className={`h-10 w-10 items-center justify-center rounded-full ${
          user?.profilePicture ? "" : `bg-purple-600 ${isDark ? "hover:bg-purple-700" : "hover:bg-purple-500"}`
        }`}
      >
        {user?.profilePicture ? (
          <Image
            source={{ uri: user.profilePicture }}
            className="h-10 w-10 rounded-full"
            resizeMode="cover"
          />
        ) : (
          <Text className="text-base font-bold text-white">
            {(user?.displayName || user?.email)?.charAt(0).toUpperCase() || "U"}
          </Text>
        )}
      </Pressable>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <Pressable
            onPress={() => setIsOpen(false)}
            className="fixed inset-0 z-40"
            style={{ position: 'fixed' }}
          />

          {/* Menu */}
          <View
            className={`absolute right-0 top-12 z-50 w-56 rounded-lg border shadow-lg ${
              isDark
                ? "bg-slate-900 border-slate-800"
                : "bg-white border-slate-200"
            }`}
          >
            {/* User Info */}
            <View className="px-4 py-3 border-b border-slate-800">
              <Text
                className={`text-sm font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
                numberOfLines={1}
              >
                {user?.displayName || user?.email?.split("@")[0] || "User"}
              </Text>
              <Text
                className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                numberOfLines={1}
              >
                {user?.email}
              </Text>
            </View>

            {/* Menu Items */}
            <View className="py-1">
              <Pressable
                onPress={() => {
                  setIsOpen(false);
                  router.push("/(tabs)/profile");
                }}
                className={`flex-row items-center gap-3 px-4 py-2 ${
                  isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
                }`}
              >
                <User size={18} color={iconColor} />
                <Text className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                  Profile
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setIsOpen(false)}
                className={`flex-row items-center gap-3 px-4 py-2 ${
                  isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
                }`}
              >
                <Settings size={18} color={iconColor} />
                <Text className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                  Settings
                </Text>
              </Pressable>

              <View className={`h-px mx-2 my-1 ${isDark ? "bg-slate-800" : "bg-slate-100"}`} />

              <Pressable
                onPress={handleLogout}
                className={`flex-row items-center gap-3 px-4 py-2 ${
                  isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
                }`}
              >
                <LogOut size={18} color="#ef4444" />
                <Text className="text-sm text-red-500">Log out</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

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
