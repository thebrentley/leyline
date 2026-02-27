import { router, useFocusEffect, useNavigation } from "expo-router";
import {
  Calendar,
  EllipsisVertical,
  Plus,
  Link2,
  Users,
  ChevronRight,
  Crown,
  Shield,
  Mail,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useLayoutEffect, useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreatePodDialog } from "~/components/pods/CreatePodDialog";
import { JoinPodDialog } from "~/components/pods/JoinPodDialog";
import { podsApi, type PodSummary } from "~/lib/api";
import { showToast } from "~/lib/toast";
import { HeaderButton } from "~/components/ui/HeaderButton";
import { useResponsive } from "~/hooks/useResponsive";

const isWeb = Platform.OS === "web";

function PodCard({
  pod,
  isDark,
  isDesktopView,
}: {
  pod: PodSummary;
  isDark: boolean;
  isDesktopView?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={() => router.push(`/pod/${pod.id}`)}
      // @ts-ignore - onMouseEnter/Leave valid on web
      onMouseEnter={isWeb && isDesktopView ? () => setHovered(true) : undefined}
      // @ts-ignore
      onMouseLeave={isWeb && isDesktopView ? () => setHovered(false) : undefined}
      className={`mx-4 mb-3 rounded-xl border p-4 ${
        isDark
          ? "border-slate-800 bg-slate-900 active:bg-slate-800"
          : "border-slate-200 bg-white active:bg-slate-50"
      }`}
      style={
        isWeb && isDesktopView
          ? {
              // @ts-ignore - web CSS
              transition: "transform 150ms ease, box-shadow 150ms ease",
              transform: hovered ? [{ scale: 1.02 }] : [{ scale: 1 }],
              // @ts-ignore
              boxShadow: hovered
                ? isDark
                  ? "0 4px 12px rgba(0,0,0,0.4)"
                  : "0 4px 12px rgba(0,0,0,0.1)"
                : "none",
            }
          : undefined
      }
    >
      <View className="flex-row items-center justify-between">
        {pod.coverImage ? (
          <Image
            source={{ uri: pod.coverImage }}
            className="h-10 w-10 rounded-lg mr-3"
            resizeMode="cover"
          />
        ) : (
          <View
            className={`h-10 w-10 items-center justify-center rounded-lg mr-3 ${
              isDark ? "bg-slate-800" : "bg-slate-100"
            }`}
          >
            <Text
              className={`text-base font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              {pod.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              className={`text-lg font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {pod.name}
            </Text>
            {pod.role === "owner" && (
              <Crown size={14} color="#7C3AED" />
            )}
            {pod.role === "admin" && (
              <Shield size={14} color="#7C3AED" />
            )}
          </View>
          {pod.description && (
            <Text
              className={`mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              numberOfLines={1}
            >
              {pod.description}
            </Text>
          )}
          <View className="mt-2 flex-row items-center gap-4">
            <View className="flex-row items-center gap-1">
              <Users size={14} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-sm ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {pod.memberCount}
              </Text>
            </View>
            {pod.nextEventAt && (
              <View className="flex-row items-center gap-1">
                <Calendar size={14} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text
                  className={`text-sm ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {new Date(pod.nextEventAt).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </View>
        <ChevronRight size={20} color={isDark ? "#475569" : "#cbd5e1"} />
      </View>
    </Pressable>
  );
}

export default function PodsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();
  const navigation = useNavigation();
  const [pods, setPods] = useState<PodSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  useLayoutEffect(() => {
    if (!isDesktop) {
      navigation.setOptions({
        headerRight: () => (
          <HeaderButton
            icon={EllipsisVertical}
            variant="ghost"
            onPress={() => setDropdownVisible((v) => !v)}
          />
        ),
      });
    }
  }, [navigation, isDesktop]);

  const loadPods = useCallback(async () => {
    const result = await podsApi.list();
    if (result.data) {
      setPods(result.data);
    }
    setLoading(false);
  }, []);

  const loadPendingInvites = useCallback(async () => {
    const result = await podsApi.getPendingInvites();
    if (result.data) {
      setPendingInvitesCount(result.data.length);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPods();
      loadPendingInvites();
    }, [loadPods, loadPendingInvites]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadPods(), loadPendingInvites()]);
    setRefreshing(false);
  }, [loadPods, loadPendingInvites]);

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
      edges={[]}
    >
      {/* Dropdown menu for native mobile */}
      {dropdownVisible && !isDesktop && (
        <View
          className={`absolute right-4 top-2 z-50 w-56 rounded-lg border shadow-lg ${
            isDark
              ? "bg-slate-900 border-slate-800"
              : "bg-white border-slate-200"
          }`}
        >
          <View className="py-1">
            <Pressable
              onPress={() => {
                setDropdownVisible(false);
                router.push("/pods/invites");
              }}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
              }`}
            >
              <Mail size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Invites
              </Text>
              {pendingInvitesCount > 0 && (
                <View className="ml-auto min-w-5 h-5 rounded-full bg-purple-600 items-center justify-center px-1">
                  <Text className="text-white text-xs font-bold">
                    {pendingInvitesCount > 9 ? "9+" : pendingInvitesCount}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setDropdownVisible(false);
                router.push("/pods/join");
              }}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
              }`}
            >
              <Link2 size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Join Pod
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setDropdownVisible(false);
                router.push("/pods/create");
              }}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
              }`}
            >
              <Plus size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Create Pod
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Desktop Header */}
      {isDesktop && (
        <View className="flex-row items-center justify-between px-6 py-4">
          <Text
            className={`text-2xl font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Pods
          </Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push("/pods/invites")}
              className={`relative flex-row items-center gap-1.5 rounded-lg px-3 py-2 ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700"
                  : "bg-white border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Mail size={20} color={isDark ? "#e2e8f0" : "#1e293b"} />
              <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Invites
              </Text>
              {pendingInvitesCount > 0 && (
                <View className="absolute -right-1 -top-1 min-w-5 h-5 rounded-full bg-purple-600 items-center justify-center px-1">
                  <Text className="text-white text-xs font-bold">
                    {pendingInvitesCount > 9 ? "9+" : pendingInvitesCount}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => setShowJoinDialog(true)}
              className={`flex-row items-center gap-1.5 rounded-lg px-3 py-2 ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700"
                  : "bg-white border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Link2 size={20} color={isDark ? "#e2e8f0" : "#1e293b"} />
              <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Join
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowCreateDialog(true)}
              className="flex-row items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 hover:bg-purple-700"
            >
              <Plus size={20} color="#ffffff" />
              <Text className="text-sm font-medium text-white">
                Create Pod
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {loading && pods.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
            Loading...
          </Text>
        </View>
      ) : pods.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Users size={48} color={isDark ? "#475569" : "#cbd5e1"} />
          <Text
            className={`text-center text-lg ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            No pods yet
          </Text>
          <Text
            className={`text-center ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            Create a pod or join one with an invite code
          </Text>
        </View>
      ) : (
        <FlatList
          data={pods}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PodCard pod={item} isDark={isDark} isDesktopView={isDesktop} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="w-full max-w-content mx-auto"
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      <CreatePodDialog
        visible={showCreateDialog}
        onCreated={(podId) => {
          setShowCreateDialog(false);
          showToast.success("Pod created!");
          router.push(`/pod/${podId}`);
        }}
        onCancel={() => setShowCreateDialog(false)}
        createPod={podsApi.create}
      />
      <JoinPodDialog
        visible={showJoinDialog}
        onJoined={(podId) => {
          setShowJoinDialog(false);
          showToast.success("Joined pod!");
          router.push(`/pod/${podId}`);
        }}
        onCancel={() => setShowJoinDialog(false)}
        joinByCode={podsApi.joinByCode}
      />
    </SafeAreaView>
  );
}
