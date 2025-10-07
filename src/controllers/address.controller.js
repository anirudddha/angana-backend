import asyncHandler from 'express-async-handler';
import { setUserAddress } from '../services/address.service.js';

export const setUserAddressController = asyncHandler(async (req, res) => {
    const { address_line_1, city, postal_code } = req.body;
    const result = await setUserAddress(req.user.user_id, { address_line_1, city, postal_code });
  
    // Convert BigInt fields to strings
    const serializedResult = {
      ...result,
      neighborhoodId: result.neighborhoodId.toString(),
      latitude: result.latitude,
      longitude: result.longitude,
    };
  
    res.status(200).json({
      message: "Address updated and neighborhood assigned successfully.",
      data: serializedResult,
    });
  });
  