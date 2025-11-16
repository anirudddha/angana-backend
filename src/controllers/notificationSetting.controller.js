import asyncHandler from 'express-async-handler';
import * as notificationSettingService from '../services/notificationSetting.service.js';

export const getNotificationTypesController = asyncHandler(async (req, res) => {
  const types = await notificationSettingService.getNotificationTypes();
  res.status(200).json(types);
});

export const createNotificationTypeController = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Notification type name is required.');
  }

  const newType = await notificationSettingService.createNotificationType({ name, description });
  res.status(201).json(newType);
});

export const getUserNotificationSettingsController = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const settings = await notificationSettingService.getUserNotificationSettings(userId);
  res.status(200).json(settings);
});

export const updateUserNotificationSettingController = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { notificationTypeId, enablePush, enableEmail, enableDigest } = req.body;

  if (!notificationTypeId || typeof enablePush !== 'boolean' || typeof enableEmail !== 'boolean' || typeof enableDigest !== 'boolean') {
    res.status(400);
    throw new Error('Notification type ID and boolean flags for push, email, and digest are required.');
  }

  const updatedSetting = await notificationSettingService.updateUserNotificationSetting(
    userId,
    notificationTypeId,
    { enablePush, enableEmail, enableDigest }
  );
  res.status(200).json(updatedSetting);
});

export const initializeDefaultNotificationSettingsController = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  await notificationSettingService.initializeDefaultNotificationSettings(userId);
  res.status(200).json({ message: 'Default notification settings initialized.' });
});