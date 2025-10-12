import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Apply for a business account.
 * @param {string} authUserId - The authenticated user's id. This may be Profile.id OR Profile.user_id depending on your auth payload.
 * @param {object} businessData - { business_name, category, description, addressData }
 *
 * addressData expected shape (example):
 * { address_line_1: '...', city: '...', postal_code: '...', lat?: number, lng?: number }
 *
 * NOTE: If your Address.location is non-nullable, you MUST geocode addressData (lat,lng) and set location accordingly.
 */
export const applyForBusinessAccount = async (authUserId, businessData) => {
    const { business_name, category, description, addressData } = businessData;

    return prisma.$transaction(async (tx) => {
        const profile = await tx.profile.findFirst({
            where: { OR: [{ id: authUserId }, { user_id: authUserId }] },
        });

        if (!profile) throw new Error('Profile not found');

        const existingBusiness = await tx.businessProfile.findUnique({
            where: { profile_id: profile.id },
        });

        if (existingBusiness) throw new Error('Already has business profile');

        // 1) Update user role
        await tx.profile.update({
            where: { id: profile.id },
            data: { role: 'business' },
        });

        // 2) Create business profile
        const businessProfile = await tx.businessProfile.create({
            data: {
                profile_id: profile.id,
                business_name,
                category,
                description: description ?? null,
                status: 'pending',
            },
        });

        // 3) Check if address exists
        const existingAddress = await tx.address.findUnique({
            where: { user_id: profile.user_id },
        });

        if (existingAddress) {
            // Update existing address
            await tx.address.update({
                where: { user_id: profile.user_id },
                data: {
                    business_profile_id: businessProfile.id,
                    ...addressData,
                },
            });
        } else {
            // Create new address
            await tx.address.create({
                data: {
                    user_id: profile.user_id,
                    business_profile_id: businessProfile.id,
                    ...addressData,
                },
            });
        }

        return businessProfile;
    });
};

/**
 * Update a business profile and its address. Only the owner (profile) may update.
 * @param {string} authUserId - authenticated user id (Profile.id or Profile.user_id)
 * @param {string|number|bigint} businessId - BusinessProfile.id
 * @param {object} updateData - allowed fields:
 *   { business_name, category, description, phone_number, website, status,
 *     addressData: { address_line_1, city, postal_code, neighborhood_id, lat, lng } }
 */
export const updateBusinessDetails = async (businessId, updateData) => {
    if (!updateData) throw new Error('No update data provided');
  
    const { business_name, category, description, phone_number, website } = updateData;
  
    return prisma.businessProfile.update({
      where: { id: businessId },
      data: {
        ...(business_name && { business_name }),
        ...(category && { category }),
        ...(description && { description }),
        ...(phone_number && { phone_number }),
        ...(website && { website }),
      },
    });
  };
  
  /**
   * Recursively convert BigInt to string
   */
  const bigintToString = (obj) => {
    if (Array.isArray(obj)) return obj.map(bigintToString);
    if (obj && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [
          k,
          typeof v === 'bigint' ? v.toString() : bigintToString(v),
        ])
      );
    }
    return obj;
  };
