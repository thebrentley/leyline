import {
  ChevronDown,
  Folder,
  Inbox,
  Layers,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  collectionApi,
  decksApi,
  type CollectionFolder,
  type DeckSummary,
} from "~/lib/api";
import { StyledSwitch } from "./StyledSwitch";

export interface ImportSettingsValue {
  folderId: string | null;
  autoLink: boolean;
  deckId: string | null;
  overrideSet: boolean;
  addMissing: boolean;
}

interface ImportSettingsProps {
  visible: boolean;
  isDark: boolean;
  value: ImportSettingsValue;
  onChange: (value: ImportSettingsValue) => void;
}

export function ImportSettings({
  visible,
  isDark,
  value,
  onChange,
}: ImportSettingsProps) {
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const [deckDropdownOpen, setDeckDropdownOpen] = useState(false);
  const [folders, setFolders] = useState<CollectionFolder[]>([]);
  const [decks, setDecks] = useState<DeckSummary[]>([]);

  useEffect(() => {
    if (visible) {
      collectionApi.getFolders().then((res) => {
        if (res.data) setFolders(res.data.folders);
      });
      decksApi.list().then((res) => {
        if (res.data) setDecks(res.data);
      });
    }
  }, [visible]);

  const selectedFolder = folders.find((f) => f.id === value.folderId);
  const selectedDeck = decks.find((d) => d.id === value.deckId);

  const description = getDescription(value, selectedDeck?.name);

  return (
    <View>
      {/* Folder destination */}
      <View className="mb-4 relative z-10">
        <Text
          className={`text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}
        >
          Destination Folder
        </Text>
        <Pressable
          onPress={() => setFolderDropdownOpen(!folderDropdownOpen)}
          className={`flex-row items-center justify-between rounded-xl p-4 border ${
            folderDropdownOpen
              ? "border-purple-500"
              : isDark
                ? "border-slate-700"
                : "border-slate-200"
          } ${isDark ? "bg-slate-800" : "bg-white"}`}
        >
          <View className="flex-row items-center gap-2">
            <Folder size={18} color={isDark ? "#94a3b8" : "#64748b"} />
            <Text className={isDark ? "text-white" : "text-slate-900"}>
              {selectedFolder ? selectedFolder.name : "Unfiled"}
            </Text>
          </View>
          <ChevronDown
            size={18}
            color={isDark ? "#94a3b8" : "#64748b"}
            style={{
              transform: [{ rotate: folderDropdownOpen ? "180deg" : "0deg" }],
            }}
          />
        </Pressable>
        {folderDropdownOpen && (
          <View
            className={`absolute left-0 right-0 rounded-xl border overflow-hidden max-h-64 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}
            style={{
              bottom: '100%',
              marginBottom: 4,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
            }}
          >
            <ScrollView nestedScrollEnabled>
            <Pressable
              onPress={() => {
                onChange({ ...value, folderId: null });
                setFolderDropdownOpen(false);
              }}
              className={`flex-row items-center gap-2 px-4 py-3 ${
                !value.folderId
                  ? isDark
                    ? "bg-purple-500/10"
                    : "bg-purple-50"
                  : ""
              }`}
            >
              <Inbox
                size={16}
                color={
                  !value.folderId
                    ? "#7C3AED"
                    : isDark
                      ? "#94a3b8"
                      : "#64748b"
                }
              />
              <Text
                className={
                  !value.folderId
                    ? "text-purple-500 font-medium"
                    : isDark
                      ? "text-white"
                      : "text-slate-900"
                }
              >
                Unfiled
              </Text>
            </Pressable>
            {folders.map((folder) => (
              <Pressable
                key={folder.id}
                onPress={() => {
                  onChange({ ...value, folderId: folder.id });
                  setFolderDropdownOpen(false);
                }}
                className={`flex-row items-center gap-2 px-4 py-3 border-t ${
                  isDark ? "border-slate-700" : "border-slate-100"
                } ${
                  value.folderId === folder.id
                    ? isDark
                      ? "bg-purple-500/10"
                      : "bg-purple-50"
                    : ""
                }`}
              >
                <Folder
                  size={16}
                  color={
                    value.folderId === folder.id
                      ? "#7C3AED"
                      : isDark
                        ? "#94a3b8"
                        : "#64748b"
                  }
                />
                <Text
                  className={
                    value.folderId === folder.id
                      ? "text-purple-500 font-medium"
                      : isDark
                        ? "text-white"
                        : "text-slate-900"
                  }
                >
                  {folder.name}
                </Text>
              </Pressable>
            ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Auto link switch */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between">
          <Text
            className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}
          >
            Auto Link to Deck Cards
          </Text>
          <StyledSwitch
            isDark={isDark}
            value={value.autoLink}
            onValueChange={(v) =>
              onChange({ ...value, autoLink: v })
            }
          />
        </View>
      </View>

      {/* Manual deck settings (when auto link is off) */}
      {!value.autoLink && (
        <>
          {/* Deck selector */}
          <View className="mb-4 relative z-20">
            <Text
              className={`text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}
            >
              Deck
            </Text>
            <Pressable
              onPress={() => setDeckDropdownOpen(!deckDropdownOpen)}
              className={`flex-row items-center justify-between rounded-xl p-4 border ${
                deckDropdownOpen
                  ? "border-purple-500"
                  : isDark
                    ? "border-slate-700"
                    : "border-slate-200"
              } ${isDark ? "bg-slate-800" : "bg-white"}`}
            >
              <View className="flex-row items-center gap-2">
                <Layers size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text className={isDark ? "text-white" : "text-slate-900"}>
                  {selectedDeck ? selectedDeck.name : "None"}
                </Text>
              </View>
              <ChevronDown
                size={18}
                color={isDark ? "#94a3b8" : "#64748b"}
                style={{
                  transform: [{ rotate: deckDropdownOpen ? "180deg" : "0deg" }],
                }}
              />
            </Pressable>
            {deckDropdownOpen && (
              <View
                className={`absolute left-0 right-0 rounded-xl border overflow-hidden max-h-64 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}
                style={{
                  bottom: '100%',
                  marginBottom: 4,
                  elevation: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: -2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                }}
              >
                <ScrollView nestedScrollEnabled>
                  <Pressable
                    onPress={() => {
                      onChange({ ...value, deckId: null });
                      setDeckDropdownOpen(false);
                    }}
                    className={`flex-row items-center gap-2 px-4 py-3 ${
                      !value.deckId
                        ? isDark
                          ? "bg-purple-500/10"
                          : "bg-purple-50"
                        : ""
                    }`}
                  >
                    <Text
                      className={
                        !value.deckId
                          ? "text-purple-500 font-medium"
                          : isDark
                            ? "text-white"
                            : "text-slate-900"
                      }
                    >
                      None
                    </Text>
                  </Pressable>
                  {decks.map((deck) => (
                    <Pressable
                      key={deck.id}
                      onPress={() => {
                        onChange({ ...value, deckId: deck.id });
                        setDeckDropdownOpen(false);
                      }}
                      className={`flex-row items-center gap-2 px-4 py-3 border-t ${
                        isDark ? "border-slate-700" : "border-slate-100"
                      } ${
                        value.deckId === deck.id
                          ? isDark
                            ? "bg-purple-500/10"
                            : "bg-purple-50"
                          : ""
                      }`}
                    >
                      <Layers
                        size={16}
                        color={
                          value.deckId === deck.id
                            ? "#7C3AED"
                            : isDark
                              ? "#94a3b8"
                              : "#64748b"
                        }
                      />
                      <Text
                        className={
                          value.deckId === deck.id
                            ? "text-purple-500 font-medium"
                            : isDark
                              ? "text-white"
                              : "text-slate-900"
                        }
                      >
                        {deck.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Only show sub-options when a deck is selected */}
          {value.deckId && (
            <>
              {/* Override set/collector switch */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text
                      className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}
                    >
                      Override Set & Collector Number
                    </Text>
                    <Text
                      className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      Update unlinked deck cards that match by name
                    </Text>
                  </View>
                  <StyledSwitch
                    isDark={isDark}
                    value={value.overrideSet}
                    onValueChange={(v) =>
                      onChange({ ...value, overrideSet: v })
                    }
                  />
                </View>
              </View>

              {/* Add missing switch */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text
                      className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}
                    >
                      Add Missing Cards to Deck
                    </Text>
                    <Text
                      className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      Add cards not found in the deck
                    </Text>
                  </View>
                  <StyledSwitch
                    isDark={isDark}
                    value={value.addMissing}
                    onValueChange={(v) =>
                      onChange({ ...value, addMissing: v })
                    }
                  />
                </View>
              </View>
            </>
          )}
        </>
      )}

      {/* Description text */}
      <Text
        className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
      >
        {description}
      </Text>
    </View>
  );
}

function getDescription(
  value: ImportSettingsValue,
  deckName?: string,
): string {
  if (value.autoLink) {
    return "Imported cards will be automatically linked to matching cards across all your decks.";
  }

  if (!value.deckId) {
    return "Will only add cards to your collection.";
  }

  const name = deckName || "the selected deck";
  const parts: string[] = [`Will link matching cards to ${name}`];

  if (value.overrideSet) {
    parts.push("update set/collector number on unlinked name matches");
  }

  if (value.addMissing) {
    parts.push("add unmatched cards to the deck");
  }

  if (parts.length === 1) {
    return parts[0] + ".";
  }

  if (parts.length === 2) {
    return parts[0] + " and " + parts[1] + ".";
  }

  return parts[0] + ", " + parts[1] + ", and " + parts[2] + ".";
}
