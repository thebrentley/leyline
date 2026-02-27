import type { DeckCard, DeckDetail, CardSearchResult, CollectionFolder } from "~/lib/api";
import { ChatPanel } from "~/components/ChatPanel";
import { ScryfallSearch } from "~/components/ScryfallSearch";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { ColorTagManager } from "~/components/ColorTagManager";
import { DeckExportModal } from "~/components/DeckExportModal";
import { EditionPickerModal } from "~/components/EditionPickerModal";
import { DeckCardDetailModal } from "./DeckCardDetailModal";
import { CardActionSheet } from "./CardActionSheet";
import { DesktopContextMenu } from "./DesktopContextMenu";
import { PrintingSelectionModal } from "./PrintingSelectionModal";
import { DeckOptionsMenu, ViewModeMenu, GroupByMenu } from "./DeckDropdownMenus";
import type { ViewMode, GroupBy, CardSection } from "./deck-detail-constants";
import { cache, CACHE_KEYS } from "~/lib/cache";
import { decksApi, cardsApi, collectionApi } from "~/lib/api";
import { showToast } from "~/lib/toast";

interface DeckModalsProps {
  id: string;
  deck: DeckDetail | null;
  isDark: boolean;
  isDesktop: boolean;

  // Dropdown menus
  menuVisible: boolean;
  menuPosition: { top: number; right: number };
  archidektConnected: boolean;
  onCloseMenu: () => void;
  onExport: () => void;
  onPullFromArchidekt: () => void;
  onDeleteDeck: () => void;

  viewModeMenuVisible: boolean;
  viewModeMenuPosition: { top: number; left: number };
  viewMode: ViewMode;
  onCloseViewModeMenu: () => void;
  onChangeViewMode: (mode: ViewMode) => void;

  groupByMenuVisible: boolean;
  groupByMenuPosition: { top: number; left: number };
  groupBy: GroupBy;
  onCloseGroupByMenu: () => void;
  onChangeGroupBy: (groupBy: GroupBy) => void;
  onExpandSections: (sections: Set<string>) => void;

  // Card detail modal
  cardModalVisible: boolean;
  selectedCard: DeckCard | null;
  selectedCardIndex: number;
  totalCards: number;
  actionLoading: boolean;
  headerColorTagDropdownOpen: boolean;
  onCloseCardModal: () => void;
  onPrevCard: () => void;
  onNextCard: () => void;
  onSetCommander: (card: DeckCard) => void;
  onMoveToSideboard: (card: DeckCard) => void;
  setActionSheetCard: (card: DeckCard | null) => void;
  setEditionPickerModalVisible: (v: boolean) => void;
  handleLinkToCollection: (collectionCardId?: string, forceUnlink?: boolean) => void;
  handleUnlinkFromCollection: () => void;
  handleRemoveCard: () => void;
  setColorTagPickerVisible: (v: boolean) => void;
  onHeaderSetColorTag: (tagId: string | null) => void;
  onHeaderColorTagDropdownToggle: (v: boolean) => void;
  onLandQuantityChange: (landName: string, delta: number) => void;
  onSelectedCardUpdate: (updater: (prev: DeckCard | null) => DeckCard | null) => void;

  // Card action sheet (mobile)
  actionSheetVisible: boolean;
  actionSheetCard: DeckCard | null;
  editionPickerVisible: boolean;
  editions: CardSearchResult[];
  loadingEditions: boolean;
  colorTagPickerVisible: boolean;
  addToCollectionVisible: boolean;
  collectionFolders: CollectionFolder[];
  loadingFolders: boolean;
  onCloseActionSheet: () => void;
  onSetCommanderAction: () => void;
  onMoveToSideboardAction: () => void;
  onSetColorTag: (tagId: string | null) => void;
  onChangeEdition: (scryfallId: string) => void;
  onShowColorTags: () => void;
  onHideColorTags: () => void;
  onShowEditionPicker: (v: boolean) => void;
  onLinkToCollectionAction: () => void;
  onUnlinkFromCollectionAction: () => void;
  onRemoveCardAction: () => void;
  onCardUpdate: (updater: (prev: DeckCard | null) => DeckCard | null) => void;
  onAddToCollectionFolder: (folderId: string | null) => void;
  onHideAddToCollection: () => void;
  setLoadingEditions: (v: boolean) => void;
  setEditions: (editions: CardSearchResult[]) => void;
  setAddToCollectionVisible: (v: boolean) => void;
  setCollectionFolders: (folders: CollectionFolder[]) => void;
  setLoadingFolders: (v: boolean) => void;

