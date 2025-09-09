import express from "express";
import { seed, adminLogin, me, getAdmins, postAdmin, deleteAdmin, blockAdmin, getAdminReports, getAdminStats, refreshAdminToken, getUsers, blockUserByAdmin, deleteUserByAdmin, getMonthlyStats } from "../controller/admin.controller.js";
import { downloadReport, deleteReport } from "../controller/pdfReport.controller.js";
import { adminProtect, requireSuperadmin } from "../middleware/admin.middleware.js";
import { getPendingReports, approveReport, rejectReport } from "../controller/approval.controller.js";

const router = express.Router();

// Seed superadmin (guarded by ADMIN_SEED_KEY if set)
router.post("/seed", seed);

// Admin login (only users with role admin or superadmin)
router.post("/login", adminLogin);
// Refresh access token using refresh token
router.post("/refresh", refreshAdminToken);

// Who am I (requires admin)
router.get("/me", adminProtect, me);

// Admin management (superadmin only)
router.get("/admins", adminProtect, requireSuperadmin, getAdmins);
router.post("/admins", adminProtect, requireSuperadmin, postAdmin);
router.delete("/admins/:id", adminProtect, requireSuperadmin, deleteAdmin);
router.patch("/admins/:id/block", adminProtect, requireSuperadmin, blockAdmin);

// Users management (admins and superadmins)
router.get("/users", adminProtect, getUsers);
router.patch("/users/:id/block", adminProtect, blockUserByAdmin);
router.delete("/users/:id", adminProtect, deleteUserByAdmin);

// Reports listing for admins and superadmins
router.get("/reports", adminProtect, getAdminReports);
// Report actions (admins and superadmins)
router.get("/reports/:id/download", adminProtect, downloadReport);
router.delete("/reports/:id", adminProtect, deleteReport);

// Approvals
router.get("/reports/pending", adminProtect, getPendingReports);
router.patch("/reports/:id/approve", adminProtect, approveReport);
router.patch("/reports/:id/reject", adminProtect, rejectReport);

// Stats for admins and superadmins
router.get("/stats", adminProtect, getAdminStats);
router.get("/stats/monthly", adminProtect, getMonthlyStats);

export default router;
