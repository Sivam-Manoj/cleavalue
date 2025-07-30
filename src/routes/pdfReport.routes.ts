import express from 'express';
import {
  downloadReport,
  deleteReport,
  getAllReports,
  getReportsByUser,
  getReportStats,
} from '../controller/pdfReport.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.route('/').get(protect, getAllReports);
router.route('/myreports').get(protect, getReportsByUser);
router.route('/:id/download').get(protect, downloadReport);
router.route('/stats').get(protect, getReportStats);
router.route('/:id').delete(protect, deleteReport);

export default router;
