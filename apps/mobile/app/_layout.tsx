import "../global.css";
import { Slot } from "expo-router";
import Head from "expo-router/head";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "~/contexts/AuthContext";
import { SocketProvider } from "~/contexts/SocketContext";
import Toast from "react-native-toast-message";

export default function RootLayout() {
  return (
    <>
      <Head>
        <title>Leyline | MTG Everything. Connected</title>
        <meta name="description" content="Begin with an edge. The line between you and better Magic." />
        <link rel="icon" type="image/png" href="/favicon.png?v=2" />
      </Head>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <SocketProvider>
            <Slot />
            <Toast />
          </SocketProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </>
  );
}
