import { uploadToR2 } from "../utils/r2Storage/r2Upload.js";
import SalvageReport from "../models/salvage.model.js";
import PdfReport from "../models/pdfReport.model.js";
import { analyzeSalvageImages } from "../service/salvageOpenAIService.js";
import { findComparableSalvageItems } from "../service/salvageWebSearchService.js";
import { calculateSalvageValue } from "../service/salvageValuationService.js";
import { generateSalvagePdfFromReport } from "../service/salvagePdfService.js";
import { generateSalvageDocx } from "../service/docx/salvageDocxBuilder.js";
import { generateSalvageXlsx } from "../service/xlsx/salvageXlsxService.js";
import { startProgress, updateProgress, endProgress, type StepRec as StoreStepRec } from "../utils/progressStore.js";
import { sendEmail } from "../utils/sendVerificationEmail.js";
import fs from "fs/promises";
import path from "path";
import { createWriteStream } from "fs";
import archiver from "archiver";

export type SalvageJobInput = {
  user: { id: string; email?: string | null; name?: string | null };
  images: Express.Multer.File[];
  details: any;
  progressId?: string;
};

export type SalvageJobOutput = {
  pdfPath: string;
  docxPath: string;
  xlsxPath: string;
};

export function queueSalvageReportJob(input: SalvageJobInput) {
  setImmediate(() =>
    runSalvageReportJob(input).catch(async (e) => {
      try {
        if (input.progressId) endProgress(input.progressId, false, "Error processing salvage request");
        if (input?.user?.email) {
          const msg = `Hello${input.user?.name ? ` ${input.user.name}` : ''},<br/>Your Salvage report encountered an error during processing.`;
          await sendEmail(String(input.user.email), "Salvage report processing failed", msg);
        }
      } catch {}
      console.error("Salvage job failed:", e);
    })
  );
}

