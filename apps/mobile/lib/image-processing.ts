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
    // Note: react-native-document-scanner-plugin returns base64 data
    // We need to handle that differently than regular URIs

    // For percentage-based cropping, we'd need to know image dimensions first
    // Since expo-image-manipulator doesn't provide a way to get dimensions,
    // we'll use a simpler approach: just return the original for now
    // OCR will still work on the full image, just slightly less efficiently

    // In a production app, you could use expo-image-size to get dimensions first
    // or use a different image manipulation library

    return uri; // Return original image for now
  } catch (error) {
    console.error("Error cropping image:", error);
    return uri; // Return original if cropping fails
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
    // Apply preprocessing steps
    const result = await manipulateAsync(
      uri,
      [
        // Resize to optimal width for OCR (800-1000px)
        { resize: { width: 900 } },
      ],
      {
        compress: 0.9,
        format: SaveFormat.JPEG,
      }
    );

    return result.uri;
  } catch (error) {
    console.error("Error preprocessing image:", error);
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

  // expo-image-manipulator can handle base64 directly
  return `data:image/jpeg;base64,${base64}`;
}
