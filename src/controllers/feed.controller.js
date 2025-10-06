import asyncHandler from 'express-async-handler';
import { getUserFeed } from '../services/feed.service.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to safely convert BigInt to string before sending JSON
function stringifyBigInts(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

export const getFeedController = asyncHandler(async (req, res) => {
  const authUserId = req.user.user_id; // Supabase Auth user ID
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const profile = await prisma.profile.findUnique({
    where: { user_id: authUserId },
  });

  if (!profile) {
    return res.status(404).json({ message: 'Profile not found for this user.' });
  }

  const feed = await getUserFeed(profile.user_id, page, limit);

  // 🔥 Convert BigInts safely
  res.status(200).json(stringifyBigInts(feed));
});
