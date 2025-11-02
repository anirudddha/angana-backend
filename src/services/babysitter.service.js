// src/services/babysitter.service.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Creates or updates a user's babysitter profile.
 * @param {string} userId - The user's profile UUID.
 * @param {object} data - { bio, experience_years, rate_per_hour, certifications }
 */
export const createOrUpdateBabysitterProfile = async (userId, data) => {
  return prisma.babysitterProfile.upsert({
    where: { profile_id: userId },
    update: data,
    create: {
      profile_id: userId,
      ...data,
    },
  });
};

/**
 * Deactivates a user's babysitter profile by deleting it.
 * @param {string} userId
 */
export const deactivateBabysitterProfile = async (userId) => {
  // The unique constraint on profile_id means we can safely delete by it.
  // Prisma will throw an error if not found, which is acceptable.
  return prisma.babysitterProfile.delete({
    where: { profile_id: userId },
  });
};

/**
 * Gets a directory of active babysitters in a specific neighborhood.
 * @param {BigInt} neighborhoodId
 */
export const getBabysittersForNeighborhood = async (neighborhoodId) => {
  const babysitters = await prisma.babysitterProfile.findMany({
    where: {
      status: 'active',
      profile: {
        memberships: {
          some: { neighborhood_id: neighborhoodId },
        },
      },
    },
    include: {
      profile: { select: { id: true, full_name: true, avatar_url: true } },
      recommendations: { select: { id: true } }, // Just for counting
    },
  });

  // Process results to add recommendation count
  return babysitters.map(sitter => {
    const { recommendations, ...rest } = sitter;
    return {
      ...rest,
      recommendation_count: recommendations.length
    };
  });
};

/**
 * Gets the full, detailed profile of a single babysitter, including recommendations.
 * @param {BigInt} babysitterProfileId
 */
export const getBabysitterDetails = async (babysitterProfileId) => {
  return prisma.babysitterProfile.findUnique({
    where: { id: babysitterProfileId },
    include: {
      profile: { select: { id: true, user_id: true, full_name: true, avatar_url: true, created_at: true } },
      recommendations: {
        include: {
          reviewer: { select: { id: true, full_name: true, avatar_url: true } },
        },
        orderBy: { created_at: 'desc' },
      },
    },
  });
};

/**
 * Creates a recommendation for a babysitter.
 * @param {string} reviewerId
 * @param {BigInt} babysitterProfileId
 * @param {string} comment
 */
export const createBabysitterRecommendation = async (reviewerId, babysitterProfileId, comment) => {
  return prisma.babysitterRecommendation.create({
    data: {
      reviewer_id: reviewerId,
      babysitter_profile_id: babysitterProfileId,
      comment: comment,
    }
  });
};

export const getBabysitterProfileByUserId = async (userId) => {
  return prisma.babysitterProfile.findUnique({
    // We are searching using the 'profile_id', which is the foreign key
    // linking back to the main User/Profile table.
    where: { profile_id: userId },
    include: {
      profile: { select: { id: true, user_id: true, full_name: true, avatar_url: true } },
      recommendations: {
        include: {
          reviewer: { select: { id: true, full_name: true, avatar_url: true } },
        },
        orderBy: { created_at: 'desc' },
      },
    },
  });
};