import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from "@react-navigation/drawer";
import { router, Slot, useFocusEffect } from "expo-router";

import { Drawer } from "expo-router/drawer";
import {
  ChevronDown,
  ChevronRight,
  Compass,
  Home,
  Layers,
  Library,
  Link2,
  MessageSquare,
  Moon,
  Users,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { StyledSwitch } from "~/components/ui/StyledSwitch";
import { FeedbackDialog } from "~/components/ui/FeedbackDialog";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "~/contexts/AuthContext";
import { useResponsive } from "~/hooks/useResponsive";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";
import { usePersistedColorScheme } from "~/hooks/usePersistedColorScheme";
import { podsApi, type PodSummary } from "~/lib/api";
import { LeylineLogo } from "~/components/brand/LeylineLogo";

interface DrawerItemProps {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  rightText?: string;
  isDark: boolean;
  isActive?: boolean;
}

function DrawerItem({
  icon,
  label,
  onPress,
  rightText,
  isDark,
  isActive,
}: DrawerItemProps) {
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
  return (
    <View className={`h-px ${isDark ? "bg-slate-800" : "bg-slate-100"}`} />
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { isDark, toggleColorScheme } = usePersistedColorScheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const iconColor = isDark ? "#94a3b8" : "#64748b";
  const [showFeedback, setShowFeedback] = useState(false);
  const [pods, setPods] = useState<PodSummary[]>([]);
  const [podsExpanded, setPodsExpanded] = useState(() => {
    try {
      return localStorage.getItem("pods_expanded") === "true";
    } catch {
      return false;
    }
  });

  const loadPods = useCallback(async () => {
    const result = await podsApi.list();
    if (result.data) setPods(result.data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPods();
    }, [loadPods]),
  );

  const currentRoute = props.state.routes[props.state.index]?.name;

  return (
    <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View className="px-6 py-6">
          <LeylineLogo size="small" showTagline={false} />
        </View>

        <Divider isDark={isDark} />

        {/* Navigation Items */}
        <DrawerItem
          icon={
            <Home
              size={24}
              color={currentRoute === "(home)" ? "#7C3AED" : iconColor}
            />
          }
          label="Home"
          onPress={() => props.navigation.navigate("(home)")}
          isDark={isDark}
          isActive={currentRoute === "(home)"}
        />
        <Divider isDark={isDark} />

        <DrawerItem
          icon={
            <Layers
              size={24}
              color={currentRoute === "decks" ? "#7C3AED" : iconColor}
            />
          }
          label="Decks"
          onPress={() => props.navigation.navigate("decks")}
          isDark={isDark}
          isActive={currentRoute === "decks"}
        />
        <Divider isDark={isDark} />

        <DrawerItem
          icon={
            <Library
              size={24}
              color={currentRoute === "collection" ? "#7C3AED" : iconColor}
            />
          }
          label="Collection"
          onPress={() => props.navigation.navigate("collection")}
          isDark={isDark}
          isActive={currentRoute === "collection"}
        />
        <Divider isDark={isDark} />

        <DrawerItem
          icon={
            <Compass
              size={24}
              color={currentRoute === "explore" ? "#7C3AED" : iconColor}
            />
          }
          label="Explore"
          onPress={() => props.navigation.navigate("explore")}
          isDark={isDark}
          isActive={currentRoute === "explore"}
        />
        <Divider isDark={isDark} />

        {/* Pods Section */}
        <View
          className={`flex-row items-center justify-between px-6 py-4 ${
            currentRoute === "pods"
              ? isDark
                ? "bg-slate-800"
                : "bg-slate-100"
              : ""
          }`}
        >
          <Pressable
            onPress={() => {
              props.navigation.navigate("pods");
              props.navigation.closeDrawer();
            }}
            className="flex-1 flex-row items-center gap-4"
          >
            <Users
              size={24}
              color={currentRoute === "pods" ? "#7C3AED" : iconColor}
            />
            <Text
              className={`text-base ${
                currentRoute === "pods"
                  ? "font-semibold text-purple-500"
                  : isDark
                    ? "text-white"
                    : "text-slate-900"
              }`}
            >
              Pods
            </Text>
          </Pressable>
          {pods.length > 0 && (
            <Pressable
              onPress={() =>
                setPodsExpanded((prev) => {
                  const next = !prev;
                  try {
                    localStorage.setItem("pods_expanded", String(next));
                  } catch {}
                  return next;
                })
              }
              className="pl-4 py-1"
              hitSlop={8}
            >
              {podsExpanded ? (
                <ChevronDown size={20} color={isDark ? "#475569" : "#cbd5e1"} />
              ) : (
                <ChevronRight
                  size={20}
                  color={isDark ? "#475569" : "#cbd5e1"}
                />
              )}
            </Pressable>
          )}
        </View>
        {podsExpanded && pods.length > 0 && (
          <View
            className={`pb-2 ${isDark ? "bg-slate-900/50" : "bg-slate-50/50"}`}
          >
            {pods.map((pod) => (
              <Pressable
                key={pod.id}
                onPress={() => {
                  router.push(`/pod/${pod.id}`);
                  props.navigation.closeDrawer();
                }}
                className={`flex-row items-center gap-3 pl-14 pr-6 py-3 ${
                  isDark ? "active:bg-slate-800/50" : "active:bg-slate-50"
                }`}
              >
                {pod.coverImage ? (
                  <Image
                    source={{ uri: pod.coverImage }}
                    className="h-7 w-7 rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-purple-600">
                    <Text className="text-xs font-bold text-white">
                      {pod.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text
                  className={`text-sm flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
                  numberOfLines={1}
                >
                  {pod.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
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
          icon={
            <Link2
              size={24}
              color={currentRoute === "connections" ? "#7C3AED" : iconColor}
            />
          }
          label="Connections"
          onPress={() => props.navigation.navigate("connections")}
          isDark={isDark}
          isActive={currentRoute === "connections"}
        />
        <Divider isDark={isDark} />

        {/* Dark Mode Toggle */}
        <View className={`flex-row items-center justify-between px-6 py-4`}>
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

        <DrawerItem
          icon={<MessageSquare size={24} color={iconColor} />}
          label="Send Feedback"
          onPress={() => setShowFeedback(true)}
          isDark={isDark}
        />
        <Divider isDark={isDark} />
      </DrawerContentScrollView>

      <FeedbackDialog
        visible={showFeedback}
        onClose={() => setShowFeedback(false)}
      />

      {/* User Profile */}
      <Pressable
        onPress={() => props.navigation.navigate("profile")}
        className={`flex-row items-center gap-3 px-6 py-4 border-t ${
          isDark
            ? "border-slate-800 active:bg-slate-800/50"
            : "border-slate-200 active:bg-slate-50"
        }`}
      >
        {user?.profilePicture ? (
          <Image
            source={{ uri: user.profilePicture }}
            className="h-10 w-10 rounded-full"
            resizeMode="cover"
          />
        ) : (
          <View className="h-10 w-10 items-center justify-center rounded-full bg-purple-600">
            <Text className="text-sm font-bold text-white">
              {(user?.displayName || user?.email)?.charAt(0).toUpperCase() ||
                "U"}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text
            className={`text-base font-semibold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
            numberOfLines={1}
          >
            {user?.displayName || user?.email?.split("@")[0] || "User"}
          </Text>
        </View>
        <ChevronRight size={16} color={isDark ? "#475569" : "#cbd5e1"} />
      </Pressable>
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
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
        headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
        sceneStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
        drawerStyle: {
          backgroundColor: isDark ? "#020617" : "#ffffff",
          width: 320,
        },
        swipeEnabled: true,
      }}
    >
      <Drawer.Screen
        name="(home)"
        options={{
          drawerLabel: "Home",
          title: "Home",
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="decks"
        options={{
          drawerLabel: "Decks",
          title: "My Decks",
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="collection"
        options={{
          drawerLabel: "Collection",
          title: "Collection",
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="explore"
        options={{
          drawerLabel: "Explore",
          title: "Explore Decks",
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="pods"
        options={{
          drawerLabel: "Pods",
          title: "Pods",
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="profile"
        options={{
          drawerItemStyle: { display: "none" },
          title: "Settings",
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="connections"
        options={{
          drawerItemStyle: { display: "none" },
          title: "Connections",
          headerShown: false,
        }}
      />
    </Drawer>
  );
}
