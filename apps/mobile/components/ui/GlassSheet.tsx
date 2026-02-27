import BottomSheet from "@gorhom/bottom-sheet";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { GlassView } from "expo-glass-effect";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { View } from "react-native";

interface GlassSheetProps {
  visible: boolean;
  onDismiss: () => void;
  snapPoints?: (string | number)[];
  isDark: boolean;
  children: React.ReactNode;
  enableKeyboardHandling?: boolean;
  /** Use inline BottomSheet instead of BottomSheetModal. Use for route-based pages where the sheet is always visible. */
  inline?: boolean;
}

export function GlassSheet({
  visible,
  onDismiss,
  snapPoints: snapPointsProp,
  isDark,
  children,
  enableKeyboardHandling,
  inline,
}: GlassSheetProps) {
  const modalRef = useRef<BottomSheetModal>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(
    () => snapPointsProp ?? ["50%", "90%"],
    [snapPointsProp],
  );

  // Modal mode: present/dismiss via ref
  useEffect(() => {
    if (inline) return;
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible, inline]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  const renderBackground = useCallback(
    (props: { style?: any }) => (
      <View
        style={[
          props.style,
          { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        ]}
        className={`overflow-hidden ${isDark ? "bg-slate-900" : "bg-white"}`}
      >
        <GlassView
          glassEffectStyle="regular"
          colorScheme={isDark ? "dark" : "light"}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      </View>
    ),
    [isDark],
  );

  const sharedProps = {
    snapPoints,
    backdropComponent: renderBackdrop,
    backgroundComponent: renderBackground,
    handleIndicatorStyle: {
      backgroundColor: isDark ? "#475569" : "#cbd5e1",
    },
    style: {
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      overflow: "hidden" as const,
    },
    ...(enableKeyboardHandling && {
      keyboardBehavior: "interactive" as const,
      keyboardBlurBehavior: "restore" as const,
      android_keyboardInputMode: "adjustResize" as const,
    }),
  };

  if (inline) {
    return (
      <BottomSheet
        ref={sheetRef}
        index={0}
        enablePanDownToClose
        onClose={onDismiss}
        {...sharedProps}
      >
        {children}
      </BottomSheet>
    );
  }

  return (
    <BottomSheetModal
      ref={modalRef}
      onDismiss={onDismiss}
      {...sharedProps}
    >
      {children}
    </BottomSheetModal>
  );
}
