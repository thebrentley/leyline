import TextRecognition from "@react-native-ml-kit/text-recognition";
import {
  base64ToUri,
  preprocessForOCR,
} from "./image-processing";

export interface OCRResult {
  cardName: string;
  collectorNumber?: string;
  rawText: string;
}

/** OCR line with spatial data from ML Kit */
interface OCRLine {
  text: string;
  top: number;
  left: number;
}

function cleanLine(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\|/g, "I");
}

/**
 * Extract OCR lines with frame data from ML Kit result, sorted top→bottom.
 */
function extractLines(result: { blocks?: any[] }): OCRLine[] {
  const lines: OCRLine[] = [];
  for (const block of result.blocks ?? []) {
    for (const line of block.lines ?? []) {
      const cleaned = cleanLine(line.text);
      if (cleaned.length > 0) {
        const frame = line.frame ?? block.frame ?? {};
        lines.push({
          text: cleaned,
          top: frame.top ?? 0,
          left: frame.left ?? 0,
        });
      }
    }
  }
  lines.sort((a, b) => a.top - b.top);
  return lines;
}

// --- Card name extraction heuristics ---

const TYPE_LINE_RE = /^(Creature|Instant|Sorcery|Enchantment|Artifact|Land|Planeswalker|Battle|Legendary|Tribal|Snow|Basic|Kindred)/i;
const KEYWORD_RE = /^(Flying|Trample|Haste|Vigilance|Deathtouch|Lifelink|Reach|First strike|Double strike|Hexproof|Indestructible|Menace|Ward|Flash|Defender|Prowess|Protection|Equip|Cycling|Kicker|Cascade|Convoke|Delve|Affinity|Crew|Ninjutsu)/i;
const RULES_RE = /^(When |Whenever |At the |If |Pay |You |Each |Target |Exile |Return |Destroy |Deal |Draw |Discard|Search |Sacrifice |Create |Counter |Put |Tap |Untap |Choose |Look at |Reveal |Mill |Scry |Surveil |This |That |It |As |For each|At end)/i;
const SHORT_CODE_RE = /^[A-Z0-9]{2,5}$/;
const PT_RE = /^\d+\s*\/\s*\d+$/;
const COPYRIGHT_RE = /wizards|coast|©|\u00a9/i;
const MANA_RE = /^\{.*\}$/;
const JUST_NUMBERS_RE = /^\d{1,4}$/;

function isCardNameCandidate(text: string): boolean {
  if (text.length < 3 || text.length > 50) return false;
  if (SHORT_CODE_RE.test(text)) return false;
  if (PT_RE.test(text)) return false;
  if (JUST_NUMBERS_RE.test(text)) return false;
  if (MANA_RE.test(text)) return false;
  if (TYPE_LINE_RE.test(text)) return false;
  if (KEYWORD_RE.test(text)) return false;
  if (RULES_RE.test(text)) return false;
  if (COPYRIGHT_RE.test(text) && text.length > 20) return false;
  return true;
}

function pickCardNameLine(lines: OCRLine[]): string {
  const candidates = lines.slice(0, 10);
  for (const line of candidates) {
    if (isCardNameCandidate(line.text)) {
      return line.text;
    }
  }
  return candidates.find(l => l.text.length >= 3)?.text || "";
}

/**
 * Extract collector number from the bottom-left area of the card.
 * Uses "Wizards" / "Coast" text as a spatial anchor for the bottom-right,
 * then looks for numbers to its left at similar Y.
 */
function pickCollectorNumber(lines: OCRLine[]): string | undefined {
  const wizardsLine = lines.find(l => /wizards|coast/i.test(l.text));

  // Lines to search: bottom-left candidates if we have the anchor, otherwise bottom lines
  let candidates: OCRLine[];
  if (wizardsLine) {
    const yTolerance = 60;
    candidates = lines.filter(l =>
      Math.abs(l.top - wizardsLine.top) < yTolerance &&
      l.left < wizardsLine.left
    );
  } else {
    // Fallback: bottom 6 lines
    candidates = [...lines].sort((a, b) => b.top - a.top).slice(0, 6);
  }

  for (const line of candidates) {
    // "069/261" or "069/261 R"
    const slashed = line.text.match(/0*(\d{1,4})\s*\/\s*\d{1,4}/);
    if (slashed) return slashed[1];
  }

  // Fallback: grab first bare number sequence from candidates
  for (const line of candidates) {
    const nums = line.text.match(/(\d{2,4})/);
    if (nums) return nums[1];
  }

  return undefined;
}

/**
 * Check whether the OCR output looks like it came from a real MTG card.
 * Requires copyright text + at least one other MTG structural signal.
 */
function looksLikeMTGCard(lines: OCRLine[]): boolean {
  const allText = lines.map(l => l.text).join(" ");

  // Gate 1: Must find Wizards of the Coast copyright text
  const hasCopyright = /wizards|coast/i.test(allText);
  if (!hasCopyright) return false;

  // Gate 2: Need at least one more structural signal
  const hasTypeLine = lines.some(l => TYPE_LINE_RE.test(l.text));
  const hasCollectorNum = lines.some(l => /\d{1,4}\s*\/\s*\d{1,4}/.test(l.text));
  const hasEnoughLines = lines.length >= 6;

  return hasTypeLine || hasCollectorNum || hasEnoughLines;
}

/**
 * Perform full OCR on a card image.
 * Single OCR pass — extracts card name and collector number.
 * Returns empty result if the image doesn't look like an MTG card.
 */
export async function recognizeCard(imageUri: string): Promise<OCRResult> {
  try {
    console.log("[CardScan:OCR] recognizeCard starting...");
    const startTime = Date.now();

    const uri = base64ToUri(imageUri);
    const processedUri = await preprocessForOCR(uri);

    const result = await TextRecognition.recognize(processedUri);
    const lines = extractLines(result);

    console.log("[CardScan:OCR] OCR lines (top→bottom):", lines.slice(0, 8).map(l =>
      `"${l.text}" (x=${Math.round(l.left)}, y=${Math.round(l.top)})`
    ));

    if (!looksLikeMTGCard(lines)) {
      const elapsed = Date.now() - startTime;
      console.log(`[CardScan:OCR] rejected — not an MTG card (${elapsed}ms, ${lines.length} lines)`);
      return { cardName: "", rawText: "" };
    }

    const cardName = pickCardNameLine(lines);
    const collectorNumber = pickCollectorNumber(lines);

    const elapsed = Date.now() - startTime;
    console.log(`[CardScan:OCR] recognizeCard complete in ${elapsed}ms:`, { cardName, collectorNumber });

    return {
      cardName,
      collectorNumber,
      rawText: cardName,
    };
  } catch (error: any) {
    console.error("[CardScan:OCR] recognizeCard ERROR:", error?.message || error);
    return {
      cardName: "",
      rawText: "",
    };
  }
}
