import TextRecognition from "@react-native-ml-kit/text-recognition";
import {
  base64ToUri,
  cropToCardName,
  cropToSetCode,
  preprocessForOCR,
} from "./image-processing";

export interface OCRResult {
  cardName: string;
  setCode?: string;
  collectorNumber?: string;
  rawText: string;
}

export interface SetInfo {
  setCode?: string;
  collectorNumber?: string;
}

/**
 * Clean OCR text to fix common errors
 * @param raw - Raw OCR text
 * @returns Cleaned text
 */
export function cleanOCRText(raw: string): string {
  return (
    raw
      // Remove extra whitespace
      .replace(/\s+/g, " ")
      .trim()
      // Fix common OCR errors
      .replace(/\|/g, "I") // Pipe to I
      // Note: Only replace 0 with O in card names if it looks wrong
      // Same with 1 to l - context dependent
      // Keep numbers as-is for now, can refine later
  );
}

/**
 * Parse set information from OCR text
 * Format: "MH3 042" or "M10•146"
 * @param ocrText - Raw OCR text from set code region
 * @returns Set code and collector number
 */
export function parseSetInfo(ocrText: string): SetInfo {
  // Clean the text
  const cleaned = ocrText.replace(/[•·]/g, " ").trim();

  // Match pattern: 3-4 letters/numbers + space + numbers
  const match = cleaned.match(/([A-Z0-9]{2,5})\s+(\d+)/i);

  if (match) {
    return {
      setCode: match[1].toUpperCase(),
      collectorNumber: match[2],
    };
  }

  // Try alternate format without space: "MH3042"
  const compactMatch = cleaned.match(/([A-Z]{2,4})(\d{1,4})/i);
  if (compactMatch) {
    return {
      setCode: compactMatch[1].toUpperCase(),
      collectorNumber: compactMatch[2],
    };
  }

  return {};
}

/**
 * Extract card name from image using OCR
 * @param imageUri - Image URI or base64
 * @returns Card name
 */
export async function extractCardName(imageUri: string): Promise<string> {
  try {
    // Convert base64 to URI if needed
    const uri = base64ToUri(imageUri);

    // Crop to card name region (top 20%)
    const croppedUri = await cropToCardName(uri);

    // Preprocess for better OCR
    const processedUri = await preprocessForOCR(croppedUri);

    // Run OCR
    const result = await TextRecognition.recognize(processedUri);

    // Extract and clean text
    const rawText = result.text;
    const cleaned = cleanOCRText(rawText);

    // Card name is usually on the first line
    const lines = cleaned.split("\n");
    const cardName = lines[0] || cleaned;

    return cardName;
  } catch (error) {
    console.error("Error extracting card name:", error);
    return "";
  }
}

/**
 * Extract set code and collector number from image
 * @param imageUri - Image URI or base64
 * @returns Set information
 */
export async function extractSetInfo(imageUri: string): Promise<SetInfo> {
  try {
    // Convert base64 to URI if needed
    const uri = base64ToUri(imageUri);

    // Crop to set code region (bottom right)
    const croppedUri = await cropToSetCode(uri);

    // Preprocess for better OCR
    const processedUri = await preprocessForOCR(croppedUri);

    // Run OCR
    const result = await TextRecognition.recognize(processedUri);

    // Parse set info from text
    return parseSetInfo(result.text);
  } catch (error) {
    console.error("Error extracting set info:", error);
    return {};
  }
}

/**
 * Perform full OCR on a card image
 * Extracts card name, set code, and collector number
 * @param imageUri - Image URI or base64
 * @returns Complete OCR result
 */
export async function recognizeCard(imageUri: string): Promise<OCRResult> {
  try {
    // Run both extractions in parallel
    const [cardName, setInfo] = await Promise.all([
      extractCardName(imageUri),
      extractSetInfo(imageUri),
    ]);

    return {
      cardName,
      setCode: setInfo.setCode,
      collectorNumber: setInfo.collectorNumber,
      rawText: `${cardName} ${setInfo.setCode || ""} ${setInfo.collectorNumber || ""}`,
    };
  } catch (error) {
    console.error("Error recognizing card:", error);
    return {
      cardName: "",
      rawText: "",
    };
  }
}
