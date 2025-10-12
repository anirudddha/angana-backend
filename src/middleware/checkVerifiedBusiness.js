// src/middleware/checkVerifiedBusiness.js
import asyncHandler from 'express-async-handler';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const checkVerifiedBusiness = asyncHandler(async (req, res, next) => {
  try {
    // Assumes `authenticate` middleware has already run and attached `req.user`
    const userId = req.user.id;

    const businessProfile = await prisma.businessProfile.findUnique({
      where: { profile_id: userId },
    });

    if (!businessProfile || businessProfile.status !== 'verified') {
      return res.status(403).json({
        message: 'Forbidden: This action requires a verified business account.',
      });
    }

    // Attach the business profile to the request for easy access in controllers
    req.businessProfile = businessProfile;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Something went wrong while checking business verification.' });
  }
});
