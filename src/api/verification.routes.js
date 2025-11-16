import express from 'express';
import {
  requestAddressVerificationController,
  verifyAddressController,
  getPendingVerificationsController,
  updateProfileVerificationStatusController,
} from '../controllers/verification.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

// User requests verification for their own address
router.post('/request-address', authenticate, requestAddressVerificationController);

// Admin/system verifies an address (e.g., after postcard code entry)
router.post('/verify-address', authenticate, verifyAddressController);

// Admin gets pending verifications
router.get('/pending', authenticate, getPendingVerificationsController);

// Admin updates a user's profile verification status
router.put('/profile-status', authenticate, updateProfileVerificationStatusController);

export default router;