import { DrawerActions, useNavigation } from "@react-navigation/native";
import {
  AlertCircle,
  Check,
  ChevronRight,
  ExternalLink,
  Link2Off,
  Menu,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Spinner } from "~/components/Spinner";
import { Button } from "~/components/ui/button";
import { authApi, type ArchidektStatus } from "~/lib/api";
import { cache, CACHE_KEYS, cachedFetch } from "~/lib/cache";
import { useAuth } from "~/contexts/AuthContext";
import { showToast } from "~/lib/toast";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { useResponsive } from "~/hooks/useResponsive";

interface ConnectionCardProps {
  name: string;
  description: string;
  logo: React.ReactNode;
  status: "connected" | "disconnected" | "error";
  statusText?: string;
  onPress: () => void;
  isDark: boolean;
}

function ConnectionCard({
  name,
  description,
  logo,
  status,
  statusText,
  onPress,
  isDark,
}: ConnectionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-xl border p-4 ${
        isDark
          ? "border-slate-800 bg-slate-900 active:bg-slate-800"
          : "border-slate-200 bg-white active:bg-slate-50"
      }`}
    >
      <View className="flex-row items-center gap-4">
        {/* Logo */}
        <View
          className={`h-14 w-14 items-center justify-center rounded-xl ${
            isDark ? "bg-slate-800" : "bg-slate-100"
          }`}
        >
          {logo}
        </View>

        {/* Content */}
        <View className="flex-1">
          <Text
            className={`text-lg font-semibold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {name}
          </Text>
          <Text
            className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            {description}
          </Text>
        </View>

        {/* Status & Arrow */}
        <View className="flex-row items-center gap-2">
          <View
            className={`flex-row items-center gap-1.5 px-2 py-1 rounded-full ${
              status === "connected"
                ? "bg-purple-500/10"
                : status === "error"
                  ? "bg-amber-500/10"
                  : "bg-slate-500/10"
            }`}
          >
            {status === "connected" ? (
              <Check size={12} color="#7C3AED" />
            ) : status === "error" ? (
              <AlertCircle size={12} color="#f59e0b" />
            ) : null}
            <Text
              className={`text-xs font-medium ${
                status === "connected"
                  ? "text-purple-500"
                  : status === "error"
                    ? "text-amber-500"
                    : isDark
                      ? "text-slate-400"
                      : "text-slate-500"
              }`}
            >
              {statusText ||
                (status === "connected"
                  ? "Connected"
                  : status === "error"
                    ? "Error"
                    : "Not connected")}
            </Text>
          </View>
          <ChevronRight size={20} color={isDark ? "#475569" : "#cbd5e1"} />
        </View>
      </View>
    </Pressable>
  );
}

