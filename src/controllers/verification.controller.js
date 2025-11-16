import asyncHandler from 'express-async-handler';
import * as verificationService from '../services/verification.service.js';

const serializeBigInts = (data) => {
  return JSON.parse(JSON.stringify(data, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
};

export const requestAddressVerificationController = asyncHandler(async (req, res) => {
  const userId = req.user.user_id; // Assuming req.user is populated by authentication middleware

  const updatedAddress = await verificationService.requestAddressVerification(userId);
  res.status(200).json(serializeBigInts(updatedAddress));
});

export const verifyAddressController = asyncHandler(async (req, res) => {
  const { userId } = req.body; // Admin might verify another user's address

  if (!userId) {
    res.status(400);
    throw new Error('User ID is required for verification.');
  }

  const updatedAddress = await verificationService.verifyAddress(userId);
  res.status(200).json(serializeBigInts(updatedAddress));
});

export const getPendingVerificationsController = asyncHandler(async (req, res) => {
  const pendingVerifications = await verificationService.getPendingVerifications();
  res.status(200).json(serializeBigInts(pendingVerifications));
});

export const updateProfileVerificationStatusController = asyncHandler(async (req, res) => {
  const { userId, isVerified } = req.body;

  if (!userId || typeof isVerified !== 'boolean') {
    res.status(400);
    throw new Error('User ID and verification status (boolean) are required.');
  }

  const updatedProfile = await verificationService.updateProfileVerificationStatus(userId, isVerified);
  res.status(200).json(serializeBigInts(updatedProfile));
});