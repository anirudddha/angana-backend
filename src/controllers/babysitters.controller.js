import asyncHandler from 'express-async-handler';
import * as babysitterService from '../services/babysitter.service.js';

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
  let neighborhoodId;
  try {
    neighborhoodId = BigInt(req.params.id);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid neighborhood ID' });
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
