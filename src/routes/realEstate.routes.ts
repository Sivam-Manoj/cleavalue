import { Router } from "express";
import { createRealEstate, uploadMiddleware, getRealEstateReports } from '../controller/realEstate.controller.js';
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.post('/', protect, uploadMiddleware, createRealEstate);

// Route to get all real estate reports for the logged-in user
router.get('/', protect, getRealEstateReports);

export default router;
