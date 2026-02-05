import { createContext, useContext, type ReactNode } from "react";

// Standard MTG card aspect ratio: 63mm x 88mm = 0.716
const CARD_ASPECT_RATIO = 63 / 88;

export interface CardDimensions {
  width: number;
  height: number;
}

interface CardDimensionsContextValue {
  dimensions: CardDimensions | null;
}

const CardDimensionsContext = createContext<CardDimensionsContextValue>({
  dimensions: null,
});

interface CardDimensionsProviderProps {
  dimensions: CardDimensions | null;
  children: ReactNode;
}

export function CardDimensionsProvider({
  dimensions,
  children,
}: CardDimensionsProviderProps) {
  return (
    <CardDimensionsContext.Provider value={{ dimensions }}>
      {children}
    </CardDimensionsContext.Provider>
  );
}

export function useCardDimensions(): CardDimensions | null {
  const { dimensions } = useContext(CardDimensionsContext);
  return dimensions;
}

/**
 * Calculate card dimensions based on available height for 3 rows.
 * @param availableHeight The total height available for the player board
 * @param rowPadding Padding between rows (default 8px total)
 * @param edgePadding Vertical padding at top/bottom edges (default 8px total)
 * @returns CardDimensions with width and height
 */
export function calculateCardDimensions(
  availableHeight: number,
  rowPadding = 16,
  edgePadding = 24
): CardDimensions {
  // 3 rows with padding between them and edge padding
  const cardHeight = Math.floor((availableHeight - rowPadding - edgePadding) / 3);
  const cardWidth = Math.floor(cardHeight * CARD_ASPECT_RATIO);

  return { width: cardWidth, height: cardHeight };
}
