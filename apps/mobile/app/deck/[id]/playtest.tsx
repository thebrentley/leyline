import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  Copy,
  MessageCircle,
  Pause,
  Play,
  StopCircle,
  Swords,
  X,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import {
  decksApi,
  playtestingApi,
  type DeckDetail,
  type DeckSummary,
} from "~/lib/api";
import { useResponsive } from "~/hooks/useResponsive";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";
import { useSocket, type PlaytestMessage } from "~/contexts/SocketContext";
import { GameView } from "~/components/playtest";
import type { ExtendedGameZone, FullPlaytestGameState, PlayerId, PlayerState, StackItem, CumulativeTokenUsage } from "~/types/playtesting";

// Color identity colors for deck display
const MANA_COLORS: Record<string, string> = {
  W: "#F9FAF4",
  U: "#0E68AB",
  B: "#150B00",
  R: "#D3202A",
  G: "#00733E",
};

interface LogEntry {
  id: string;
  timestamp: string;
  message: PlaytestMessage;
  // Game state context at the time of the message
  context: {
    phase?: string;
    step?: string;
    activePlayerDeckName?: string;
    turn?: number;
  };
}

export default function PlaytestPage() {
  const { id, name: deckNameParam } = useLocalSearchParams<{
    id: string;
    name?: string;
  }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();
  const { isConnected, joinPlaytest, leavePlaytest, onPlaytestMessage } = useSocket();
  const hasJoinedRef = useRef(false);

  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [allDecks, setAllDecks] = useState<DeckSummary[]>([]);
  const [opponentDeck, setOpponentDeck] = useState<DeckSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [deckPickerVisible, setDeckPickerVisible] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [showExistingGameDialog, setShowExistingGameDialog] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isGameActive, setIsGameActive] = useState(false);
  // Track current game state for context in log entries
  const [currentGameContext, setCurrentGameContext] = useState<{
    phase?: string;
    step?: string;
    activePlayerDeckName?: string;
    turn?: number;
  }>({});
  // Full game state for the game view
  const [gameState, setGameState] = useState<FullPlaytestGameState | null>(null);
  // Track which player is currently thinking (for AI thinking indicator)
  const [thinkingPlayer, setThinkingPlayer] = useState<PlayerId | null>(null);
  // Friendly narrative panel state
  const [isNarrativePanelOpen, setIsNarrativePanelOpen] = useState(false);
  // Token usage tracking
  const [tokenUsage, setTokenUsage] = useState<CumulativeTokenUsage | null>(null);
  // End game confirmation dialog
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  // Game paused state
  const [isGamePaused, setIsGamePaused] = useState(false);
  // Scroll stick-to-bottom state
  const narrativeScrollRef = useRef<ScrollView>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollContentHeight = useRef(0);
  const scrollViewHeight = useRef(0);
  // Pending card animation (for land plays / hand-to-battlefield)
  const [pendingCardAnimation, setPendingCardAnimation] = useState<{
    cardId: string;
    controller: PlayerId;
  } | null>(null);
  // Event queue for sequential processing of visual events
  const eventQueueRef = useRef<PlaytestMessage[]>([]);
  const isProcessingEventRef = useRef(false);
  const drainTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Callback for resuming queue after animation completes
  const animationResumeRef = useRef<(() => void) | null>(null);
  // Animation for slide-from-right panel
  const PANEL_WIDTH = 320;
  const narrativePanelAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;
  // Log view mode: simple (default) shows key events only, verbose shows everything
  const [logViewMode, setLogViewMode] = useState<'simple' | 'verbose'>('simple');
  // Debug game state display
  const [showGameState, setShowGameState] = useState(false);
  const [copied, setCopied] = useState(false);

  const openNarrativePanel = useCallback(() => {
    setIsNarrativePanelOpen(true);
    Animated.timing(narrativePanelAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [narrativePanelAnim]);

  const closeNarrativePanel = useCallback(() => {
    Animated.timing(narrativePanelAnim, {
      toValue: PANEL_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsNarrativePanelOpen(false);
    });
  }, [narrativePanelAnim]);

  const deckName = deck?.name || deckNameParam || "Deck";

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [deckResponse, decksResponse, gameStateResponse] = await Promise.all([
        decksApi.get(id),
        decksApi.list(),
        playtestingApi.getGameState(id),
      ]);
      if (deckResponse.data) {
        setDeck(deckResponse.data);
      }
      if (decksResponse.data) {
        // Filter out the current deck from opponent options
        const otherDecks = decksResponse.data.filter((d) => d.id !== id);
        setAllDecks(otherDecks);
      }
      // Check if there's an existing game
      if (gameStateResponse.data?.success && gameStateResponse.data.gameState) {
        setShowExistingGameDialog(true);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Join playtest room when socket is connected
  useEffect(() => {
    if (!id || !isConnected) {
      hasJoinedRef.current = false;
      return;
    }

    // Join the playtest room when connected (or reconnected)
    console.log("[Playtest] Socket connected, joining playtest room:", id);
    joinPlaytest(id);
    hasJoinedRef.current = true;

    return () => {
      if (hasJoinedRef.current) {
        leavePlaytest(id);
        hasJoinedRef.current = false;
      }
    };
  }, [id, isConnected, joinPlaytest, leavePlaytest]);

  // Subscribe to playtest WebSocket updates
  useEffect(() => {
    if (!id) return;

    // Delay (ms) after processing each event type before draining the next
    const getEventDelay = (msg: any): number => {
      switch (msg.type) {
        case 'stack:added': return 1800;
        case 'stack:resolved': return 1500;
        case 'card:moved': return 400;
        case 'life:changed': return 500;
        case 'combat:attackers': return 600;
        case 'combat:blockers': return 600;
        case 'combat:ended': return 300;
        case 'token:created': return 400;
        default: return 150;
      }
    };

    // Events that skip the queue (no visual animation needed)
    const BYPASS_QUEUE = new Set([
      'ai:thinking', 'ai:decided', 'ai:tokens',
      'mulligan:evaluating', 'mulligan:decision', 'mulligan:bottomCards', 'mulligan:complete',
      'game:log', 'priority:changed',
    ]);

    // Process a single message: apply state updates and add log entry
    const processMessage = (msg: PlaytestMessage) => {
      const messageAny = msg as any;
      if (messageAny.type === 'gamestate:full' && messageAny.gameState) {
        const gs = messageAny.gameState;
        // Store full game state for the GameView
        setGameState(gs);
        setCurrentGameContext({
          phase: gs.phase,
          step: gs.step,
          turn: gs.turnNumber,
          activePlayerDeckName: gs.activePlayer === 'player' ? gs.deckName : gs.opponentDeckName,
        });
        // Update token usage from game state if present
        if (gs.tokenUsage) {
          setTokenUsage(gs.tokenUsage);
        }
      } else if (messageAny.type === 'phase:changed') {
        setCurrentGameContext(prev => ({
          ...prev,
          phase: messageAny.phase,
          step: messageAny.step,
        }));
        // Also update gameState so GameView sees the phase change
        setGameState(prev => prev ? {
          ...prev,
          phase: messageAny.phase,
          step: messageAny.step,
        } : null);
      } else if (messageAny.type === 'turn:started') {
        setCurrentGameContext(prev => ({
          ...prev,
          turn: messageAny.turnNumber,
          // Active player deck name will be set by gamestate:full
        }));
        // Also update gameState so GameView sees the turn change
        setGameState(prev => prev ? {
          ...prev,
          turnNumber: messageAny.turnNumber,
          activePlayer: messageAny.activePlayer,
        } : null);
      } else if (messageAny.type === 'mana:changed') {
        // Update mana pool when mana is spent or added
        setGameState(prev => {
          if (!prev) return null;
          const { player: manaPlayer, manaPool } = messageAny;
          if (manaPlayer === 'player') {
            return {
              ...prev,
              player: { ...prev.player, manaPool },
            };
          } else {
            return {
              ...prev,
              opponent: { ...prev.opponent, manaPool },
            };
          }
        });
      } else if (messageAny.type === 'card:tapped') {
        // Update card tapped state
        setGameState(prev => {
          if (!prev) return null;
          const { cardId, isTapped } = messageAny;
          const card = prev.cards[cardId];
          if (!card) return prev;

          return {
            ...prev,
            cards: {
              ...prev.cards,
              [cardId]: {
                ...card,
                isTapped,
              },
            },
          };
        });
      } else if (messageAny.type === 'card:counters') {
        // Update card counters (e.g., lore counters on Sagas)
        setGameState(prev => {
          if (!prev) return null;
          const { cardId, counters } = messageAny;
          const card = prev.cards[cardId];
          if (!card) return prev;

          return {
            ...prev,
            cards: {
              ...prev.cards,
              [cardId]: {
                ...card,
                counters,
              },
            },
          };
        });
      } else if (messageAny.type === 'card:damage') {
        // Update card damage
        setGameState(prev => {
          if (!prev) return null;
          const { cardId, damage } = messageAny;
          const card = prev.cards[cardId];
          if (!card) return prev;

          return {
            ...prev,
            cards: {
              ...prev.cards,
              [cardId]: {
                ...card,
                damage,
              },
            },
          };
        });
      } else if (messageAny.type === 'card:moved') {
        // Trigger animation for cards entering battlefield from hand (land plays, etc.)
        const { cardId: movedCardId, from: moveFrom, to: moveTo, player: movePlayer } = messageAny;
        if (moveFrom === 'hand' && moveTo === 'battlefield') {
          setPendingCardAnimation({ cardId: movedCardId, controller: movePlayer as PlayerId });
        }

        // Update game state when a card is moved between zones
        setGameState(prev => {
          if (!prev) return null;

          const { cardId, from, to, player: cardPlayer } = messageAny;
          const card = prev.cards[cardId];
          if (!card) return prev;

          // Create updated cards map with new zone
          const updatedCards = {
            ...prev.cards,
            [cardId]: {
              ...card,
              zone: to as ExtendedGameZone,
            },
          };

          // Helper to remove cardId from an array
          const removeFrom = (arr: string[]) => arr.filter(id => id !== cardId);

          // Update player state for zone arrays
          const updatePlayerState = (playerState: PlayerState, isOwner: boolean) => {
            if (!isOwner) return playerState;

            let updated = { ...playerState };

            // Remove from source zone
            if (from === 'hand') updated.handOrder = removeFrom(updated.handOrder);
            else if (from === 'library') updated.libraryOrder = removeFrom(updated.libraryOrder);
            else if (from === 'graveyard') updated.graveyardOrder = removeFrom(updated.graveyardOrder);
            else if (from === 'exile') updated.exileOrder = removeFrom(updated.exileOrder);
            else if (from === 'command') updated.commandZone = removeFrom(updated.commandZone);

            // Add to destination zone
            if (to === 'hand') updated.handOrder = [...updated.handOrder, cardId];
            else if (to === 'library') updated.libraryOrder = [cardId, ...updated.libraryOrder]; // Top of library
            else if (to === 'graveyard') updated.graveyardOrder = [...updated.graveyardOrder, cardId];
            else if (to === 'exile') updated.exileOrder = [...updated.exileOrder, cardId];
            else if (to === 'command') updated.commandZone = [...updated.commandZone, cardId];

            return updated;
          };

          const isPlayerCard = cardPlayer === 'player';

          // Update battlefield order
          let battlefieldOrder = { ...prev.battlefieldOrder };
          const battlefieldKey = isPlayerCard ? 'player' : 'opponent';

          if (from === 'battlefield') {
            battlefieldOrder[battlefieldKey] = removeFrom(battlefieldOrder[battlefieldKey]);
          }
          if (to === 'battlefield') {
            battlefieldOrder[battlefieldKey] = [...battlefieldOrder[battlefieldKey], cardId];
          }

          return {
            ...prev,
            cards: updatedCards,
            player: updatePlayerState(prev.player, isPlayerCard),
            opponent: updatePlayerState(prev.opponent, !isPlayerCard),
            battlefieldOrder,
          };
        });
      } else if (messageAny.type === 'stack:added') {
        // A spell or ability was added to the stack
        setGameState(prev => {
          if (!prev) return null;
          const item = messageAny.item as StackItem;
          return {
            ...prev,
            stack: [item, ...prev.stack],
          };
        });
      } else if (messageAny.type === 'stack:resolved') {
        // The top item on the stack resolved
        setGameState(prev => {
          if (!prev) return null;
          const { itemId } = messageAny;
          return {
            ...prev,
            stack: prev.stack.filter((s: StackItem) => s.id !== itemId),
          };
        });
      } else if (messageAny.type === 'combat:attackers') {
        setGameState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            combat: {
              ...prev.combat,
              isActive: true,
              attackers: messageAny.attackers || [],
            },
          };
        });
      } else if (messageAny.type === 'combat:blockers') {
        setGameState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            combat: {
              ...prev.combat,
              blockers: messageAny.blockers || [],
            },
          };
        });
      } else if (messageAny.type === 'combat:ended') {
        setGameState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            combat: {
              ...prev.combat,
              isActive: false,
              attackers: [],
              blockers: [],
            },
          };
        });
      } else if (messageAny.type === 'ai:thinking' || messageAny.type === 'mulligan:evaluating') {
        setThinkingPlayer(messageAny.player as PlayerId);
      } else if (messageAny.type === 'ai:decided' || messageAny.type === 'mulligan:decision') {
        setThinkingPlayer(null);
      } else if (messageAny.type === 'ai:tokens') {
        // Update token usage from dedicated token event
        setTokenUsage(messageAny.tokenUsage);
      }

      // Add log entry for non-noisy messages
      if (messageAny.type !== 'game:log' && messageAny.type !== 'priority:changed') {
        setCurrentGameContext(prevContext => {
          setLogs((prevLogs) => [
            ...prevLogs,
            {
              id: `${Date.now()}-${Math.random()}`,
              timestamp: new Date().toISOString(),
              message: msg,
              context: { ...prevContext },
            },
          ]);
          return prevContext;
        });
      }
    };

    // Drain the event queue one message at a time
    const drainQueue = () => {
      if (isProcessingEventRef.current || eventQueueRef.current.length === 0) return;
      isProcessingEventRef.current = true;
      const nextMsg = eventQueueRef.current.shift()!;
      processMessage(nextMsg);

      // For hand→battlefield moves, wait for the animation callback instead of a fixed delay
      const msgAny = nextMsg as any;
      if (msgAny.type === 'card:moved' && msgAny.from === 'hand' && msgAny.to === 'battlefield') {
        animationResumeRef.current = () => {
          isProcessingEventRef.current = false;
          drainQueue();
        };
        return;
      }

      const delay = getEventDelay(msgAny);
      drainTimeoutRef.current = setTimeout(() => {
        isProcessingEventRef.current = false;
        drainQueue();
      }, delay);
    };

    const unsubscribe = onPlaytestMessage((message) => {
      if (message.deckId !== id) return;
      const messageAny = message as any;

      // Full state sync: clear queue and process immediately
      if (messageAny.type === 'gamestate:full') {
        eventQueueRef.current = [];
        if (drainTimeoutRef.current) {
          clearTimeout(drainTimeoutRef.current);
          drainTimeoutRef.current = null;
        }
        isProcessingEventRef.current = false;
        processMessage(message);
        return;
      }

      // Non-visual events: process immediately
      if (BYPASS_QUEUE.has(messageAny.type)) {
        processMessage(message);
        return;
      }

      // Visual events: queue for sequential processing
      eventQueueRef.current.push(message);
      drainQueue();
    });

    return () => {
      unsubscribe();
      if (drainTimeoutRef.current) {
        clearTimeout(drainTimeoutRef.current);
      }
      animationResumeRef.current = null;
    };
  }, [id, onPlaytestMessage]);

  const handleStartGame = async () => {
    if (!id || !opponentDeck) return;

    setStartingGame(true);
    setIsGamePaused(false);
    setTokenUsage(null);
    try {
      const response = await playtestingApi.startGame(id, opponentDeck.id);
      if (response.data?.success) {
        setIsGameActive(true);
      } else {
        console.error("Failed to start game:", response.error);
      }
    } catch (err) {
      console.error("Error starting game:", err);
    } finally {
      setStartingGame(false);
    }
  };

  const handleContinueGame = () => {
    setShowExistingGameDialog(false);
    setIsGameActive(true);
  };

  const handleEndGame = async () => {
    if (!id) return;
    setShowExistingGameDialog(false);
    try {
      await playtestingApi.endGame(id);
      // Reset game state
      setIsGameActive(false);
      setGameState(null);
      setLogs([]);
      setCurrentGameContext({});
      setThinkingPlayer(null);
      setIsNarrativePanelOpen(false);
      setIsGamePaused(false);
      setTokenUsage(null);
    } catch (err) {
      console.error("Error ending game:", err);
    }
  };

  const handlePlayAgain = async () => {
    if (!id || !opponentDeck) return;
    // End current game and start a new one
    try {
      await playtestingApi.endGame(id);
      setGameState(null);
      setLogs([]);
      setCurrentGameContext({});
      setThinkingPlayer(null);
      setIsGamePaused(false);
      setTokenUsage(null);
      // Start new game with same opponent
      const response = await playtestingApi.startGame(id, opponentDeck.id);
      if (response.data?.success) {
        setIsGameActive(true);
      }
    } catch (err) {
      console.error("Error restarting game:", err);
    }
  };

  const handlePauseToggle = async () => {
    if (!id) return;
    try {
      if (isGamePaused) {
        const response = await playtestingApi.resumeGame(id);
        if (response.data?.success) {
          setIsGamePaused(false);
        }
      } else {
        const response = await playtestingApi.pauseGame(id);
        if (response.data?.success) {
          setIsGamePaused(true);
        }
      }
    } catch (err) {
      console.error("Error toggling pause:", err);
    }
  };

  // Convert a log entry to natural language sentence
  const logToNaturalLanguage = (log: LogEntry): string => {
    const msg = log.message as any;
    const turn = log.context.turn ? `Turn ${log.context.turn}` : '';

    // Helper to get player name from message's player field or fall back to context
    const getPlayerName = (msgPlayer?: string) => {
      if (msgPlayer === 'player') return deckName;
      if (msgPlayer === 'opponent') return opponentDeck?.name || 'Opponent';
      return log.context.activePlayerDeckName || 'A player';
    };
    const playerName = getPlayerName(msg.player);

    const phaseLabels: Record<string, string> = {
      pregame: 'pregame',
      beginning: 'beginning phase',
      precombat_main: 'first main phase',
      combat: 'combat',
      postcombat_main: 'second main phase',
      ending: 'end step',
    };
    const stepLabels: Record<string, string> = {
      untap: 'untap step',
      upkeep: 'upkeep',
      draw: 'draw step',
      main: 'main phase',
      beginning_of_combat: 'beginning of combat',
      declare_attackers: 'declare attackers step',
      declare_blockers: 'declare blockers step',
      combat_damage: 'combat damage step',
      end_of_combat: 'end of combat',
      end: 'end step',
      cleanup: 'cleanup step',
    };

    switch (msg.type) {
      case 'session:started':
        return '🎮 The game has begun!';
      case 'session:ended':
        return '🏁 The game has ended.';
      case 'gamestate:full':
        if (msg.gameState) {
          const gs = msg.gameState;
          const activeName = gs.activePlayer === 'player' ? gs.deckName : gs.opponentDeckName;
          return `📊 ${turn ? turn + ': ' : ''}${activeName} is active. Life totals: ${gs.deckName} (${gs.player?.life || 40}) vs ${gs.opponentDeckName} (${gs.opponent?.life || 40}).`;
        }
        return '📊 Game state updated.';
      case 'turn:started':
        return `⏭️ ${turn} begins. ${msg.activePlayer === 'player' ? deckName : opponentDeck?.name || 'Opponent'} is now the active player.`;
      case 'phase:changed': {
        const phasePlayer = getPlayerName(msg.activePlayer);
        const phase = phaseLabels[msg.phase] || msg.phase;
        const step = msg.step ? stepLabels[msg.step] || msg.step : null;
        return `📍 ${phasePlayer} enters ${step || phase}.`;
      }
      case 'card:moved': {
        const cardMovePlayer = getPlayerName(msg.player);
        const card = msg.cardName || 'a card';
        const from = msg.from;
        const to = msg.to;
        if (to === 'battlefield' && from === 'hand') {
          return `🃏 ${cardMovePlayer} plays ${card}.`;
        } else if (to === 'graveyard') {
          return `💀 ${cardMovePlayer} discards ${card}.`;
        } else if (to === 'hand' && from === 'library') {
          return `🎴 ${cardMovePlayer} draws ${card}.`;
        }
        return `🔄 ${cardMovePlayer} moves ${card} from ${from} to ${to}.`;
      }
      case 'card:tapped': {
        const tapPlayer = getPlayerName(msg.player);
        const card = msg.cardName || 'a card';
        if (msg.isTapped) {
          return `🔄 ${tapPlayer} taps ${card}.`;
        } else {
          return `🔄 ${tapPlayer} untaps ${card}.`;
        }
      }
      case 'life:changed': {
        const target = msg.player === 'player' ? deckName : opponentDeck?.name || 'Opponent';
        const change = msg.change > 0 ? `gains ${msg.change}` : `loses ${Math.abs(msg.change)}`;
        return `❤️ ${target} ${change} life (now at ${msg.life}).`;
      }
      case 'combat:started':
        return `⚔️ ${playerName} moves to combat!`;
      case 'combat:attackers': {
        const count = msg.attackers?.length || 0;
        if (count === 0) return `🛡️ ${playerName} declares no attackers.`;
        return `⚔️ ${playerName} attacks with ${count} creature${count > 1 ? 's' : ''}!`;
      }
      case 'combat:blockers': {
        const count = msg.blockers?.length || 0;
        if (count === 0) return `🚫 No blockers declared.`;
        return `🛡️ ${count} blocker${count > 1 ? 's' : ''} declared.`;
      }
      case 'combat:damage':
        return `💥 Combat damage is dealt!`;
      case 'combat:ended':
        return `🏳️ Combat ends.`;
      case 'ai:thinking':
        return `🤔 ${playerName} is thinking...`;
      case 'ai:decided':
        return `💡 ${playerName} makes a decision${msg.reasoning ? `: "${msg.reasoning}"` : '.'}`;
      case 'game:over': {
        const winner = msg.winner === 'player' ? deckName : opponentDeck?.name || 'Opponent';
        return `🏆 ${winner} wins! ${msg.reason || ''}`;
      }
      case 'game:log':
        return `📝 ${msg.entry?.message || 'Game event'}`;
      case 'error':
        return `⚠️ Error: ${msg.error}`;
      // Mulligan events
      case 'mulligan:evaluating': {
        const evalPlayer = getPlayerName(msg.player);
        return `🔍 ${evalPlayer} is evaluating their opening hand (${msg.handSize} cards)...`;
      }
      case 'mulligan:decision': {
        const decisionPlayer = getPlayerName(msg.player);
        if (msg.decision === 'keep') {
          const mulliganText = msg.mulliganCount > 0 ? ` after ${msg.mulliganCount} mulligan${msg.mulliganCount > 1 ? 's' : ''}` : '';
          return `✋ ${decisionPlayer} keeps their hand${mulliganText}${msg.reasoning ? `: "${msg.reasoning}"` : '.'}`;
        } else {
          return `🔄 ${decisionPlayer} mulligans (mulligan #${msg.mulliganCount})${msg.reasoning ? `: "${msg.reasoning}"` : '.'}`;
        }
      }
      case 'mulligan:bottomCards': {
        const bottomPlayer = getPlayerName(msg.player);
        return `📥 ${bottomPlayer} puts ${msg.cardCount} card${msg.cardCount > 1 ? 's' : ''} on the bottom of their library.`;
      }
      case 'mulligan:complete':
        return `✅ ${msg.message || 'Mulligan phase complete - the game begins!'}`;
      case 'token:created': {
        const tokenPlayer = getPlayerName(msg.controller);
        const count = msg.tokenIds?.length || 1;
        const name = msg.tokenName || 'Token';
        return `✨ ${tokenPlayer} creates ${count} ${name} token${count > 1 ? 's' : ''}.`;
      }
      default:
        return `📝 ${msg.type}`;
    }
  };

  // Build simplified log entries for 'simple' view mode
  const getSimpleLogs = (): { id: string; turn?: number; message: string }[] => {
    const result: { id: string; turn?: number; message: string }[] = [];

    const getPlayerName = (msgPlayer?: string) => {
      if (msgPlayer === 'player') return deckName;
      if (msgPlayer === 'opponent') return opponentDeck?.name || 'Opponent';
      return 'A player';
    };

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const msg = log.message as any;

      switch (msg.type) {
        case 'session:started':
          result.push({ id: log.id, turn: log.context.turn, message: 'Game started.' });
          break;

        case 'turn:started': {
          const name = msg.activePlayer === 'player' ? deckName : opponentDeck?.name || 'Opponent';
          result.push({ id: log.id, turn: log.context.turn, message: `${name}'s turn began.` });
          break;
        }

        case 'card:moved': {
          const playerName = getPlayerName(msg.player);
          const card = msg.cardName || 'a card';

          if (msg.to === 'hand' && msg.from === 'library') {
            result.push({ id: log.id, turn: log.context.turn, message: `${playerName} drew a card.` });
          } else if (msg.to === 'battlefield' && msg.from === 'hand') {
            result.push({ id: log.id, turn: log.context.turn, message: `${playerName} played ${card}.` });
          } else if (msg.to === 'stack' && (msg.from === 'hand' || msg.from === 'command')) {
            // Look ahead for stack:added to get target info
            let targetStr = '';
            for (let j = i + 1; j < Math.min(i + 5, logs.length); j++) {
              const nextMsg = (logs[j].message as any);
              if (nextMsg.type === 'stack:added' && nextMsg.item?.targets?.length > 0) {
                const targets = nextMsg.item.targets.map((t: any) => {
                  if (t.type === 'player') return t.id === 'player' ? deckName : opponentDeck?.name || 'Opponent';
                  return gameState?.cards?.[t.id]?.name || 'target';
                });
                targetStr = ` targeting ${targets.join(', ')}`;
                break;
              }
            }
            result.push({ id: log.id, turn: log.context.turn, message: `${playerName} cast ${card}${targetStr}.` });
          } else if (msg.to === 'graveyard' && msg.from === 'hand') {
            result.push({ id: log.id, turn: log.context.turn, message: `${playerName} discarded ${card}.` });
          }
          break;
        }

        case 'card:tapped': {
          if (!msg.isTapped) break;
          const tapPlayer = getPlayerName(msg.player);
          // Aggregate consecutive taps from the same player
          const tappedCards = [msg.cardName || 'a card'];
          while (i + 1 < logs.length) {
            const nextMsg = (logs[i + 1].message as any);
            if (nextMsg.type === 'card:tapped' && nextMsg.isTapped && nextMsg.player === msg.player) {
              tappedCards.push(nextMsg.cardName || 'a card');
              i++;
            } else {
              break;
            }
          }
          result.push({ id: log.id, turn: log.context.turn, message: `${tapPlayer} tapped ${tappedCards.join(', ')}.` });
          break;
        }

        case 'combat:attackers': {
          const attackers = msg.attackers || [];
          if (attackers.length === 0) break;
          const atkPlayer = log.context.activePlayerDeckName || getPlayerName(msg.player);
          const names = attackers.map((a: any) => gameState?.cards?.[a.cardId]?.name || 'creature');
          result.push({ id: log.id, turn: log.context.turn, message: `${atkPlayer} attacked with ${names.join(', ')}.` });
          break;
        }

        case 'combat:blockers': {
          const blockers = msg.blockers || [];
          if (blockers.length === 0) break;
          const descriptions = blockers.map((b: any) => {
            const blockerName = gameState?.cards?.[b.cardId]?.name || 'creature';
            const attackerName = gameState?.cards?.[b.blockingAttackerId]?.name || 'creature';
            return `${blockerName} blocked ${attackerName}`;
          });
          result.push({ id: log.id, turn: log.context.turn, message: descriptions.join(', ') + '.' });
          break;
        }

        case 'life:changed': {
          if (msg.change >= 0) break;
          const target = msg.player === 'player' ? deckName : opponentDeck?.name || 'Opponent';
          result.push({ id: log.id, turn: log.context.turn, message: `${target} lost ${Math.abs(msg.change)} life. (${msg.life})` });
          break;
        }

        case 'game:over': {
          const winner = msg.winner === 'player' ? deckName : opponentDeck?.name || 'Opponent';
          result.push({ id: log.id, turn: log.context.turn, message: `${winner} wins! ${msg.reason || ''}` });
          break;
        }
      }
    }

    return result;
  };

  // Scroll handlers for stick-to-bottom behavior
  const handleNarrativeScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20; // Threshold for "at bottom"
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    setIsAtBottom(isNearBottom);
    scrollViewHeight.current = layoutMeasurement.height;
  };

  const handleNarrativeContentSizeChange = (_width: number, height: number) => {
    scrollContentHeight.current = height;
    // Auto-scroll to bottom if user was at bottom
    if (isAtBottom && narrativeScrollRef.current) {
      narrativeScrollRef.current.scrollToEnd({ animated: true });
    }
  };

  const handleGetGameState = () => {
    console.log('[DEBUG] Full Game State:', JSON.stringify(gameState, null, 2));
    setShowGameState(!showGameState);
  };

  const handleCopyGameState = async () => {
    if (!gameState) return;
    try {
      await Clipboard.setStringAsync(JSON.stringify(gameState, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy game state:', error);
    }
  };

  const renderDeckOption = ({ item }: { item: DeckSummary }) => {
    const isSelected = opponentDeck?.id === item.id;

    return (
      <Pressable
        onPress={() => {
          setOpponentDeck(item);
          setDeckPickerVisible(false);
        }}
        className={`flex-row items-center p-4 border-b ${
          isDark ? "border-slate-800" : "border-slate-200"
        } ${isSelected ? (isDark ? "bg-green-900/20" : "bg-green-50") : ""}`}
      >
        {/* Commander Image */}
        {item.commanderImageCrop ? (
          <Image
            source={{ uri: item.commanderImageCrop }}
            className="w-12 h-12 rounded-lg"
            resizeMode="cover"
          />
        ) : (
          <View
            className={`w-12 h-12 rounded-lg items-center justify-center ${
              isDark ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            <Swords size={20} color={isDark ? "#64748b" : "#94a3b8"} />
          </View>
        )}

        {/* Deck Info */}
        <View className="flex-1 ml-3">
          <Text
            className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <View className="flex-row items-center gap-2 mt-1">
            {/* Color Identity */}
            {item.colors && item.colors.length > 0 && (
              <View className="flex-row gap-0.5">
                {item.colors.map((color) => (
                  <View
                    key={color}
                    className="w-4 h-4 rounded-full border"
                    style={{
                      backgroundColor: MANA_COLORS[color] || "#94a3b8",
                      borderColor: color === "W" ? "#e2e8f0" : "transparent",
                    }}
                  />
                ))}
              </View>
            )}
            <Text
              className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              {item.cardCount} cards
            </Text>
          </View>
        </View>

        {/* Selected Check */}
        {isSelected && <Check size={20} color="#22c55e" />}
      </Pressable>
    );
  };

  const pageContent = (
    <>
      {/* Header */}
      <View
        className={`flex-row items-center justify-between px-4 lg:px-6 py-3 lg:py-4 ${!isDesktop ? "border-b border-slate-200 dark:border-slate-800" : ""}`}
      >
        <View className="flex-row items-center gap-3 flex-1">
          {/* Mobile: Back arrow */}
          {!isDesktop && (
            <Pressable
              onPress={() => router.back()}
              className={`rounded-full p-2 ${
                isDark ? "active:bg-slate-800" : "active:bg-slate-100"
              }`}
            >
              <ArrowLeft size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          )}
          <View className="flex-1">
            {/* Desktop: Breadcrumb */}
            {isDesktop && (
              <View className="flex-row items-center gap-2 mb-1">
                <Pressable
                  onPress={() => router.push("/(tabs)/decks")}
                  className="hover:underline"
                >
                  <Text
                    className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    My Decks
                  </Text>
                </Pressable>
                <Text
                  className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}
                >
                  /
                </Text>
                <Pressable
                  onPress={() => router.push(`/deck/${id}`)}
                  className="hover:underline"
                >
                  <Text
                    className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
                    numberOfLines={1}
                  >
                    {deckName}
                  </Text>
                </Pressable>
                <Text
                  className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}
                >
                  /
                </Text>
                <Text
                  className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Playtest
                </Text>
              </View>
            )}
            <View className="flex-row items-center gap-2">
              <Play size={isDesktop ? 28 : 20} color="#22c55e" />
              <Text
                className={`text-lg lg:text-2xl font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Playtest
              </Text>
            </View>
            <Text
              className={`text-xs lg:text-sm mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              {deckName}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      ) : isGameActive ? (
        /* Game View - Full Screen Visual Board */
        <View className="flex-1">
          {/* Header with connection status and action buttons */}
          <View className="flex-row items-center justify-between px-2 py-1">
            <View className="flex-row items-center">
              <View
                className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
              />
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setShowEndGameConfirm(true)}
                className={`flex-row items-center gap-2 px-3 py-1.5 rounded-lg ${
                  isDark ? "bg-red-900/30 active:bg-red-900/50" : "bg-red-100 active:bg-red-200"
                }`}
              >
                <StopCircle size={14} color="#ef4444" />
                <Text className="text-red-500 font-medium text-xs">End Game</Text>
              </Pressable>
              <Pressable
                onPress={handlePauseToggle}
                className={`flex-row items-center gap-2 px-3 py-1.5 rounded-lg ${
                  isDark ? "bg-amber-900/30 active:bg-amber-900/50" : "bg-amber-100 active:bg-amber-200"
                }`}
              >
                {isGamePaused ? (
                  <>
                    <Play size={14} color="#f59e0b" />
                    <Text className="text-amber-500 font-medium text-xs">Resume</Text>
                  </>
                ) : (
                  <>
                    <Pause size={14} color="#f59e0b" />
                    <Text className="text-amber-500 font-medium text-xs">Pause</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={openNarrativePanel}
                className={`flex-row items-center gap-2 px-3 py-1.5 rounded-lg ${
                  isDark ? "bg-purple-900/30 active:bg-purple-900/50" : "bg-purple-100 active:bg-purple-200"
                }`}
              >
                <MessageCircle size={14} color="#a855f7" />
                <Text className="text-purple-500 font-medium text-xs">Log</Text>
              </Pressable>
            </View>
          </View>

          {/* Game Board */}
          <GameView
            gameState={gameState}
            playerName={deckName}
            opponentName={opponentDeck?.name || "Opponent"}
            thinkingPlayer={thinkingPlayer}
            pendingCardAnimation={pendingCardAnimation}
            onCardAnimationComplete={() => {
              setPendingCardAnimation(null);
              if (animationResumeRef.current) {
                const resume = animationResumeRef.current;
                animationResumeRef.current = null;
                resume();
              }
            }}
            onPlayAgain={handlePlayAgain}
            onEndGame={handleEndGame}
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: isDesktop ? 24 : 16,
            paddingBottom: 48,
            flexGrow: 1,
          }}
        >
          <View className={`flex-1 ${isDesktop ? "max-w-4xl mx-auto w-full" : ""}`}>
            {/* Selection UI */}
            <>
                {/* Experimental Feature Warning Banner */}
                <View
                  className={`mb-6 p-4 rounded-xl border ${
                    isDark
                      ? "bg-amber-900/20 border-amber-700/50"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <Text
                    className={`text-center text-sm leading-relaxed ${
                      isDark ? "text-amber-200" : "text-amber-800"
                    }`}
                  >
                    Playtesting is an experimental feature. Some mechanics may not function and the AI may not make the most optimal play in some circumstances.
                  </Text>
                </View>

                {/* AI vs AI Badge */}
                <View
                  className={`flex-row items-center justify-center gap-2 mb-6 py-2 px-4 rounded-full self-center ${
                    isDark ? "bg-purple-900/30" : "bg-purple-100"
                  }`}
                >
                  <Bot size={16} color="#a855f7" />
                  <Text className="text-purple-500 font-medium text-sm">
                    AI vs AI Mode
                  </Text>
                </View>

                {/* Matchup Display */}
                <View
                  className={`rounded-2xl p-6 lg:p-8 mb-6 ${
                    isDark
                      ? "bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800"
                      : "bg-gradient-to-br from-slate-50 to-white border border-slate-200"
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    {/* Player 1 (Current Deck) */}
                    <View className="flex-1 items-center">
                      {deck?.commanders?.[0]?.imageArtCrop ? (
                        <Image
                          source={{ uri: deck.commanders[0].imageArtCrop }}
                          className="w-20 h-20 lg:w-24 lg:h-24 rounded-xl mb-3"
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          className={`w-20 h-20 lg:w-24 lg:h-24 rounded-xl items-center justify-center mb-3 ${
                            isDark ? "bg-slate-800" : "bg-slate-200"
                          }`}
                        >
                          <Bot size={32} color="#22c55e" />
                        </View>
                      )}
                      <Text
                        className={`font-semibold text-center text-sm lg:text-base ${isDark ? "text-white" : "text-slate-900"}`}
                        numberOfLines={2}
                      >
                        {deckName}
                      </Text>
                      <View className="flex-row items-center gap-1 mt-1">
                        <Bot size={12} color="#22c55e" />
                        <Text className="text-green-500 text-xs font-medium">
                          AI
                        </Text>
                      </View>
                    </View>

                    {/* VS */}
                    <View className="px-4">
                      <View
                        className={`w-12 h-12 rounded-full items-center justify-center ${
                          isDark ? "bg-slate-800" : "bg-slate-200"
                        }`}
                      >
                        <Swords size={24} color={isDark ? "#64748b" : "#94a3b8"} />
                      </View>
                    </View>

                    {/* Player 2 (Opponent Deck) */}
                    <View className="flex-1 items-center">
                      {opponentDeck ? (
                        <>
                          {opponentDeck.commanderImageCrop ? (
                            <Image
                              source={{ uri: opponentDeck.commanderImageCrop }}
                              className="w-20 h-20 lg:w-24 lg:h-24 rounded-xl mb-3"
                              resizeMode="cover"
                            />
                          ) : (
                            <View
                              className={`w-20 h-20 lg:w-24 lg:h-24 rounded-xl items-center justify-center mb-3 ${
                                isDark ? "bg-slate-800" : "bg-slate-200"
                              }`}
                            >
                              <Bot size={32} color="#f97316" />
                            </View>
                          )}
                          <Text
                            className={`font-semibold text-center text-sm lg:text-base ${isDark ? "text-white" : "text-slate-900"}`}
                            numberOfLines={2}
                          >
                            {opponentDeck.name}
                          </Text>
                          <View className="flex-row items-center gap-1 mt-1">
                            <Bot size={12} color="#f97316" />
                            <Text className="text-orange-500 text-xs font-medium">
                              AI
                            </Text>
                          </View>
                        </>
                      ) : (
                        <Pressable
                          onPress={() => setDeckPickerVisible(true)}
                          className={`w-20 h-20 lg:w-24 lg:h-24 rounded-xl items-center justify-center mb-3 border-2 border-dashed ${
                            isDark
                              ? "border-slate-700 bg-slate-800/50"
                              : "border-slate-300 bg-slate-100"
                          }`}
                        >
                          <Text
                            className={`text-3xl ${isDark ? "text-slate-600" : "text-slate-400"}`}
                          >
                            ?
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>

                  {/* Select Opponent Button */}
                  <Pressable
                    onPress={() => setDeckPickerVisible(true)}
                    className={`flex-row items-center justify-between mt-6 p-4 rounded-xl ${
                      isDark
                        ? "bg-slate-800 active:bg-slate-700"
                        : "bg-slate-100 active:bg-slate-200"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <Swords size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                      <Text
                        className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        {opponentDeck
                          ? "Change Opponent Deck"
                          : "Select Opponent Deck"}
                      </Text>
                    </View>
                    <ChevronDown size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                  </Pressable>
                </View>

                {/* Format Info */}
                <View
                  className={`rounded-xl p-4 mb-6 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      Format
                    </Text>
                    <View
                      className={`px-3 py-1 rounded-full ${isDark ? "bg-purple-900/30" : "bg-purple-100"}`}
                    >
                      <Text className="text-purple-500 font-medium">Commander</Text>
                    </View>
                  </View>
                  <Text
                    className={`text-sm mt-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    40 life • Free mulligan • Commander damage tracking
                  </Text>
                </View>

                {/* Start Button */}
                <Button
                  onPress={handleStartGame}
                  disabled={startingGame || !opponentDeck || !isConnected}
                  className={`w-full h-14 ${startingGame || !opponentDeck || !isConnected ? "bg-slate-600" : "bg-green-500 active:bg-green-600"}`}
                >
                  <View className="flex-row items-center gap-3">
                    {startingGame ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Play size={22} color="white" />
                    )}
                    <Text className="text-white text-lg font-semibold">
                      {startingGame ? "Starting..." : !isConnected ? "Connecting..." : !opponentDeck ? "Select Opponent Deck" : "Start Game"}
                    </Text>
                  </View>
                </Button>

                {/* Coming Soon Note */}
                <Text
                  className={`text-center text-xs mt-4 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  Player vs AI mode coming soon
                </Text>
              </>
          </View>
        </ScrollView>
      )}

      {/* Deck Picker Dialog */}
      <Modal
        visible={deckPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeckPickerVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 items-center justify-center p-4"
          onPress={() => setDeckPickerVisible(false)}
        >
          <View
            className={`w-full max-w-md rounded-2xl max-h-[80%] ${isDark ? "bg-slate-900" : "bg-white"}`}
            onStartShouldSetResponder={() => true}
          >
            {/* Dialog Header */}
            <View
              className={`flex-row items-center justify-between p-4 border-b ${
                isDark ? "border-slate-800" : "border-slate-200"
              }`}
            >
              <Text
                className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Select Opponent Deck
              </Text>
              <Pressable
                onPress={() => setDeckPickerVisible(false)}
                className={`rounded-full p-2 ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
              >
                <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              </Pressable>
            </View>

            {/* Deck List */}
            {allDecks.length === 0 ? (
              <View className="p-8 items-center">
                <Text
                  className={`text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  No other decks available
                </Text>
                <Text
                  className={`text-sm text-center mt-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  Create another deck to use as an opponent
                </Text>
              </View>
            ) : (
              <FlatList
                data={allDecks}
                keyExtractor={(item) => item.id}
                renderItem={renderDeckOption}
                contentContainerStyle={{ paddingBottom: 24 }}
              />
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Existing Game Dialog */}
      <Modal
        visible={showExistingGameDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExistingGameDialog(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View
            className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? "bg-slate-900" : "bg-white"}`}
          >
            <Text
              className={`text-lg font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Game in Progress
            </Text>
            <Text
              className={`mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              There's an existing playtest session for this deck. Would you like
              to continue or start fresh?
            </Text>

            <View className="gap-3">
              <Button
                onPress={handleContinueGame}
                className="w-full h-12 bg-green-500 active:bg-green-600"
              >
                <Text className="text-white font-semibold">Continue Game</Text>
              </Button>

              <Button
                onPress={handleEndGame}
                className="w-full h-12 bg-red-500 active:bg-red-600"
              >
                <Text className="text-white font-semibold">End Game</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Narrative Panel Slide-out */}
      <Modal
        visible={isNarrativePanelOpen}
        transparent
        animationType="fade"
        onRequestClose={closeNarrativePanel}
      >
        <View className="flex-1">
          {/* Backdrop - tap to close */}
          <Pressable
            className="absolute inset-0 bg-black/30"
            onPress={closeNarrativePanel}
          />

          {/* Panel from the right */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 320,
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              elevation: 10,
              shadowColor: '#000',
              shadowOffset: { width: -2, height: 0 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              transform: [{ translateX: narrativePanelAnim }],
            }}
          >
            {/* Panel Header */}
            <View
              className={`flex-row items-center justify-between p-4 border-b ${
                isDark ? "border-slate-800" : "border-slate-200"
              }`}
            >
              <View className="flex-row items-center gap-2">
                <MessageCircle size={20} color="#a855f7" />
                <Text
                  className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Game Log
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                {/* Simple / Verbose toggle */}
                <View className={`flex-row rounded-lg overflow-hidden border ${isDark ? "border-slate-700" : "border-slate-300"}`}>
                  <Pressable
                    onPress={() => setLogViewMode('simple')}
                    className={`px-2.5 py-1 ${logViewMode === 'simple' ? (isDark ? 'bg-purple-900/50' : 'bg-purple-100') : ''}`}
                  >
                    <Text className={`text-xs font-medium ${logViewMode === 'simple' ? (isDark ? 'text-purple-300' : 'text-purple-700') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                      Simple
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setLogViewMode('verbose')}
                    className={`px-2.5 py-1 border-l ${isDark ? "border-slate-700" : "border-slate-300"} ${logViewMode === 'verbose' ? (isDark ? 'bg-purple-900/50' : 'bg-purple-100') : ''}`}
                  >
                    <Text className={`text-xs font-medium ${logViewMode === 'verbose' ? (isDark ? 'text-purple-300' : 'text-purple-700') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                      Verbose
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={closeNarrativePanel}
                  className={`rounded-full p-2 ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
                >
                  <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                </Pressable>
              </View>
            </View>

            {/* Token Usage Display */}
            {tokenUsage && (
              <View
                className={`px-4 py-3 border-b ${isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    AI Token Usage
                  </Text>
                  <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    {tokenUsage.callCount} calls
                  </Text>
                </View>
                <View className="flex-row items-center justify-between mt-1">
                  <View className="flex-row items-center gap-3">
                    <View>
                      <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Input</Text>
                      <Text className={`text-sm font-semibold ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                        {tokenUsage.totalInputTokens.toLocaleString()}
                      </Text>
                    </View>
                    <View>
                      <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Output</Text>
                      <Text className={`text-sm font-semibold ${isDark ? "text-green-400" : "text-green-600"}`}>
                        {tokenUsage.totalOutputTokens.toLocaleString()}
                      </Text>
                    </View>
                    {tokenUsage.totalCacheReadInputTokens > 0 && (
                      <View>
                        <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Cache</Text>
                        <Text className={`text-sm font-semibold ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                          {tokenUsage.totalCacheReadInputTokens.toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View>
                    <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Total</Text>
                    <Text className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {(tokenUsage.totalInputTokens + tokenUsage.totalOutputTokens).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Debug: Get Game State Button */}
            <View
              className={`px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
            >
              <Pressable
                onPress={handleGetGameState}
                className={`flex-row items-center justify-center gap-2 py-2 rounded-lg ${
                  isDark ? "bg-blue-900/30 active:bg-blue-900/50" : "bg-blue-100 active:bg-blue-200"
                }`}
              >
                <Text className={`text-xs font-semibold ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                  {showGameState ? "Hide Game State" : "Get Game State"}
                </Text>
              </Pressable>
            </View>

            {/* Game State Display */}
            {showGameState && gameState && (
              <View className="relative">
                <ScrollView
                  className={`max-h-64 border-b ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}
                  contentContainerStyle={{ padding: 12, paddingTop: 40 }}
                >
                  <Text
                    className={`text-xs font-mono ${isDark ? "text-slate-300" : "text-slate-700"}`}
                    selectable
                  >
                    {JSON.stringify(gameState, null, 2)}
                  </Text>
                </ScrollView>
                {/* Copy Button Overlay */}
                <View className="absolute top-2 right-2">
                  <Pressable
                    onPress={handleCopyGameState}
                    className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                      copied
                        ? (isDark ? "bg-green-900/50" : "bg-green-100")
                        : (isDark ? "bg-blue-900/50 active:bg-blue-900/70" : "bg-blue-100 active:bg-blue-200")
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={12} color="#22c55e" />
                        <Text className="text-green-500 font-medium text-xs">Copied!</Text>
                      </>
                    ) : (
                      <>
                        <Copy size={12} color={isDark ? "#60a5fa" : "#2563eb"} />
                        <Text className={`font-medium text-xs ${isDark ? "text-blue-400" : "text-blue-600"}`}>Copy</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* Narrative Content */}
            <ScrollView
              ref={narrativeScrollRef}
              className="flex-1"
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              onScroll={handleNarrativeScroll}
              onContentSizeChange={handleNarrativeContentSizeChange}
              scrollEventThrottle={16}
            >
              {logs.length === 0 ? (
                <Text
                  className={`text-sm text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Waiting for the game to begin...
                </Text>
              ) : logViewMode === 'verbose' ? (
                logs.map((log, index) => (
                  <View key={log.id} className="mb-3">
                    {/* Show turn marker when turn changes */}
                    {(index === 0 || logs[index - 1]?.context.turn !== log.context.turn) && log.context.turn && (
                      <View
                        className={`mb-2 pb-2 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}
                      >
                        <Text
                          className={`text-xs font-bold uppercase tracking-wide ${
                            isDark ? "text-amber-400" : "text-amber-600"
                          }`}
                        >
                          Turn {log.context.turn}
                        </Text>
                      </View>
                    )}
                    <Text
                      className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700"}`}
                    >
                      {logToNaturalLanguage(log)}
                    </Text>
                    <Text
                      className={`text-xs mt-1 ${isDark ? "text-slate-600" : "text-slate-400"}`}
                    >
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                ))
              ) : (
                getSimpleLogs().map((entry, index, arr) => (
                  <View key={entry.id} className="mb-2">
                    {/* Show turn marker when turn changes */}
                    {(index === 0 || arr[index - 1]?.turn !== entry.turn) && entry.turn && (
                      <View
                        className={`mb-2 pb-1 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}
                      >
                        <Text
                          className={`text-xs font-bold uppercase tracking-wide ${
                            isDark ? "text-amber-400" : "text-amber-600"
                          }`}
                        >
                          Turn {entry.turn}
                        </Text>
                      </View>
                    )}
                    <Text
                      className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700"}`}
                    >
                      {entry.message}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            {/* End Game Button */}
            <View
              className={`p-4 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}
            >
              <Pressable
                onPress={handleEndGame}
                className={`flex-row items-center justify-center gap-2 py-3 rounded-lg ${
                  isDark ? "bg-red-900/30 active:bg-red-900/50" : "bg-red-100 active:bg-red-200"
                }`}
              >
                <StopCircle size={18} color="#ef4444" />
                <Text className="text-red-500 font-semibold">End Game</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* End Game Confirmation Dialog */}
      <Modal
        visible={showEndGameConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndGameConfirm(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View
            className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? "bg-slate-900" : "bg-white"}`}
          >
            <Text
              className={`text-lg font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}
            >
              End Game?
            </Text>
            <Text
              className={`mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Are you sure you want to end the current game? This cannot be undone.
            </Text>

            <View className="flex-row gap-3">
              <Button
                onPress={() => setShowEndGameConfirm(false)}
                className={`flex-1 h-12 ${isDark ? "bg-slate-700 active:bg-slate-600" : "bg-slate-200 active:bg-slate-300"}`}
              >
                <Text className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Cancel</Text>
              </Button>

              <Button
                onPress={() => {
                  setShowEndGameConfirm(false);
                  handleEndGame();
                }}
                className="flex-1 h-12 bg-red-500 active:bg-red-600"
              >
                <Text className="text-white font-semibold">End Game</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );

  // Render with appropriate wrapper based on screen size
  if (isDesktop) {
    return (
      <View className="flex-1 flex-row">
        <DesktopSidebar />
        <View className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
          {pageContent}
        </View>
      </View>
    );
  }

  // Mobile Layout
  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}>
      {pageContent}
    </SafeAreaView>
  );
}
