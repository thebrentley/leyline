import {
  Globe,
  Lock,
  MoreVertical,
  Palette,
  PanelRightClose,
  Plus,
  Sparkles,
  Users,
} from "lucide-react-native";
import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Spinner } from "~/components/Spinner";
import { HeaderButton } from "~/components/ui/HeaderButton";
import type { DeckDetail } from "~/lib/api";

interface DeckDesktopHeaderProps {
  deck: DeckDetail | null;
  isDark: boolean;
  syncing: boolean;
  advisorPanelVisible: boolean;
  onToggleVisibility: () => void;
  onOpenMenu: (position: { top: number; right: number }) => void;
  onAddCard: () => void;
  onOpenColorTags: () => void;
  onToggleAdvisor: () => void;
}

export function DeckDesktopHeader({
  deck,
  isDark,
  syncing,
  advisorPanelVisible,
  onToggleVisibility,
  onOpenMenu,
  onAddCard,
  onOpenColorTags,
  onToggleAdvisor,
}: DeckDesktopHeaderProps) {
  const menuButtonRef = useRef<View>(null);

  return (
    <View className="flex-row items-center justify-between px-6 py-4">
      <View className="flex-row items-center gap-3 flex-1">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Pressable
              onPress={() =>
                router.push(
                  deck?.isReadOnly ? "/(tabs)/explore" : "/(tabs)/decks",
                )
              }
              className="hover:underline"
            >
              <Text
                className={`text-sm ${isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
              >
                {deck?.isReadOnly ? "Explore" : "My Decks"}
              </Text>
            </Pressable>
            <Text
              className={`text-sm ${isDark ? "text-slate-600" : "text-slate-300"}`}
            >
              /
            </Text>
            <Text
              className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
              numberOfLines={1}
            >
              {deck?.name || "Loading..."}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text
              className={`text-lg lg:text-2xl font-bold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {deck?.name || "Loading..."}
            </Text>
            {deck && !deck.isReadOnly && (
              <Pressable
                onPress={onToggleVisibility}
                className={`rounded-full p-1.5 ${
                  isDark ? "active:bg-slate-800" : "active:bg-slate-100"
                }`}
                accessibilityLabel={
                  deck.visibility === "public"
                    ? "Make deck visible to pod members"
                    : deck.visibility === "pod"
                      ? "Make deck private"
                      : "Make deck visible to pod members"
                }
              >
                {deck.visibility === "public" ? (
                  <Globe size={16} color="#7C3AED" />
                ) : deck.visibility === "pod" ? (
                  <Users size={16} color="#3B82F6" />
                ) : (
                  <Lock size={16} color={isDark ? "#64748b" : "#94a3b8"} />
                )}
              </Pressable>
            )}
          </View>
          {deck && (
            <View className="flex-row items-center gap-2 lg:gap-3 mt-0.5 lg:mt-1">
              {deck.format && (
                <Text
                  className={`text-xs lg:text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  {deck.format}
                </Text>
              )}
              <Text
                className={`text-xs lg:text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
              >
                {deck.cardCount} cards
              </Text>
              {deck.isReadOnly && deck.ownerName && (
                <Text
                  className={`text-xs lg:text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  by {deck.ownerName}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
      <View className="flex-row items-center gap-1 lg:gap-2">
        {!deck?.isReadOnly && (
          <HeaderButton icon={Plus} label="Add Card" onPress={onAddCard} />
        )}
        {!deck?.isReadOnly && (
          <HeaderButton
            icon={Palette}
            label="Tags"
            variant="secondary"
            onPress={onOpenColorTags}
          />
        )}
        {!deck?.isReadOnly && (
          <HeaderButton
            icon={advisorPanelVisible ? PanelRightClose : Sparkles}
            label="Advisor"
            variant={advisorPanelVisible ? "primary" : "secondary"}
            onPress={onToggleAdvisor}
            accessibilityLabel={
              advisorPanelVisible ? "Hide AI Advisor" : "Show AI Advisor"
            }
          />
        )}
        {!deck?.isReadOnly && (
          <View ref={menuButtonRef} collapsable={false}>
            {syncing ? (
              <Spinner
                size={20}
                strokeWidth={2}
                color="#7C3AED"
                backgroundColor={
                  isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
                }
              />
            ) : (
              <HeaderButton
                icon={MoreVertical}
                variant="ghost"
                onPress={() => {
                  menuButtonRef.current?.measure(
                    (x, y, width, height, pageX, pageY) => {
                      onOpenMenu({ top: pageY + height + 4, right: 16 });
                    },
                  );
                }}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}
