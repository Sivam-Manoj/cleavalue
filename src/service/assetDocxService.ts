import { generateMixedDocx } from "./docx/mixedDocxBuilder.js";
import { createSimpleHeadingDocx } from "./docx/builders/utils.js";
import axios from "axios";

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
    const baseBuffer = await generateMixedDocx(reportData);

    // Attempt to append user's CV .docx (if available)
    const cvUrl: string | undefined =
      typeof reportData?.user_cv_url === "string" && reportData.user_cv_url
        ? String(reportData.user_cv_url)
        : undefined;
    if (!cvUrl) return baseBuffer;

    try {
      const resp = await axios.get<ArrayBuffer>(cvUrl, {
        responseType: "arraybuffer",
      });
      const cvBuffer = Buffer.from(resp.data as any);
      if (!cvBuffer || cvBuffer.length === 0) return baseBuffer;

      // Create a divider page with "Appraiser CV" heading
      const dividerBuffer = await createSimpleHeadingDocx("Appraiser CV");

      // Try dynamic import of a merger; gracefully fallback if unavailable
      try {
        const mergerModuleName = "docx-merger";
        const mod: any = await (import(mergerModuleName) as Promise<any>).catch(
          () => null
        );
        const DocxMerger = mod?.default || mod;
        if (!DocxMerger) return baseBuffer;

        const merger = new DocxMerger({}, [baseBuffer, dividerBuffer, cvBuffer]);
        const merged: Buffer = await new Promise((resolve) => {
          (merger as any).save("nodebuffer", (data: Buffer) => resolve(data));
        });
        return merged || baseBuffer;
      } catch (e) {
        console.warn("CV merge library not available, skipping CV append.");
        return baseBuffer;
      }
    } catch (err) {
      console.warn("Failed to fetch or append CV docx:", err);
      return baseBuffer;
    }
  } catch (error) {
    console.error("Error generating Asset DOCX:", error);
    throw new Error("Failed to generate Asset DOCX report.");
  }
}
