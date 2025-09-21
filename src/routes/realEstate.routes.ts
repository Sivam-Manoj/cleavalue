import { Router } from "express";
import { createRealEstate, createRealEstateQueued, uploadMiddleware, getRealEstateReports, getRealEstateProgress } from '../controller/realEstate.controller.js';
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

// Default: queued background processing (returns 202 with jobId)
router.post('/', protect, uploadMiddleware, createRealEstateQueued);
// Optional: synchronous generation for debugging/legacy
router.post('/sync', protect, uploadMiddleware, createRealEstate);

// Route to get all real estate reports for the logged-in user
router.get('/', protect, getRealEstateReports);
router.get('/progress/:id', protect, getRealEstateProgress);

export default router;
