import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const requestAddressVerification = async (userId) => {
  // For simplicity, this function just sets the status to PENDING.
  // In a real application, this would trigger sending a postcard with a code.
  const address = await prisma.address.findUnique({
    where: { user_id: userId },
  });

  if (!address) {
    throw new Error('User does not have an address to verify.');
  }

  return prisma.address.update({
    where: { user_id: userId },
    data: { verification_status: 'PENDING' },
  });
};

export const verifyAddress = async (userId) => {
  // In a real application, this would involve checking a code or admin approval.
  // For now, it directly sets the status to VERIFIED.
  const address = await prisma.address.findUnique({
    where: { user_id: userId },
  });

  if (!address) {
    throw new Error('User does not have an address to verify.');
  }

  const updatedAddress = await prisma.address.update({
    where: { user_id: userId },
    data: { verification_status: 'VERIFIED' },
  });

  // Also update the user's profile verification status
  await prisma.profile.update({
    where: { user_id: userId },
    data: { is_verified: true },
  });

  return updatedAddress;
};

export const getPendingVerifications = async () => {
  return prisma.address.findMany({
    where: { verification_status: 'PENDING' },
    include: { user: { select: { user_id: true, full_name: true } } },
  });
};

export const updateProfileVerificationStatus = async (userId, isVerified) => {
  return prisma.profile.update({
    where: { user_id: userId },
    data: { is_verified: isVerified },
  });
};