import asyncHandler from 'express-async-handler';
import * as babysitterService from '../services/babysitter.service.js';
import { getUserNeighborhood } from '../services/user.service.js';

// Convert BigInt -> string throughout the object so JSON.stringify won't throw
const serializeBigInt = (obj) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
  );

// Helper to get auth user id (either req.user.id or req.user.user_id)
const getAuthUserId = (req) => req.user?.id ?? req.user?.user_id;

/**
 * POST /api/v1/babysitters/me
 * Create or update the logged-in user's babysitter profile
 */
export const setMyBabysitterProfileController = asyncHandler(async (req, res) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });

  const profile = await babysitterService.createOrUpdateBabysitterProfile(authUserId, req.body);
  return res.status(200).json(serializeBigInt(profile));
});

/**
 * DELETE /api/v1/babysitters/me
 * Deactivate the logged-in user's babysitter profile
 */
export const removeMyBabysitterProfileController = asyncHandler(async (req, res) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });

  await babysitterService.deactivateBabysitterProfile(authUserId);
  return res.status(204).send();
});

/**
 * GET /api/v1/babysitters/neighborhood/:id
 * Get babysitters for a neighborhood (neighborhood id is BigInt)
 */
export const getNeighborhoodBabysittersController = asyncHandler(async (req, res) => {
  const authUserId = req.user.user_id;

  const neighborhoodId = await getUserNeighborhood(authUserId);
  if (!neighborhoodId) {
    return res.status(400).json({ message: 'User is not part of any neighborhood' });
  }

  const sitters = await babysitterService.getBabysittersForNeighborhood(neighborhoodId);
  return res.status(200).json(serializeBigInt(sitters));
});

/**
 * GET /api/v1/babysitters/:id
 * Get babysitter details by sitter profile id (BigInt)
 */
export const getBabysitterDetailsController = asyncHandler(async (req, res) => {
  let sitterProfileId;
  try {
    sitterProfileId = BigInt(req.params.id);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid babysitter profile ID' });
  }

  const sitter = await babysitterService.getBabysitterDetails(sitterProfileId);
  if (!sitter) {
    return res.status(404).json({ message: 'Babysitter profile not found' });
  }
  return res.status(200).json(serializeBigInt(sitter));
});

/**
 * POST /api/v1/babysitters/:id/recommendations
 * Create a recommendation for a babysitter
 */
export const createRecommendationController = asyncHandler(async (req, res) => {
  let sitterProfileId;
  try {
    sitterProfileId = BigInt(req.params.id);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid babysitter profile ID' });
  }

  const { comment } = req.body;
  if (!comment || typeof comment !== 'string' || comment.trim() === '') {
    return res.status(400).json({ message: 'A comment is required for a recommendation.' });
  }

  const reviewerId = getAuthUserId(req);
  if (!reviewerId) return res.status(401).json({ message: 'Unauthorized' });

  const recommendation = await babysitterService.createBabysitterRecommendation(reviewerId, sitterProfileId, comment);
  return res.status(201).json(serializeBigInt(recommendation));
});

export const getMyBabysitterProfileController = asyncHandler(async (req, res) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });

  // This calls the new service function we added previously
  const profile = await babysitterService.getBabysitterProfileByUserId(authUserId);

  if (!profile) {
    // This is a critical step. A 404 response tells the frontend that
    // the user is not a sitter, which is a valid and expected state.
    return res.status(404).json({ message: 'Babysitter profile not found for this user.' });
  }

  return res.status(200).json(serializeBigInt(profile));
});