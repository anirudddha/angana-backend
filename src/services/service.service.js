import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Gets the master list of all available service categories.
 */
export const getServiceCategories = async () => {
    return prisma.serviceCategory.findMany({
        orderBy: { name: 'asc' },
    });
};

/**
 * Allows a business to set which services they offer.
 * @param {BigInt} businessId - The ID of the BusinessProfile.
 * @param {number[]} serviceCategoryIds - An array of IDs from the ServiceCategory table.
 */
export const setBusinessServices = async (businessId, serviceCategoryIds) => {
    // Normalize businessId (keep as-is; Prisma accepts number or BigInt depending on model)
    if (!businessId) throw Object.assign(new Error('businessId required'), { code: 'BUSINESS_ID_REQUIRED' });

    // Normalize and dedupe category IDs
    const catIds = Array.isArray(serviceCategoryIds)
        ? [...new Set(serviceCategoryIds.map((id) => {
            const n = Number(id);
            return Number.isInteger(n) ? n : null;
        }).filter(Boolean))]
        : [];

    return prisma.$transaction(async (tx) => {
        // 1) Validate categories exist (if any were passed)
        if (catIds.length > 0) {
            const existing = await tx.serviceCategory.findMany({
                where: { id: { in: catIds } },
                select: { id: true },
            });
            const existingIds = new Set(existing.map((r) => r.id));
            const missing = catIds.filter((id) => !existingIds.has(id));
            if (missing.length) {
                // Friendly, actionable error
                const err = new Error(`Invalid serviceCategoryIds: ${missing.join(', ')}`);
                err.code = 'INVALID_CATEGORIES';
                err.invalid = missing;
                throw err;
            }
        }

        // 2) Remove existing offerings for this business
        await tx.serviceOffering.deleteMany({
            where: { business_profile_id: businessId },
        });

        // 3) Bulk-insert new offerings (skipDuplicates just in case)
        if (catIds.length > 0) {
            const offeringsData = catIds.map((catId) => ({
                business_profile_id: businessId,
                service_category_id: catId,
            }));

            await tx.serviceOffering.createMany({
                data: offeringsData,
                skipDuplicates: true,
            });
        }

        // 4) Return updated business profile with its offerings + category data
        const updated = await tx.businessProfile.findUnique({
            where: { id: businessId },
            include: {
                service_offerings: {
                    include: { service_category: true },
                },
                media: true,
                address: true,
            },
        });

        return updated;
    });
};

/**
 * Searches for verified businesses that offer a specific service, near a location.
 * @param {object} filters - { categoryId, lat, lon, radiusMeters }
 */
