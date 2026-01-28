import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Clock,
  CloudDownload,
  History,
  RotateCcw,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { decksApi, type DeckDetail, type DeckVersion } from "~/lib/api";
import { showToast } from "~/lib/toast";
import { useResponsive } from "~/hooks/useResponsive";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";

export default function VersionsPage() {
  const { id, name: deckNameParam } = useLocalSearchParams<{ id: string; name?: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();

  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [versions, setVersions] = useState<DeckVersion[]>([]);
  const [loading, setLoading] = useState(true);

  // Use param name immediately, fall back to loaded deck name
  const deckName = deck?.name || deckNameParam || "Deck";
  const [reverting, setReverting] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    version: DeckVersion | null;
  }>({
    visible: false,
    version: null,
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [deckResponse, versionsResult] = await Promise.all([
        decksApi.get(id),
        decksApi.getVersions(id),
      ]);
      if (deckResponse.data) {
        setDeck(deckResponse.data);
      }
      if (versionsResult.data) {
        setVersions(versionsResult.data);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRevert = (version: DeckVersion) => {
    setConfirmDialog({
      visible: true,
      version,
    });
  };

  const performRevert = async () => {
    const version = confirmDialog.version;
    if (!version || !id) return;

    setConfirmDialog({ visible: false, version: null });
    setReverting(version.id);
    try {
      const result = await decksApi.revertToVersion(id, version.id);
      if (result.error) {
        showToast.error(result.error);
      } else {
        showToast.success(`Reverted to version ${version.versionNumber}`);
        router.back();
      }
    } catch (err) {
      showToast.error("Failed to revert to version");
    } finally {
      setReverting(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getChangeTypeIcon = (type: DeckVersion["changeType"]) => {
    switch (type) {
      case "sync":
        return <CloudDownload size={16} color="#3b82f6" />;
      case "revert":
        return <RotateCcw size={16} color="#f59e0b" />;
      case "advisor":
        return <History size={16} color="#a855f7" />;
      default:
        return <Clock size={16} color={isDark ? "#64748b" : "#94a3b8"} />;
    }
  };

  const getChangeTypeLabel = (type: DeckVersion["changeType"]) => {
    switch (type) {
      case "sync":
        return "Synced from Archidekt";
      case "revert":
        return "Reverted";
      case "advisor":
        return "AI Advisor changes";
      case "manual":
        return "Manual edit";
      default:
        return type;
    }
  };

  const renderVersion = ({ item, index }: { item: DeckVersion; index: number }) => {
    const isCurrent = index === 0;
    const isReverting = reverting === item.id;

    return (
      <View
        className={`mx-4 lg:mx-6 mb-3 rounded-xl ${
          isCurrent
            ? isDark
              ? "bg-purple-900/30 border border-purple-700"
              : "bg-purple-50 border border-purple-200"
            : isDark
              ? "bg-slate-900"
              : "bg-slate-50"
        }`}
      >
        <View className="flex-row items-center justify-between p-4">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text
                className={`font-bold ${
                  isCurrent
                    ? "text-purple-500"
                    : isDark
                      ? "text-white"
                      : "text-slate-900"
                }`}
              >
                Version {item.versionNumber}
              </Text>
              {isCurrent && (
                <View className="bg-purple-500 px-2 py-0.5 rounded">
                  <Text className="text-white text-xs font-medium">Current</Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center gap-2 mb-1">
              {getChangeTypeIcon(item.changeType)}
              <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {getChangeTypeLabel(item.changeType)}
              </Text>
            </View>
            <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              {formatDate(item.createdAt)} • {item.cardCount} cards
            </Text>
            {item.description && (
              <Text
                className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                numberOfLines={1}
              >
                {item.description}
              </Text>
            )}
          </View>

          {!isCurrent && (
            <Pressable
              onPress={() => handleRevert(item)}
              disabled={isReverting}
              className={`ml-3 px-3 py-2 rounded-lg flex-row items-center gap-2 ${
                isDark ? "bg-slate-800 active:bg-slate-700 lg:hover:bg-slate-700" : "bg-slate-200 active:bg-slate-300 lg:hover:bg-slate-300"
              }`}
            >
              {isReverting ? (
                <ActivityIndicator size="small" color={isDark ? "#94a3b8" : "#64748b"} />
              ) : (
                <>
                  <RotateCcw size={14} color={isDark ? "#94a3b8" : "#64748b"} />
                  <Text className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    Revert
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const pageContent = (
    <>
      {/* Header */}
      <View className={`flex-row items-center justify-between px-4 lg:px-6 py-3 lg:py-4 ${!isDesktop ? "border-b border-slate-200 dark:border-slate-800" : ""}`}>
        <View className="flex-row items-center gap-3 flex-1">
          {/* Mobile: Back arrow */}
          {!isDesktop && (
            <Pressable
              onPress={() => router.back()}
              className={`rounded-full p-2 ${
                isDark ? "active:bg-slate-800" : "active:bg-slate-100"
              }`}
            >
              <ArrowLeft size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          )}
          <View className="flex-1">
            {/* Desktop: Breadcrumb */}
            {isDesktop && (
              <View className="flex-row items-center gap-2 mb-1">
                <Pressable
                  onPress={() => router.push("/(tabs)/decks")}
                  className="hover:underline"
                >
                  <Text className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
                    My Decks
                  </Text>
                </Pressable>
                <Text className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>/</Text>
                <Pressable
                  onPress={() => router.push(`/deck/${id}`)}
                  className="hover:underline"
                >
                  <Text className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`} numberOfLines={1}>
                    {deckName}
                  </Text>
                </Pressable>
                <Text className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>/</Text>
                <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Version History
                </Text>
              </View>
            )}
            <View className="flex-row items-center gap-2">
              <History size={isDesktop ? 28 : 20} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-lg lg:text-2xl font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Version History
              </Text>
            </View>
            <Text
              className={`text-xs lg:text-sm mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              {deckName}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : versions.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <History size={48} color={isDark ? "#334155" : "#cbd5e1"} />
          <Text className={`mt-4 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            No version history yet
          </Text>
          <Text className={`text-sm mt-2 text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            Versions are created when you sync from Archidekt or make changes
          </Text>
        </View>
      ) : (
        <FlatList
          data={versions}
          keyExtractor={(item) => item.id}
          renderItem={renderVersion}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.version && (
        <ConfirmDialog
          visible={confirmDialog.visible}
          title="Revert to Version"
          message={`Revert deck to version ${confirmDialog.version.versionNumber} from ${formatDate(confirmDialog.version.createdAt)}?\n\nThis will replace all current cards with the cards from this version. A backup of the current state will be saved.`}
          confirmText="Revert"
          cancelText="Cancel"
          destructive={true}
          onConfirm={performRevert}
          onCancel={() => setConfirmDialog({ visible: false, version: null })}
        />
      )}
    </>
  );

  // Render with appropriate wrapper based on screen size
  if (isDesktop) {
    return (
      <View className="flex-1 flex-row">
        <DesktopSidebar />
        <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
          {pageContent}
        </View>
      </View>
    );
  }

  // Mobile Layout
  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
      {pageContent}
    </SafeAreaView>
  );
}
