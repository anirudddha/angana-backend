import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Creates a new deal for a verified business.
 * @param {string | number | bigint} businessId - BusinessProfile ID
 * @param {object} dealData - { title, description, deal_type, endDate, mediaUrls }
 */
export const createDeal = async (businessId, dealData) => {
    const { title, description, deal_type, endDate, mediaUrls = [] } = dealData;

    if (!businessId) throw new Error('businessId is required');
    if (!title || !description || !deal_type)
        throw new Error('Title, description, and deal_type are required');

    // Fetch business address for neighborhood and uploader_id
    const businessAddress = await prisma.address.findFirst({
        where: { business_profile_id: BigInt(businessId) },
    });

    if (!businessAddress) {
        throw new Error('Business address not found for this business.');
    }

    if (!businessAddress.neighborhood_id) {
        throw new Error('Business must be linked to a neighborhood.');
    }

    return prisma.$transaction(async (tx) => {
        // 1️⃣ Create deal with relation connect instead of raw business_id
        const deal = await tx.deal.create({
            data: {
                title,
                description,
                deal_type,
                end_date: endDate ? new Date(endDate) : null,
                neighborhood: { connect: { id: businessAddress.neighborhood_id } },
                business: { connect: { id: BigInt(businessId) } },
            },
        });

        // 2️⃣ Add media if provided
        if (mediaUrls && mediaUrls.length > 0) {
            const mediaData = mediaUrls.map((url) => ({
                uploader_id: businessAddress.user_id,
                url,
                deal_id: deal.id,
            }));
            await tx.media.createMany({ data: mediaData });
        }

        // 3️⃣ Return deal with full info
        const result = await tx.deal.findUnique({
            where: { id: deal.id },
            include: {
                media: { select: { id: true, url: true } },
                business: { select: { business_name: true, category: true } },
                neighborhood: { select: { name: true } },
            },
        });

        // Convert BigInt fields to string for safe JSON
        return {
            ...result,
            id: result.id.toString(),
            business_id: result.business_id?.toString(),
            neighborhood_id: result.neighborhood_id?.toString(),
            media: result.media.map((m) => ({
                ...m,
                id: m.id.toString(),
            })),
        };
    });
};

/**
 * Fetch all active deals for a neighborhood
 * @param {string | number | bigint} neighborhoodId
 */
export const getDealsForNeighborhood = async (neighborhoodId) => {
    if (!neighborhoodId) throw new Error('neighborhoodId is required');

    const deals = await prisma.deal.findMany({
        where: {
            neighborhood_id: BigInt(neighborhoodId),
            status: 'active',
            OR: [{ end_date: null }, { end_date: { gte: new Date() } }],
        },
        include: {
            business: { select: { business_name: true, category: true } },
            media: { select: { id: true, url: true } },
        },
        orderBy: { created_at: 'desc' },
    });

    return deals.map((d) => ({
        ...d,
        id: d.id.toString(),
        business_id: d.business_id?.toString(),
        neighborhood_id: d.neighborhood_id?.toString(),
        media: d.media.map((m) => ({
            ...m,
            id: m.id.toString(),
        })),
    }));
};

export const updateDeal = async (businessId, dealId, updateData = {}) => {
    if (!businessId) throw new Error('businessId is required');
    if (!dealId) throw new Error('dealId is required');

    // Normalize to BigInt where needed
    const bId = typeof businessId === 'bigint' ? businessId : BigInt(businessId);
    const dId = typeof dealId === 'bigint' ? dealId : BigInt(dealId);

    // Get the deal and verify ownership
    const existingDeal = await prisma.deal.findUnique({
        where: { id: dId },
        include: { media: true },
    });

    if (!existingDeal) throw new Error('Deal not found');

    // existingDeal.business_id is BigInt — compare as strings to be safe
    if (existingDeal.business_id?.toString() !== bId.toString()) {
        throw new Error('Not authorized to update this deal');
    }

    // Fetch business address (to get uploader_id for media entries)
    const businessAddress = await prisma.address.findFirst({
        where: { business_profile_id: bId },
    });

    if (!businessAddress) {
        throw new Error('Business address not found for this business.');
    }

    // Prepare update payload
    const { title, description, deal_type, endDate, status, mediaUrls } = updateData;
    const updatePayload = {
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        ...(deal_type ? { deal_type } : {}),
        ...(typeof status === 'string' ? { status } : {}),
        ...(endDate ? { end_date: endDate ? new Date(endDate) : null } : {}),
    };

    return prisma.$transaction(async (tx) => {
        // 1) Update the deal
        const updated = await tx.deal.update({
            where: { id: dId },
            data: updatePayload,
        });

        // 2) If mediaUrls provided, replace media (delete existing -> create new)
        if (Array.isArray(mediaUrls)) {
            // delete existing media for this deal
            await tx.media.deleteMany({ where: { deal_id: updated.id } });

            if (mediaUrls.length > 0) {
                const mediaData = mediaUrls.map((url) => ({
                    uploader_id: businessAddress.user_id,
                    url,
                    deal_id: updated.id,
                }));
                await tx.media.createMany({ data: mediaData });
            }
        }

        // 3) Fetch the fresh deal with relations
        const result = await tx.deal.findUnique({
            where: { id: updated.id },
            include: {
                media: { select: { id: true, url: true } },
                business: { select: { business_name: true, category: true } },
                neighborhood: { select: { name: true } },
            },
        });

        // 4) Convert BigInt fields to strings for safe JSON
        return {
            ...result,
            id: result.id.toString(),
            business_id: result.business_id?.toString(),
            neighborhood_id: result.neighborhood_id?.toString(),
            media: (result.media || []).map((m) => ({
                ...m,
                id: m.id.toString(),
            })),
        };
    });
};