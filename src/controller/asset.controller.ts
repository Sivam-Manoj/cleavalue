import { Response } from "express";
import upload from "../utils/multerStorage.js";
import { uploadToR2 } from "../utils/r2Storage/r2Upload.js";
import AssetReport from "../models/asset.model.js";
import {
  analyzeAssetImages,
  type AssetAnalysisResult,
} from "../service/assetOpenAIService.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { generateAssetPdfFromReport } from "../service/assetPdfService.js";
import {
  startProgress,
  updateProgress,
  endProgress,
  getProgress,
  type StepRec as StoreStepRec,
} from "../utils/progressStore.js";
import PdfReport from "../models/pdfReport.model.js";
import fs from "fs/promises";
import path from "path";

export type AssetGroupingMode = "single_lot" | "per_item" | "per_photo";

export const createAssetReport = async (req: AuthRequest, res: Response) => {
  try {
    const details = JSON.parse(req.body.details || "{}");
    const images = req.files as Express.Multer.File[];

    const groupingMode: AssetGroupingMode =
      details.grouping_mode === "per_item" ||
      details.grouping_mode === "per_photo"
        ? details.grouping_mode
        : "single_lot";

    // Progress helpers (server-side, returned after completion)
    const processStartedAt = Date.now();
    type StepRec = {
      key: string;
      label: string;
      startedAt?: string;
      endedAt?: string;
      durationMs?: number;
    };
    const steps: StepRec[] = [];
    const progressId: string | undefined =
      (typeof details?.progress_id === "string" && details.progress_id) ||
      (typeof details?.progressId === "string" && details.progressId) ||
      (typeof details?.job_id === "string" && details.job_id) ||
      undefined;
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
    const SERVER_WEIGHTS = {
      r2_upload: 0.2,
      ai_analysis: 0.6,
      generate_pdf: 0.2,
      finalize: 0,
    } as const;
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
      // bump server progress at step boundaries
      if (key in SERVER_WEIGHTS) {
        serverAccum = Math.min(1, serverAccum + (SERVER_WEIGHTS as any)[key]);
        setServerProg01(serverAccum);
      }
    };

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
        // update partial server progress within R2 step
        if (progressId) {
          const partial = (idx + 1) / total;
          const current = serverAccum + partial * SERVER_WEIGHTS.r2_upload;
          setServerProg01(current);
        }
      }
      endStep("r2_upload");
    }

    // Limit 10 images as per upload middleware
    const urlsForAI = imageUrls.slice(0, 10);

    let analysis: AssetAnalysisResult | null = null;
    if (urlsForAI.length > 0) {
      try {
        startStep("ai_analysis", "AI analysis of images");
        analysis = await analyzeAssetImages(urlsForAI, groupingMode);
        endStep("ai_analysis");
      } catch (e) {
        console.error("Error during asset AI analysis:", e);
        // proceed without analysis
        if (progressId) {
          // still mark the step as ended to advance progress
          endStep("ai_analysis");
        }
      }
    }

    // Build enriched lots: sanitize indexes and resolve URLs
    const lots = (analysis?.lots || []).map((lot: any, idx: number) => {
      const total = imageUrls.length;
      const idxs: number[] = Array.isArray(lot?.image_indexes)
        ? Array.from(
            new Set<number>(
              lot.image_indexes
                .map((n: any) => parseInt(String(n), 10))
                .filter(
                  (n: number) => Number.isFinite(n) && n >= 0 && n < total
                )
            )
          )
        : [];

      // Fallback for per_photo: if AI missed indexes, map by position
      if (groupingMode === "per_photo" && idxs.length === 0 && imageUrls[idx]) {
        idxs.push(idx);
      }

      // Resolve URLs from indexes
      const urlsFromIdx = idxs.map((i: number) => imageUrls[i]).filter(Boolean);

      // Include any direct image_url provided by AI
      const directUrl: string | undefined =
        typeof lot?.image_url === "string" && lot.image_url ? lot.image_url : undefined;

      // If no indexes but directUrl matches an uploaded URL, infer the index
      if (idxs.length === 0 && directUrl) {
        const inferred = imageUrls.indexOf(directUrl);
        if (inferred >= 0) idxs.push(inferred);
      }

      const urlsSet = new Set<string>([...urlsFromIdx, ...(directUrl ? [directUrl] : [])]);
      const urls = Array.from(urlsSet);

      return {
        ...lot,
        image_indexes: idxs,
        image_urls: urls,
      };
    });

    // Helper to parse dates safely
    const parseDate = (val: any): Date | undefined => {
      if (!val) return undefined;
      const d = new Date(val);
      return isNaN(d.getTime()) ? undefined : d;
    };

    const newReport = new AssetReport({
      user: (req as any).user._id,
      grouping_mode: groupingMode,
      imageUrls: imageUrls,
      lots,
      analysis,
      // New metadata fields
      client_name: details.client_name,
      effective_date: parseDate(details.effective_date),
      appraisal_purpose: details.appraisal_purpose,
      owner_name: details.owner_name,
      appraiser: details.appraiser || (req as any)?.user?.name,
      appraisal_company: details.appraisal_company,
      industry: details.industry,
      inspection_date: parseDate(details.inspection_date),
    });

    startStep("save_report", "Persisting report to database");
    await newReport.save();
    endStep("save_report");
    // Generate PDF
    const reportObjectForPdf = newReport.toObject();
    startStep("generate_pdf", "Generating PDF");
    const pdfBuffer = await generateAssetPdfFromReport({
      ...reportObjectForPdf,
      inspector_name: (req as any)?.user?.name || "",
    });
    endStep("generate_pdf");

    // Ensure the reports directory exists
    const reportsDir = path.resolve(process.cwd(), "reports");
    await fs.mkdir(reportsDir, { recursive: true });

    // Save the PDF to the reports folder
    const filename = `asset-report-${newReport._id}-${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, filename);
    startStep("save_pdf_file", "Saving PDF file");
    await fs.writeFile(filePath, pdfBuffer);
    endStep("save_pdf_file");

    // Compute total estimated value if available
    // Handles ranges like "US$3,500–US$4,500" by averaging endpoints.
    const parseEstimated = (val: unknown): number => {
      if (!val) return 0;
      let s = String(val).trim();
      // normalize various dash characters to hyphen
      s = s.replace(/[\u2012\u2013\u2014\u2212]/g, "-");
      // extract numbers (with optional thousands separators and decimals)
      const matches = s.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?/g);
      if (!matches) return 0;
      const nums = matches
        .map((m) => parseFloat(m.replace(/,/g, "")))
        .filter((n) => Number.isFinite(n) && n >= 0);
      if (nums.length === 0) return 0;
      if (nums.length >= 2) {
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        return (min + max) / 2;
      }
      return nums[0];
    };

    const totalValue = (lots || []).reduce((sum: number, lot: any) => {
      return sum + parseEstimated(lot?.estimated_value);
    }, 0);
    const fairMarketValue =
      totalValue > 0
        ? `CAD ${Math.round(totalValue).toLocaleString("en-CA")}`
        : "N/A";

    // Create a record for the saved PDF
    const newPdfReport = new PdfReport({
      filename,
      user: (req as any).user._id,
      report: newReport._id,
      reportType: "Asset",
      reportModel: "AssetReport",
      address: `Asset Report (${lots.length} lots)`,
      fairMarketValue,
    });
    startStep("create_pdf_record", "Creating PDF record");
    await newPdfReport.save();
    endStep("create_pdf_record");

    // finalize progress
    if (progressId) {
      setServerProg01(1);
      endProgress(progressId, true, "Completed");
    }

    const totalDurationMs = Date.now() - processStartedAt;
    const weights = {
      client_upload: 0.25, // measured on client (axios upload progress)
      r2_upload: 0.15,
      ai_analysis: 0.35,
      generate_pdf: 0.2,
      finalize: 0.05,
    };

    res.status(201).json({
      message: "Asset report generated and saved successfully!",
      filePath: `/reports/${filename}`,
      data: newReport,
      progress: {
        steps,
        totalDurationMs,
        weights,
      },
    });
  } catch (error) {
    console.error("Error processing asset data:", error);
    try {
      const details = JSON.parse((req.body as any)?.details || "{}");
      const progressId: string | undefined =
        (typeof details?.progress_id === "string" && details.progress_id) ||
        (typeof details?.progressId === "string" && details.progressId) ||
        (typeof details?.job_id === "string" && details.job_id) ||
        undefined;
      if (progressId) endProgress(progressId, false, "Error processing request");
    } catch {}
    res.status(500).json({ message: "Error processing request", error });
  }
};

export const getAssetReports = async (req: AuthRequest, res: Response) => {
  try {
    const reports = await AssetReport.find({ user: req.userId }).sort({
      createdAt: -1,
    });
    res.status(200).json({
      message: "Asset reports fetched successfully!",
      data: reports,
    });
  } catch (error) {
    console.error("Error fetching asset reports:", error);
    res.status(500).json({ message: "Error fetching reports", error });
  }
};

export const getAssetProgress = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ message: "Missing progress id" });
    }
    const rec = getProgress(id);
    if (!rec) {
      return res.status(404).json({ message: "Not found" });
    }
    res.status(200).json({
      id: rec.id,
      phase: rec.phase,
      serverProgress01: rec.serverProgress01,
      steps: rec.steps,
      message: rec.message,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching progress", error });
  }
};

export const uploadMiddleware = upload.array("images", 10);
