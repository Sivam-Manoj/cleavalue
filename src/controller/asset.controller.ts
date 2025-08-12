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

    const imageUrls: string[] = [];
    if (images?.length) {
      for (const file of images) {
        const timestamp = Date.now();
        const fileName = `uploads/asset/${timestamp}-${file.originalname}`;
        await uploadToR2(file, process.env.R2_BUCKET_NAME!, fileName);
        const fileUrl = `https://images.sellsnap.store/${fileName}`;
        imageUrls.push(fileUrl);
      }
    }

    // Limit 10 images as per upload middleware
    const urlsForAI = imageUrls.slice(0, 10);

    let analysis: AssetAnalysisResult | null = null;
    if (urlsForAI.length > 0) {
      try {
        analysis = await analyzeAssetImages(urlsForAI, groupingMode);
      } catch (e) {
        console.error("Error during asset AI analysis:", e);
        // proceed without analysis
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

      const urls = idxs.map((i: number) => imageUrls[i]).filter(Boolean);

      return {
        ...lot,
        image_indexes: idxs,
        image_urls: urls,
      };
    });

    const newReport = new AssetReport({
      user: (req as any).user._id,
      grouping_mode: groupingMode,
      imageUrls: imageUrls,
      lots,
      analysis,
    });

    await newReport.save();
    // Generate PDF
    const reportObjectForPdf = newReport.toObject();
    const pdfBuffer = await generateAssetPdfFromReport({
      ...reportObjectForPdf,
      inspector_name: (req as any)?.user?.name || "",
    });

    // Ensure the reports directory exists
    const reportsDir = path.resolve(process.cwd(), "reports");
    await fs.mkdir(reportsDir, { recursive: true });

    // Save the PDF to the reports folder
    const filename = `asset-report-${newReport._id}-${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, filename);
    await fs.writeFile(filePath, pdfBuffer);

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
    await newPdfReport.save();

    res.status(201).json({
      message: "Asset report generated and saved successfully!",
      filePath: `/reports/${filename}`,
      data: newReport,
    });
  } catch (error) {
    console.error("Error processing asset data:", error);
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

export const uploadMiddleware = upload.array("images", 10);
