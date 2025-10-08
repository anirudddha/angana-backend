import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const searchAll = async (query, neighborhoodId) => {
  if (!query) return { posts: [], listings: [] };

  const rawQuery = query.trim();

  const posts = await prisma.$queryRaw`
    SELECT id, content, created_at
    FROM posts
    WHERE neighborhood_id = ${neighborhoodId}
      AND (CASE WHEN content_tsv IS NULL THEN to_tsvector('english', content) ELSE content_tsv END)
          @@ plainto_tsquery('english', ${rawQuery})
    LIMIT 10;
  `;

  const listings = await prisma.$queryRaw`
    SELECT id, title, price
    FROM marketplace_listings
    WHERE neighborhood_id = ${neighborhoodId}
      AND (CASE WHEN content_tsv IS NULL THEN to_tsvector('english', coalesce(title, '')) ELSE content_tsv END)
          @@ plainto_tsquery('english', ${rawQuery})
    LIMIT 10;
  `;

  return {
    posts: posts.map(p => ({ ...p, type: 'post' })),
    listings: listings.map(l => ({ ...l, type: 'listing' })),
  };
};
