import { Response } from "express";
import upload from "../utils/multerStorage.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { queueSalvageReportJob } from "../jobs/salvageReportJob.js";
import SalvageReport from "../models/salvage.model.js";
import { endProgress, getProgress } from "../utils/progressStore.js";

export const createSalvageReport = async (req: AuthRequest, res: Response) => {
  try {
    const details = JSON.parse(req.body.details || "{}");
    const images = req.files as Express.Multer.File[];

    const providedId: string | undefined =
      (typeof details?.progress_id === "string" && details.progress_id) ||
      (typeof details?.progressId === "string" && details.progressId) ||
      (typeof details?.job_id === "string" && details.job_id) ||
      undefined;
    const jobId =
      providedId || `cv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const user = (req as any)?.user;
    queueSalvageReportJob({
      user: { id: String(user?._id), email: String(user?.email || ""), name: (user as any)?.name || (user as any)?.username || undefined },
      images,
      details,
      progressId: jobId,
    });

    res.status(202).json({
      message: "Your salvage report is being processed. You'll get an email when it's ready.",
      jobId,
      phase: getProgress(jobId)?.phase || "processing",
    });
  } catch (error) {
    console.error("Error processing salvage data:", error);
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

export const getSalvageReports = async (req: AuthRequest, res: Response) => {
  try {
    const reports = await SalvageReport.find({
      user: req.userId,
    }).sort({ createdAt: -1 });
    res.status(200).json({
      message: "Salvage reports fetched successfully!",
      data: reports,
    });
  } catch (error) {
    console.error("Error fetching salvage reports:", error);
    res.status(500).json({ message: "Error fetching reports", error });
  }
};

export const uploadMiddleware = upload.array("images", 10);

export const getSalvageProgress = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: "Missing progress id" });
    const rec = getProgress(id);
    if (!rec) return res.status(404).json({ message: "Not found" });
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
