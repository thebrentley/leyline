import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { Check, Search, UserPlus, UserX, X } from "lucide-react-native";
import { podsApi } from "~/lib/api";
import { showToast } from "~/lib/toast";

interface SearchResult {
  id: string;
  displayName: string | null;
  email: string;
}

type Tab = "search" | "offline";

interface AddMemberDialogProps {
  visible: boolean;
  podId: string;
  onClose: () => void;
}

export function AddMemberDialog({
  visible,
  podId,
  onClose,
}: AddMemberDialogProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [activeTab, setActiveTab] = useState<Tab>("search");

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  // Offline state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const result = await podsApi.searchUsers(text);
    if (result.data) {
      setResults(result.data);
    }
    setSearching(false);
  }, []);

  const handleInvite = async (userId: string) => {
    const result = await podsApi.inviteUser(podId, userId);
    if (result.data) {
      setInvitedIds((prev) => new Set(prev).add(userId));
      showToast.success("Invite sent!");
    } else {
      showToast.error(result.error || "Failed to send invite");
    }
  };

  const handleAddOffline = async () => {
    if (!name.trim()) {
      showToast.error("Name is required");
      return;
    }

    setSubmitting(true);
    const result = await podsApi.addOfflineMember(podId, {
      name: name.trim(),
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    setSubmitting(false);

    if (result.data) {
      showToast.success("Offline member added!");
      setName("");
      setEmail("");
      setNotes("");
    } else {
      showToast.error(result.error || "Failed to add offline member");
    }
  };

  const handleClose = () => {
    setQuery("");
    setResults([]);
    setInvitedIds(new Set());
    setName("");
    setEmail("");
    setNotes("");
    setActiveTab("search");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable
        className="flex-1 bg-black/50 items-center justify-center p-4"
        onPress={handleClose}
      >
        <Pressable
          className={`w-full max-w-sm rounded-2xl p-6 ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}
          onPress={(e) => e.stopPropagation()}
          style={{ maxHeight: 520 }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <Text
              className={`text-xl font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Add Member
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <X size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View
            className={`flex-row rounded-lg p-1 mb-4 ${
              isDark ? "bg-slate-700" : "bg-slate-100"
            }`}
          >
            <Pressable
              onPress={() => setActiveTab("search")}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-md py-2 ${
                activeTab === "search"
                  ? isDark
                    ? "bg-slate-600"
                    : "bg-white"
                  : ""
              }`}
            >
              <UserPlus
                size={14}
                color={
                  activeTab === "search"
                    ? isDark
                      ? "#e2e8f0"
                      : "#1e293b"
                    : isDark
                      ? "#64748b"
                      : "#94a3b8"
                }
              />
              <Text
                className={`text-sm font-medium ${
                  activeTab === "search"
                    ? isDark
                      ? "text-white"
                      : "text-slate-900"
                    : isDark
                      ? "text-slate-400"
                      : "text-slate-500"
                }`}
              >
                Invite
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("offline")}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-md py-2 ${
                activeTab === "offline"
                  ? isDark
                    ? "bg-slate-600"
                    : "bg-white"
                  : ""
              }`}
            >
              <UserX
                size={14}
                color={
                  activeTab === "offline"
                    ? isDark
                      ? "#e2e8f0"
                      : "#1e293b"
                    : isDark
                      ? "#64748b"
                      : "#94a3b8"
                }
              />
              <Text
                className={`text-sm font-medium ${
                  activeTab === "offline"
                    ? isDark
                      ? "text-white"
                      : "text-slate-900"
                    : isDark
                      ? "text-slate-400"
                      : "text-slate-500"
                }`}
              >
                Add Offline
              </Text>
            </Pressable>
          </View>

          {/* Search Tab */}
          {activeTab === "search" && (
            <>
              <View
                className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 mb-4 ${
                  isDark
                    ? "border-slate-600 bg-slate-700"
                    : "border-slate-300 bg-slate-100"
                }`}
              >
                <Search size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                <TextInput
                  value={query}
                  onChangeText={handleSearch}
                  placeholder="Search by name or email..."
                  placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                  className={`flex-1 text-base ${isDark ? "text-white" : "text-slate-900"}`}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                {searching && <ActivityIndicator size="small" />}
              </View>

              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                style={{ flexGrow: 0, maxHeight: 280 }}
                renderItem={({ item }) => {
                  const invited = invitedIds.has(item.id);
                  return (
                    <View className="flex-row items-center justify-between py-2.5">
                      <View className="flex-row items-center gap-3 flex-1">
                        <View className="h-9 w-9 items-center justify-center rounded-full bg-purple-600">
                          <Text className="text-sm font-bold text-white">
                            {(item.displayName || item.email)
                              ?.charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text
                            className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                            numberOfLines={1}
                          >
                            {item.displayName || item.email.split("@")[0]}
                          </Text>
                          <Text
                            className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                            numberOfLines={1}
                          >
                            {item.email}
                          </Text>
                        </View>
                      </View>
                      {invited ? (
                        <View className="flex-row items-center gap-1 rounded-lg bg-green-600/20 px-2.5 py-1.5">
                          <Check size={14} color="#22c55e" />
                          <Text className="text-xs font-medium text-green-500">
                            Sent
                          </Text>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => handleInvite(item.id)}
                          className="flex-row items-center gap-1 rounded-lg bg-purple-600 px-2.5 py-1.5"
                        >
                          <UserPlus size={14} color="#ffffff" />
                          <Text className="text-xs font-medium text-white">
                            Invite
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                }}
                ListEmptyComponent={
                  query.length >= 2 && !searching ? (
                    <Text
                      className={`py-6 text-center text-sm ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      No users found
                    </Text>
                  ) : null
                }
              />
            </>
          )}

          {/* Offline Tab */}
          {activeTab === "offline" && (
            <>
              <Text
                className={`text-sm mb-4 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Add a member who doesn't use the app yet. If they join later
                with a matching email, they'll be linked automatically.
              </Text>

              <ScrollView contentContainerStyle={{ gap: 16 }}>
                <View>
                  <Text
                    className={`text-sm font-medium mb-2 ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Name <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter name"
                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                    className={`rounded-lg border px-3 py-2.5 text-base ${
                      isDark
                        ? "border-slate-600 bg-slate-700 text-white"
                        : "border-slate-300 bg-slate-100 text-slate-900"
                    }`}
                    autoCapitalize="words"
                  />
                </View>

                <View>
                  <Text
                    className={`text-sm font-medium mb-2 ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Email (optional)
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="email@example.com"
                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                    className={`rounded-lg border px-3 py-2.5 text-base ${
                      isDark
                        ? "border-slate-600 bg-slate-700 text-white"
                        : "border-slate-300 bg-slate-100 text-slate-900"
                    }`}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                  <Text
                    className={`text-xs mt-1 ${
                      isDark ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    For auto-linking when they join
                  </Text>
                </View>

                <View>
                  <Text
                    className={`text-sm font-medium mb-2 ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Notes (optional)
                  </Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Any additional info..."
                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                    className={`rounded-lg border px-3 py-2.5 text-base ${
                      isDark
                        ? "border-slate-600 bg-slate-700 text-white"
                        : "border-slate-300 bg-slate-100 text-slate-900"
                    }`}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </ScrollView>

              <Pressable
                className={`flex-row items-center justify-center gap-2 mt-4 py-3 px-4 rounded-lg ${
                  submitting || !name.trim()
                    ? "bg-purple-600/50"
                    : "bg-purple-600"
                }`}
                onPress={handleAddOffline}
                disabled={submitting || !name.trim()}
              >
                <UserPlus size={16} color="#ffffff" />
                <Text className="text-center font-medium text-white">
                  {submitting ? "Adding..." : "Add Offline Member"}
                </Text>
              </Pressable>
            </>
          )}

          {/* Done button (search tab) */}
          {activeTab === "search" && (
            <Pressable
              className={`mt-4 py-3 px-4 rounded-lg ${
                isDark ? "bg-slate-700" : "bg-slate-200"
              }`}
              onPress={handleClose}
            >
              <Text
                className={`text-center font-medium ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Done
              </Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
