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

export const createRealEstate = async (req: Request, res: Response) => {
  try {
    const details = JSON.parse(req.body.details);
    const images = req.files as Express.Multer.File[];

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
      house_details: {
        ...details.house_details,
        ...aiExtractedData,
      },
      imageUrls,
    };

    console.log("Final Combined Data:", JSON.stringify(finalData, null, 2));

    let comparableProperties: SearchResult[] = [];
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
    if (comparableProperties.length > 0) {
      try {
        valuation = await calculateFairMarketValue(
          finalData,
          comparableProperties
        );
        console.log("Calculated Valuation:", valuation);
      } catch (valuationError) {
        console.error("Error during valuation:", valuationError);
      }
    }

    // Save the final report to the database
    const newReport = new RealEstateReport({
      user: (req as any).user._id, // Get user ID from the protect middleware
      ...finalData,
      comparableProperties,
      valuation,
    });

    await newReport.save();

    res.status(201).json({
      message: "Real estate data processed and report saved successfully!",
      data: newReport,
    });
  } catch (error) {
    console.error("Error processing real estate data:", error);
    res.status(500).json({ message: "Error processing request", error });
  }
};

export const getRealEstateReports = async (req: Request, res: Response) => {
  try {
    const reports = await RealEstateReport.find({ user: (req as any).user._id }).sort({ createdAt: -1 });
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
