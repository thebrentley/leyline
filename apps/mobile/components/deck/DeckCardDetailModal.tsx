import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
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
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import type { DeckCard, DeckDetail } from "~/lib/api";
import { MANA_COLORS, isBasicLand } from "./deck-detail-constants";

interface DeckCardDetailModalProps {
  visible: boolean;
  selectedCard: DeckCard | null;
  selectedCardIndex: number;
  totalCards: number;
  deck: DeckDetail | null;
  isDark: boolean;
  isDesktop: boolean;
  actionLoading: boolean;
  headerColorTagDropdownOpen: boolean;
  onClose: () => void;
  onPrevCard: () => void;
  onNextCard: () => void;
  onSetCommander: (card: DeckCard) => void;
  onMoveToSideboard: (card: DeckCard) => void;
  onChangeEdition: (card: DeckCard) => void;
  onLinkToCollection: (card: DeckCard) => void;
  onUnlinkFromCollection: (card: DeckCard) => void;
  onRemoveCard: (card: DeckCard) => void;
  onSetColorTag: (card: DeckCard) => void;
  onHeaderSetColorTag: (tagId: string | null) => void;
  onHeaderColorTagDropdownToggle: (open: boolean) => void;
  onLandQuantityChange: (landName: string, delta: number) => void;
  onSelectedCardUpdate: (updater: (prev: DeckCard | null) => DeckCard | null) => void;
}

