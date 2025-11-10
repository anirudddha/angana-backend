import asyncHandler from 'express-async-handler';
import * as marketplaceService from '../services/marketplace.service.js';

function convertBigIntToString(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(convertBigIntToString);
  if (typeof value === 'object') {
    // preserve Date and Buffer etc.
    if (value instanceof Date) return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = convertBigIntToString(v);
    }
    return out;
  }
  return value;
}

export const createListingController = asyncHandler(async (req, res) => {
  const { title, description, price, category, mediaUrls } = req.body;
  const listing = await marketplaceService.createListing(req.user.user_id, {
    title, description, price, category, mediaUrls
  });

  // Convert BigInt -> string before sending JSON
  const safeListing = convertBigIntToString(listing);
  res.status(201).json(safeListing);
});

export const searchListingsController = asyncHandler(async (req, res) => {
  const { q, category, lat, lon, radius } = req.query;
  const listings = await marketplaceService.searchListings({
    q,
    category,
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    radiusMeters: radius ? parseInt(radius) : undefined,
  });

  // listings may be an array
  const safeListings = convertBigIntToString(listings);
  res.status(200).json(safeListings);
});

export const getListingByIdController = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const listing = await marketplaceService.getListingById(id);

  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }

  // Convert BigInt -> string before sending JSON
  const safeListing = convertBigIntToString(listing);
  res.status(200).json(safeListing);
});

// Get all listings created by the current user (my listings/my offers)
export const getMyListingsController = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const listings = await marketplaceService.getMyListings(userId);
  const safeListings = convertBigIntToString(listings);
  res.status(200).json(safeListings);
});

// Update a listing (seller only)
export const updateListingController = asyncHandler(async (req, res) => {
  const listingId = req.params.id;
  const sellerId = req.user.user_id;
  const updateData = req.body;

  const updatedListing = await marketplaceService.updateListing(listingId, sellerId, updateData);
  const safeListing = convertBigIntToString(updatedListing);
  res.status(200).json(safeListing);
});

// Delete a listing (seller only)
export const deleteListingController = asyncHandler(async (req, res) => {
  const listingId = req.params.id;
  const sellerId = req.user.user_id;

  const result = await marketplaceService.deleteListing(listingId, sellerId);
  res.status(200).json(result);
});

// Admin: Get all listings with optional filters
export const getAllListingsController = asyncHandler(async (req, res) => {
  const filters = {
    status: req.query.status,
    category: req.query.category,
    sellerId: req.query.sellerId,
    neighborhoodId: req.query.neighborhoodId,
    limit: req.query.limit,
    offset: req.query.offset
  };

  const listings = await marketplaceService.getAllListings(filters);
  const safeListings = convertBigIntToString(listings);
  res.status(200).json(safeListings);
});

// Admin: Update listing status
export const updateListingStatusController = asyncHandler(async (req, res) => {
  const listingId = req.params.id;
  const { status } = req.body;

  if (!status) {
    res.status(400);
    throw new Error('Status is required');
  }

  const updatedListing = await marketplaceService.updateListingStatus(listingId, status);
  const safeListing = convertBigIntToString(updatedListing);
  res.status(200).json(safeListing);
});

// Admin: Delete any listing
export const deleteListingAdminController = asyncHandler(async (req, res) => {
  const listingId = req.params.id;

  const result = await marketplaceService.deleteListingAdmin(listingId);
  res.status(200).json(result);
});
