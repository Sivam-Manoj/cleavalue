import { generateHTMLDocx } from "./docx/htmlDocxBuilder.js";
// import { generateMixedDocx } from "./docx/mixedDocxBuilder.js"; // OLD - kept as backup

/**
 * Universal DOCX generation service - NOW USES HTML-TO-DOCX!
 * This builder has AMAZING modern enhancements:
 * - Hero image cover page with gradient background
 * - Stunning certificate with gold borders and yellow gradient value box
 * - Modern CSS styling: gradients, shadows, rounded corners
 * - Professional color palette throughout
 * - Table of contents with all sections
 * - Multi-language support (en/fr/es)
 * - Clean, maintainable HTML/CSS code (400 lines vs 1500+)
 * - All report sections beautifully styled
 * - Valuation comparison table support
 * - Handles all grouping modes: catalogue, combined, mixed, per_item, single_lot, per_photo
 */
export async function generateAssetDocxFromReport(
  reportData: any
): Promise<Buffer> {
  try {
    // NEW: Use HTML-based DOCX builder with amazing styling
    return await generateHTMLDocx(reportData);
    
    // OLD: If you want to switch back, uncomment below:
    // return await generateMixedDocx(reportData);
  } catch (error) {
    console.error("Error generating Asset DOCX:", error);
    throw new Error("Failed to generate Asset DOCX report.");
  }
}
