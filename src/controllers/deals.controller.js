import asyncHandler from 'express-async-handler';
import { createDeal, getDealsForNeighborhood, updateDeal } from '../services/deal.service.js';

export const createDealController = asyncHandler(async (req, res) => {
  try {
    const businessProfile = req.businessProfile;
    if (!businessProfile) {
      return res.status(403).json({ message: 'Business profile not found or not verified.' });
    }

    const { title, description, deal_type, endDate, mediaUrls } = req.body;

    const deal = await createDeal(businessProfile.id, {
      title,
      description,
      deal_type,
      endDate,
      mediaUrls,
    });

    res.status(201).json({ message: 'Deal created successfully', deal });
  } catch (error) {
    console.error('createDealController error:', error);
    res.status(500).json({ message: error.message || 'Failed to create deal' });
  }
});

export const getDealsForNeighborhoodController = asyncHandler(async (req, res) => {
  try {
    const neighborhoodId = req.params.id;
    if (!neighborhoodId) return res.status(400).json({ message: 'Neighborhood ID is required.' });

    const deals = await getDealsForNeighborhood(neighborhoodId);

    res.status(200).json({ deals });
  } catch (error) {
    console.error('getDealsForNeighborhoodController error:', error);
    res.status(500).json({ message: 'Something went wrong while fetching deals.' });
  }
});

export const updateDealController = asyncHandler(async (req, res) => {
  try {
    const businessProfile = req.businessProfile;
    if (!businessProfile) {
      return res.status(403).json({ message: 'Business profile not found or not verified.' });
    }

    const dealId = req.params.id;
    if (!dealId) return res.status(400).json({ message: 'Deal ID is required.' });

    const updateData = req.body; // may contain title, description, deal_type, endDate, status, mediaUrls

    const updatedDeal = await updateDeal(businessProfile.id, dealId, updateData);

    res.status(200).json({ message: 'Deal updated successfully', deal: updatedDeal });
  } catch (error) {
    console.error('updateDealController error:', error);
    res.status(500).json({ message: error.message || 'Failed to update deal' });
  }
});
