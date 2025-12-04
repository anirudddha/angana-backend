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
      is_onboarding_complete: false, // Mark onboarding as complete after first update
    },
  });
};

export const getPublicUserProfile = async (userId) => {
  // Use `select` to ensure we only return safe, public-facing data.
  return prisma.profile.findUnique({
    where: { user_id: userId },
    select: {
      id: true,
      full_name: true,
      bio: true,
      avatar_url: true,
      created_at: true, // Useful for showing "Member since..."
    },
  });
};

export const getUserNeighborhood = async (userId) => {
  // 1. Try to get from Address (primary location)
  const address = await prisma.address.findUnique({
    where: { user_id: userId },
    select: { neighborhood_id: true },
  });

  if (address?.neighborhood_id) {
    return address.neighborhood_id;
  }

  // 2. Fallback: Try to get from Memberships (if they joined without an address, though unlikely with current flow)
  const membership = await prisma.neighborhoodMembership.findFirst({
    where: { user_id: userId },
    select: { neighborhood_id: true },
  });

  return membership?.neighborhood_id || null;
};