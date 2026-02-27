import { router, Stack, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Camera, Link, Mail, RefreshCw, Shield, ShieldOff, Trash2, UserMinus, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArtCropPickerDialog } from "~/components/ArtCropPickerDialog";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { podsApi, type PodDetail, type PodOfflineMember } from "~/lib/api";
import { showToast } from "~/lib/toast";
import { useResponsive } from "~/hooks/useResponsive";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";
import { KEYBOARD_ACCESSORY_ID } from "~/components/ui/KeyboardDoneAccessory";

export default function PodSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();
  const [pod, setPod] = useState<PodDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [showArtPicker, setShowArtPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);
  const [offlineMembers, setOfflineMembers] = useState<PodOfflineMember[]>([]);
  const [showRemoveOfflineConfirm, setShowRemoveOfflineConfirm] = useState<string | null>(null);
  const [linkingOfflineMemberId, setLinkingOfflineMemberId] = useState<string | null>(null);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [showRescindConfirm, setShowRescindConfirm] = useState<string | null>(null);

  const loadPod = useCallback(async () => {
    if (!id) return;
    const [result, offlineResult] = await Promise.all([
      podsApi.get(id),
      podsApi.listOfflineMembers(id),
    ]);
    if (result.data) {
      setPod(result.data);
      setName(result.data.name);
      setDescription(result.data.description || "");
      setCoverImage(result.data.coverImage || "");
    }
    if (offlineResult.data) {
      setOfflineMembers(offlineResult.data);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadPod();
    }, [loadPod]),
  );

  const handleSave = async () => {
    if (!id || !name.trim()) return;
    setSaving(true);
    const result = await podsApi.update(id, {
      name: name.trim(),
      description: description.trim() || undefined,
      coverImage: coverImage || undefined,
    });
    setSaving(false);
    if (result.data) {
      showToast.success("Pod updated!");
    } else {
      showToast.error(result.error || "Failed to update");
    }
  };

  const handleRegenerateCode = async () => {
    if (!id) return;
    const result = await podsApi.regenerateInviteCode(id);
    if (result.data) {
      setPod((prev) =>
        prev ? { ...prev, inviteCode: result.data!.inviteCode } : prev,
      );
      showToast.success("Invite code regenerated!");
    }
  };

  const handlePromote = async (userId: string) => {
    if (!id) return;
    const result = await podsApi.promoteMember(id, userId);
    if (result.data) {
      showToast.success("Promoted to admin!");
      loadPod();
    } else {
      showToast.error(result.error || "Failed to promote");
    }
  };

  const handleDemote = async (userId: string) => {
    if (!id) return;
    const result = await podsApi.demoteMember(id, userId);
    if (result.data) {
      showToast.success("Demoted to member");
      loadPod();
    } else {
      showToast.error(result.error || "Failed to demote");
    }
  };

  const handleRemove = async (userId: string) => {
    if (!id) return;
    const result = await podsApi.removeMember(id, userId);
    if (result.data) {
      showToast.success("Member removed");
      setShowRemoveConfirm(null);
      loadPod();
    } else {
      showToast.error(result.error || "Failed to remove");
    }
  };

  const handleRemoveOffline = async (offlineMemberId: string) => {
    if (!id) return;
    const result = await podsApi.removeOfflineMember(id, offlineMemberId);
    if (result.data) {
      showToast.success("Offline member removed");
      setShowRemoveOfflineConfirm(null);
      loadPod();
    } else {
      showToast.error(result.error || "Failed to remove");
    }
  };

  const handleLinkOfflineMember = async (offlineMemberId: string, userId: string) => {
    if (!id) return;
    const result = await podsApi.linkOfflineMember(id, offlineMemberId, userId);
    if (result.data) {
      showToast.success("Member linked!");
      setLinkingOfflineMemberId(null);
      loadPod();
    } else {
      showToast.error(result.error || "Failed to link");
    }
  };

  const handleRescindInvite = async (inviteId: string) => {
    if (!id) return;
    const result = await podsApi.rescindInvite(id, inviteId);
    if (result.data) {
      showToast.success("Invite rescinded");
      setShowRescindConfirm(null);
      loadPod();
    } else {
      showToast.error(result.error || "Failed to rescind invite");
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    if (!id) return;
    setResendingInviteId(inviteId);
    const result = await podsApi.resendInviteEmail(id, inviteId);
    setResendingInviteId(null);
    if (result.data) {
      showToast.success("Invite email resent!");
    } else {
      showToast.error(result.error || "Failed to resend invite");
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const result = await podsApi.deletePod(id);
    if (result.data) {
      showToast.success("Pod deleted");
      router.replace("/(tabs)/pods");
    } else {
      showToast.error(result.error || "Failed to delete");
    }
  };

  if (!pod) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: !isDesktop,
          headerShadowVisible: false,
            title: "Pod Settings",
            headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
            headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
            headerBackTitle: "Back",
          }}
        />
        <SafeAreaView
          className={`flex-1 items-center justify-center ${isDark ? "bg-slate-950" : "bg-white"}`}
          edges={[]}
        >
          <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
            Loading...
          </Text>
        </SafeAreaView>
      </>
    );
  }

  return (
    <View className="flex-1 flex-row">
      <Stack.Screen
        options={{
          headerShown: !isDesktop,
          headerShadowVisible: false,
          title: "Pod Settings",
          headerStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
          headerTintColor: isDark ? "#e2e8f0" : "#1e293b",
          headerBackTitle: "Back",
        }}
      />
      {isDesktop && <DesktopSidebar />}
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
        edges={[]}
      >
        {/* Header - desktop only (mobile uses native stack header) */}
        {isDesktop && (
          <View className="flex-row items-center px-4 lg:px-6 py-3 lg:py-4">
            <View className="flex-row items-center gap-3 flex-1">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Pressable onPress={() => router.push("/(tabs)/pods")} className="hover:underline">
                    <Text className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
                      Pods
                    </Text>
                  </Pressable>
                  <Text className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>/</Text>
                  <Pressable onPress={() => router.push(`/pod/${id}`)} className="hover:underline">
                    <Text className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`} numberOfLines={1}>
                      {pod.name}
                    </Text>
                  </Pressable>
                  <Text className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>/</Text>
                  <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Settings
                  </Text>
                </View>
                <Text
                  className={`text-lg lg:text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Pod Settings
                </Text>
              </View>
            </View>
          </View>
        )}

        <ScrollView
          className="flex-1"
          contentContainerClassName="w-full max-w-content mx-auto"
          contentContainerStyle={{ padding: 16, gap: 24 }}
        >
          {/* Two-column layout on desktop: Pod Info + Invite Code side by side */}
          <View className="gap-6 lg:flex-row">
          {/* Edit Pod Info */}
          <View className="gap-4 lg:flex-1">
            <Text
              className={`text-sm font-medium uppercase tracking-wider ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Pod Info
            </Text>
            {/* Cover Image */}
            <View className="gap-2">
              <Text
                className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                Cover Image
              </Text>
              {coverImage ? (
                <View className="relative">
                  <Pressable onPress={() => setShowArtPicker(true)}>
                    <Image
                      source={{ uri: coverImage }}
                      className="h-32 w-full rounded-lg"
                      resizeMode="cover"
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => setCoverImage("")}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5"
                  >
                    <X size={14} color="#ffffff" />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowArtPicker(true)}
                  className={`h-32 items-center justify-center rounded-lg border border-dashed ${
                    isDark ? "border-slate-600" : "border-slate-300"
                  }`}
                >
                  <Camera size={24} color={isDark ? "#64748b" : "#94a3b8"} />
                  <Text
                    className={`mt-2 text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
                  >
                    Choose card art
                  </Text>
                </Pressable>
              )}
            </View>
            <View className="gap-2">
              <Text
                className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                className={`rounded-lg border px-4 py-3 text-base ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-900"
                }`}
                // @ts-ignore - web style
                style={{ outlineStyle: "none" }}
              />
            </View>
            <View className="gap-2">
              <Text
                className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                Description
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                className={`rounded-lg border px-4 py-3 text-base ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-900"
                }`}
                // @ts-ignore - web style
                style={{ outlineStyle: "none", minHeight: 60, textAlignVertical: "top" }}
              />
            </View>
            <Pressable
              onPress={handleSave}
              disabled={saving || !name.trim()}
              className="items-center rounded-lg bg-purple-600 py-3 lg:hover:bg-purple-700"
            >
              <Text className="font-semibold text-white">
                {saving ? "Saving..." : "Save Changes"}
              </Text>
            </Pressable>
          </View>

          {/* Right column on desktop: Invite Code + Pending Invites */}
          <View className="gap-6 lg:w-80">
          {/* Invite Code */}
          <View className="gap-3">
            <Text
              className={`text-sm font-medium uppercase tracking-wider ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Invite Code
            </Text>
            <View className="flex-row items-center justify-between">
              <Text
                className={`text-lg font-mono tracking-widest ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {pod.inviteCode}
              </Text>
              <Pressable
                onPress={handleRegenerateCode}
                className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 lg:hover:bg-slate-50 ${
                  isDark ? "border-slate-700 lg:hover:bg-slate-800" : "border-slate-300"
                }`}
              >
                <RefreshCw
                  size={16}
                  color={isDark ? "#e2e8f0" : "#1e293b"}
                />
                <Text
                  className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Regenerate
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Pending Invites */}
          {pod.pendingInvites && pod.pendingInvites.length > 0 && (
            <View className="gap-3">
              <Text
                className={`text-sm font-medium uppercase tracking-wider ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Pending Invites
              </Text>
              {pod.pendingInvites.map((invite) => (
                <View
                  key={invite.inviteId}
                  className={`flex-row items-center justify-between rounded-lg border px-3 py-3 ${
                    isDark ? "border-slate-800" : "border-slate-200"
                  }`}
                >
                  <View className="flex-1">
                    <Text
                      className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      {invite.displayName || invite.email.split("@")[0]}
                    </Text>
                    <Text
                      className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      {invite.email}
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    {invite.isEmailInvite && (
                      <Pressable
                        onPress={() => handleResendInvite(invite.inviteId)}
                        disabled={resendingInviteId === invite.inviteId}
                        className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 ${
                          isDark ? "border-slate-700" : "border-slate-300"
                        } ${resendingInviteId === invite.inviteId ? "opacity-50" : ""}`}
                      >
                        <Mail
                          size={16}
                          color={isDark ? "#e2e8f0" : "#1e293b"}
                        />
                        <Text
                          className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}
                        >
                          {resendingInviteId === invite.inviteId ? "Sending..." : "Resend"}
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => setShowRescindConfirm(invite.inviteId)}
                      className={`rounded-lg border p-2 ${
                        isDark ? "border-slate-700" : "border-slate-300"
                      }`}
                    >
                      <X size={16} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
          </View>{/* end right column */}
          </View>{/* end two-column row */}

          {/* Members */}
          <View className="gap-3">
            <Text
              className={`text-sm font-medium uppercase tracking-wider ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Members
            </Text>
            {pod.members.map((member) => (
              <View
                key={member.id}
                className={`flex-row items-center justify-between rounded-lg border px-3 py-3 ${
                  isDark ? "border-slate-800" : "border-slate-200"
                }`}
              >
                <View className="flex-1">
                  <Text
                    className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    {member.displayName || member.email.split("@")[0]}
                    {member.role === "owner" ? " (Owner)" : member.role === "admin" ? " (Admin)" : ""}
                  </Text>
                  <Text
                    className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    {member.email}
                  </Text>
                </View>
                {member.role === "member" && (
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => handlePromote(member.userId)}
                      className={`rounded-lg border p-2 ${
                        isDark ? "border-slate-700 lg:hover:bg-slate-800" : "border-slate-300 lg:hover:bg-slate-50"
                      }`}
                    >
                      <Shield size={16} color="#7C3AED" />
                    </Pressable>
                    <Pressable
                      onPress={() => setShowRemoveConfirm(member.userId)}
                      className={`rounded-lg border p-2 ${
                        isDark ? "border-slate-700 lg:hover:bg-red-500/10" : "border-slate-300 lg:hover:bg-red-50"
                      }`}
                    >
                      <UserMinus size={16} color="#ef4444" />
                    </Pressable>
                  </View>
                )}
                {member.role === "admin" && (
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => handleDemote(member.userId)}
                      className={`rounded-lg border p-2 ${
                        isDark ? "border-slate-700 lg:hover:bg-slate-800" : "border-slate-300 lg:hover:bg-slate-50"
                      }`}
                    >
                      <ShieldOff size={16} color="#f59e0b" />
                    </Pressable>
                    <Pressable
                      onPress={() => setShowRemoveConfirm(member.userId)}
                      className={`rounded-lg border p-2 ${
                        isDark ? "border-slate-700 lg:hover:bg-red-500/10" : "border-slate-300 lg:hover:bg-red-50"
                      }`}
                    >
                      <UserMinus size={16} color="#ef4444" />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Offline Members */}
          {offlineMembers.filter(om => !om.linkedUserId).length > 0 && (
            <View className="gap-3">
              <Text
                className={`text-sm font-medium uppercase tracking-wider ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Offline Members
              </Text>
              {offlineMembers
                .filter(om => !om.linkedUserId)
                .map((offlineMember) => (
                  <View
                    key={offlineMember.id}
                    className={`flex-row items-center justify-between rounded-lg border px-3 py-3 ${
                      isDark ? "border-slate-800" : "border-slate-200"
                    }`}
                  >
                    <View className="flex-1">
                      <Text
                        className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        {offlineMember.name}
                      </Text>
                      <Text
                        className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                      >
                        {offlineMember.email || "No contact info"}
                      </Text>
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => setLinkingOfflineMemberId(offlineMember.id)}
                        className={`rounded-lg border p-2 ${
                          isDark ? "border-slate-700 lg:hover:bg-slate-800" : "border-slate-300 lg:hover:bg-slate-50"
                        }`}
                      >
                        <Link size={16} color="#7C3AED" />
                      </Pressable>
                      <Pressable
                        onPress={() => setShowRemoveOfflineConfirm(offlineMember.id)}
                        className={`rounded-lg border p-2 ${
                          isDark ? "border-slate-700 lg:hover:bg-red-500/10" : "border-slate-300 lg:hover:bg-red-50"
                        }`}
                      >
                        <UserMinus size={16} color="#ef4444" />
                      </Pressable>
                    </View>
                  </View>
                ))}
            </View>
          )}

          {/* Danger Zone */}
          <View className="gap-3">
            <Text className="text-sm font-medium uppercase tracking-wider text-red-500">
              Danger Zone
            </Text>
            <Pressable
              onPress={() => setShowDeleteConfirm(true)}
              className="flex-row items-center justify-center gap-2 rounded-lg border border-red-500 py-3 lg:hover:bg-red-500/10"
            >
              <Trash2 size={18} color="#ef4444" />
              <Text className="font-semibold text-red-500">Delete Pod</Text>
            </Pressable>
          </View>
        </ScrollView>

        <ArtCropPickerDialog
          visible={showArtPicker}
          onClose={() => setShowArtPicker(false)}
          onSelect={(imageUrl) => setCoverImage(imageUrl)}
        />

        <ConfirmDialog
          visible={showDeleteConfirm}
          title="Delete Pod"
          message="This will permanently delete the pod and all its events. This cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          destructive
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />

        <ConfirmDialog
          visible={!!showRemoveConfirm}
          title="Remove Member"
          message="Are you sure you want to remove this member from the pod?"
          confirmText="Remove"
          cancelText="Cancel"
          destructive
          onConfirm={() => showRemoveConfirm && handleRemove(showRemoveConfirm)}
          onCancel={() => setShowRemoveConfirm(null)}
        />

        <ConfirmDialog
          visible={!!showRescindConfirm}
          title="Rescind Invite"
          message="Are you sure you want to rescind this invite?"
          confirmText="Rescind"
          cancelText="Cancel"
          destructive
          onConfirm={() => showRescindConfirm && handleRescindInvite(showRescindConfirm)}
          onCancel={() => setShowRescindConfirm(null)}
        />

        <ConfirmDialog
          visible={!!showRemoveOfflineConfirm}
          title="Remove Offline Member"
          message="Are you sure you want to remove this offline member from the pod?"
          confirmText="Remove"
          cancelText="Cancel"
          destructive
          onConfirm={() => showRemoveOfflineConfirm && handleRemoveOffline(showRemoveOfflineConfirm)}
          onCancel={() => setShowRemoveOfflineConfirm(null)}
        />

        {/* Link Offline Member Dialog */}
        <Modal
          visible={!!linkingOfflineMemberId}
          transparent
          animationType="fade"
          onRequestClose={() => setLinkingOfflineMemberId(null)}
        >
          <Pressable
            className="flex-1 bg-black/50 items-center justify-center p-4"
            onPress={() => setLinkingOfflineMemberId(null)}
          >
            <Pressable
              className={`w-full max-w-sm rounded-2xl p-6 ${
                isDark ? "bg-slate-800" : "bg-white"
              }`}
              onPress={(e) => e.stopPropagation()}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text
                  className={`text-xl font-semibold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Link to Member
                </Text>
                <Pressable onPress={() => setLinkingOfflineMemberId(null)} hitSlop={8}>
                  <X size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                </Pressable>
              </View>
              <Text
                className={`text-sm mb-4 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Link{" "}
                <Text className="font-medium">
                  {offlineMembers.find((om) => om.id === linkingOfflineMemberId)?.name}
                </Text>{" "}
                to an existing member. Their game history will be merged.
              </Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {pod.members.map((member) => (
                  <Pressable
                    key={member.userId}
                    onPress={() =>
                      linkingOfflineMemberId &&
                      handleLinkOfflineMember(linkingOfflineMemberId, member.userId)
                    }
                    className={`flex-row items-center gap-3 py-3 border-b ${
                      isDark ? "border-slate-700" : "border-slate-200"
                    }`}
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-purple-600">
                      <Text className="text-sm font-bold text-white">
                        {(member.displayName || member.email)
                          ?.charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-sm font-medium ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                        numberOfLines={1}
                      >
                        {member.displayName || member.email.split("@")[0]}
                      </Text>
                      <Text
                        className={`text-xs ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                        numberOfLines={1}
                      >
                        {member.email}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