export default function ConnectionsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { refreshUser } = useAuth();
  const { isDesktop } = useResponsive();
  const navigation = useNavigation();

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const [archidektStatus, setArchidektStatus] = useState<ArchidektStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Modal and form state
  const [showArchidektModal, setShowArchidektModal] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const loadArchidektStatus = useCallback(async () => {
    try {
      const result = await cachedFetch(
        CACHE_KEYS.ARCHIDEKT_STATUS,
        1, // 1 minute TTL
        () => authApi.getArchidektStatus()
      );
      if (result.data) {
        setArchidektStatus(result.data);
      }
    } catch (err) {
      console.error("Failed to load Archidekt status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArchidektStatus();
  }, [loadArchidektStatus]);

  const handleArchidektConnect = async () => {
    if (!username.trim() || !password.trim()) {
      setConnectError("Please enter your Archidekt username and password");
      return;
    }

    setConnecting(true);
    setConnectError(null);

    try {
      const result = await authApi.connectArchidekt(username, password);
      if (result.error) {
        setConnectError(result.error);
      } else {
        // Success - refresh status and user
        await cache.remove(CACHE_KEYS.ARCHIDEKT_STATUS);
        await loadArchidektStatus();
        await refreshUser();
        setShowArchidektModal(false);
        setUsername("");
        setPassword("");
        showToast.success("Archidekt connected successfully!");
      }
    } catch (err) {
      setConnectError("Connection failed. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleArchidektDisconnect = () => {
    setConfirmDisconnect(true);
  };

  const confirmDisconnectHandler = async () => {
    setConfirmDisconnect(false);
    const result = await authApi.disconnectArchidekt();
    if (!result.error) {
      await cache.remove(CACHE_KEYS.ARCHIDEKT_STATUS);
      await loadArchidektStatus();
      await refreshUser();
      setShowArchidektModal(false);
      showToast.success("Archidekt disconnected");
    } else {
      showToast.error(result.error);
    }
  };

  const getArchidektConnectionStatus = (): "connected" | "disconnected" | "error" => {
    if (!archidektStatus?.connected) return "disconnected";
    if (!archidektStatus?.tokenValid) return "error";
    return "connected";
  };

  const getArchidektStatusText = (): string | undefined => {
    if (!archidektStatus?.connected) return undefined;
    if (!archidektStatus?.tokenValid) return "Token Expired";
    return archidektStatus.username ? `@${archidektStatus.username}` : "Connected";
  };

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
      edges={isDesktop ? [] : ["top"]}
    >
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3">
        {!isDesktop && (
          <Pressable
            onPress={openDrawer}
            className={`-ml-2 rounded-full p-2 ${
              isDark ? "active:bg-slate-800" : "active:bg-slate-100"
            }`}
          >
            <Menu size={24} color={isDark ? "#94a3b8" : "#64748b"} />
          </Pressable>
        )}
        <Text
          className={`text-xl font-bold ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          Connections
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 py-4">
          {/* Intro Text */}
          <Text
            className={`mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            Connect external services to sync your decks and data.
          </Text>

          {/* Connection Cards */}
          <View className="gap-3">
            <ConnectionCard
              name="Archidekt"
              description="Sync your deck collection from Archidekt"
              logo={
                <Text className="text-2xl font-bold text-purple-500">A</Text>
              }
              status={getArchidektConnectionStatus()}
              statusText={getArchidektStatusText()}
              onPress={() => setShowArchidektModal(true)}
              isDark={isDark}
            />

            {/* Future connections placeholder */}
            {/* <ConnectionCard
              name="Moxfield"
              description="Coming soon"
              logo={<Text className="text-2xl font-bold text-blue-500">M</Text>}
              status="disconnected"
              onPress={() => {}}
              isDark={isDark}
            /> */}
          </View>

        </ScrollView>
      )}

      {/* Archidekt Modal */}
      <Modal
        visible={showArchidektModal}
        animationType={isDesktop ? "fade" : "slide"}
        presentationStyle={isDesktop ? "overFullScreen" : "pageSheet"}
        transparent={isDesktop}
        onRequestClose={() => setShowArchidektModal(false)}
      >
        {isDesktop ? (
          // Web: Centered modal with backdrop
          <Pressable
            className="flex-1 items-center justify-center bg-black/50"
            onPress={() => setShowArchidektModal(false)}
          >
            <Pressable
              className={`w-full max-w-md rounded-xl ${
                isDark ? "bg-slate-900" : "bg-white"
              }`}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <View
                className={`flex-row items-center justify-between px-5 py-4 border-b ${
                  isDark ? "border-slate-800" : "border-slate-200"
                }`}
              >
                <Text
                  className={`text-lg font-semibold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Archidekt
                </Text>
                <Pressable
                  onPress={() => setShowArchidektModal(false)}
                  className={`rounded-full px-3 py-1.5 ${
                    isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                  }`}
                >
                  <Text className="text-purple-500 font-medium">Done</Text>
                </Pressable>
              </View>

              <View className="px-5 py-5">
                {/* Status */}
                {archidektStatus?.connected && (
                  <View
                    className={`rounded-xl p-4 mb-4 ${
                      isDark ? "bg-slate-800" : "bg-slate-50"
                    }`}
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className={isDark ? "text-slate-300" : "text-slate-700"}>
                        Status
                      </Text>
                      <View
                        className={`flex-row items-center gap-1.5 px-2 py-1 rounded-full ${
                          archidektStatus.tokenValid
                            ? "bg-purple-500/10"
                            : "bg-amber-500/10"
                        }`}
                      >
                        {archidektStatus.tokenValid ? (
                          <Check size={12} color="#7C3AED" />
                        ) : (
                          <AlertCircle size={12} color="#f59e0b" />
                        )}
                        <Text
                          className={`text-xs font-medium ${
                            archidektStatus.tokenValid
                              ? "text-purple-500"
                              : "text-amber-500"
                          }`}
                        >
                          {archidektStatus.tokenValid ? "Connected" : "Token Expired"}
                        </Text>
                      </View>
                    </View>
                    <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
                      Username: @{archidektStatus.username}
                    </Text>
                    {archidektStatus.connectedAt && (
                      <Text
                        className={`text-xs mt-1 ${
                          isDark ? "text-slate-500" : "text-slate-400"
                        }`}
                      >
                        Connected{" "}
                        {new Date(archidektStatus.connectedAt).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                )}

                {/* Connect Form (show if not connected or token expired) */}
                {(!archidektStatus?.connected || !archidektStatus?.tokenValid) && (
                  <View className="gap-3 mb-4">
                    {connectError && (
                      <View className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                        <Text className="text-red-500 text-sm">{connectError}</Text>
                      </View>
                    )}

                    <TextInput
                      value={username}
                      onChangeText={setUsername}
                      placeholder="Email or username"
                      placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                      autoCapitalize="none"
                      autoCorrect={false}
                      className={`rounded-lg border px-4 py-3 text-base ${
                        isDark
                          ? "border-slate-700 bg-slate-800 text-white"
                          : "border-slate-200 bg-white text-slate-900"
                      }`}
                    />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Password"
                      placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                      secureTextEntry
                      className={`rounded-lg border px-4 py-3 text-base ${
                        isDark
                          ? "border-slate-700 bg-slate-800 text-white"
                          : "border-slate-200 bg-white text-slate-900"
                      }`}
                    />

                    <Button onPress={handleArchidektConnect} disabled={connecting}>
                      {connecting ? (
                        <Spinner
                          size={18}
                          strokeWidth={2}
                          color="white"
                          backgroundColor="rgba(255,255,255,0.2)"
                        />
                      ) : (
                        <Text className="font-medium text-white">
                          {archidektStatus?.connected ? "Reconnect" : "Connect"}
                        </Text>
                      )}
                    </Button>
                  </View>
                )}

                {/* Disconnect Button for connected accounts */}
                {archidektStatus?.connected && archidektStatus?.tokenValid && (
                  <Button variant="secondary" onPress={handleArchidektDisconnect}>
                    <View className="flex-row items-center gap-2">
                      <Link2Off size={16} color={isDark ? "#e2e8f0" : "#475569"} />
                      <Text
                        className={`font-medium ${
                          isDark ? "text-slate-200" : "text-slate-700"
                        }`}
                      >
                        Disconnect
                      </Text>
                    </View>
                  </Button>
                )}

                {/* Help Link */}
                <Pressable
                  onPress={() => Linking.openURL("https://archidekt.com")}
                  className="flex-row items-center justify-center gap-2 mt-6"
                >
                  <ExternalLink size={14} color={isDark ? "#64748b" : "#94a3b8"} />
                  <Text className={isDark ? "text-slate-500" : "text-slate-400"}>
                    Visit Archidekt.com
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        ) : (
          // Mobile: Slide-up sheet
          <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
            {/* Modal Header */}
            <View
              className={`flex-row items-center justify-between px-4 py-4 border-b ${
                isDark ? "border-slate-800" : "border-slate-200"
              }`}
            >
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Archidekt
              </Text>
              <Pressable
                onPress={() => setShowArchidektModal(false)}
                className={`rounded-full px-3 py-1.5 ${
                  isDark ? "active:bg-slate-800" : "active:bg-slate-100"
                }`}
              >
                <Text className="text-purple-500 font-medium">Done</Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-4 py-4">
              {/* Status */}
              {archidektStatus?.connected && (
                <View
                  className={`rounded-xl p-4 mb-4 ${
                    isDark ? "bg-slate-900" : "bg-slate-50"
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className={isDark ? "text-slate-300" : "text-slate-700"}>
                      Status
                    </Text>
                    <View
                      className={`flex-row items-center gap-1.5 px-2 py-1 rounded-full ${
                        archidektStatus.tokenValid
                          ? "bg-purple-500/10"
                          : "bg-amber-500/10"
                      }`}
                    >
                      {archidektStatus.tokenValid ? (
                        <Check size={12} color="#7C3AED" />
                      ) : (
                        <AlertCircle size={12} color="#f59e0b" />
                      )}
                      <Text
                        className={`text-xs font-medium ${
                          archidektStatus.tokenValid
                            ? "text-purple-500"
                            : "text-amber-500"
                        }`}
                      >
                        {archidektStatus.tokenValid ? "Connected" : "Token Expired"}
                      </Text>
                    </View>
                  </View>
                  <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
                    Username: @{archidektStatus.username}
                  </Text>
                  {archidektStatus.connectedAt && (
                    <Text
                      className={`text-xs mt-1 ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      Connected{" "}
                      {new Date(archidektStatus.connectedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              )}

              {/* Connect Form (show if not connected or token expired) */}
              {(!archidektStatus?.connected || !archidektStatus?.tokenValid) && (
                <View className="gap-3 mb-4">
                  {connectError && (
                    <View className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <Text className="text-red-500 text-sm">{connectError}</Text>
                    </View>
                  )}

                  <TextInput
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Email or username"
                    placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className={`rounded-lg border px-4 py-3 text-base ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-white"
                        : "border-slate-200 bg-white text-slate-900"
                    }`}
                  />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                    secureTextEntry
                    className={`rounded-lg border px-4 py-3 text-base ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-white"
                        : "border-slate-200 bg-white text-slate-900"
                    }`}
                  />

                  <Button onPress={handleArchidektConnect} disabled={connecting}>
                    {connecting ? (
                      <Spinner
                        size={18}
                        strokeWidth={2}
                        color="white"
                        backgroundColor="rgba(255,255,255,0.2)"
                      />
                    ) : (
                      <Text className="font-medium text-white">
                        {archidektStatus?.connected ? "Reconnect" : "Connect"}
                      </Text>
                    )}
                  </Button>
                </View>
              )}

              {/* Disconnect Button for connected accounts */}
              {archidektStatus?.connected && archidektStatus?.tokenValid && (
                <Button variant="secondary" onPress={handleArchidektDisconnect}>
                  <View className="flex-row items-center gap-2">
                    <Link2Off size={16} color={isDark ? "#e2e8f0" : "#475569"} />
                    <Text
                      className={`font-medium ${
                        isDark ? "text-slate-200" : "text-slate-700"
                      }`}
                    >
                      Disconnect
                    </Text>
                  </View>
                </Button>
              )}

              {/* Help Link */}
              <Pressable
                onPress={() => Linking.openURL("https://archidekt.com")}
                className="flex-row items-center justify-center gap-2 mt-6"
              >
                <ExternalLink size={14} color={isDark ? "#64748b" : "#94a3b8"} />
                <Text className={isDark ? "text-slate-500" : "text-slate-400"}>
                  Visit Archidekt.com
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Disconnect Confirmation Dialog */}
      <ConfirmDialog
        visible={confirmDisconnect}
        title="Disconnect Archidekt"
        message="Are you sure you want to disconnect your Archidekt account? Your synced decks will remain but won't be updated."
        confirmText="Disconnect"
        cancelText="Cancel"
        destructive
        onConfirm={confirmDisconnectHandler}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </SafeAreaView>
  );
}
