import asyncHandler from 'express-async-handler';
import { getUserProfile, updateUserProfile } from '../services/user.service.js';

export const getCurrentUserController = asyncHandler(async (req, res) => {
  // req.user is attached by the authenticate middleware
  res.status(200).json(req.user);
});

export const updateCurrentUserController = asyncHandler(async (req, res) => {
  const updatedProfile = await updateUserProfile(req.user.id, req.body);
  res.status(200).json(updatedProfile);
});