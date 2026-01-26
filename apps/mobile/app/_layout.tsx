import "../global.css";
import { Slot } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "~/contexts/AuthContext";
import { SocketProvider } from "~/contexts/SocketContext";
import Toast from "react-native-toast-message";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SocketProvider>
          <Slot />
          <Toast />
        </SocketProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
