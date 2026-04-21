import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Register Thai-capable fonts for @react-pdf/renderer.
 *
 * Sarabun (SIL OFL, free) — supports Thai + Latin, looks formal/official
 * which is appropriate for Thai tax invoices, receipts, etc.
 *
 * Fonts live in `public/fonts/` so they ship with both dev and standalone
 * builds without needing any bundler config.
 *
 * Idempotent — safe to call from multiple modules.
 */

let registered = false;

export function registerPdfFonts() {
  if (registered) return;
  const fontsDir = path.join(process.cwd(), "public", "fonts");

  Font.register({
    family: "Sarabun",
    fonts: [
      { src: path.join(fontsDir, "Sarabun-Regular.ttf"), fontWeight: "normal" },
      { src: path.join(fontsDir, "Sarabun-Bold.ttf"), fontWeight: "bold" },
    ],
  });

  // @react-pdf breaks Thai word-wrapping by default — disable hyphenation
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}

export const PDF_FONT_FAMILY = "Sarabun";
