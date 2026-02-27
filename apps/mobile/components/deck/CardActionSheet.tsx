import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  ArrowLeft,
  Check,
  Crown,
  Folder,
  FolderPlus,
  Library,
  Link,
  Minus,
  Palette,
  Plus,
  RefreshCcw,
  Sidebar,
  Unlink,
  X,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import type { CardSearchResult, CollectionFolder, DeckCard, DeckDetail } from "~/lib/api";
import { GlassSheet } from "../ui/GlassSheet";
import { isBasicLand } from "./deck-detail-constants";

interface CardActionSheetProps {
  visible: boolean;
  card: DeckCard | null;
  deck: DeckDetail | null;
  isDark: boolean;
  actionLoading: boolean;
  // Edition picker state
  editionPickerVisible: boolean;
  editions: CardSearchResult[];
  loadingEditions: boolean;
  // Color tag picker state
  colorTagPickerVisible: boolean;
  // Add to collection state
  addToCollectionVisible: boolean;
  collectionFolders: CollectionFolder[];
  loadingFolders: boolean;
  // Callbacks
  onClose: () => void;
  onSetCommander: () => void;
  onMoveToSideboard: () => void;
  onSetColorTag: (tagId: string | null) => void;
  onShowEditions: () => void;
  onChangeEdition: (scryfallId: string) => void;
  onShowColorTags: () => void;
  onHideColorTags: () => void;
  onShowEditionPicker: (show: boolean) => void;
  onLinkToCollection: () => void;
  onUnlinkFromCollection: () => void;
  onRemoveCard: () => void;
  onLandQuantityChange: (landName: string, delta: number) => void;
  onCardUpdate: (updater: (prev: DeckCard | null) => DeckCard | null) => void;
  onShowCollectionFolders: () => void;
  onAddToCollectionFolder: (folderId: string | null) => void;
  onHideAddToCollection: () => void;
}

