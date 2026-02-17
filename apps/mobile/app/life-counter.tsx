import { Redirect, Stack, useLocalSearchParams, router } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { Menu, X } from "lucide-react-native";
import * as React from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlayerCounter } from "~/components/life-counter/PlayerCounter";
import { CommanderDamageHub } from "~/components/life-counter/CommanderDamageHub";
import { CommanderDamageCounter } from "~/components/life-counter/CommanderDamageCounter";
import { CenterMenuModal } from "~/components/life-counter/CenterMenuModal";
import { secureStorage } from "~/lib/storage";
import { podsApi, type DeckSummary } from "~/lib/api";

export interface PlayerState {
  id: number;
  life: number;
  poison: number;
  commanderDamage: { [playerId: number]: number };
  commanderTax: number;
  backgroundImage?: string;
  playerName?: string;
}

export default function LifeCounterScreen() {
  if (Platform.OS === 'web') {
    return <Redirect href="/" />;
  }

  return <LifeCounterContent />;
}

function LifeCounterContent() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { players: playersParam, podId, eventId } = useLocalSearchParams<{
    players?: string;
    podId?: string;
    eventId?: string;
  }>();
  const isPodGame = Boolean(podId && eventId);
  const { height: windowHeight } = useWindowDimensions();
  const [layoutPickingPhase, setLayoutPickingPhase] = React.useState(false);
  const [seatPickingPhase, setSeatPickingPhase] = React.useState(false);
  const [eventPlayersList, setEventPlayersList] = React.useState<Array<{ name: string; profilePicture: string | null; userId: string | null }>>([]);
  const [seatAssignments, setSeatAssignments] = React.useState<(number | null)[]>([]);
  const [pickingSlot, setPickingSlot] = React.useState<number | null>(null);
  const [deckSelections, setDeckSelections] = React.useState<(DeckSummary | 'skipped' | null)[]>([]);
  const [pickingDeckSlot, setPickingDeckSlot] = React.useState<number | null>(null);
  const [memberDecks, setMemberDecks] = React.useState<DeckSummary[]>([]);
  const [loadingDecks, setLoadingDecks] = React.useState(false);
  const [centerMenuOpen, setCenterMenuOpen] = React.useState(false);
  const [playerCount, setPlayerCount] = React.useState(4);
  const [layoutType, setLayoutType] = React.useState("square");
  const [startingLife, setStartingLife] = React.useState(40);
  const startingLifeLoaded = React.useRef(false);

  React.useEffect(() => {
    secureStorage.getItem("lifeCounter.startingLife").then((val) => {
      if (val) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed)) setStartingLife(parsed);
      }
      startingLifeLoaded.current = true;
    });
  }, []);

  React.useEffect(() => {
    if (startingLifeLoaded.current) {
      secureStorage.setItem("lifeCounter.startingLife", String(startingLife));
    }
  }, [startingLife]);

  const eventInitialized = React.useRef(false);
  React.useEffect(() => {
    if (eventInitialized.current || !playersParam) return;
    eventInitialized.current = true;
    try {
      const eventPlayers: Array<{ name: string; profilePicture: string | null; userId?: string | null }> =
        JSON.parse(playersParam);
      if (eventPlayers.length >= 2 && eventPlayers.length <= 4) {
        const count = eventPlayers.length;
        setPlayerCount(count);
        setEventPlayersList(eventPlayers.map((ep) => ({ ...ep, userId: ep.userId ?? null })));
        setSeatAssignments(Array(count).fill(null));
        setDeckSelections(Array(count).fill(null));
        if (count === 3) {
          // 3 players has two layout options — let the user choose
          setLayoutPickingPhase(true);
        } else {
          setLayoutType(count === 2 ? "opposite-v" : "two-h");
          setSeatPickingPhase(true);
        }
      }
    } catch {
      // Invalid JSON, fall through to standalone mode
    }
  }, [playersParam, startingLife]);

  const [gameStartedAt, setGameStartedAt] = React.useState(() => new Date().toISOString());
  const [deathOrder, setDeathOrder] = React.useState<number[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Start game once all seats and decks are assigned
  React.useEffect(() => {
    if (!seatPickingPhase || seatAssignments.length === 0) return;
    const allSeated = seatAssignments.every((a) => a !== null);
    const allDecksResolved = deckSelections.every((d) => d !== null);
    if (allSeated && allDecksResolved) {
      setPlayers(
        seatAssignments.map((epIdx, slotIdx) => {
          const ep = eventPlayersList[epIdx!];
          const deck = deckSelections[slotIdx];
          const bgImage = (deck && deck !== 'skipped' && deck.commanderImageCrop)
            ? deck.commanderImageCrop
            : ep.profilePicture ?? undefined;
          return {
            id: slotIdx,
            life: startingLife,
            poison: 0,
            commanderDamage: {},
            commanderTax: 0,
            backgroundImage: bgImage,
            playerName: ep.name,
          };
        }),
      );
      setSeatPickingPhase(false);
      setGameStartedAt(new Date().toISOString());
    }
  }, [seatAssignments, deckSelections, seatPickingPhase, eventPlayersList, startingLife]);

  const [activeCommanderPlayer, setActiveCommanderPlayer] = React.useState<number | null>(null);
  const [highRollResults, setHighRollResults] = React.useState<{ [playerId: number]: number } | null>(null);

  const [players, setPlayers] = React.useState<PlayerState[]>(() =>
    Array.from({ length: 4 }, (_, i) => ({
      id: i,
      life: 40,
      poison: 0,
      commanderDamage: {},
      commanderTax: 0,
    })),
  );

  React.useEffect(() => {
    setPlayers((prevPlayers) => {
      const newPlayers = Array.from({ length: playerCount }, (_, i) => {
        const existing = prevPlayers[i];
        return existing
          ? existing
          : {
              id: i,
              life: startingLife,
              poison: 0,
              commanderDamage: {},
              commanderTax: 0,
            };
      });
      return newPlayers;
    });
  }, [playerCount, startingLife]);

  const updatePlayer = (id: number, updates: Partial<PlayerState>) => {
    setPlayers((prev) =>
      prev.map((player) =>
        player.id === id ? { ...player, ...updates } : player,
      ),
    );
  };

  // Track death order as players hit 0 life
  React.useEffect(() => {
    setDeathOrder((prev) => {
      let next = [...prev];
      for (const player of players) {
        const isInDeathOrder = next.includes(player.id);
        if (player.life <= 0 && !isInDeathOrder) {
          next.push(player.id);
        } else if (player.life > 0 && isInDeathOrder) {
          next = next.filter((id) => id !== player.id);
        }
      }
      return next;
    });
  }, [players]);

  // Win detection
  const alivePlayers = players.filter((p) => p.life > 0);
  const winner = alivePlayers.length === 1 && players.length > 1 ? alivePlayers[0] : null;

  const resetGame = () => {
    setPlayers((prev) =>
      prev.map((player) => ({
        ...player,
        life: startingLife,
        poison: 0,
        commanderDamage: {},
        commanderTax: 0,
      })),
    );
    setDeathOrder([]);
    setGameStartedAt(new Date().toISOString());
  };

  const saveGameResult = async () => {
    if (!podId || !eventId || !winner) return;
    const endedAt = new Date().toISOString();
    const winnerEpIdx = seatAssignments[winner.id];
    const winnerEp = winnerEpIdx !== null ? eventPlayersList[winnerEpIdx] : null;
    await podsApi.saveGameResult(podId, eventId, {
      startedAt: gameStartedAt,
      endedAt,
      winnerUserId: winnerEp?.userId ?? null,
      players: players.map((p) => {
        const epIdx = seatAssignments[p.id];
        const ep = epIdx !== null ? eventPlayersList[epIdx] : null;
        const deck = deckSelections[p.id];
        const hasDeck = deck && deck !== 'skipped';
        return {
          userId: ep?.userId ?? null,
          deckName: hasDeck ? deck.name : null,
          deckId: hasDeck ? deck.id : null,
          finalLife: p.life,
          finalPoison: p.poison,
          finalCommanderTax: p.commanderTax,
          commanderDamage: p.commanderDamage,
          deathOrder: deathOrder.includes(p.id) ? deathOrder.indexOf(p.id) + 1 : null,
          isWinner: p.id === winner.id,
        };
      }),
    });
  };

  const handleSaveAndStartAnother = async () => {
    if (!podId || !eventId || !winner) return;
    setSaving(true);
    try {
      await saveGameResult();
    } catch (e) {
      console.error("Failed to save game result:", e);
    } finally {
      setSaving(false);
      resetGame();
      // Re-enter deck selection with same seats, auto-skip offline users
      setDeckSelections(
        seatAssignments.map((epIdx) => {
          if (epIdx === null) return null;
          const ep = eventPlayersList[epIdx];
          return (!ep.userId || !podId) ? 'skipped' as const : null;
        }),
      );
      setSeatPickingPhase(true);
    }
  };

  const handleExit = async () => {
    if (isPodGame && winner) {
      setSaving(true);
      try {
        await saveGameResult();
      } catch (e) {
        console.error("Failed to save game result:", e);
      } finally {
        setSaving(false);
      }
    }
    if (podId && eventId) {
      router.replace(`/pod/${podId}/event/${eventId}`);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const handleHighRoll = () => {
    setActiveCommanderPlayer(null);
    let results: { [playerId: number]: number } = {};
    let hasUniqueWinner = false;
    while (!hasUniqueWinner) {
      for (const p of players) {
        results[p.id] = Math.floor(Math.random() * 20) + 1;
      }
      const values = Object.values(results);
      const max = Math.max(...values);
      hasUniqueWinner = values.filter((v) => v === max).length === 1;
    }
    setHighRollResults(results);
  };

  const getRotation = (index: number) => {
    if (playerCount === 2) {
      return index === 0 ? "180deg" : "0deg";
    }

    if (playerCount === 3) {
      if (layoutType === "two-top") {
        return ["90deg", "-90deg", "0deg"][index];
      }
      if (layoutType === "one-top") {
        return ["180deg", "90deg", "-90deg"][index];
      }
    }

    if (playerCount === 4) {
      return index < 2 ? "-270deg" : "-90deg";
    }

    return index === 0 || index === 1 ? "180deg" : "0deg";
  };

  const SLOT_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

  const triggerDeckSelection = (slotIdx: number, epIdx: number) => {
    const ep = eventPlayersList[epIdx];
    if (ep.userId && podId) {
      setPickingDeckSlot(slotIdx);
      setLoadingDecks(true);
      podsApi.getMemberDecks(podId, ep.userId).then((res) => {
        setMemberDecks(res.data ?? []);
        setLoadingDecks(false);
      }).catch(() => {
        setMemberDecks([]);
        setLoadingDecks(false);
      });
    } else {
      setDeckSelections((prev) => prev.map((d, i) => (i === slotIdx ? 'skipped' : d)));
    }
  };

  const handleSeatPicked = (slotIdx: number, epIdx: number) => {
    setSeatAssignments((prev) => prev.map((a, i) => (i === slotIdx ? epIdx : a)));
    setPickingSlot(null);
    triggerDeckSelection(slotIdx, epIdx);
  };

  const renderSeatPickerSlot = (index: number) => {
    const rotation = getRotation(index);
    const assignedIdx = seatAssignments[index];
    const assignedPlayer = assignedIdx !== null ? eventPlayersList[assignedIdx] : null;
    const deckSelection = deckSelections[index];
    const isReady = assignedPlayer && deckSelection !== null;

    return (
      <Pressable
        onPress={() => {
          if (assignedIdx !== null && deckSelection === null) {
            // Seat assigned but no deck — go straight to deck picker
            triggerDeckSelection(index, assignedIdx);
          } else {
            if (assignedIdx !== null) {
              setSeatAssignments((prev) => prev.map((a, i) => (i === index ? null : a)));
              setDeckSelections((prev) => prev.map((d, i) => (i === index ? null : d)));
            }
            setPickingSlot(index);
          }
        }}
        style={{ flex: 1, backgroundColor: assignedPlayer ? '#1e293b' : SLOT_COLORS[index] }}
        className="items-center justify-center"
      >
        <View style={{ transform: [{ rotate: rotation }] }} className="items-center justify-center">
          {assignedPlayer ? (
            <>
              <Text className="text-2xl font-bold text-white">{assignedPlayer.name}</Text>
              {deckSelection && deckSelection !== 'skipped' && (
                <Text className="mt-1 text-sm text-purple-300" numberOfLines={1}>
                  {deckSelection.name}
                </Text>
              )}
              {isReady && (
                <Text className="mt-1 text-base text-green-400">{'\u2713'} Ready</Text>
              )}
            </>
          ) : (
            <Text className="text-center text-2xl font-bold text-white/90">
              Tap to{'\n'}pick seat
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  const renderPlayerSlot = (index: number) => {
    if (seatPickingPhase) return renderSeatPickerSlot(index);

    const player = players[index];
    const rotation = getRotation(index);

    let content;

    if (activeCommanderPlayer !== null) {
      if (player.id === activeCommanderPlayer) {
        content = (
          <CommanderDamageHub
            player={player}
            rotation={rotation}
            onExit={() => setActiveCommanderPlayer(null)}
          />
        );
      } else {
        const focusedPlayer = players.find((p) => p.id === activeCommanderPlayer)!;
        content = (
          <CommanderDamageCounter
            player={player}
            focusedPlayer={focusedPlayer}
            onUpdateFocusedPlayer={(updates) => updatePlayer(activeCommanderPlayer, updates)}
            rotation={rotation}
          />
        );
      }
    } else {
      content = (
        <PlayerCounter
          player={player}
          onUpdate={(updates) => updatePlayer(index, updates)}
          rotation={rotation}
          playerCount={playerCount}
          onSwipe={() => setActiveCommanderPlayer(player.id)}
          menuOpen={centerMenuOpen}
          insets={insets}
        />
      );
    }

    if (highRollResults) {
      const roll = highRollResults[player.id];
      const maxRoll = Math.max(...Object.values(highRollResults));
      const isWinner = roll === maxRoll;

      return (
        <View style={{ flex: 1 }}>
          {content}
          <HighRollOverlay roll={roll} isWinner={isWinner} rotation={rotation} />
        </View>
      );
    }

    return content;
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Life Counter",
          headerShown: false,
        }}
      />

      <View style={{ flex: 1 }} className="bg-background">
        {layoutPickingPhase && (
          <View className="flex-1 items-center justify-center bg-slate-950 px-8">
            <Text className="mb-2 text-2xl font-bold text-white">Choose Layout</Text>
            <Text className="mb-8 text-base text-slate-400">Select how players are arranged</Text>
            <View className="w-full flex-row justify-center gap-6">
              {[
                { type: "two-top", label: "2 Top, 1 Bottom", layout: (
                  <View className="aspect-[9/16] w-24 gap-[2px]">
                    <View style={{ flex: 2 }} className="flex-row gap-[2px]">
                      <View className="flex-1 items-center justify-center rounded bg-yellow-400" />
                      <View className="flex-1 items-center justify-center rounded bg-pink-500" />
                    </View>
                    <View style={{ flex: 1 }} className="items-center justify-center rounded bg-purple-400" />
                  </View>
                )},
                { type: "one-top", label: "1 Top, 2 Bottom", layout: (
                  <View className="aspect-[9/16] w-24 gap-[2px]">
                    <View style={{ flex: 1 }} className="items-center justify-center rounded bg-yellow-400" />
                    <View style={{ flex: 2 }} className="flex-row gap-[2px]">
                      <View className="flex-1 items-center justify-center rounded bg-pink-500" />
                      <View className="flex-1 items-center justify-center rounded bg-purple-400" />
                    </View>
                  </View>
                )},
              ].map((opt) => (
                <Pressable
                  key={opt.type}
                  onPress={() => {
                    setLayoutType(opt.type);
                    setLayoutPickingPhase(false);
                    setSeatPickingPhase(true);
                  }}
                  className="items-center rounded-xl bg-slate-800 p-4 active:bg-slate-700"
                >
                  {opt.layout}
                  <Text className="mt-3 text-sm font-medium text-white">{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={handleExit}
              className="mt-8 rounded-xl bg-slate-700 px-8 py-3 active:bg-slate-600"
            >
              <Text className="text-base font-medium text-white">Cancel</Text>
            </Pressable>
          </View>
        )}

        {!layoutPickingPhase && playerCount === 2 && players.length >= 2 && (
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
              {renderPlayerSlot(0)}
            </View>
            <View className="h-[2px] bg-white dark:bg-slate-900" />
            <View style={{ flex: 1 }}>
              {renderPlayerSlot(1)}
            </View>
          </View>
        )}

        {!layoutPickingPhase && playerCount === 3 && players.length >= 3 && (
          <>
            {layoutType === "two-top" && (
              <View className="h-full w-full">
                <View style={{ flex: 2 }} className="flex-row">
                  <View className="flex-1">
                    {renderPlayerSlot(0)}
                  </View>
                  <View className="w-[2px] bg-white dark:bg-slate-900" />
                  <View className="flex-1">
                    {renderPlayerSlot(1)}
                  </View>
                </View>
                <View className="h-[2px] bg-white dark:bg-slate-900" />
                <View className="flex-1">
                  {renderPlayerSlot(2)}
                </View>
              </View>
            )}

            {layoutType === "one-top" && (
              <View className="h-full w-full">
                <View style={{ flex: 1 }}>
                  {renderPlayerSlot(0)}
                </View>
                <View className="h-[2px] bg-white dark:bg-slate-900" />
                <View style={{ flex: 2 }} className="flex-row">
                  <View className="flex-1">
                    {renderPlayerSlot(1)}
                  </View>
                  <View className="w-[2px] bg-white dark:bg-slate-900" />
                  <View className="flex-1">
                    {renderPlayerSlot(2)}
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {!layoutPickingPhase && playerCount === 4 && players.length >= 4 && (
          <View className="h-full w-full flex-row">
            <View className="flex-1">
              <View className="flex-1">
                {renderPlayerSlot(0)}
              </View>
              <View className="h-[2px] bg-white dark:bg-slate-900" />
              <View className="flex-1">
                {renderPlayerSlot(1)}
              </View>
            </View>
            <View className="w-[2px] bg-white dark:bg-slate-900" />
            <View className="flex-1">
              <View className="flex-1">
                {renderPlayerSlot(2)}
              </View>
              <View className="h-[2px] bg-white dark:bg-slate-900" />
              <View className="flex-1">
                {renderPlayerSlot(3)}
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Exit button during seat picking */}
      {seatPickingPhase && (
        <Pressable
          onPress={handleExit}
          className="absolute z-50 h-16 w-16 -translate-x-8 -translate-y-8 items-center justify-center rounded-full bg-slate-700 shadow-lg active:bg-slate-600"
          style={{
            left: "50%",
            top:
              playerCount === 3 && layoutType === "two-top"
                ? "66.7%"
                : playerCount === 3 && layoutType === "one-top"
                  ? "33.3%"
                  : "50%",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <X size={32} color="white" />
        </Pressable>
      )}

      {/* Center Menu Button */}
      {activeCommanderPlayer === null && !seatPickingPhase && !layoutPickingPhase && (
        <Pressable
          onPress={() => highRollResults ? setHighRollResults(null) : setCenterMenuOpen(true)}
          className="absolute z-50 h-16 w-16 -translate-x-8 -translate-y-8 items-center justify-center rounded-full bg-purple-600 shadow-lg active:bg-purple-700"
          style={{
            left: "50%",
            top:
              playerCount === 3 && layoutType === "two-top"
                ? "66.7%"
                : playerCount === 3 && layoutType === "one-top"
                  ? "33.3%"
                  : "50%",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          {highRollResults ? <X size={32} color="white" /> : <Menu size={32} color="white" />}
        </Pressable>
      )}

      <CenterMenuModal
        open={centerMenuOpen}
        onClose={() => setCenterMenuOpen(false)}
        playerCount={playerCount}
        layoutType={layoutType}
        onLayoutChange={(count, type) => {
          setPlayerCount(count);
          setLayoutType(type);
        }}
        onReset={resetGame}
        onHighRoll={handleHighRoll}
        startingLife={startingLife}
        onStartingLifeChange={setStartingLife}
      />

      {pickingSlot !== null && pickingDeckSlot === null && (
        <View className="absolute inset-0 z-50 items-center justify-center bg-black/70">
          <View className="w-72 rounded-2xl bg-slate-800 p-6">
            <Text className="mb-4 text-center text-xl font-bold text-white">Pick Your Seat</Text>
            {eventPlayersList.map((ep, epIdx) => {
              const assignedToOther = seatAssignments.some((a, i) => a === epIdx && i !== pickingSlot);
              if (assignedToOther) return null;
              const isCurrentlyAssigned = seatAssignments[pickingSlot] === epIdx;
              return (
                <Pressable
                  key={epIdx}
                  onPress={() => handleSeatPicked(pickingSlot, epIdx)}
                  className={`mb-2 rounded-xl px-4 py-3 active:bg-slate-600 ${isCurrentlyAssigned ? "bg-purple-600" : "bg-slate-700"}`}
                >
                  <Text className="text-center text-lg font-semibold text-white">{ep.name}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setPickingSlot(null)}
              className="mt-2 rounded-xl bg-slate-900 px-4 py-3 active:bg-slate-950"
            >
              <Text className="text-center text-base font-medium text-slate-400">Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {pickingDeckSlot !== null && (
        <View className="absolute inset-0 z-50 items-center justify-center bg-black/70">
          <View className="w-[90%] max-w-md rounded-2xl bg-slate-800 p-4">
            <Text className="mb-1 text-center text-xl font-bold text-white">Pick Your Deck</Text>
            <Text className="mb-4 text-center text-sm text-slate-400">
              {seatAssignments[pickingDeckSlot] !== null
                ? eventPlayersList[seatAssignments[pickingDeckSlot]!].name
                : ''}
            </Text>
            {loadingDecks ? (
              <ActivityIndicator color="white" className="my-8" />
            ) : memberDecks.length === 0 ? (
              <Text className="my-4 text-center text-sm text-slate-400">No decks found</Text>
            ) : (
              <View style={{ maxHeight: windowHeight * 0.55 }} className="mb-3">
                <ScrollView>
                  <View className="flex-row flex-wrap">
                    {memberDecks.map((deck) => (
                      <View key={deck.id} style={{ width: '50%', height: 140, padding: 3 }}>
                        <Pressable
                          onPress={() => {
                            setDeckSelections((prev) =>
                              prev.map((d, i) => (i === pickingDeckSlot ? deck : d)),
                            );
                            setPickingDeckSlot(null);
                          }}
                          className="flex-1 overflow-hidden rounded-xl"
                        >
                          <View className="absolute inset-0">
                            {deck.commanderImageCrop ? (
                              <Image
                                source={{ uri: deck.commanderImageCrop }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                              />
                            ) : (
                              <View className="h-full w-full items-center justify-center bg-slate-700" />
                            )}
                          </View>
                          <View
                            className="absolute bottom-0 left-0 right-0 justify-end p-2"
                            style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', height: 56 }}
                          >
                            {deck.commanders[0] && (
                              <Text className="text-[10px] text-white/70" numberOfLines={1}>
                                {deck.commanders[0]}
                              </Text>
                            )}
                            <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                              {deck.name}
                            </Text>
                          </View>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
            <Pressable
              onPress={() => {
                setDeckSelections((prev) =>
                  prev.map((d, i) => (i === pickingDeckSlot ? 'skipped' : d)),
                );
                setPickingDeckSlot(null);
              }}
              className="rounded-xl bg-slate-900 px-4 py-3 active:bg-slate-950"
            >
              <Text className="text-center text-base font-medium text-slate-400">Not Listed</Text>
            </Pressable>
          </View>
        </View>
      )}

      {winner && (
        <WinOverlay
          winnerName={winner.playerName || `Player ${winner.id + 1}`}
          isPodGame={isPodGame}
          onExit={handleExit}
          onSaveAndStartAnother={handleSaveAndStartAnother}
          onPlayAgain={resetGame}
          saving={saving}
        />
      )}
    </>
  );
}

function HighRollOverlay({ roll, isWinner, rotation }: { roll: number; isWinner: boolean; rotation: string }) {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const dimensions = useWindowDimensions();
  const isTablet = Math.min(dimensions.width, dimensions.height) > 600;
  const fontSize = isTablet ? 180 : 120;

  const isRotated90 =
    rotation === "90deg" || rotation === "-90deg" ||
    rotation === "270deg" || rotation === "-270deg";

  return (
    <View
      className="absolute inset-0 bg-black"
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size.width > 0 && (
        <View
          style={{
            position: "absolute",
            width: isRotated90 ? size.height : size.width,
            height: isRotated90 ? size.width : size.height,
            left: isRotated90 ? (size.width - size.height) / 2 : 0,
            top: isRotated90 ? (size.height - size.width) / 2 : 0,
            transform: [{ rotate: rotation }],
          }}
          className="items-center justify-center"
        >
          <Text
            className={`font-black ${isWinner ? "text-white" : "text-white/30"}`}
            style={{ fontSize, lineHeight: fontSize }}
          >
            {roll}
          </Text>
          {isWinner && (
            <Text className="mt-2 text-lg font-bold text-yellow-300">HIGH ROLL</Text>
          )}
        </View>
      )}
    </View>
  );
}

function WinOverlay({
  winnerName,
  isPodGame,
  onExit,
  onSaveAndStartAnother,
  onPlayAgain,
  saving,
}: {
  winnerName: string;
  isPodGame: boolean;
  onExit: () => void;
  onSaveAndStartAnother: () => void;
  onPlayAgain: () => void;
  saving: boolean;
}) {
  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-black/80">
      <Text className="text-5xl font-black text-yellow-300">WINNER</Text>
      <Text className="mt-4 text-3xl font-bold text-white">{winnerName}</Text>

      <View className="mt-10 gap-3" style={{ width: "70%" }}>
        {isPodGame ? (
          <>
            <Pressable
              onPress={onSaveAndStartAnother}
              disabled={saving}
              className={`items-center rounded-xl py-4 ${saving ? "bg-purple-800" : "bg-purple-600 active:bg-purple-700"}`}
            >
              <Text className="text-lg font-bold text-white">
                {saving ? "Saving..." : "Save & Start Another"}
              </Text>
            </Pressable>
            <Pressable
              onPress={onExit}
              disabled={saving}
              className={`items-center rounded-xl py-4 ${saving ? "bg-slate-800" : "bg-slate-700 active:bg-slate-600"}`}
            >
              <Text className="text-lg font-bold text-white">
                {saving ? "Saving..." : "Save & Exit"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={onPlayAgain}
              className="items-center rounded-xl bg-purple-600 py-4 active:bg-purple-700"
            >
              <Text className="text-lg font-bold text-white">Play Again</Text>
            </Pressable>
            <Pressable
              onPress={onExit}
              className="items-center rounded-xl bg-slate-700 py-4 active:bg-slate-600"
            >
              <Text className="text-lg font-bold text-white">Exit</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
