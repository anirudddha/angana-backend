import asyncHandler from 'express-async-handler';
import { getUserProfile, updateUserProfile, getPublicUserProfile } from '../services/user.service.js';

export const getCurrentUserController = asyncHandler(async (req, res) => {
  // req.user is attached by the authenticate middleware
  res.status(200).json(req.user);
});

export const updateCurrentUserController = asyncHandler(async (req, res) => {
  const updatedProfile = await updateUserProfile(req.user.id, req.body);
  res.status(200).json(updatedProfile);
});

export const getUserProfileController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userProfile = await getPublicUserProfile(id);

  if (!userProfile) {
    // If no user is found, throw a 404 error which our global handler will catch.
    throw new ApiError(404, 'User profile not found');
  }

  res.status(200).json(userProfile);
});