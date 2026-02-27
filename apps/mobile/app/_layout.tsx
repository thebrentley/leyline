import "../global.css";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { useColorScheme } from "nativewind";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import { AuthProvider, useAuth } from "~/contexts/AuthContext";
import { SocketProvider } from "~/contexts/SocketContext";
import { usePushNotifications } from "~/hooks/usePushNotifications";
import { toastConfig } from "~/lib/toast-config";
import { KeyboardDoneAccessory } from "~/components/ui/KeyboardDoneAccessory";

function PushNotificationHandler() {
  const { user } = useAuth();
  usePushNotifications(user?.id ?? null);
  return null;
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const bg = isDark ? "#020617" : "#ffffff";

  return (
    <>
      <Head>
        <title>Leyline | MTG Everything. Connected</title>
        <meta name="description" content="Begin with an edge. The line between you and better Magic." />
        <link rel="icon" type="image/png" href="/favicon.png?v=2" />
      </Head>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
          <BottomSheetModalProvider>
            <AuthProvider>
              <SocketProvider>
                <PushNotificationHandler />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: bg },
                    animation: "fade",
                  }}
                />
                <Toast config={toastConfig} />
                <KeyboardDoneAccessory />
              </SocketProvider>
            </AuthProvider>
          </BottomSheetModalProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </>
  );
}
