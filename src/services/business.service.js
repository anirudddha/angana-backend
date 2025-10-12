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
export const updateBusinessDetails = async (authUserId, businessIdRaw, updateData) => {
    if (!authUserId) throw Object.assign(new Error('Unauthorized: authUserId required'), { code: 'UNAUTH' });
    if (!businessIdRaw) throw new Error('businessId is required');
    if (!updateData || Object.keys(updateData).length === 0) throw new Error('No update data provided');

    const businessId = typeof businessIdRaw === 'bigint' ? businessIdRaw : BigInt(businessIdRaw);

    // Find the authenticated profile
    const profile = await prisma.profile.findFirst({
        where: { OR: [{ id: authUserId }, { user_id: authUserId }] },
    });
    if (!profile) throw Object.assign(new Error('Profile not found'), { code: 'PROFILE_NOT_FOUND' });

    // Find business profile
    const business = await prisma.businessProfile.findUnique({
        where: { id: businessId },
    });
    if (!business) throw Object.assign(new Error('Business profile not found'), { code: 'BUSINESS_NOT_FOUND' });

    // Owner check
    if (business.profile_id !== profile.id) {
        throw Object.assign(new Error('Forbidden: you are not the owner of this business'), { code: 'FORBIDDEN' });
    }

    const {
        business_name,
        category,
        description,
        phone_number,
        website,
        status,
        addressData,
        mediaUrlsToAdd = [],
        mediaIdsToRemove = [],
        replaceMedia = false,
    } = updateData;

    return prisma.$transaction(async (tx) => {
        // 1) Update business_profile fields (only provided fields)
        const businessPayload = {};
        if (business_name !== undefined) businessPayload.business_name = business_name;
        if (category !== undefined) businessPayload.category = category;
        if (description !== undefined) businessPayload.description = description;
        if (phone_number !== undefined) businessPayload.phone_number = phone_number;
        if (website !== undefined) businessPayload.website = website;
        if (status !== undefined) businessPayload.status = status;

        const updatedBusiness = await tx.businessProfile.update({
            where: { id: businessId },
            data: businessPayload,
        });

        // 2) Handle addressData (update if exists, otherwise create)
        if (addressData && typeof addressData === 'object') {
            const existingAddr = await tx.address.findFirst({
                where: { business_profile_id: businessId },
            });

            const addressPayload = {};
            if (addressData.address_line_1 !== undefined) addressPayload.address_line_1 = addressData.address_line_1;
            if (addressData.city !== undefined) addressPayload.city = addressData.city;
            if (addressData.postal_code !== undefined) addressPayload.postal_code = addressData.postal_code;
            if (addressData.neighborhood_id !== undefined) addressPayload.neighborhood_id = addressData.neighborhood_id;
            // If you implement lat/lng to PostGIS, compute addressPayload.location here.

            if (existingAddr) {
                await tx.address.update({
                    where: { id: existingAddr.id },
                    data: {
                        ...addressPayload,
                        business_profile_id: businessId, // ensure link
                    },
                });
            } else {
                // Create address - link to profile.user_id
                await tx.address.create({
                    data: {
                        user_id: profile.user_id,
                        business_profile_id: businessId,
                        neighborhood_id: addressPayload.neighborhood_id ?? null,
                        address_line_1: addressPayload.address_line_1 ?? '',
                        city: addressPayload.city ?? '',
                        postal_code: addressPayload.postal_code ?? '',
                    },
                });
            }
        }

        // 3) Handle media operations
        // If replaceMedia is true -> delete existing media for this business_profile_id then add new ones
        if (replaceMedia) {
            // delete all media entries linked to this business
            await tx.media.deleteMany({ where: { business_profile_id: businessId } });
        }

        // Remove specific media ids (if provided)
        if (Array.isArray(mediaIdsToRemove) && mediaIdsToRemove.length > 0) {
            // convert possible string ids to BigInt where necessary
            const idsToRemove = mediaIdsToRemove.map((id) => (typeof id === 'bigint' ? id : BigInt(id)));
            await tx.media.deleteMany({ where: { id: { in: idsToRemove }, business_profile_id: businessId } });
        }

        // Add new media URLs
        if (Array.isArray(mediaUrlsToAdd) && mediaUrlsToAdd.length > 0) {
            const mediaRows = mediaUrlsToAdd.map((url) => ({
                uploader_id: profile.user_id,
                url,
                business_profile_id: businessId,
            }));
            // use createMany for performance
            await tx.media.createMany({ data: mediaRows });
        }

        // 4) Return updated business with address and media
        const result = await tx.businessProfile.findUnique({
            where: { id: businessId },
            include: {
                address: true,
                media: true,
            },
        });

        return result;
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

export const getPublicBusinessProfile = async (businessId) => {
    return prisma.businessProfile.findFirst({
        where: {
            id: businessId,
            status: 'verified', // Only show verified businesses to the public
        },
        include: {
            media: { // <-- THIS IS THE KEY
                select: { id: true, url: true }
            },
            address: { // Also useful to show location info
                select: { address_line_1: true, city: true }
            }
        }
    });
};