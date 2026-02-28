import { GlassView } from "expo-glass-effect";
import {
  Camera as CameraIcon,
  Download,
  Layers,
  Pause,
  Play,
  Trash2,
  X,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { cardsApi, collectionApi } from "~/lib/api";
import { cache, CACHE_KEYS } from "~/lib/cache";
import { ImportSettings, type ImportSettingsValue } from "~/components/ui/ImportSettings";
import { recognizeCard } from "~/lib/ocr";
import { showToast } from "~/lib/toast";
import { toastConfig } from "~/lib/toast-config";
import type { ScannedCard } from "~/hooks/useCamera";
import { CameraPermissionRequest } from "./CameraPermissionRequest";

// Check if we're running in Expo Go
const isExpoGo = Constants.appOwnership === "expo";

const BATCH_STORAGE_KEY = "cardscanner:batchCards";

interface CardScannerProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function CardScanner({
  visible,
  onClose,
  onComplete,
}: CardScannerProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const isProcessingRef = useRef(false);

  // Batch scanning state
  const [batchCards, setBatchCards] = useState<ScannedCard[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [addingProgress, setAddingProgress] = useState({
    current: 0,
    total: 0,
  });

  // Dedup: skip if same card matched consecutively
  const lastMatchRef = useRef<string | null>(null);

  // Sound for card match
  const matchSound = useAudioPlayer(require("~/assets/sounds/card-match.wav"));

  // Pause/play scanning
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  // Batch list overlay
  const [batchListVisible, setBatchListVisible] = useState(false);
  const batchListClosingRef = useRef(false);

  // Import settings (folder destination)
  const [importSettings, setImportSettings] = useState<ImportSettingsValue>({
    folderId: null,
    autoLink: true,
    deckId: null,
    overrideSet: false,
    addMissing: false,
  });

  // Restore persisted batch cards on open
  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(BATCH_STORAGE_KEY).then((json) => {
      if (json) {
        try {
          const saved = JSON.parse(json) as ScannedCard[];
          if (saved.length > 0) setBatchCards(saved);
        } catch {}
      }
    });
  }, [visible]);

  // Persist batch cards whenever they change
  useEffect(() => {
    if (batchCards.length > 0) {
      AsyncStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batchCards));
    } else {
      AsyncStorage.removeItem(BATCH_STORAGE_KEY);
    }
  }, [batchCards]);

  // Auto-scan: capture a frame rapidly when camera is active and idle
  useEffect(() => {
    const hasPermission = permission?.granted;
    if (!visible || !hasPermission) return;

    console.log("[CardScan] Auto-scan interval started");

    const interval = setInterval(async () => {
      if (
        isProcessingRef.current ||
        isPausedRef.current ||
        !cameraRef.current
      ) {
        return;
      }

      console.log("[CardScan] Taking picture...");
      isProcessingRef.current = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true,
          shutterSound: false,
        });

        console.log("[CardScan] Photo result:", {
          hasPhoto: !!photo,
          hasBase64: !!photo?.base64,
          base64Length: photo?.base64?.length,
          hasUri: !!photo?.uri,
          uri: photo?.uri,
          width: photo?.width,
          height: photo?.height,
        });

        if (photo?.base64) {
          await processCardImage(photo.base64);
        } else if (photo?.uri) {
          await processCardImage(photo.uri);
        } else {
          console.warn("[CardScan] No photo data returned from camera");
          isProcessingRef.current = false;
        }
      } catch (error: any) {
        console.error(
          "[CardScan] Auto-scan capture error:",
          error?.message || error,
        );
        isProcessingRef.current = false;
      }
    }, 250);

    return () => clearInterval(interval);
  }, [visible, permission?.granted]);

  const processCardImage = async (imageBase64: string) => {
    try {
      const ocrResult = await recognizeCard(imageBase64);

      if (!ocrResult.cardName || ocrResult.cardName.length < 2) {
        isProcessingRef.current = false;
        return;
      }

      const matchResult = await cardsApi.fuzzyMatch(ocrResult.cardName, {
        collectorNumber: ocrResult.collectorNumber,
        maxDistance: 5,
        limit: 5,
      });

      const topMatch = matchResult.data?.matches?.[0];

      if (!topMatch) {
        isProcessingRef.current = false;
        return;
      }

      // Skip if same card as last match (still in frame)
      if (topMatch.scryfallId === lastMatchRef.current) {
        isProcessingRef.current = false;
        return;
      }
      lastMatchRef.current = topMatch.scryfallId;

      // Auto-add top match to batch
      const scannedCard: ScannedCard = {
        id: `${topMatch.scryfallId}-${Date.now()}`,
        scryfallId: topMatch.scryfallId,
        name: topMatch.name,
        setCode: topMatch.setCode,
        setName: topMatch.setName,
        collectorNumber: topMatch.collectorNumber,
        imageSmall: topMatch.imageSmall || "",
        quantity: 1,
        priceUsd: topMatch.priceUsd,
      };

      setBatchCards((prev) => {
        const existing = prev.find((c) => c.scryfallId === topMatch.scryfallId);
        if (existing) {
          return prev.map((c) =>
            c.scryfallId === topMatch.scryfallId
              ? { ...c, quantity: c.quantity + 1 }
              : c,
          );
        }
        return [...prev, scannedCard];
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      matchSound.seekTo(0);
      matchSound.play();
      showToast.cardScan({
        name: topMatch.name,
        setName: topMatch.setName,
        setCode: topMatch.setCode,
        collectorNumber: topMatch.collectorNumber,
        imageSmall: topMatch.imageSmall,
      });

      isProcessingRef.current = false;
    } catch (error: any) {
      console.error(
        "[CardScan] OCR/Fuzzy match error:",
        error?.message || error,
      );
      isProcessingRef.current = false;
    }
  };

  const handleRemoveFromBatch = useCallback((cardId: string) => {
    setBatchCards((prev) => prev.filter((c) => c.id !== cardId));
  }, []);

  const handleFinishBatch = async () => {
    if (batchCards.length === 0) return;

    const totalSteps = batchCards.length;

    setIsAdding(true);
    setAddingProgress({ current: 0, total: totalSteps });

    let successCount = 0;
    const addedScryfallIds: string[] = [];

    for (let i = 0; i < batchCards.length; i++) {
      const card = batchCards[i];
      try {
        const result = await collectionApi.add(
          card.scryfallId,
          card.quantity,
          0,
          importSettings.folderId || undefined,
        );
        if (!result.error) {
          successCount++;
          addedScryfallIds.push(card.scryfallId);
        }
      } catch (error) {
        console.error(`Failed to add ${card.name}:`, error);
      }

      setAddingProgress({ current: i + 1, total: totalSteps });
    }

    // Link to specific deck if selected (non-autoLink mode)
    let linkMessage = "";
    if (!importSettings.autoLink && importSettings.deckId && addedScryfallIds.length > 0) {
      try {
        const linkResult = await collectionApi.linkImportedToDeck(
          addedScryfallIds,
          importSettings.deckId,
          {
            overrideSet: importSettings.overrideSet || undefined,
            addMissing: importSettings.addMissing || undefined,
          },
        );
        if (linkResult.data) {
          const { linked, added } = linkResult.data;
          const parts: string[] = [];
          if (linked > 0) parts.push(`${linked} linked`);
          if (added > 0) parts.push(`${added} added to deck`);
          if (parts.length > 0) linkMessage = ` (${parts.join(", ")})`;
        }
      } catch (error) {
        console.error("Failed to link to deck:", error);
      }
    }

    // Auto-link if enabled
    if (importSettings.autoLink && addedScryfallIds.length > 0) {
      try {
        await collectionApi.linkAllToDecks();
      } catch (error) {
        console.error("Failed to auto-link:", error);
      }
    }

    // Invalidate deck caches if we modified a deck
    if (importSettings.deckId || importSettings.autoLink) {
      await cache.remove(CACHE_KEYS.DECKS_LIST);
      if (importSettings.deckId) {
        await cache.remove(CACHE_KEYS.DECK_DETAIL(importSettings.deckId));
      }
    }

    setIsAdding(false);
    setBatchCards([]);

    if (successCount > 0) {
      showToast.success(
        `Added ${successCount} card${successCount !== 1 ? "s" : ""} to collection${linkMessage}`,
      );
    }

    if (successCount === batchCards.length) {
      onComplete();
    }
  };

  const closeBatchList = useCallback(() => {
    batchListClosingRef.current = true;
    setBatchListVisible(false);
    setTimeout(() => {
      batchListClosingRef.current = false;
    }, 400);
  }, []);

  const handleClose = () => {
    // Don't let batch list animation interfere with closing the scanner
    if (batchListVisible) {
      closeBatchList();
      return;
    }

    // Only prevent close if actively adding cards to collection
    if (isAdding) {
      return;
    }

    // Force stop any processing and close
    setBatchCards([]);
    isProcessingRef.current = false;
    onClose();
  };

  if (!visible) return null;

  // Show Expo Go limitation message
  if (isExpoGo) {
    return (
      <Modal
        visible={visible}
        transparent={false}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View
          className={`flex-1 overflow-hidden ${isDark ? "bg-slate-950" : "bg-white"}`}
          style={{ paddingTop: insets.top }}
        >
          <GlassView
            glassEffectStyle="regular"
            colorScheme={isDark ? "dark" : "light"}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* Header */}
          <View
            className={`flex-row items-center justify-between px-4 py-3 border-b ${
              isDark ? "border-slate-800" : "border-slate-200"
            }`}
          >
            <Text
              className={`text-lg font-bold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Scan Card
            </Text>
            <Pressable onPress={handleClose} className="p-1">
              <X size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          </View>

          {/* Expo Go Message */}
          <View className="flex-1 items-center justify-center p-8">
            <Download size={64} color={isDark ? "#3b82f6" : "#2563eb"} />
            <Text
              className={`text-xl font-bold mt-6 text-center ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Development Build Required
            </Text>
            <Text
              className={`text-base mt-3 text-center ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}
            >
              Camera scanning uses native modules that aren't available in Expo
              Go. Please run the app with a development build:
            </Text>
            <View
              className={`mt-4 p-4 rounded-lg ${
                isDark ? "bg-slate-900" : "bg-slate-100"
              }`}
            >
              <Text
                className={`font-mono text-sm ${
                  isDark ? "text-purple-400" : "text-purple-600"
                }`}
              >
                npx expo run:ios --device
              </Text>
            </View>
            <Text
              className={`text-sm mt-4 text-center ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              This will build and install the app with full camera scanning
              support.
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  const hasPermission = permission?.granted;
  const canAskPermission = permission?.canAskAgain !== false;

  return (
    <>
      <Modal
        visible={visible}
        transparent={false}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (batchListVisible) {
            closeBatchList();
          } else {
            handleClose();
          }
        }}
        statusBarTranslucent
      >
        <View className="flex-1 bg-black">
          {/* Camera or permission request */}
          {!hasPermission ? (
            <View
              className={`flex-1 overflow-hidden ${isDark ? "bg-slate-950" : "bg-white"}`}
              style={{ paddingTop: insets.top }}
            >
              <GlassView
                glassEffectStyle="regular"
                colorScheme={isDark ? "dark" : "light"}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
              />
              {canAskPermission ? (
                <View className="flex-1 items-center justify-center p-8">
                  <CameraIcon
                    size={64}
                    color={isDark ? "#7C3AED" : "#7C3AED"}
                  />
                  <Text
                    className={`text-xl font-bold mt-6 text-center ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Camera Access Needed
                  </Text>
                  <Text
                    className={`text-base mt-3 text-center ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    Allow camera access to scan Magic cards.
                  </Text>
                  <Pressable
                    onPress={requestPermission}
                    className="mt-6 px-6 py-3 rounded-lg bg-purple-500 active:bg-purple-600"
                  >
                    <Text className="text-white font-semibold text-base">
                      Allow Camera
                    </Text>
                  </Pressable>
                  <Pressable onPress={handleClose} className="mt-4 p-2">
                    <Text
                      className={`${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Cancel
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View
                    className={`flex-row items-center justify-between px-4 py-3 border-b ${
                      isDark ? "border-slate-800" : "border-slate-200"
                    }`}
                  >
                    <Text
                      className={`text-lg font-bold ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      Scan Card
                    </Text>
                    <Pressable onPress={handleClose} className="p-1">
                      <X size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                    </Pressable>
                  </View>
                  <CameraPermissionRequest />
                </>
              )}
            </View>
          ) : (
            <>
              {/* Live camera feed */}
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
              />

              {/* Close button */}
              <Pressable
                onPress={handleClose}
                disabled={isAdding}
                className="absolute top-0 right-0 p-3 z-10"
                style={{ paddingTop: insets.top + 12 }}
              >
                <View className="h-10 w-10 rounded-full bg-black/50 items-center justify-center">
                  <X size={22} color="white" />
                </View>
              </Pressable>

              {/* Pause/Play toggle — top left */}
              <Pressable
                onPress={() => {
                  isPausedRef.current = !isPausedRef.current;
                  setIsPaused(isPausedRef.current);
                }}
                className="absolute top-0 left-0 p-3"
                style={{ paddingTop: insets.top + 12 }}
              >
                <View className="h-10 w-10 rounded-full bg-black/50 items-center justify-center">
                  {isPaused ? (
                    <Play size={20} color="white" />
                  ) : (
                    <Pause size={20} color="white" />
                  )}
                </View>
              </Pressable>

              {/* Batch cards FAB — top right below close */}
              {batchCards.length > 0 && !batchListVisible && (
                <Pressable
                  onPress={() => setBatchListVisible(true)}
                  className="absolute right-0"
                  style={{ top: insets.top + 64, right: 12 }}
                >
                  <View className="h-10 w-10 rounded-full bg-purple-600 items-center justify-center">
                    <Layers size={18} color="white" />
                    <View className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-white items-center justify-center px-1">
                      <Text className="text-purple-700 text-[10px] font-bold">
                        {batchCards.length}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              )}
            </>
          )}

          {/* Batch cards overlay */}
          {batchListVisible && (
            <View
              style={[StyleSheet.absoluteFill, { zIndex: 50 }]}
              className="bg-slate-950"
            >
              <View style={{ paddingTop: insets.top }} className="flex-1">
                <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800">
                  <Text className="text-lg font-bold text-white">
                    Scanned Cards ({batchCards.length})
                  </Text>
                  <View className="flex-row items-center gap-2">
                    {batchCards.length > 0 && (
                      <Pressable
                        onPress={() => {
                          setBatchCards([]);
                          lastMatchRef.current = null;
                        }}
                        className="px-3 py-1 rounded-full bg-red-900/40"
                      >
                        <Text className="text-red-400 text-xs font-semibold">
                          Clear All
                        </Text>
                      </Pressable>
                    )}
                    <Pressable onPress={closeBatchList} className="p-1">
                      <X size={24} color="#94a3b8" />
                    </Pressable>
                  </View>
                </View>
                <FlatList
                  data={batchCards}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingBottom: 120 }}
                  renderItem={({ item }) => (
                    <View className="flex-row items-center px-4 py-3 border-b border-slate-800">
                      {item.imageSmall ? (
                        <Image
                          source={{ uri: item.imageSmall }}
                          className="h-14 w-10 rounded"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="h-14 w-10 rounded items-center justify-center bg-slate-800">
                          <Text className="text-slate-500 text-xs">?</Text>
                        </View>
                      )}
                      <View className="flex-1 ml-3">
                        <Text
                          className="text-sm font-medium text-white"
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text
                          className="text-xs mt-0.5 text-slate-400"
                          numberOfLines={1}
                        >
                          {item.setName} · {item.setCode?.toUpperCase()}
                        </Text>
                      </View>
                      {item.quantity > 1 && (
                        <Text className="text-sm font-semibold text-slate-300 mr-2">
                          x{item.quantity}
                        </Text>
                      )}
                      <Pressable
                        onPress={() => handleRemoveFromBatch(item.id)}
                        className="p-2"
                      >
                        <Trash2 size={18} color="#ef4444" />
                      </Pressable>
                    </View>
                  )}
                  ListFooterComponent={
                    batchCards.length > 0 ? (
                      <View className="px-4 pt-4">
                        <ImportSettings
                          visible={batchListVisible}
                          isDark={true}
                          value={importSettings}
                          onChange={setImportSettings}
                        />
                      </View>
                    ) : null
                  }
                  ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                      <Text className="text-slate-500">
                        No cards scanned yet
                      </Text>
                    </View>
                  }
                />
                {/* Add to Collection button */}
                {batchCards.length > 0 && (
                  <View
                    className="absolute bottom-0 left-0 right-0 px-4 pt-3 bg-slate-950 border-t border-slate-800"
                    style={{ paddingBottom: insets.bottom + 16 }}
                  >
                    <Pressable
                      onPress={handleFinishBatch}
                      disabled={isAdding}
                      className={`py-3 rounded-lg ${isAdding ? "bg-slate-600" : "bg-purple-600 active:bg-purple-700"}`}
                    >
                      {isAdding ? (
                        <View className="flex-row items-center justify-center gap-2">
                          <ActivityIndicator color="white" size="small" />
                          <Text className="text-white text-center font-semibold text-base">
                            Adding ({addingProgress.current}/
                            {addingProgress.total})...
                          </Text>
                        </View>
                      ) : (
                        <Text className="text-white text-center font-semibold text-base">
                          Add {batchCards.length} Card
                          {batchCards.length !== 1 ? "s" : ""} to Collection
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
        <Toast config={toastConfig} />
      </Modal>
    </>
  );
}
