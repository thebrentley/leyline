import { DrawerActions, useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Layers, Menu, Search } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/contexts/AuthContext";

export default function HomeScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
    >
      <View className="flex-1 p-6">
        {/* Header */}
        <View className="mb-8 flex-row items-start gap-3">
          <Pressable
            onPress={openDrawer}
            className={`-ml-2 -mt-1 rounded-full p-2 ${
              isDark ? "active:bg-slate-800" : "active:bg-slate-100"
            }`}
          >
            <Menu size={24} color={isDark ? "#94a3b8" : "#64748b"} />
          </Pressable>
          <View className="flex-1">
            <Text
              className={`text-2xl font-bold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Welcome, {user?.displayName || user?.email?.split("@")[0] || "User"}!
            </Text>
            <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
              What would you like to do today?
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="gap-4">
          <View
            className={`rounded-xl p-4 ${
              isDark ? "bg-slate-900" : "bg-slate-50"
            }`}
          >
            <View className="mb-3 h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Layers size={20} color="#10b981" />
            </View>
            <Text
              className={`mb-2 text-lg font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Your Decks
            </Text>
            <Text
              className={`mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Manage and browse your MTG deck collection
            </Text>
            <Button size="sm" onPress={() => router.push("/(tabs)/decks")}>View Decks</Button>
          </View>

          <View
            className={`rounded-xl p-4 ${
              isDark ? "bg-slate-900" : "bg-slate-50"
            }`}
          >
            <View className="mb-3 h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Search size={20} color="#3b82f6" />
            </View>
            <Text
              className={`mb-2 text-lg font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Find Cards
            </Text>
            <Text
              className={`mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Search for the best prices on your cards
            </Text>
            <Button variant="secondary" size="sm" onPress={() => router.push("/(tabs)/collection")}>
              Search Cards
            </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
