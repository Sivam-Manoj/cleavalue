import { generateAssetDocxFromReport } from "../service/assetDocxService.js";
import fs from "fs/promises";
import path from "path";

async function main() {
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
  const sample: any = {
    title: "Sample Asset Report",
    grouping_mode: "asset",
    createdAt: now.toISOString(),
    client_name: "Acme Corp",
    owner_name: "Acme Corp",
    appraisal_purpose: "Internal Valuation",
    effective_date: now.toISOString(),
    appraiser: "Jane Doe",
    appraisal_company: "ClearValue",
    analysis: { summary: "This is a sample generated report.", total_value: "$123,456" },
    total_appraised_value: "$123,456",
    imageUrls: imgDataUrl ? [imgDataUrl] : [],
    lots: [
      {
        lot_id: "L-001",
        title: "Forklift Model X",
        description: "Electric forklift in good condition.",
        condition: "Good",
        estimated_value: "$25,000",
        image_urls: imgDataUrl ? [imgDataUrl] : [],
        tags: ["warehouse", "vehicle"],
      },
      {
        lot_id: "L-002",
        title: "Conveyor System",
        description: "Belt conveyor with 10m length.",
        condition: "Fair",
        estimated_value: "$15,000",
        image_urls: imgDataUrl ? [imgDataUrl] : [],
      },
    ],
  };

  const buffer = await generateAssetDocxFromReport(sample);
  const reportsDir = path.resolve(process.cwd(), "reports");
  await fs.mkdir(reportsDir, { recursive: true });
  const filenameSafeDate = now.toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(reportsDir, `sample-asset-${filenameSafeDate}.docx`);
  await fs.writeFile(outPath, buffer);
  console.log("Sample DOCX written to", outPath);

  // Generate catalogue grouping sample
  const catalogueSample: any = {
    ...sample,
    title: "Sample Catalogue Report",
    grouping_mode: "catalogue",
    lots: [
      {
        lot_id: "CAT-001",
        title: "Machinery Lot",
        description: "Assorted industrial machinery.",
        condition: "Good",
        estimated_value: "$40,000",
        image_urls: imgDataUrl ? [imgDataUrl] : [],
        items: [
          {
            title: "Lathe Machine",
            sn_vin: "LAT-9988",
            description: "Precision lathe, lightly used.",
            details: "3-phase, includes tooling kit.",
            estimated_value: "$22,000",
            image_url: imgDataUrl,
          },
          {
            title: "Drill Press",
            sn_vin: "DRL-5521",
            description: "Floor-standing drill press.",
            details: "12-speed, includes safety guard.",
            estimated_value: "$3,500",
            image_url: imgDataUrl,
          },
        ],
      },
    ],
  };
  const catalogueBuf = await generateAssetDocxFromReport(catalogueSample);
  const catPath = path.join(reportsDir, `sample-catalogue-${filenameSafeDate}.docx`);
  await fs.writeFile(catPath, catalogueBuf);
  console.log("Sample DOCX written to", catPath);

  // Generate per_item grouping sample
  const perItemSample: any = {
    ...sample,
    title: "Sample Per-Item Report",
    grouping_mode: "per_item",
    lots: [
      {
        lot_id: "ITM-001",
        title: "Dell Latitude Laptop",
        serial_no_or_label: "SN-ABC12345",
        description: "14\" business laptop.",
        details: "i7, 16GB RAM, 512GB SSD",
        estimated_value: "$1,200",
        image_url: imgDataUrl,
      },
      {
        lot_id: "ITM-002",
        title: "Barcode Scanner",
        serial_no_or_label: "BC-7788",
        description: "Handheld barcode scanner.",
        details: "USB-C, includes stand.",
        estimated_value: "$250",
        image_url: imgDataUrl,
      },
    ],
  };
  const perItemBuf = await generateAssetDocxFromReport(perItemSample);
  const perItemPath = path.join(reportsDir, `sample-per_item-${filenameSafeDate}.docx`);
  await fs.writeFile(perItemPath, perItemBuf);
  console.log("Sample DOCX written to", perItemPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
