import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const getUserProfile = async (userId) => {
  return prisma.profile.findUnique({ where: { id: userId } });
};

export const updateUserProfile = async (userId, data) => {
  const { full_name, bio } = data;
  return prisma.profile.update({
    where: { id: userId },
    data: {
      full_name,
      bio,
      is_onboarding_complete: true, // Mark onboarding as complete after first update
    },
  });
};

export const getPublicUserProfile = async (userId) => {
  // Use `select` to ensure we only return safe, public-facing data.
  return prisma.profile.findUnique({
    where: { id: userId },
    select: {
      id: true,
      full_name: true,
      bio: true,
      avatar_url: true,
      created_at: true, // Useful for showing "Member since..."
    },
  });
};