export function DeckCardDetailModal({
  visible,
  selectedCard,
  selectedCardIndex,
  totalCards,
  deck,
  isDark,
  isDesktop,
  actionLoading,
  headerColorTagDropdownOpen,
  onClose,
  onPrevCard,
  onNextCard,
  onSetCommander,
  onMoveToSideboard,
  onChangeEdition,
  onLinkToCollection,
  onUnlinkFromCollection,
  onRemoveCard,
  onSetColorTag,
  onHeaderSetColorTag,
  onHeaderColorTagDropdownToggle,
  onLandQuantityChange,
  onSelectedCardUpdate,
}: DeckCardDetailModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent={isDesktop}
      animationType={isDesktop ? "fade" : "slide"}
      onRequestClose={onClose}
    >
      {isDesktop ? (
        // Desktop: Dialog with backdrop
        <Pressable
          className="flex-1 bg-black/70 items-center justify-start pt-16 px-6 pb-6"
          onPress={onClose}
        >
          <Pressable
            className={`max-w-5xl w-full max-h-[90vh] rounded-2xl ${isDark ? "bg-slate-900" : "bg-white"} shadow-2xl`}
            style={{ overflow: "visible" as any }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View
              className={`flex-row items-center justify-between px-6 py-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
              style={{ zIndex: 100, overflow: "visible" as any }}
            >
              <View className="flex-row items-center gap-2 flex-1">
                {selectedCard?.isCommander && (
                  <Crown size={20} color="#eab308" />
                )}
                <Text
                  className={`text-lg font-bold flex-1 ${isDark ? "text-white" : "text-slate-900"}`}
                  numberOfLines={1}
                >
                  {selectedCard?.name}
                </Text>
                {selectedCard && selectedCard.quantity > 1 && (
                  <View className="bg-purple-500/20 rounded-full px-2 py-0.5">
                    <Text className="text-purple-500 text-xs font-medium">
                      {selectedCard.quantity}x
                    </Text>
                  </View>
                )}
              </View>

              {/* Navigation */}
              <View
                className="flex-row items-center gap-2"
                style={{ zIndex: 50 }}
              >
                {/* Color Tag Chip with Dropdown - hidden for basic lands */}
                {!(selectedCard && isBasicLand(selectedCard.name)) && (
                  <View
                    style={{
                      position: "relative" as any,
                      zIndex: headerColorTagDropdownOpen ? 1000 : 1,
                    }}
                  >
                    <Pressable
                      onPress={() =>
                        onHeaderColorTagDropdownToggle(
                          !headerColorTagDropdownOpen,
                        )
                      }
                      className={`flex-row items-center gap-1.5 rounded-full px-3 py-1 mr-2 ${
                        selectedCard?.colorTagId
                          ? ""
                          : isDark
                            ? "bg-slate-700"
                            : "bg-slate-100"
                      }`}
                      style={
                        selectedCard?.colorTagId
                          ? { backgroundColor: `${selectedCard.colorTag}20` }
                          : undefined
                      }
                    >
                      {selectedCard?.colorTagId ? (
                        <>
                          <View
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: selectedCard.colorTag }}
                          />
                          <Text
                            className="text-xs font-medium"
                            style={{ color: selectedCard.colorTag }}
                          >
                            {deck?.colorTags?.find(
                              (t) => t.id === selectedCard.colorTagId,
                            )?.name || "Tagged"}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Palette
                            size={12}
                            color={isDark ? "#94a3b8" : "#64748b"}
                          />
                          <Text
                            className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
                          >
                            Tag
                          </Text>
                        </>
                      )}
                      <ChevronDown
                        size={12}
                        color={
                          selectedCard?.colorTag ||
                          (isDark ? "#94a3b8" : "#64748b")
                        }
                      />
                    </Pressable>

                    {/* Dropdown Menu */}
                    {headerColorTagDropdownOpen && (
                      <>
                        {/* Backdrop to close dropdown */}
                        <Pressable
                          style={{
                            position: "fixed" as any,
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 9998,
                          }}
                          onPress={() => onHeaderColorTagDropdownToggle(false)}
                        />
                        <View
                          className={`rounded-lg shadow-xl border ${
                            isDark
                              ? "bg-slate-800 border-slate-700"
                              : "bg-white border-slate-200"
                          }`}
                          style={{
                            position: "absolute" as any,
                            top: "100%",
                            right: 0,
                            marginTop: 4,
                            minWidth: 160,
                            zIndex: 9999,
                          }}
                        >
                          {/* No Tag option */}
                          <Pressable
                            onPress={() => onHeaderSetColorTag(null)}
                            disabled={actionLoading}
                            className={`flex-row items-center gap-2 px-3 py-2 ${
                              isDark
                                ? "hover:bg-slate-700"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <View className="h-4 w-4 rounded-full border border-dashed border-slate-400" />
                            <Text
                              className={`text-sm flex-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                            >
                              No Tag
                            </Text>
                            {!selectedCard?.colorTagId && (
                              <Check size={14} color="#7C3AED" />
                            )}
                          </Pressable>

                          {/* Color tag options */}
                          {deck?.colorTags?.map((tag) => (
                            <Pressable
                              key={tag.id}
                              onPress={() => onHeaderSetColorTag(tag.id)}
                              disabled={actionLoading}
                              className={`flex-row items-center gap-2 px-3 py-2 ${
                                isDark
                                  ? "hover:bg-slate-700"
                                  : "hover:bg-slate-50"
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
                              {selectedCard?.colorTagId === tag.id && (
                                <Check size={14} color="#7C3AED" />
                              )}
                            </Pressable>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                )}
                <Pressable
                  onPress={onPrevCard}
                  disabled={selectedCardIndex <= 0}
                  className={`rounded-full p-2 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"} ${selectedCardIndex <= 0 ? "opacity-30" : ""}`}
                >
                  <ChevronLeft
                    size={20}
                    color={isDark ? "#94a3b8" : "#64748b"}
                  />
                </Pressable>
                <Text
                  className={`text-sm min-w-[50px] text-center ${isDark ? "text-slate-400" : "text-slate-600"}`}
                >
                  {selectedCardIndex + 1} / {totalCards}
                </Text>
                <Pressable
                  onPress={onNextCard}
                  disabled={selectedCardIndex >= totalCards - 1}
                  className={`rounded-full p-2 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"} ${selectedCardIndex >= totalCards - 1 ? "opacity-30" : ""}`}
                >
                  <ChevronRight
                    size={20}
                    color={isDark ? "#94a3b8" : "#64748b"}
                  />
                </Pressable>
                <Pressable
                  onPress={onClose}
                  className={`rounded-full p-2 ml-2 ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
                >
                  <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                </Pressable>
              </View>
            </View>

            {/* Card Content - Side by Side */}
            <ScrollView className="flex-1">
              {selectedCard && (
                <View className="flex-row p-6 gap-6">
                  {/* Left: Card Image */}
                  <View className="w-80 flex-shrink-0">
                    {selectedCard.imageUrl || selectedCard.imageSmall ? (
                      <Image
                        source={{
                          uri:
                            selectedCard.imageUrl || selectedCard.imageSmall,
                        }}
                        style={{
                          width: 320,
                          height: 445,
                          borderRadius: 12,
                        }}
                        resizeMode="contain"
                      />
                    ) : (
                      <View
                        className={`rounded-xl items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
                        style={{
                          width: 320,
                          height: 445,
                        }}
                      >
                        <Text
                          className={`text-lg ${isDark ? "text-slate-500" : "text-slate-400"}`}
                        >
                          {selectedCard.name}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Right: Card Details and Actions */}
                  <View className="flex-1 gap-4">
                    {/* Collection Status */}
                    <CollectionStatus card={selectedCard} isDark={isDark} />

                    {/* Card Details */}
                    <CardDetails card={selectedCard} isDark={isDark} />

                    {/* Action Buttons */}
                    {isBasicLand(selectedCard.name) ? (
                      <BasicLandQuantityControl
                        card={selectedCard}
                        isDark={isDark}
                        onQuantityChange={(delta) => {
                          onSelectedCardUpdate((prev) =>
                            prev
                              ? { ...prev, quantity: prev.quantity + delta }
                              : null,
                          );
                          onLandQuantityChange(selectedCard.name, delta);
                        }}
                      />
                    ) : (
                      <DesktopCardActions
                        card={selectedCard}
                        isDark={isDark}
                        onSetCommander={() => {
                          onClose();
                          onSetCommander(selectedCard);
                        }}
                        onChangeEdition={() => onChangeEdition(selectedCard)}
                        onMoveToSideboard={() => {
                          onClose();
                          onMoveToSideboard(selectedCard);
                        }}
                        onLinkToCollection={() => onLinkToCollection(selectedCard)}
                        onUnlinkFromCollection={() => onUnlinkFromCollection(selectedCard)}
                        onRemoveCard={() => onRemoveCard(selectedCard)}
                      />
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      ) : (
        // Mobile: Full screen modal
        <View
          className="flex-1 bg-slate-950"
          style={{ paddingTop: insets.top }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800">
            <View className="flex-row items-center gap-2 flex-1">
              {selectedCard?.isCommander && (
                <Crown size={20} color="#eab308" />
              )}
              <Text
                className="text-white text-lg font-bold flex-1"
                numberOfLines={1}
              >
                {selectedCard?.name}
              </Text>
              {selectedCard && selectedCard.quantity > 1 && (
                <View className="bg-white/20 rounded-full px-2 py-0.5">
                  <Text className="text-white text-xs font-medium">
                    {selectedCard.quantity}x
                  </Text>
                </View>
              )}
            </View>

            {/* Navigation */}
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={onPrevCard}
                disabled={selectedCardIndex <= 0}
                className={`rounded-full p-2 ${selectedCardIndex <= 0 ? "opacity-30" : ""}`}
              >
                <ChevronLeft size={24} color="white" />
              </Pressable>
              <Text className="text-white/70 text-sm min-w-[50px] text-center">
                {selectedCardIndex + 1} / {totalCards}
              </Text>
              <Pressable
                onPress={onNextCard}
                disabled={selectedCardIndex >= totalCards - 1}
                className={`rounded-full p-2 ${selectedCardIndex >= totalCards - 1 ? "opacity-30" : ""}`}
              >
                <ChevronRight size={24} color="white" />
              </Pressable>
              <Pressable
                onPress={onClose}
                className="rounded-full p-2 ml-2"
              >
                <X size={24} color="white" />
              </Pressable>
            </View>
          </View>

          {/* Card Content */}
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: Math.max(24, insets.bottom + 16),
            }}
          >
            {selectedCard && (
              <>
                {/* Card Image */}
                <View className="items-center mb-6">
                  {selectedCard.imageUrl || selectedCard.imageSmall ? (
                    <Image
                      source={{
                        uri: selectedCard.imageUrl || selectedCard.imageSmall,
                      }}
                      style={{
                        width: Dimensions.get("window").width - 64,
                        height:
                          (Dimensions.get("window").width - 64) * (680 / 488),
                        borderRadius: 12,
                      }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View
                      className="bg-slate-800 rounded-xl items-center justify-center"
                      style={{
                        width: Dimensions.get("window").width - 64,
                        height:
                          (Dimensions.get("window").width - 64) * (680 / 488),
                      }}
                    >
                      <Text className="text-slate-500 text-lg">
                        {selectedCard.name}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Collection Status */}
                <MobileCollectionStatus card={selectedCard} />

                {/* Card Details */}
                <MobileCardDetails card={selectedCard} />

                {/* Action Buttons */}
                <View className="mt-6 gap-2">
                  {/* Set as Commander */}
                  <Button
                    onPress={() => {
                      onClose();
                      onSetCommander(selectedCard);
                    }}
                    variant="secondary"
                    className="p-4"
                  >
                    <View className="flex-row items-center gap-3 w-full">
                      <Crown
                        size={20}
                        color={
                          selectedCard?.isCommander ? "#eab308" : "#94a3b8"
                        }
                      />
                      <Text className="text-white flex-1">
                        {selectedCard?.isCommander
                          ? "Remove as Commander"
                          : "Set as Commander"}
                      </Text>
                    </View>
                  </Button>

                  {/* Set Color Tag */}
                  <Button
                    onPress={() => onSetColorTag(selectedCard)}
                    variant="secondary"
                    className="p-4"
                  >
                    <View className="flex-row items-center gap-3 w-full">
                      <Palette size={20} color="#94a3b8" />
                      <Text className="text-white flex-1">Set Color Tag</Text>
                      {selectedCard?.colorTagId && (
                        <View
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: selectedCard.colorTag }}
                        />
                      )}
                    </View>
                  </Button>

                  {/* Change Edition */}
                  <Button
                    onPress={() => onChangeEdition(selectedCard)}
                    variant="secondary"
                    className="p-4"
                  >
                    <View className="flex-row items-center gap-3">
                      <RefreshCcw size={20} color="#94a3b8" />
                      <Text className="text-white">Change Edition</Text>
                    </View>
                  </Button>

                  {/* Move to Sideboard/Mainboard */}
                  <Button
                    onPress={() => {
                      onClose();
                      onMoveToSideboard(selectedCard);
                    }}
                    variant="secondary"
                    className="p-4"
                  >
                    <View className="flex-row items-center gap-3">
                      <Sidebar size={20} color="#94a3b8" />
                      <Text className="text-white">
                        {selectedCard?.categories?.includes("Sideboard")
                          ? "Move to Mainboard"
                          : "Move to Sideboard"}
                      </Text>
                    </View>
                  </Button>

                  {/* Link/Unlink Collection */}
                  {selectedCard?.isLinkedToCollection ? (
                    <Button
                      onPress={() => onUnlinkFromCollection(selectedCard)}
                      variant="secondary"
                      className="p-4"
                    >
                      <View className="flex-row items-center gap-3">
                        <Unlink size={20} color="#94a3b8" />
                        <Text className="text-white">
                          Unlink from Collection
                        </Text>
                      </View>
                    </Button>
                  ) : (selectedCard?.inCollection ||
                      selectedCard?.inCollectionDifferentPrint) &&
                    selectedCard?.hasAvailableCollectionCard ? (
                    <Button
                      onPress={() => onLinkToCollection(selectedCard)}
                      variant="secondary"
                      className="p-4"
                    >
                      <View className="flex-row items-center gap-3 w-full">
                        <Link size={20} color="#7C3AED" />
                        <View className="flex-1">
                          <Text className="text-purple-500 font-medium">
                            Link to Collection
                          </Text>
                          {selectedCard?.inCollectionDifferentPrint &&
                            !selectedCard?.inCollection && (
                              <Text className="text-slate-400 text-xs mt-0.5">
                                Will change to your collection edition
                              </Text>
                            )}
                        </View>
                      </View>
                    </Button>
                  ) : null}

                  {/* Remove from Deck */}
                  <Button
                    onPress={() => onRemoveCard(selectedCard)}
                    variant="destructive"
                    className="p-4"
                  >
                    <View className="flex-row items-center gap-3">
                      <X size={20} color="white" />
                      <Text className="text-white font-medium">
                        Remove from Deck
                      </Text>
                    </View>
                  </Button>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

// Sub-components to reduce repetition

function CollectionStatus({ card, isDark }: { card: DeckCard; isDark: boolean }) {
  if (!card.isLinkedToCollection && !card.inCollection && !card.inCollectionDifferentPrint) {
    return null;
  }

  return (
    <View className={`rounded-xl p-4 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}>
      <View className="flex-row items-center gap-2">
        {card.isLinkedToCollection ? (
          <>
            <Link size={18} color="#7C3AED" />
            <View className="flex-1">
              <Text className="text-purple-500 font-medium">Linked to Collection</Text>
              <Text className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                This card is linked and tracked in your collection
              </Text>
            </View>
          </>
        ) : card.inCollection ? (
          <>
            <CheckCircle size={18} color="#7C3AED" />
            <View className="flex-1">
              <Text className="text-purple-500 font-medium">In Your Collection</Text>
              <Text className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                You own this exact printing
              </Text>
            </View>
          </>
        ) : (
          <>
            <AlertCircle size={18} color="#f59e0b" />
            <View className="flex-1">
              <Text className="text-amber-500 font-medium">Different Printing in Collection</Text>
              <Text className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                You own this card but a different set/printing
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function MobileCollectionStatus({ card }: { card: DeckCard }) {
  if (!card.isLinkedToCollection && !card.inCollection && !card.inCollectionDifferentPrint) {
    return null;
  }

  return (
    <View className="bg-slate-900 rounded-xl p-4 mb-4">
      <View className="flex-row items-center gap-2">
        {card.isLinkedToCollection ? (
          <>
            <Link size={18} color="#7C3AED" />
            <View className="flex-1">
              <Text className="text-purple-500 font-medium">Linked to Collection</Text>
              <Text className="text-slate-400 text-xs mt-1">
                This card is linked and tracked in your collection
              </Text>
            </View>
          </>
        ) : card.inCollection ? (
          <>
            <CheckCircle size={18} color="#7C3AED" />
            <View className="flex-1">
              <Text className="text-purple-500 font-medium">In Your Collection</Text>
              <Text className="text-slate-400 text-xs mt-1">You own this exact printing</Text>
            </View>
          </>
        ) : (
          <>
            <AlertCircle size={18} color="#f59e0b" />
            <View className="flex-1">
              <Text className="text-amber-500 font-medium">Different Printing in Collection</Text>
              <Text className="text-slate-400 text-xs mt-1">
                You own this card but a different set/printing
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function CardDetails({ card, isDark }: { card: DeckCard; isDark: boolean }) {
  return (
    <View className={`rounded-xl p-4 gap-3 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}>
      {card.typeLine && (
        <View>
          <Text className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}>Type</Text>
          <Text className={isDark ? "text-white" : "text-slate-900"}>{card.typeLine}</Text>
        </View>
      )}
      {card.manaCost && (
        <View>
          <Text className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}>Mana Cost</Text>
          <Text className={`font-mono ${isDark ? "text-white" : "text-slate-900"}`}>{card.manaCost}</Text>
        </View>
      )}
      {card.setCode && (
        <View>
          <Text className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}>Set</Text>
          <Text className={isDark ? "text-white" : "text-slate-900"}>
            {card.setCode.toUpperCase()}
            {card.collectorNumber && ` #${card.collectorNumber}`}
          </Text>
        </View>
      )}
      {card.rarity && (
        <View>
          <Text className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}>Rarity</Text>
          <Text className={`capitalize ${isDark ? "text-white" : "text-slate-900"}`}>{card.rarity}</Text>
        </View>
      )}
      {card.priceUsd != null && (
        <View>
          <Text className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}>Price (USD)</Text>
          <Text className="text-purple-500 font-semibold">${Number(card.priceUsd).toFixed(2)}</Text>
        </View>
      )}
      {card.colorIdentity && card.colorIdentity.length > 0 && (
        <View>
          <Text className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}>Color Identity</Text>
          <View className="flex-row gap-1">
            {card.colorIdentity.map((color) => (
              <View
                key={color}
                className="h-5 w-5 rounded-full border border-slate-300"
                style={{ backgroundColor: MANA_COLORS[color] || "#888" }}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function MobileCardDetails({ card }: { card: DeckCard }) {
  return (
    <View className="bg-slate-900 rounded-xl p-4 gap-3">
      {card.typeLine && (
        <View>
          <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">Type</Text>
          <Text className="text-white">{card.typeLine}</Text>
        </View>
      )}
      {card.manaCost && (
        <View>
          <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">Mana Cost</Text>
          <Text className="text-white font-mono">{card.manaCost}</Text>
        </View>
      )}
      {card.setCode && (
        <View>
          <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">Set</Text>
          <Text className="text-white">
            {card.setCode.toUpperCase()}
            {card.collectorNumber && ` #${card.collectorNumber}`}
          </Text>
        </View>
      )}
      {card.rarity && (
        <View>
          <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">Rarity</Text>
          <Text className="text-white capitalize">{card.rarity}</Text>
        </View>
      )}
      {card.priceUsd != null && (
        <View>
          <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">Price (USD)</Text>
          <Text className="text-purple-400 font-semibold">${Number(card.priceUsd).toFixed(2)}</Text>
        </View>
      )}
      {card.colorIdentity && card.colorIdentity.length > 0 && (
        <View>
          <Text className="text-slate-500 text-xs uppercase tracking-wide mb-1">Color Identity</Text>
          <View className="flex-row gap-1">
            {card.colorIdentity.map((color) => (
              <View
                key={color}
                className="h-5 w-5 rounded-full border border-white/20"
                style={{ backgroundColor: MANA_COLORS[color] || "#888" }}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function BasicLandQuantityControl({
  card,
  isDark,
  onQuantityChange,
}: {
  card: DeckCard;
  isDark: boolean;
  onQuantityChange: (delta: number) => void;
}) {
  return (
    <View className={`rounded-xl p-4 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}>
      <Text className={`text-xs uppercase tracking-wide mb-3 ${isDark ? "text-slate-500" : "text-slate-600"}`}>Quantity</Text>
      <View className="flex-row items-center justify-center gap-4">
        <Pressable
          onPress={() => onQuantityChange(-1)}
          disabled={card.quantity <= 0}
          className={`h-10 w-10 rounded-full items-center justify-center ${
            card.quantity <= 0
              ? "opacity-30"
              : isDark
                ? "bg-slate-700 active:bg-slate-600"
                : "bg-slate-200 active:bg-slate-300"
          }`}
        >
          <Minus size={20} color={isDark ? "#94a3b8" : "#64748b"} />
        </Pressable>
        <Text className={`text-2xl font-bold min-w-[40px] text-center ${isDark ? "text-white" : "text-slate-900"}`}>
          {card.quantity}
        </Text>
        <Pressable
          onPress={() => onQuantityChange(1)}
          className={`h-10 w-10 rounded-full items-center justify-center ${
            isDark
              ? "bg-slate-700 active:bg-slate-600"
              : "bg-slate-200 active:bg-slate-300"
          }`}
        >
          <Plus size={20} color={isDark ? "#94a3b8" : "#64748b"} />
        </Pressable>
      </View>
    </View>
  );
}

function DesktopCardActions({
  card,
  isDark,
  onSetCommander,
  onChangeEdition,
  onMoveToSideboard,
  onLinkToCollection,
  onUnlinkFromCollection,
  onRemoveCard,
}: {
  card: DeckCard;
  isDark: boolean;
  onSetCommander: () => void;
  onChangeEdition: () => void;
  onMoveToSideboard: () => void;
  onLinkToCollection: () => void;
  onUnlinkFromCollection: () => void;
  onRemoveCard: () => void;
}) {
  return (
    <View className="gap-2">
      <Button onPress={onSetCommander} variant="secondary" className="p-3">
        <View className="flex-row items-center gap-3 w-full">
          <Crown size={18} color={card.isCommander ? "#eab308" : "#94a3b8"} />
          <Text className={`flex-1 ${isDark ? "text-white" : "text-slate-900"}`}>
            {card.isCommander ? "Remove as Commander" : "Set as Commander"}
          </Text>
        </View>
      </Button>

      <Button onPress={onChangeEdition} variant="secondary" className="p-3">
        <View className="flex-row items-center gap-3">
          <RefreshCcw size={18} color="#94a3b8" />
          <Text className={isDark ? "text-white" : "text-slate-900"}>Change Edition</Text>
        </View>
      </Button>

      <Button onPress={onMoveToSideboard} variant="secondary" className="p-3">
        <View className="flex-row items-center gap-3">
          <Sidebar size={18} color="#94a3b8" />
          <Text className={isDark ? "text-white" : "text-slate-900"}>
            {card.categories?.includes("Sideboard") ? "Move to Mainboard" : "Move to Sideboard"}
          </Text>
        </View>
      </Button>

      {card.isLinkedToCollection ? (
        <Button onPress={onUnlinkFromCollection} variant="secondary" className="p-3">
          <View className="flex-row items-center gap-3">
            <Unlink size={18} color="#94a3b8" />
            <Text className={isDark ? "text-white" : "text-slate-900"}>Unlink from Collection</Text>
          </View>
        </Button>
      ) : (card.inCollection || card.inCollectionDifferentPrint) &&
        card.hasAvailableCollectionCard ? (
        <Button onPress={onLinkToCollection} variant="secondary" className="p-3">
          <View className="flex-row items-center gap-3 w-full">
            <Link size={18} color="#7C3AED" />
            <View className="flex-1">
              <Text className="text-purple-500 font-medium">Link to Collection</Text>
              {card.inCollectionDifferentPrint && !card.inCollection && (
                <Text className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Will change to your collection edition
                </Text>
              )}
            </View>
          </View>
        </Button>
      ) : null}

      <Button onPress={onRemoveCard} variant="destructive" className="p-3">
        <View className="flex-row items-center gap-3">
          <X size={18} color="white" />
          <Text className="text-white font-medium">Remove from Deck</Text>
        </View>
      </Button>
    </View>
  );
}
