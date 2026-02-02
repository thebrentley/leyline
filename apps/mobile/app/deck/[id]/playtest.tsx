import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  MessageCircle,
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
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  // Track current game state for context in log entries
  const [currentGameContext, setCurrentGameContext] = useState<{
    phase?: string;
    step?: string;
    activePlayerDeckName?: string;
    turn?: number;
  }>({});
  // Friendly narrative panel state
  const [isNarrativePanelOpen, setIsNarrativePanelOpen] = useState(false);
  // Scroll stick-to-bottom state
  const narrativeScrollRef = useRef<ScrollView>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollContentHeight = useRef(0);
  const scrollViewHeight = useRef(0);
  // Animation for slide-from-right panel
  const PANEL_WIDTH = 320;
  const narrativePanelAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;

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

    const unsubscribe = onPlaytestMessage((message) => {
      if (message.deckId !== id) return;

      // Extract game state context from certain message types
      const messageAny = message as any;

      // Update current game context based on message type
      if (messageAny.type === 'gamestate:full' && messageAny.gameState) {
        const gs = messageAny.gameState;
        setCurrentGameContext({
          phase: gs.phase,
          step: gs.step,
          turn: gs.turnNumber,
          activePlayerDeckName: gs.activePlayer === 'player' ? gs.deckName : gs.opponentDeckName,
        });
      } else if (messageAny.type === 'phase:changed') {
        setCurrentGameContext(prev => ({
          ...prev,
          phase: messageAny.phase,
          step: messageAny.step,
        }));
      } else if (messageAny.type === 'turn:started') {
        setCurrentGameContext(prev => ({
          ...prev,
          turn: messageAny.turnNumber,
          // Active player deck name will be set by gamestate:full
        }));
      }

      // Skip noisy message types
      if (messageAny.type === 'game:log' || messageAny.type === 'priority:changed') {
        return;
      }

      // Get context at time of message (use functional update to access latest state)
      setCurrentGameContext(prevContext => {
        // Add log entry with current context
        setLogs((prevLogs) => [
          ...prevLogs,
          {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date().toISOString(),
            message,
            context: { ...prevContext },
          },
        ]);
        return prevContext;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [id, onPlaytestMessage]);

  const handleStartGame = async () => {
    if (!id || !opponentDeck) return;

    setStartingGame(true);
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
      setLogs([]);
      setExpandedLogs(new Set());
      setCurrentGameContext({});
      setIsNarrativePanelOpen(false);
    } catch (err) {
      console.error("Error ending game:", err);
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
      default:
        return `📝 ${msg.type}`;
    }
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
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: isDesktop ? 24 : 16,
            paddingBottom: 48,
            flexGrow: 1,
          }}
        >
          <View className={`max-w-2xl ${isDesktop ? "mx-auto w-full" : ""}`}>
            {isGameActive ? (
              /* Game View - Socket Messages */
              <View>
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2">
                    <Text
                      className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      Socket Messages
                    </Text>
                    <View
                      className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
                    />
                  </View>
                  <Pressable
                    onPress={handleEndGame}
                    className={`flex-row items-center gap-2 px-3 py-2 rounded-lg ${
                      isDark ? "bg-red-900/30 active:bg-red-900/50" : "bg-red-100 active:bg-red-200"
                    }`}
                  >
                    <StopCircle size={16} color="#ef4444" />
                    <Text className="text-red-500 font-medium text-sm">End Game</Text>
                  </Pressable>
                </View>
                {logs.length === 0 ? (
                  <Text
                    className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Waiting for messages...
                  </Text>
                ) : (
                  logs.map((log) => {
                    const isExpanded = expandedLogs.has(log.id);
                    const toggleExpanded = () => {
                      setExpandedLogs((prev) => {
                        const next = new Set(prev);
                        if (next.has(log.id)) {
                          next.delete(log.id);
                        } else {
                          next.add(log.id);
                        }
                        return next;
                      });
                    };

                    // Format phase/step for display
                    const formatPhaseStep = (phase?: string, step?: string) => {
                      if (!phase) return null;
                      const phaseLabels: Record<string, string> = {
                        pregame: 'Pregame',
                        beginning: 'Beginning',
                        precombat_main: 'Main 1',
                        combat: 'Combat',
                        postcombat_main: 'Main 2',
                        ending: 'Ending',
                      };
                      const stepLabels: Record<string, string> = {
                        mulligan: 'Mulligan',
                        bottom_cards: 'Bottom Cards',
                        untap: 'Untap',
                        upkeep: 'Upkeep',
                        draw: 'Draw',
                        main: 'Main',
                        beginning_of_combat: 'Begin Combat',
                        declare_attackers: 'Attackers',
                        declare_blockers: 'Blockers',
                        first_strike_damage: '1st Strike',
                        combat_damage: 'Damage',
                        end_of_combat: 'End Combat',
                        end: 'End',
                        cleanup: 'Cleanup',
                      };
                      const phaseStr = phaseLabels[phase] || phase;
                      const stepStr = step ? stepLabels[step] || step : null;
                      return stepStr ? `${phaseStr} - ${stepStr}` : phaseStr;
                    };

                    const phaseStepStr = formatPhaseStep(log.context.phase, log.context.step);

                    return (
                      <Pressable
                        key={log.id}
                        onPress={toggleExpanded}
                        className={`mb-3 p-3 rounded-lg ${isDark ? "bg-slate-800 active:bg-slate-700" : "bg-slate-100 active:bg-slate-200"}`}
                      >
                        <View className="flex-row items-center gap-2 flex-wrap">
                          {isExpanded ? (
                            <ChevronDown size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                          ) : (
                            <ChevronRight size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                          )}
                          {/* Turn number */}
                          {log.context.turn && (
                            <Text
                              className={`text-xs font-semibold ${isDark ? "text-amber-400" : "text-amber-600"}`}
                            >
                              T{log.context.turn}
                            </Text>
                          )}
                          {/* Deck name (active player) */}
                          {log.context.activePlayerDeckName && (
                            <Text
                              className={`text-sm font-semibold ${isDark ? "text-blue-400" : "text-blue-600"}`}
                              numberOfLines={1}
                            >
                              {log.context.activePlayerDeckName}
                            </Text>
                          )}
                          {/* Phase/Step */}
                          {phaseStepStr && (
                            <Text
                              className={`text-xs px-1.5 py-0.5 rounded ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}
                            >
                              {phaseStepStr}
                            </Text>
                          )}
                          {/* Message type */}
                          <Text
                            className={`font-mono text-sm font-semibold ${isDark ? "text-green-400" : "text-green-600"}`}
                          >
                            {log.message.type}
                          </Text>
                          {/* Timestamp */}
                          <Text
                            className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
                          >
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </Text>
                        </View>
                        {isExpanded && (
                          <Text
                            className={`font-mono text-xs mt-2 ml-6 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                          >
                            {JSON.stringify(log.message, null, 2)}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : (
              /* Selection UI */
              <>
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
            )}
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

      {/* Floating Narrative Panel Toggle Button */}
      {isGameActive && (
        <Pressable
          onPress={openNarrativePanel}
          className={`absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center shadow-lg ${
            isDark ? "bg-purple-600 active:bg-purple-700" : "bg-purple-500 active:bg-purple-600"
          }`}
          style={{ elevation: 5 }}
        >
          <MessageCircle size={24} color="white" />
        </Pressable>
      )}

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
                  Game Story
                </Text>
              </View>
              <Pressable
                onPress={closeNarrativePanel}
                className={`rounded-full p-2 ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
              >
                <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              </Pressable>
            </View>

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
              ) : (
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
