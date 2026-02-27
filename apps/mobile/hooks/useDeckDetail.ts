import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { showToast } from "~/lib/toast";
import {
  authApi,
  decksApi,
  deckRankingApi,
  type DeckDetail,
  type DeckScores,
  type DeckVisibility,
} from "~/lib/api";
import { cache, CACHE_KEYS, CACHE_TTL, cachedFetch } from "~/lib/cache";
import { type ViewMode } from "~/components/deck";
import { useResponsive } from "~/hooks/useResponsive";

export function useDeckDetail(id: string) {
  const { isDesktop, isTablet } = useResponsive();
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    isDesktop || isTablet ? "stacks-cards" : "list",
  );
  const [archidektConnected, setArchidektConnected] = useState(false);
  const [deckScores, setDeckScores] = useState<DeckScores | null>(null);

  const loadDeck = useCallback(
    async (skipCache = false) => {
      if (!id) return;

      try {
        setError(null);

        if (skipCache) {
          await cache.remove(CACHE_KEYS.DECK_DETAIL(id));
        }

        const result = await cachedFetch(
          CACHE_KEYS.DECK_DETAIL(id),
          CACHE_TTL.DECK_DETAIL,
          () => decksApi.get(id),
        );

        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          setDeck(result.data);
        }
      } catch (err) {
        setError("Failed to load deck");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadDeck(true);
  }, [loadDeck]);

  const pollForSyncComplete = useCallback(() => {
    const checkSync = async () => {
      const result = await decksApi.get(id);
      if (result.data) {
        setDeck(result.data);
        if (
          result.data.syncStatus === "synced" ||
          result.data.syncStatus === "error"
        ) {
          setSyncing(false);
          setRefreshing(false);
        } else {
          setTimeout(checkSync, 2000);
        }
      } else {
        setSyncing(false);
      }
    };
    checkSync();
  }, [id]);

  const performSync = useCallback(async () => {
    if (!deck?.archidektId) return;

    setSyncing(true);
    try {
      const result = await decksApi.syncFromArchidekt(deck.archidektId);
      if (result.error) {
        setError(result.error);
      } else {
        await cache.remove(CACHE_KEYS.DECK_DETAIL(id));
        await cache.remove(CACHE_KEYS.DECKS_LIST);
        pollForSyncComplete();
      }
    } catch (err) {
      setError("Failed to sync deck");
      setSyncing(false);
    }
  }, [deck?.archidektId, id, pollForSyncComplete]);

  const handlePullFromArchidekt = useCallback(
    (setMenuVisible: (v: boolean) => void, setConfirmDialog: (v: any) => void) => {
      setMenuVisible(false);

      if (deck?.syncStatus === "synced") {
        setConfirmDialog({
          visible: true,
          title: "Pull from Archidekt",
          message:
            "This will overwrite any local changes you've made to this deck. Are you sure?",
          onConfirm: () => {
            setConfirmDialog((prev: any) => ({ ...prev, visible: false }));
            performSync();
          },
        });
      } else {
        performSync();
      }
    },
    [deck?.syncStatus, performSync],
  );

  const handleDeleteDeck = useCallback(
    (setMenuVisible: (v: boolean) => void, setConfirmDialog: (v: any) => void) => {
      setMenuVisible(false);

      setConfirmDialog({
        visible: true,
        title: "Delete Deck",
        message: `Are you sure you want to delete "${deck?.name}"? This will permanently delete the deck and all its cards, versions, and chat history. This cannot be undone.`,
        destructive: true,
        onConfirm: async () => {
          setConfirmDialog((prev: any) => ({ ...prev, visible: false }));

          try {
            const result = await decksApi.delete(id);
            if (result.error) {
              showToast.error(result.error);
            } else {
              showToast.success("Deck deleted successfully");
              router.back();
            }
          } catch (err) {
            showToast.error("Failed to delete deck");
          }
        },
      });
    },
    [deck?.name, id],
  );

  const handleToggleVisibility = useCallback(async () => {
    if (!deck) return;
    let newVisibility: DeckVisibility;
    if (deck.visibility === "private") {
      newVisibility = "pod";
    } else if (deck.visibility === "pod") {
      newVisibility = "public";
    } else {
      newVisibility = "private";
    }

    const result = await decksApi.updateVisibility(deck.id, newVisibility);
    if (result.error) {
      showToast.error(result.error);
    } else {
      setDeck((prev) => (prev ? { ...prev, visibility: newVisibility } : prev));
      const visibilityLabel =
        newVisibility === "private"
          ? "private"
          : newVisibility === "pod"
            ? "visible to pod members"
            : "public";
      showToast.success(`Deck is now ${visibilityLabel}`);
    }
  }, [deck]);

  const changeViewMode = useCallback((newMode: ViewMode) => {
    setViewMode(newMode);
    cache.set(CACHE_KEYS.VIEW_MODE, newMode, 60 * 24 * 30);
  }, []);

  // Load deck + view mode + scores on mount
  useEffect(() => {
    loadDeck();

    cache.get<ViewMode>(CACHE_KEYS.VIEW_MODE).then((mode) => {
      if (mode) {
        setViewMode(mode);
      } else {
        setViewMode(isDesktop || isTablet ? "stacks-cards" : "list");
      }
    });

    if (id) {
      deckRankingApi
        .getScores(id)
        .then((res) => {
          if (res.data) {
            setDeckScores(res.data.scores);
          }
        })
        .catch(() => {});
    }
  }, [loadDeck, id]);

  // Check Archidekt connection status
  useEffect(() => {
    const checkArchidektConnection = async () => {
      try {
        const result = await authApi.getArchidektStatus();
        if (result.data) {
          setArchidektConnected(
            result.data.connected && result.data.tokenValid,
          );
        }
      } catch (err) {
        console.error("Failed to check Archidekt status:", err);
      }
    };
    checkArchidektConnection();
  }, []);

  return {
    deck,
    setDeck,
    loading,
    refreshing,
    syncing,
    error,
    viewMode,
    archidektConnected,
    deckScores,
    loadDeck,
    handleRefresh,
    performSync,
    handlePullFromArchidekt,
    handleDeleteDeck,
    handleToggleVisibility,
    changeViewMode,
  };
}
