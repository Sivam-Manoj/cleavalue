import { Request, Response } from "express";
import PdfReport from "../models/pdfReport.model.js";
import AssetReport from "../models/asset.model.js";
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
    // Get old-style PdfReports
    const pdfReports = await PdfReport.find({ user: req.userId })
      .populate({
        path: 'report',
        select: 'valuation_data include_valuation_table valuation_methods',
      })
      .sort({ createdAt: -1 })
      .lean();
    
    // Get new-style approved AssetReports
    const approvedAssetReports = await AssetReport.find({ 
      user: req.userId,
      status: 'approved'
    })
      .sort({ createdAt: -1 })
      .lean();
    
    // Convert PdfReports to result format
    const pdfResults = (pdfReports || []).map((r: any) => {
      const populatedReport = r.report as any;
      let valuationMethods: any[] = [];
      if (populatedReport?.include_valuation_table && populatedReport?.valuation_data?.methods) {
        valuationMethods = populatedReport.valuation_data.methods.map((m: any) => ({
          method: m.method,
          value: m.value,
        }));
      }
      
      // Ensure fairMarketValue is properly formatted with currency
      let fmv = r.fairMarketValue;
      if (fmv && typeof fmv === 'number') {
        // If it's a raw number, format it with default currency
        const currency = r.currency || 'CAD';
        fmv = new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency, 
          maximumFractionDigits: 0 
        }).format(fmv);
      } else if (!fmv || fmv === '0' || fmv === 0) {
        // If empty or zero, show currency code
        const currency = r.currency || 'CAD';
        fmv = `${currency} 0.00`;
      }
      
      return { 
        ...r,
        fairMarketValue: fmv,
        type: r.type ?? r.reportType,
        valuationMethods: valuationMethods.length > 0 ? valuationMethods : undefined,
      };
    });
    
    // Convert approved AssetReports to match PdfReport format
    const assetResults = (approvedAssetReports || []).map((r: any) => {
      const previewData = r.preview_data || {};
      
      // Calculate and format FMV with currency
      const currency = String(previewData?.currency || r.currency || 'CAD').toUpperCase();
      const baseFMV = previewData?.valuation_data?.baseFMV;
      const lots: any[] = Array.isArray(previewData?.lots) ? previewData.lots : (Array.isArray(r.lots) ? r.lots : []);
      const sumFromLots = (lots || []).reduce((acc: number, lot: any) => {
        const raw = typeof lot?.estimated_value === 'string' ? lot.estimated_value : '';
        const num = parseFloat(String(raw).replace(/[^0-9.-]+/g, ''));
        return acc + (Number.isFinite(num) ? num : 0);
      }, 0);
      const total = Number.isFinite(baseFMV as any) ? (baseFMV as number) : sumFromLots;
      const fmvStr = total > 0 
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(total)
        : `${currency} 0.00`;
      
      let valuationMethods: any[] = [];
      if (r.include_valuation_table && r.valuation_data?.methods) {
        valuationMethods = r.valuation_data.methods.map((m: any) => ({
          method: m.method,
          value: m.value,
        }));
      }
      
      return {
        _id: r._id,
        user: r.user,
        type: 'Asset',
        reportType: 'Asset',
        clientName: previewData.client_name || previewData.prepared_for || '',
        address: previewData.client_name || previewData.prepared_for || 'Asset Report',
        filename: `${previewData.client_name || 'Asset Report'}.docx`,
        fairMarketValue: fmvStr,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        status: 'approved',
        approvalStatus: 'approved',
        contract_no: previewData.contract_no,
        valuationMethods: valuationMethods.length > 0 ? valuationMethods : undefined,
        preview_files: r.preview_files,
      };
    });
    
    // Combine and sort by createdAt (newest first)
    const allReports = [...pdfResults, ...assetResults].sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    res.json(allReports);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Get report statistics for the logged-in user
