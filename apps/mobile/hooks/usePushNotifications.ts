import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { authApi } from "~/lib/api";

// Configure foreground notification display — wrapped in try-catch
// because the native module isn't available in Expo Go
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Native module not available (Expo Go) — notifications won't work
}

// Module-level token ref for use in unregister (called from AuthContext)
let currentPushToken: string | null = null;

export async function unregisterCurrentPushToken() {
  if (currentPushToken) {
    try {
      await authApi.unregisterPushToken(currentPushToken);
    } catch (error) {
      console.error("Failed to unregister push token:", error);
    }
    currentPushToken = null;
  }
}

export function usePushNotifications(userId: string | null) {
  const router = useRouter();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (Platform.OS === "web") return;

    registerForPushNotifications();

    // Handle notification taps
    try {
      responseListener.current =
        Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data as {
            type?: string;
            podId?: string;
            eventId?: string;
          };

          if (data?.type === "event" && data.podId && data.eventId) {
            router.push(`/pod/${data.podId}/event/${data.eventId}`);
          }
        });
    } catch {
      // Native module not available (Expo Go)
    }

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [userId]);

  async function registerForPushNotifications() {
    try {
      // Set up Android notification channel
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("events", {
          name: "Pod Events",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#8B5CF6",
        });
      }

      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Push notification permission denied");
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: "08ba8adf-d4c1-4dd9-8e8b-2a99add5c2f8",
      });
      const token = tokenData.data;

      currentPushToken = token;

      await authApi.registerPushToken(token, Platform.OS);
    } catch (error) {
      console.error("Failed to register for push notifications:", error);
    }
  }
}
