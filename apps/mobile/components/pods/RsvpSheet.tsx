import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Check, UserX, X } from "lucide-react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { GlassSheet } from "~/components/ui/GlassSheet";
import type { PodEventDetail, RsvpStatus } from "~/lib/api";

interface RsvpSheetProps {
  visible: boolean;
  onDismiss: () => void;
  event: PodEventDetail;
  isDark: boolean;
  isAdmin: boolean;
  myStatus: RsvpStatus | null;
  onRsvp: (status: RsvpStatus) => void;
  onOfflineRsvp: (offlineMemberId: string, status: RsvpStatus) => void;
}

export function RsvpSheet({
  visible,
  onDismiss,
  event,
  isDark,
  isAdmin,
  myStatus,
  onRsvp,
  onOfflineRsvp,
}: RsvpSheetProps) {
  const going = event.rsvps.filter((r) => r.status === "accepted");
  const notGoing = event.rsvps.filter((r) => r.status === "declined");
  const offlineGoing = event.offlineRsvps.filter(
    (r) => r.status === "accepted",
  );
  const offlineNotGoing = event.offlineRsvps.filter(
    (r) => r.status === "declined",
  );

  return (
    <GlassSheet
      visible={visible}
      onDismiss={onDismiss}
      isDark={isDark}
      snapPoints={["50%", "90%"]}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}
      >
        {/* Your RSVP */}
        <View
          className={`rounded-xl border p-4 ${
            isDark
              ? "border-slate-800 bg-slate-900"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <Text
            className={`mb-3 text-sm font-medium uppercase tracking-wider ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            Your RSVP
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => onRsvp("accepted")}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg py-3 ${
                myStatus === "accepted"
                  ? "bg-green-600"
                  : isDark
                    ? "border border-slate-700 bg-slate-800"
                    : "border border-slate-300 bg-white"
              }`}
            >
              <Check
                size={18}
                color={
                  myStatus === "accepted"
                    ? "#ffffff"
                    : isDark
                      ? "#e2e8f0"
                      : "#1e293b"
                }
              />
              <Text
                className={`font-semibold ${
                  myStatus === "accepted"
                    ? "text-white"
                    : isDark
                      ? "text-white"
                      : "text-slate-900"
                }`}
              >
                Going
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onRsvp("declined")}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg py-3 ${
                myStatus === "declined"
                  ? "bg-red-600"
                  : isDark
                    ? "border border-slate-700 bg-slate-800"
                    : "border border-slate-300 bg-white"
              }`}
            >
              <X
                size={18}
                color={
                  myStatus === "declined"
                    ? "#ffffff"
                    : isDark
                      ? "#e2e8f0"
                      : "#1e293b"
                }
              />
              <Text
                className={`font-semibold ${
                  myStatus === "declined"
                    ? "text-white"
                    : isDark
                      ? "text-white"
                      : "text-slate-900"
                }`}
              >
                Not Going
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Going */}
        <View className="gap-2">
          <Text
            className={`text-sm font-medium uppercase tracking-wider ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            Going ({going.length + offlineGoing.length})
          </Text>
          {going.length === 0 && offlineGoing.length === 0 ? (
            <Text
              className={`text-sm ${isDark ? "text-slate-600" : "text-slate-400"}`}
            >
              No one yet
            </Text>
          ) : (
            <>
              {going.map((rsvp) => (
                <Pressable
                  key={rsvp.userId}
                  onPress={() => {
                    onDismiss();
                    router.push(`/user/${rsvp.userId}`);
                  }}
                  className={`flex-row items-center gap-3 rounded-lg px-3 py-2 ${
                    isDark ? "active:bg-slate-900" : "active:bg-slate-50"
                  }`}
                >
                  {rsvp.profilePicture ? (
                    <Image
                      source={{ uri: rsvp.profilePicture }}
                      className="h-8 w-8 rounded-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-green-600">
                      <Text className="text-sm font-bold text-white">
                        {(rsvp.displayName || rsvp.email || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <Text
                      className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      {rsvp.displayName || rsvp.email || "Unknown"}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {offlineGoing.map((rsvp) => (
                <View
                  key={`offline-${rsvp.offlineMemberId}`}
                  className={`flex-row items-center gap-3 rounded-lg px-3 py-2 ${
                    isDark ? "bg-slate-900" : "bg-slate-50"
                  }`}
                >
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-green-600/60">
                    <Text className="text-sm font-bold text-white">
                      {rsvp.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text
                        className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        {rsvp.name}
                      </Text>
                      <UserX
                        size={12}
                        color={isDark ? "#64748b" : "#94a3b8"}
                      />
                    </View>
                    <Text
                      className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      Set by {rsvp.setBy.displayName || "admin"}
                    </Text>
                  </View>
                  {isAdmin && (
                    <Pressable
                      onPress={() =>
                        onOfflineRsvp(rsvp.offlineMemberId, "declined")
                      }
                      className={`rounded-lg px-2 py-1 ${
                        isDark ? "bg-slate-800" : "bg-white"
                      }`}
                    >
                      <X size={14} color={isDark ? "#94a3b8" : "#64748b"} />
                    </Pressable>
                  )}
                </View>
              ))}
            </>
          )}
        </View>

        {/* Not Going */}
        <View className="gap-2">
          <Text
            className={`text-sm font-medium uppercase tracking-wider ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            Not Going ({notGoing.length + offlineNotGoing.length})
          </Text>
          {notGoing.length === 0 && offlineNotGoing.length === 0 ? (
            <Text
              className={`text-sm ${isDark ? "text-slate-600" : "text-slate-400"}`}
            >
              No one
            </Text>
          ) : (
            <>
              {notGoing.map((rsvp) => (
                <Pressable
                  key={rsvp.userId}
                  onPress={() => {
                    onDismiss();
                    router.push(`/user/${rsvp.userId}`);
                  }}
                  className={`flex-row items-center gap-3 rounded-lg px-3 py-2 ${
                    isDark ? "active:bg-slate-900" : "active:bg-slate-50"
                  }`}
                >
                  {rsvp.profilePicture ? (
                    <Image
                      source={{ uri: rsvp.profilePicture }}
                      className="h-8 w-8 rounded-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-red-600">
                      <Text className="text-sm font-bold text-white">
                        {(rsvp.displayName || rsvp.email || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <Text
                      className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      {rsvp.displayName || rsvp.email || "Unknown"}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {offlineNotGoing.map((rsvp) => (
                <View
                  key={`offline-${rsvp.offlineMemberId}`}
                  className={`flex-row items-center gap-3 rounded-lg px-3 py-2 ${
                    isDark ? "bg-slate-900" : "bg-slate-50"
                  }`}
                >
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-red-600/60">
                    <Text className="text-sm font-bold text-white">
                      {rsvp.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text
                        className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        {rsvp.name}
                      </Text>
                      <UserX
                        size={12}
                        color={isDark ? "#64748b" : "#94a3b8"}
                      />
                    </View>
                    <Text
                      className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      Set by {rsvp.setBy.displayName || "admin"}
                    </Text>
                  </View>
                  {isAdmin && (
                    <Pressable
                      onPress={() =>
                        onOfflineRsvp(rsvp.offlineMemberId, "accepted")
                      }
                      className={`rounded-lg px-2 py-1 ${
                        isDark ? "bg-slate-800" : "bg-white"
                      }`}
                    >
                      <Check size={14} color={isDark ? "#94a3b8" : "#64748b"} />
                    </Pressable>
                  )}
                </View>
              ))}
            </>
          )}
        </View>

        {/* Not Responded */}
        {(event.notResponded.length > 0 ||
          event.offlineNotResponded.length > 0) && (
          <View className="gap-2">
            <Text
              className={`text-sm font-medium uppercase tracking-wider ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              No Response (
              {event.notResponded.length + event.offlineNotResponded.length})
            </Text>
            {event.notResponded.map((u) => (
              <Pressable
                key={u.userId}
                onPress={() => {
                  onDismiss();
                  router.push(`/user/${u.userId}`);
                }}
                className={`flex-row items-center gap-3 rounded-lg px-3 py-2 ${
                  isDark ? "active:bg-slate-900" : "active:bg-slate-50"
                }`}
              >
                {u.profilePicture ? (
                  <Image
                    source={{ uri: u.profilePicture }}
                    className="h-8 w-8 rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    className={`h-8 w-8 items-center justify-center rounded-full ${
                      isDark ? "bg-slate-700" : "bg-slate-300"
                    }`}
                  >
                    <Text
                      className={`text-sm font-bold ${isDark ? "text-slate-300" : "text-slate-600"}`}
                    >
                      {(u.displayName || u.email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text
                  className={`font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {u.displayName || u.email || "Unknown"}
                </Text>
              </Pressable>
            ))}
            {event.offlineNotResponded.map((offlineMember) => (
              <View
                key={`offline-pending-${offlineMember.offlineMemberId}`}
                className={`flex-row items-center gap-3 rounded-lg px-3 py-2 ${
                  isDark ? "bg-slate-900" : "bg-slate-50"
                }`}
              >
                <View
                  className={`h-8 w-8 items-center justify-center rounded-full ${
                    isDark ? "bg-slate-700" : "bg-slate-300"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${isDark ? "text-slate-300" : "text-slate-600"}`}
                  >
                    {offlineMember.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text
                      className={`font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      {offlineMember.name}
                    </Text>
                    <UserX size={12} color={isDark ? "#64748b" : "#94a3b8"} />
                  </View>
                </View>
                {isAdmin && (
                  <View className="flex-row gap-1">
                    <Pressable
                      onPress={() =>
                        onOfflineRsvp(
                          offlineMember.offlineMemberId,
                          "accepted",
                        )
                      }
                      className={`rounded-lg px-2 py-1 ${
                        isDark ? "bg-green-600/20" : "bg-green-50"
                      }`}
                    >
                      <Check size={14} color="#22c55e" />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        onOfflineRsvp(
                          offlineMember.offlineMemberId,
                          "declined",
                        )
                      }
                      className={`rounded-lg px-2 py-1 ${
                        isDark ? "bg-red-600/20" : "bg-red-50"
                      }`}
                    >
                      <X size={14} color="#ef4444" />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </BottomSheetScrollView>
    </GlassSheet>
  );
}
