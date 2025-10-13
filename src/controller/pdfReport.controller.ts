import { Request, Response } from "express";
import PdfReport from "../models/pdfReport.model.js";
import fs from "fs/promises";
import path from "path";
import type { AuthRequest } from "../middleware/auth.middleware.js";

// @desc    Download a specific report
// @route   GET /api/reports/:id/download
// @access  Private
export const downloadReport = async (req: AuthRequest, res: Response) => {
  try {
    const report = await PdfReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Users cannot download until the report is approved. Admins and superadmins can bypass.
    const role = (req as any)?.user?.role as string | undefined;
    const isAdmin = role === "admin" || role === "superadmin";
    // Non-admin users must be the owner
    if (!isAdmin) {
      if (String(report.user) !== String(req.userId)) {
        return res.status(403).json({ message: "Not authorized to download this report" });
      }
    }
    if (!isAdmin) {
      const status = (report as any).approvalStatus as 'pending' | 'approved' | 'rejected' | undefined;
      // Backward compatibility: missing status means pre-approval-era, allow download
      if (status && status !== "approved") {
        return res.status(403).json({ message: status === 'rejected' ? "Report was rejected" : "Report is not approved yet" });
      }
    }

    const preferred = (report as any).filePath as string | undefined;
    const candidates: string[] = [];
    if (preferred && preferred.trim().length > 0) {
      candidates.push(path.resolve(process.cwd(), preferred));
      const parts = preferred.split(/[\\/]+/).filter(Boolean);
      candidates.push(path.resolve(process.cwd(), ...parts));
    }
    candidates.push(path.resolve(process.cwd(), "reports", report.filename));
    if (process.env.REPORTS_DIR) {
      candidates.push(path.resolve(process.env.REPORTS_DIR, report.filename));
    }

    let found: string | null = null;
    for (const p of candidates) {
      try {
        await fs.access(p);
        found = p;
        break;
      } catch {}
    }
    if (!found) {
      return res.status(404).json({ message: "File not found on server" });
    }
    const origName = (report as any)?.filename || path.basename(found);
    let ext = path.extname(origName);
    if (!ext) {
      const ft = ((report as any)?.fileType || "") as string;
      ext = ft === "images" ? ".zip" : ft ? `.${ft}` : "";
    }
    const rt = String(((report as any)?.reportType || "report")).toLowerCase();
    const prefix = rt === "realestate" ? "real-estate" : rt;
    const cn = String(((report as any)?.contract_no || "")).trim();
    const downloadName = cn ? `${prefix}-${cn}${ext}` : origName;
    res.download(found, downloadName);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Delete a specific report
// @route   DELETE /api/reports/:id
// @access  Private
export const deleteReport = async (req: Request, res: Response) => {
  try {
    console.log(req.params.id);
    const report = await PdfReport.findById(req.params.id);
    console.log(report);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Remove file from server (prefer stored filePath if present)
    const preferred = (report as any).filePath as string | undefined;
    const filePath = preferred && preferred.trim().length > 0
      ? path.resolve(process.cwd(), preferred)
      : path.resolve(process.cwd(), "reports", report.filename);
    try {
      await fs.unlink(filePath);
    } catch (e: any) {
      if (e?.code !== "ENOENT") {
        // Only ignore missing file; rethrow other errors
        throw e;
      }
    }

    // Remove record from DB
    await report.deleteOne();

    res.json({ message: "Report removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Get all reports
// @route   GET /api/reports
// @access  Private (Admin)
export const getAllReports = async (req: Request, res: Response) => {
  try {
    const reports = await PdfReport.find({})
      .populate("user", "name email")
      .populate("report");
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Get reports for the logged-in user
// @route   GET /api/reports/myreports
// @access  Private
export const getReportsByUser = async (req: AuthRequest, res: Response) => {
  try {
    const reports = await PdfReport.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .lean();
    // Add 'type' alias for front-end compatibility
    const result = (reports || []).map((r: any) => ({ ...r, type: r.type ?? r.reportType }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Get report statistics for the logged-in user
// @route   GET /api/reports/stats
// @access  Private
export const getReportStats = async (req: AuthRequest, res: Response) => {
  try {
    const reports = await PdfReport.find({ user: req.userId });

    let totalReports = 0;
    let totalFairMarketValue = 0;

    if (reports && reports.length > 0) {
      totalReports = reports.length;

      for (const report of reports) {
        if (
          report.fairMarketValue &&
          typeof report.fairMarketValue === "string"
        ) {
          try {
            const numericString = report.fairMarketValue.replace(
              /[^\d.-]/g,
              ""
            );
            const value = parseFloat(numericString);
            if (!isNaN(value)) {
              totalFairMarketValue += value;
            }
          } catch (e) {
            console.error(
              `Could not parse fairMarketValue: ${report.fairMarketValue}`
            );
          }
        }
      }
    }

    res.json({ totalReports, totalFairMarketValue });
  } catch (error) {
    console.error("Error in getReportStats:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
