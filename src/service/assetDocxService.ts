import { generateCatalogueDocx } from "./docx/catalogueDocxBuilder.js";
import { generateAssetLotsDocx, generatePerItemDocx } from "./docx/assetStandardDocxBuilder.js";

export async function generateAssetDocxFromReport(reportData: any): Promise<Buffer> {
  try {
    // High-fidelity DOCX builders for all modes
    const mode = String(reportData?.grouping_mode || "single_lot");
    if (mode === "catalogue") {
      return await generateCatalogueDocx(reportData);
    }
    if (mode === "per_item") {
      return await generatePerItemDocx(reportData);
    }
    // single_lot and per_photo fall back to asset lots layout
    return await generateAssetLotsDocx(reportData);
  } catch (error) {
    console.error("Error generating Asset DOCX:", error);
    throw new Error("Failed to generate Asset DOCX report.");
  }
}
