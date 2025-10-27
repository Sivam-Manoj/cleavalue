import { Router } from "express";
import {
  createSavedInput,
  getSavedInputs,
  getSavedInputById,
  updateSavedInput,
  deleteSavedInput,
} from "../controller/savedInput.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", protect, createSavedInput);
router.get("/", protect, getSavedInputs);
router.get("/:id", protect, getSavedInputById);
router.put("/:id", protect, updateSavedInput);
router.delete("/:id", protect, deleteSavedInput);

export default router;
