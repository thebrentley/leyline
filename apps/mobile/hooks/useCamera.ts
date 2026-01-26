import { useState, useCallback } from "react";

export interface ScannedCard {
  id: string;
  scryfallId: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  imageSmall: string;
  quantity: number;
  priceUsd?: number;
}

export function useCamera() {
  const [scannerVisible, setScannerVisible] = useState(false);
  const [batchCards, setBatchCards] = useState<ScannedCard[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const openScanner = useCallback(() => {
    setScannerVisible(true);
  }, []);

  const closeScanner = useCallback(() => {
    setScannerVisible(false);
  }, []);

  const addCardToBatch = useCallback((card: ScannedCard) => {
    setBatchCards((prev) => {
      // Check if card already in batch
      const existing = prev.find((c) => c.scryfallId === card.scryfallId);
      if (existing) {
        // Increment quantity
        return prev.map((c) =>
          c.scryfallId === card.scryfallId
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      // Add new card
      return [...prev, { ...card, quantity: 1 }];
    });
  }, []);

  const removeCardFromBatch = useCallback((cardId: string) => {
    setBatchCards((prev) => prev.filter((c) => c.id !== cardId));
  }, []);

  const clearBatch = useCallback(() => {
    setBatchCards([]);
  }, []);

  return {
    scannerVisible,
    batchCards,
    isAdding,
    openScanner,
    closeScanner,
    addCardToBatch,
    removeCardFromBatch,
    clearBatch,
    setIsAdding,
  };
}
