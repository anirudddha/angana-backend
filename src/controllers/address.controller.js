import asyncHandler from 'express-async-handler';
import { setUserAddress } from '../services/address.service.js';

/**
 * Controller to set user's address and assign neighborhood.
 */
export const setUserAddressController = asyncHandler(async (req, res) => {
  const { address_line_1, city, postal_code } = req.body;

  if (!address_line_1 || !city) {
    return res.status(400).json({
      success: false,
      message: "Both address_line_1 and city are required.",
    });
  }

  const result = await setUserAddress(req.user?.user_id, {
    address_line_1,
    city,
    postal_code,
  });

  // Handle missing neighborhood gracefully
  if (!result || !result.neighborhoodId) {
    return res.status(200).json({
      success: true,
      message: "Address updated, but not within a supported neighborhood.",
      data: {
        neighborhoodId: null,
        latitude: result?.latitude ?? null,
        longitude: result?.longitude ?? null,
      },
    });
  }

  // Safely serialize BigInt / IDs
  const serializedResult = {
    neighborhoodId: result.neighborhoodId?.toString() ?? null,
    latitude: result.latitude,
    longitude: result.longitude,
  };

  return res.status(200).json({
    success: true,
    message: "Address updated and neighborhood assigned successfully.",
    data: serializedResult,
  });
});
