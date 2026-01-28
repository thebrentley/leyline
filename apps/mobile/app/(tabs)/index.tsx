import { DrawerActions, useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Layers, Menu, Search } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/contexts/AuthContext";
import { useResponsive } from "~/hooks/useResponsive";

export default function HomeScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();
  const { isDesktop } = useResponsive();

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
    >
      <View className="flex-1 p-6 lg:px-12 lg:py-8">
        {/* Header */}
        <View className={`mb-8 flex-row items-start gap-3 w-full max-w-content mx-auto ${!isDesktop ? '' : 'px-0'}`}>
          {!isDesktop && (
            <Pressable
              onPress={openDrawer}
              className={`-ml-2 -mt-1 rounded-full p-2 ${
                isDark ? "active:bg-slate-800" : "active:bg-slate-100"
              }`}
            >
              <Menu size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          )}
          <View className="flex-1">
            <Text
              className={`text-2xl lg:text-3xl font-bold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Welcome, {user?.displayName || user?.email?.split("@")[0] || "User"}!
            </Text>
            <Text className={`text-base lg:text-lg ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              What would you like to do today?
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="gap-4 lg:gap-6 w-full max-w-content mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
          <Pressable
            onPress={() => router.push("/(tabs)/decks")}
            className={`rounded-xl p-6 transition-transform lg:hover:scale-105 lg:hover:shadow-xl ${
              isDark ? "bg-slate-900 lg:hover:bg-slate-800" : "bg-slate-50 lg:hover:bg-slate-100"
            }`}
          >
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
              <Layers size={24} color="#7C3AED" />
            </View>
            <Text
              className={`mb-2 text-xl font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Your Decks
            </Text>
            <Text
              className={`${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Manage and browse your MTG deck collection
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(tabs)/collection")}
            className={`rounded-xl p-6 transition-transform lg:hover:scale-105 lg:hover:shadow-xl ${
              isDark ? "bg-slate-900 lg:hover:bg-slate-800" : "bg-slate-50 lg:hover:bg-slate-100"
            }`}
          >
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
              <Search size={24} color="#3b82f6" />
            </View>
            <Text
              className={`mb-2 text-xl font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Find Cards
            </Text>
            <Text
              className={`${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Search for the best prices on your cards
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
