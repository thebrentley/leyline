import { router, Stack, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Calendar, Clock } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useEffect, useState, useRef } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { podsApi } from "~/lib/api";
import { showToast } from "~/lib/toast";
import { useResponsive } from "~/hooks/useResponsive";
import { DesktopSidebar } from "~/components/web/DesktopSidebar";

// Web-only imports
let ReactDatePicker: any;
if (Platform.OS === "web") {
  ReactDatePicker = require("react-datepicker").default;
  require("react-datepicker/dist/react-datepicker.css");
  require("./datepicker-styles.css");
}

export default function CreateEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useResponsive();
  const [podName, setPodName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const datePickerRef = useRef<any>(null);
  const timePickerRef = useRef<any>(null);

  useEffect(() => {
    if (!id) return;
    podsApi.get(id).then((r) => {
      if (r.data) setPodName(r.data.name);
    });
  }, [id]);

  // Click outside to close pickers (web only)
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleClickOutside = (event: any) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
      if (timePickerRef.current && !timePickerRef.current.contains(event.target)) {
        setShowTimePicker(false);
      }
    };

    if (showDatePicker || showTimePicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDatePicker, showTimePicker]);

  const handleCreate = async () => {
    if (!id || !name.trim()) return;
    setCreating(true);

    const startsAt = selectedDate.toISOString();

    const result = await podsApi.createEvent(id, {
      name: name.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startsAt,
    });
    setCreating(false);

    if (result.data) {
      showToast.success("Event created!");
      router.push(`/pod/${id}/event/${result.data.id}`);
    } else {
      showToast.error(result.error || "Failed to create event");
    }
  };

  const onDateChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (date && event.type === "set") {
      const newDate = new Date(selectedDate);
      newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setSelectedDate(newDate);
    }
  };

  const onTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (date && event.type === "set") {
      const newDate = new Date(selectedDate);
      newDate.setHours(date.getHours(), date.getMinutes());
      setSelectedDate(newDate);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const inputStyle = `rounded-lg border px-4 py-3 text-base ${
    isDark
      ? "border-slate-700 bg-slate-900 text-white"
      : "border-slate-300 bg-white text-slate-900"
  }`;

  const labelStyle = `text-sm font-medium ${
    isDark ? "text-slate-300" : "text-slate-700"
  }`;

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
                      {podName || "..."}
                    </Text>
                  </Pressable>
                  <Text className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>/</Text>
                  <Pressable onPress={() => router.push(`/pod/${id}/events`)} className="hover:underline">
                    <Text className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
                      Events
                    </Text>
                  </Pressable>
                  <Text className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}>/</Text>
                  <Text className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Create
                  </Text>
                </View>
              )}
              <Text
                className={`text-lg lg:text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Create Event
              </Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
          <View className="gap-2">
            <Text className={labelStyle}>Event Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Friday Game Night"
              placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
              className={inputStyle}
              autoFocus
            />
          </View>

          <View className="gap-2">
            <Text className={labelStyle}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What's the plan?"
              placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
              multiline
              className={inputStyle}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
          </View>

          <View className="gap-2">
            <Text className={labelStyle}>Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Joe's house, LGS downtown"
              placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
              className={inputStyle}
            />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-2">
              <Text className={labelStyle}>Date *</Text>
              {Platform.OS === "web" ? (
                <div style={{ position: "relative" }} ref={datePickerRef}>
                  <Pressable
                    onPress={() => setShowDatePicker(!showDatePicker)}
                    className={`rounded-lg border px-4 py-3 flex-row items-center gap-2 ${
                      isDark
                        ? "border-slate-700 bg-slate-900 hover:bg-slate-800"
                        : "border-slate-300 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <Calendar size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                    <Text className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}>
                      {formatDate(selectedDate)}
                    </Text>
                  </Pressable>
                  {showDatePicker && ReactDatePicker && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        marginTop: "0.5rem",
                        zIndex: 9999,
                        borderRadius: "0.5rem",
                        border: isDark ? "1px solid rgb(51, 65, 85)" : "1px solid rgb(226, 232, 240)",
                        backgroundColor: isDark ? "rgb(15, 23, 42)" : "rgb(255, 255, 255)",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
                        overflow: "hidden",
                        opacity: 1,
                      }}
                    >
                      <ReactDatePicker
                        selected={selectedDate}
                        onChange={(date: Date) => {
                          setSelectedDate(date);
                          setShowDatePicker(false);
                        }}
                        inline
                        minDate={new Date()}
                        calendarClassName={isDark ? "dark-calendar" : "light-calendar"}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    className={`rounded-lg border px-4 py-3 flex-row items-center gap-2 ${
                      isDark
                        ? "border-slate-700 bg-slate-900 active:bg-slate-800"
                        : "border-slate-300 bg-white active:bg-slate-50"
                    }`}
                  >
                    <Calendar size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                    <Text className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}>
                      {formatDate(selectedDate)}
                    </Text>
                  </Pressable>
                  {showDatePicker && (
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={onDateChange}
                      minimumDate={new Date()}
                    />
                  )}
                </>
              )}
            </View>
            <View className="flex-1 gap-2">
              <Text className={labelStyle}>Time *</Text>
              {Platform.OS === "web" ? (
                <div style={{ position: "relative" }} ref={timePickerRef}>
                  <Pressable
                    onPress={() => setShowTimePicker(!showTimePicker)}
                    className={`rounded-lg border px-4 py-3 flex-row items-center gap-2 ${
                      isDark
                        ? "border-slate-700 bg-slate-900 hover:bg-slate-800"
                        : "border-slate-300 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <Clock size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                    <Text className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}>
                      {formatTime(selectedDate)}
                    </Text>
                  </Pressable>
                  {showTimePicker && ReactDatePicker && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        marginTop: "0.5rem",
                        zIndex: 9999,
                        borderRadius: "0.5rem",
                        border: isDark ? "1px solid rgb(51, 65, 85)" : "1px solid rgb(226, 232, 240)",
                        backgroundColor: isDark ? "rgb(15, 23, 42)" : "rgb(255, 255, 255)",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
                        overflow: "hidden",
                        opacity: 1,
                      }}
                    >
                      <ReactDatePicker
                        selected={selectedDate}
                        onChange={(date: Date) => {
                          setSelectedDate(date);
                          setShowTimePicker(false);
                        }}
                        showTimeSelect
                        showTimeSelectOnly
                        timeIntervals={15}
                        timeCaption="Time"
                        dateFormat="h:mm aa"
                        inline
                        calendarClassName={isDark ? "dark-calendar" : "light-calendar"}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Pressable
                    onPress={() => setShowTimePicker(true)}
                    className={`rounded-lg border px-4 py-3 flex-row items-center gap-2 ${
                      isDark
                        ? "border-slate-700 bg-slate-900 active:bg-slate-800"
                        : "border-slate-300 bg-white active:bg-slate-50"
                    }`}
                  >
                    <Clock size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                    <Text className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}>
                      {formatTime(selectedDate)}
                    </Text>
                  </Pressable>
                  {showTimePicker && (
                    <DateTimePicker
                      value={selectedDate}
                      mode="time"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={onTimeChange}
                    />
                  )}
                </>
              )}
            </View>
          </View>

          <Pressable
            onPress={handleCreate}
            disabled={!name.trim() || creating}
            className={`items-center rounded-lg py-3 ${
              !name.trim() || creating
                ? "bg-purple-600/50"
                : "bg-purple-600 active:bg-purple-700"
            }`}
          >
            <Text className="text-base font-semibold text-white">
              {creating ? "Creating..." : "Create Event"}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
