import express from 'express';
import {
  getNotificationTypesController,
  createNotificationTypeController,
  getUserNotificationSettingsController,
  updateUserNotificationSettingController,
  initializeDefaultNotificationSettingsController,
} from '../controllers/notificationSetting.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

// Routes for Notification Types (Admin only)
router.route('/types')
  .get(getNotificationTypesController)
  .post(authenticate, createNotificationTypeController);

// Routes for User Notification Settings
router.route('/')
  .get(authenticate, getUserNotificationSettingsController)
  .put(authenticate, updateUserNotificationSettingController); // Update a specific setting

router.post('/initialize-defaults', authenticate, initializeDefaultNotificationSettingsController);

export default router;