import {
  X,
  RotateCcw,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  Dices,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as React from "react";
import { Modal, Pressable, View, Text } from "react-native";
import { useColorScheme } from "nativewind";
import { useRouter } from "expo-router";

type Screen = "menu" | "restart" | "players" | "players-confirm" | "settings";

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
}: CenterMenuModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();

  const [screen, setScreen] = React.useState<Screen>("menu");
  const [pendingLayout, setPendingLayout] = React.useState<{
    count: number;
    type: string;
  } | null>(null);

  const handleClose = () => {
    setScreen("menu");
    setPendingLayout(null);
    onClose();
  };

  const handleRestart = () => {
    onReset();
    handleClose();
  };

  const handleSelectLayout = (count: number, type: string) => {
    setPendingLayout({ count, type });
    setScreen("players-confirm");
  };

  const handleConfirmLayoutChange = () => {
    if (pendingLayout) {
      onLayoutChange(pendingLayout.count, pendingLayout.type);
      onReset();
    }
    handleClose();
  };

  const handleDeclineLayoutChange = () => {
    setPendingLayout(null);
    setScreen("menu");
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
  const cardBg = isDark ? "bg-slate-800" : "bg-slate-100";

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
  ];

  const screenTitle: Record<Screen, string> = {
    menu: "",
    restart: "Restart Game",
    players: "Select Layout",
    "players-confirm": "Restart Game?",
    settings: "Settings",
  };

  const hasBack = screen !== "menu";

  const renderMenu = () => (
    <>
      <View className="gap-3">
        <Pressable
          onPress={() => setScreen("restart")}
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

  const renderRestart = () => (
    <>

      <Text className={`mb-6 text-center text-lg ${subtextColor}`}>
        Reset all life totals to {startingLife}?
      </Text>
      <View className="flex-row gap-3">
        <Pressable
          onPress={() => setScreen("menu")}
          className={`flex-1 items-center rounded-xl p-4 ${cardBg} active:opacity-70`}
        >
          <Text className={`text-lg font-semibold ${textColor}`}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleRestart}
          className="flex-1 items-center rounded-xl bg-red-600 p-4 active:opacity-70"
        >
          <Text className="text-lg font-semibold text-white">Restart</Text>
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

  const renderPlayersConfirm = () => (
    <>

      <Text className={`mb-6 text-center text-lg ${subtextColor}`}>
        Changing the layout requires restarting. Continue?
      </Text>
      <View className="flex-row gap-3">
        <Pressable
          onPress={handleDeclineLayoutChange}
          className={`flex-1 items-center rounded-xl p-4 ${cardBg} active:opacity-70`}
        >
          <Text className={`text-lg font-semibold ${textColor}`}>No</Text>
        </Pressable>
        <Pressable
          onPress={handleConfirmLayoutChange}
          className="flex-1 items-center rounded-xl bg-purple-600 p-4 active:opacity-70"
        >
          <Text className="text-lg font-semibold text-white">Yes</Text>
        </Pressable>
      </View>
    </>
  );

  const renderSettings = () => (
    <>
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
                startingLife === life ? "bg-purple-600" : cardBg
              }`}
            >
              <Text
                numberOfLines={1}
                className={`text-2xl font-bold ${
                  startingLife === life ? "text-white" : textColor
                }`}
              >
                {life}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1 }}>
        {/* Base tint + gradient backdrop */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.2)" }} />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)", "rgba(0,0,0,0.8)", "transparent"]}
          locations={[0, 0.3, 0.7, 1]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.6)", "transparent"]}
          locations={[0, 0.3, 0.7, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Header pinned at top */}
        <View className="flex-row items-center justify-between px-6 pt-14 pb-2">
          <View className="flex-row items-center gap-2">
            {hasBack && (
              <Pressable
                onPress={() => setScreen("menu")}
                className="rounded-full p-1 active:opacity-70"
              >
                <ChevronLeft size={24} color="white" />
              </Pressable>
            )}
            <Text className="text-2xl font-bold text-white">
              {screenTitle[screen]}
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            className="rounded-full p-2 active:opacity-70"
          >
            <X size={24} color="white" />
          </Pressable>
        </View>

        {/* Centered content */}
        <Pressable className="flex-1 items-center justify-center" onPress={handleClose}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: "80%" }}>
            {screen === "menu" && renderMenu()}
            {screen === "restart" && renderRestart()}
            {screen === "players" && renderPlayers()}
            {screen === "players-confirm" && renderPlayersConfirm()}
            {screen === "settings" && renderSettings()}
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
}
