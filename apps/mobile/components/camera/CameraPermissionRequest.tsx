import { AlertCircle, Settings } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { Linking, Pressable, Text, View } from "react-native";

export function CameraPermissionRequest() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  return (
    <View
      className={`flex-1 items-center justify-center p-8 ${
        isDark ? "bg-slate-950" : "bg-white"
      }`}
    >
      <AlertCircle size={64} color={isDark ? "#ef4444" : "#dc2626"} />
      <Text
        className={`text-xl font-bold mt-6 text-center ${
          isDark ? "text-white" : "text-slate-900"
        }`}
      >
        Camera Permission Required
      </Text>
      <Text
        className={`text-base mt-3 text-center ${
          isDark ? "text-slate-400" : "text-slate-600"
        }`}
      >
        DeckTutor needs access to your camera to scan Magic: The Gathering
        cards.
      </Text>

      <Pressable
        onPress={handleOpenSettings}
        className={`mt-8 px-6 py-3 rounded-lg flex-row items-center gap-2 ${
          isDark
            ? "bg-emerald-600 active:bg-emerald-700"
            : "bg-emerald-500 active:bg-emerald-600"
        }`}
      >
        <Settings size={20} color="white" />
        <Text className="text-white font-semibold text-base">
          Open Settings
        </Text>
      </Pressable>

      <Text
        className={`text-sm mt-4 text-center ${
          isDark ? "text-slate-500" : "text-slate-400"
        }`}
      >
        Grant camera permission in your device settings to use this feature.
      </Text>
    </View>
  );
}