export const searchServices = async (filters = {}) => {
    const { categoryId, lat, lon, radiusMeters = 10000 } = filters ?? {};

    // --- Validate inputs ---
    if (categoryId === undefined || categoryId === null) {
        throw new Error('categoryId is required');
    }
    const latNum = Number(lat);
    const lonNum = Number(lon);
    const radius = Number(radiusMeters);

    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
        throw new Error('Valid lat and lon are required');
    }
    if (!Number.isFinite(radius) || radius <= 0) {
        throw new Error('radiusMeters must be a positive number');
    }

    // --- Step 1: raw query to find matching business ids and distances ---
    // We handle WKB stored in addresses.location via ST_GeogFromWKB(...)
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT bp.id,
             ST_Distance(
               ST_GeogFromWKB(addr.location),
               ST_SetSRID(ST_MakePoint(${lonNum}, ${latNum}), 4326)::geography
             ) AS distance_m
      FROM "business_profiles" bp
      JOIN "service_offerings" so ON bp.id = so.business_profile_id
      JOIN "addresses" addr ON bp.id = addr.business_profile_id
      WHERE bp.status = 'verified'
        AND so.service_category_id = ${Number(categoryId)}
        AND addr.location IS NOT NULL
        AND ST_DWithin(
          ST_GeogFromWKB(addr.location),
          ST_SetSRID(ST_MakePoint(${lonNum}, ${latNum}), 4326)::geography,
          ${radius}
        )
      ORDER BY distance_m ASC;
    `;

    if (!rows || rows.length === 0) return [];

    // Normalize ids and build a lookup for distances
    const idKey = (v) => {
        if (typeof v === 'bigint') return v.toString();
        if (typeof v === 'number') return String(v);
        return String(v);
    };

    const distanceById = new Map();
    const businessIds = rows.map((r) => {
        const idStr = idKey(r.id);
        distanceById.set(idStr, typeof r.distance_m === 'bigint' ? Number(r.distance_m) : Number(r.distance_m));
        // return numeric/BigInt where Prisma expects BigInt for BigInt columns:
        // Prisma accepts JS number for findMany 'in' when ids are integers, but to be safe convert to BigInt if appropriate:
        // We'll store string ids and filter by them via conversion below.
        return r.id;
    });

    // --- Step 2: fetch full profiles and related data ---
    // Prisma can accept mixed id types; use the array we got.
    const businesses = await prisma.businessProfile.findMany({
        where: { id: { in: businessIds } },
        include: {
            address: true,
            recommendations: { select: { rating: true } }, // to compute avg & count
            service_offerings: { include: { service_category: true } },
            media: true,
        },
    });

    // --- Step 3: compute aggregates, attach distance, and format response ---
    const result = businesses.map((b) => {
        // Ensure recommendations is an array
        const recs = Array.isArray(b.recommendations) ? b.recommendations : [];
        const recommendation_count = recs.length;
        const average_rating =
            recommendation_count === 0
                ? null
                : Number((recs.reduce((sum, r) => sum + (typeof r.rating === 'number' ? r.rating : 0), 0) / recommendation_count).toFixed(2));

        const idStr = idKey(b.id);
        const distance_m_raw = distanceById.has(idStr) ? distanceById.get(idStr) : null;
        const distance_m = distance_m_raw == null || Number.isNaN(distance_m_raw) ? null : Number(distance_m_raw);

        return {
            id: typeof b.id === 'bigint' ? b.id.toString() : String(b.id),
            business_name: b.business_name,
            category: b.category,
            description: b.description,
            phone_number: b.phone_number,
            website: b.website,
            average_rating,
            recommendation_count,
            distance_m, // meters from query point (may be null if not available)
            address: b.address
                ? {
                    city: b.address.city,
                    address_line_1: b.address.address_line_1,
                    postal_code: b.address.postal_code,
                    // omit raw geography column; if you need coordinates, extract ST_X/ST_Y when seeding or add a computed column
                }
                : null,
            service_offerings: Array.isArray(b.service_offerings)
                ? b.service_offerings.map((so) => ({
                    id: so.id,
                    service_category: { id: so.service_category.id, name: so.service_category.name },
                }))
                : [],
            media: Array.isArray(b.media) ? b.media : [],
        };
    });

    // Optionally sort by distance (already ordered by raw query), but ensure stable ordering:
    result.sort((a, b) => {
        if (a.distance_m == null && b.distance_m == null) return 0;
        if (a.distance_m == null) return 1;
        if (b.distance_m == null) return -1;
        return a.distance_m - b.distance_m;
    });

    return result;
};

/**
 * Creates a recommendation for a business.
 * @param {string} reviewerId
 * @param {BigInt} businessId
 * @param {object} data - { rating, comment }
 */
export const createRecommendation = async (reviewerId, businessId, data) => {
    // The unique constraint in the DB will prevent duplicates, but we can check here for a better error message.
    const existing = await prisma.businessRecommendation.findUnique({
        where: { reviewer_id_business_profile_id: { reviewer_id: reviewerId, business_profile_id: businessId } }
    });
    if (existing) {
        throw new Error("You have already reviewed this business.");
    }
    return prisma.businessRecommendation.create({
        data: {
            reviewer_id: reviewerId,
            business_profile_id: businessId,
            rating: data.rating,
            comment: data.comment,
        },
    });
};

/**
 * Gets all recommendations for a specific business.
 */
export const getRecommendationsForBusiness = async (businessId) => {
    return prisma.businessRecommendation.findMany({
        where: { business_profile_id: businessId },
        include: {
            reviewer: { select: { id: true, full_name: true, avatar_url: true } }
        },
        orderBy: { created_at: 'desc' }
    });
};

export const getBusinessServices = async (businessId) => {
    return prisma.serviceOffering.findMany({
        where: { business_profile_id: businessId },
        include: {
            service_category: true,
        },
        orderBy: { id: 'asc' },
    });
};
/**
 * Create a new service offering for a business.
 * data: { service_category_id, price?, description?, active? }
 */
export const createBusinessService = async (businessId, data) => {
    if (!businessId) {
        const err = new Error('businessId required');
        err.code = 'BUSINESS_ID_REQUIRED';
        throw err;
    }

    const scId = data.service_category_id ?? data.serviceCategoryIds ?? data.category_id;
    if (!scId) {
        const err = new Error('service_category_id is required');
        err.code = 'MISSING_CATEGORY';
        throw err;
    }

    // validate category exists (ServiceCategory.id is Int)
    const cat = await prisma.serviceCategory.findUnique({ where: { id: Number(scId) } });
    if (!cat) {
        const err = new Error(`Invalid service_category_id: ${scId}`);
        err.code = 'INVALID_CATEGORY';
        err.invalid = [scId];
        throw err;
    }

    try {
        return await prisma.serviceOffering.create({
            data: {
                business_profile_id: businessId,
                service_category_id: Number(scId),
            },
        });
    } catch (e) {
        // Handle unique constraint (business_profile_id + service_category_id)
        // Prisma unique constraint error code is P2002
        if (e && e.code === 'P2002') {
            const err = new Error('This service category is already offered by the business.');
            err.statusCode = 409;
            throw err;
        }
        throw e;
    }
};

/**
 * Update a service offering. Ensures the offering belongs to the business.
 * data: allowed same as create (price, description, active, service_category_id)
 */
export const updateBusinessService = async (businessId, serviceId, data) => {
    const offering = await prisma.serviceOffering.findUnique({ where: { id: Number(serviceId) } });
    if (!offering) {
        const err = new Error('Service offering not found');
        err.statusCode = 404;
        throw err;
    }
    if (String(offering.business_profile_id) !== String(businessId)) {
        const err = new Error('Forbidden: offering does not belong to this business');
        err.statusCode = 403;
        throw err;
    }

    const updateData = {};
    if (data.serviceCategoryId !== undefined) {
        const newCatId = Number(data.serviceCategoryId);
        const cat = await prisma.serviceCategory.findUnique({ where: { id: newCatId } });
        if (!cat) {
            const err = new Error(`Invalid serviceCategoryId: ${data.serviceCategoryId}`);
            err.code = 'INVALID_CATEGORY';
            err.invalid = [data.serviceCategoryId];
            throw err;
        }
        updateData.serviceCategoryId = newCatId;
    }

    if (Object.keys(updateData).length === 0) {
        const err = new Error('No updatable fields provided');
        err.statusCode = 400;
        throw err;
    }

    try {
        return await prisma.serviceOffering.update({
            where: { id: Number(serviceId) },
            data: updateData,
        });
    } catch (e) {
        if (e && e.code === 'P2002') {
            const err = new Error('Another offering with that category already exists for this business.');
            err.statusCode = 409;
            throw err;
        }
        throw e;
    }
};

/**
 * Delete a service offering. Ensures the offering belongs to the business.
 */
export const deleteBusinessService = async (businessId, serviceId) => {
    const offering = await prisma.serviceOffering.findUnique({ where: { id: Number(serviceId) } });
    if (!offering) {
        const err = new Error('Service offering not found');
        err.statusCode = 404;
        throw err;
    }
    if (String(offering.business_profile_id) !== String(businessId)) {
        const err = new Error('Forbidden: offering does not belong to this business');
        err.statusCode = 403;
        throw err;
    }
    await prisma.serviceOffering.delete({ where: { id: Number(serviceId) } });
    return { success: true };
};