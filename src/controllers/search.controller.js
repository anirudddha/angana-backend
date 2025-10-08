import asyncHandler from 'express-async-handler';
import { PrismaClient } from '@prisma/client';
import { searchAll } from '../services/search.service.js';

const prisma = new PrismaClient();

// Helper: safely stringify objects with BigInt
const safeJson = (data) => {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
};

export const searchController = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ message: 'Search query "q" is required' });
  }


  if (!req.user) {
    return res
      .status(401)
      .json({ message: 'Not authenticated (req.user missing). Check your auth middleware.' });
  }

  const membership = await prisma.neighborhoodMembership.findFirst({
    where: { user_id: req.user.user_id },
    select: { neighborhood_id: true },
  });


  if (!membership || !membership.neighborhood_id) {
    return res.status(403).json({
      posts: [],
      listings: [],
      message: 'User has no neighborhood membership. Confirm req.user.id and neighborhood data.',
    });
  }

  const results = await searchAll(q, membership.neighborhood_id);


  // Convert BigInt → string safely before sending
  res.status(200).json(safeJson(results));
});