// @route   GET /api/reports/stats
// @access  Private
export const getReportStats = async (req: AuthRequest, res: Response) => {
  try {
    const reports = await PdfReport.find({ user: req.userId }).lean();

    const groups = new Map<string, any>();
    for (const r of reports || []) {
      const key = String((r as any).report || (r as any)._id);
      if (!groups.has(key)) groups.set(key, r);
    }

    let totalFairMarketValue = 0;
    // Track valuation method breakdown
    const methodCounts: Record<string, number> = { FMV: 0, OLV: 0, FLV: 0, TKV: 0 };
    const methodValues: Record<string, number> = { FMV: 0, OLV: 0, FLV: 0, TKV: 0 };
    const processedReports = new Set<string>();

    // Process completed PdfReports (already approved/generated)
    for (const r of groups.values()) {
      const fmv = (r as any)?.fairMarketValue;
      if (fmv && typeof fmv === "string") {
        try {
          const numericString = fmv.replace(/[^\d.-]/g, "");
          const value = parseFloat(numericString);
          if (!isNaN(value)) totalFairMarketValue += value;
        } catch {}
      }

      // Process valuation breakdown from PdfReport
      const reportKey = String((r as any).report || (r as any)._id);
      if ((r as any).valuation_data && !processedReports.has(reportKey)) {
        processedReports.add(reportKey);
        const vData = (r as any).valuation_data;
        const methods = vData.methods || [];
        
        for (const m of methods) {
          const method = String(m.method || "").toUpperCase();
          if (method === "FMV" || method === "FML") {
            methodCounts.FMV += 1;
            methodValues.FMV += m.value || 0;
          } else if (method === "OLV") {
            methodCounts.OLV += 1;
            methodValues.OLV += m.value || 0;
          } else if (method === "FLV") {
            methodCounts.FLV += 1;
            methodValues.FLV += m.value || 0;
          } else if (method === "TKV") {
            methodCounts.TKV += 1;
            methodValues.TKV += m.value || 0;
          }
        }
      }
    }

    // Process pending AssetReports (not yet approved)
    const pendingAssets = await AssetReport.find({
      user: req.userId,
      status: { $in: ["preview", "pending_approval"] },
    })
      .select("_id preview_data lots valuation_methods valuation_data include_valuation_table")
      .lean();

    for (const ar of pendingAssets || []) {
      const key = String((ar as any)._id);
      if (groups.has(key)) continue;
      let total = 0;
      const pd = (ar as any).preview_data || {};
      const raw = (pd as any).total_value ?? (pd as any).total_appraised_value;
      if (typeof raw === "number") {
        total = raw;
      } else if (raw != null) {
        const parsed = parseFloat(String(raw).replace(/[^0-9.-]+/g, ""));
        total = Number.isFinite(parsed) ? parsed : 0;
      } else if (Array.isArray((ar as any).lots)) {
        total = ((ar as any).lots as any[]).reduce((acc: number, lot: any) => {
          const v = parseFloat(String(lot?.estimated_value || "").replace(/[^0-9.-]+/g, ""));
          return acc + (Number.isFinite(v) ? v : 0);
        }, 0);
      }
      if (total > 0) totalFairMarketValue += total;
      groups.set(key, ar);

      // Process valuation breakdown from pending AssetReport if not already processed
      if ((ar as any).include_valuation_table && (ar as any).valuation_data && !processedReports.has(key)) {
        processedReports.add(key);
        const vData = (ar as any).valuation_data;
        const methods = vData.methods || [];
        
        for (const m of methods) {
          const method = String(m.method || "").toUpperCase();
          if (method === "FMV" || method === "FML") {
            methodCounts.FMV += 1;
            methodValues.FMV += m.value || 0;
          } else if (method === "OLV") {
            methodCounts.OLV += 1;
            methodValues.OLV += m.value || 0;
          } else if (method === "FLV") {
            methodCounts.FLV += 1;
            methodValues.FLV += m.value || 0;
          } else if (method === "TKV") {
            methodCounts.TKV += 1;
            methodValues.TKV += m.value || 0;
          }
        }
      }
    }

    const totalReports = groups.size;
    res.json({ 
      totalReports, 
      totalFairMarketValue,
      breakdown: {
        counts: methodCounts,
        values: methodValues,
      },
    });
  } catch (error) {
    console.error("Error in getReportStats:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
