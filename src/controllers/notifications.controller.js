import asyncHandler from 'express-async-handler';
import { registerDeviceToken } from '../services/notification.service.js';

/**
 * @desc    Register a device token for push notifications
 * @route   POST /api/v1/notifications/register
 * @access  Private
 */
export const registerDeviceController = asyncHandler(async (req, res) => {
  const { token, deviceType } = req.body;

  if (!token || !deviceType) {
    res.status(400);
    throw new Error('Device token and deviceType are required.');
  }

  // Validate deviceType to ensure clean data
  const validTypes = ['ios', 'android', 'web'];
  if (!validTypes.includes(deviceType.toLowerCase())) {
    res.status(400);
    throw new Error(`Invalid deviceType. Must be one of: ${validTypes.join(', ')}.`);
  }

  const registeredToken = await registerDeviceToken(req.user.id, token, deviceType);

  res.status(201).json({
    message: 'Device token registered successfully.',
    token: registeredToken.token,
  });
});