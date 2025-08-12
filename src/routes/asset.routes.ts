import { Router } from "express";
import { createAssetReport, uploadMiddleware, getAssetReports } from "../controller/asset.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", protect, uploadMiddleware, createAssetReport);
router.get("/", protect, getAssetReports);

export default router;
