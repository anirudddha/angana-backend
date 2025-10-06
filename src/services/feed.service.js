// services/feed.service.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const getUserFeed = async (userId, page = 1, limit = 10) => {
  console.log("Fetching feed for user:", userId);

  // 1. Find all neighborhoods the user is a member of
  const memberships = await prisma.neighborhoodMembership.findMany({
    where: { user_id: userId },
    select: { neighborhood_id: true },
  });

  console.log("Memberships found:", memberships);

  if (!memberships || memberships.length === 0) {
    console.log("No neighborhood memberships found.");
    return [];
  }

  const neighborhoodIds = memberships.map(m => m.neighborhood_id);
  console.log("Neighborhood IDs:", neighborhoodIds);

  // 2. Fetch posts from those neighborhoods
  const posts = await prisma.post.findMany({
    where: { neighborhood_id: { in: neighborhoodIds } },
    include: {
      author: {
        select: {
          full_name: true,
          avatar_url: true,
        },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  console.log("Posts fetched:", posts.length);

  if (posts.length === 0) {
    console.log("No posts found for these neighborhoods.");
    return [];
  }

  // 3. Check if the current user has liked each post
  const postIds = posts.map(p => p.id);
  const userLikes = await prisma.postLike.findMany({
    where: {
      post_id: { in: postIds },
      user_id: userId,
    },
    select: { post_id: true },
  });

  const likedPostIds = new Set(userLikes.map(like => like.post_id));

  return posts.map(post => ({
    ...post,
    has_liked: likedPostIds.has(post.id),
  }));
};
