import { Request, Response } from "express";
import upload from "../utils/multerStorage.js";
import { uploadToR2 } from "../utils/r2Storage/r2Upload.js";
import { analyzeRealEstateImages } from "../service/openAIService.js";
import {
  findComparableProperties,
  SearchResult,
} from "../service/webSearchService.js";
import { calculateFairMarketValue } from "../service/valuationService.js";
import RealEstateReport from "../models/realEstate.model.js";
import { generatePdfFromReport } from "../service/pdfService.js";
import PdfReport from "../models/pdfReport.model.js";
import fs from "fs/promises";
import path from "path";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { endProgress, getProgress } from "../utils/progressStore.js";
import { queueRealEstateReportJob } from "../jobs/realEstateReportJob.js";
import {
  MarketTrend,
  marketTrendSearch,
  PropertyDetails,
} from "../service/marketTrendSebSearch.js";
import { generateRealEstateDocx } from "../service/docx/realEstateDocxBuilder.js";
import { generateRealEstateXlsx } from "../service/xlsx/realEstateXlsxService.js";

export const createRealEstate = async (req: AuthRequest, res: Response) => {
  try {
    const details = JSON.parse(req.body.details);
    const images = req.files as Express.Multer.File[];
    console.log(JSON.stringify(req.body, null, 2));

    const imageUrls: string[] = [];
    if (images?.length) {
      for (const file of images) {
        const timestamp = Date.now();
        const fileName = `uploads/real-estate/${timestamp}-${file.originalname}`;
        await uploadToR2(file, process.env.R2_BUCKET_NAME!, fileName);
        const fileUrl = `https://images.sellsnap.store/${fileName}`;
        imageUrls.push(fileUrl);
      }
    }

    let aiExtractedData = {};
    if (imageUrls.length > 0) {
      try {
        aiExtractedData = await analyzeRealEstateImages(imageUrls);
        console.log(
          "AI Extracted Data:",
          JSON.stringify(aiExtractedData, null, 2)
        );
      } catch (aiError) {
        console.error("Error during AI image analysis:", aiError);
        // Decide if you want to fail the request or proceed without AI data
        // For now, we'll proceed without it
      }
    }

    const finalData = {
      ...details,
      owner_name: details.property_details?.owner_name || "",
      house_details: {
        ...details.house_details,
        ...aiExtractedData,
      },
      imageUrls,
    };

    console.log("Final Combined Data:", JSON.stringify(finalData, null, 2));

    let comparableProperties: any = {};
    if (finalData.property_details.address) {
      try {
        comparableProperties = await findComparableProperties(
          finalData.property_details,
          finalData.house_details
        );
        console.log("Found Comparable Properties:", comparableProperties);
      } catch (searchError) {
        console.error(
          "Error during web search for comparable properties:",
          searchError
        );
      }
    }

    let valuation = {};
    const comparablePropertiesForValuation = Array.isArray(comparableProperties)
      ? comparableProperties
      : [];
    if (comparablePropertiesForValuation.length > 0) {
      try {
        valuation = await calculateFairMarketValue(
          finalData,
          comparablePropertiesForValuation
        );
        console.log("Calculated Valuation:", valuation);
      } catch (valuationError) {
        console.error("Error during valuation:", valuationError);
      }
    }

    // Fetch market trend data
    let marketTrendData: MarketTrend[] = [];
    if (
      finalData.property_details.address &&
      finalData.property_details.municipality
    ) {
      try {
        const propertyDetails: PropertyDetails = {
          address: finalData.property_details.address,
          municipality: finalData.property_details.municipality,
        };
        marketTrendData = await marketTrendSearch(propertyDetails);
        console.log("Market Trend Data:", marketTrendData);
      } catch (marketTrendError) {
        console.error("Error during market trend search:", marketTrendError);
      }
    }

    // Save the final report to the database
    const comparablePropertiesMap = new Map();
    if (Array.isArray(comparablePropertiesForValuation)) {
      comparablePropertiesForValuation.forEach((comp: any) => {
        const { name, ...details } = comp;
        comparablePropertiesMap.set(name, details);
      });
    }

    const newReport = new RealEstateReport({
      user: (req as any).user._id, // Get user ID from the protect middleware
      ...finalData,
      comparableProperties: comparablePropertiesMap,
      valuation,
      marketTrend: marketTrendData,
    });

    await newReport.save();

    console.log("New Report:", newReport);

    // Generate the PDF
    // Manually construct the object for the PDF to ensure Map is converted correctly
    const reportObjectForPdf = newReport.toObject();
    reportObjectForPdf.comparableProperties = Object.fromEntries(
      comparablePropertiesMap
    );

    const pdfBuffer = await generatePdfFromReport(reportObjectForPdf);

    // Ensure the reports directory exists
    const reportsDir = path.resolve(process.cwd(), "reports");
    await fs.mkdir(reportsDir, { recursive: true });

    // Save the PDF to the reports folder
    const timestamp = Date.now();
    const pdfFilename = `real-estate-report-${newReport._id}-${timestamp}.pdf`;
    const pdfFilePath = path.join(reportsDir, pdfFilename);
    await fs.writeFile(pdfFilePath, pdfBuffer);

    // Generate DOCX
    let docxPublicPath = "";
    try {
      const docxBuffer = await generateRealEstateDocx(reportObjectForPdf);
      const docxFilename = `real-estate-report-${newReport._id}-${timestamp}.docx`;
      const docxFilePath = path.join(reportsDir, docxFilename);
      await fs.writeFile(docxFilePath, docxBuffer);
      docxPublicPath = `/reports/${docxFilename}`;

      // Save record for DOCX
      const docxReport = new PdfReport({
        filename: docxFilename,
        fileType: "docx",
        filePath: `reports/${docxFilename}`,
        user: req.userId,
        report: newReport._id,
        reportType: "RealEstate",
        reportModel: "RealEstateReport",
        address: newReport.property_details?.address || "",
        fairMarketValue: newReport.valuation?.fair_market_value || "",
      });
      await docxReport.save();
    } catch (e) {
      console.error("Failed to generate DOCX for real estate:", e);
    }

    // Generate XLSX
    let xlsxPublicPath = "";
    try {
      const xlsxBuffer = await generateRealEstateXlsx(reportObjectForPdf);
      const xlsxFilename = `real-estate-report-${newReport._id}-${timestamp}.xlsx`;
      const xlsxFilePath = path.join(reportsDir, xlsxFilename);
      await fs.writeFile(xlsxFilePath, xlsxBuffer);
      xlsxPublicPath = `/reports/${xlsxFilename}`;

      // Save record for XLSX
      const xlsxReport = new PdfReport({
        filename: xlsxFilename,
        fileType: "xlsx",
        filePath: `reports/${xlsxFilename}`,
        user: req.userId,
        report: newReport._id,
        reportType: "RealEstate",
        reportModel: "RealEstateReport",
        address: newReport.property_details?.address || "",
        fairMarketValue: newReport.valuation?.fair_market_value || "",
      });
      await xlsxReport.save();
    } catch (e) {
      console.error("Failed to generate XLSX for real estate:", e);
    }

    // Create a record for the saved PDF
    const newPdfReport = new PdfReport({
      filename: pdfFilename,
      user: req.userId,
      report: newReport._id,
      reportType: "RealEstate",
      reportModel: "RealEstateReport",
      address: newReport.property_details?.address || "",
      fairMarketValue: newReport.valuation?.fair_market_value || "",
      fileType: "pdf",
      filePath: `reports/${pdfFilename}`,
    });
    await newPdfReport.save();

    res.status(201).json({
      message: "Report generated and saved successfully!",
      filePath: `/reports/${pdfFilename}`,
      docxPath: docxPublicPath,
      xlsxPath: xlsxPublicPath,
    });
  } catch (error) {
    console.error("Error processing real estate data:", error);
    res.status(500).json({ message: "Error processing request", error });
  }
};

