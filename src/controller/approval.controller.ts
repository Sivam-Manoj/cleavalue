import { Request, Response } from "express";
import PdfReport from "../models/pdfReport.model.js";
import { sendEmail } from "../utils/sendVerificationEmail.js";

// List pending reports for approval (admins and superadmins)
export const getPendingReports = async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt((req.query.page as string) || "1", 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "20", 10) || 20, 1), 100);

    const filter: any = { approvalStatus: "pending" };
    const [items, total] = await Promise.all([
      PdfReport.find(filter)
        .populate("user", "email username")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      PdfReport.countDocuments(filter),
    ]);

    return res.status(200).json({ items, total, page, limit });
  } catch (e) {
    console.error("getPendingReports error", e);
    return res.status(500).json({ message: "Failed to fetch pending reports" });
  }
};

// Approve a report and notify the owner
export const approveReport = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const adminUser = req.user; // from adminProtect
    const report = await PdfReport.findById(id).populate("user", "email username");
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.approvalStatus = "approved" as any;
    report.approvalNote = "";
    report.reviewedBy = adminUser?._id;
    report.reviewedAt = new Date();
    await report.save();

    const to = (report as any).user?.email as string | undefined;
    if (to) {
      const webUrl = process.env.WEB_APP_URL || "http://localhost:3000";
      const subject = "Your ClearValue report was approved";
      const html = `
        <div style="font-family: Inter, Arial, sans-serif;">
          <h2 style="color:#111827;">Report Approved ✅</h2>
          <p>Hi ${(report as any).user?.username || "there"},</p>
          <p>Your report has been approved by ${adminUser?.username || adminUser?.email}.</p>
          <ul>
            <li><strong>Type:</strong> ${report.reportType}</li>
            <li><strong>Address:</strong> ${report.address}</li>
            <li><strong>FMV:</strong> ${report.fairMarketValue}</li>
            <li><strong>Created:</strong> ${new Date(report.createdAt as any).toLocaleString()}</li>
          </ul>
          <p>You can now download your report from your dashboard.</p>
          <p><a href="${webUrl}/reports" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;">Go to Reports</a></p>
          <hr/>
          <p style="color:#6b7280;font-size:12px;">Approved by: ${adminUser?.username || "Admin"} (${adminUser?.email})</p>
        </div>
      `;
      try {
        await sendEmail(to, subject, html);
      } catch (err) {
        console.error("Failed to send approval email", err);
      }
    }

    return res.status(200).json({ message: "Report approved" });
  } catch (e) {
    console.error("approveReport error", e);
    return res.status(500).json({ message: "Failed to approve report" });
  }
};

// Reject a report with a note and notify the owner
export const rejectReport = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body || {};
    if (!note || typeof note !== "string" || !note.trim()) {
      return res.status(400).json({ message: "Rejection note is required" });
    }
    const adminUser = req.user; // from adminProtect
    const report = await PdfReport.findById(id).populate("user", "email username");
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.approvalStatus = "rejected" as any;
    report.approvalNote = note.trim();
    report.reviewedBy = adminUser?._id;
    report.reviewedAt = new Date();
    await report.save();

    const to = (report as any).user?.email as string | undefined;
    if (to) {
      const subject = "Your ClearValue report was rejected";
      const html = `
        <div style="font-family: Inter, Arial, sans-serif;">
          <h2 style="color:#111827;">Report Rejected ❌</h2>
          <p>Hi ${(report as any).user?.username || "there"},</p>
          <p>Your report was reviewed by ${adminUser?.username || adminUser?.email} and unfortunately it was not approved at this time.</p>
          <ul>
            <li><strong>Type:</strong> ${report.reportType}</li>
            <li><strong>Address:</strong> ${report.address}</li>
            <li><strong>FMV:</strong> ${report.fairMarketValue}</li>
            <li><strong>Created:</strong> ${new Date(report.createdAt as any).toLocaleString()}</li>
          </ul>
          <p><strong>Reason:</strong> ${report.approvalNote}</p>
          <hr/>
          <p style="color:#6b7280;font-size:12px;">Reviewed by: ${adminUser?.username || "Admin"} (${adminUser?.email})</p>
        </div>
      `;
      try {
        await sendEmail(to, subject, html);
      } catch (err) {
        console.error("Failed to send rejection email", err);
      }
    }

    return res.status(200).json({ message: "Report rejected" });
  } catch (e) {
    console.error("rejectReport error", e);
    return res.status(500).json({ message: "Failed to reject report" });
  }
};
