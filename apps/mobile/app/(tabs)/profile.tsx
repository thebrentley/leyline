import { DrawerActions, useNavigation } from "@react-navigation/native";
import { Camera, LogOut, Menu, Trash2 } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useState } from "react";
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
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { useAuth } from "~/contexts/AuthContext";
import { ArtCropPickerDialog } from "~/components/ArtCropPickerDialog";
import { useResponsive } from "~/hooks/useResponsive";
import { authApi } from "~/lib/api";
import { showToast } from "~/lib/toast";

export default function ProfileScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user, refreshUser, signOut, deleteAccount } = useAuth();
  const navigation = useNavigation();
  const { isDesktop } = useResponsive();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [profilePicture, setProfilePicture] = useState(
    user?.profilePicture || "",
  );
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await authApi.updateProfile({
      displayName: displayName || undefined,
      profilePicture: profilePicture || undefined,
    });

    if (result.data) {
      showToast.success("Profile updated successfully");
      await refreshUser();
    } else {
      showToast.error(result.error || "Failed to update profile");
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      setDeleteError("Password is required");
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      await deleteAccount(deletePassword);
    } catch (error: any) {
      setDeleteError(error.message || "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  const cardBorder = isDark ? "border-slate-800" : "border-slate-200";
  const cardBg = isDark ? "bg-slate-900/50" : "bg-slate-50/80";

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
      edges={isDesktop ? [] : ["top"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className={`flex-1 ${isDesktop ? "" : "items-center"}`}>
          <View
            className={`w-full flex-1 p-6 ${isDesktop ? "py-8 px-12" : "max-w-lg"}`}
          >
            {/* Header */}
            <View
              className={`flex-row items-center gap-3 ${isDesktop ? "mb-10" : "mb-8"}`}
            >
              {!isDesktop && (
                <Pressable
                  onPress={openDrawer}
                  className={`-ml-2 rounded-full p-2 ${
                    isDark ? "active:bg-slate-800" : "active:bg-slate-100"
                  }`}
                >
                  <Menu size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                </Pressable>
              )}
              <Text
                className={`font-bold ${isDesktop ? "text-3xl" : "text-2xl"} ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                User Settings
              </Text>
            </View>

            {/* Profile Section */}
            <View
              className={
                isDesktop
                  ? `rounded-xl border p-6 ${cardBorder} ${cardBg}`
                  : ""
              }
            >
              {isDesktop && (
                <Text
                  className={`mb-6 text-xs font-semibold uppercase tracking-wider ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Profile
                </Text>
              )}

              <View
                className={isDesktop ? "flex-row items-start gap-8" : ""}
              >
                {/* Avatar */}
                <View
                  className={`items-center ${isDesktop ? "" : "mb-8"}`}
                >
                  <View className="relative">
                    {profilePicture ? (
                      <Image
                        source={{ uri: profilePicture }}
                        className={`rounded-full ${isDesktop ? "h-32 w-32" : "h-24 w-24"}`}
                        resizeMode="cover"
                      />
                    ) : (
                      <View className={`items-center justify-center rounded-full bg-purple-600 ${isDesktop ? "h-32 w-32" : "h-24 w-24"}`}>
                        <Text className={`font-bold text-white ${isDesktop ? "text-4xl" : "text-3xl"}`}>
                          {(displayName || user?.email)
                            ?.charAt(0)
                            .toUpperCase() || "U"}
                        </Text>
                      </View>
                    )}
                    {!isDesktop && (
                      <Pressable
                        onPress={() => setShowPicker(true)}
                        className={`absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 ${
                          isDark
                            ? "border-slate-950 bg-slate-700"
                            : "border-white bg-slate-200"
                        }`}
                      >
                        <Camera
                          size={16}
                          color={isDark ? "#e2e8f0" : "#475569"}
                        />
                      </Pressable>
                    )}
                  </View>
                  {isDesktop && (
                    <Pressable
                      onPress={() => setShowPicker(true)}
                      className={`mt-3 rounded-lg px-3 py-1.5 ${
                        isDark ? "active:bg-slate-800" : "active:bg-slate-200"
                      }`}
                    >
                      <Text className="text-sm font-medium text-purple-500">
                        Change photo
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Form */}
                <View className={`gap-4 ${isDesktop ? "flex-1" : ""}`}>
                  <View>
                    <Text
                      className={`mb-2 text-sm font-medium ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Display Name
                    </Text>
                    <TextInput
                      value={displayName}
                      onChangeText={setDisplayName}
                      placeholder="Enter your display name"
                      placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                      className={`rounded-lg border px-4 py-3 text-base ${
                        isDark
                          ? "border-slate-700 bg-slate-800 text-white"
                          : "border-slate-200 bg-white text-slate-900"
                      }`}
                    />
                  </View>

                  <View>
                    <Text
                      className={`mb-2 text-sm font-medium ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Email
                    </Text>
                    <TextInput
                      value={user?.email || ""}
                      editable={false}
                      className={`rounded-lg border px-4 py-3 text-base ${
                        isDark
                          ? "border-slate-700 bg-slate-800/50 text-slate-400"
                          : "border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    />
                  </View>

                  {/* Save Button - inline on desktop */}
                  {isDesktop && (
                    <View className="mt-2 flex-row justify-end">
                      <Button onPress={handleSave} disabled={saving}>
                        <Text className="font-semibold text-white">
                          {saving ? "Saving..." : "Save Changes"}
                        </Text>
                      </Button>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Save Button - full width on mobile */}
            {!isDesktop && (
              <View className="mt-8">
                <Button onPress={handleSave} disabled={saving}>
                  <Text className="font-semibold text-white">
                    {saving ? "Saving..." : "Save Changes"}
                  </Text>
                </Button>
              </View>
            )}

            {/* Log out */}
            <View className={isDesktop ? "mt-8" : "mt-auto pt-8"}>
              <View
                className={
                  isDesktop
                    ? `rounded-xl border p-2 ${cardBorder}`
                    : ""
                }
              >
                <Pressable
                  onPress={() => setShowLogoutConfirm(true)}
                  className={`flex-row items-center gap-2 rounded-lg py-3 ${
                    isDesktop ? "px-4" : "justify-center"
                  } ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
                >
                  <LogOut size={18} color="#ef4444" />
                  <Text className="text-sm font-medium text-red-500">
                    Log out
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Delete Account */}
            <View className={isDesktop ? "mt-4" : "mt-4 pb-8"}>
              <View
                className={
                  isDesktop
                    ? `rounded-xl border p-2 ${cardBorder}`
                    : ""
                }
              >
                <Pressable
                  onPress={() => {
                    setDeletePassword("");
                    setDeleteError("");
                    setShowDeleteConfirm(true);
                  }}
                  className={`flex-row items-center gap-2 rounded-lg py-3 ${
                    isDesktop ? "px-4" : "justify-center"
                  } ${isDark ? "active:bg-slate-800" : "active:bg-slate-100"}`}
                >
                  <Trash2 size={18} color="#ef4444" />
                  <Text className="text-sm font-medium text-red-500">
                    Delete Account
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <ArtCropPickerDialog
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(imageUrl) => setProfilePicture(imageUrl)}
      />

      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setShowDeleteConfirm(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 items-center justify-center p-4"
          onPress={() => !deleting && setShowDeleteConfirm(false)}
        >
          <Pressable
            className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? "bg-slate-800" : "bg-white"}`}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              className={`text-xl font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Delete Account
            </Text>
            <Text
              className={`text-base mb-4 ${isDark ? "text-slate-300" : "text-slate-600"}`}
            >
              This will permanently delete your account and all your data
              including decks, collection, and chat history. This action cannot
              be undone.
            </Text>
            <Text
              className={`text-sm font-medium mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Enter your password to confirm
            </Text>
            <TextInput
              value={deletePassword}
              onChangeText={(text) => {
                setDeletePassword(text);
                setDeleteError("");
              }}
              placeholder="Password"
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              secureTextEntry
              editable={!deleting}
              className={`rounded-lg border px-4 py-3 text-base mb-2 ${
                isDark
                  ? "border-slate-700 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-900"
              }`}
            />
            {deleteError ? (
              <Text className="text-sm text-red-500 mb-2">{deleteError}</Text>
            ) : null}
            <View className="flex-row gap-3 mt-4">
              <Pressable
                className={`flex-1 py-3 px-4 rounded-lg ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                <Text
                  className={`text-center font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                className={`flex-1 py-3 px-4 rounded-lg bg-red-600 ${deleting ? "opacity-50" : ""}`}
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                <Text className="text-center font-medium text-white">
                  {deleting ? "Deleting..." : "Delete"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={showLogoutConfirm}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmText="Log out"
        cancelText="Cancel"
        destructive={true}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          signOut();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </SafeAreaView>
  );
}
