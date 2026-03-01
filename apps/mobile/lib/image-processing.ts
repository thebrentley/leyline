import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

export interface CropRegion {
  originX?: number; // 0-1, percentage from left
  originY?: number; // 0-1, percentage from top
  width?: number; // 0-1, percentage of total width
  height?: number; // 0-1, percentage of total height
}

/**
 * Crop an image to a specific region
 * @param uri - Image URI
 * @param region - Region to crop (in percentages 0-1)
 * @returns Cropped image URI
 */
export async function cropImage(
  uri: string,
  region: CropRegion
): Promise<string> {
  try {
    // WARNING: Cropping is NOT implemented — returning full image.
    // OCR runs on the entire camera frame, which may pick up noise.
    console.warn("[CardScan:IMG] cropImage is a NO-OP — returning original image. Region requested:", region);
    return uri;
  } catch (error: any) {
    console.error("[CardScan:IMG] cropImage error:", error?.message || error);
    return uri;
  }
}

/**
 * Crop image to card name region (top 20% of card)
 * @param uri - Image URI
 * @returns Cropped image URI focused on card name
 */
export async function cropToCardName(uri: string): Promise<string> {
  return cropImage(uri, {
    originX: 0,
    originY: 0,
    width: 1,
    height: 0.2,
  });
}

/**
 * Crop image to set code region (bottom right of card)
 * @param uri - Image URI
 * @returns Cropped image URI focused on set code
 */
export async function cropToSetCode(uri: string): Promise<string> {
  return cropImage(uri, {
    originX: 0.5,
    originY: 0.92,
    width: 0.5,
    height: 0.08,
  });
}

/**
 * Preprocess image for better OCR accuracy
 * @param uri - Image URI
 * @returns Preprocessed image URI
 */
export async function preprocessForOCR(uri: string): Promise<string> {
  try {
    const result = await manipulateAsync(
      uri,
      [
        { resize: { width: 640 } },
      ],
      {
        compress: 0.7,
        format: SaveFormat.JPEG,
      }
    );

    return result.uri;
  } catch (error: any) {
    console.error("[CardScan:IMG] preprocessForOCR ERROR:", error?.message || error);
    return uri;
  }
}

/**
 * Convert base64 to URI for image manipulation
 * @param base64 - Base64 encoded image
 * @returns File URI
 */
export function base64ToUri(base64: string): string {
  // If it's already a URI, return it
  if (base64.startsWith("file://") || base64.startsWith("http")) {
    return base64;
  }

  if (base64.startsWith("data:")) {
    return base64;
  }

  return `data:image/jpeg;base64,${base64}`;
}
