import { uploadToR2 } from "../utils/r2Storage/r2Upload.js";
import RealEstateReport from "../models/realEstate.model.js";
import PdfReport from "../models/pdfReport.model.js";
import { analyzeRealEstateImages } from "../service/openAIService.js";
import { findComparableProperties } from "../service/webSearchService.js";
import { calculateFairMarketValue } from "../service/valuationService.js";
import {
  marketTrendSearch,
  type MarketTrend,
  type PropertyDetails,
} from "../service/marketTrendSebSearch.js";
import { generatePdfFromReport } from "../service/pdfService.js";
import { generateRealEstateDocx } from "../service/docx/realEstateDocxBuilder.js";
import { generateRealEstateXlsx } from "../service/xlsx/realEstateXlsxService.js";
import { sendEmail } from "../utils/sendVerificationEmail.js";
import fs from "fs/promises";
import path from "path";
import {
  startProgress,
  updateProgress,
  endProgress,
  type StepRec as StoreStepRec,
} from "../utils/progressStore.js";

export type RealEstateJobInput = {
  user: { id: string; email: string; name?: string | null };
  images: Express.Multer.File[];
  details: any;
  progressId?: string;
};

export function queueRealEstateReportJob(input: RealEstateJobInput) {
  setImmediate(() =>
    runRealEstateReportJob(input).catch((e) => {
      if (input.progressId)
        endProgress(
          input.progressId,
          false,
          "Error processing real estate request"
        );
      console.error("Real estate job failed:", e);
    })
  );
}

