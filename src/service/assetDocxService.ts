import { generateMixedDocx } from "./docx/mixedDocxBuilder.js";
import { createSimpleHeadingDocx } from "./docx/builders/utils.js";
import DocxMerger from "docx-merger";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import axios from "axios";
import fs from "fs/promises";
import path from "path";

/**
 * Production-ready DOCX generation service
 * 
 * Flow:
 * 1. Generate custom cover page from template (public/coverPage.docx)
 * 2. Generate main report content (using mixedDocxBuilder)
 * 3. Fetch appraiser CV (if available)
 * 4. Merge all documents: Cover -> Main Report -> CV Divider -> CV
 * 
 * Features:
 * - Always merges custom cover page
 * - Preserves headers/footers in main document
 * - Appends appraiser CV at the end
 * - Uses docx-merger for reliable merging
 */
export async function generateAssetDocxFromReport(
  reportData: any
): Promise<Buffer> {
  try {
    console.log("📄 [AssetDOCX] Starting NEW report generation with custom cover + CV...");
    
    // Step 1: Generate custom cover page from template
    console.log("📄 [AssetDOCX] Step 1: Generating custom cover page...");
    const coverBuffer = await generateCoverPage(reportData);
    console.log(`✅ [AssetDOCX] Cover page generated (${coverBuffer.length} bytes)`);

    // Step 2: Generate main report content (without built-in cover)
    console.log("📄 [AssetDOCX] Step 2: Generating main report content...");
    const mainBuffer = await generateMixedDocx({
      ...reportData,
      custom_cover: true, // Skip built-in cover since we're merging our own
    });
    console.log(`✅ [AssetDOCX] Main report generated (${mainBuffer.length} bytes)`);

    // Step 3: Fetch appraiser CV (if available)
    console.log("📄 [AssetDOCX] Step 3: Fetching appraiser CV...");
    const cvBuffer = await fetchAppraiserCV(reportData.user_cv_url);
    if (cvBuffer) {
      console.log(`✅ [AssetDOCX] CV fetched (${cvBuffer.length} bytes)`);
    } else {
      console.log("⚠️  [AssetDOCX] No CV available - continuing without CV");
    }

    // Step 4: Merge all documents
    console.log("📄 [AssetDOCX] Step 4: Merging documents...");
    const finalBuffer = await mergeDocuments(coverBuffer, mainBuffer, cvBuffer);
    console.log(`✅ [AssetDOCX] Final merged document (${finalBuffer.length} bytes)`);
    console.log("🎉 [AssetDOCX] NEW style report generation completed successfully!");

    return finalBuffer;
  } catch (error) {
    console.error("❌ [AssetDOCX] Error generating Asset DOCX:", error);
    throw new Error("Failed to generate Asset DOCX report.");
  }
}

/**
 * Generate custom cover page from template
 */
async function generateCoverPage(reportData: any): Promise<Buffer> {
  try {
    const templatePath = path.resolve(process.cwd(), "public/coverPage.docx");
    const templateBuffer = await fs.readFile(templatePath);

    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Prepare template data
    const preparedFor = reportData.prepared_for || reportData.client_name || "";
    const reportDate = formatReportDate(
      reportData.effective_date || reportData.createdAt
    );
    const userEmail = reportData.user_email || "";

    // Render template with data
    doc.render({ preparedFor, reportDate, userEmail });

    // Generate buffer
    const buffer = doc.toBuffer
      ? doc.toBuffer()
      : Buffer.from(doc.getZip().generate({ type: "nodebuffer" }));

    console.log("✅ Custom cover page generated");
    return buffer;
  } catch (error) {
    console.error("❌ Cover page generation failed:", error);
    throw new Error("Failed to generate cover page. Ensure public/coverPage.docx exists.");
  }
}

/**
 * Fetch appraiser CV from URL
 */
async function fetchAppraiserCV(cvUrl?: string): Promise<Buffer | null> {
  if (!cvUrl || typeof cvUrl !== "string") {
    return null;
  }

  try {
    const response = await axios.get<ArrayBuffer>(cvUrl, {
      responseType: "arraybuffer",
      timeout: 10000, // 10 second timeout
    });

    const cvBuffer = Buffer.from(response.data);
    if (cvBuffer.length === 0) {
      console.warn("⚠️  CV file is empty");
      return null;
    }

    console.log("✅ Appraiser CV fetched successfully");
    return cvBuffer;
  } catch (error) {
    console.warn("⚠️  Failed to fetch appraiser CV:", error);
    return null;
  }
}

/**
 * Merge cover page, main report, and CV using docx-merger
 */
async function mergeDocuments(
  coverBuffer: Buffer,
  mainBuffer: Buffer,
  cvBuffer: Buffer | null
): Promise<Buffer> {
  try {
    const filesToMerge: Buffer[] = [coverBuffer, mainBuffer];

    // Add CV divider and CV if available
    if (cvBuffer) {
      const dividerBuffer = await createSimpleHeadingDocx("Appraiser CV");
      filesToMerge.push(dividerBuffer, cvBuffer);
      console.log("📄 Merging: Cover -> Report -> CV Divider -> CV");
    } else {
      console.log("📄 Merging: Cover -> Report");
    }

    // Convert buffers to binary strings for docx-merger
    const binaryFiles = filesToMerge.map((buf) => buf.toString("binary"));

    // Merge using docx-merger
    const merger = new DocxMerger({}, binaryFiles);
    const mergedData = await new Promise<Buffer>((resolve, reject) => {
      merger.save("nodebuffer", (data: Buffer) => {
        if (data) {
          resolve(data);
        } else {
          reject(new Error("Merge returned empty data"));
        }
      });
    });

    console.log("✅ Documents merged successfully");
    return mergedData;
  } catch (error) {
    console.error("❌ Document merge failed:", error);
    throw new Error("Failed to merge DOCX documents.");
  }
}

/**
 * Format report date for cover page
 */
function formatReportDate(date?: string | Date): string {
  try {
    const dt = date ? new Date(date) : new Date();
    return dt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
