import { uploadToR2 } from "../utils/r2Storage/r2Upload.js";
import AssetReport from "../models/asset.model.js";
import PdfReport from "../models/pdfReport.model.js";
import {
  analyzeAssetImages,
  type AssetAnalysisResult,
} from "../service/assetOpenAIService.js";
import { generateAssetPdfFromReport } from "../service/assetPdfService.js";
import {
  startProgress,
  updateProgress,
  endProgress,
  type StepRec as StoreStepRec,
} from "../utils/progressStore.js";
import { sendEmail } from "../utils/sendVerificationEmail.js";
import fs from "fs/promises";
import path from "path";

export type AssetGroupingMode = "single_lot" | "per_item" | "per_photo" | "catalogue";

export type AssetJobInput = {
  user: { id: string; email: string; name?: string | null };
  images: Express.Multer.File[];
  details: any;
  progressId?: string;
};

export function queueAssetReportJob(input: AssetJobInput) {
  // Run in background without awaiting response lifecycle
  setImmediate(() => runAssetReportJob(input).catch((e) => {
    if (input.progressId) endProgress(input.progressId, false, "Error processing request");
    console.error("Asset job failed:", e);
  }));
}

export async function runAssetReportJob({ user, images, details, progressId }: AssetJobInput) {
  const processStartedAt = Date.now();
  type StepRec = { key: string; label: string; startedAt?: string; endedAt?: string; durationMs?: number };
  const steps: StepRec[] = [];

  if (progressId) startProgress(progressId);
  const syncStoreSteps = () => {
    if (!progressId) return;
    updateProgress(progressId, { steps: steps as unknown as StoreStepRec[] });
  };
  const setServerProg01 = (v: number) => {
    if (!progressId) return;
    const clamped = Math.max(0, Math.min(1, v));
    updateProgress(progressId, { serverProgress01: clamped });
  };
  const SERVER_WEIGHTS = { r2_upload: 0.2, ai_analysis: 0.6, generate_pdf: 0.2, finalize: 0 } as const;
  let serverAccum = 0;
  const startStep = (key: string, label: string) => {
    steps.push({ key, label, startedAt: new Date().toISOString() });
    syncStoreSteps();
  };
  const endStep = (key: string) => {
    for (let i = steps.length - 1; i >= 0; i--) {
      const s = steps[i];
      if (s.key === key && !s.endedAt) {
        s.endedAt = new Date().toISOString();
        const start = s.startedAt ? new Date(s.startedAt).getTime() : Date.now();
        s.durationMs = new Date(s.endedAt).getTime() - start;
        break;
      }
    }
    syncStoreSteps();
    if ((SERVER_WEIGHTS as any)[key] != null) {
      serverAccum = Math.min(1, serverAccum + (SERVER_WEIGHTS as any)[key]);
      setServerProg01(serverAccum);
    }
  };

  try {
    const groupingMode: AssetGroupingMode =
      details?.grouping_mode === "per_item" ||
      details?.grouping_mode === "per_photo" ||
      details?.grouping_mode === "catalogue"
        ? details.grouping_mode
        : "single_lot";

    const imageUrls: string[] = [];
    if (images?.length) {
      startStep("r2_upload", "Uploading images to storage");
      const total = images.length;
      for (let idx = 0; idx < images.length; idx++) {
        const file = images[idx];
        const timestamp = Date.now();
        const fileName = `uploads/asset/${timestamp}-${file.originalname}`;
        await uploadToR2(file, process.env.R2_BUCKET_NAME!, fileName);
        const fileUrl = `https://images.sellsnap.store/${fileName}`;
        imageUrls.push(fileUrl);
        if (progressId) {
          const partial = (idx + 1) / total;
          const current = serverAccum + partial * SERVER_WEIGHTS.r2_upload;
          setServerProg01(current);
        }
      }
      endStep("r2_upload");
    }

    let analysis: any = null;
    let lots: any[] = [];

    if (groupingMode === "catalogue") {
      // Parse mapping from details
      const rawLots: any[] = Array.isArray(details?.catalogue_lots)
        ? details.catalogue_lots
        : [];
      type LotMap = { count: number; cover_index?: number };
      const mappings: LotMap[] = rawLots
        .map((x: any) => ({
          count: Math.max(0, parseInt(String(x?.count ?? 0), 10) || 0),
          cover_index:
            typeof x?.cover_index === "number"
              ? x.cover_index
              : typeof x?.coverIndex === "number"
              ? x.coverIndex
              : 0,
        }))
        .filter((m: LotMap) => Number.isFinite(m.count) && m.count > 0);

      // Fallback: if mapping missing/invalid, treat all as one lot
      const totalImages = imageUrls.length;
      const sum = mappings.reduce((s, m) => s + m.count, 0);
      const useMappings: LotMap[] =
        mappings.length > 0 && sum <= totalImages
          ? mappings
          : totalImages > 0
          ? [{ count: Math.min(20, totalImages), cover_index: 0 }]
          : [];

      // Adjust last mapping to consume remaining images (if any shortfall)
      const mappedSum = useMappings.reduce((s, m) => s + m.count, 0);
      if (mappedSum < totalImages && useMappings.length > 0) {
        useMappings[useMappings.length - 1].count += totalImages - mappedSum;
      }

      // Analyze each lot independently using single_lot prompt
      startStep("ai_analysis", "AI analysis of images (catalogue)");
      let base = 0;
      for (let lotIdx = 0; lotIdx < useMappings.length; lotIdx++) {
        const { count, cover_index } = useMappings[lotIdx];
        const cappedCount = Math.max(0, Math.min(20, count));
        const end = Math.min(imageUrls.length, base + cappedCount);
        const localIdxs = Array.from({ length: Math.max(0, end - base) }, (_, i) => base + i);
        const subUrls = localIdxs.map((i) => imageUrls[i]);

        if (subUrls.length === 0) {
          base = end;
          continue;
        }

        try {
          const aiRes = await analyzeAssetImages(subUrls, "single_lot");
          if (!analysis) analysis = { per_lot: [] };
          analysis.per_lot.push(aiRes);

          const lotResults = Array.isArray(aiRes?.lots) ? aiRes.lots : [];
          for (const lot of lotResults as any[]) {
            // Remap image indexes to global
            const total = imageUrls.length;
            const local = Array.isArray(lot?.image_indexes)
              ? Array.from(
                  new Set<number>(
                    (lot.image_indexes as any[])
                      .map((n: any) => parseInt(String(n), 10))
                      .filter((n: number) => Number.isFinite(n) && n >= 0 && n < subUrls.length)
                  )
                )
              : [];
            // If empty, assume all images in this lot
            const mappedIdxs = (local.length > 0 ? local : Array.from({ length: subUrls.length }, (_, i) => i)).map(
              (li) => base + li
            );
            const urlsFromIdx = mappedIdxs.map((gi) => imageUrls[gi]).filter(Boolean);

            // Determine cover image: client-provided within lot; default 0
            const coverLocal = Math.max(0, Math.min(subUrls.length - 1, typeof cover_index === "number" ? cover_index : 0));
            const coverGlobal = base + coverLocal;
            const coverUrl = imageUrls[coverGlobal];

            const urlsSet = new Set<string>([...urlsFromIdx, ...(coverUrl ? [coverUrl] : [])]);
            const urls = Array.from(urlsSet);

            lots.push({
              ...lot,
              image_url: coverUrl || lot?.image_url || urls[0] || undefined,
              image_indexes: mappedIdxs,
              image_urls: urls,
            });
          }
        } catch (e) {
          console.error(`AI analysis failed for catalogue lot #${lotIdx + 1}:`, e);
        }

        // Partial progress update within AI phase
        if (progressId) {
          const partial = (lotIdx + 1) / useMappings.length;
          const current = serverAccum + partial * SERVER_WEIGHTS.ai_analysis;
          setServerProg01(current);
        }

        base = end;
      }
      endStep("ai_analysis");
    } else {
      // Existing behavior for single_lot, per_item, per_photo (limit to 10 for AI)
      const urlsForAI = imageUrls.slice(0, 10);
      if (urlsForAI.length > 0) {
        try {
          startStep("ai_analysis", "AI analysis of images");
          analysis = await analyzeAssetImages(urlsForAI, groupingMode);
          endStep("ai_analysis");
        } catch (e) {
          console.error("Error during asset AI analysis:", e);
          if (progressId) endStep("ai_analysis");
        }
      }

      lots = (analysis?.lots || []).map((lot: any, idx: number) => {
        const total = imageUrls.length;
        const idxs: number[] = Array.isArray(lot?.image_indexes)
          ? Array.from(
              new Set<number>(
                (lot.image_indexes as any[])
                  .map((n: any) => parseInt(String(n), 10))
                  .filter((n: number) => Number.isFinite(n) && n >= 0 && n < total)
              )
            )
          : [];
        if (groupingMode === "per_photo" && idxs.length === 0 && imageUrls[idx]) idxs.push(idx);
        const urlsFromIdx = idxs.map((i) => imageUrls[i]).filter(Boolean);
        const directUrl: string | undefined =
          typeof lot?.image_url === "string" && lot.image_url ? lot.image_url : undefined;
        if (idxs.length === 0 && directUrl) {
          const inferred = imageUrls.indexOf(directUrl);
          if (inferred >= 0) idxs.push(inferred);
        }
        const urlsSet = new Set<string>([...urlsFromIdx, ...(directUrl ? [directUrl] : [])]);
        const urls = Array.from(urlsSet);
        return { ...lot, image_indexes: idxs, image_urls: urls };
      });
    }

    const parseDate = (val: any): Date | undefined => {
      if (!val) return undefined;
      const d = new Date(val);
      return isNaN(d.getTime()) ? undefined : d;
    };

    const newReport = new AssetReport({
      user: user.id,
      grouping_mode: groupingMode,
      imageUrls: imageUrls,
      lots,
      analysis,
      client_name: details?.client_name,
      effective_date: parseDate(details?.effective_date),
      appraisal_purpose: details?.appraisal_purpose,
      owner_name: details?.owner_name,
      appraiser: details?.appraiser || user?.name || undefined,
      appraisal_company: details?.appraisal_company,
      industry: details?.industry,
      inspection_date: parseDate(details?.inspection_date),
    });

    startStep("save_report", "Persisting report to database");
    await newReport.save();
    endStep("save_report");

    const reportObjectForPdf = newReport.toObject();
    startStep("generate_pdf", "Generating PDF");
    const pdfBuffer = await generateAssetPdfFromReport({
      ...reportObjectForPdf,
      inspector_name: user?.name || "",
    });
    endStep("generate_pdf");

    const reportsDir = path.resolve(process.cwd(), "reports");
    await fs.mkdir(reportsDir, { recursive: true });

    const filename = `asset-report-${newReport._id}-${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, filename);
    startStep("save_pdf_file", "Saving PDF file");
    await fs.writeFile(filePath, pdfBuffer);
    endStep("save_pdf_file");

    const parseEstimated = (val: unknown): number => {
      if (!val) return 0;
      let s = String(val).trim();
      s = s.replace(/[\u2012\u2013\u2014\u2212]/g, "-");
      const matches = s.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?/g);
      if (!matches) return 0;
      const nums = matches.map((m) => parseFloat(m.replace(/,/g, ""))).filter((n) => Number.isFinite(n) && n >= 0);
      if (nums.length === 0) return 0;
      if (nums.length >= 2) {
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        return (min + max) / 2;
      }
      return nums[0];
    };

    const totalValue = (lots || []).reduce((sum: number, lot: any) => sum + parseEstimated(lot?.estimated_value), 0);
    const fairMarketValue = totalValue > 0 ? `CAD ${Math.round(totalValue).toLocaleString("en-CA")}` : "N/A";

    const newPdfReport = new PdfReport({
      filename,
      user: user.id,
      report: newReport._id,
      reportType: "Asset",
      reportModel: "AssetReport",
      address: `Asset Report (${lots.length} lots)`,
      fairMarketValue,
    });
    startStep("create_pdf_record", "Creating PDF record");
    await newPdfReport.save();
    endStep("create_pdf_record");

    if (progressId) {
      setServerProg01(1);
      endProgress(progressId, true, "Completed");
    }

    // Send notification email with link
    const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:4000";
    const downloadUrl = `${baseUrl}/reports/${filename}`;
    const subject = "Your Asset Report is ready";
    const html = `
      <div style="font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px">Asset Report Ready</h2>
        <p>Hello${user?.name ? ` ${user.name}` : ""},</p>
        <p>Your asset report has been generated successfully.</p>
        <p>
          <a href="${downloadUrl}" style="display:inline-block;background:#e11d48;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Download Report</a>
        </p>
        <p style="font-size:12px;color:#555">If the button doesn't work, copy and paste this link into your browser:<br />
          <a href="${downloadUrl}">${downloadUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
        <p style="font-size:12px;color:#777">ClearValue</p>
      </div>
    `;
    try {
      if (user?.email) {
        await sendEmail(user.email, subject, html);
      }
    } catch (e) {
      console.error("Failed to send completion email:", e);
    }
  } catch (error) {
    console.error("Error processing asset data (bg job):", error);
    if (progressId) endProgress(progressId, false, "Error processing request");
  }
}
