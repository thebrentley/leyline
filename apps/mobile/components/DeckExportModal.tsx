import { Check, ClipboardCopy, Download, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { File as ExpoFile, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { type DeckDetail } from "~/lib/api";
import { secureStorage } from "~/lib/storage";
import { showToast } from "~/lib/toast";

type ExportFormat = "text-mtgo" | "text-arena" | "csv" | "json";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; description: string }[] = [
  { value: "text-mtgo", label: "Text (MTGO)", description: "1 Card Name" },
  { value: "text-arena", label: "Text (Arena)", description: "1 Card Name (SET) #" },
  { value: "csv", label: "CSV", description: "Spreadsheet format" },
  { value: "json", label: "JSON", description: "Structured data" },
];

const STORAGE_KEY = "deck_export_format";

function formatDeckText(deck: DeckDetail, format: ExportFormat): string {
  switch (format) {
    case "text-mtgo":
      return formatMTGO(deck);
    case "text-arena":
      return formatArena(deck);
    case "csv":
      return formatCSV(deck);
    case "json":
      return formatJSON(deck);
  }
}

function formatMTGO(deck: DeckDetail): string {
  const fmt = (c: DeckDetail["mainboard"][number]) => `${c.quantity} ${c.name}`;
  const sections: string[] = [];

  if (deck.commanders.length > 0) {
    sections.push("// Commander\n" + deck.commanders.map(fmt).join("\n"));
  }
  if (deck.mainboard.length > 0) {
    sections.push("// Mainboard\n" + deck.mainboard.map(fmt).join("\n"));
  }
  if (deck.sideboard.length > 0) {
    sections.push("// Sideboard\n" + deck.sideboard.map(fmt).join("\n"));
  }

  return sections.join("\n\n");
}

function formatArena(deck: DeckDetail): string {
  const fmt = (c: DeckDetail["mainboard"][number]) => {
    const set = c.setCode?.toUpperCase() || "";
    const num = c.collectorNumber || "";
    return `${c.quantity} ${c.name}${set ? ` (${set})` : ""}${num ? ` ${num}` : ""}`;
  };
  const sections: string[] = [];

  if (deck.commanders.length > 0) {
    sections.push("Commander\n" + deck.commanders.map(fmt).join("\n"));
  }
  if (deck.mainboard.length > 0) {
    sections.push("Deck\n" + deck.mainboard.map(fmt).join("\n"));
  }
  if (deck.sideboard.length > 0) {
    sections.push("Sideboard\n" + deck.sideboard.map(fmt).join("\n"));
  }

  return sections.join("\n\n");
}

function formatCSV(deck: DeckDetail): string {
  const header = "Quantity,Name,Section,Type,Mana Cost,Set,Collector Number,Rarity";
  const rows: string[] = [header];

  const addCards = (cards: DeckDetail["mainboard"], section: string) => {
    for (const card of cards) {
      const name = card.name.includes(",") ? `"${card.name}"` : card.name;
      const type = (card.typeLine || "").includes(",")
        ? `"${card.typeLine}"`
        : card.typeLine || "";
      const manaCost = (card.manaCost || "").includes(",")
        ? `"${card.manaCost}"`
        : card.manaCost || "";
      rows.push(
        `${card.quantity},${name},${section},${type},${manaCost},${card.setCode || ""},${card.collectorNumber || ""},${card.rarity || ""}`,
      );
    }
  };

  addCards(deck.commanders, "Commander");
  addCards(deck.mainboard, "Mainboard");
  addCards(deck.sideboard, "Sideboard");

  return rows.join("\n");
}

function formatJSON(deck: DeckDetail): string {
  const mapCards = (cards: DeckDetail["mainboard"]) =>
    cards.map((c) => ({
      name: c.name,
      quantity: c.quantity,
      setCode: c.setCode,
      collectorNumber: c.collectorNumber,
      typeLine: c.typeLine,
      manaCost: c.manaCost,
      rarity: c.rarity,
      colors: c.colors,
      colorIdentity: c.colorIdentity,
    }));

  return JSON.stringify(
    {
      name: deck.name,
      format: deck.format,
      cardCount: deck.cardCount,
      colorIdentity: deck.colorIdentity,
      commanders: mapCards(deck.commanders),
      mainboard: mapCards(deck.mainboard),
      sideboard: mapCards(deck.sideboard),
    },
    null,
    2,
  );
}

function getFileExtension(format: ExportFormat): string {
  switch (format) {
    case "text-mtgo":
    case "text-arena":
      return "txt";
    case "csv":
      return "csv";
    case "json":
      return "json";
  }
}

function getMimeType(format: ExportFormat): string {
  switch (format) {
    case "text-mtgo":
    case "text-arena":
      return "text/plain";
    case "csv":
      return "text/csv";
    case "json":
      return "application/json";
  }
}

function downloadFileWeb(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function shareFileNative(content: string, filename: string, mimeType: string) {
  const file = new ExpoFile(Paths.cache, filename);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType });
}

