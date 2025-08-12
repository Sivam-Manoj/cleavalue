import { Response } from "express";
import upload from "../utils/multerStorage.js";
import { uploadToR2 } from "../utils/r2Storage/r2Upload.js";
import SalvageReport from "../models/salvage.model.js";
import { generateSalvagePdfFromReport } from "../service/salvagePdfService.js";
import { analyzeSalvageImages } from "../service/salvageOpenAIService.js";
import { findComparableSalvageItems } from "../service/salvageWebSearchService.js";
import { calculateSalvageValue } from "../service/salvageValuationService.js";
import PdfReport from "../models/pdfReport.model.js";
import fs from "fs/promises";
import path from "path";
import { AuthRequest } from "../middleware/auth.middleware.js";

export const createSalvageReport = async (req: AuthRequest, res: Response) => {
  try {
    const details = JSON.parse(req.body.details);
    const images = req.files as Express.Multer.File[];

    const imageUrls: string[] = [];
    if (images?.length) {
      for (const file of images) {
        const timestamp = Date.now();
        const fileName = `uploads/salvage/${timestamp}-${file.originalname}`;
        await uploadToR2(file, process.env.R2_BUCKET_NAME!, fileName);
        const fileUrl = `https://images.sellsnap.store/${fileName}`;
        imageUrls.push(fileUrl);
      }
    }

    // Step 2: Analyze images with OpenAI
    const aiExtractedDetails = await analyzeSalvageImages(imageUrls);

    // Step 3: Find comparable items
    const comparableItems = await findComparableSalvageItems(aiExtractedDetails);

    // Step 4: Calculate valuation
    const valuation = await calculateSalvageValue(details.cause_of_loss_summary, comparableItems);

    const finalData = {
      ...details,
      imageUrls,
      aiExtractedDetails,
      comparableItems,
      valuation,
      item_type: aiExtractedDetails.item_type,
      year: aiExtractedDetails.year,
      make: aiExtractedDetails.make,
      item_model: aiExtractedDetails.item_model,
      vin: aiExtractedDetails.vin,
      item_condition: aiExtractedDetails.item_condition,
      damage_description: aiExtractedDetails.damage_description,
      inspection_comments: aiExtractedDetails.inspection_comments,
      is_repairable: aiExtractedDetails.is_repairable,
      repair_facility: aiExtractedDetails.repair_facility,
      repair_facility_comments: aiExtractedDetails.repair_facility_comments,
      repair_estimate: aiExtractedDetails.repair_estimate,
      actual_cash_value: aiExtractedDetails.actual_cash_value,
      replacement_cost: aiExtractedDetails.replacement_cost,
      replacement_cost_references: aiExtractedDetails.replacement_cost_references,
      recommended_reserve: aiExtractedDetails.recommended_reserve,
    };

    const newReport = new SalvageReport({
      user: (req as any).user._id,
      ...finalData,
    });

    await newReport.save();

    const reportObjectForPdf = newReport.toObject();
    const pdfBuffer = await generateSalvagePdfFromReport(reportObjectForPdf);

    const reportsDir = path.resolve(process.cwd(), "reports");
    await fs.mkdir(reportsDir, { recursive: true });

    const filename = `salvage-report-${newReport._id}-${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, filename);
    await fs.writeFile(filePath, pdfBuffer);

    const newPdfReport = new PdfReport({
      filename: filename,
      user: req.userId,
      report: newReport._id,
      reportType: "Salvage",
      reportModel: "SalvageReport",
      address: newReport.file_number, // Using file_number as an identifier
      fairMarketValue: valuation.fairMarketValue,
    });
    await newPdfReport.save();

    res.status(201).json({
      message: "Salvage report generated and saved successfully!",
      filePath: `/reports/${filename}`,
    });
  } catch (error) {
    console.error("Error processing salvage data:", error);
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
