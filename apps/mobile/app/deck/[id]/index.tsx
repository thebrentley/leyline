import {
  router,
  Stack,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import {
  ChevronDown,
  ChevronLeft,
  CloudDownload,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from "react-native";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";
import { AdvisorSidePanel } from "~/components/AdvisorSidePanel";
import { useResponsive } from "~/hooks/useResponsive";
import { GlassFab } from "~/components/ui/GlassFab";
import { HeaderButton, HeaderButtonGroup } from "~/components/ui/HeaderButton";
import { useAdvisorChat } from "~/hooks/useAdvisorChat";
import { useDeckDetail } from "~/hooks/useDeckDetail";
import { useDeckSections } from "~/hooks/useDeckSections";
import { useDeckCardActions } from "~/hooks/useDeckCardActions";
import { cache, CACHE_KEYS } from "~/lib/cache";
import {
  BasicLandControls,
  CardListItem,
  CardGridItem,
  DeckDesktopHeader,
  DeckMobileMetadata,
  DeckToolbar,
  DeckStacksView,
  DeckModals,
} from "~/components/deck";

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();
  const navigation = useNavigation();

  // --- Hooks ---
  const deckDetail = useDeckDetail(id);
  const {
    deck,
    setDeck,
    loading,
    refreshing,
    syncing,
    error,
    viewMode,
    archidektConnected,
    loadDeck,
    handleRefresh,
    performSync,
    handlePullFromArchidekt,
    handleDeleteDeck,
    handleToggleVisibility,
    changeViewMode,
  } = deckDetail;

  const deckSections = useDeckSections(deck, viewMode);
  const {
    groupBy,
    setGroupBy,
    expandedSections,
    setExpandedSections,
    searchQuery,
    setSearchQuery,
    searchVisible,
    toggleSearch,
    setStacksContainerWidth,
    basicLandCounts,
    existingCardIds,
    sections,
    filteredSections,
    stacksColumns,
    allCards,
    getGroupColor,
    toggleSection,
    typeFilters,
    toggleTypeFilter,
  } = deckSections;

  const cardActions = useDeckCardActions(deck, id, loadDeck);
  const {
    selectedCard,
    setSelectedCard,
    cardModalVisible,
    handleCardPress,
    closeCardModal,
    getCardNavigation,
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
    hoveredCard,
    setHoveredCard,
    handleCardLongPress,
    handleCardRightClick,
    closeActionSheet,
    handleSetCommander,
    handleMoveToSideboard,
    handleSetColorTag,
    handleHeaderSetColorTag,
    handleAddToCollectionFolder,
    handleChangeEdition,
    handleLinkToCollection,
    handleAddCardFromSearch,
    handleUnlinkFromCollection,
    handleRemoveCard,
    handleLandQuantityChange,
    confirmDialog,
    setConfirmDialog,
    printingSelection,
    setPrintingSelection,
    alreadyLinkedConfirm,
    setAlreadyLinkedConfirm,
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
  } = cardActions;

  // Dropdown menu positions
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [groupByMenuVisible, setGroupByMenuVisible] = useState(false);
  const [groupByMenuPosition, setGroupByMenuPosition] = useState({
    top: 0,
    left: 0,
  });
  const [viewModeMenuVisible, setViewModeMenuVisible] = useState(false);
  const [viewModeMenuPosition, setViewModeMenuPosition] = useState({
    top: 0,
    left: 0,
  });

  // Set header buttons on mobile (same pattern as decks.tsx)
  const backLabel = deck?.isReadOnly ? "Explore" : "My Decks";
  useLayoutEffect(() => {
    if (isDesktop) return;
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}
          accessibilityLabel={`Back to ${backLabel}`}
        >
          <ChevronLeft size={24} color="#7C3AED" />
          <Text style={{ color: "#7C3AED", fontSize: 17 }}>{backLabel}</Text>
        </Pressable>
      ),
      headerRight: !deck?.isReadOnly
        ? () =>
            syncing ? (
              <ActivityIndicator size="small" color="#7C3AED" />
            ) : (
              <HeaderButton
                icon={MoreVertical}
                onPress={() => {
                  setMenuPosition({ top: 56, right: 16 });
                  setMenuVisible(true);
                }}
              />
            )
        : undefined,
    });
  }, [isDesktop, isDark, syncing, deck?.isReadOnly, backLabel, navigation]);

  // AI Advisor hook
  const handleAdvisorDeckUpdate = useCallback(() => {
    cache.remove(CACHE_KEYS.DECK_DETAIL(id!));
    loadDeck(true);
  }, [id, loadDeck]);

  const advisorChat = useAdvisorChat({
    deck,
    onDeckUpdated: handleAdvisorDeckUpdate,
  });

  // Card navigation
  const { selectedCardIndex, handlePrevCard, handleNextCard } =
    getCardNavigation(allCards);

  // --- Page Content ---
  const pageContent = (
    <>
      {/* Desktop Header */}
      {isDesktop && (
        <DeckDesktopHeader
          deck={deck}
          isDark={isDark}
          syncing={syncing}
          advisorPanelVisible={advisorPanelVisible}
          onToggleVisibility={handleToggleVisibility}
          onOpenMenu={(pos) => {
            setMenuPosition(pos);
            setMenuVisible(true);
          }}
          onAddCard={() => setScryfallSearchVisible(true)}
          onOpenColorTags={() => setColorTagManagerVisible(true)}
          onToggleAdvisor={() => setAdvisorPanelVisible(!advisorPanelVisible)}
        />
      )}

      {/* Mobile Metadata */}
      {!isDesktop && deck && <DeckMobileMetadata deck={deck} isDark={isDark} />}

      {/* Toolbar */}
      <DeckToolbar
        id={id}
        deck={deck}
        isDark={isDark}
        viewMode={viewMode}
        searchVisible={searchVisible}
        searchQuery={searchQuery}
        allCardsCount={allCards.length}
        isDesktop={isDesktop}
        typeFilters={typeFilters}
        onToggleSearch={toggleSearch}
        onSearchChange={setSearchQuery}
        onToggleTypeFilter={toggleTypeFilter}
        onOpenGroupByMenu={(pos) => {
          setGroupByMenuPosition(pos);
          setGroupByMenuVisible(true);
        }}
        onOpenViewModeMenu={(pos) => {
          setViewModeMenuPosition(pos);
          setViewModeMenuVisible(true);
        }}
      />

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text
            className={`mb-4 text-center ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {error}
          </Text>
          <Pressable
            onPress={() => loadDeck(true)}
            className="rounded-lg bg-purple-500 px-4 py-2"
          >
            <Text className="font-medium text-white">Retry</Text>
          </Pressable>
        </View>
      ) : sections.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          {deck?.archidektId && archidektConnected ? (
            <>
              <Text
                className={`mb-2 text-lg font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                No cards synced yet
              </Text>
              <Text
                className={`mb-4 text-center ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Pull this deck from Archidekt to see the cards
              </Text>
              <Pressable
                onPress={performSync}
                disabled={syncing}
                className="flex-row items-center gap-2 rounded-lg bg-purple-500 px-6 py-3"
              >
                <CloudDownload size={18} color="white" />
                <Text className="font-medium text-white">
                  {syncing ? "Pulling..." : "Pull from Archidekt"}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text
                className={`mb-2 text-lg font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                No cards yet
              </Text>
              <Text
                className={`mb-4 text-center ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Start building your deck by adding cards
              </Text>
              <Pressable
                onPress={() => setScryfallSearchVisible(true)}
                className="flex-row items-center gap-2 rounded-lg bg-purple-500 px-6 py-3"
              >
                <Plus size={18} color="white" />
                <Text className="font-medium text-white">Add Cards</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : filteredSections.length === 0 && searchQuery.trim() ? (
        <View className="flex-1 items-center justify-center px-6">
          <Search size={48} color={isDark ? "#475569" : "#cbd5e1"} />
          <Text
            className={`mt-4 text-lg font-semibold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            No cards found
          </Text>
          <Text
            className={`mt-1 text-center ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            No cards match "{searchQuery}"
          </Text>
          <Pressable
            onPress={() => setSearchQuery("")}
            className={`mt-4 px-4 py-2 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
          >
            <Text className={isDark ? "text-white" : "text-slate-900"}>
              Clear search
            </Text>
          </Pressable>
        </View>
      ) : viewMode.startsWith("stacks") ? (
        <DeckStacksView
          stacksColumns={stacksColumns}
          viewMode={viewMode}
          isDark={isDark}
          hoveredCard={hoveredCard}
          groupBy={groupBy}
          getGroupColor={getGroupColor}
          onCardPress={handleCardPress}
          onCardLongPress={handleCardLongPress}
          onCardRightClick={handleCardRightClick}
          onHoverCard={setHoveredCard}
          onLayoutWidth={setStacksContainerWidth}
        />
      ) : (
        <SectionList
          sections={filteredSections}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#7C3AED"
            />
          }
          ListHeaderComponent={
            <BasicLandControls
              basicLandCounts={basicLandCounts}
              landsExpanded={landsExpanded}
              onToggleExpanded={() => setLandsExpanded(!landsExpanded)}
              onQuantityChange={handleLandQuantityChange}
              isDark={isDark}
            />
          }
          renderSectionHeader={({ section }) => (
            <Pressable
              onPress={() => toggleSection(section.title)}
              className={`flex-row items-center justify-between px-4 py-3 ${
                isDark ? "bg-slate-900" : "bg-slate-50"
              }`}
            >
              <View className="flex-row items-center gap-2">
                {groupBy !== "category" && (
                  <View
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: getGroupColor(section.title) }}
                  />
                )}
                <Text
                  className={`text-sm font-semibold uppercase tracking-wide ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {section.title} (
                  {section.data.reduce((sum, c) => sum + c.quantity, 0)})
                </Text>
              </View>
              <ChevronDown
                size={16}
                color={isDark ? "#64748b" : "#94a3b8"}
                style={{
                  transform: [
                    {
                      rotate: expandedSections.has(section.title)
                        ? "180deg"
                        : "0deg",
                    },
                  ],
                }}
              />
            </Pressable>
          )}
          renderItem={({ item, section }) => {
            if (!expandedSections.has(section.title)) return null;

            return viewMode === "list" ? (
              <CardListItem
                card={item}
                isDark={isDark}
                isDesktop={isDesktop}
                onPress={() => handleCardPress(item)}
                onLongPress={() => handleCardLongPress(item)}
                onRightClick={(pos) => handleCardRightClick(item, pos)}
              />
            ) : null;
          }}
          renderSectionFooter={({ section }) => {
            if (!expandedSections.has(section.title) || viewMode !== "grid")
              return null;

            return (
              <View className="flex-row flex-wrap px-3 lg:px-5 pb-2">
                {section.data.map((card, index) => (
                  <CardGridItem
                    key={`${card.name}-${index}`}
                    card={card}
                    isDark={isDark}
                    isDesktop={isDesktop}
                    onPress={() => handleCardPress(card)}
                    onLongPress={() => handleCardLongPress(card)}
                    onRightClick={(pos) => handleCardRightClick(card, pos)}
                  />
                ))}
              </View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      {/* Floating Action Buttons - owner only */}
      {!isDesktop && !deck?.isReadOnly && (
        <>
          <GlassFab icon={Plus} onPress={() => setScryfallSearchVisible(true)} bottom={96} />
          <GlassFab icon={MessageSquare} onPress={() => setChatPanelVisible(true)} bottom={24} />
        </>
      )}

      {/* All Modals & Menus */}
      <DeckModals
        id={id}
        deck={deck}
        isDark={isDark}
        isDesktop={isDesktop}
        menuVisible={menuVisible}
        menuPosition={menuPosition}
        archidektConnected={archidektConnected}
        onCloseMenu={() => setMenuVisible(false)}
        onExport={() => setExportModalVisible(true)}
        onPullFromArchidekt={() =>
          handlePullFromArchidekt(setMenuVisible, setConfirmDialog)
        }
        onDeleteDeck={() => handleDeleteDeck(setMenuVisible, setConfirmDialog)}
        viewModeMenuVisible={viewModeMenuVisible}
        viewModeMenuPosition={viewModeMenuPosition}
        viewMode={viewMode}
        onCloseViewModeMenu={() => setViewModeMenuVisible(false)}
        onChangeViewMode={(mode) => {
          changeViewMode(mode);
          setHoveredCard(null);
        }}
        groupByMenuVisible={groupByMenuVisible}
        groupByMenuPosition={groupByMenuPosition}
        groupBy={groupBy}
        onCloseGroupByMenu={() => setGroupByMenuVisible(false)}
        onChangeGroupBy={setGroupBy}
        onExpandSections={setExpandedSections}
        cardModalVisible={cardModalVisible}
        selectedCard={selectedCard}
        selectedCardIndex={selectedCardIndex}
        totalCards={allCards.length}
        actionLoading={actionLoading}
        headerColorTagDropdownOpen={headerColorTagDropdownOpen}
        onCloseCardModal={closeCardModal}
        onPrevCard={handlePrevCard}
        onNextCard={handleNextCard}
        onSetCommander={(card) => handleSetCommander(card)}
        onMoveToSideboard={(card) => handleMoveToSideboard(card)}
        setActionSheetCard={setActionSheetCard}
        setEditionPickerModalVisible={setEditionPickerModalVisible}
        handleLinkToCollection={handleLinkToCollection}
        handleUnlinkFromCollection={handleUnlinkFromCollection}
        handleRemoveCard={handleRemoveCard}
        setColorTagPickerVisible={setColorTagPickerVisible}
        onHeaderSetColorTag={handleHeaderSetColorTag}
        onHeaderColorTagDropdownToggle={setHeaderColorTagDropdownOpen}
        onLandQuantityChange={handleLandQuantityChange}
        onSelectedCardUpdate={setSelectedCard}
        actionSheetVisible={actionSheetVisible}
        actionSheetCard={actionSheetCard}
        editionPickerVisible={editionPickerVisible}
        editions={editions}
        loadingEditions={loadingEditions}
        colorTagPickerVisible={colorTagPickerVisible}
        addToCollectionVisible={addToCollectionVisible}
        collectionFolders={collectionFolders}
        loadingFolders={loadingFolders}
        onCloseActionSheet={closeActionSheet}
        onSetCommanderAction={() => handleSetCommander()}
        onMoveToSideboardAction={() => handleMoveToSideboard()}
        onSetColorTag={handleSetColorTag}
        onChangeEdition={handleChangeEdition}
        onShowColorTags={() => setColorTagPickerVisible(true)}
        onHideColorTags={() => setColorTagPickerVisible(false)}
        onShowEditionPicker={setEditionPickerVisible}
        onLinkToCollectionAction={() => handleLinkToCollection()}
        onUnlinkFromCollectionAction={handleUnlinkFromCollection}
        onRemoveCardAction={handleRemoveCard}
        onCardUpdate={setActionSheetCard}
        onAddToCollectionFolder={handleAddToCollectionFolder}
        onHideAddToCollection={() => setAddToCollectionVisible(false)}
        setLoadingEditions={setLoadingEditions}
        setEditions={setEditions}
        setAddToCollectionVisible={setAddToCollectionVisible}
        setCollectionFolders={setCollectionFolders}
        setLoadingFolders={setLoadingFolders}
        contextMenuPosition={contextMenuPosition}
        colorTagSubmenuOpen={colorTagSubmenuOpen}
        addToCollectionSubmenuOpen={addToCollectionSubmenuOpen}
        setColorTagSubmenuOpen={setColorTagSubmenuOpen}
        setAddToCollectionSubmenuOpen={setAddToCollectionSubmenuOpen}
        editionPickerModalVisible={editionPickerModalVisible}
        onCloseEditionPickerModal={() => {
          setEditionPickerModalVisible(false);
          setActionSheetCard(null);
        }}
        colorTagManagerVisible={colorTagManagerVisible}
        onCloseColorTagManager={() => setColorTagManagerVisible(false)}
        onTagsChanged={(colorTags) => {
          setDeck((prev: any) => (prev ? { ...prev, colorTags } : null));
          loadDeck(true);
        }}
        chatPanelVisible={chatPanelVisible}
        onCloseChatPanel={() => setChatPanelVisible(false)}
        advisorChat={advisorChat}
        confirmDialog={confirmDialog}
        onCloseConfirmDialog={() =>
          setConfirmDialog((prev) => ({ ...prev, visible: false }))
        }
        printingSelection={printingSelection}
        onSelectPrinting={(collectionCardId) => {
          setPrintingSelection((prev) => ({ ...prev, visible: false }));
          handleLinkToCollection(collectionCardId);
        }}
        onClosePrintingSelection={() =>
          setPrintingSelection((prev) => ({ ...prev, visible: false }))
        }
        alreadyLinkedConfirm={alreadyLinkedConfirm}
        onConfirmAlreadyLinked={() => {
          setAlreadyLinkedConfirm((prev) => ({ ...prev, visible: false }));
          handleLinkToCollection(alreadyLinkedConfirm.collectionCardId, true);
        }}
        onCancelAlreadyLinked={() =>
          setAlreadyLinkedConfirm((prev) => ({ ...prev, visible: false }))
        }
        scryfallSearchVisible={scryfallSearchVisible}
        onCloseScryfallSearch={() => setScryfallSearchVisible(false)}
        onAddCardFromSearch={handleAddCardFromSearch}
        existingCardIds={existingCardIds}
        exportModalVisible={exportModalVisible}
        onCloseExportModal={() => setExportModalVisible(false)}
        loadDeck={loadDeck}
        setDeck={setDeck}
      />
    </>
  );

  // Desktop Layout
  if (isDesktop) {
    return (
      <View className="flex-1 flex-row">
        <Stack.Screen options={{ headerShown: false }} />
        <DesktopSidebar />
        <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
          {pageContent}
        </View>
        {deck && (
          <AdvisorSidePanel
            deck={deck}
            visible={advisorPanelVisible}
            onClose={() => setAdvisorPanelVisible(false)}
            {...advisorChat}
          />
        )}
      </View>
    );
  }

  // Mobile Layout
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          title: deck?.name || "Deck",
          headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
          headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
          headerBackTitle: deck?.isReadOnly ? "Explore" : "Decks",
        }}
      />
      <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
        {pageContent}
      </View>
    </>
  );
}
