import { Image, Text, View } from "react-native";
import type { ToastConfig } from "react-native-toast-message";

export const toastConfig: ToastConfig = {
  cardScan: ({ props }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1e293b",
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginHorizontal: 16,
        gap: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      {props?.imageSmall ? (
        <Image
          source={{ uri: props.imageSmall }}
          style={{ width: 36, height: 50, borderRadius: 4 }}
          resizeMode="cover"
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}
          numberOfLines={1}
        >
          {props?.name}
        </Text>
        <Text
          style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}
          numberOfLines={1}
        >
          {props?.setName} · {props?.setCode?.toUpperCase()} · #{props?.collectorNumber}
        </Text>
      </View>
    </View>
  ),
};
