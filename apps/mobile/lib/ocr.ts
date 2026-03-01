import TextRecognition from "@react-native-ml-kit/text-recognition";
import {
  base64ToUri,
  preprocessForOCR,
} from "./image-processing";

export interface OCRResult {
  cardName: string;
  collectorNumber?: string;
  setCode?: string;
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
 * Set code pattern: 3-4 uppercase letters only (e.g., MKM, DSK, WOE, PLST).
 * MTG set codes are always pure letters — excludes mixed alphanumeric like "M21" false positives.
 */
const SET_CODE_RE = /\b([A-Z]{3,4})\b/;
const SET_CODE_FALSE_POSITIVES = new Set([
  "THE", "AND", "FOR", "NOT", "ALL", "ARE", "BUT", "HAS", "ITS", "MAY",
  "USE", "YOU", "TEN", "TWO", "END", "PUT", "TAP", "ADD",
]);

/** Strip leading zeros: "035" → "35", but keep "0" as "0" */
function stripLeadingZeros(num: string): string {
  return num.replace(/^0+(?=\d)/, "");
}

/**
 * Extract collector number and set code from the bottom area of the card.
 * Collector number: bottom-left (e.g., "069/261" or "R 0035")
 * Set code: nearby line, separate from collector number (e.g., "WOT · EN")
 */
function pickCollectorInfo(lines: OCRLine[]): { collectorNumber?: string; setCode?: string } {
  const wizardsLine = lines.find(l => /wizards|coast/i.test(l.text));

  // Bottom area lines for collector number (left of copyright)
  let numCandidates: OCRLine[];
  if (wizardsLine) {
    const yTolerance = 60;
    numCandidates = lines.filter(l =>
      Math.abs(l.top - wizardsLine.top) < yTolerance &&
      l.left < wizardsLine.left
    );
  } else {
    numCandidates = [...lines].sort((a, b) => b.top - a.top).slice(0, 6);
  }

  // Broader bottom area for set code (can be anywhere at the bottom)
  const bottomLines = [...lines].sort((a, b) => b.top - a.top).slice(0, 8);

  let collectorNumber: string | undefined;
  let collectorLineIdx = -1;

  // Try slashed format first: "069/261"
  for (let i = 0; i < numCandidates.length; i++) {
    const slashed = numCandidates[i].text.match(/0*(\d{1,4})\s*\/\s*\d{1,4}/);
    if (slashed) {
      collectorNumber = stripLeadingZeros(slashed[1]);
      collectorLineIdx = i;
      break;
    }
  }

  // Fallback: bare number
  if (!collectorNumber) {
    for (let i = 0; i < numCandidates.length; i++) {
      const nums = numCandidates[i].text.match(/(\d{2,4})/);
      if (nums) {
        collectorNumber = stripLeadingZeros(nums[1]);
        collectorLineIdx = i;
        break;
      }
    }
  }

  // Look for set code on bottom lines that are NOT the collector number line
  // and NOT the copyright line
  let setCode: string | undefined;
  const collectorLine = collectorLineIdx >= 0 ? numCandidates[collectorLineIdx] : null;

  for (const line of bottomLines) {
    // Skip the line that had the collector number
    if (collectorLine && line.text === collectorLine.text && line.top === collectorLine.top) continue;
    // Skip copyright lines
    if (COPYRIGHT_RE.test(line.text)) continue;

    const setMatch = line.text.match(SET_CODE_RE);
    if (setMatch && !SET_CODE_FALSE_POSITIVES.has(setMatch[1])) {
      setCode = setMatch[1].toLowerCase();
      break;
    }
  }

  return { collectorNumber, setCode };
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
    const uri = base64ToUri(imageUri);
    const processedUri = await preprocessForOCR(uri);

    const result = await TextRecognition.recognize(processedUri);
    const lines = extractLines(result);

    if (!looksLikeMTGCard(lines)) {
      return { cardName: "", rawText: "" };
    }

    const cardName = pickCardNameLine(lines);
    const { collectorNumber, setCode } = pickCollectorInfo(lines);

    return {
      cardName,
      collectorNumber,
      setCode,
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
