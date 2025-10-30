/**
 * Generate Sample Mixed DOCX Report for Testing
 * 
 * Usage:
 *   npm run test:docx        (fast - no build required)
 *   npm run sample:docx      (production - with build)
 * 
 * This script generates a sample mixed-mode DOCX report in the ./reports directory.
 * 
 * Tests:
 * - Custom cover page (merged from coverPage.docx template)
 * - Headers with logo on all pages (except cover/certificate)
 * - Footers with page numbers and corporate info
 * - Certificate page with professional design
 * - Valuation comparison table with multiple methods
 * - Table of contents with proper page numbers
 * - All mixed report sections (Bundle, Per Item, Per Photo)
 * - Factors Affecting Value section with custom text
 * 
 * Technical Approach:
 * Uses PizZip for OOXML-level manipulation to prepend the custom cover page
 * while preserving all headers/footers in the main document. This avoids the
 * header/footer corruption issues present in docx-merger library.
 * 
 * Cover page: NO headers/footers (clean design)
 * Main document: YES headers/footers (preserved perfectly)
 */

import { generateAssetDocxFromReport } from "../service/assetDocxService.js";
import fs from "fs/promises";
import path from "path";

async function main() {
  console.log("🚀 Generating sample DOCX reports...\n");
  const imagePath = path.resolve(process.cwd(), "public/icon.png");
  let imgDataUrl: string | undefined;
  try {
    const img = await fs.readFile(imagePath);
    const base64 = img.toString("base64");
    imgDataUrl = `data:image/png;base64,${base64}`;
  } catch (e) {
    console.warn("Sample image not found at", imagePath, e);
  }

  const now = new Date();
  const mixedSample: any = {
    title: "Sample Mixed Report",
    grouping_mode: "mixed",
    createdAt: now.toISOString(),
    client_name: "Acme Corp",
    owner_name: "John Smith",
    appraisal_purpose: "Internal Valuation & Insurance",
    effective_date: now.toISOString(),
    appraiser: "Jane Doe",
    inspector_name: "Jane Doe",
    user_email: "jane.doe@mcdougallauction.com",
    appraisal_company: "McDougall Auctioneers",
    industry: "Construction & Manufacturing",
    language: "en",
    currency: "CAD",
    contract_no: "CV-2025-001",
    inspection_date: now.toISOString(),
    prepared_for: "Acme Corp - John Smith",
    analysis: { 
      summary: "This is a sample generated mixed-mode report for testing purposes.", 
      total_value: "$123,456 CAD" 
    },
    total_appraised_value: "$123,456 CAD",
    // Test valuation comparison table with multiple methods
    include_valuation_table: true,
    valuation_methods: ["FML", "OLV", "FLV"],
    imageUrls: imgDataUrl ? [imgDataUrl, imgDataUrl] : [],
    // Test Factors Affecting Value fields
    factors_age_condition: "The assets are in good to excellent condition with regular maintenance records available.",
    factors_quality: "High-quality industrial equipment from recognized manufacturers including Caterpillar and John Deere.",
    factors_analysis: "Market demand for this type of equipment remains strong. Values reflect current market conditions and comparable sales data.",
    // Mixed lots with different modes
    lots: [
      {
        lot_id: "MX-001",
        title: "Warehouse Equipment Bundle",
        mode: "single_lot",
        description: "Complete warehouse equipment package including forklift, pallet jacks, and shelving systems.",
        condition: "Good",
        estimated_value: "$45,000",
        image_urls: imgDataUrl ? [imgDataUrl] : [],
        tags: ["warehouse", "bundle"],
      },
      {
        lot_id: "MX-002",
        title: "Manufacturing Tools - Per Item",
        mode: "per_item",
        description: "Individual manufacturing tools and equipment.",
        condition: "Excellent",
        estimated_value: "$32,000",
        image_urls: imgDataUrl ? [imgDataUrl] : [],
        items: [
          {
            title: "CNC Milling Machine",
            serial_no_or_label: "CNC-2024-X1",
            description: "5-axis CNC milling machine",
            details: "Siemens control, automatic tool changer, 20HP spindle",
            estimated_value: "$18,000",
            image_url: imgDataUrl,
          },
          {
            title: "Hydraulic Press",
            serial_no_or_label: "HP-8800",
            description: "100-ton hydraulic press",
            details: "Electric/hydraulic, includes safety guards and tooling",
            estimated_value: "$14,000",
            image_url: imgDataUrl,
          },
        ],
      },
      {
        lot_id: "MX-003",
        title: "Office Equipment - Per Photo",
        mode: "per_photo",
        description: "Various office equipment and furniture.",
        condition: "Fair",
        estimated_value: "$8,500",
        image_urls: imgDataUrl ? [imgDataUrl, imgDataUrl] : [],
      },
    ],
  };

  console.log("📄 Generating Mixed Report with Valuation Table...");
  const buffer = await generateAssetDocxFromReport(mixedSample);
  const reportsDir = path.resolve(process.cwd(), "reports");
  await fs.mkdir(reportsDir, { recursive: true });
  const filenameSafeDate = now.toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(reportsDir, `sample-mixed-${filenameSafeDate}.docx`);
  await fs.writeFile(outPath, buffer);
  console.log("✅ Mixed Report:", outPath);
  
  console.log("\n🎉 Sample report generated successfully!");
  console.log("📂 Check the ./reports directory");
  console.log("\n📋 Report includes:");
  console.log("   ✅ Custom cover page (merged from coverPage.docx)");
  console.log("   ✅ Headers with logo on all pages (except cover/cert)");
  console.log("   ✅ Footers with page numbers");
  console.log("   ✅ Certificate of Appraisal");
  console.log("   ✅ Valuation Comparison Table (FML, OLV, FLV)");
  console.log("   ✅ Transmittal Letter");
  console.log("   ✅ Table of Contents");
  console.log("   ✅ Factors Affecting Value section");
  console.log("   ✅ Mixed lot results (Bundle, Per Item, Per Photo)");
  console.log("\n💡 Using @scholarcy/docx-merger to preserve styles, tables, and images.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
