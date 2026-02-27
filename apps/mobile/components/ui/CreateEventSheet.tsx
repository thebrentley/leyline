import { router } from "expo-router";
import { Calendar, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { podsApi } from "~/lib/api";
import { showToast } from "~/lib/toast";
import { GlassSheet } from "./GlassSheet";
import { KEYBOARD_ACCESSORY_ID } from "./KeyboardDoneAccessory";

// Web-only imports
let ReactDatePicker: any;
if (Platform.OS === "web") {
  ReactDatePicker = require("react-datepicker").default;
  require("react-datepicker/dist/react-datepicker.css");
  require("./datepicker-styles.css");
}

interface CreateEventSheetProps {
  visible: boolean;
  onDismiss: () => void;
  podId: string;
}

export function CreateEventSheet({
  visible,
  onDismiss,
  podId,
}: CreateEventSheetProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const pickerButtonRef = useRef<any>(null);
  const pickerPopupRef = useRef<any>(null);
  const [pickerPos, setPickerPos] = useState({ bottom: 0, left: 0 });
  // Android needs sequential date→time flow
  const [androidPickerMode, setAndroidPickerMode] = useState<
    "date" | "time"
  >("date");

  // Reset form when sheet opens
  useEffect(() => {
    if (visible) {
      setName("");
      setDescription("");
      setLocation("");
      setSelectedDate(new Date());
      setShowPicker(false);
      setCreating(false);
      setAndroidPickerMode("date");
    }
  }, [visible]);

  // Click outside to close picker (web only)
  useEffect(() => {
    if (Platform.OS !== "web" || !showPicker) return;

    const handleClickOutside = (event: any) => {
      if (
        pickerPopupRef.current &&
        !pickerPopupRef.current.contains(event.target) &&
        pickerButtonRef.current &&
        !pickerButtonRef.current.contains(event.target)
      ) {
        setShowPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPicker]);

  const handleCreate = async () => {
    if (!podId || !name.trim()) return;
    setCreating(true);

    const result = await podsApi.createEvent(podId, {
      name: name.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startsAt: selectedDate.toISOString(),
    });
    setCreating(false);

    if (result.data) {
      showToast.success("Event created!");
      onDismiss();
      router.push(`/pod/${podId}/event/${result.data.id}`);
    } else {
      showToast.error(result.error || "Failed to create event");
    }
  };

  const toggleWebPicker = () => {
    if (!showPicker && pickerButtonRef.current) {
      const rect = pickerButtonRef.current.getBoundingClientRect();
      setPickerPos({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
      });
    }
    setShowPicker(!showPicker);
  };

  const onNativeDateTimeChange = (event: any, date?: Date) => {
    if (event.type === "dismissed") {
      setShowPicker(false);
      setAndroidPickerMode("date");
      return;
    }
    if (!date) return;

    if (Platform.OS === "android") {
      if (androidPickerMode === "date") {
        // Apply date, then show time picker
        const newDate = new Date(selectedDate);
        newDate.setFullYear(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
        );
        setSelectedDate(newDate);
        setAndroidPickerMode("time");
      } else {
        // Apply time, close
        const newDate = new Date(selectedDate);
        newDate.setHours(date.getHours(), date.getMinutes());
        setSelectedDate(newDate);
        setShowPicker(false);
        setAndroidPickerMode("date");
      }
    } else {
      // iOS datetime mode — updates live
      setSelectedDate(date);
    }
  };

  const formatDateTime = (date: Date) =>
    date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const inputStyle = `rounded-lg border px-4 py-3 text-base ${
    isDark
      ? "border-slate-700 bg-slate-900 text-white"
      : "border-slate-300 bg-white text-slate-900"
  }`;

  const labelStyle = `text-sm font-medium ${
    isDark ? "text-slate-300" : "text-slate-700"
  }`;

  const formFields = (
    <>
      <View className="gap-2">
        <Text className={labelStyle}>Event Name *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Friday Game Night"
          placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
          className={inputStyle}
          inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
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
          inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
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
          inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
        />
      </View>

      <View className="gap-2">
        <Text className={labelStyle}>Date & Time *</Text>
        {Platform.OS === "web" ? (
          <div ref={pickerButtonRef}>
            <Pressable
              onPress={toggleWebPicker}
              className={`rounded-lg border px-4 py-3 flex-row items-center gap-2 ${
                isDark
                  ? "border-slate-700 bg-slate-900 hover:bg-slate-800"
                  : "border-slate-300 bg-white hover:bg-slate-50"
              }`}
            >
              <Calendar size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {formatDateTime(selectedDate)}
              </Text>
            </Pressable>
          </div>
        ) : (
          <>
            <Pressable
              onPress={() => {
                setAndroidPickerMode("date");
                setShowPicker(true);
              }}
              className={`rounded-lg border px-4 py-3 flex-row items-center gap-2 ${
                isDark
                  ? "border-slate-700 bg-slate-900 active:bg-slate-800"
                  : "border-slate-300 bg-white active:bg-slate-50"
              }`}
            >
              <Calendar size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text
                className={`text-base ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {formatDateTime(selectedDate)}
              </Text>
            </Pressable>
            {showPicker && (
              <DateTimePicker
                value={selectedDate}
                mode={
                  Platform.OS === "ios" ? "datetime" : androidPickerMode
                }
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onNativeDateTimeChange}
                minimumDate={new Date()}
              />
            )}
          </>
        )}
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
    </>
  );

  const header = (
    <View className="flex-row items-center justify-between">
      <Text
        className={`text-xl font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
      >
        Create Event
      </Text>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
      </Pressable>
    </View>
  );

  // Web: fixed-position picker popup rendered outside the dialog via portal-like approach
  const webPickerPopup =
    Platform.OS === "web" && showPicker && ReactDatePicker ? (
      <div
        ref={pickerPopupRef}
        style={{
          position: "fixed",
          bottom: pickerPos.bottom,
          left: pickerPos.left,
          zIndex: 99999,
          borderRadius: "0.5rem",
          border: isDark
            ? "1px solid rgb(51, 65, 85)"
            : "1px solid rgb(226, 232, 240)",
          backgroundColor: isDark
            ? "rgb(15, 23, 42)"
            : "rgb(255, 255, 255)",
          boxShadow:
            "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
        }}
      >
        <ReactDatePicker
          selected={selectedDate}
          onChange={(date: Date) => setSelectedDate(date)}
          showTimeSelect
          timeIntervals={15}
          timeCaption="Time"
          dateFormat="MMMM d, yyyy h:mm aa"
          inline
          minDate={new Date()}
          calendarClassName={isDark ? "dark-calendar" : "light-calendar"}
        />
      </div>
    ) : null;

  if (Platform.OS === "web") {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onDismiss}
      >
        <Pressable
          className={`flex-1 items-center justify-center p-4 ${isDark ? "bg-black/60" : "bg-black/40"}`}
          onPress={onDismiss}
        >
          <Pressable
            className={`w-full max-w-lg rounded-2xl p-6 ${isDark ? "bg-slate-800" : "bg-white"}`}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ gap: 16 }}>
              {header}
              {formFields}
            </View>
          </Pressable>
        </Pressable>
        {webPickerPopup}
      </Modal>
    );
  }

  // Native: bottom sheet
  return (
    <GlassSheet
      visible={visible}
      onDismiss={onDismiss}
      isDark={isDark}
      snapPoints={["92%"]}
      enableKeyboardHandling
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        {header}
        {formFields}
      </BottomSheetScrollView>
    </GlassSheet>
  );
}
