import { Stack } from "expo-router";

export default function DeckIdLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="public" />
      <Stack.Screen
        name="versions"
        options={{
          presentation: "transparentModal",
          headerShown: false,
          animation: "none",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen name="playtest" />
      <Stack.Screen
        name="ranking"
        options={{
          presentation: "transparentModal",
          headerShown: false,
          animation: "none",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="price"
        options={{
          presentation: "transparentModal",
          headerShown: false,
          animation: "none",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </Stack>
  );
}
