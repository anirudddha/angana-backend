import express from 'express';
import {
  createReportController,
  getReportsController,
  getReportByIdController,
  updateReportStatusController,
  getReportReasonsController,
  createReportReasonController,
} from '../controllers/report.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

// Routes for reports
router.route('/')
  .post(authenticate, createReportController)
  .get(authenticate, getReportsController); // For moderators to view all reports

router.route('/:id')
  .get(authenticate, getReportByIdController)
  .put(authenticate, updateReportStatusController); // For moderators to update report status

// Routes for report reasons (admin only)
router.route('/reasons')
  .post(authenticate, createReportReasonController)
  .get(getReportReasonsController);

export default router;