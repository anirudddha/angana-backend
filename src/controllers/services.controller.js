import asyncHandler from 'express-async-handler';
import * as serviceService from '../services/service.service.js';

// Convert BigInt -> string throughout the object so JSON.stringify won't throw
const serializeBigInt = (obj) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
  );

export const getCategoriesController = asyncHandler(async (req, res) => {
  const categories = await serviceService.getServiceCategories();
  // categories are typically ints/strings, but serialize anyway for safety
  res.status(200).json(serializeBigInt(categories));
});

export const searchServicesController = asyncHandler(async (req, res) => {
  const { categoryId, lat, lon, radius } = req.query;

  // Basic validation
  if (!categoryId) {
    return res.status(400).json({ message: 'categoryId query parameter is required' });
  }
  if (!lat || !lon) {
    return res.status(400).json({ message: 'lat and lon query parameters are required' });
  }

  const radiusMeters = radius ? Number(radius) : undefined;

  // Call service
  const results = await serviceService.searchServices({
    categoryId: Number(categoryId),
    lat: Number(lat),
    lon: Number(lon),
    radiusMeters,
  });

  // Send safely-serialized response
  return res.status(200).json(serializeBigInt(results));
});

export const createRecommendationController = asyncHandler(async (req, res) => {
  // businessId is a BigInt in your schema
  let businessId;
  try {
    businessId = BigInt(req.params.businessId);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid businessId' });
  }

  // reviewer id: keep using the authenticated id string (UUID). Adjust if your service expects user_id vs id.
  const reviewerId = req.user?.id ?? req.user?.user_id;
  if (!reviewerId) return res.status(401).json({ message: 'Unauthorized' });

  const recommendation = await serviceService.createRecommendation(reviewerId, businessId, req.body);
  res.status(201).json(serializeBigInt(recommendation));
});

export const getRecommendationsController = asyncHandler(async (req, res) => {
  let businessId;
  try {
    businessId = BigInt(req.params.businessId);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid businessId' });
  }

  const recommendations = await serviceService.getRecommendationsForBusiness(businessId);
  res.status(200).json(serializeBigInt(recommendations));
});

export const getBusinessServicesController = asyncHandler(async (req, res) => {
  let businessId;
  try {
    businessId = BigInt(req.params.businessId);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid businessId' });
  }

  const services = await serviceService.getBusinessServices(businessId);
  return res.status(200).json(serializeBigInt(services));
});

export const getMyServicesController = asyncHandler(async (req, res) => {
  const business = req.businessProfile;
  const services = await serviceService.getBusinessServices(business.id);
  return res.status(200).json(serializeBigInt(services));
});

export const createBusinessServiceController = asyncHandler(async (req, res) => {
  let businessId;
  try {
    businessId = BigInt(req.params.businessId);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid businessId' });
  }

  if (!req.businessProfile || String(req.businessProfile.id) !== String(businessId)) {
    return res.status(403).json({ message: 'Forbidden: You do not own this business' });
  }

  // expected body: { service_category_id }
  const payload = req.body;
  try {
    const created = await serviceService.createBusinessService(businessId, payload);
    return res.status(201).json(serializeBigInt(created));
  } catch (err) {
    return res.status(err.statusCode || 400).json({ message: err.message, details: err.invalid || undefined });
  }
});

export const updateBusinessServiceController = asyncHandler(async (req, res) => {
  let businessId, serviceId;
  try {
    businessId = BigInt(req.params.businessId);
    serviceId = BigInt(req.params.serviceId);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid businessId or serviceId' });
  }

  if (!req.businessProfile || String(req.businessProfile.id) !== String(businessId)) {
    return res.status(403).json({ message: 'Forbidden: You do not own this business' });
  }

  const payload = req.body; // e.g., { service_category_id: 7 }
  try {
    const updated = await serviceService.updateBusinessService(businessId, serviceId, payload);
    return res.status(200).json(serializeBigInt(updated));
  } catch (err) {
    return res.status(err.statusCode || 400).json({ message: err.message, details: err.invalid || undefined });
  }
});

export const deleteBusinessServiceController = asyncHandler(async (req, res) => {
  let businessId, serviceId;
  try {
    businessId = BigInt(req.params.businessId);
    serviceId = BigInt(req.params.serviceId);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid businessId or serviceId' });
  }
  
  if (!req.businessProfile || String(req.businessProfile.id) !== String(businessId)) {
    return res.status(403).json({ message: 'Forbidden: You do not own this business' });
  }

  try {
    await serviceService.deleteBusinessService(businessId, serviceId);
    return res.status(204).send();
  } catch (err) {
    return res.status(err.statusCode || 400).json({ message: err.message, details: err.invalid || undefined });
  }
});