import { Button } from "~/components/ui/button";
import { X } from "lucide-react-native";
import * as React from "react";
import { Modal, Pressable, View, Text } from "react-native";
import { useColorScheme } from "nativewind";

interface LifeCounterSettingsProps {
  open: boolean;
  onClose: () => void;
  startingLife: number;
  onStartingLifeChange: (life: number) => void;
  onReset: () => void;
}

const STARTING_LIFE_OPTIONS = [20, 30, 40];

export function LifeCounterSettings({
  open,
  onClose,
  startingLife,
  onStartingLifeChange,
  onReset,
}: LifeCounterSettingsProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const handleReset = () => {
    onReset();
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View className={`rounded-t-3xl p-6 ${isDark ? "bg-slate-900" : "bg-white"}`}>
          <View className="mb-6 flex-row items-center justify-between">
            <Text className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Game Settings</Text>
            <Pressable onPress={onClose} className="rounded-full p-2 active:opacity-70">
              <X size={24} color={isDark ? "#fff" : "#000"} />
            </Pressable>
          </View>

          {/* Starting Life */}
          <View className="mb-6">
            <Text className={`mb-3 text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Starting Life Total</Text>
            <View className="flex-row gap-2">
              {STARTING_LIFE_OPTIONS.map((life) => (
                <Pressable
                  key={life}
                  onPress={() => onStartingLifeChange(life)}
                  className={`flex-1 items-center rounded-xl p-4 ${
                    startingLife === life ? "bg-purple-600" : isDark ? "bg-slate-800" : "bg-slate-100"
                  }`}
                >
                  <Text
                    className={`text-2xl font-bold ${
                      startingLife === life ? "text-white" : isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {life}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Actions */}
          <View className="gap-3">
            <Button onPress={handleReset} variant="destructive">
              Reset Game
            </Button>
            <Button onPress={onClose} variant="outline">
              Close
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
