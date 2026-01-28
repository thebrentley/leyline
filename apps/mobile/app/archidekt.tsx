import { router } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ExternalLink,
  Link2Off,
  RefreshCw,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Spinner } from "~/components/Spinner";
import { Button } from "~/components/ui/button";
import { authApi, decksApi, type ArchidektDeck, type ArchidektStatus } from "~/lib/api";
import { cache, CACHE_KEYS, cachedFetch } from "~/lib/cache";
import { useAuth } from "~/contexts/AuthContext";
import { showToast } from "~/lib/toast";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";

export default function ArchidektScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user, refreshUser } = useAuth();

  const [status, setStatus] = useState<ArchidektStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [archidektDecks, setArchidektDecks] = useState<ArchidektDeck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);

  // Connect form state
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const result = await cachedFetch(
        CACHE_KEYS.ARCHIDEKT_STATUS,
        1, // 1 minute TTL
        () => authApi.getArchidektStatus()
      );
      if (result.data) {
        setStatus(result.data);
      }
    } catch (err) {
      console.error("Failed to load Archidekt status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadArchidektDecks = useCallback(async () => {
    setLoadingDecks(true);
    try {
      const result = await decksApi.listArchidektDecks();
      if (result.data) {
        setArchidektDecks(result.data);
      }
    } catch (err) {
      console.error("Failed to load Archidekt decks:", err);
    } finally {
      setLoadingDecks(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (status?.connected && status?.tokenValid) {
      loadArchidektDecks();
    }
  }, [status?.connected, status?.tokenValid, loadArchidektDecks]);

  const handleConnect = async () => {
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
        await loadStatus();
        await refreshUser();
        setShowConnectForm(false);
        setUsername("");
        setPassword("");
      }
    } catch (err) {
      setConnectError("Connection failed. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setConfirmDisconnect(true);
  };

  const confirmDisconnectHandler = async () => {
    setConfirmDisconnect(false);
    const result = await authApi.disconnectArchidekt();
    if (!result.error) {
      await cache.remove(CACHE_KEYS.ARCHIDEKT_STATUS);
      await loadStatus();
      await refreshUser();
      setArchidektDecks([]);
      showToast.success("Archidekt disconnected");
    } else {
      showToast.error(result.error);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const result = await decksApi.syncAllFromArchidekt();
      if (result.data) {
        showToast.success(`${result.data.queued} decks queued for sync. Check the Decks screen to see progress.`);
        await cache.invalidatePrefix("decks:");
        // Navigate to decks screen to see progress
        router.push("/(tabs)/decks");
      } else if (result.error) {
        showToast.error(result.error);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncDeck = async (archidektId: number, name: string) => {
    try {
      const result = await decksApi.syncFromArchidekt(archidektId);
      if (result.data) {
        showToast.success(`"${name}" has been queued for sync. View the Decks screen to see progress.`);
        await cache.invalidatePrefix("decks:");
      } else if (result.error) {
        showToast.error(result.error);
      }
    } catch {
      showToast.error("Failed to queue deck for sync");
    }
  };

  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <Pressable
          onPress={() => router.back()}
          className={`rounded-full p-2 ${
            isDark ? "active:bg-slate-800" : "active:bg-slate-100"
          }`}
        >
          <ArrowLeft size={24} color={isDark ? "#94a3b8" : "#64748b"} />
        </Pressable>
        <Text
          className={`text-xl font-bold ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          Archidekt
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <View className="flex-1 px-6 py-4">
          {/* Connection Status */}
          <View
            className={`rounded-xl p-4 mb-6 ${
              isDark ? "bg-slate-900" : "bg-slate-50"
            }`}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Connection Status
              </Text>
              <View
                className={`flex-row items-center gap-1.5 px-2 py-1 rounded-full ${
                  status?.connected && status?.tokenValid
                    ? "bg-purple-500/10"
                    : status?.connected
                      ? "bg-amber-500/10"
                      : "bg-slate-500/10"
                }`}
              >
                {status?.connected && status?.tokenValid ? (
                  <Check size={14} color="#7C3AED" />
                ) : status?.connected ? (
                  <AlertCircle size={14} color="#f59e0b" />
                ) : null}
                <Text
                  className={`text-xs font-medium ${
                    status?.connected && status?.tokenValid
                      ? "text-purple-500"
                      : status?.connected
                        ? "text-amber-500"
                        : isDark
                          ? "text-slate-400"
                          : "text-slate-500"
                  }`}
                >
                  {status?.connected && status?.tokenValid
                    ? "Connected"
                    : status?.connected
                      ? "Token Expired"
                      : "Not Connected"}
                </Text>
              </View>
            </View>

            {status?.connected && (
              <View className="gap-1">
                <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
                  Username: @{status.username}
                </Text>
                {status.connectedAt && (
                  <Text
                    className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
                  >
                    Connected {new Date(status.connectedAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
            )}

            {/* Actions */}
            <View className="flex-row gap-2 mt-4">
              {!status?.connected ? (
                <Button
                  onPress={() => setShowConnectForm(true)}
                  className="flex-1"
                >
                  <Text className="font-medium text-white">Connect Account</Text>
                </Button>
              ) : !status?.tokenValid ? (
                <Button
                  onPress={() => setShowConnectForm(true)}
                  className="flex-1"
                >
                  <Text className="font-medium text-white">Reconnect</Text>
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onPress={handleDisconnect}
                    className="flex-1"
                  >
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
                </>
              )}
            </View>
          </View>

          {/* Connect Form */}
          {showConnectForm && (
            <View
              className={`rounded-xl p-4 mb-6 ${
                isDark ? "bg-slate-900" : "bg-slate-50"
              }`}
            >
              <Text
                className={`text-lg font-semibold mb-4 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Connect Archidekt
              </Text>

              {connectError && (
                <View className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                  <Text className="text-red-500 text-sm">{connectError}</Text>
                </View>
              )}

              <View className="gap-3">
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

                <View className="flex-row gap-2 mt-2">
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setShowConnectForm(false);
                      setConnectError(null);
                    }}
                    className="flex-1"
                  >
                    <Text
                      className={`font-medium ${
                        isDark ? "text-slate-200" : "text-slate-700"
                      }`}
                    >
                      Cancel
                    </Text>
                  </Button>
                  <Button
                    onPress={handleConnect}
                    disabled={connecting}
                    className="flex-1"
                  >
                    {connecting ? (
                      <Spinner size={18} strokeWidth={2} color="white" backgroundColor="rgba(255,255,255,0.2)" />
                    ) : (
                      <Text className="font-medium text-white">Connect</Text>
                    )}
                  </Button>
                </View>
              </View>
            </View>
          )}

          {/* Decks Section */}
          {status?.connected && status?.tokenValid && (
            <View>
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  className={`text-lg font-semibold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Your Decks
                </Text>
                <Button
                  size="sm"
                  onPress={handleSyncAll}
                  disabled={syncing || loadingDecks}
                >
                  <View className="flex-row items-center gap-1.5">
                    {syncing ? (
                      <Spinner size={14} strokeWidth={2} color="white" backgroundColor="rgba(255,255,255,0.2)" />
                    ) : (
                      <RefreshCw size={14} color="white" />
                    )}
                    <Text className="font-medium text-white">
                      {syncing ? "Syncing..." : "Sync All"}
                    </Text>
                  </View>
                </Button>
              </View>

              {loadingDecks ? (
                <View className="py-8 items-center">
                  <Spinner size={24} strokeWidth={2} color="#7C3AED" backgroundColor="rgba(16,185,129,0.2)" />
                </View>
              ) : archidektDecks.length === 0 ? (
                <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
                  No decks found on Archidekt
                </Text>
              ) : (
                <View className="gap-2">
                  {archidektDecks.slice(0, 10).map((deck) => (
                    <Pressable
                      key={deck.archidektId}
                      onPress={() => handleSyncDeck(deck.archidektId, deck.name)}
                      className={`flex-row items-center justify-between rounded-lg border p-3 ${
                        isDark
                          ? "border-slate-800 bg-slate-900 active:bg-slate-800"
                          : "border-slate-200 bg-white active:bg-slate-50"
                      }`}
                    >
                      <View className="flex-1">
                        <Text
                          className={`font-medium ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                          numberOfLines={1}
                        >
                          {deck.name}
                        </Text>
                        {deck.format && (
                          <Text
                            className={`text-xs ${
                              isDark ? "text-slate-500" : "text-slate-400"
                            }`}
                          >
                            {deck.format}
                          </Text>
                        )}
                      </View>
                      <RefreshCw size={16} color="#7C3AED" />
                    </Pressable>
                  ))}
                  {archidektDecks.length > 10 && (
                    <Text
                      className={`text-center text-sm ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      +{archidektDecks.length - 10} more decks
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Help Link */}
          <Pressable
            onPress={() => Linking.openURL("https://archidekt.com")}
            className="flex-row items-center justify-center gap-2 mt-auto py-4"
          >
            <ExternalLink size={16} color={isDark ? "#64748b" : "#94a3b8"} />
            <Text className={isDark ? "text-slate-500" : "text-slate-400"}>
              Visit Archidekt.com
            </Text>
          </Pressable>
        </View>
      )}

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
