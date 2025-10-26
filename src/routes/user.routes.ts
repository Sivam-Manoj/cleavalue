import { Router } from "express";
import {
  getUserProfile,
  deleteUserAccount,
  updateUserProfile,
  uploadUserCv,
  deleteUserCv,
} from "../controller/user.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import upload from "../utils/multerStorage.js";

const router = Router();

router.get("/me", protect, getUserProfile);
router.put("/", protect, updateUserProfile);
router.delete("/", protect, deleteUserAccount);
// CV upload/delete
router.post("/cv", protect, upload.single("cv"), uploadUserCv);
router.delete("/cv", protect, deleteUserCv);

export default router; 