  // Desktop context menu
  contextMenuPosition: { x: number; y: number } | null;
  colorTagSubmenuOpen: boolean;
  addToCollectionSubmenuOpen: boolean;
  setColorTagSubmenuOpen: (v: boolean) => void;
  setAddToCollectionSubmenuOpen: (v: boolean) => void;

  // Edition picker modal (desktop)
  editionPickerModalVisible: boolean;
  onCloseEditionPickerModal: () => void;

  // Color tag manager
  colorTagManagerVisible: boolean;
  onCloseColorTagManager: () => void;
  onTagsChanged: (colorTags: any) => void;

  // Chat panel (mobile)
  chatPanelVisible: boolean;
  onCloseChatPanel: () => void;
  advisorChat: any;

  // Confirm dialog
  confirmDialog: {
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    destructive?: boolean;
    onConfirm: () => void;
  };
  onCloseConfirmDialog: () => void;

  // Printing selection
  printingSelection: {
    visible: boolean;
    cardName: string;
    printings: any[];
    currentScryfallId: string;
  };
  onSelectPrinting: (collectionCardId: string) => void;
  onClosePrintingSelection: () => void;

  // Already linked confirmation
  alreadyLinkedConfirm: {
    visible: boolean;
    cardName: string;
    linkedDeck: { deckId: string; deckName: string };
    collectionCardId?: string;
  };
  onConfirmAlreadyLinked: () => void;
  onCancelAlreadyLinked: () => void;

  // Scryfall search
  scryfallSearchVisible: boolean;
  onCloseScryfallSearch: () => void;
  onAddCardFromSearch: (card: CardSearchResult) => void;
  existingCardIds: Set<string>;

  // Export modal
  exportModalVisible: boolean;
  onCloseExportModal: () => void;

  // Deck data reload
  loadDeck: (skipCache?: boolean) => void;
  setDeck: (updater: any) => void;
}

