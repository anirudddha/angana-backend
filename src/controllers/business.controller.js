import asyncHandler from 'express-async-handler';
import { applyForBusinessAccount } from '../services/business.service.js';
import { updateBusinessDetails, getPublicBusinessProfile } from '../services/business.service.js';
import { setBusinessServices } from '../services/service.service.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();


const serializeBigInt = (obj) =>
    JSON.parse(JSON.stringify(obj, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)));

/**
 * @desc    Apply for a business account
 * @route   POST /api/v1/business/apply
 * @access  Private
 */
export const applyForBusinessAccountController = asyncHandler(async (req, res) => {
    try {
        // Pull authenticated user identifier from req.user in a flexible way.
        // Many auth systems put profile.id in req.user.id or profile.user_id in req.user.user_id.
        const authUserId = req.user?.id ?? req.user?.user_id ?? req.user?.userId;
        if (!authUserId) {
            return res.status(401).json({ message: 'Unauthorized: missing user id in request context' });
        }

        // Prevent already-business users from applying again
        // If your req.user.role is reliable, use it; otherwise the service will check again.
        if (req.user?.role === 'business') {
            return res.status(400).json({ message: 'You already have a business account.' });
        }

        const { business_name, category, description, addressData } = req.body;

        if (!business_name || !category || !addressData) {
            return res.status(400).json({ message: 'business_name, category and addressData are required in the body.' });
        }

        const businessProfile = await applyForBusinessAccount(authUserId, {
            business_name,
            category,
            description,
            addressData,
        });

        // Prisma returns BigInt for the businessProfile.id (and possibly other fields).
        // Convert BigInt values to strings so JSON.stringify doesn't blow up.
        const safeBusinessProfile = {
            ...businessProfile,
            id: businessProfile.id?.toString?.() ?? businessProfile.id,
            business_name: businessProfile.business_name,
            category: businessProfile.category,
            description: businessProfile.description,
            status: businessProfile.status,
            created_at: businessProfile.created_at,
            updated_at: businessProfile.updated_at,
        };

        res.status(201).json({
            message: 'Business account application submitted successfully and is pending review.',
            businessProfile: safeBusinessProfile,
        });
    } catch (error) {
        console.error('applyForBusinessAccountController error:', error);

        // Map some expected error codes to HTTP status codes
        if (error.code === 'PROFILE_NOT_FOUND') {
            return res.status(404).json({ message: 'Profile not found for the authenticated user.' });
        }
        if (error.code === 'ALREADY_BUSINESS') {
            return res.status(400).json({ message: 'You already have or previously applied for a business account.' });
        }

        // Unexpected error
        res.status(500).json({ message: 'Something went wrong while applying for a business account.' });
    }
});


/**
 * @desc    Update business details (name, category, description, address)
 * @route   PUT /api/v1/business/update
 * @access  Private (Business only)
 */
const convertBigIntDeep = (obj) => {
    if (Array.isArray(obj)) return obj.map(convertBigIntDeep);
    if (obj && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [
                k,
                typeof v === 'bigint' ? v.toString() : convertBigIntDeep(v),
            ])
        );
    }
    return obj;
};

export const updateBusinessController = asyncHandler(async (req, res) => {
    // Get authenticated user id
    const authUserId = req.user?.id ?? req.user?.user_id ?? null;
    if (!authUserId) return res.status(401).json({ message: 'Unauthorized: missing user' });

    // business id from params
    const businessIdParam = req.params.id;
    if (!businessIdParam) return res.status(400).json({ message: 'Business id required in params' });

    // parse update data
    const updateData = req.body;
    if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'Update data is required.' });
    }

    try {
        // call service (service will throw if forbidden/not found)
        const updatedBusiness = await updateBusinessDetails(authUserId, businessIdParam, updateData);

        // Convert BigInt fields to strings for JSON
        const safeBusiness = convertBigIntDeep(updatedBusiness);

        res.json({ message: 'Business updated successfully', updatedBusiness: safeBusiness });
    } catch (err) {
        console.error('updateBusinessController error:', err);

        if (err.code === 'PROFILE_NOT_FOUND') {
            return res.status(404).json({ message: 'Profile not found.' });
        }
        if (err.code === 'BUSINESS_NOT_FOUND') {
            return res.status(404).json({ message: 'Business not found.' });
        }
        if (err.code === 'FORBIDDEN') {
            return res.status(403).json({ message: 'You are not allowed to update this business.' });
        }
        if (err.code === 'UNAUTH') {
            return res.status(401).json({ message: err.message });
        }

        return res.status(500).json({ message: err.message || 'Failed to update business.' });
    }
});

export const getBusinessProfileController = asyncHandler(async (req, res) => {
    // validate id param and convert to BigInt
    const idParam = req.params.id;
    if (!idParam) return res.status(400).json({ message: 'Business id is required in params.' });

    let businessId;
    try {
        businessId = BigInt(idParam);
    } catch (e) {
        return res.status(400).json({ message: 'Invalid business id. Must be a numeric value.' });
    }

    // fetch profile
    const businessProfile = await getPublicBusinessProfile(businessId);

    if (!businessProfile) {
        return res.status(404).json({ message: 'Verified business profile not found.' });
    }

    // convert BigInt -> string recursively for safe JSON
    const safeBusiness = convertBigIntDeep(businessProfile);

    res.status(200).json(safeBusiness);
});

// Add this new controller function
export const setBusinessServicesController = asyncHandler(async (req, res) => {
    // find business profile for the authenticated user (avoid relying on req.businessProfile)
    const business = await prisma.businessProfile.findUnique({
        where: { profile_id: req.user.id }, // assuming req.user.id is Profile.id or req.user.user_id? adjust if necessary
    });

    if (!business) {
        return res.status(404).json({ message: 'Business profile not found' });
    }

    const { serviceCategoryIds } = req.body;

    try {
        const updated = await setBusinessServices(business.id, serviceCategoryIds);
        return res.status(200).json(serializeBigInt(updated));
    } catch (err) {
        // handle validation error from service
        if (err && err.code === 'INVALID_CATEGORIES') {
            return res.status(400).json({ message: err.message, invalidCategoryIds: err.invalid || [] });
        }
        throw err; // let error middleware handle unexpected errors
    }
});