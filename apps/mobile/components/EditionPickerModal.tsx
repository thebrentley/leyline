import { Check, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { cardsApi, type CardSearchResult, type DeckCard } from "~/lib/api";

interface EditionPickerModalProps {
  visible: boolean;
  onClose: () => void;
  card: DeckCard | null;
  onSelectEdition: (scryfallId: string) => void;
  loading?: boolean;
}

function EditionItem({
  edition,
  isCurrent,
  isDark,
  onPress,
  disabled,
}: {
  edition: CardSearchResult;
  isCurrent: boolean;
  isDark: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isCurrent}
      className={`flex-row items-center gap-3 py-3 px-4 border-b ${
        isCurrent
          ? isDark
            ? "bg-slate-800/50 border-slate-700"
            : "bg-slate-100 border-slate-200"
          : isDark
          ? "border-slate-800 active:bg-slate-800/50"
          : "border-slate-100 active:bg-slate-50"
      }`}
    >
      {edition.imageSmall ? (
        <Image
          source={{ uri: edition.imageSmall }}
          className="h-16 w-12 rounded"
          resizeMode="cover"
        />
      ) : (
        <View
          className={`h-16 w-12 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
        />
      )}
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${
            isCurrent
              ? "text-purple-500"
              : isDark
              ? "text-white"
              : "text-slate-900"
          }`}
          numberOfLines={1}
        >
          {edition.setName}
          {isCurrent && " (Current)"}
        </Text>
        <Text
          className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          {edition.setCode?.toUpperCase()} #{edition.collectorNumber}
        </Text>
      </View>
      {edition.priceUsd && (
        <Text className="text-purple-500 text-sm font-medium">
          ${edition.priceUsd}
        </Text>
      )}
      {isCurrent && <Check size={20} color="#7C3AED" />}
    </Pressable>
  );
}

export function EditionPickerModal({
  visible,
  onClose,
  card,
  onSelectEdition,
  loading: actionLoading,
}: EditionPickerModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [editions, setEditions] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEditions = useCallback(async () => {
    if (!card) return;

    setLoading(true);
    setError(null);
    setEditions([]);

    try {
      const result = await cardsApi.getPrints(card.name);
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setEditions(result.data);
        if (result.data.length === 0) {
          setError("No editions found for this card");
        }
      }
    } catch {
      setError("Failed to load editions");
    } finally {
      setLoading(false);
    }
  }, [card]);

  useEffect(() => {
    if (visible && card) {
      fetchEditions();
    }
  }, [visible, card, fetchEditions]);

  const handleClose = () => {
    setEditions([]);
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable
        className="flex-1 items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        onPress={handleClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={`rounded-xl shadow-xl overflow-hidden ${
            isDark ? "bg-slate-900" : "bg-white"
          }`}
          style={{ width: 420, maxHeight: 600 }}
        >
          {/* Header */}
          <View
            className={`flex-row items-center gap-3 px-4 py-3 border-b ${
              isDark ? "border-slate-800" : "border-slate-200"
            }`}
          >
            <View className="flex-1">
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Select Edition
              </Text>
              {card && (
                <Text
                  className={`text-sm ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                  numberOfLines={1}
                >
                  {card.name}
                </Text>
              )}
            </View>
            <Pressable
              onPress={handleClose}
              className={`rounded-full p-2 ${
                isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
              }`}
            >
              <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          </View>

          {/* Content */}
          {loading ? (
            <View className="p-8 items-center">
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text
                className={`mt-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Loading editions...
              </Text>
            </View>
          ) : error ? (
            <View className="p-8 items-center">
              <Text
                className={`text-center ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {error}
              </Text>
            </View>
          ) : editions.length === 0 ? (
            <View className="p-8 items-center">
              <Text
                className={`text-center ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                No editions available
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 500 }}>
              {editions.map((item) => (
                <EditionItem
                  key={item.scryfallId}
                  edition={item}
                  isCurrent={card?.scryfallId === item.scryfallId}
                  isDark={isDark}
                  onPress={() => onSelectEdition(item.scryfallId)}
                  disabled={!!actionLoading}
                />
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
