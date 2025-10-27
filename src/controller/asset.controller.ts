import { Response } from "express";
import upload from "../utils/multerStorage.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { endProgress, getProgress } from "../utils/progressStore.js";
import AssetReport from "../models/asset.model.js";
import { queuePreviewFilesJob } from "../jobs/assetReportJob.js";

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

    // Enqueue NEW preview workflow job (AI processing only, no DOCX generation)
    const user = (req as any)?.user;
    const { runAssetPreviewJob } = await import("../jobs/assetReportJob.js");
    
    // Run preview job in background
    setImmediate(() =>
      runAssetPreviewJob({
        user: { id: String(user?._id), email: String(user?.email || ""), name: (user as any)?.name || (user as any)?.username || undefined },
        images,
        videos,
        details,
        progressId: jobId,
      }).catch((e) => {
        console.error("Asset preview job failed:", e);
        if (jobId) endProgress(jobId, false, "Error processing request");
      })
    );

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

/**
 * Get preview data for editing
 */
export const getPreviewData = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const report = await AssetReport.findOne({
      _id: id,
      user: req.userId,
    });

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Only allow preview for reports in preview or declined status
    if (report.status !== 'preview' && report.status !== 'declined') {
      return res.status(400).json({ 
        message: `Cannot preview report with status: ${report.status}` 
      });
    }

    res.status(200).json({
      message: "Preview data fetched successfully",
      data: {
        status: report.status,
        preview_data: report.preview_data,
        grouping_mode: report.grouping_mode,
        image_count: Array.isArray(report.imageUrls) ? report.imageUrls.length : 0,
        decline_reason: report.decline_reason,
        reportId: report._id,
      },
    });
  } catch (error) {
    console.error("Error fetching preview data:", error);
    res.status(500).json({ message: "Error fetching preview data", error });
  }
};

/**
 * Update preview data with user edits
 */
export const updatePreviewData = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { preview_data } = req.body;

    if (!preview_data) {
      return res.status(400).json({ message: "preview_data is required" });
    }

    const report = await AssetReport.findOne({
      _id: id,
      user: req.userId,
    });

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Only allow updates for preview or declined status
    if (report.status !== 'preview' && report.status !== 'declined') {
      return res.status(400).json({ 
        message: `Cannot update report with status: ${report.status}` 
      });
    }

    // Update preview data
    report.preview_data = preview_data;
    await report.save();

    res.status(200).json({
      message: "Preview data updated successfully",
      data: report.preview_data,
    });
  } catch (error) {
    console.error("Error updating preview data:", error);
    res.status(500).json({ message: "Error updating preview data", error });
  }
};

/**
 * Submit report for admin approval
 */
export const submitForApproval = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const report = await AssetReport.findOne({
      _id: id,
      user: req.userId,
    }).populate('user');

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Only allow submission from preview or declined status
    if (report.status !== 'preview' && report.status !== 'declined') {
      return res.status(400).json({ 
        message: `Cannot submit report with status: ${report.status}` 
      });
    }

    // Validate preview_data exists
    if (!report.preview_data) {
      return res.status(400).json({ 
        message: "Preview data is missing. Please review the report first." 
      });
    }

    // Update status and timestamps
    report.status = 'pending_approval';
    report.preview_submitted_at = new Date();
    report.approval_requested_at = new Date();
    await report.save();

    // Queue background job to generate preview files and send notifications when ready
    await queuePreviewFilesJob(String(report._id));

    res.status(202).json({
      message: "Submission received. Preparing files in background; you'll get an email when ready.",
      data: {
        reportId: report._id,
        status: report.status,
        approval_requested_at: report.approval_requested_at,
      },
    });
  } catch (error) {
    console.error("Error submitting for approval:", error);
    res.status(500).json({ message: "Error submitting for approval", error });
  }
};

/**
 * Approve report (Admin only)
 */
export const approveReport = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check admin role
    const user = (req as any).user;
    if (user.role !== 'admin' && !user.isAdmin) {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const report = await AssetReport.findById(id).populate('user');

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (report.status !== 'pending_approval') {
      return res.status(400).json({ 
        message: `Cannot approve report with status: ${report.status}` 
      });
    }

    // Update status
    report.status = 'approved';
    report.approval_processed_at = new Date();
    await report.save();

    // Queue DOCX generation job
    const { queueDocxGenerationJob } = await import("../jobs/assetReportJob.js");
    await queueDocxGenerationJob(String(report._id));

    // Send approval email
    const { sendReportApprovedEmail } = await import("../service/assetEmailService.js");
    const reportUser = report.user as any;
    await sendReportApprovedEmail(
      reportUser.email,
      reportUser.name || reportUser.username || 'User',
      String(report._id)
    );

    res.status(200).json({
      message: "Report approved successfully. DOCX generation started.",
      data: {
        reportId: report._id,
        status: report.status,
      },
    });
  } catch (error) {
    console.error("Error approving report:", error);
    res.status(500).json({ message: "Error approving report", error });
  }
};

/**
 * Decline report (Admin only)
 */
export const declineReport = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Check admin role
    const user = (req as any).user;
    if (user.role !== 'admin' && !user.isAdmin) {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ 
        message: "Decline reason is required (minimum 10 characters)" 
      });
    }

    const report = await AssetReport.findById(id).populate('user');

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (report.status !== 'pending_approval') {
      return res.status(400).json({ 
        message: `Cannot decline report with status: ${report.status}` 
      });
    }

    // Update status
    report.status = 'declined';
    report.decline_reason = reason;
    report.approval_processed_at = new Date();
    await report.save();

    // Send decline email
    const { sendReportDeclinedEmail } = await import("../service/assetEmailService.js");
    const reportUser = report.user as any;
    await sendReportDeclinedEmail(
      reportUser.email,
      reportUser.name || reportUser.username || 'User',
      String(report._id),
      reason
    );

    res.status(200).json({
      message: "Report declined successfully",
      data: {
        reportId: report._id,
        status: report.status,
        decline_reason: report.decline_reason,
      },
    });
  } catch (error) {
    console.error("Error declining report:", error);
    res.status(500).json({ message: "Error declining report", error });
  }
};
