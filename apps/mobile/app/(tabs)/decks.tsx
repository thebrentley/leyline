import { DrawerActions, useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import {
  AlertCircle,
  CheckCircle,
  CloudDownload,
  Crown,
  Layers,
  Loader2,
  Menu,
  RefreshCw,
  Trash2,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CircularProgress } from "~/components/CircularProgress";
import { Button } from "~/components/ui/button";
import { useSocket } from "~/contexts/SocketContext";
import { decksApi, type DeckSummary, type DeckSyncStatus } from "~/lib/api";
import { cache, CACHE_KEYS, CACHE_TTL, cachedFetch } from "~/lib/cache";
import { showToast } from "~/lib/toast";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";

// Color identity colors
const MANA_COLORS: Record<string, string> = {
  W: "#F9FAF4",
  U: "#0E68AB",
  B: "#150B00",
  R: "#D3202A",
  G: "#00733E",
};

function SyncStatusBadge({ 
  status, 
  isDark, 
  progress 
}: { 
  status: DeckSyncStatus; 
  isDark: boolean; 
  progress?: number;
}) {
  if (status === 'synced') {
    return (
      <View className="flex-row items-center gap-1">
        <CheckCircle size={14} color="#10b981" />
      </View>
    );
  }
  
  // Show circular progress for pending (queued) and syncing (active)
  if (status === 'syncing' || status === 'pending') {
    return (
      <View className="flex-row items-center gap-1">
        <CircularProgress
          size={16}
          strokeWidth={2}
          progress={progress}
          color={status === 'syncing' ? "#f59e0b" : "#94a3b8"}
          backgroundColor={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}
        />
      </View>
    );
  }
  
  if (status === 'error') {
    return (
      <View className="flex-row items-center gap-1">
        <AlertCircle size={14} color="#ef4444" />
      </View>
    );
  }
  
  // Not synced yet (null) - show cloud download icon to indicate cards need syncing
  return (
    <View className="flex-row items-center gap-1">
      <CloudDownload size={14} color={isDark ? "#64748b" : "#94a3b8"} />
    </View>
  );
}

function ColorIdentityPills({ colors, isDark }: { colors: string[]; isDark: boolean }) {
  if (colors.length === 0) {
    return (
      <View
        className="h-4 w-4 rounded-full border"
        style={{
          backgroundColor: "#888",
          borderColor: isDark ? "#475569" : "#cbd5e1",
        }}
      />
    );
  }

  return (
    <View className="flex-row gap-1">
      {colors.map((color) => (
        <View
          key={color}
          className="h-4 w-4 rounded-full border"
          style={{
            backgroundColor: MANA_COLORS[color] || "#888",
            borderColor: isDark ? "#475569" : "#cbd5e1",
          }}
        />
      ))}
    </View>
  );
}

function DeckGridItem({
  deck,
  isDark,
  onPress,
  onLongPress,
  progress,
}: {
  deck: DeckSummary;
  isDark: boolean;
  onPress: () => void;
  onLongPress: () => void;
  progress?: number;
}) {
  const primaryCommander = deck.commanders[0];
  
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      className="mb-3 flex-1 rounded-xl overflow-hidden"
      style={{ marginHorizontal: 4, height: 160 }}
    >
      {/* Full card background image */}
      <View className="absolute inset-0">
        {deck.commanderImage ? (
          <Image
            source={{ uri: deck.commanderImage }}
            style={{ 
              width: '100%',
              height: '100%',
              resizeMode: 'cover',
            }}
          />
        ) : (
          <View
            className={`w-full h-full items-center justify-center ${
              isDark ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            <Layers size={40} color={isDark ? "#64748b" : "#94a3b8"} />
          </View>
        )}
      </View>
      
      {/* Sync status badge in top-right corner */}
      <View className="absolute top-2 right-2">
        <SyncStatusBadge status={deck.syncStatus} isDark={isDark} progress={progress} />
      </View>
      
      {/* Bottom overlay with deck info */}
      <View 
        className="absolute bottom-0 left-0 right-0 p-2.5"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
        }}
      >
        {/* Commander name */}
        {primaryCommander && (
          <View className="flex-row items-center gap-1 mb-1">
            <Crown size={10} color="#eab308" />
            <Text
              className="text-xs text-white/70"
              numberOfLines={1}
            >
              {primaryCommander}
            </Text>
          </View>
        )}
        
        {/* Deck name */}
        <Text
          className="text-sm font-semibold text-white"
          numberOfLines={2}
        >
          {deck.name}
        </Text>
        
        {/* Color identity and card count */}
        <View className="mt-1.5 flex-row items-center gap-1">
          <ColorIdentityPills colors={deck.colors} isDark={true} />
          <Text className="ml-1 text-xs text-white/60">
            {deck.cardCount} cards
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function DecksScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const navigation = useNavigation();
  const { onDeckSyncStatus } = useSocket();

  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<Record<string, number>>({});
  const [confirmDelete, setConfirmDelete] = useState<{
    visible: boolean;
    deck: DeckSummary | null;
  }>({ visible: false, deck: null });

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  // Listen for real-time deck sync status updates
  useEffect(() => {
    const unsubscribe = onDeckSyncStatus((event) => {
      // Update deck status
      setDecks((prev) =>
        prev.map((deck) =>
          deck.id === event.deckId
            ? { ...deck, syncStatus: event.status, syncError: event.error || null }
            : deck
        )
      );

      // Update progress
      if (event.progress !== undefined) {
        setSyncProgress((prev) => ({
          ...prev,
          [event.deckId]: event.progress!,
        }));
      }

      // If a deck just finished syncing, reload to get fresh data and clear progress
      if (event.status === "synced" || event.status === "error") {
        cache.remove(CACHE_KEYS.DECKS_LIST);
        cache.remove(CACHE_KEYS.DECK_DETAIL(event.deckId));
        // Clear progress after a short delay to show 100%
        setTimeout(() => {
          setSyncProgress((prev) => {
            const next = { ...prev };
            delete next[event.deckId];
            return next;
          });
        }, 500);
      }
    });

    return unsubscribe;
  }, [onDeckSyncStatus]);

  const loadDecks = useCallback(async (skipCache = false) => {
    try {
      setError(null);
      
      if (skipCache) {
        await cache.remove(CACHE_KEYS.DECKS_LIST);
      }

      const result = await cachedFetch(
        CACHE_KEYS.DECKS_LIST,
        CACHE_TTL.DECKS_LIST,
        () => decksApi.list()
      );

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setDecks(result.data);
      }
    } catch (err) {
      setError("Failed to load decks");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadDecks(true);
  }, [loadDecks]);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const result = await decksApi.syncAllFromArchidekt();
      if (result.data) {
        // Refresh to show new decks (metadata only, no cards synced)
        await loadDecks(true);
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeckPress = (deckId: string) => {
    router.push(`/deck/${deckId}`);
  };

  const handleDeleteDeck = useCallback((deck: DeckSummary) => {
    setConfirmDelete({ visible: true, deck });
  }, []);

  const confirmDeleteDeck = async () => {
    const deck = confirmDelete.deck;
    setConfirmDelete({ visible: false, deck: null });

    if (!deck) return;

    try {
      const result = await decksApi.delete(deck.id);
      if (result.error) {
        showToast.error(result.error);
      } else {
        // Remove from local state
        setDecks((prev) => prev.filter((d) => d.id !== deck.id));
        // Clear cache
        await cache.remove(CACHE_KEYS.DECKS_LIST);
        showToast.success("Deck deleted successfully");
      }
    } catch (err) {
      showToast.error("Failed to delete deck");
    }
  };

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  // Reset syncing state when no decks are pending or actively syncing
  useEffect(() => {
    const hasSyncingDecks = decks.some(
      (d) => d.syncStatus === 'syncing' || d.syncStatus === 'pending'
    );
    if (!hasSyncingDecks) {
      setSyncing(false);
    }
  }, [decks]);


  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center">
      <View
        className={`mb-4 h-20 w-20 items-center justify-center rounded-full ${
          isDark ? "bg-slate-800" : "bg-slate-100"
        }`}
      >
        <Layers size={40} color={isDark ? "#64748b" : "#94a3b8"} />
      </View>
      <Text
        className={`mb-2 text-xl font-semibold ${
          isDark ? "text-white" : "text-slate-900"
        }`}
      >
        No Decks Yet
      </Text>
      <Text
        className={`mb-6 text-center px-8 ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}
      >
        Connect your Archidekt account and fetch your decks to get started
      </Text>
      <Button onPress={handleSyncAll} disabled={syncing}>
        <View className="flex-row items-center gap-2">
          {syncing ? (
            <CircularProgress size={16} strokeWidth={2} color="white" backgroundColor="rgba(255,255,255,0.2)" />
          ) : (
            <RefreshCw size={16} color="white" />
          )}
          <Text className="font-medium text-white">
            {syncing ? "Fetching..." : "Fetch Decks from Archidekt"}
          </Text>
        </View>
      </Button>
    </View>
  );

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
    >
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={openDrawer}
              className={`-ml-2 rounded-full p-2 ${
                isDark ? "active:bg-slate-800" : "active:bg-slate-100"
              }`}
            >
              <Menu size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
            <Text
              className={`text-2xl font-bold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              My Decks
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={handleSyncAll}
              disabled={syncing}
              className={`rounded-full p-2 ${
                isDark ? "active:bg-slate-800" : "active:bg-slate-100"
              }`}
            >
              {syncing ? (
                <CircularProgress size={20} strokeWidth={2} color="#10b981" backgroundColor={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} />
              ) : (
                <RefreshCw size={20} color="#10b981" />
              )}
            </Pressable>
          </View>
        </View>

        {/* Content */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text
              className={`mb-4 text-center ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {error}
            </Text>
            <Button onPress={() => loadDecks(true)}>
              <Text className="font-medium text-white">Retry</Text>
            </Button>
          </View>
        ) : decks.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={decks}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#10b981"
              />
            }
            renderItem={({ item }) => (
              <DeckGridItem
                deck={item}
                isDark={isDark}
                onPress={() => handleDeckPress(item.id)}
                onLongPress={() => handleDeleteDeck(item)}
                progress={syncProgress[item.id]}
              />
            )}
          />
        )}
      </View>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={confirmDelete.visible}
        title="Delete Deck"
        message={`Are you sure you want to delete "${confirmDelete.deck?.name}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        onConfirm={confirmDeleteDeck}
        onCancel={() => setConfirmDelete({ visible: false, deck: null })}
      />
    </SafeAreaView>
  );
}
