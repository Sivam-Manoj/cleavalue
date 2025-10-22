import { generateMixedDocx } from "./docx/mixedDocxBuilder.js";

/**
 * Universal DOCX generation service - uses mixedDocxBuilder for ALL modes
 * This builder has all modern enhancements:
 * - Hero image cover page
 * - Logo-only header
 * - Corporate footer with address, website, phone, appraiser
 * - Modern certificate design with highlighted value
 * - Valuation comparison table support
 * - Table of contents with all sections
 * - Multi-language support (en/fr/es)
 * - Handles all grouping modes: catalogue, combined, mixed, per_item, single_lot, per_photo
 */
export async function generateAssetDocxFromReport(
  reportData: any
): Promise<Buffer> {
  try {
    // Use unified mixedDocxBuilder for ALL modes - it has all modern enhancements
    return await generateMixedDocx(reportData);
  } catch (error) {
    console.error("Error generating Asset DOCX:", error);
    throw new Error("Failed to generate Asset DOCX report.");
  }
}
