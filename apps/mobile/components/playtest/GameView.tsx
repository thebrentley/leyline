import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { FullPlaytestGameState, ExtendedGameCard, ExtendedGameZone, PlayerId } from '~/types/playtesting';
import {
  deriveGameState,
  initialPlaytestUIState,
  playtestUIReducer,
} from '~/types/playtest-ui';
import { GameInfoBar } from './GameInfoBar';
import { PlayerBoard } from './PlayerBoard';
import { HandOverlay } from './HandOverlay';
import { MulliganView } from './MulliganView';
import { CardPreviewModal } from './CardPreviewModal';
import { GraveyardOverlay } from './GraveyardOverlay';
import { StackPanel } from './StackPanel';
import { StackCardOverlay, type StackOverlayPhase } from './StackCardOverlay';
import { GameOverView } from './GameOverView';

interface GameViewProps {
  gameState: FullPlaytestGameState | null;
  playerName: string;
  opponentName: string;
  thinkingPlayer?: PlayerId | null;
  pendingCardAnimation?: { cardId: string; controller: PlayerId } | null;
  onCardAnimationComplete?: () => void;
  onPlayAgain?: () => void;
  onEndGame?: () => void;
}

export function GameView({
  gameState,
  playerName,
  opponentName,
  thinkingPlayer,
  pendingCardAnimation,
  onCardAnimationComplete,
  onPlayAgain,
  onEndGame,
}: GameViewProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [uiState, dispatch] = useReducer(playtestUIReducer, initialPlaytestUIState);

  // Track previous life totals for animation
  const prevPlayerLife = useRef<number | undefined>(undefined);
  const prevOpponentLife = useRef<number | undefined>(undefined);

  // Stack card overlay state
  const prevTopStackItemIdRef = useRef<string | null>(null);
  const stackInitializedRef = useRef(false);
  const overlayItemIdRef = useRef<string | null>(null);
  const overlaySourceCardIdRef = useRef<string | null>(null);
  const [stackOverlay, setStackOverlay] = useState<{
    card: ExtendedGameCard;
    phase: StackOverlayPhase;
    controller: PlayerId;
    destination: ExtendedGameZone | null;
    autoExit?: boolean;
    typeLine?: string | null;
    rowCardCount?: number;
  } | null>(null);

  // Derive view state from game state
  const derived = useMemo(() => {
    if (!gameState) return null;
    return deriveGameState(gameState);
  }, [gameState]);

  // Update previous life tracking
  if (derived) {
    if (prevPlayerLife.current === undefined) {
      prevPlayerLife.current = derived.player.life;
    }
    if (prevOpponentLife.current === undefined) {
      prevOpponentLife.current = derived.opponent.life;
    }
  }

  const handleCardPress = (card: ExtendedGameCard) => {
    dispatch({ type: 'SET_SELECTED_CARD', cardId: card.instanceId });
  };

  const handleCardLongPress = (card: ExtendedGameCard) => {
    dispatch({ type: 'SET_PREVIEW_CARD', cardId: card.instanceId });
  };

  const handleClosePreview = () => {
    dispatch({ type: 'SET_PREVIEW_CARD', cardId: null });
  };

  // Get the card being previewed and its attachments
  const previewData = useMemo(() => {
    if (!uiState.previewCardId || !gameState) return null;
    const card = gameState.cards[uiState.previewCardId];
    if (!card) return null;

    // Get attachments for this card
    const attachments = card.attachments
      .map((id) => gameState.cards[id])
      .filter((c): c is ExtendedGameCard => !!c);

    return { card, attachments };
  }, [uiState.previewCardId, gameState]);

  const previewCard = previewData?.card || null;
  const previewAttachments = previewData?.attachments || [];

  // Look up where the overlay card ended up after leaving the stack
  const getOverlayCardDestination = useCallback((): ExtendedGameZone | null => {
    if (!overlaySourceCardIdRef.current || !gameState) return null;
    const card = gameState.cards[overlaySourceCardIdRef.current];
    if (!card || card.zone === 'stack') return null;
    return card.zone;
  }, [gameState]);

  // Get the number of cards in the battlefield row that a card will land in
  const getRowCardCount = useCallback((controller: PlayerId, typeLine?: string | null): number => {
    if (!derived) return 0;
    const tl = typeLine?.toLowerCase() ?? '';
    const playerData = controller === 'player' ? derived.player : derived.opponent;
    if (tl.includes('land')) return playerData.lands.length;
    if (tl.includes('creature')) return playerData.creatures.length;
    return playerData.artifactsEnchantments.length;
  }, [derived]);

  // Track stack changes to drive the card overlay animation
  useEffect(() => {
    if (!derived || !gameState) return;

    const topItem = derived.stack[0] ?? null;
    const topItemId = topItem?.id ?? null;
    const prevTopId = prevTopStackItemIdRef.current;

    // Skip initial load so we don't animate cards already on the stack
    if (!stackInitializedRef.current) {
      stackInitializedRef.current = true;
      prevTopStackItemIdRef.current = topItemId;
      overlayItemIdRef.current = topItemId;
      return;
    }

    if (topItemId !== prevTopId) {
      if (topItem && topItem.type === 'spell') {
        // New spell on top of stack — animate it in
        const card = gameState.cards[topItem.sourceCardId];
        if (card) {
          overlayItemIdRef.current = topItem.id;
          overlaySourceCardIdRef.current = topItem.sourceCardId;
          setStackOverlay({
            card,
            phase: 'entering',
            controller: topItem.controller,
            destination: null,
            typeLine: card.typeLine,
          });
        }
      } else if (!topItem && overlayItemIdRef.current) {
        // Stack emptied — animate the current overlay card out
        const dest = getOverlayCardDestination();
        setStackOverlay((prev) => {
          if (!prev) return null;
          const count = getRowCardCount(prev.controller, prev.typeLine);
          return { ...prev, phase: 'exiting', destination: dest, rowCardCount: count };
        });
      }
      prevTopStackItemIdRef.current = topItemId;
    }

    // If the specific item we're showing was removed (e.g. resolved while others remain)
    if (
      overlayItemIdRef.current &&
      topItemId !== overlayItemIdRef.current &&
      stackOverlay?.phase === 'visible'
    ) {
      const dest = getOverlayCardDestination();
      setStackOverlay((prev) => {
        if (!prev) return null;
        const count = getRowCardCount(prev.controller, prev.typeLine);
        return { ...prev, phase: 'exiting', destination: dest, rowCardCount: count };
      });
    }
  }, [derived?.stack, gameState, getOverlayCardDestination]);

  // Trigger overlay for cards entering battlefield from hand (land plays, etc.)
  useEffect(() => {
    if (!pendingCardAnimation || !gameState) return;
    // Don't start a new animation if one is already active
    if (stackOverlay) return;

    const card = gameState.cards[pendingCardAnimation.cardId];
    if (!card) return;

    overlaySourceCardIdRef.current = card.instanceId;
    const count = getRowCardCount(pendingCardAnimation.controller, card.typeLine);
    setStackOverlay({
      card,
      phase: 'entering',
      controller: pendingCardAnimation.controller,
      destination: 'battlefield',
      autoExit: true,
      typeLine: card.typeLine,
      rowCardCount: count,
    });
  }, [pendingCardAnimation]);

  const handleOverlayEntryComplete = useCallback(() => {
    setStackOverlay((prev) => {
      if (!prev) return null;
      // For autoExit (lands), skip the visible pause and go straight to exiting
      if (prev.autoExit) {
        return { ...prev, phase: 'exiting' };
      }
      return { ...prev, phase: 'visible' };
    });
  }, []);

  const handleOverlayExitComplete = useCallback(() => {
    setStackOverlay(null);
    overlayItemIdRef.current = null;
    onCardAnimationComplete?.();
  }, [onCardAnimationComplete]);

  if (!gameState || !derived) {
    return (
      <View
        className={`flex-1 items-center justify-center ${
          isDark ? 'bg-slate-950' : 'bg-white'
        }`}
      >
        <Text className={isDark ? 'text-slate-400' : 'text-slate-600'}>
          Waiting for game state...
        </Text>
      </View>
    );
  }

  // Check if game is over
  if (derived.isGameOver) {
    return (
      <GameOverView
        winner={derived.winner}
        playerName={playerName}
        opponentName={opponentName}
        playerLife={derived.player.life}
        opponentLife={derived.opponent.life}
        turnNumber={derived.turnNumber}
        reason={gameState.gameOverReason}
        onPlayAgain={onPlayAgain}
        onEndGame={onEndGame}
      />
    );
  }

  // Check if we're in mulligan phase
  const isMulliganPhase = derived.phase === 'pregame' &&
    (derived.step === 'mulligan' || derived.step === 'bottom_cards');

  if (isMulliganPhase) {
    // Determine mulligan decisions from game state
    const playerDecision = gameState.player.hasKeptHand ? "keep" : null;
    const opponentDecision = gameState.opponent.hasKeptHand ? "keep" : null;

    return (
      <View className="flex-1">
        <MulliganView
          playerHand={derived.player.hand}
          opponentHand={derived.opponent.hand}
          playerName={playerName}
          opponentName={opponentName}
          thinkingPlayer={thinkingPlayer ?? null}
          playerMulliganCount={gameState.player.mulliganCount || 0}
          opponentMulliganCount={gameState.opponent.mulliganCount || 0}
          playerDecision={playerDecision}
          opponentDecision={opponentDecision}
          onCardLongPress={handleCardLongPress}
        />
        <CardPreviewModal
          card={previewCard}
          attachments={previewAttachments}
          visible={!!previewCard}
          onClose={handleClosePreview}
        />
      </View>
    );
  }

  const playerPreviousLife = prevPlayerLife.current;
  const opponentPreviousLife = prevOpponentLife.current;

  // Update refs after render
  prevPlayerLife.current = derived.player.life;
  prevOpponentLife.current = derived.opponent.life;

  return (
    <View className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
      {/* Game Info Bar */}
      <GameInfoBar
        turnNumber={derived.turnNumber}
        activePlayer={derived.activePlayer}
        playerName={playerName}
        opponentName={opponentName}
        phase={derived.phase}
        step={derived.step}
      />

      {/* Opponent Board (top half) */}
      <PlayerBoard
        playerId="opponent"
        isOpponent
        creatures={derived.opponent.creatures}
        artifactsEnchantments={derived.opponent.artifactsEnchantments}
        lands={derived.opponent.lands}
        allCards={gameState.cards}
        commander={derived.opponent.commander}
        libraryCount={derived.opponent.libraryCount}
        graveyard={derived.opponent.graveyard}
        exile={derived.opponent.exile}
        life={derived.opponent.life}
        previousLife={opponentPreviousLife}
        manaPool={derived.opponent.manaPool}
        combat={derived.combat}
        handCount={derived.opponent.hand.length}
        onCardPress={handleCardPress}
        onCardLongPress={handleCardLongPress}
        onShowHand={() => {
          dispatch({
            type: 'SET_EXPANDED_HAND',
            hand: uiState.expandedHand === 'opponent' ? null : 'opponent',
          });
        }}
        onGraveyardPress={() => {
          dispatch({
            type: 'SET_EXPANDED_GRAVEYARD',
            graveyard: uiState.expandedGraveyard === 'opponent' ? null : 'opponent',
          });
        }}
      />

      {/* Stack Panel (animated, shows when stack has items) */}
      <StackPanel
        stack={derived.stack}
        playerName={playerName}
        opponentName={opponentName}
        onItemPress={(item) => {
          // Could show preview of the source card
          const card = gameState.cards[item.sourceCardId];
          if (card) {
            dispatch({ type: 'SET_PREVIEW_CARD', cardId: card.instanceId });
          }
        }}
      />

      {/* Player Board (bottom half) */}
      <PlayerBoard
        playerId="player"
        isOpponent={false}
        creatures={derived.player.creatures}
        artifactsEnchantments={derived.player.artifactsEnchantments}
        lands={derived.player.lands}
        allCards={gameState.cards}
        commander={derived.player.commander}
        libraryCount={derived.player.libraryCount}
        graveyard={derived.player.graveyard}
        exile={derived.player.exile}
        life={derived.player.life}
        previousLife={playerPreviousLife}
        manaPool={derived.player.manaPool}
        combat={derived.combat}
        handCount={derived.player.hand.length}
        onCardPress={handleCardPress}
        onCardLongPress={handleCardLongPress}
        onShowHand={() => {
          dispatch({
            type: 'SET_EXPANDED_HAND',
            hand: uiState.expandedHand === 'player' ? null : 'player',
          });
        }}
        onGraveyardPress={() => {
          dispatch({
            type: 'SET_EXPANDED_GRAVEYARD',
            graveyard: uiState.expandedGraveyard === 'player' ? null : 'player',
          });
        }}
      />

      {/* Opponent Hand Overlay (top) */}
      <HandOverlay
        playerId="opponent"
        cards={derived.opponent.hand}
        isOpen={uiState.expandedHand === 'opponent'}
        onClose={() => dispatch({ type: 'SET_EXPANDED_HAND', hand: null })}
        onCardPress={handleCardPress}
        onCardLongPress={handleCardLongPress}
        position="top"
      />

      {/* Player Hand Overlay (bottom) */}
      <HandOverlay
        playerId="player"
        cards={derived.player.hand}
        isOpen={uiState.expandedHand === 'player'}
        onClose={() => dispatch({ type: 'SET_EXPANDED_HAND', hand: null })}
        onCardPress={handleCardPress}
        onCardLongPress={handleCardLongPress}
        position="bottom"
      />

      {/* Opponent Graveyard Overlay (top, slides from left) */}
      <GraveyardOverlay
        cards={derived.opponent.graveyard}
        isOpen={uiState.expandedGraveyard === 'opponent'}
        onClose={() => dispatch({ type: 'SET_EXPANDED_GRAVEYARD', graveyard: null })}
        onCardPress={handleCardLongPress}
        position="top"
      />

      {/* Player Graveyard Overlay (bottom, slides from left) */}
      <GraveyardOverlay
        cards={derived.player.graveyard}
        isOpen={uiState.expandedGraveyard === 'player'}
        onClose={() => dispatch({ type: 'SET_EXPANDED_GRAVEYARD', graveyard: null })}
        onCardPress={handleCardLongPress}
        position="bottom"
      />

      {/* Card Preview Modal */}
      <CardPreviewModal
        card={previewCard}
        attachments={previewAttachments}
        visible={!!previewCard}
        onClose={handleClosePreview}
      />

      {/* Stack Card Overlay — shows card large in center when cast */}
      <StackCardOverlay
        card={stackOverlay?.card ?? null}
        phase={stackOverlay?.phase ?? null}
        controller={stackOverlay?.controller ?? null}
        destination={stackOverlay?.destination ?? null}
        typeLine={stackOverlay?.typeLine}
        autoExit={stackOverlay?.autoExit}
        rowCardCount={stackOverlay?.rowCardCount}
        onEntryComplete={handleOverlayEntryComplete}
        onExitComplete={handleOverlayExitComplete}
      />
    </View>
  );
}
