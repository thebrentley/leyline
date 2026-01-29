import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  useColorScheme,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Button } from "./button";
import { decksApi, type ArchidektDeck, type DeckSummary } from "~/lib/api";
import { showToast } from "~/lib/toast";
import { CheckCircle } from "lucide-react-native";

interface ArchidektDeckDialogProps {
  visible: boolean;
  onConfirm: (archidektId: number) => void;
  onCancel: () => void;
  existingDecks: DeckSummary[];
}

export function ArchidektDeckDialog({
  visible,
  onConfirm,
  onCancel,
  existingDecks,
}: ArchidektDeckDialogProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [loading, setLoading] = useState(false);
  const [archidektDecks, setArchidektDecks] = useState<ArchidektDeck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      loadArchidektDecks();
    } else {
      // Reset state when dialog closes
      setSelectedDeck(null);
    }
  }, [visible]);

  const loadArchidektDecks = async () => {
    setLoading(true);
    try {
      const result = await decksApi.listArchidektDecks();
      if (result.error) {
        showToast.error(result.error);
      } else if (result.data) {
        // Filter out decks that are already added
        const existingArchidektIds = new Set(
          existingDecks
            .filter((d) => d.archidektId !== null)
            .map((d) => d.archidektId)
        );

        const filteredDecks = result.data.filter(
          (deck) => !existingArchidektIds.has(deck.archidektId)
        );

        setArchidektDecks(filteredDecks);
      }
    } catch (err) {
      showToast.error("Failed to load Archidekt decks");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedDeck !== null) {
      onConfirm(selectedDeck);
      setSelectedDeck(null);
    }
  };

  const handleCancel = () => {
    setSelectedDeck(null);
    onCancel();
  };

  const renderDeckItem = ({ item }: { item: ArchidektDeck }) => {
    const isSelected = selectedDeck === item.archidektId;

    return (
      <Pressable
        onPress={() => setSelectedDeck(item.archidektId)}
        className={`p-4 rounded-lg mb-2 border ${
          isSelected
            ? isDark
              ? "bg-purple-900/30 border-purple-500"
              : "bg-purple-50 border-purple-500"
            : isDark
            ? "bg-slate-700 border-slate-600"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text
              className={`text-base font-semibold mb-1 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {item.format && (
              <Text
                className={`text-sm ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}
              >
                {item.format}
              </Text>
            )}
          </View>
          {isSelected && (
            <CheckCircle size={20} color="#7C3AED" />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <Pressable
        className="flex-1 bg-black/50 items-center justify-center p-4"
        onPress={handleCancel}
      >
        <Pressable
          className={`w-full max-w-md rounded-2xl p-6 ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            className={`text-xl font-semibold mb-2 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Add from Archidekt
          </Text>
          <Text
            className={`text-base mb-4 ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Select a deck to import
          </Text>

          {loading ? (
            <View className="py-8 items-center justify-center">
              <ActivityIndicator size="large" color="#7C3AED" />
            </View>
          ) : archidektDecks.length === 0 ? (
            <View className="py-8 items-center justify-center">
              <Text
                className={`text-center ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                No new decks available from Archidekt
              </Text>
            </View>
          ) : (
            <View className="max-h-96 mb-6">
              <FlatList
                data={archidektDecks}
                renderItem={renderDeckItem}
                keyExtractor={(item) => item.archidektId.toString()}
                showsVerticalScrollIndicator={true}
              />
            </View>
          )}

          <View className="flex-row gap-3">
            <Button
              className="flex-1 py-3 px-4"
              variant="secondary"
              onPress={handleCancel}
            >
              <Text
                className={`text-center font-medium ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Cancel
              </Text>
            </Button>
            <Button
              className="flex-1 py-3 px-4"
              onPress={handleConfirm}
              disabled={selectedDeck === null || loading}
            >
              <Text className="text-center font-medium text-white">
                Add Deck
              </Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
