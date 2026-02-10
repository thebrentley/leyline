import { DrawerActions, useNavigation } from "@react-navigation/native";
import { ArrowLeft, Camera } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/contexts/AuthContext";

export default function ProfileScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuth();
  const navigation = useNavigation();

  const [displayName, setDisplayName] = useState(user?.displayName || "");

  const goBack = () => {
    navigation.dispatch(DrawerActions.jumpTo("index"));
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    goBack();
  };

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
    >
      <View className="flex-1 p-6">
        {/* Header */}
        <View className="mb-8 flex-row items-center gap-3">
          <Pressable
            onPress={goBack}
            className={`-ml-2 rounded-full p-2 ${
              isDark ? "active:bg-slate-800" : "active:bg-slate-100"
            }`}
          >
            <ArrowLeft size={24} color={isDark ? "#94a3b8" : "#64748b"} />
          </Pressable>
          <Text
            className={`text-2xl font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Edit Profile
          </Text>
        </View>

        {/* Avatar */}
        <View className="mb-8 items-center">
          <View className="relative">
            <View className="h-24 w-24 items-center justify-center rounded-full bg-purple-600">
              <Text className="text-3xl font-bold text-white">
                {(displayName || user?.email)?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
            <Pressable
              className={`absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 ${
                isDark
                  ? "border-slate-950 bg-slate-700"
                  : "border-white bg-slate-200"
              }`}
            >
              <Camera size={16} color={isDark ? "#e2e8f0" : "#475569"} />
            </Pressable>
          </View>
        </View>

        {/* Form */}
        <View className="gap-4">
          <View>
            <Text
              className={`mb-2 text-sm font-medium ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Display Name
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your display name"
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              className={`rounded-lg border px-4 py-3 text-base ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-white"
                  : "border-slate-200 bg-white text-slate-900"
              }`}
            />
          </View>

          <View>
            <Text
              className={`mb-2 text-sm font-medium ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Email
            </Text>
            <TextInput
              value={user?.email || ""}
              editable={false}
              className={`rounded-lg border px-4 py-3 text-base ${
                isDark
                  ? "border-slate-700 bg-slate-800/50 text-slate-400"
                  : "border-slate-200 bg-slate-50 text-slate-400"
              }`}
            />
          </View>
        </View>

        {/* Save Button */}
        <View className="mt-auto">
          <Button onPress={handleSave}>
            <Text className="font-semibold text-white">Save Changes</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
