import { useMemo, useReducer, useRef } from 'react';
import { Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { FullPlaytestGameState, ExtendedGameCard, PlayerId } from '~/types/playtesting';
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
import { StackPanel } from './StackPanel';
import { GameOverView } from './GameOverView';

interface GameViewProps {
  gameState: FullPlaytestGameState | null;
  playerName: string;
  opponentName: string;
  thinkingPlayer?: PlayerId | null;
  onPlayAgain?: () => void;
  onEndGame?: () => void;
}

export function GameView({
  gameState,
  playerName,
  opponentName,
  thinkingPlayer,
  onPlayAgain,
  onEndGame,
}: GameViewProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [uiState, dispatch] = useReducer(playtestUIReducer, initialPlaytestUIState);

  // Track previous life totals for animation
  const prevPlayerLife = useRef<number | undefined>(undefined);
  const prevOpponentLife = useRef<number | undefined>(undefined);

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
        hasPriority={derived.priorityPlayer === 'opponent'}
        handCount={derived.opponent.hand.length}
        onCardPress={handleCardPress}
        onCardLongPress={handleCardLongPress}
        onShowHand={() => {
          dispatch({
            type: 'SET_EXPANDED_HAND',
            hand: uiState.expandedHand === 'opponent' ? null : 'opponent',
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
        hasPriority={derived.priorityPlayer === 'player'}
        handCount={derived.player.hand.length}
        onCardPress={handleCardPress}
        onCardLongPress={handleCardLongPress}
        onShowHand={() => {
          dispatch({
            type: 'SET_EXPANDED_HAND',
            hand: uiState.expandedHand === 'player' ? null : 'player',
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

      {/* Card Preview Modal */}
      <CardPreviewModal
        card={previewCard}
        attachments={previewAttachments}
        visible={!!previewCard}
        onClose={handleClosePreview}
      />
    </View>
  );
}
