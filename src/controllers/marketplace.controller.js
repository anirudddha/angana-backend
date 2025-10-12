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

  res.status(200).json(listing);
});