export async function runRealEstateReportJob({
  user,
  images,
  details,
  progressId,
}: RealEstateJobInput) {
  type StepRec = {
    key: string;
    label: string;
    startedAt?: string;
    endedAt?: string;
    durationMs?: number;
  };
  const steps: StepRec[] = [];
  if (progressId) startProgress(progressId);
  const syncSteps = () =>
    progressId &&
    updateProgress(progressId, { steps: steps as unknown as StoreStepRec[] });
  const SERVER_WEIGHTS = {
    r2_upload: 0.2,
    ai_analysis: 0.25,
    find_comparables: 0.15,
    valuation: 0.1,
    market_trend: 0.05,
    save_report: 0.05,
    generate_pdf: 0.08,
    generate_docx: 0.06,
    generate_xlsx: 0.03,
    save_files: 0.03,
  } as const;
  let accum = 0;
  const setProg = (delta: number) => {
    if (!progressId) return;
    accum = Math.min(1, accum + delta);
    updateProgress(progressId, { serverProgress01: accum });
  };
  const start = (key: keyof typeof SERVER_WEIGHTS, label: string) => {
    steps.push({ key, label, startedAt: new Date().toISOString() });
    syncSteps();
  };
  const end = (key: keyof typeof SERVER_WEIGHTS) => {
    for (let i = steps.length - 1; i >= 0; i--) {
      const s = steps[i];
      if (s.key === key && !s.endedAt) {
        s.endedAt = new Date().toISOString();
        const st = s.startedAt ? new Date(s.startedAt).getTime() : Date.now();
        s.durationMs = new Date(s.endedAt).getTime() - st;
        break;
      }
    }
    syncSteps();
    setProg((SERVER_WEIGHTS as any)[key] ?? 0);
  };

  try {
    // 1) Upload images to R2
    const imageUrls: string[] = [];
    if (images?.length) {
      start("r2_upload", "Uploading images to storage");
      for (const file of images) {
        const ts = Date.now();
        const fileName = `uploads/real-estate/${ts}-${file.originalname}`;
        await uploadToR2(file, process.env.R2_BUCKET_NAME!, fileName);
        imageUrls.push(`https://images.sellsnap.store/${fileName}`);
      }
      end("r2_upload");
    }

    // 2) AI extraction from images
    start("ai_analysis", "Analyzing images with AI");
    let aiExtractedData: any = {};
    try {
      if (imageUrls.length > 0)
        aiExtractedData = await analyzeRealEstateImages(imageUrls);
    } catch (e) {
      console.error("AI analysis failed for real-estate:", e);
    }
    end("ai_analysis");

    // 3) Build final data from details
    const finalData = {
      ...details,
      owner_name: details?.property_details?.owner_name || "",
      house_details: { ...(details?.house_details || {}), ...aiExtractedData },
      imageUrls,
    };

    // 4) Find comparable properties
    start("find_comparables", "Finding comparable properties");
    let comparableProperties: any = {};
    try {
      if (finalData.property_details?.address) {
        comparableProperties = await findComparableProperties(
          finalData.property_details,
          finalData.house_details
        );
      }
    } catch (e) {
      console.error("Error finding comparable properties:", e);
    }
    end("find_comparables");

    // 5) Valuation
    start("valuation", "Calculating fair market value");
    let valuation: any = {};
    try {
      const compsArr = Array.isArray(comparableProperties)
        ? comparableProperties
        : [];
      if (compsArr.length > 0) {
        valuation = await calculateFairMarketValue(finalData, compsArr);
      }
    } catch (e) {
      console.error("Error during valuation:", e);
    }
    end("valuation");

    // 6) Market trend
    start("market_trend", "Fetching market trend");
    let marketTrendData: MarketTrend[] = [];
    try {
      const p: PropertyDetails = {
        address: finalData.property_details?.address,
        municipality: finalData.property_details?.municipality,
      } as any;
      if (p.address && p.municipality)
        marketTrendData = await marketTrendSearch(p);
    } catch (e) {
      console.error("Error fetching market trend:", e);
    }
    end("market_trend");

    // 7) Save DB record
    start("save_report", "Saving report to database");
    const comparablePropertiesMap = new Map();
    const compsForMap = Array.isArray(comparableProperties)
      ? comparableProperties
      : [];
    compsForMap.forEach((comp: any) => {
      const { name, ...rest } = comp || {};
      comparablePropertiesMap.set(name, rest);
    });
    const newReport = new RealEstateReport({
      user: user.id,
      ...finalData,
      comparableProperties: comparablePropertiesMap,
      valuation,
      marketTrend: marketTrendData,
      language: ((): "en" | "fr" | "es" => {
        const l = String(details?.language || "").toLowerCase();
        return l === "fr" || l === "es" ? (l as any) : "en";
      })(),
    });
    await newReport.save();
    end("save_report");

    // 8) Generate outputs
    const reportObjForPdf = newReport.toObject();
    reportObjForPdf.comparableProperties = Object.fromEntries(
      comparablePropertiesMap
    );
    const [pdfBuffer, docxBuffer, xlsxBuffer] = await Promise.all([
      (async () => {
        start("generate_pdf", "Generating PDF");
        const b = await generatePdfFromReport(reportObjForPdf);
        end("generate_pdf");
        return b;
      })(),
      (async () => {
        start("generate_docx", "Generating DOCX");
        const b = await generateRealEstateDocx(reportObjForPdf);
        end("generate_docx");
        return b;
      })(),
      (async () => {
        start("generate_xlsx", "Generating Excel");
        const b = await generateRealEstateXlsx(reportObjForPdf);
        end("generate_xlsx");
        return b;
      })(),
    ]);

    // 9) Save files and create PdfReport entries
    start("save_files", "Saving generated files");
    const reportsDir = path.resolve(process.cwd(), "reports");
    await fs.mkdir(reportsDir, { recursive: true });
    const ts = Date.now();
    const pdfFilename = `real-estate-report-${newReport._id}-${ts}.pdf`;
    const docxFilename = `real-estate-report-${newReport._id}-${ts}.docx`;
    const xlsxFilename = `real-estate-report-${newReport._id}-${ts}.xlsx`;
    const pdfPath = path.join(reportsDir, pdfFilename);
    const docxPath = path.join(reportsDir, docxFilename);
    const xlsxPath = path.join(reportsDir, xlsxFilename);
    await Promise.all([
      fs.writeFile(pdfPath, pdfBuffer),
      fs.writeFile(docxPath, docxBuffer),
      fs.writeFile(xlsxPath, xlsxBuffer),
    ]);
    const baseRec = {
      user: user.id,
      report: newReport._id,
      reportType: "RealEstate" as const,
      reportModel: "RealEstateReport" as const,
      address: newReport.property_details?.address || "",
      fairMarketValue: newReport.valuation?.fair_market_value || "",
    };
    await Promise.all([
      new PdfReport({
        ...baseRec,
        filename: pdfFilename,
        fileType: "pdf",
        filePath: path.join("reports", pdfFilename),
      }).save(),
      new PdfReport({
        ...baseRec,
        filename: docxFilename,
        fileType: "docx",
        filePath: path.join("reports", docxFilename),
      }).save(),
      new PdfReport({
        ...baseRec,
        filename: xlsxFilename,
        fileType: "xlsx",
        filePath: path.join("reports", xlsxFilename),
      }).save(),
    ]);
    end("save_files");

    // 10) Email user (submitted for approval)
    try {
      const webUrl = process.env.WEB_APP_URL || "http://localhost:3000";
      const subject = "Your Real Estate reports were submitted for approval";
      const html = `
        <div style="font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111">
          <h2 style="margin:0 0 12px">Real Estate Reports Submitted</h2>
          <p>Hello${user?.name ? ` ${user.name}` : ""},</p>
          <p>Your Real Estate report outputs (PDF, DOCX, and Excel) have been generated and submitted for admin approval.</p>
          <ul>
            <li>PDF: ${pdfFilename}</li>
            <li>DOCX: ${docxFilename}</li>
            <li>Excel: ${xlsxFilename}</li>
          </ul>
          <p>You will receive an email when your reports are approved and ready to download.</p>
          <p><a href="${webUrl}/reports" style="display:inline-block;background:#e11d48;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Go to Reports</a></p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
          <p style="font-size:12px;color:#777">ClearValue</p>
        </div>
      `;
      if (user?.email) {
        await sendEmail(user.email, subject, html);
      }
    } catch (e) {
      console.error("Failed to send completion email:", e);
    }

    if (progressId)
      endProgress(progressId, true, "Report generated successfully");
  } catch (e) {
    if (progressId)
      endProgress(progressId, false, "Error during report generation");
    console.error("runRealEstateReportJob error:", e);
    throw e;
  }
}
