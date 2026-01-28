import {
  Check,
  Palette,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";
import { useState, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { decksApi, type ColorTag, type DeckDetail } from "~/lib/api";
import { showToast } from "~/lib/toast";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";

// Preset colors for quick selection
const PRESET_COLORS = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#EAB308", // Yellow
  "#84CC16", // Lime
  "#22C55E", // Green
  "#10B981", // Emerald
  "#14B8A6", // Teal
  "#06B6D4", // Cyan
  "#0EA5E9", // Sky
  "#3B82F6", // Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Violet
  "#A855F7", // Purple
  "#D946EF", // Fuchsia
  "#EC4899", // Pink
  "#F43F5E", // Rose
  "#78716C", // Stone
  "#6B7280", // Gray
  "#FFFFFF", // White
];

interface ColorTagManagerProps {
  deck: DeckDetail;
  visible: boolean;
  onClose: () => void;
  onTagsChanged: (colorTags: ColorTag[]) => void;
  isDark: boolean;
}

export function ColorTagManager({
  deck,
  visible,
  onClose,
  onTagsChanged,
  isDark,
}: ColorTagManagerProps) {
  const [tags, setTags] = useState<ColorTag[]>([]);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#3B82F6");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3B82F6");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    visible: boolean;
    tagName: string;
    cardsUsingTag: number;
  }>({ visible: false, tagName: "", cardsUsingTag: 0 });

  // Combine all cards from deck
  const allCards = useMemo(() => [
    ...(deck.commanders || []),
    ...(deck.mainboard || []),
    ...(deck.sideboard || []),
  ], [deck.commanders, deck.mainboard, deck.sideboard]);

  useEffect(() => {
    if (visible) {
      setTags([...(deck.colorTags || [])]);
      setEditingTag(null);
      setIsAdding(false);
    }
  }, [visible, deck.colorTags]);

  const getCardCount = (tagName: string) => {
    return allCards.filter((c) => c.colorTag === tagName).length;
  };

  const handleAddTag = async () => {
    if (!newName.trim()) {
      showToast.error("Tag name is required");
      return;
    }

    setSaving(true);
    try {
      const result = await decksApi.addColorTag(deck.id, newName.trim(), newColor);
      if (result.error) {
        showToast.error(result.error);
      } else if (result.data) {
        setTags(result.data.colorTags);
        onTagsChanged(result.data.colorTags);
        setNewName("");
        setNewColor("#3B82F6");
        setIsAdding(false);
        showToast.success("Tag added successfully");
      }
    } catch (err) {
      showToast.error("Failed to add tag");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTag = async (oldName: string) => {
    if (!editName.trim()) {
      showToast.error("Tag name is required");
      return;
    }

    setSaving(true);
    try {
      const result = await decksApi.updateColorTag(deck.id, oldName, editName.trim(), editColor);
      if (result.error) {
        showToast.error(result.error);
      } else if (result.data) {
        setTags(result.data.colorTags);
        onTagsChanged(result.data.colorTags);
        setEditingTag(null);
        showToast.success("Tag updated successfully");
      }
    } catch (err) {
      showToast.error("Failed to update tag");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTag = (tagName: string) => {
    const cardsUsingTag = getCardCount(tagName);
    setConfirmDelete({ visible: true, tagName, cardsUsingTag });
  };

  const confirmDeleteTag = async () => {
    const { tagName } = confirmDelete;
    setConfirmDelete({ visible: false, tagName: "", cardsUsingTag: 0 });

    setSaving(true);
    try {
      const result = await decksApi.deleteColorTag(deck.id, tagName);
      if (result.error) {
        showToast.error(result.error);
      } else if (result.data) {
        setTags(result.data.colorTags);
        onTagsChanged(result.data.colorTags);
        showToast.success("Tag deleted successfully");
      }
    } catch (err) {
      showToast.error("Failed to delete tag");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (tag: ColorTag) => {
    setEditingTag(tag.name);
    setEditName(tag.name);
    setEditColor(tag.color);
    setIsAdding(false);
  };

  const cancelEditing = () => {
    setEditingTag(null);
  };

  const startAdding = () => {
    setIsAdding(true);
    setEditingTag(null);
    setNewName("");
    setNewColor("#3B82F6");
  };

  const cancelAdding = () => {
    setIsAdding(false);
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
        {/* Header */}
        <View className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          <View className="flex-row items-center gap-2">
            <Palette size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            <Text className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Manage Color Tags
            </Text>
          </View>
          <Pressable onPress={onClose} className="rounded-full p-2">
            <X size={24} color={isDark ? "white" : "#1e293b"} />
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {/* Existing Tags */}
          {tags.map((tag) => (
            <View
              key={tag.name}
              className={`rounded-xl mb-3 ${
                editingTag === tag.name
                  ? "border-2 border-purple-500"
                  : isDark
                    ? "bg-slate-900"
                    : "bg-slate-50"
              } ${editingTag === tag.name ? (isDark ? "bg-slate-900" : "bg-slate-50") : ""}`}
            >
              {editingTag === tag.name ? (
                // Edit mode
                <View className="p-4">
                  <View className="flex-row gap-3 mb-4">
                    <TextInput
                      className={`flex-1 rounded-lg px-3 py-2 ${
                        isDark ? "bg-slate-800 text-white" : "bg-white text-slate-900 border border-slate-200"
                      }`}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Tag name"
                      placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                      autoFocus
                    />
                    <Pressable
                      className="h-10 w-10 rounded-lg overflow-hidden border-2"
                      style={{ backgroundColor: editColor, borderColor: isDark ? "#475569" : "#cbd5e1" }}
                    />
                  </View>

                  {/* Color picker */}
                  <View className="flex-row flex-wrap gap-2 mb-4">
                    {PRESET_COLORS.map((color) => (
                      <Pressable
                        key={color}
                        onPress={() => setEditColor(color)}
                        className="h-8 w-8 rounded-lg"
                        style={{
                          backgroundColor: color,
                          borderWidth: editColor === color ? 3 : 1,
                          borderColor: editColor === color ? (isDark ? "#fff" : "#1e293b") : (isDark ? "#475569" : "#cbd5e1"),
                        }}
                      />
                    ))}
                  </View>

                  <View className="flex-row justify-end gap-2">
                    <Pressable
                      onPress={cancelEditing}
                      disabled={saving}
                      className={`px-4 py-2 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                    >
                      <Text className={isDark ? "text-white" : "text-slate-900"}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleUpdateTag(tag.name)}
                      disabled={saving || !editName.trim()}
                      className="px-4 py-2 rounded-lg bg-purple-500 flex-row items-center gap-2"
                    >
                      {saving ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Check size={16} color="white" />
                      )}
                      <Text className="text-white font-medium">Save</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                // View mode
                <View className="flex-row items-center p-4">
                  <View
                    className="h-6 w-6 rounded mr-3"
                    style={{ backgroundColor: tag.color }}
                  />
                  <View className="flex-1">
                    <Text className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                      {tag.name}
                    </Text>
                    <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      {getCardCount(tag.name)} card{getCardCount(tag.name) !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View className="flex-row gap-1">
                    <Pressable
                      onPress={() => startEditing(tag)}
                      disabled={saving}
                      className={`p-2 rounded-lg ${isDark ? "active:bg-slate-700" : "active:bg-slate-200"}`}
                    >
                      <Pencil size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteTag(tag.name)}
                      disabled={saving}
                      className={`p-2 rounded-lg ${isDark ? "active:bg-slate-700" : "active:bg-slate-200"}`}
                    >
                      <Trash2 size={18} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ))}

          {/* Add new tag form */}
          {isAdding ? (
            <View className={`rounded-xl p-4 border-2 border-purple-500 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
              <View className="flex-row gap-3 mb-4">
                <TextInput
                  className={`flex-1 rounded-lg px-3 py-2 ${
                    isDark ? "bg-slate-800 text-white" : "bg-white text-slate-900 border border-slate-200"
                  }`}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="New tag name"
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  autoFocus
                />
                <Pressable
                  className="h-10 w-10 rounded-lg overflow-hidden border-2"
                  style={{ backgroundColor: newColor, borderColor: isDark ? "#475569" : "#cbd5e1" }}
                />
              </View>

              {/* Color picker */}
              <View className="flex-row flex-wrap gap-2 mb-4">
                {PRESET_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => setNewColor(color)}
                    className="h-8 w-8 rounded-lg"
                    style={{
                      backgroundColor: color,
                      borderWidth: newColor === color ? 3 : 1,
                      borderColor: newColor === color ? (isDark ? "#fff" : "#1e293b") : (isDark ? "#475569" : "#cbd5e1"),
                    }}
                  />
                ))}
              </View>

              <View className="flex-row justify-end gap-2">
                <Pressable
                  onPress={cancelAdding}
                  disabled={saving}
                  className={`px-4 py-2 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                >
                  <Text className={isDark ? "text-white" : "text-slate-900"}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleAddTag}
                  disabled={saving || !newName.trim()}
                  className="px-4 py-2 rounded-lg bg-purple-500 flex-row items-center gap-2"
                >
                  {saving ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Plus size={16} color="white" />
                  )}
                  <Text className="text-white font-medium">Add Tag</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={startAdding}
              disabled={saving || editingTag !== null}
              className={`flex-row items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed ${
                isDark ? "border-slate-700" : "border-slate-300"
              }`}
            >
              <Plus size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text className={isDark ? "text-slate-400" : "text-slate-500"}>Add New Tag</Text>
            </Pressable>
          )}

          {/* Empty state */}
          {tags.length === 0 && !isAdding && (
            <View className="items-center py-8">
              <Palette size={48} color={isDark ? "#334155" : "#cbd5e1"} />
              <Text className={`mt-4 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                No color tags yet
              </Text>
              <Text className={`text-sm text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Create tags to organize your cards
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Done button */}
        <View className={`px-4 pb-4 pt-2 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          <Pressable
            onPress={onClose}
            className={`py-3 rounded-xl items-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
          >
            <Text className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={confirmDelete.visible}
        title="Delete Tag"
        message={
          confirmDelete.cardsUsingTag > 0
            ? `This tag is used by ${confirmDelete.cardsUsingTag} card${confirmDelete.cardsUsingTag !== 1 ? "s" : ""}. They will become untagged. Continue?`
            : `Delete tag "${confirmDelete.tagName}"?`
        }
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        onConfirm={confirmDeleteTag}
        onCancel={() => setConfirmDelete({ visible: false, tagName: "", cardsUsingTag: 0 })}
      />
    </Modal>
  );
}
