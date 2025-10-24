import { Router } from "express";
import { 
  createAssetReport, 
  uploadMiddleware, 
  getAssetReports, 
  getAssetProgress,
  getPreviewData,
  updatePreviewData,
  submitForApproval,
  approveReport,
  declineReport
} from "../controller/asset.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

// Asset report creation and listing
router.post("/", protect, uploadMiddleware, createAssetReport);
router.get("/", protect, getAssetReports);
router.get("/progress/:id", protect, getAssetProgress);

// Preview workflow endpoints
router.get("/:id/preview", protect, getPreviewData);
router.put("/:id/preview", protect, updatePreviewData);
router.post("/:id/submit-approval", protect, submitForApproval);

// Admin approval endpoints
router.post("/:id/approve", protect, approveReport);
router.post("/:id/decline", protect, declineReport);

export default router;
