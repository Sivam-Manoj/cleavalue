import { Request, Response } from "express";
import PdfReport from "../models/pdfReport.model.js";
import fs from "fs/promises";
import path from "path";
import { AuthRequest } from "../types/authRequest.js";

// @desc    Download a specific report
// @route   GET /api/reports/:id/download
// @access  Private
export const downloadReport = async (req: AuthRequest, res: Response) => {
  try {
    const report = await PdfReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const filePath = path.resolve(process.cwd(), "reports", report.filename);
    res.download(filePath);
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

    // Remove file from server
    const filePath = path.resolve(process.cwd(), "reports", report.filename);
    await fs.unlink(filePath);

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
    const reports = await PdfReport.find({ user: req.userId });
    res.json(reports);
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
