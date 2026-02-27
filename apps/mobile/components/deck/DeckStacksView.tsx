import { Image, Pressable, ScrollView, Text, View } from "react-native";
import type { DeckCard } from "~/lib/api";
import type { CardSection, ViewMode } from "~/components/deck";
import { StacksTextItem } from "./StacksTextItem";
import { StacksCardItem } from "./StacksCardItem";

interface DeckStacksViewProps {
  stacksColumns: { sections: CardSection[] }[];
  viewMode: ViewMode;
  isDark: boolean;
  hoveredCard: DeckCard | null;
  groupBy: string;
  getGroupColor: (groupName: string) => string;
  onCardPress: (card: DeckCard) => void;
  onCardLongPress: (card: DeckCard) => void;
  onCardRightClick: (card: DeckCard, position: { x: number; y: number }) => void;
  onHoverCard: (card: DeckCard | null) => void;
  onLayoutWidth: (width: number) => void;
}

export function DeckStacksView({
  stacksColumns,
  viewMode,
  isDark,
  hoveredCard,
  groupBy,
  getGroupColor,
  onCardPress,
  onCardLongPress,
  onCardRightClick,
  onHoverCard,
  onLayoutWidth,
}: DeckStacksViewProps) {
  return (
    <View className="flex-1 flex-row">
      {/* Card Preview Panel */}
      <View className="px-4 py-4 items-center" style={{ width: 280 }}>
        {hoveredCard ? (
          <>
            <Image
              source={{
                uri: hoveredCard.imageUrl || hoveredCard.imageSmall || "",
              }}
              className="rounded-xl"
              style={{ width: 250, height: 349 }}
              resizeMode="contain"
            />
            {hoveredCard.priceUsd != null && (
              <Text
                className={`mt-2 text-sm font-medium ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                ${Number(hoveredCard.priceUsd).toFixed(2)}
              </Text>
            )}
          </>
        ) : (
          <View
            className={`items-center justify-center rounded-xl ${
              isDark ? "bg-slate-800/50" : "bg-slate-100"
            }`}
            style={{ width: 250, height: 349 }}
          >
            <Text
              className={`text-sm text-center px-4 ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Hover over a card to preview
            </Text>
          </View>
        )}
      </View>

      {/* Stacks Columns */}
      <ScrollView
        className="flex-1"
        onLayout={(e) => onLayoutWidth(e.nativeEvent.layout.width)}
      >
        <ScrollView
          horizontal
          contentContainerStyle={{
            paddingHorizontal: 8,
            paddingVertical: 12,
            alignItems: "flex-start",
            flexGrow: 1,
            justifyContent: "flex-end",
          }}
        >
          {stacksColumns.map((column) => (
            <View
              key={column.sections.map((s) => s.title).join("-")}
              className="mx-1"
              style={{ width: viewMode === "stacks-text" ? 220 : 200 }}
            >
              {column.sections.map((section, secIdx) => (
                <View
                  key={section.title}
                  style={secIdx > 0 ? { marginTop: 16 } : undefined}
                >
                  {/* Section Header */}
                  <View className="flex-row items-center gap-1.5 px-2 mb-2">
                    {groupBy !== "category" && (
                      <View
                        className="w-3 h-3 rounded-sm"
                        style={{
                          backgroundColor: getGroupColor(section.title),
                        }}
                      />
                    )}
                    <Text
                      className={`text-sm font-bold ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {section.title}
                    </Text>
                    <Text
                      className={`text-sm ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      (
                      {section.data.reduce((sum, c) => sum + c.quantity, 0)}
                      )
                    </Text>
                  </View>

                  {/* Section Cards */}
                  {viewMode === "stacks-text"
                    ? section.data.map((card, index) => (
                        <StacksTextItem
                          key={`${card.name}-${index}`}
                          card={card}
                          isDark={isDark}
                          onPress={() => onCardPress(card)}
                          onLongPress={() => onCardLongPress(card)}
                          onRightClick={(pos) => onCardRightClick(card, pos)}
                          onHover={onHoverCard}
                        />
                      ))
                    : section.data.map((card, index) => (
                        <StacksCardItem
                          key={`${card.name}-${index}`}
                          card={card}
                          isDark={isDark}
                          isLast={index === section.data.length - 1}
                          onPress={() => onCardPress(card)}
                          onLongPress={() => onCardLongPress(card)}
                          onRightClick={(pos) => onCardRightClick(card, pos)}
                          onHover={onHoverCard}
                        />
                      ))}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}
