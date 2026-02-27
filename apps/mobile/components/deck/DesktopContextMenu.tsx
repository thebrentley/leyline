import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  Check,
  ChevronRight,
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
import type { CollectionFolder, DeckCard, DeckDetail } from "~/lib/api";
import { isBasicLand } from "./deck-detail-constants";

interface DesktopContextMenuProps {
  card: DeckCard;
  position: { x: number; y: number };
  deck: DeckDetail | null;
  isDark: boolean;
  actionLoading: boolean;
  colorTagSubmenuOpen: boolean;
  addToCollectionSubmenuOpen: boolean;
  collectionFolders: CollectionFolder[];
  loadingFolders: boolean;
  onClose: () => void;
  onSetCommander: () => void;
  onMoveToSideboard: () => void;
  onSetColorTag: (tagId: string | null) => void;
  onChangeEdition: () => void;
  onLinkToCollection: () => void;
  onUnlinkFromCollection: () => void;
  onRemoveCard: () => void;
  onLandQuantityChange: (landName: string, delta: number) => void;
  onCardUpdate: (updater: (prev: DeckCard | null) => DeckCard | null) => void;
  onColorTagSubmenuToggle: (open: boolean) => void;
  onAddToCollectionSubmenuToggle: (open: boolean) => void;
  onAddToCollectionFolder: (folderId: string | null) => void;
  onLoadFolders: () => void;
}

