import { Router } from "express";
import { createSalvageReport, uploadMiddleware, getSalvageReports } from '../controller/salvage.controller.js';
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.post('/', protect, uploadMiddleware, createSalvageReport);
router.get('/', protect, getSalvageReports);

export default router;