export function DeckModals(props: DeckModalsProps) {
  const {
    id,
    deck,
    isDark,
    isDesktop,
  } = props;

  return (
    <>
      <DeckOptionsMenu
        visible={props.menuVisible}
        position={props.menuPosition}
        isDark={isDark}
        deck={deck}
        archidektConnected={props.archidektConnected}
        onClose={props.onCloseMenu}
        onExport={props.onExport}
        onPullFromArchidekt={props.onPullFromArchidekt}
        onDeleteDeck={props.onDeleteDeck}
      />

      <ViewModeMenu
        visible={props.viewModeMenuVisible}
        position={props.viewModeMenuPosition}
        isDark={isDark}
        isDesktop={isDesktop}
        currentMode={props.viewMode}
        onClose={props.onCloseViewModeMenu}
        onChange={props.onChangeViewMode}
      />

      <GroupByMenu
        visible={props.groupByMenuVisible}
        position={props.groupByMenuPosition}
        isDark={isDark}
        currentGroupBy={props.groupBy}
        deck={deck}
        onClose={props.onCloseGroupByMenu}
        onChange={props.onChangeGroupBy}
        onExpandSections={props.onExpandSections}
      />

      <DeckCardDetailModal
        visible={props.cardModalVisible}
        selectedCard={props.selectedCard}
        selectedCardIndex={props.selectedCardIndex}
        totalCards={props.totalCards}
        deck={deck}
        isDark={isDark}
        isDesktop={isDesktop}
        actionLoading={props.actionLoading}
        headerColorTagDropdownOpen={props.headerColorTagDropdownOpen}
        onClose={props.onCloseCardModal}
        onPrevCard={props.onPrevCard}
        onNextCard={props.onNextCard}
        onSetCommander={(card) => props.onSetCommander(card)}
        onMoveToSideboard={(card) => props.onMoveToSideboard(card)}
        onChangeEdition={(card) => {
          props.setActionSheetCard(card);
          props.setEditionPickerModalVisible(true);
        }}
        onLinkToCollection={(card) => {
          props.setActionSheetCard(card);
          setTimeout(() => props.handleLinkToCollection(), 100);
        }}
        onUnlinkFromCollection={(card) => {
          props.setActionSheetCard(card);
          setTimeout(() => props.handleUnlinkFromCollection(), 100);
        }}
        onRemoveCard={(card) => {
          props.setActionSheetCard(card);
          setTimeout(() => props.handleRemoveCard(), 100);
        }}
        onSetColorTag={(card) => {
          props.setActionSheetCard(card);
          props.setColorTagPickerVisible(true);
        }}
        onHeaderSetColorTag={props.onHeaderSetColorTag}
        onHeaderColorTagDropdownToggle={props.onHeaderColorTagDropdownToggle}
        onLandQuantityChange={props.onLandQuantityChange}
        onSelectedCardUpdate={props.onSelectedCardUpdate}
      />

      <CardActionSheet
        visible={props.actionSheetVisible}
        card={props.actionSheetCard}
        deck={deck}
        isDark={isDark}
        actionLoading={props.actionLoading}
        editionPickerVisible={props.editionPickerVisible}
        editions={props.editions}
        loadingEditions={props.loadingEditions}
        colorTagPickerVisible={props.colorTagPickerVisible}
        addToCollectionVisible={props.addToCollectionVisible}
        collectionFolders={props.collectionFolders}
        loadingFolders={props.loadingFolders}
        onClose={props.onCloseActionSheet}
        onSetCommander={props.onSetCommanderAction}
        onMoveToSideboard={props.onMoveToSideboardAction}
        onSetColorTag={props.onSetColorTag}
        onShowEditions={async () => {
          if (!props.actionSheetCard) return;
          props.setLoadingEditions(true);
          props.onShowEditionPicker(true);
          try {
            const result = await cardsApi.getPrints(props.actionSheetCard.name);
            if (result.data) props.setEditions(result.data);
          } catch {}
          props.setLoadingEditions(false);
        }}
        onChangeEdition={props.onChangeEdition}
        onShowColorTags={props.onShowColorTags}
        onHideColorTags={props.onHideColorTags}
        onShowEditionPicker={props.onShowEditionPicker}
        onLinkToCollection={props.onLinkToCollectionAction}
        onUnlinkFromCollection={props.onUnlinkFromCollectionAction}
        onRemoveCard={props.onRemoveCardAction}
        onLandQuantityChange={props.onLandQuantityChange}
        onCardUpdate={props.onCardUpdate}
        onShowCollectionFolders={async () => {
          props.setAddToCollectionVisible(true);
          if (props.collectionFolders.length === 0 && !props.loadingFolders) {
            props.setLoadingFolders(true);
            try {
              const result = await collectionApi.getFolders();
              if (result.data) props.setCollectionFolders(result.data.folders);
            } catch {}
            props.setLoadingFolders(false);
          }
        }}
        onAddToCollectionFolder={props.onAddToCollectionFolder}
        onHideAddToCollection={props.onHideAddToCollection}
      />

      {isDesktop && props.contextMenuPosition && props.actionSheetCard && (
        <DesktopContextMenu
          card={props.actionSheetCard}
          position={props.contextMenuPosition}
          deck={deck}
          isDark={isDark}
          actionLoading={props.actionLoading}
          colorTagSubmenuOpen={props.colorTagSubmenuOpen}
          addToCollectionSubmenuOpen={props.addToCollectionSubmenuOpen}
          collectionFolders={props.collectionFolders}
          loadingFolders={props.loadingFolders}
          onClose={props.onCloseActionSheet}
          onSetCommander={props.onSetCommanderAction}
          onMoveToSideboard={props.onMoveToSideboardAction}
          onSetColorTag={props.onSetColorTag}
          onChangeEdition={() => {
            props.setEditionPickerModalVisible(true);
          }}
          onLinkToCollection={props.onLinkToCollectionAction}
          onUnlinkFromCollection={props.onUnlinkFromCollectionAction}
          onRemoveCard={props.onRemoveCardAction}
          onLandQuantityChange={props.onLandQuantityChange}
          onCardUpdate={props.onCardUpdate}
          onColorTagSubmenuToggle={props.setColorTagSubmenuOpen}
          onAddToCollectionSubmenuToggle={props.setAddToCollectionSubmenuOpen}
          onAddToCollectionFolder={props.onAddToCollectionFolder}
          onLoadFolders={async () => {
            if (props.collectionFolders.length === 0 && !props.loadingFolders) {
              props.setLoadingFolders(true);
              try {
                const result = await collectionApi.getFolders();
                if (result.data) props.setCollectionFolders(result.data.folders);
              } catch {}
              props.setLoadingFolders(false);
            }
          }}
        />
      )}

      {/* Edition Picker Modal (Desktop) */}
      <EditionPickerModal
        visible={props.editionPickerModalVisible}
        onClose={props.onCloseEditionPickerModal}
        card={props.actionSheetCard}
        onSelectEdition={async (scryfallId) => {
          if (!props.actionSheetCard || !deck) return;
          props.setActionSheetCard(null); // Will set loading via parent
          try {
            const result = await decksApi.changeCardEdition(
              deck.id,
              props.actionSheetCard.name,
              scryfallId,
            );
            if (result.error) {
              showToast.error(result.error);
            } else {
              await cache.remove(CACHE_KEYS.DECK_DETAIL(id));
              const freshDeck = await decksApi.get(deck.id);
              if (freshDeck.data) {
                props.setDeck(freshDeck.data);
              }
              props.onCloseEditionPickerModal();
            }
          } catch {
            showToast.error("Failed to change edition");
          }
        }}
        loading={props.actionLoading}
      />

      {/* Color Tag Manager */}
      {deck && (
        <ColorTagManager
          deck={deck}
          visible={props.colorTagManagerVisible}
          onClose={props.onCloseColorTagManager}
          onTagsChanged={props.onTagsChanged}
          isDark={isDark}
        />
      )}

      {/* AI Advisor Chat Panel - Mobile only */}
      {!isDesktop && deck && (
        <ChatPanel
          deck={deck}
          visible={props.chatPanelVisible}
          onClose={props.onCloseChatPanel}
          isDark={isDark}
          {...props.advisorChat}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        visible={props.confirmDialog.visible}
        title={props.confirmDialog.title}
        message={props.confirmDialog.message}
        confirmText={props.confirmDialog.confirmText || "Confirm"}
        cancelText="Cancel"
        destructive={props.confirmDialog.destructive}
        onConfirm={props.confirmDialog.onConfirm}
        onCancel={props.onCloseConfirmDialog}
      />

      <PrintingSelectionModal
        visible={props.printingSelection.visible}
        cardName={props.printingSelection.cardName}
        printings={props.printingSelection.printings}
        currentScryfallId={props.printingSelection.currentScryfallId}
        isDark={isDark}
        onSelect={props.onSelectPrinting}
        onClose={props.onClosePrintingSelection}
      />

      {/* Already Linked Confirmation */}
      <ConfirmDialog
        visible={props.alreadyLinkedConfirm.visible}
        title="Card Already Linked"
        message={`This card is already linked to your collection in "${props.alreadyLinkedConfirm.linkedDeck.deckName}". Unlink it from that deck and link to this deck instead?`}
        confirmText="Unlink & Link Here"
        cancelText="Cancel"
        destructive={false}
        onConfirm={props.onConfirmAlreadyLinked}
        onCancel={props.onCancelAlreadyLinked}
      />

      {/* Scryfall Search */}
      <ScryfallSearch
        visible={props.scryfallSearchVisible}
        onClose={props.onCloseScryfallSearch}
        onSelectCard={props.onAddCardFromSearch}
        title="Add Card to Deck"
        placeholder="Search for a card..."
        searchContext="deck"
        searchContextId={id}
        existingCardIds={props.existingCardIds}
      />

      {/* Export Modal */}
      {deck && (
        <DeckExportModal
          visible={props.exportModalVisible}
          onClose={props.onCloseExportModal}
          deck={deck}
        />
      )}
    </>
  );
}
