import { router, usePathname, useFocusEffect } from "expo-router";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
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
import { useState, useCallback } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { StyledSwitch } from "~/components/ui/StyledSwitch";
import { FeedbackDialog } from "~/components/ui/FeedbackDialog";
import { useAuth } from "~/contexts/AuthContext";
import { usePersistedColorScheme } from "~/hooks/usePersistedColorScheme";
import { podsApi, type PodSummary } from "~/lib/api";
import { LeylineLogo } from "~/components/brand/LeylineLogo";

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  rightText?: string;
  isDark: boolean;
  isActive?: boolean;
  isCollapsed?: boolean;
}

function SidebarItem({
  icon,
  label,
  onPress,
  rightText,
  isDark,
  isActive,
  isCollapsed,
}: SidebarItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center ${
        isCollapsed ? "justify-center py-3" : "justify-between px-6 py-3"
      } transition-colors ${
        isActive
          ? isDark
            ? "bg-slate-800"
            : "bg-slate-100"
          : isDark
            ? "hover:bg-slate-800/50 active:bg-slate-800/50"
            : "hover:bg-slate-50 active:bg-slate-50"
      }`}
      {...(isCollapsed ? ({ title: label } as any) : {})}
    >
      {isCollapsed ? (
        icon
      ) : (
        <>
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
        </>
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
  const { user } = useAuth();
  const pathname = usePathname();
  const iconColor = isDark ? "#94a3b8" : "#64748b";
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [showFeedback, setShowFeedback] = useState(false);
  const [pods, setPods] = useState<PodSummary[]>([]);
  const [podsExpanded, setPodsExpanded] = useState(() => {
    try {
      return localStorage.getItem("pods_expanded") === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem("sidebar_collapsed", String(next));
    } catch {}
  };
  const loadPods = useCallback(async () => {
    const result = await podsApi.list();
    if (result.data) {
      setPods(result.data);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPods();
    }, [loadPods])
  );

  // Determine current route from pathname
  const getCurrentRoute = () => {
    if (pathname === "/" || pathname === "/(tabs)") return "index";
    if (pathname.includes("/decks")) return "decks";
    if (pathname.includes("/explore")) return "explore";
    if (pathname.includes("/collection")) return "collection";
    if (pathname.includes("/pods") || pathname.includes("/pod/")) return "pods";
    if (pathname.includes("/profile")) return "profile";
    if (pathname.includes("/connections")) return "connections";
    return "";
  };

  const currentRoute = getCurrentRoute();

  // Extract current pod ID from pathname
  const getCurrentPodId = () => {
    const match = pathname.match(/\/pod\/([^\/]+)/);
    return match ? match[1] : null;
  };

  const currentPodId = getCurrentPodId();

  return (
    <View
      style={{
        width: isCollapsed ? 64 : 240,
        // @ts-ignore - web only CSS transition
        transition: "width 200ms ease-in-out",
      }}
      className={`flex-shrink-0 h-full flex-col border-r overflow-hidden ${
        isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
      }`}
    >
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Logo */}
        {isCollapsed ? (
          <View className="items-center justify-center py-4">
            <Text
              className="text-xl font-light text-purple-500"
              style={{ letterSpacing: 2 }}
            >
              L
            </Text>
          </View>
        ) : (
          <View className="px-6 py-4">
            <LeylineLogo size="small" showTagline={false} />
          </View>
        )}

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
            isCollapsed={isCollapsed}
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
            isCollapsed={isCollapsed}
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
            isCollapsed={isCollapsed}
          />

          <SidebarItem
            icon={
              <Compass
                size={20}
                color={currentRoute === "explore" ? "#7C3AED" : iconColor}
              />
            }
            label="Explore"
            onPress={() => router.push("/(tabs)/explore")}
            isDark={isDark}
            isActive={currentRoute === "explore"}
            isCollapsed={isCollapsed}
          />

          {/* Pods Accordion */}
          {isCollapsed ? (
            <View>
              <Pressable
                onPress={() => router.push("/(tabs)/pods")}
                className={`items-center justify-center py-3 transition-colors ${
                  currentRoute === "pods" && !currentPodId
                    ? isDark
                      ? "bg-slate-800"
                      : "bg-slate-100"
                    : isDark
                      ? "hover:bg-slate-800/50 active:bg-slate-800/50"
                      : "hover:bg-slate-50 active:bg-slate-50"
                }`}
                {...({ title: "Pods" } as any)}
              >
                <Users
                  size={20}
                  color={currentRoute === "pods" ? "#7C3AED" : iconColor}
                />
              </Pressable>
              {pods.map((pod) => (
                <Pressable
                  key={pod.id}
                  onPress={() => router.push(`/pod/${pod.id}`)}
                  className={`items-center justify-center py-2 transition-colors ${
                    currentPodId === pod.id
                      ? isDark
                        ? "bg-slate-800"
                        : "bg-slate-100"
                      : isDark
                        ? "hover:bg-slate-800/50 active:bg-slate-800/50"
                        : "hover:bg-slate-50 active:bg-slate-50"
                  }`}
                  {...({ title: pod.name } as any)}
                >
                  {pod.coverImage ? (
                    <Image
                      source={{ uri: pod.coverImage }}
                      className="h-7 w-7 rounded-full"
                      resizeMode="cover"
                      style={currentPodId === pod.id ? { borderWidth: 2, borderColor: "#7C3AED" } : undefined}
                    />
                  ) : (
                    <View
                      className={`h-7 w-7 items-center justify-center rounded-full ${
                        currentPodId === pod.id ? "bg-purple-500" : "bg-purple-600"
                      }`}
                      style={currentPodId === pod.id ? { borderWidth: 2, borderColor: "#7C3AED" } : undefined}
                    >
                      <Text className="text-[10px] font-bold text-white">
                        {pod.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            <>
              <Pressable
                onPress={() => setPodsExpanded((prev) => {
                  const next = !prev;
                  try { localStorage.setItem("pods_expanded", String(next)); } catch {}
                  return next;
                })}
                className={`flex-row items-center justify-between px-6 py-3 transition-colors ${
                  currentRoute === "pods"
                    ? isDark
                      ? "bg-slate-800"
                      : "bg-slate-100"
                    : isDark
                      ? "hover:bg-slate-800/50 active:bg-slate-800/50"
                      : "hover:bg-slate-50 active:bg-slate-50"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <Users
                    size={20}
                    color={currentRoute === "pods" ? "#7C3AED" : iconColor}
                  />
                  <Text
                    className={`text-sm ${
                      currentRoute === "pods"
                        ? "font-semibold text-purple-500"
                        : isDark
                          ? "text-white"
                          : "text-slate-900"
                    }`}
                  >
                    Pods
                  </Text>
                </View>
                {podsExpanded ? (
                  <ChevronDown size={16} color={isDark ? "#475569" : "#cbd5e1"} />
                ) : (
                  <ChevronRight size={16} color={isDark ? "#475569" : "#cbd5e1"} />
                )}
              </Pressable>
              {podsExpanded && (
                <View className="pb-1">
                  {/* All Pods link */}
                  <Pressable
                    onPress={() => router.push("/(tabs)/pods")}
                    className={`flex-row items-center gap-2 pl-12 pr-4 py-2 ${
                      currentRoute === "pods" && !currentPodId
                        ? isDark
                          ? "bg-slate-800"
                          : "bg-slate-100"
                        : isDark
                          ? "hover:bg-slate-800/50 active:bg-slate-800/50"
                          : "hover:bg-slate-50 active:bg-slate-50"
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        currentRoute === "pods" && !currentPodId
                          ? "font-semibold text-purple-500"
                          : isDark
                            ? "text-slate-400"
                            : "text-slate-500"
                      }`}
                    >
                      All Pods
                    </Text>
                  </Pressable>
                  {pods.map((pod) => (
                    <Pressable
                      key={pod.id}
                      onPress={() => router.push(`/pod/${pod.id}`)}
                      className={`flex-row items-center gap-2.5 pl-12 pr-4 py-2 ${
                        currentPodId === pod.id
                          ? isDark
                            ? "bg-slate-800"
                            : "bg-slate-100"
                          : isDark
                            ? "hover:bg-slate-800/50 active:bg-slate-800/50"
                            : "hover:bg-slate-50 active:bg-slate-50"
                      }`}
                    >
                      {pod.coverImage ? (
                        <Image
                          source={{ uri: pod.coverImage }}
                          className="h-6 w-6 rounded-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="h-6 w-6 items-center justify-center rounded-full bg-purple-600">
                          <Text className="text-[10px] font-bold text-white">
                            {pod.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text
                        className={`text-sm flex-1 ${
                          currentPodId === pod.id
                            ? "font-semibold text-purple-500"
                            : isDark
                              ? "text-slate-300"
                              : "text-slate-700"
                        }`}
                        numberOfLines={1}
                      >
                        {pod.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        <Divider isDark={isDark} />

        {/* Settings Section */}
        {!isCollapsed && (
          <View className="mt-4">
            <Text
              className={`px-6 pb-2 text-xs font-medium uppercase tracking-wider ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Settings
            </Text>
          </View>
        )}
        {isCollapsed && <View className="mt-4" />}

        <SidebarItem
          icon={
            <Link2
              size={20}
              color={
                currentRoute === "connections" ? "#7C3AED" : iconColor
              }
            />
          }
          label="Connections"
          onPress={() => router.push("/(tabs)/connections")}
          isDark={isDark}
          isActive={currentRoute === "connections"}
          isCollapsed={isCollapsed}
        />

        {/* Dark Mode Toggle */}
        {isCollapsed ? (
          <Pressable
            onPress={toggleColorScheme}
            className={`items-center justify-center py-3 ${
              isDark
                ? "hover:bg-slate-800/50 active:bg-slate-800/50"
                : "hover:bg-slate-50 active:bg-slate-50"
            }`}
            {...({ title: "Toggle dark mode" } as any)}
          >
            <Moon size={20} color={iconColor} />
          </Pressable>
        ) : (
          <View className="flex-row items-center justify-between px-6 py-3">
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
        )}

        <SidebarItem
          icon={<MessageSquare size={20} color={iconColor} />}
          label="Send Feedback"
          onPress={() => setShowFeedback(true)}
          isDark={isDark}
          isCollapsed={isCollapsed}
        />

      </ScrollView>

      <FeedbackDialog
        visible={showFeedback}
        onClose={() => setShowFeedback(false)}
      />

      {/* User Profile */}
      <Pressable
        onPress={() => router.push("/(tabs)/profile")}
        className={`flex-row items-center border-t ${
          isCollapsed ? "justify-center py-3" : "gap-3 px-4 py-3"
        } ${
          isDark
            ? "border-slate-800 hover:bg-slate-800/50 active:bg-slate-800/50"
            : "border-slate-200 hover:bg-slate-50 active:bg-slate-50"
        }`}
        {...(isCollapsed
          ? ({
              title:
                user?.displayName ||
                user?.email?.split("@")[0] ||
                "Profile",
            } as any)
          : {})}
      >
        {user?.profilePicture ? (
          <Image
            source={{ uri: user.profilePicture }}
            className={`${isCollapsed ? "h-8 w-8" : "h-9 w-9"} rounded-full`}
            resizeMode="cover"
          />
        ) : (
          <View
            className={`${isCollapsed ? "h-8 w-8" : "h-9 w-9"} items-center justify-center rounded-full bg-purple-600`}
          >
            <Text className="text-sm font-bold text-white">
              {(user?.displayName || user?.email)?.charAt(0).toUpperCase() ||
                "U"}
            </Text>
          </View>
        )}
        {!isCollapsed && (
          <View className="flex-1">
            <Text
              className={`text-sm font-medium ${
                isDark ? "text-white" : "text-slate-900"
              }`}
              numberOfLines={1}
            >
              {user?.displayName || user?.email?.split("@")[0] || "User"}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Collapse/Expand Toggle */}
      <Pressable
        onPress={toggleCollapsed}
        className={`items-center justify-center py-3 border-t ${
          isDark
            ? "border-slate-800 hover:bg-slate-800/50 active:bg-slate-800/50"
            : "border-slate-200 hover:bg-slate-50 active:bg-slate-50"
        }`}
        {...({
          title: isCollapsed ? "Expand sidebar" : "Collapse sidebar",
        } as any)}
      >
        {isCollapsed ? (
          <ChevronsRight size={20} color={iconColor} />
        ) : (
          <ChevronsLeft size={20} color={iconColor} />
        )}
      </Pressable>


    </View>
  );
}
