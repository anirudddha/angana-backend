import asyncHandler from 'express-async-handler';
import { getUserProfile, updateUserProfile, getPublicUserProfile } from '../services/user.service.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const getCurrentUserController = asyncHandler(async (req, res) => {
  const authUser = req.user;
  if (!authUser) return res.status(401).json({ message: 'Not authenticated' });

  // Prefer the middleware-provided profiles' user_id (UUID). If not present, bail out and return req.user as-is.
  const profileUserId = authUser.user_id;
  if (!profileUserId) {
    return res.status(200).json(authUser);
  }

  // Fetch membership rows (we only need neighborhood_id)
  const memberships = await prisma.neighborhoodMembership.findMany({
    where: { user_id: profileUserId },
    select: { neighborhood_id: true },
    orderBy: { joined_at: 'desc' },
  });

  const neighborhood_ids = (memberships || []).map((m) =>
    m.neighborhood_id != null ? m.neighborhood_id.toString() : null
  ).filter(Boolean);

  const current_neighborhood_id = neighborhood_ids.length > 0 ? neighborhood_ids[0] : null;

  return res.status(200).json({
    ...authUser,
    neighborhood_ids,
    current_neighborhood_id,
  });
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