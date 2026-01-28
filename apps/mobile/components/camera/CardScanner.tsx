import { Camera, Download, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CardSearchResult } from "~/lib/api";
import { cardsApi, collectionApi } from "~/lib/api";
import { recognizeCard } from "~/lib/ocr";
import { showToast } from "~/lib/toast";
import type { ScannedCard } from "~/hooks/useCamera";
import { BatchScanList } from "./BatchScanList";
import { CameraPermissionRequest } from "./CameraPermissionRequest";
import { ScanResultModal } from "./ScanResultModal";
import { ScryfallSearch } from "../ScryfallSearch";

// Check if we're running in Expo Go
const isExpoGo = Constants.appOwnership === "expo";

// Dynamically import DocumentScanner only in development builds
let DocumentScanner: any = null;
if (!isExpoGo) {
  try {
    DocumentScanner = require("react-native-document-scanner-plugin").default;
  } catch (e) {
    console.log("DocumentScanner not available");
  }
}

interface CardScannerProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function CardScanner({ visible, onClose, onComplete }: CardScannerProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Scan result state
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [fuzzyMatches, setFuzzyMatches] = useState<
    Array<CardSearchResult & { distance: number; confidence: number }>
  >([]);

  // Batch scanning state
  const [batchCards, setBatchCards] = useState<ScannedCard[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [addingProgress, setAddingProgress] = useState({ current: 0, total: 0 });

  // Manual search fallback
  const [manualSearchVisible, setManualSearchVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      checkPermission();
    }
  }, [visible]);

  const checkPermission = async () => {
    // react-native-document-scanner-plugin handles permissions internally
    setHasPermission(true);
  };

  const handleScan = async () => {
    if (!DocumentScanner) {
      showToast.error("Camera scanning requires a development build");
      return;
    }

    setIsProcessing(true);
    try {
      const { scannedImages, status } = await DocumentScanner.scanDocument({
        croppedImageQuality: 100,
        maxNumDocuments: 1,
        letUserAdjustCrop: false,
        responseType: "base64",
      });

      if (status === "success" && scannedImages && scannedImages.length > 0) {
        await processCardImage(scannedImages[0]);
      } else if (status === "cancel") {
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error("Scanner error:", error);
      if (error.message?.includes("permission")) {
        setHasPermission(false);
      } else {
        showToast.error("Failed to scan card");
      }
      setIsProcessing(false);
    }
  };

  const processCardImage = async (imageBase64: string) => {
    try {
      // Step 1: Run OCR on the image
      const ocrResult = await recognizeCard(imageBase64);

      if (!ocrResult.cardName || ocrResult.cardName.length < 2) {
        showToast.error("Could not read card name. Please try again.");
        setIsProcessing(false);
        return;
      }

      setOcrText(ocrResult.cardName);

      // Step 2: Fuzzy match the card name
      const matchResult = await cardsApi.fuzzyMatch(ocrResult.cardName, {
        setCode: ocrResult.setCode,
        collectorNumber: ocrResult.collectorNumber,
        maxDistance: 5,
        limit: 5,
      });

      if (matchResult.error) {
        showToast.error(matchResult.error);
        setIsProcessing(false);
        return;
      }

      setFuzzyMatches(matchResult.data?.matches || []);

      // Step 3: Show results modal
      setIsProcessing(false);
      setResultModalVisible(true);
    } catch (error: any) {
      console.error("OCR/Fuzzy match error:", error);
      showToast.error("Failed to process card image");
      setIsProcessing(false);
    }
  };

  const handleSelectCard = useCallback((card: CardSearchResult) => {
    // Add card to batch
    const scannedCard: ScannedCard = {
      id: `${card.scryfallId}-${Date.now()}`,
      scryfallId: card.scryfallId,
      name: card.name,
      setCode: card.setCode,
      setName: card.setName,
      collectorNumber: card.collectorNumber,
      imageSmall: card.imageSmall || "",
      quantity: 1,
      priceUsd: card.priceUsd,
    };

    setBatchCards((prev) => {
      // Check if same card already in batch
      const existing = prev.find((c) => c.scryfallId === card.scryfallId);
      if (existing) {
        return prev.map((c) =>
          c.scryfallId === card.scryfallId
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, scannedCard];
    });

    // Close result modal
    setResultModalVisible(false);
    setOcrText("");
    setFuzzyMatches([]);

    showToast.success(`Added ${card.name} to batch`);
  }, []);

  const handleManualSearch = useCallback(() => {
    setResultModalVisible(false);
    setManualSearchVisible(true);
  }, []);

  const handleManualSelectCard = useCallback((card: CardSearchResult) => {
    handleSelectCard(card);
    setManualSearchVisible(false);
  }, [handleSelectCard]);

  const handleRemoveFromBatch = useCallback((cardId: string) => {
    setBatchCards((prev) => prev.filter((c) => c.id !== cardId));
  }, []);

  const handleFinishBatch = async () => {
    if (batchCards.length === 0) return;

    setIsAdding(true);
    setAddingProgress({ current: 0, total: batchCards.length });

    let successCount = 0;

    for (let i = 0; i < batchCards.length; i++) {
      const card = batchCards[i];
      try {
        const result = await collectionApi.add(card.scryfallId, card.quantity, 0);
        if (!result.error) {
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to add ${card.name}:`, error);
      }

      setAddingProgress({ current: i + 1, total: batchCards.length });
    }

    setIsAdding(false);
    setBatchCards([]);

    if (successCount > 0) {
      showToast.success(`Added ${successCount} card${successCount !== 1 ? "s" : ""} to collection`);
    }

    if (successCount === batchCards.length) {
      // All cards added successfully
      onComplete();
    }
  };

  const handleClose = () => {
    if (!isProcessing && !isAdding) {
      // Reset state
      setBatchCards([]);
      setOcrText("");
      setFuzzyMatches([]);
      setResultModalVisible(false);
      setManualSearchVisible(false);
      onClose();
    }
  };

  if (!visible) return null;

  // Show Expo Go limitation message
  if (isExpoGo) {
    return (
      <Modal
        visible={visible}
        transparent={false}
        animationType="slide"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View
          className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
          style={{ paddingTop: insets.top }}
        >
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

  return (
    <>
      <Modal
        visible={visible}
        transparent={false}
        animationType="slide"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View
          className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
          style={{ paddingTop: insets.top }}
        >
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
            <Pressable
              onPress={handleClose}
              disabled={isProcessing || isAdding}
              className="p-1"
            >
              <X size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          </View>

          {/* Content */}
          {hasPermission === false ? (
            <CameraPermissionRequest />
          ) : hasPermission === null ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text
                className={`mt-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Checking permissions...
              </Text>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center p-6">
              {/* Instructions */}
              <View className="mb-8">
                <Text
                  className={`text-center text-lg font-semibold mb-2 ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Ready to Scan
                </Text>
                <Text
                  className={`text-center ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  Tap the button below to scan a Magic card. The scanner will
                  automatically detect the card boundaries.
                </Text>
              </View>

              {/* Scan Button */}
              <Pressable
                onPress={handleScan}
                disabled={isProcessing}
                className={`h-20 w-20 rounded-full items-center justify-center ${
                  isProcessing
                    ? "bg-slate-600"
                    : isDark
                    ? "bg-purple-600 active:bg-purple-700"
                    : "bg-purple-500 active:bg-purple-600"
                }`}
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" size="large" />
                ) : (
                  <Camera size={40} color="white" />
                )}
              </Pressable>

              {isProcessing && (
                <Text
                  className={`mt-4 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Reading card...
                </Text>
              )}

              {/* Tips */}
              <View className="mt-8">
                <Text
                  className={`text-sm font-semibold mb-2 ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Tips for best results:
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  • Ensure good lighting
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  • Place card on a flat surface
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  • Avoid glare on foil cards
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  • Keep the card name clearly visible
                </Text>
              </View>
            </View>
          )}

          {/* Batch Scan List */}
          <BatchScanList
            cards={batchCards}
            onRemove={handleRemoveFromBatch}
            onFinish={handleFinishBatch}
            isAdding={isAdding}
            addingProgress={addingProgress}
          />
        </View>
      </Modal>

      {/* Scan Result Modal */}
      <ScanResultModal
        visible={resultModalVisible}
        ocrText={ocrText}
        matches={fuzzyMatches}
        onSelectCard={handleSelectCard}
        onClose={() => setResultModalVisible(false)}
        onManualSearch={handleManualSearch}
      />

      {/* Manual Search Fallback */}
      <ScryfallSearch
        visible={manualSearchVisible}
        onClose={() => setManualSearchVisible(false)}
        onSelectCard={handleManualSelectCard}
        title="Search Card Manually"
        placeholder="Search for card..."
      />
    </>
  );
}