export const getRealEstateReports = async (req: AuthRequest, res: Response) => {
  try {
    const reports = await RealEstateReport.find({
      user: req.userId,
    }).sort({ createdAt: -1 });
    res.status(200).json({
      message: "Reports fetched successfully!",
      data: reports,
    });
  } catch (error) {
    console.error("Error fetching real estate reports:", error);
    res.status(500).json({ message: "Error fetching reports", error });
  }
};

export const uploadMiddleware = upload.array("images", 10);

// Background job variant (queue and return a job id)
export const createRealEstateQueued = async (req: AuthRequest, res: Response) => {
  try {
    const details = JSON.parse((req.body as any)?.details || "{}");
    const images = req.files as Express.Multer.File[];

    const providedId: string | undefined =
      (typeof details?.progress_id === "string" && details.progress_id) ||
      (typeof details?.progressId === "string" && details.progressId) ||
      (typeof details?.job_id === "string" && details.job_id) ||
      undefined;
    const jobId =
      providedId || `cv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const user = (req as any)?.user;
    queueRealEstateReportJob({
      user: { id: String(user?._id), email: String(user?.email || ""), name: (user as any)?.name || (user as any)?.username || undefined },
      images,
      details,
      progressId: jobId,
    });

    res.status(202).json({
      message: "Your real estate report is being processed. You will receive an email when it's ready.",
      jobId,
      phase: (getProgress(jobId)?.phase) || "processing",
    });
  } catch (error) {
    console.error("Error queueing real estate job:", error);
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

export const getRealEstateProgress = async (req: AuthRequest, res: Response) => {
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
