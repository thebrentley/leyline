import sharp from "sharp";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, "../assets");

// Leyline "L" mark - path drawn directly at 1024-scale coordinates
// Original path: M30 60 L30 25 Q30 15 40 15 L55 15 (in 80x80 viewBox)
// Centered in 1024x1024: offset by (-42.5,-37.5), scale 11x, translate to (512,512)
const PATH = "M374.5 759.5 L374.5 374.5 Q374.5 264.5 484.5 264.5 L649.5 264.5";
const STROKE_W = 66;

// Build smooth glow with many thin layers instead of few thick ones
function glowLayers() {
  const layers = [];
  const steps = 20;
  const maxExtra = 90; // max extra width beyond main stroke
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1); // 0 (outermost) to 1 (innermost)
    const extra = maxExtra * (1 - t);
    const opacity = 0.02 + 0.12 * t * t; // quadratic ramp: faint outside, brighter inside
    const w = STROKE_W + extra;
    layers.push(
      `<path d="${PATH}" fill="none" stroke="#9378F0" stroke-width="${w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity.toFixed(3)}" />`
    );
  }
  return layers.join("\n  ");
}

// Feature graphic glow layers — scaled & repositioned for 1024x500 landscape
function featureGlowLayers() {
  const layers = [];
  const steps = 20;
  const maxExtra = 50;
  const featurePath = "M200 390 L200 215 Q200 155 260 155 L350 155";
  const strokeW = 36;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const extra = maxExtra * (1 - t);
    const opacity = 0.02 + 0.12 * t * t;
    const w = strokeW + extra;
    layers.push(
      `<path d="${featurePath}" fill="none" stroke="#9378F0" stroke-width="${w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity.toFixed(3)}" />`
    );
  }
  return layers.join("\n  ");
}

function makeFeatureGraphicSvg() {
  const featurePath = "M200 390 L200 215 Q200 155 260 155 L350 155";
  return `
<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6" />
      <stop offset="50%" stop-color="#A78BFA" />
      <stop offset="100%" stop-color="#C4B5FD" />
    </linearGradient>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
    <linearGradient id="text-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#A78BFA" />
      <stop offset="100%" stop-color="#C4B5FD" />
    </linearGradient>
  </defs>

  <rect width="1024" height="500" fill="url(#bg-grad)" />

  <!-- L mark glow -->
  ${featureGlowLayers()}

  <!-- L mark -->
  <path d="${featurePath}" fill="none" stroke="url(#grad)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" />

  <!-- App name -->
  <text x="430" y="290" font-family="sans-serif" font-size="96" font-weight="300" fill="url(#text-grad)" letter-spacing="8">Leyline</text>
</svg>
`;
}

function makeSvg({ bg }) {
  return `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6" />
      <stop offset="50%" stop-color="#A78BFA" />
      <stop offset="100%" stop-color="#C4B5FD" />
    </linearGradient>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
  </defs>

  ${bg ? '<rect width="1024" height="1024" fill="url(#bg-grad)" />' : ""}

  <!-- Smooth glow (${20} layers) -->
  ${glowLayers()}

  <!-- Main stroke -->
  <path d="${PATH}" fill="none" stroke="url(#grad)" stroke-width="${STROKE_W}" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`;
}

async function generate() {
  // App icon (1024x1024, dark bg, no transparency)
  await sharp(Buffer.from(makeSvg({ bg: true })))
    .resize(1024, 1024)
    .png()
    .toFile(resolve(assetsDir, "icon.png"));
  console.log("Generated icon.png (1024x1024)");

  // Splash icon (transparent bg)
  await sharp(Buffer.from(makeSvg({ bg: false })))
    .resize(200, 200)
    .png()
    .toFile(resolve(assetsDir, "splash-icon.png"));
  console.log("Generated splash-icon.png (200x200)");

  // Android adaptive icon foreground (transparent bg)
  await sharp(Buffer.from(makeSvg({ bg: false })))
    .resize(1024, 1024)
    .png()
    .toFile(resolve(assetsDir, "adaptive-icon.png"));
  console.log("Generated adaptive-icon.png (1024x1024)");

  // Google Play feature graphic (1024x500, no transparency)
  await sharp(Buffer.from(makeFeatureGraphicSvg()))
    .flatten({ background: "#0f172a" })
    .png()
    .toFile(resolve(assetsDir, "play-store-feature-graphic.png"));
  console.log("Generated play-store-feature-graphic.png (1024x500)");

  // Google Play Store icon (512x512, dark bg, no transparency)
  await sharp(Buffer.from(makeSvg({ bg: true })))
    .resize(512, 512)
    .flatten({ background: "#0f172a" })
    .png()
    .toFile(resolve(assetsDir, "play-store-icon-512.png"));
  console.log("Generated play-store-icon-512.png (512x512)");

  // Favicon for web
  await sharp(Buffer.from(makeSvg({ bg: true })))
    .resize(48, 48)
    .png()
    .toFile(resolve(assetsDir, "../public/favicon.png"));
  console.log("Generated favicon.png (48x48)");
}

generate().catch(console.error);
