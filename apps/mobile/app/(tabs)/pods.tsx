import { DrawerActions, useNavigation } from "@react-navigation/native";
import { router, useFocusEffect } from "expo-router";
import {
  Calendar,
  Menu,
  Plus,
  Link2,
  Users,
  ChevronRight,
  Crown,
  Shield,
  Mail,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useState } from "react";
import {
  FlatList,
  Image,
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
import { useResponsive } from "~/hooks/useResponsive";

function PodCard({
  pod,
  isDark,
}: {
  pod: PodSummary;
  isDark: boolean;
}) {
  return (
    <Pressable
      onPress={() => router.push(`/pod/${pod.id}`)}
      className={`mx-4 mb-3 rounded-xl border p-4 ${
        isDark
          ? "border-slate-800 bg-slate-900 active:bg-slate-800"
          : "border-slate-200 bg-white active:bg-slate-50"
      }`}
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
  const navigation = useNavigation();
  const { isDesktop } = useResponsive();
  const [pods, setPods] = useState<PodSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

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
      edges={isDesktop ? [] : ["top"]}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pb-4 pt-2">
        <View className="flex-row items-center gap-3">
          {!isDesktop && (
            <Pressable
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              hitSlop={8}
            >
              <Menu size={24} color={isDark ? "#e2e8f0" : "#1e293b"} />
            </Pressable>
          )}
          <Text
            className={`text-2xl font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Pods
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.push("/pods/invites")}
            className={`relative rounded-lg px-3 py-2 ${
              isDark ? "bg-slate-800" : "bg-slate-100"
            }`}
          >
            <Mail size={20} color={isDark ? "#e2e8f0" : "#1e293b"} />
            {pendingInvitesCount > 0 && (
              <View className="absolute -right-1 -top-1 min-w-5 h-5 rounded-full bg-purple-600 items-center justify-center px-1">
                <Text className="text-white text-xs font-bold">
                  {pendingInvitesCount > 9 ? "9+" : pendingInvitesCount}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() =>
              isDesktop ? setShowJoinDialog(true) : router.push("/pods/join")
            }
            className={`rounded-lg px-3 py-2 ${
              isDark ? "bg-slate-800" : "bg-slate-100"
            }`}
          >
            <Link2 size={20} color={isDark ? "#e2e8f0" : "#1e293b"} />
          </Pressable>
          <Pressable
            onPress={() =>
              isDesktop
                ? setShowCreateDialog(true)
                : router.push("/pods/create")
            }
            className="rounded-lg bg-purple-600 px-3 py-2"
          >
            <Plus size={20} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {loading ? (
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
          renderItem={({ item }) => <PodCard pod={item} isDark={isDark} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
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
