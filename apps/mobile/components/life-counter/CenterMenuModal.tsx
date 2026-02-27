import {
  RotateCcw,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  Dices,
} from "lucide-react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as React from "react";
import { Pressable, View, Text, Modal } from "react-native";
import { useColorScheme } from "nativewind";
import { useRouter } from "expo-router";
import { GlassSheet } from "../ui/GlassSheet";

type Screen = "menu" | "players" | "settings";
type ConfirmModal = "restart" | "layout-change" | null;

interface CenterMenuModalProps {
  open: boolean;
  onClose: () => void;
  playerCount: number;
  layoutType?: string;
  onLayoutChange: (count: number, layoutType: string) => void;
  onReset: () => void;
  onHighRoll: () => void;
  startingLife: number;
  onStartingLifeChange: (life: number) => void;
  showCounters: boolean;
  onShowCountersChange: (show: boolean) => void;
}

interface LayoutOption {
  id: string;
  playerCount: number;
  layout: React.ReactNode;
  layoutType?: string;
}

const STARTING_LIFE_OPTIONS = [20, 30, 40];

export function CenterMenuModal({
  open,
  onClose,
  playerCount,
  layoutType,
  onLayoutChange,
  onReset,
  onHighRoll,
  startingLife,
  onStartingLifeChange,
  showCounters,
  onShowCountersChange,
}: CenterMenuModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();

  const [screen, setScreen] = React.useState<Screen>("menu");
  const [confirmModal, setConfirmModal] = React.useState<ConfirmModal>(null);
  const [pendingLayout, setPendingLayout] = React.useState<{
    count: number;
    type: string;
  } | null>(null);

  const handleClose = () => {
    setScreen("menu");
    setPendingLayout(null);
    setConfirmModal(null);
    onClose();
  };

  const handleRestart = () => {
    onReset();
    setConfirmModal(null);
    handleClose();
  };

  const handleSelectLayout = (count: number, type: string) => {
    setPendingLayout({ count, type });
    setConfirmModal("layout-change");
  };

  const handleConfirmLayoutChange = () => {
    if (pendingLayout) {
      onLayoutChange(pendingLayout.count, pendingLayout.type);
      onReset();
    }
    setConfirmModal(null);
    handleClose();
  };

  const handleDeclineLayoutChange = () => {
    setPendingLayout(null);
    setConfirmModal(null);
  };

  const handleExit = () => {
    handleClose();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const textColor = isDark ? "text-white" : "text-slate-900";
  const subtextColor = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/10" : "bg-black/5";

  const layoutOptions: LayoutOption[] = [
    {
      id: "2-opposite-v",
      playerCount: 2,
      layoutType: "opposite-v",
      layout: (
        <View className="aspect-[9/20] w-full gap-[2px]">
          <View className="flex-1 items-center justify-center rounded bg-yellow-400">
            <Text className="text-xs text-black">↑</Text>
          </View>
          <View className="flex-1 items-center justify-center rounded bg-pink-500">
            <Text className="text-xs text-black">↓</Text>
          </View>
        </View>
      ),
    },
    {
      id: "3-two-top",
      playerCount: 3,
      layoutType: "two-top",
      layout: (
        <View className="aspect-[9/20] w-full gap-[2px]">
          <View style={{ flex: 2 }} className="flex-row gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-yellow-400">
              <Text className="text-xs text-black">↑</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">↑</Text>
            </View>
          </View>
          <View
            style={{ flex: 1 }}
            className="items-center justify-center rounded bg-purple-400"
          >
            <Text className="text-xs text-black">↓</Text>
          </View>
        </View>
      ),
    },
    {
      id: "3-one-top",
      playerCount: 3,
      layoutType: "one-top",
      layout: (
        <View className="aspect-[9/20] w-full gap-[2px]">
          <View
            style={{ flex: 1 }}
            className="items-center justify-center rounded bg-yellow-400"
          >
            <Text className="text-xs text-black">↑</Text>
          </View>
          <View style={{ flex: 2 }} className="flex-row gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">↓</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-purple-400">
              <Text className="text-xs text-black">↓</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: "3-empty-tl",
      playerCount: 3,
      layoutType: "empty-tl",
      layout: (
        <View className="aspect-[9/20] w-full flex-row gap-[2px]">
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 rounded bg-slate-700" />
            <View className="flex-1 items-center justify-center rounded bg-yellow-400">
              <Text className="text-xs text-black">←</Text>
            </View>
          </View>
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">→</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-purple-400">
              <Text className="text-xs text-black">→</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: "3-empty-bl",
      playerCount: 3,
      layoutType: "empty-bl",
      layout: (
        <View className="aspect-[9/20] w-full flex-row gap-[2px]">
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-yellow-400">
              <Text className="text-xs text-black">←</Text>
            </View>
            <View className="flex-1 rounded bg-slate-700" />
          </View>
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">→</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-purple-400">
              <Text className="text-xs text-black">→</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: "3-empty-tr",
      playerCount: 3,
      layoutType: "empty-tr",
      layout: (
        <View className="aspect-[9/20] w-full flex-row gap-[2px]">
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-yellow-400">
              <Text className="text-xs text-black">←</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">←</Text>
            </View>
          </View>
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 rounded bg-slate-700" />
            <View className="flex-1 items-center justify-center rounded bg-purple-400">
              <Text className="text-xs text-black">→</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: "3-empty-br",
      playerCount: 3,
      layoutType: "empty-br",
      layout: (
        <View className="aspect-[9/20] w-full flex-row gap-[2px]">
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-yellow-400">
              <Text className="text-xs text-black">←</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">←</Text>
            </View>
          </View>
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-purple-400">
              <Text className="text-xs text-black">→</Text>
            </View>
            <View className="flex-1 rounded bg-slate-700" />
          </View>
        </View>
      ),
    },
    {
      id: "4-two-h",
      playerCount: 4,
      layoutType: "two-h",
      layout: (
        <View className="aspect-[9/20] w-full flex-row gap-[2px]">
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-yellow-400">
              <Text className="text-xs text-black">←</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">←</Text>
            </View>
          </View>
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-purple-400">
              <Text className="text-xs text-black">→</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-blue-400">
              <Text className="text-xs text-black">→</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: "5-one-bottom",
      playerCount: 5,
      layoutType: "one-bottom",
      layout: (
        <View className="aspect-[9/20] w-full gap-[2px]">
          <View style={{ flex: 2 }} className="flex-row gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-yellow-400">
              <Text className="text-xs text-black">↑</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">↑</Text>
            </View>
          </View>
          <View style={{ flex: 2 }} className="flex-row gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-purple-400">
              <Text className="text-xs text-black">↑</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-blue-400">
              <Text className="text-xs text-black">↑</Text>
            </View>
          </View>
          <View
            style={{ flex: 1.5 }}
            className="items-center justify-center rounded bg-green-400"
          >
            <Text className="text-xs text-black">↓</Text>
          </View>
        </View>
      ),
    },
    {
      id: "5-one-top",
      playerCount: 5,
      layoutType: "one-top",
      layout: (
        <View className="aspect-[9/20] w-full gap-[2px]">
          <View
            style={{ flex: 1.5 }}
            className="items-center justify-center rounded bg-yellow-400"
          >
            <Text className="text-xs text-black">↑</Text>
          </View>
          <View style={{ flex: 2 }} className="flex-row gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">↓</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-purple-400">
              <Text className="text-xs text-black">↓</Text>
            </View>
          </View>
          <View style={{ flex: 2 }} className="flex-row gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-blue-400">
              <Text className="text-xs text-black">↓</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-green-400">
              <Text className="text-xs text-black">↓</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: "5-empty-tl",
      playerCount: 5,
      layoutType: "empty-tl",
      layout: (
        <View className="aspect-[9/20] w-full flex-row gap-[2px]">
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 rounded bg-slate-700" />
            <View className="flex-1 items-center justify-center rounded bg-yellow-400">
              <Text className="text-xs text-black">←</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">←</Text>
            </View>
          </View>
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-purple-400">
              <Text className="text-xs text-black">→</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-blue-400">
              <Text className="text-xs text-black">→</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-green-400">
              <Text className="text-xs text-black">→</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: "5-empty-bl",
      playerCount: 5,
      layoutType: "empty-bl",
      layout: (
        <View className="aspect-[9/20] w-full flex-row gap-[2px]">
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-yellow-400">
              <Text className="text-xs text-black">←</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">←</Text>
            </View>
            <View className="flex-1 rounded bg-slate-700" />
          </View>
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-purple-400">
              <Text className="text-xs text-black">→</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-blue-400">
              <Text className="text-xs text-black">→</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-green-400">
              <Text className="text-xs text-black">→</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: "5-empty-tr",
      playerCount: 5,
      layoutType: "empty-tr",
      layout: (
        <View className="aspect-[9/20] w-full flex-row gap-[2px]">
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-yellow-400">
              <Text className="text-xs text-black">←</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">←</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-purple-400">
              <Text className="text-xs text-black">←</Text>
            </View>
          </View>
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 rounded bg-slate-700" />
            <View className="flex-1 items-center justify-center rounded bg-blue-400">
              <Text className="text-xs text-black">→</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-green-400">
              <Text className="text-xs text-black">→</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: "5-empty-br",
      playerCount: 5,
      layoutType: "empty-br",
      layout: (
        <View className="aspect-[9/20] w-full flex-row gap-[2px]">
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-yellow-400">
              <Text className="text-xs text-black">←</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">←</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-purple-400">
              <Text className="text-xs text-black">←</Text>
            </View>
          </View>
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-blue-400">
              <Text className="text-xs text-black">→</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-green-400">
              <Text className="text-xs text-black">→</Text>
            </View>
            <View className="flex-1 rounded bg-slate-700" />
          </View>
        </View>
      ),
    },
    {
      id: "6-full",
      playerCount: 6,
      layoutType: "full",
      layout: (
        <View className="aspect-[9/20] w-full flex-row gap-[2px]">
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-yellow-400">
              <Text className="text-xs text-black">←</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-pink-500">
              <Text className="text-xs text-black">←</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-purple-400">
              <Text className="text-xs text-black">←</Text>
            </View>
          </View>
          <View className="flex-1 gap-[2px]">
            <View className="flex-1 items-center justify-center rounded bg-blue-400">
              <Text className="text-xs text-black">→</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-green-400">
              <Text className="text-xs text-black">→</Text>
            </View>
            <View className="flex-1 items-center justify-center rounded bg-rose-400">
              <Text className="text-xs text-black">→</Text>
            </View>
          </View>
        </View>
      ),
    },
  ];

  const screenTitle: Record<Screen, string> = {
    menu: "",
    players: "Select Layout",
    settings: "Settings",
  };

  const hasBack = screen !== "menu";

  const renderMenu = () => (
    <>
      <View className="gap-3">
        <Pressable
          onPress={() => setConfirmModal("restart")}
          className={`flex-row items-center gap-4 rounded-xl p-4 ${cardBg} active:opacity-70`}
        >
          <RotateCcw size={24} color={isDark ? "#fff" : "#1e293b"} />
          <View>
            <Text className={`text-lg font-semibold ${textColor}`}>
              Restart
            </Text>
            <Text className={`text-sm ${subtextColor}`}>
              Reset all life totals
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => { onHighRoll(); handleClose(); }}
          className={`flex-row items-center gap-4 rounded-xl p-4 ${cardBg} active:opacity-70`}
        >
          <Dices size={24} color={isDark ? "#fff" : "#1e293b"} />
          <View>
            <Text className={`text-lg font-semibold ${textColor}`}>
              High Roll
            </Text>
            <Text className={`text-sm ${subtextColor}`}>
              Roll to see who goes first
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setScreen("players")}
          className={`flex-row items-center gap-4 rounded-xl p-4 ${cardBg} active:opacity-70`}
        >
          <Users size={24} color={isDark ? "#fff" : "#1e293b"} />
          <View>
            <Text className={`text-lg font-semibold ${textColor}`}>
              Players
            </Text>
            <Text className={`text-sm ${subtextColor}`}>
              Change player layout
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setScreen("settings")}
          className={`flex-row items-center gap-4 rounded-xl p-4 ${cardBg} active:opacity-70`}
        >
          <Settings size={24} color={isDark ? "#fff" : "#1e293b"} />
          <View>
            <Text className={`text-lg font-semibold ${textColor}`}>
              Settings
            </Text>
            <Text className={`text-sm ${subtextColor}`}>
              Starting life total
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={handleExit}
          className={`flex-row items-center gap-4 rounded-xl p-4 ${cardBg} active:opacity-70`}
        >
          <LogOut size={24} color={isDark ? "#fff" : "#1e293b"} />
          <View>
            <Text className={`text-lg font-semibold ${textColor}`}>Exit</Text>
            <Text className={`text-sm ${subtextColor}`}>Return to app</Text>
          </View>
        </Pressable>
      </View>
    </>
  );


  const renderPlayers = () => (
    <>

      <View className="flex-row flex-wrap justify-center gap-3">
        {layoutOptions.map((option) => (
          <Pressable
            key={option.id}
            onPress={() =>
              handleSelectLayout(option.playerCount, option.layoutType || "")
            }
            className={`w-[30%] overflow-hidden rounded-xl p-3 ${
              playerCount === option.playerCount &&
              layoutType === option.layoutType
                ? "border-2 border-purple-600"
                : cardBg
            }`}
          >
            {option.layout}
          </Pressable>
        ))}
      </View>
    </>
  );


  const renderSettings = () => (
    <>
      <View className="gap-6">
        {/* Starting Life Total */}
        <View>
          <Text className={`mb-3 text-lg font-semibold ${textColor}`}>
            Starting Life Total
          </Text>
          <View className="flex-row gap-2">
            {STARTING_LIFE_OPTIONS.map((life) => (
              <Pressable
                key={life}
                onPress={() => onStartingLifeChange(life)}
                className={`flex-1 items-center rounded-xl p-4 ${
                  startingLife === life
                    ? "border-2 border-purple-500 bg-purple-500/20"
                    : cardBg
                }`}
              >
                <Text
                  numberOfLines={1}
                  className={`text-2xl font-bold ${
                    startingLife === life ? "text-purple-300" : textColor
                  }`}
                >
                  {life}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Show Counters Toggle */}
        <Pressable
          onPress={() => onShowCountersChange(!showCounters)}
          className={`flex-row items-center justify-between rounded-xl p-4 ${cardBg} active:opacity-70`}
        >
          <View>
            <Text className={`text-lg font-semibold ${textColor}`}>
              Show Counters
            </Text>
            <Text className={`text-sm ${subtextColor}`}>
              Display poison and commander tax
            </Text>
          </View>
          <View
            className={`h-8 w-14 rounded-full ${
              showCounters ? "bg-purple-500" : "bg-gray-600"
            }`}
          >
            <View
              className={`h-6 w-6 rounded-full bg-white shadow-lg ${
                showCounters ? "ml-7 mt-1" : "ml-1 mt-1"
              }`}
            />
          </View>
        </Pressable>
      </View>
    </>
  );

  return (
    <>
      <GlassSheet
        visible={open}
        onDismiss={handleClose}
        snapPoints={["70%", "90%"]}
        isDark={isDark}
      >
        <BottomSheetScrollView className="flex-1">
          {/* Header */}
          {screen !== "menu" && (
            <View className="flex-row items-center gap-2 px-6 pb-4 pt-2">
              {hasBack && (
                <Pressable
                  onPress={() => setScreen("menu")}
                  className="rounded-full p-1 active:opacity-70"
                >
                  <ChevronLeft size={24} color={isDark ? "#fff" : "#1e293b"} />
                </Pressable>
              )}
              <Text className={`text-2xl font-bold ${textColor}`}>
                {screenTitle[screen]}
              </Text>
            </View>
          )}

          {/* Content */}
          <View className="px-6 pb-8">
            {screen === "menu" && renderMenu()}
            {screen === "players" && renderPlayers()}
            {screen === "settings" && renderSettings()}
          </View>
        </BottomSheetScrollView>
      </GlassSheet>

      {/* Confirmation Modals */}
      <Modal
        visible={confirmModal === "restart"}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/70">
          <View className="mx-6 w-full max-w-sm rounded-2xl bg-slate-800 p-6">
            <Text className="mb-2 text-center text-2xl font-bold text-white">
              Restart Game
            </Text>
            <Text className="mb-6 text-center text-lg text-slate-400">
              Reset all life totals to {startingLife}?
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setConfirmModal(null)}
                className="flex-1 items-center rounded-xl bg-slate-700 p-4 active:opacity-70"
              >
                <Text className="text-lg font-semibold text-white">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleRestart}
                className="flex-1 items-center rounded-xl bg-red-600 p-4 active:opacity-70"
              >
                <Text className="text-lg font-semibold text-white">Restart</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={confirmModal === "layout-change"}
        transparent
        animationType="fade"
        onRequestClose={handleDeclineLayoutChange}
      >
        <View className="flex-1 items-center justify-center bg-black/70">
          <View className="mx-6 w-full max-w-sm rounded-2xl bg-slate-800 p-6">
            <Text className="mb-2 text-center text-2xl font-bold text-white">
              Restart Game?
            </Text>
            <Text className="mb-6 text-center text-lg text-slate-400">
              Changing the layout requires restarting. Continue?
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={handleDeclineLayoutChange}
                className="flex-1 items-center rounded-xl bg-slate-700 p-4 active:opacity-70"
              >
                <Text className="text-lg font-semibold text-white">No</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmLayoutChange}
                className="flex-1 items-center rounded-xl bg-purple-600 p-4 active:opacity-70"
              >
                <Text className="text-lg font-semibold text-white">Yes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