export async function runSalvageReportJob({ user, images, details, progressId }: SalvageJobInput): Promise<SalvageJobOutput> {
  try {
    // Progress setup
    type StepRec = { key: string; label: string; startedAt?: string; endedAt?: string; durationMs?: number };
    const steps: StepRec[] = [];
    if (progressId) startProgress(progressId);
    const syncSteps = () => progressId && updateProgress(progressId, { steps: steps as unknown as StoreStepRec[] });
    const SERVER_WEIGHTS = { r2_upload: 0.25, ai_analysis: 0.35, find_comparables: 0.1, valuation: 0.1, save_report: 0.05, generate_pdf: 0.06, generate_docx: 0.05, generate_xlsx: 0.02, save_files: 0.02, save_images_folder: 0.03, zip_images: 0.02 } as const;
    let accum = 0;
    const setProg = (delta: number) => { if (!progressId) return; accum = Math.min(1, accum + delta); updateProgress(progressId, { serverProgress01: accum }); };
    const start = (key: keyof typeof SERVER_WEIGHTS, label: string) => { steps.push({ key, label, startedAt: new Date().toISOString() }); syncSteps(); };
    const end = (key: keyof typeof SERVER_WEIGHTS) => { for (let i = steps.length - 1; i >= 0; i--) { const s = steps[i]; if (s.key === key && !s.endedAt) { s.endedAt = new Date().toISOString(); const st = s.startedAt ? new Date(s.startedAt).getTime() : Date.now(); s.durationMs = new Date(s.endedAt).getTime() - st; break; } } syncSteps(); setProg((SERVER_WEIGHTS as any)[key] ?? 0); };

    // Notify start
    try {
      if (user?.email) {
        const subject = "Your Salvage report is being processed";
        const webUrl = process.env.WEB_APP_URL || "http://localhost:3000";
        const html = `
          <div style="font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111">
            <h2 style="margin:0 0 12px">Salvage Report Started</h2>
            <p>Hello${user?.name ? ` ${user.name}` : ""},</p>
            <p>Your salvage report has started processing. We'll email you when it's complete.</p>
            <p><a href="${webUrl}/reports" style="display:inline-block;background:#e11d48;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Go to Reports</a></p>
          </div>`;
        await sendEmail(String(user.email), subject, html);
      }
    } catch (e) { console.warn("Failed to send start email:", e); }

    // 1) Upload images to R2
    const imageUrls: string[] = [];
    if (images?.length) {
      start("r2_upload", "Uploading images to storage");
      const total = images.length;
      for (let idx = 0; idx < images.length; idx++) {
        const file = images[idx];
        const ts = Date.now();
        const fileName = `uploads/salvage/${ts}-${file.originalname}`;
        await uploadToR2(file, process.env.R2_BUCKET_NAME!, fileName);
        imageUrls.push(`https://images.sellsnap.store/${fileName}`);
        if (progressId) {
          const partial = (idx + 1) / total;
          updateProgress(progressId, { serverProgress01: Math.min(1, partial * (SERVER_WEIGHTS.r2_upload + accum)) });
        }
      }
      end("r2_upload");
    }

    // 2) AI: analyze images
    let aiExtractedDetails: any = {};
    try {
      if (imageUrls.length > 0) {
        start("ai_analysis", "Analyzing images with AI");
        const langRaw = String(details?.language || '').toLowerCase();
        const lang = (langRaw === 'fr' || langRaw === 'es') ? (langRaw as 'fr' | 'es') : 'en';
        const ccy = String(details?.currency || 'CAD').toUpperCase();
        aiExtractedDetails = await analyzeSalvageImages(imageUrls, lang, ccy);
        end("ai_analysis");
      }
    } catch (e) {
      console.error("AI analysis failed for salvage:", e);
      if (progressId) end("ai_analysis");
    }

    // 3) Web search comparables
    let comparableItems: any[] = [];
    try {
      start("find_comparables", "Finding comparable salvage items");
      comparableItems = await findComparableSalvageItems(aiExtractedDetails);
      end("find_comparables");
    } catch (e) {
      console.error("Error finding salvage comparables:", e);
      if (progressId) end("find_comparables");
    }

    // 4) Valuation
    let valuation: any = {};
    try {
      start("valuation", "Calculating salvage valuation");
      valuation = await calculateSalvageValue(details?.cause_of_loss_summary || "", comparableItems);
      end("valuation");
    } catch (e) {
      console.error("Error calculating salvage valuation:", e);
      if (progressId) end("valuation");
    }

    // 5) Save DB record
    // Map itemized estimate details and notes from AI with fallbacks to user-provided 'details'
    const toNum = (v: any): number => {
      try {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string') {
          const p = Number(v.replace(/[^0-9.\-]/g, ''));
          return Number.isFinite(p) ? p : 0;
        }
        return 0;
      } catch { return 0; }
    };
    const reAi: any = (aiExtractedDetails as any)?.repair_estimate || {};
    const partsItems: any[] = Array.isArray(details?.repair_items)
      ? details.repair_items
      : (Array.isArray(reAi?.parts_items) ? reAi.parts_items : []);
    const labourBreakdown: any[] = Array.isArray(details?.labour_breakdown)
      ? details.labour_breakdown
      : (Array.isArray(reAi?.labour_breakdown) ? reAi.labour_breakdown : []);
    const labourRateDefault = toNum(details?.labour_rate_default ?? reAi?.labour_rate_default);
    const partsSubtotalCalc = partsItems.reduce((sum, it: any) => sum + toNum(it?.line_total ?? (toNum(it?.quantity) * toNum(it?.unit_price))), 0);
    const labourTotalCalc = labourBreakdown.reduce((sum, it: any) => {
      const rate = toNum(it?.rate_per_hour ?? labourRateDefault);
      const hours = toNum(it?.hours);
      const line = toNum(it?.line_total ?? hours * rate);
      return sum + line;
    }, 0);
    const parts_subtotal = toNum(details?.parts_subtotal ?? reAi?.parts_subtotal ?? partsSubtotalCalc);
    const labour_total = toNum(details?.labour_total ?? reAi?.labour_total ?? labourTotalCalc);

    const procurement_notes = details?.procurement_notes ?? (aiExtractedDetails as any)?.procurement_notes;
    const safety_concerns = details?.safety_concerns ?? (aiExtractedDetails as any)?.safety_concerns;
    const assumptions = details?.assumptions ?? (aiExtractedDetails as any)?.assumptions;
    const priority_level = details?.priority_level ?? (aiExtractedDetails as any)?.priority_level;

    const finalData: any = {
      ...details,
      imageUrls,
      aiExtractedDetails,
      comparableItems,
      valuation,
      item_type: aiExtractedDetails?.item_type || details?.item_type,
      year: aiExtractedDetails?.year || details?.year,
      make: aiExtractedDetails?.make || details?.make,
      item_model: aiExtractedDetails?.item_model || details?.item_model,
      vin: aiExtractedDetails?.vin || details?.vin,
      item_condition: aiExtractedDetails?.item_condition || details?.item_condition,
      damage_description: aiExtractedDetails?.damage_description || details?.damage_description,
      inspection_comments: aiExtractedDetails?.inspection_comments || details?.inspection_comments,
      is_repairable: aiExtractedDetails?.is_repairable,
      repair_facility: aiExtractedDetails?.repair_facility,
      repair_facility_comments: aiExtractedDetails?.repair_facility_comments,
      repair_estimate: aiExtractedDetails?.repair_estimate,
      // Itemized (denormalized) for convenience in templates and exports
      repair_items: partsItems,
      labour_breakdown: labourBreakdown,
      labour_rate_default: labourRateDefault,
      parts_subtotal,
      labour_total,
      procurement_notes,
      safety_concerns,
      assumptions,
      priority_level,
      actual_cash_value: aiExtractedDetails?.actual_cash_value,
      replacement_cost: aiExtractedDetails?.replacement_cost,
      replacement_cost_references: aiExtractedDetails?.replacement_cost_references,
      recommended_reserve: aiExtractedDetails?.recommended_reserve,
      specialty_data: aiExtractedDetails?.specialty_data,
    };

    start("save_report", "Saving report to database");
    const newReport = new (SalvageReport as any)({
      user: user.id,
      ...finalData,
    });
    await newReport.save();
    end("save_report");

    const reportObj = newReport.toObject();

    // 6) Generate outputs
    const [pdfBuffer, docxBuffer, xlsxBuffer] = await Promise.all([
      (async () => { start("generate_pdf", "Generating PDF"); const b = await generateSalvagePdfFromReport(reportObj); end("generate_pdf"); return b; })(),
      (async () => { start("generate_docx", "Generating DOCX"); const b = await generateSalvageDocx(reportObj); end("generate_docx"); return b; })(),
      (async () => { start("generate_xlsx", "Generating Excel"); const b = await generateSalvageXlsx(reportObj); end("generate_xlsx"); return b; })(),
    ]);

    // 7) Save files and PdfReport entries
    const reportsDir = path.resolve(process.cwd(), "reports");
    await fs.mkdir(reportsDir, { recursive: true });
    const ts = Date.now();
    const base = `salvage-report-${newReport._id}-${ts}`;
    const pdfFilename = `${base}.pdf`;
    const docxFilename = `${base}.docx`;
    const xlsxFilename = `${base}.xlsx`;
    const pdfPath = path.join(reportsDir, pdfFilename);
    const docxPath = path.join(reportsDir, docxFilename);
    const xlsxPath = path.join(reportsDir, xlsxFilename);

    start("save_files", "Saving generated files");
    await Promise.all([
      fs.writeFile(pdfPath, pdfBuffer),
      fs.writeFile(docxPath, docxBuffer),
      fs.writeFile(xlsxPath, xlsxBuffer),
    ]);
    end("save_files");

    // Save original uploaded images to a folder and zip
    const imagesFolderName = `${base}-images`;
    const imagesDirPath = path.join(reportsDir, imagesFolderName);
    const imagesZipFilename = `${imagesFolderName}.zip`;
    const imagesZipPath = path.join(reportsDir, imagesZipFilename);
    try {
      start("save_images_folder", "Saving original images to folder");
      await fs.mkdir(imagesDirPath, { recursive: true });
      const extFromMime = (m?: string) => {
        if (!m) return "";
        if (m.includes("jpeg")) return ".jpg";
        if (m.includes("png")) return ".png";
        if (m.includes("webp")) return ".webp";
        if (m.includes("heic")) return ".heic";
        if (m.includes("heif")) return ".heif";
        if (m.includes("gif")) return ".gif";
        if (m.includes("bmp")) return ".bmp";
        if (m.includes("tiff")) return ".tiff";
        return "";
      };
      const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const orig = file.originalname || "";
        const fallback = `image-${String(i + 1).padStart(3, "0")}`;
        const ext = path.extname(orig) || extFromMime((file as any)?.mimetype) || "";
        const baseName = sanitize((orig && orig.split("/").pop()!) || fallback + ext);
        const filePath = path.join(imagesDirPath, baseName);
        await fs.writeFile(filePath, file.buffer);
      }
      end("save_images_folder");

      start("zip_images", "Zipping images folder");
      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(imagesZipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });
        output.on("close", () => resolve());
        archive.on("error", (err: any) => reject(err));
        archive.pipe(output);
        archive.directory(imagesDirPath, false);
        archive.finalize();
      });
      end("zip_images");
    } catch (e) {
      console.error("Failed saving/zipping images folder (salvage)", e);
    }

    const baseRec = {
      user: user.id,
      report: newReport._id,
      reportType: "Salvage" as const,
      reportModel: "SalvageReport" as const,
      address: newReport.file_number || "",
      fairMarketValue: newReport?.valuation?.fairMarketValue || "",
    };
    await Promise.all([
      new (PdfReport as any)({ ...baseRec, filename: pdfFilename, fileType: "pdf", filePath: path.join("reports", pdfFilename) }).save(),
      new (PdfReport as any)({ ...baseRec, filename: docxFilename, fileType: "docx", filePath: path.join("reports", docxFilename) }).save(),
      new (PdfReport as any)({ ...baseRec, filename: xlsxFilename, fileType: "xlsx", filePath: path.join("reports", xlsxFilename) }).save(),
      new (PdfReport as any)({
        ...baseRec,
        filename: imagesZipFilename,
        fileType: "images",
        filePath: path.join("reports", imagesZipFilename),
        imagesFolderPath: path.join("reports", imagesFolderName),
      }).save(),
    ]);

    // Completion email
    try {
      if (user?.email) {
        const webUrl = process.env.WEB_APP_URL || "http://localhost:3000";
        const subject = "Your Salvage reports were submitted for approval";
        const html = `
          <div style="font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111">
            <h2 style="margin:0 0 12px">Salvage Reports Submitted</h2>
            <p>Hello${user?.name ? ` ${user.name}` : ""},</p>
            <p>Your Salvage report outputs (PDF, DOCX, and Excel) have been generated and submitted for admin approval.</p>
            <ul>
              <li>PDF: ${pdfFilename}</li>
              <li>DOCX: ${docxFilename}</li>
              <li>Excel: ${xlsxFilename}</li>
            </ul>
            <p>You will receive an email when your reports are approved and ready to download.</p>
            <p><a href="${webUrl}/reports" style="display:inline-block;background:#e11d48;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Go to Reports</a></p>
          </div>`;
        await sendEmail(String(user.email), subject, html);
      }
    } catch (e) { console.error("Failed to send completion email:", e); }

    if (progressId) endProgress(progressId, true, "Report generated successfully");
    return {
      pdfPath: path.join("reports", pdfFilename),
      docxPath: path.join("reports", docxFilename),
      xlsxPath: path.join("reports", xlsxFilename),
    };
  } catch (e) {
    console.error("runSalvageReportJob error:", e);
    if (progressId) endProgress(progressId, false, "Error during report generation");
    try {
      if (user?.email) {
        await sendEmail(String(user.email || ""), "Salvage report processing failed", `<p>Your Salvage report failed to process. Please try again.</p>`);
      }
    } catch {}
    throw e;
  }
}
