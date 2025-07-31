import express from "express";
import {
  downloadReport,
  deleteReport,
  getAllReports,
  getReportsByUser,
  getReportStats,
} from "../controller/pdfReport.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getAllReports);
router.get("/myreports", protect, getReportsByUser);
router.get("/:id/download", protect, downloadReport);
router.get("/stats", protect, getReportStats);
router.get("/:id", protect, deleteReport);

export default router;