interface DeckExportModalProps {
  visible: boolean;
  onClose: () => void;
  deck: DeckDetail;
}

export function DeckExportModal({ visible, onClose, deck }: DeckExportModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const isWeb = Platform.OS === "web";

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("text-mtgo");

  // Load saved format preference
  useEffect(() => {
    secureStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && FORMAT_OPTIONS.some((o) => o.value === saved)) {
        setSelectedFormat(saved as ExportFormat);
      }
    });
  }, []);

  const saveFormatPreference = useCallback((format: ExportFormat) => {
    setSelectedFormat(format);
    secureStorage.setItem(STORAGE_KEY, format);
  }, []);

  const handleCopy = useCallback(async () => {
    const content = formatDeckText(deck, selectedFormat);
    await Clipboard.setStringAsync(content);
    showToast.success("Deck copied to clipboard");
    onClose();
  }, [deck, selectedFormat, onClose]);

  const handleDownload = useCallback(async () => {
    const content = formatDeckText(deck, selectedFormat);
    const safeName = deck.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const ext = getFileExtension(selectedFormat);
    const mime = getMimeType(selectedFormat);
    const filename = `${safeName}.${ext}`;

    try {
      if (isWeb) {
        downloadFileWeb(content, filename, mime);
      } else {
        await shareFileNative(content, filename, mime);
      }
      showToast.success(isWeb ? "File downloaded" : "File shared");
      onClose();
    } catch {
      showToast.error("Failed to export file");
    }
  }, [deck, selectedFormat, onClose, isWeb]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 items-center justify-center p-4" onPress={onClose}>
        <Pressable
          className={`w-full max-w-sm rounded-2xl overflow-hidden ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
            <Text
              className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Export Deck
            </Text>
            <Pressable onPress={onClose} className="p-1 -mr-1">
              <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          </View>

          {/* Format Options */}
          <View className="px-5 pb-4">
            <Text
              className={`text-sm font-medium mb-2 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Format
            </Text>
            <View className="gap-1.5">
              {FORMAT_OPTIONS.map((opt) => {
                const isSelected = selectedFormat === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => saveFormatPreference(opt.value)}
                    className={`flex-row items-center justify-between px-3.5 py-2.5 rounded-lg border ${
                      isSelected
                        ? isDark
                          ? "bg-purple-500/15 border-purple-500/40"
                          : "bg-purple-50 border-purple-300"
                        : isDark
                          ? "bg-slate-700/50 border-slate-700"
                          : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <View>
                      <Text
                        className={`text-sm font-medium ${
                          isSelected
                            ? isDark
                              ? "text-purple-300"
                              : "text-purple-700"
                            : isDark
                              ? "text-white"
                              : "text-slate-900"
                        }`}
                      >
                        {opt.label}
                      </Text>
                      <Text
                        className={`text-xs mt-0.5 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {opt.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <Check size={16} color={isDark ? "#c084fc" : "#7c3aed"} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Action Buttons */}
          <View className="px-5 pb-5 gap-2.5">
            <Pressable
              onPress={handleCopy}
              className="flex-row items-center justify-center gap-2 py-3 rounded-lg bg-purple-600 active:bg-purple-700"
            >
              <ClipboardCopy size={16} color="#fff" />
              <Text className="text-white font-medium text-sm">
                Copy to Clipboard
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDownload}
              className={`flex-row items-center justify-center gap-2 py-3 rounded-lg border ${
                isDark
                  ? "border-slate-600 active:bg-slate-700"
                  : "border-slate-300 active:bg-slate-100"
              }`}
            >
              <Download size={16} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`font-medium text-sm ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                {isWeb ? "Download File" : "Share File"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
