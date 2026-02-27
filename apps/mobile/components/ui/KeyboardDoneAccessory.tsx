import { InputAccessoryView, Keyboard, Platform, Pressable, Text, View } from "react-native";
import { useColorScheme } from "nativewind";

export const KEYBOARD_ACCESSORY_ID = "leyline-keyboard-done";

export function KeyboardDoneAccessory() {
  if (Platform.OS !== "ios") return null;

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
      <View
        className={`flex-row justify-end px-4 py-2 border-t ${
          isDark
            ? "bg-slate-800 border-slate-700"
            : "bg-gray-100 border-gray-200"
        }`}
      >
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
          <Text
            className={`text-base font-semibold ${
              isDark ? "text-purple-400" : "text-purple-600"
            }`}
          >
            Done
          </Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}