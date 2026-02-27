import { useCallback, useMemo, useState } from "react";
import { Dimensions } from "react-native";
import { showToast } from "~/lib/toast";
import {
  cardsApi,
  collectionApi,
  decksApi,
  type CardSearchResult,
  type CollectionFolder,
  type DeckCard,
  type DeckDetail,
} from "~/lib/api";
import { cache, CACHE_KEYS } from "~/lib/cache";

export function useDeckCardActions(
  deck: DeckDetail | null,
  id: string,
  loadDeck: (skipCache?: boolean) => Promise<void>,
) {
  // Selected card for detail modal
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [cardModalVisible, setCardModalVisible] = useState(false);

  // Card action sheet state
  const [actionSheetCard, setActionSheetCard] = useState<DeckCard | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [colorTagPickerVisible, setColorTagPickerVisible] = useState(false);
  const [colorTagSubmenuOpen, setColorTagSubmenuOpen] = useState(false);
  const [headerColorTagDropdownOpen, setHeaderColorTagDropdownOpen] =
    useState(false);
  const [editionPickerVisible, setEditionPickerVisible] = useState(false);
  const [editionPickerModalVisible, setEditionPickerModalVisible] =
    useState(false);
  const [editions, setEditions] = useState<CardSearchResult[]>([]);
  const [loadingEditions, setLoadingEditions] = useState(false);
  const [addToCollectionVisible, setAddToCollectionVisible] = useState(false);
  const [addToCollectionSubmenuOpen, setAddToCollectionSubmenuOpen] =
    useState(false);
  const [collectionFolders, setCollectionFolders] = useState<
    CollectionFolder[]
  >([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<DeckCard | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Printing selection modal state
  const [printingSelection, setPrintingSelection] = useState<{
    visible: boolean;
    cardName: string;
    printings: Array<{
      id: string;
      setCode: string;
      collectorNumber: string;
      quantity: number;
      foilQuantity: number;
      scryfallId: string;
      linkedTo?: { deckId: string; deckName: string };
    }>;
    currentScryfallId: string;
  }>({
    visible: false,
    cardName: "",
    printings: [],
    currentScryfallId: "",
  });

  // Already linked confirmation state
  const [alreadyLinkedConfirm, setAlreadyLinkedConfirm] = useState<{
    visible: boolean;
    cardName: string;
    linkedDeck: { deckId: string; deckName: string };
    collectionCardId?: string;
  }>({
    visible: false,
    cardName: "",
    linkedDeck: { deckId: "", deckName: "" },
  });

  // Export & other modals
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [scryfallSearchVisible, setScryfallSearchVisible] = useState(false);
  const [colorTagManagerVisible, setColorTagManagerVisible] = useState(false);
  const [chatPanelVisible, setChatPanelVisible] = useState(false);
  const [advisorPanelVisible, setAdvisorPanelVisible] = useState(false);
  const [landsExpanded, setLandsExpanded] = useState(false);

  const handleCardPress = useCallback((card: DeckCard) => {
    setSelectedCard(card);
    setCardModalVisible(true);
  }, []);

  const closeCardModal = useCallback(() => {
    setCardModalVisible(false);
    setSelectedCard(null);
  }, []);

  const handleCardLongPress = useCallback(
    (card: DeckCard) => {
      if (deck?.isReadOnly) return;
      setActionSheetCard(card);
      setActionSheetVisible(true);
    },
    [deck?.isReadOnly],
  );

  const handleCardRightClick = useCallback(
    (card: DeckCard, position: { x: number; y: number }) => {
      if (deck?.isReadOnly) return;
      const { width: screenW, height: screenH } = Dimensions.get("window");
      const menuW = 280;
      const menuH = 350;
      setActionSheetCard(card);
      setContextMenuPosition({
        x: Math.max(8, Math.min(position.x, screenW - menuW - 8)),
        y: Math.max(8, Math.min(position.y, screenH - menuH - 8)),
      });
    },
    [deck?.isReadOnly],
  );

  const closeActionSheet = useCallback(() => {
    setActionSheetVisible(false);
    setContextMenuPosition(null);
    setActionSheetCard(null);
    setColorTagPickerVisible(false);
    setColorTagSubmenuOpen(false);
    setEditionPickerVisible(false);
    setEditions([]);
    setAddToCollectionVisible(false);
    setAddToCollectionSubmenuOpen(false);
    setCollectionFolders([]);
  }, []);

  const handleSetCommander = useCallback(
    async (cardOverride?: DeckCard) => {
      const card = cardOverride ?? actionSheetCard;
      if (!card || !deck) return;
      setActionLoading(true);
      try {
        const result = await decksApi.setCardCommander(
          deck.id,
          card.name,
          !card.isCommander,
        );
        if (result.error) {
          showToast.error(result.error);
        } else {
          await cache.remove(CACHE_KEYS.DECK_DETAIL(id));
          loadDeck(true);
          closeActionSheet();
        }
      } catch (err) {
        showToast.error("Failed to update commander status");
      } finally {
        setActionLoading(false);
      }
    },
    [actionSheetCard, deck, id, loadDeck, closeActionSheet],
  );

  const handleMoveToSideboard = useCallback(
    async (cardOverride?: DeckCard) => {
      const card = cardOverride ?? actionSheetCard;
      if (!card || !deck) return;
      const isSideboard = card.categories?.includes("Sideboard");
      const newCategory = isSideboard ? "mainboard" : "sideboard";

      setActionLoading(true);
      try {
        const result = await decksApi.setCardCategory(
          deck.id,
          card.name,
          newCategory,
        );
        if (result.error) {
          showToast.error(result.error);
        } else {
          await cache.remove(CACHE_KEYS.DECK_DETAIL(id));
          loadDeck(true);
          closeActionSheet();
        }
      } catch (err) {
        showToast.error("Failed to move card");
      } finally {
        setActionLoading(false);
      }
    },
    [actionSheetCard, deck, id, loadDeck, closeActionSheet],
  );

  const handleSetColorTag = useCallback(
    async (tagId: string | null) => {
      if (!actionSheetCard || !deck) return;
      const cardName = actionSheetCard.name;
      const deckId = deck.id;

      setColorTagPickerVisible(false);
      setColorTagSubmenuOpen(false);
      setContextMenuPosition(null);
      setActionSheetVisible(false);

      setActionLoading(true);
      try {
        const result = await decksApi.updateCardTag(deckId, cardName, tagId);
        if (result.error) {
          showToast.error(result.error);
        } else {
          await cache.remove(CACHE_KEYS.DECK_DETAIL(id));
          loadDeck(true);
        }
      } catch (err) {
        showToast.error("Failed to update color tag");
      } finally {
        setActionLoading(false);
        setActionSheetCard(null);
      }
    },
    [actionSheetCard, deck, id, loadDeck],
  );

  const handleHeaderSetColorTag = useCallback(
    async (tagId: string | null) => {
      if (!selectedCard || !deck) return;
      const cardName = selectedCard.name;
      const deckId = deck.id;

      setHeaderColorTagDropdownOpen(false);

      // Optimistically update the selected card
      const tagColor = tagId
        ? deck.colorTags?.find((t) => t.id === tagId)?.color
        : undefined;
      setSelectedCard((prev) =>
        prev
          ? { ...prev, colorTagId: tagId ?? undefined, colorTag: tagColor }
          : null,
      );

      setActionLoading(true);
      try {
        const result = await decksApi.updateCardTag(deckId, cardName, tagId);
        if (result.error) {
          showToast.error(result.error);
          setSelectedCard((prev) =>
            prev
              ? {
                  ...prev,
                  colorTagId: selectedCard.colorTagId,
                  colorTag: selectedCard.colorTag,
                }
              : null,
          );
        } else {
          await cache.remove(CACHE_KEYS.DECK_DETAIL(id));
          loadDeck(true);
        }
      } catch (err) {
        showToast.error("Failed to update color tag");
        setSelectedCard((prev) =>
          prev
            ? {
                ...prev,
                colorTagId: selectedCard.colorTagId,
                colorTag: selectedCard.colorTag,
              }
            : null,
        );
      } finally {
        setActionLoading(false);
      }
    },
    [selectedCard, deck, id, loadDeck],
  );

  const handleShowEditions = useCallback(async () => {
    if (!actionSheetCard) return;
    setEditionPickerVisible(true);
    setLoadingEditions(true);
    setEditions([]);
    try {
      const result = await cardsApi.getPrints(actionSheetCard.name);
      if (result.error) {
        showToast.error(result.error);
      } else if (result.data) {
        setEditions(result.data);
        if (result.data.length === 0) {
          showToast.info("No editions found for this card");
        }
      }
    } catch (err: any) {
      showToast.error(err?.message || "Failed to load editions");
    } finally {
      setLoadingEditions(false);
    }
  }, [actionSheetCard]);

  const handleShowCollectionFolders = useCallback(async () => {
    if (!actionSheetCard) return;
    setAddToCollectionVisible(true);
    setLoadingFolders(true);
    setCollectionFolders([]);
    try {
      const result = await collectionApi.getFolders();
      if (result.error) {
        showToast.error(result.error);
      } else if (result.data) {
        setCollectionFolders(result.data.folders);
      }
    } catch (err: any) {
      showToast.error(err?.message || "Failed to load folders");
    } finally {
      setLoadingFolders(false);
    }
  }, [actionSheetCard]);

  const handleAddToCollectionFolder = useCallback(
    async (folderId: string | null) => {
      if (!actionSheetCard || !deck) return;
      setActionLoading(true);
      try {
        const addResult = await collectionApi.add(
          actionSheetCard.scryfallId,
          1,
        );
        if (addResult.error) {
          showToast.error(addResult.error);
          return;
        }

        if (folderId && addResult.data) {
          const moveResult = await collectionApi.moveCardsToFolder(
            [addResult.data.id],
            folderId,
          );
          if (moveResult.error) {
            showToast.error(
              `Card added but couldn't move to folder: ${moveResult.error}`,
            );
          }
        }

        if (addResult.data) {
          const linkResult = await decksApi.linkCardToCollection(
            deck.id,
            actionSheetCard.name,
            addResult.data.id,
          );
          if (linkResult.error) {
            showToast.error(
              `Card added but couldn't link to deck: ${linkResult.error}`,
            );
          }
        }

        const folderName = folderId
          ? collectionFolders.find((f) => f.id === folderId)?.name
          : "Unfiled";
        showToast.success(`Added to ${folderName} & linked`);
        cache.remove(CACHE_KEYS.DECK_DETAIL(deck.id));
        loadDeck(true);
        closeActionSheet();
      } catch (err: any) {
        showToast.error(err?.message || "Failed to add to collection");
      } finally {
        setActionLoading(false);
      }
    },
    [actionSheetCard, deck, closeActionSheet, collectionFolders, loadDeck],
  );

  const handleChangeEdition = useCallback(
    async (scryfallId: string) => {
      if (!actionSheetCard || !deck) return;
      setActionLoading(true);
      try {
        const result = await decksApi.changeCardEdition(
          deck.id,
          actionSheetCard.name,
          scryfallId,
        );
        if (result.error) {
          showToast.error(result.error);
        } else {
          await cache.remove(CACHE_KEYS.DECK_DETAIL(id));
          loadDeck(true);
          closeActionSheet();
        }
      } catch (err) {
        showToast.error("Failed to change edition");
      } finally {
        setActionLoading(false);
      }
    },
    [actionSheetCard, deck, id, loadDeck, closeActionSheet],
  );

  const handleLinkToCollection = useCallback(
    async (collectionCardId?: string, forceUnlink?: boolean) => {
      if (!actionSheetCard || !deck) return;
      setActionLoading(true);
      try {
        const result = await decksApi.linkCardToCollection(
          deck.id,
          actionSheetCard.name,
          collectionCardId,
          forceUnlink,
        );

        if (result.error) {
          showToast.error(result.error);
        } else if (result.data?.alreadyLinked) {
          setActionLoading(false);
          setAlreadyLinkedConfirm({
            visible: true,
            cardName: actionSheetCard.name,
            linkedDeck: result.data.alreadyLinked,
            collectionCardId,
          });
          return;
        } else if (
          result.data?.needsSelection &&
          result.data.availablePrintings
        ) {
          setActionLoading(false);
          setPrintingSelection({
            visible: true,
            cardName: actionSheetCard.name,
            printings: result.data.availablePrintings,
            currentScryfallId: actionSheetCard.scryfallId,
          });
          return;
        } else {
          const message = result.data?.editionChanged
            ? "Card edition updated and linked to collection"
            : "Card linked to collection";
          showToast.success(message);
          cache.remove(CACHE_KEYS.DECK_DETAIL(deck.id));
          loadDeck(true);
          closeActionSheet();
        }
      } catch (err: any) {
        showToast.error(err?.message || "Failed to link card");
      } finally {
        setActionLoading(false);
      }
    },
    [actionSheetCard, deck, closeActionSheet, loadDeck],
  );

  const handleAddCardFromSearch = useCallback(
    async (card: CardSearchResult) => {
      if (!deck) return;

      try {
        const result = await decksApi.addCardToDeck(
          deck.id,
          card.scryfallId,
          1,
        );
        if (result.error) {
          showToast.error(result.error);
        } else if (result.data) {
          showToast.success(`Added ${result.data.cardName} to deck`);
          cache.remove(CACHE_KEYS.DECK_DETAIL(deck.id));
          loadDeck(true);
        }
      } catch (err: any) {
        showToast.error(err?.message || "Failed to add card");
      }
    },
    [deck, loadDeck],
  );

  const handleUnlinkFromCollection = useCallback(async () => {
    if (!actionSheetCard || !deck) return;
    setActionLoading(true);
    try {
      const result = await decksApi.unlinkCardFromCollection(
        deck.id,
        actionSheetCard.name,
      );
      if (result.error) {
        showToast.error(result.error);
      } else {
        showToast.success("Card unlinked from collection");
        cache.remove(CACHE_KEYS.DECK_DETAIL(deck.id));
        loadDeck(true);
        closeActionSheet();
      }
    } catch (err) {
      showToast.error("Failed to unlink card");
    } finally {
      setActionLoading(false);
    }
  }, [actionSheetCard, deck, closeActionSheet, loadDeck]);

  const handleRemoveCard = useCallback(() => {
    if (!actionSheetCard || !deck) return;

    const cardToRemove = actionSheetCard.name;
    const deckId = deck.id;

    closeActionSheet();

    setConfirmDialog({
      visible: true,
      title: "Remove Card",
      message: `Remove ${cardToRemove} from this deck?`,
      confirmText: "Remove",
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, visible: false }));

        const performRemove = async () => {
          try {
            const result = await decksApi.removeCardFromDeck(
              deckId,
              cardToRemove,
            );
            if (result.error) {
              showToast.error(result.error);
            } else {
              showToast.success(`Removed ${cardToRemove} from deck`);
              cache.remove(CACHE_KEYS.DECK_DETAIL(deckId));
              loadDeck(true);
            }
          } catch (err: any) {
            showToast.error(err?.message || "Failed to remove card");
          }
        };

        performRemove();
      },
    });
  }, [actionSheetCard, deck, closeActionSheet, loadDeck]);

  const handleLandQuantityChange = useCallback(
    async (landName: string, delta: number) => {
      if (!deck) return;

      try {
        const result = await decksApi.updateCardQuantity(
          deck.id,
          landName,
          delta,
        );
        if (result.error) {
          showToast.error(result.error);
          return;
        }

        await cache.remove(CACHE_KEYS.DECK_DETAIL(id));
        await cache.remove(CACHE_KEYS.DECKS_LIST);
        loadDeck(true);
      } catch (err) {
        showToast.error("Failed to update land quantity");
      }
    },
    [deck, id, loadDeck],
  );

  // Card navigation within the detail modal
  const getCardNavigation = useCallback(
    (allCards: DeckCard[]) => {
      const selectedCardIndex = selectedCard
        ? allCards.findIndex((c) => c.id === selectedCard.id)
        : -1;

      const handlePrevCard = () => {
        if (selectedCardIndex > 0) {
          setSelectedCard(allCards[selectedCardIndex - 1]);
        }
      };

      const handleNextCard = () => {
        if (selectedCardIndex < allCards.length - 1) {
          setSelectedCard(allCards[selectedCardIndex + 1]);
        }
      };

      return { selectedCardIndex, handlePrevCard, handleNextCard };
    },
    [selectedCard],
  );

  return {
    // Selected card / detail modal
    selectedCard,
    setSelectedCard,
    cardModalVisible,
    handleCardPress,
    closeCardModal,
    getCardNavigation,

    // Action sheet / context menu
    actionSheetCard,
    setActionSheetCard,
    actionSheetVisible,
    contextMenuPosition,
    colorTagPickerVisible,
    setColorTagPickerVisible,
    colorTagSubmenuOpen,
    setColorTagSubmenuOpen,
    headerColorTagDropdownOpen,
    setHeaderColorTagDropdownOpen,
    editionPickerVisible,
    setEditionPickerVisible,
    editionPickerModalVisible,
    setEditionPickerModalVisible,
    editions,
    setEditions,
    loadingEditions,
    setLoadingEditions,
    addToCollectionVisible,
    setAddToCollectionVisible,
    addToCollectionSubmenuOpen,
    setAddToCollectionSubmenuOpen,
    collectionFolders,
    setCollectionFolders,
    loadingFolders,
    setLoadingFolders,
    actionLoading,
    setActionLoading,
    hoveredCard,
    setHoveredCard,
    handleCardLongPress,
    handleCardRightClick,
    closeActionSheet,

    // Card actions
    handleSetCommander,
    handleMoveToSideboard,
    handleSetColorTag,
    handleHeaderSetColorTag,
    handleShowEditions,
    handleShowCollectionFolders,
    handleAddToCollectionFolder,
    handleChangeEdition,
    handleLinkToCollection,
    handleAddCardFromSearch,
    handleUnlinkFromCollection,
    handleRemoveCard,
    handleLandQuantityChange,

    // Confirmation dialogs
    confirmDialog,
    setConfirmDialog,
    printingSelection,
    setPrintingSelection,
    alreadyLinkedConfirm,
    setAlreadyLinkedConfirm,

    // Modal visibility
    exportModalVisible,
    setExportModalVisible,
    scryfallSearchVisible,
    setScryfallSearchVisible,
    colorTagManagerVisible,
    setColorTagManagerVisible,
    chatPanelVisible,
    setChatPanelVisible,
    advisorPanelVisible,
    setAdvisorPanelVisible,
    landsExpanded,
    setLandsExpanded,
  };
}
