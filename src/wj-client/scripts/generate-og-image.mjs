/**
 * Generates public/og-image.png from public/og-image.svg.
 *
 * Run: node scripts/generate-og-image.mjs
 *
 * Requires: @resvg/resvg-js (npm install -D @resvg/resvg-js)
 * Fallback: if unavailable, use sharp with SVG input.
 *
 * Output: public/og-image.png — 1200x630px, ≤300KB
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

async function generatePng() {
  const svgPath = join(publicDir, "og-image.svg");
  const pngPath = join(publicDir, "og-image.png");

  const svgContent = readFileSync(svgPath);

  try {
    // Try @resvg/resvg-js first (best SVG fidelity)
    const { Resvg } = await import("@resvg/resvg-js");
    const resvg = new Resvg(svgContent, {
      fitTo: { mode: "width", value: 1200 },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    writeFileSync(pngPath, pngBuffer);
    console.log(`Generated og-image.png (${pngBuffer.length} bytes) via resvg`);
  } catch {
    // Fallback to sharp
    const sharp = (await import("sharp")).default;
    await sharp(svgContent)
      .resize(1200, 630)
      .png({ compressionLevel: 9, quality: 85 })
      .toFile(pngPath);
    const { statSync } = await import("fs");
    const size = statSync(pngPath).size;
    console.log(`Generated og-image.png (${size} bytes) via sharp`);
  }
}

generatePng().catch((err) => {
  console.error("Failed to generate og-image.png:", err);
  process.exit(1);
});
