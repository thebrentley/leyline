import { router, Stack, useLocalSearchParams, useFocusEffect } from "expo-router";
import { ArrowLeft, Camera, RefreshCw, Shield, ShieldOff, Trash2, UserMinus, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArtCropPickerDialog } from "~/components/ArtCropPickerDialog";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { podsApi, type PodDetail } from "~/lib/api";
import { showToast } from "~/lib/toast";
import { useResponsive } from "~/hooks/useResponsive";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";

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

  const loadPod = useCallback(async () => {
    if (!id) return;
    const result = await podsApi.get(id);
    if (result.data) {
      setPod(result.data);
      setName(result.data.name);
      setDescription(result.data.description || "");
      setCoverImage(result.data.coverImage || "");
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
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          className={`flex-1 items-center justify-center ${isDark ? "bg-slate-950" : "bg-white"}`}
          edges={isDesktop ? [] : ["top"]}
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
      <Stack.Screen options={{ headerShown: false }} />
      {isDesktop && <DesktopSidebar />}
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
        edges={isDesktop ? [] : ["top"]}
      >
        {/* Header */}
        <View className="flex-row items-center px-4 lg:px-6 py-3 lg:py-4">
          <View className="flex-row items-center gap-3 flex-1">
            {!isDesktop && (
              <Pressable
                onPress={() => router.back()}
                className={`rounded-full p-2 ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
              >
                <ArrowLeft size={24} color={isDark ? "#94a3b8" : "#64748b"} />
              </Pressable>
            )}
            <View className="flex-1">
              {isDesktop && (
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
              )}
              <Text
                className={`text-lg lg:text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Pod Settings
              </Text>
            </View>
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 24 }}>
          {/* Edit Pod Info */}
          <View className="gap-4">
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
                className={`rounded-lg border px-4 py-3 text-base ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-900"
                }`}
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
                className={`rounded-lg border px-4 py-3 text-base ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-900"
                }`}
                style={{ minHeight: 60, textAlignVertical: "top" }}
              />
            </View>
            <Pressable
              onPress={handleSave}
              disabled={saving || !name.trim()}
              className="items-center rounded-lg bg-purple-600 py-3"
            >
              <Text className="font-semibold text-white">
                {saving ? "Saving..." : "Save Changes"}
              </Text>
            </Pressable>
          </View>

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
                className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 ${
                  isDark ? "border-slate-700" : "border-slate-300"
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
                        isDark ? "border-slate-700" : "border-slate-300"
                      }`}
                    >
                      <Shield size={16} color="#7C3AED" />
                    </Pressable>
                    <Pressable
                      onPress={() => setShowRemoveConfirm(member.userId)}
                      className={`rounded-lg border p-2 ${
                        isDark ? "border-slate-700" : "border-slate-300"
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
                        isDark ? "border-slate-700" : "border-slate-300"
                      }`}
                    >
                      <ShieldOff size={16} color="#f59e0b" />
                    </Pressable>
                    <Pressable
                      onPress={() => setShowRemoveConfirm(member.userId)}
                      className={`rounded-lg border p-2 ${
                        isDark ? "border-slate-700" : "border-slate-300"
                      }`}
                    >
                      <UserMinus size={16} color="#ef4444" />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Danger Zone */}
          <View className="gap-3">
            <Text className="text-sm font-medium uppercase tracking-wider text-red-500">
              Danger Zone
            </Text>
            <Pressable
              onPress={() => setShowDeleteConfirm(true)}
              className="flex-row items-center justify-center gap-2 rounded-lg border border-red-500 py-3"
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
      </SafeAreaView>
    </View>
  );
}