export function CardActionSheet({
  visible,
  card,
  deck,
  isDark,
  actionLoading,
  editionPickerVisible,
  editions,
  loadingEditions,
  colorTagPickerVisible,
  addToCollectionVisible,
  collectionFolders,
  loadingFolders,
  onClose,
  onSetCommander,
  onMoveToSideboard,
  onSetColorTag,
  onShowEditions,
  onChangeEdition,
  onShowColorTags,
  onHideColorTags,
  onShowEditionPicker,
  onLinkToCollection,
  onUnlinkFromCollection,
  onRemoveCard,
  onLandQuantityChange,
  onCardUpdate,
  onShowCollectionFolders,
  onAddToCollectionFolder,
  onHideAddToCollection,
}: CardActionSheetProps) {
  return (
    <GlassSheet visible={visible} onDismiss={onClose} isDark={isDark}>
      <BottomSheetScrollView>
        {/* Card Header */}
        {card && (
          <View
            className={`flex-row items-center gap-3 p-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
          >
            {card.imageSmall && (
              <Image
                source={{ uri: card.imageSmall }}
                className="h-14 w-10 rounded"
                resizeMode="cover"
              />
            )}
            <View className="flex-1">
              <Text
                className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                numberOfLines={1}
              >
                {card.name}
              </Text>
              <Text
                className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                {card.setCode?.toUpperCase()} #
                {card.collectorNumber}
              </Text>
            </View>
            <Pressable onPress={onClose} className="p-2">
              <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          </View>
        )}

        {/* Edition Picker View */}
        {editionPickerVisible ? (
          <View>
            <View
              className={`flex-row items-center gap-2 p-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
            >
              <Pressable
                onPress={() => onShowEditionPicker(false)}
                className="p-1"
              >
                <ArrowLeft
                  size={20}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              </Pressable>
              <Text
                className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Select Edition
              </Text>
            </View>
            {loadingEditions ? (
              <View className="p-8 items-center">
                <ActivityIndicator size="large" color="#7C3AED" />
              </View>
            ) : editions.length === 0 ? (
              <View className="p-8 items-center">
                <Text
                  className={`text-center ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  No editions found for this card
                </Text>
              </View>
            ) : (
              editions.map((edition) => {
                const isCurrent =
                  card?.scryfallId === edition.scryfallId;
                return (
                  <Pressable
                    key={edition.scryfallId}
                    onPress={() =>
                      onChangeEdition(edition.scryfallId)
                    }
                    disabled={actionLoading || isCurrent}
                    className={`flex-row items-center gap-3 p-3 border-b ${
                      isCurrent
                        ? isDark
                          ? "bg-slate-800/50 border-slate-700"
                          : "bg-slate-100 border-slate-200"
                        : isDark
                          ? "border-slate-800 active:bg-slate-800"
                          : "border-slate-100 active:bg-slate-50"
                    }`}
                  >
                    {edition.imageSmall && (
                      <Image
                        source={{ uri: edition.imageSmall }}
                        className="h-12 w-9 rounded"
                        resizeMode="cover"
                      />
                    )}
                    <View className="flex-1">
                      <Text
                        className={`font-medium ${
                          isCurrent
                            ? "text-purple-500"
                            : isDark
                              ? "text-white"
                              : "text-slate-900"
                        }`}
                      >
                        {edition.setName}
                        {isCurrent && " (Current)"}
                      </Text>
                      <Text
                        className={`text-xs ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {edition.setCode?.toUpperCase()} #
                        {edition.collectorNumber}
                      </Text>
                    </View>
                    {edition.priceUsd && (
                      <Text className="text-purple-500 text-sm">
                        ${edition.priceUsd}
                      </Text>
                    )}
                    {isCurrent && <Check size={18} color="#7C3AED" />}
                  </Pressable>
                );
              })
            )}
          </View>
        ) : colorTagPickerVisible ? (
          /* Color Tag Picker View */
          <View>
            <View
              className={`flex-row items-center gap-2 p-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
            >
              <Pressable
                onPress={onHideColorTags}
                className="p-1"
              >
                <ArrowLeft
                  size={20}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              </Pressable>
              <Text
                className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Set Color Tag
              </Text>
            </View>
            <Pressable
              onPress={() => onSetColorTag(null)}
              disabled={actionLoading}
              className={`flex-row items-center gap-3 p-4 border-b ${
                isDark
                  ? "border-slate-800 active:bg-slate-800"
                  : "border-slate-100 active:bg-slate-50"
              }`}
            >
              <View className="h-6 w-6 rounded-full border-2 border-dashed border-slate-400" />
              <Text className={isDark ? "text-white" : "text-slate-900"}>
                No Tag
              </Text>
              {!card?.colorTagId && (
                <Check size={18} color="#7C3AED" />
              )}
            </Pressable>
            {deck?.colorTags?.map((tag) => (
              <Pressable
                key={tag.id}
                onPress={() => onSetColorTag(tag.id)}
                disabled={actionLoading}
                className={`flex-row items-center gap-3 p-4 border-b ${
                  isDark
                    ? "border-slate-800 active:bg-slate-800"
                    : "border-slate-100 active:bg-slate-50"
                }`}
              >
                <View
                  className="h-6 w-6 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <Text
                  className={`flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  {tag.name}
                </Text>
                {card?.colorTagId === tag.id && (
                  <Check size={18} color="#7C3AED" />
                )}
              </Pressable>
            ))}
          </View>
        ) : addToCollectionVisible ? (
          /* Add to Collection Folder Picker View */
          <View>
            <View
              className={`flex-row items-center gap-2 p-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
            >
              <Pressable
                onPress={onHideAddToCollection}
                className="p-1"
              >
                <ArrowLeft
                  size={20}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              </Pressable>
              <Text
                className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Add to Collection
              </Text>
            </View>
            {loadingFolders ? (
              <View className="p-8 items-center">
                <ActivityIndicator size="large" color="#7C3AED" />
              </View>
            ) : (
              <>
                {/* Unfiled option */}
                <Pressable
                  onPress={() => onAddToCollectionFolder(null)}
                  disabled={actionLoading}
                  className={`flex-row items-center gap-3 p-4 border-b ${
                    isDark
                      ? "border-slate-800 active:bg-slate-800"
                      : "border-slate-100 active:bg-slate-50"
                  }`}
                >
                  <Library
                    size={18}
                    color={isDark ? "#94a3b8" : "#64748b"}
                  />
                  <Text
                    className={`flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    Unfiled
                  </Text>
                </Pressable>
                {/* Folder options */}
                {collectionFolders.map((folder) => (
                  <Pressable
                    key={folder.id}
                    onPress={() => onAddToCollectionFolder(folder.id)}
                    disabled={actionLoading}
                    className={`flex-row items-center gap-3 p-4 border-b ${
                      isDark
                        ? "border-slate-800 active:bg-slate-800"
                        : "border-slate-100 active:bg-slate-50"
                    }`}
                  >
                    <Folder
                      size={18}
                      color={isDark ? "#94a3b8" : "#64748b"}
                    />
                    <View className="flex-1">
                      <Text
                        className={
                          isDark ? "text-white" : "text-slate-900"
                        }
                      >
                        {folder.name}
                      </Text>
                      <Text
                        className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                      >
                        {folder.cardCount} cards
                      </Text>
                    </View>
                  </Pressable>
                ))}
                {collectionFolders.length === 0 && (
                  <View className="p-4 items-center">
                    <Text
                      className={
                        isDark ? "text-slate-400" : "text-slate-500"
                      }
                    >
                      No folders yet
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        ) : card && isBasicLand(card.name) ? (
          /* Basic Land: quantity control only */
          <View className="py-4 px-4">
            <Text
              className={`text-xs uppercase tracking-wide mb-3 text-center ${isDark ? "text-slate-500" : "text-slate-600"}`}
            >
              Quantity
            </Text>
            <View className="flex-row items-center justify-center gap-6">
              <Pressable
                onPress={() => {
                  onCardUpdate((prev) =>
                    prev ? { ...prev, quantity: prev.quantity - 1 } : null,
                  );
                  onLandQuantityChange(card.name, -1);
                }}
                disabled={card.quantity <= 0}
                className={`h-12 w-12 rounded-full items-center justify-center ${
                  card.quantity <= 0
                    ? "opacity-30"
                    : isDark
                      ? "bg-slate-700 active:bg-slate-600"
                      : "bg-slate-200 active:bg-slate-300"
                }`}
              >
                <Minus size={24} color={isDark ? "#94a3b8" : "#64748b"} />
              </Pressable>
              <Text
                className={`text-3xl font-bold min-w-[48px] text-center ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {card.quantity}
              </Text>
              <Pressable
                onPress={() => {
                  onCardUpdate((prev) =>
                    prev ? { ...prev, quantity: prev.quantity + 1 } : null,
                  );
                  onLandQuantityChange(card.name, 1);
                }}
                className={`h-12 w-12 rounded-full items-center justify-center ${
                  isDark
                    ? "bg-slate-700 active:bg-slate-600"
                    : "bg-slate-200 active:bg-slate-300"
                }`}
              >
                <Plus size={24} color={isDark ? "#94a3b8" : "#64748b"} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="py-2">
            {/* Set as Commander */}
            <Pressable
              onPress={onSetCommander}
              disabled={actionLoading}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                isDark ? "active:bg-slate-800" : "active:bg-slate-50"
              }`}
            >
              <Crown
                size={20}
                color={
                  card?.isCommander
                    ? "#eab308"
                    : isDark
                      ? "#94a3b8"
                      : "#64748b"
                }
              />
              <Text className={isDark ? "text-white" : "text-slate-900"}>
                {card?.isCommander
                  ? "Remove as Commander"
                  : "Set as Commander"}
              </Text>
            </Pressable>

            {/* Set Color Tag */}
            <Pressable
              onPress={onShowColorTags}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                isDark ? "active:bg-slate-800" : "active:bg-slate-50"
              }`}
            >
              <Palette size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Set Color Tag
              </Text>
              {card?.colorTagId && (
                <View
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: card.colorTag }}
                />
              )}
            </Pressable>

            {/* Change Edition */}
            <Pressable
              onPress={onShowEditions}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                isDark ? "active:bg-slate-800" : "active:bg-slate-50"
              }`}
            >
              <RefreshCcw
                size={20}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
              <Text className={isDark ? "text-white" : "text-slate-900"}>
                Change Edition
              </Text>
            </Pressable>

            {/* Move to Sideboard/Mainboard */}
            <Pressable
              onPress={onMoveToSideboard}
              disabled={actionLoading}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                isDark ? "active:bg-slate-800" : "active:bg-slate-50"
              }`}
            >
              <Sidebar size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text className={isDark ? "text-white" : "text-slate-900"}>
                {card?.categories?.includes("Sideboard")
                  ? "Move to Mainboard"
                  : "Move to Sideboard"}
              </Text>
            </Pressable>

            {/* Add to Collection */}
            <Pressable
              onPress={onShowCollectionFolders}
              disabled={actionLoading}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                isDark ? "active:bg-slate-800" : "active:bg-slate-50"
              }`}
            >
              <FolderPlus
                size={20}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
              <Text className={isDark ? "text-white" : "text-slate-900"}>
                Add to Collection
              </Text>
            </Pressable>

            {/* Collection linking/unlinking - only show if applicable */}
            {((card?.inCollection ||
              card?.inCollectionDifferentPrint) &&
              !card?.isLinkedToCollection) ||
            card?.isLinkedToCollection ? (
              <>
                {/* Separator */}
                <View
                  className={`my-2 h-px ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                />

                {/* Link to Collection */}
                {(card?.inCollection ||
                  card?.inCollectionDifferentPrint) &&
                  !card?.isLinkedToCollection &&
                  card?.hasAvailableCollectionCard && (
                    <Pressable
                      onPress={onLinkToCollection}
                      disabled={actionLoading}
                      className={`flex-row items-center gap-3 px-4 py-3 ${
                        isDark
                          ? "active:bg-slate-800"
                          : "active:bg-slate-50"
                      }`}
                    >
                      <Link size={20} color="#7C3AED" />
                      <View className="flex-1">
                        <Text className="text-purple-500 font-medium">
                          Link to Collection
                        </Text>
                        {card?.inCollectionDifferentPrint &&
                          !card?.inCollection && (
                            <Text
                              className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                            >
                              Will change to your collection edition
                            </Text>
                          )}
                      </View>
                    </Pressable>
                  )}

                {/* Unlink from Collection */}
                {card?.isLinkedToCollection && (
                  <Pressable
                    onPress={onUnlinkFromCollection}
                    disabled={actionLoading}
                    className={`flex-row items-center gap-3 px-4 py-3 ${
                      isDark ? "active:bg-slate-800" : "active:bg-slate-50"
                    }`}
                  >
                    <Unlink
                      size={20}
                      color={isDark ? "#94a3b8" : "#64748b"}
                    />
                    <Text
                      className={isDark ? "text-white" : "text-slate-900"}
                    >
                      Unlink from Collection
                    </Text>
                  </Pressable>
                )}
              </>
            ) : null}

            {/* Remove Card from Deck */}
            <View
              className={`my-2 h-px ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
            />
            <Pressable
              onPress={onRemoveCard}
              disabled={actionLoading}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                isDark ? "active:bg-slate-800" : "active:bg-slate-50"
              }`}
            >
              <X size={20} color="#ef4444" />
              <Text className="text-red-500 font-medium">
                Remove from Deck
              </Text>
            </Pressable>
          </View>
        )}

        {actionLoading && (
          <View className="absolute inset-0 bg-black/20 items-center justify-center">
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        )}
      </BottomSheetScrollView>
    </GlassSheet>
  );
}