export function DesktopContextMenu({
  card,
  position,
  deck,
  isDark,
  actionLoading,
  colorTagSubmenuOpen,
  addToCollectionSubmenuOpen,
  collectionFolders,
  loadingFolders,
  onClose,
  onSetCommander,
  onMoveToSideboard,
  onSetColorTag,
  onChangeEdition,
  onLinkToCollection,
  onUnlinkFromCollection,
  onRemoveCard,
  onLandQuantityChange,
  onCardUpdate,
  onColorTagSubmenuToggle,
  onAddToCollectionSubmenuToggle,
  onAddToCollectionFolder,
  onLoadFolders,
}: DesktopContextMenuProps) {
  return (
    <Pressable
      style={{
        position: "fixed" as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
      }}
      onPress={onClose}
    >
      <View
        className={`rounded-lg shadow-xl border ${
          isDark
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-200"
        }`}
        style={{
          position: "fixed" as any,
          left: position.x,
          top: position.y,
          minWidth: 200,
          maxWidth: 280,
          zIndex: 51,
        }}
        onStartShouldSetResponder={() => true}
      >
        {/* Card name header */}
        <View
          className={`px-3 py-2 border-b ${isDark ? "border-slate-700" : "border-slate-100"}`}
        >
          <Text
            className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}
            numberOfLines={1}
          >
            {card.name}
          </Text>
        </View>

        {isBasicLand(card.name) ? (
          /* Basic Land: quantity control only */
          <View className="flex-row items-center justify-center gap-3 px-3 py-3">
            <Pressable
              onPress={() => {
                onCardUpdate((prev) =>
                  prev ? { ...prev, quantity: prev.quantity - 1 } : null,
                );
                onLandQuantityChange(card.name, -1);
              }}
              disabled={card.quantity <= 0}
              className={`h-8 w-8 rounded-full items-center justify-center ${
                card.quantity <= 0
                  ? "opacity-30"
                  : isDark
                    ? "bg-slate-700 hover:bg-slate-600"
                    : "bg-slate-200 hover:bg-slate-300"
              }`}
            >
              <Minus size={16} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
            <Text
              className={`text-lg font-bold min-w-[32px] text-center ${isDark ? "text-white" : "text-slate-900"}`}
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
              className={`h-8 w-8 rounded-full items-center justify-center ${
                isDark
                  ? "bg-slate-700 hover:bg-slate-600"
                  : "bg-slate-200 hover:bg-slate-300"
              }`}
            >
              <Plus size={16} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          </View>
        ) : (
          <>
            {/* Set as Commander */}
            <Pressable
              onPress={onSetCommander}
              disabled={actionLoading}
              className={`flex-row items-center gap-2 px-3 py-2 ${
                isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
              }`}
            >
              <Crown
                size={16}
                color={
                  card.isCommander
                    ? "#eab308"
                    : isDark
                      ? "#94a3b8"
                      : "#64748b"
                }
              />
              <Text
                className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {card.isCommander
                  ? "Remove as Commander"
                  : "Set as Commander"}
              </Text>
            </Pressable>

            {/* Set Color Tag - with hover submenu */}
            <View
              style={{ position: "relative" as any }}
              // @ts-ignore - web-only hover events
              onMouseEnter={() => onColorTagSubmenuToggle(true)}
              onMouseLeave={() => onColorTagSubmenuToggle(false)}
            >
              <View
                className={`flex-row items-center gap-2 px-3 py-2 ${
                  colorTagSubmenuOpen
                    ? isDark
                      ? "bg-slate-700"
                      : "bg-slate-50"
                    : ""
                }`}
              >
                <Palette size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text
                  className={`text-sm flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Set Color Tag
                </Text>
                {card.colorTagId && (
                  <View
                    className="h-3 w-3 rounded-full mr-1"
                    style={{ backgroundColor: card.colorTag }}
                  />
                )}
                <ChevronRight
                  size={14}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              </View>

              {/* Color Tag Submenu */}
              {colorTagSubmenuOpen && (
                <View
                  className={`rounded-lg shadow-xl border ${
                    isDark
                      ? "bg-slate-800 border-slate-700"
                      : "bg-white border-slate-200"
                  }`}
                  style={{
                    position: "absolute" as any,
                    ...(position.x + 280 + 160 >
                    Dimensions.get("window").width
                      ? { right: "100%" }
                      : { left: "100%" }),
                    top: 0,
                    minWidth: 160,
                    zIndex: 52,
                  }}
                >
                  {/* No Tag option */}
                  <Pressable
                    onPress={() => onSetColorTag(null)}
                    disabled={actionLoading}
                    className={`flex-row items-center gap-2 px-3 py-2 ${
                      isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                    }`}
                  >
                    <View className="h-4 w-4 rounded-full border border-dashed border-slate-400" />
                    <Text
                      className={`text-sm flex-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                    >
                      No Tag
                    </Text>
                    {!card.colorTagId && (
                      <Check size={14} color="#7C3AED" />
                    )}
                  </Pressable>

                  {/* Color tag options */}
                  {deck?.colorTags?.map((tag) => (
                    <Pressable
                      key={tag.id}
                      onPress={() => onSetColorTag(tag.id)}
                      disabled={actionLoading}
                      className={`flex-row items-center gap-2 px-3 py-2 ${
                        isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                      }`}
                    >
                      <View
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <Text
                        className={`text-sm flex-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                      >
                        {tag.name}
                      </Text>
                      {card.colorTagId === tag.id && (
                        <Check size={14} color="#7C3AED" />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Change Edition */}
            <Pressable
              onPress={onChangeEdition}
              className={`flex-row items-center gap-2 px-3 py-2 ${
                isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
              }`}
            >
              <RefreshCcw
                size={16}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
              <Text
                className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Change Edition
              </Text>
            </Pressable>

            {/* Move to Sideboard/Mainboard */}
            <Pressable
              onPress={onMoveToSideboard}
              disabled={actionLoading}
              className={`flex-row items-center gap-2 px-3 py-2 ${
                isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
              }`}
            >
              <Sidebar size={16} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {card.categories?.includes("Sideboard")
                  ? "Move to Mainboard"
                  : "Move to Sideboard"}
              </Text>
            </Pressable>

            {/* Add to Collection - with hover submenu */}
            <View
              style={{ position: "relative" as any }}
              // @ts-ignore - web-only hover events
              onMouseEnter={() => {
                onAddToCollectionSubmenuToggle(true);
                if (collectionFolders.length === 0 && !loadingFolders) {
                  onLoadFolders();
                }
              }}
              onMouseLeave={() => onAddToCollectionSubmenuToggle(false)}
            >
              <View
                className={`flex-row items-center gap-2 px-3 py-2 ${
                  addToCollectionSubmenuOpen
                    ? isDark
                      ? "bg-slate-700"
                      : "bg-slate-50"
                    : ""
                }`}
              >
                <FolderPlus
                  size={16}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
                <Text
                  className={`text-sm flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Add to Collection
                </Text>
                <ChevronRight
                  size={14}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              </View>

              {/* Folder Submenu */}
              {addToCollectionSubmenuOpen && (
                <View
                  className={`rounded-lg shadow-xl border ${
                    isDark
                      ? "bg-slate-800 border-slate-700"
                      : "bg-white border-slate-200"
                  }`}
                  style={{
                    position: "absolute" as any,
                    ...(position.x + 280 + 180 >
                    Dimensions.get("window").width
                      ? { right: "100%" }
                      : { left: "100%" }),
                    top: 0,
                    minWidth: 180,
                    zIndex: 52,
                  }}
                >
                  {loadingFolders ? (
                    <View className="p-4 items-center">
                      <ActivityIndicator size="small" color="#7C3AED" />
                    </View>
                  ) : (
                    <>
                      {/* Unfiled option */}
                      <Pressable
                        onPress={() => onAddToCollectionFolder(null)}
                        disabled={actionLoading}
                        className={`flex-row items-center gap-2 px-3 py-2 ${
                          isDark
                            ? "hover:bg-slate-700"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <Library
                          size={14}
                          color={isDark ? "#94a3b8" : "#64748b"}
                        />
                        <Text
                          className={`text-sm flex-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                        >
                          Unfiled
                        </Text>
                      </Pressable>

                      {/* Folder options */}
                      {collectionFolders.map((folder) => (
                        <Pressable
                          key={folder.id}
                          onPress={() =>
                            onAddToCollectionFolder(folder.id)
                          }
                          disabled={actionLoading}
                          className={`flex-row items-center gap-2 px-3 py-2 ${
                            isDark
                              ? "hover:bg-slate-700"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <Folder
                            size={14}
                            color={isDark ? "#94a3b8" : "#64748b"}
                          />
                          <Text
                            className={`text-sm flex-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                          >
                            {folder.name}
                          </Text>
                          <Text
                            className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
                          >
                            {folder.cardCount}
                          </Text>
                        </Pressable>
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>

            {/* Collection linking */}
            {(card.inCollection ||
              card.inCollectionDifferentPrint) &&
              !card.isLinkedToCollection &&
              card.hasAvailableCollectionCard && (
                <Pressable
                  onPress={onLinkToCollection}
                  disabled={actionLoading}
                  className={`flex-row items-center gap-2 px-3 py-2 ${
                    isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                  }`}
                >
                  <Link size={16} color="#7C3AED" />
                  <Text className="text-sm text-purple-500 font-medium">
                    Link to Collection
                  </Text>
                </Pressable>
              )}

            {card.isLinkedToCollection && (
              <Pressable
                onPress={onUnlinkFromCollection}
                disabled={actionLoading}
                className={`flex-row items-center gap-2 px-3 py-2 ${
                  isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                }`}
              >
                <Unlink size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text
                  className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Unlink from Collection
                </Text>
              </Pressable>
            )}

            {/* Separator */}
            <View
              className={`my-1 h-px ${isDark ? "bg-slate-700" : "bg-slate-100"}`}
            />

            {/* Remove Card */}
            <Pressable
              onPress={onRemoveCard}
              disabled={actionLoading}
              className={`flex-row items-center gap-2 px-3 py-2 ${
                isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
              }`}
            >
              <X size={16} color="#ef4444" />
              <Text className="text-sm text-red-500">Remove from Deck</Text>
            </Pressable>
          </>
        )}
      </View>
    </Pressable>
  );
}
