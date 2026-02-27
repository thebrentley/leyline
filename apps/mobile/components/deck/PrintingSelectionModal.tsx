import { Modal, Pressable, ScrollView, Text, View } from "react-native";

interface PrintingInfo {
  id: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
  foilQuantity: number;
  scryfallId: string;
  linkedTo?: { deckId: string; deckName: string };
}

interface PrintingSelectionModalProps {
  visible: boolean;
  cardName: string;
  printings: PrintingInfo[];
  currentScryfallId: string;
  isDark: boolean;
  onSelect: (collectionCardId: string) => void;
  onClose: () => void;
}

export function PrintingSelectionModal({
  visible,
  cardName,
  printings,
  currentScryfallId,
  isDark,
  onSelect,
  onClose,
}: PrintingSelectionModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/50 items-center justify-center p-4"
        onPress={onClose}
      >
        <Pressable
          className={`w-full max-w-sm rounded-2xl p-6 ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            className={`text-xl font-semibold mb-2 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Select Printing
          </Text>
          <Text
            className={`text-base mb-4 ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            You own {printings.length} different printings
            of "{cardName}". Select which one to link.
          </Text>
          {printings.some(
            (p) => p.scryfallId !== currentScryfallId,
          ) && (
            <Text
              className={`text-sm mb-4 ${
                isDark ? "text-amber-400" : "text-amber-600"
              }`}
            >
              Note: Selecting a different printing will change the card in
              your deck to match.
            </Text>
          )}
          <ScrollView className="max-h-96 mb-4">
            {printings.map((printing) => {
              const totalQty = printing.quantity + printing.foilQuantity;
              const foilText =
                printing.foilQuantity > 0
                  ? ` (${printing.foilQuantity} foil)`
                  : "";
              const isLinked = !!printing.linkedTo;
              return (
                <Pressable
                  key={printing.id}
                  className={`p-4 mb-2 rounded-lg ${
                    isLinked
                      ? isDark
                        ? "bg-slate-700 border border-amber-500/50"
                        : "bg-slate-100 border border-amber-500/50"
                      : isDark
                        ? "bg-slate-700"
                        : "bg-slate-100"
                  }`}
                  onPress={() => {
                    onClose();
                    onSelect(printing.id);
                  }}
                >
                  <Text
                    className={`font-medium ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {printing.setCode.toUpperCase()} #
                    {printing.collectorNumber}
                  </Text>
                  <Text
                    className={`text-sm ${
                      isDark ? "text-slate-300" : "text-slate-600"
                    }`}
                  >
                    {totalQty}x{foilText}
                  </Text>
                  {isLinked && (
                    <Text
                      className={`text-xs mt-1 ${
                        isDark ? "text-amber-400" : "text-amber-600"
                      }`}
                    >
                      Already linked to {printing.linkedTo!.deckName}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            className={`py-3 px-4 rounded-lg ${
              isDark ? "bg-slate-700" : "bg-slate-200"
            }`}
            onPress={onClose}
          >
            <Text
              className={`text-center font-medium ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
