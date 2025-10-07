import { Response } from "express";
import upload from "../utils/multerStorage.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { endProgress, getProgress } from "../utils/progressStore.js";
import { queueAssetReportJob } from "../jobs/assetReportJob.js";
import AssetReport from "../models/asset.model.js";

export type AssetGroupingMode =
  | "single_lot"
  | "per_item"
  | "per_photo"
  | "catalogue"
  | "combined"
  | "mixed";

export const createAssetReport = async (req: AuthRequest, res: Response) => {
  try {
    const details = JSON.parse(req.body.details || "{}");
    // Support both array-style (single field) and fields-style (images/videos)
    let images: Express.Multer.File[] = [];
    let videos: Express.Multer.File[] = [];
    const anyFiles = req.files as any;
    if (Array.isArray(anyFiles)) {
      images = anyFiles as Express.Multer.File[];
    } else if (anyFiles && typeof anyFiles === "object") {
      images = Array.isArray(anyFiles.images) ? (anyFiles.images as Express.Multer.File[]) : [];
      videos = Array.isArray(anyFiles.videos) ? (anyFiles.videos as Express.Multer.File[]) : [];
    }

    const providedId: string | undefined =
      (typeof details?.progress_id === "string" && details.progress_id) ||
      (typeof details?.progressId === "string" && details.progressId) ||
      (typeof details?.job_id === "string" && details.job_id) ||
      undefined;
    const jobId =
      providedId || `cv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Enqueue background processing job
    const user = (req as any)?.user;
    queueAssetReportJob({
      user: { id: String(user?._id), email: String(user?.email || ""), name: (user as any)?.name || (user as any)?.username || undefined },
      images,
      videos,
      details,
      progressId: jobId,
    });

    res.status(202).json({
      message:
        "Your report is being processed. You will receive an email when it's ready.",
      jobId,
      phase: (getProgress(jobId)?.phase) || "processing",
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

// Accept both images and videos in memory; images are used for AI and reports, videos are zipped with originals only
export const uploadMiddleware = upload.fields([
  { name: "images", maxCount: 500 },
  { name: "videos", maxCount: 50 },
]);
