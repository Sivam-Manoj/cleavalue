import { Router } from "express";
import { createAssetReport, uploadMiddleware, getAssetReports, getAssetProgress } from "../controller/asset.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", protect, uploadMiddleware, createAssetReport);
router.get("/", protect, getAssetReports);
router.get("/progress/:id", protect, getAssetProgress);

export default router;
