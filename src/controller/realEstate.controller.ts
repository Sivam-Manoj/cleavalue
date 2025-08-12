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
import {
  MarketTrend,
  marketTrendSearch,
  PropertyDetails,
} from "../service/marketTrendSebSearch.js";

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
    const filename = `real-estate-report-${newReport._id}-${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, filename);
    await fs.writeFile(filePath, pdfBuffer);

    // Create a record for the saved PDF
    const newPdfReport = new PdfReport({
      filename: filename,
      user: req.userId,
      report: newReport._id,
      reportType: "RealEstate",
      reportModel: "RealEstateReport",
      address: newReport.property_details?.address || "",
      fairMarketValue: newReport.valuation?.fair_market_value || "",
    });
    await newPdfReport.save();

    res.status(201).json({
      message: "Report generated and saved successfully!",
      filePath: `/reports/${filename}`,
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
