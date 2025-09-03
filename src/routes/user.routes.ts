import { Router } from "express";
import {
  getUserProfile,
  deleteUserAccount,
  updateUserProfile,
} from "../controller/user.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/me", protect, getUserProfile);
router.put("/", protect, updateUserProfile);
router.delete("/", protect, deleteUserAccount);

export default router; 
