import { Check, CloudDownload, FileDown, Trash2 } from "lucide-react-native";
import { Modal, Pressable, Text, View } from "react-native";
import type { ViewMode, GroupBy } from "./deck-detail-constants";
import { VIEW_MODE_OPTIONS, GROUP_BY_OPTIONS, GROUP_COLORS } from "./deck-detail-constants";
import type { DeckDetail } from "~/lib/api";

// Options Menu (kebab menu)
export function DeckOptionsMenu({
  visible,
  position,
  isDark,
  deck,
  archidektConnected,
  onClose,
  onExport: onExportDeck,
  onPullFromArchidekt,
  onDeleteDeck,
}: {
  visible: boolean;
  position: { top: number; right: number };
  isDark: boolean;
  deck: DeckDetail | null;
  archidektConnected: boolean;
  onClose: () => void;
  onExport: () => void;
  onPullFromArchidekt: () => void;
  onDeleteDeck: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1" onPress={onClose}>
        <View
          style={{
            position: "absolute",
            top: position.top,
            right: position.right,
          }}
          className={`min-w-[200px] rounded-lg border shadow-lg ${
            isDark
              ? "border-slate-700 bg-slate-800"
              : "border-slate-200 bg-white"
          }`}
        >
          <Pressable
            onPress={() => {
              onClose();
              onExportDeck();
            }}
            className={`flex-row items-center gap-3 px-4 py-3 ${
              isDark ? "active:bg-slate-700" : "active:bg-slate-100"
            }`}
          >
            <FileDown size={18} color={isDark ? "#94a3b8" : "#64748b"} />
            <Text className={isDark ? "text-white" : "text-slate-900"}>
              Export Deck
            </Text>
          </Pressable>
          {deck?.archidektId && archidektConnected && (
            <Pressable
              onPress={onPullFromArchidekt}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                isDark ? "active:bg-slate-700" : "active:bg-slate-100"
              }`}
            >
              <CloudDownload
                size={18}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
              <Text className={isDark ? "text-white" : "text-slate-900"}>
                Pull from Archidekt
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={onDeleteDeck}
            className={`flex-row items-center gap-3 px-4 py-3 ${
              isDark ? "active:bg-slate-700" : "active:bg-slate-100"
            }`}
          >
            <Trash2 size={18} color="#ef4444" />
            <Text className="text-red-500">Delete Deck</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

// View Mode Menu
export function ViewModeMenu({
  visible,
  position,
  isDark,
  isDesktop,
  currentMode,
  onClose,
  onChange,
}: {
  visible: boolean;
  position: { top: number; left: number };
  isDark: boolean;
  isDesktop: boolean;
  currentMode: ViewMode;
  onClose: () => void;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1" onPress={onClose}>
        <View
          style={{
            position: "absolute",
            top: position.top,
            left: position.left,
          }}
          className={`min-w-[200px] rounded-xl border shadow-xl ${
            isDark
              ? "border-slate-700 bg-slate-800"
              : "border-slate-200 bg-white"
          }`}
        >
          <Text
            className={`px-4 py-3 text-sm font-semibold border-b ${
              isDark
                ? "text-slate-300 border-slate-700"
                : "text-slate-700 border-slate-200"
            }`}
          >
            View Mode
          </Text>
          {VIEW_MODE_OPTIONS.filter(
            (option) => !option.desktopOnly || isDesktop,
          ).map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                onClose();
              }}
              className={`flex-row items-center justify-between px-4 py-3 ${
                isDark ? "active:bg-slate-700" : "active:bg-slate-100"
              }`}
            >
              <Text className={isDark ? "text-white" : "text-slate-900"}>
                {option.label}
              </Text>
              {currentMode === option.value && (
                <Check size={18} color="#7C3AED" />
              )}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// Group By Menu
export function GroupByMenu({
  visible,
  position,
  isDark,
  currentGroupBy,
  deck,
  onClose,
  onChange,
  onExpandSections,
}: {
  visible: boolean;
  position: { top: number; left: number };
  isDark: boolean;
  currentGroupBy: GroupBy;
  deck: DeckDetail | null;
  onClose: () => void;
  onChange: (groupBy: GroupBy) => void;
  onExpandSections: (sections: Set<string>) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1" onPress={onClose}>
        <View
          style={{
            position: "absolute",
            top: position.top,
            left: position.left,
          }}
          className={`min-w-[200px] rounded-xl border shadow-xl ${
            isDark
              ? "border-slate-700 bg-slate-800"
              : "border-slate-200 bg-white"
          }`}
        >
          <Text
            className={`px-4 py-3 text-sm font-semibold border-b ${
              isDark
                ? "text-slate-300 border-slate-700"
                : "text-slate-700 border-slate-200"
            }`}
          >
            Group Cards By
          </Text>
          {GROUP_BY_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                try {
                  localStorage.setItem("deck_group_by", option.value);
                } catch {}
                onClose();
                // Expand all groups when changing grouping
                if (deck) {
                  const allTitles = new Set<string>();
                  if (option.value === "category") {
                    allTitles.add("Commander");
                    allTitles.add("Mainboard");
                    allTitles.add("Sideboard");
                  } else {
                    Object.keys(GROUP_COLORS[option.value] || {}).forEach(
                      (k) => allTitles.add(k),
                    );
                  }
                  onExpandSections(allTitles);
                }
              }}
              className={`flex-row items-center justify-between px-4 py-3 ${
                isDark ? "active:bg-slate-700" : "active:bg-slate-100"
              }`}
            >
              <Text className={isDark ? "text-white" : "text-slate-900"}>
                {option.label}
              </Text>
              {currentGroupBy === option.value && (
                <Check size={18} color="#7C3AED" />
              )}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
