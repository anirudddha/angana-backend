import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createListing = async (sellerId, listingData) => {
  // 1. Validate input
  if (!listingData || !listingData.title || typeof listingData.price !== 'number') {
    throw new Error('Invalid listing data. Title and numeric price are required.');
  }

  // 2. Find the user's neighborhood membership
  const membership = await prisma.neighborhoodMembership.findFirst({
    where: { user_id: sellerId },
    select: { neighborhood_id: true },
  });
  if (!membership) {
    throw new Error('User does not belong to any neighborhood.');
  }

  // 3. Get the user's address location as WKT (e.g. "POINT(lon lat)")
  const locRows = await prisma.$queryRawUnsafe(
    `SELECT ST_AsText(location) AS wkt
     FROM addresses
     WHERE user_id = $1::uuid
     LIMIT 1;`,
    sellerId
  );

  if (!locRows || locRows.length === 0 || !locRows[0].wkt) {
    throw new Error('User address or location not found.');
  }

  const pointWkt = locRows[0].wkt; // e.g. "POINT(-122.037 37.39)"

  // 4. Insert marketplace listing using parameterized query
  const rows = await prisma.$queryRawUnsafe(
    `INSERT INTO marketplace_listings
      (seller_id, neighborhood_id, title, description, price, category, status, location)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, 'available', ST_GeomFromText($7, 4326))
     RETURNING id, seller_id, neighborhood_id, title, description, price, category, status, created_at;`,
    sellerId,
    membership.neighborhood_id,
    listingData.title,
    listingData.description ?? null,
    listingData.price,
    listingData.category ?? null,
    pointWkt
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to create listing.');
  }

  const created = rows[0];

  // 5. Convert BigInt id to string (safe for JSON)
  if (typeof created.id === 'bigint') {
    created.id = created.id.toString();
  }

  return created;
};



export const searchListings = async (filters) => {
  const { q, category, lat, lon, radiusMeters = 5000 } = filters;
  if (!lat || !lon) throw new Error('Latitude and longitude are required for search.');

  const userLocation = `POINT(${lon} ${lat})`; // lon lat

  const whereClauses = ['ST_DWithin(location, ST_GeomFromText($1,4326)::geography, $2)'];
  const params = [userLocation, radiusMeters];

  if (category) {
    params.push(category);
    whereClauses.push(`category = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    whereClauses.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }

  const query = `
    SELECT
      id,
      title,
      description,
      price,
      category,
      status,
      ST_Distance(location, ST_GeomFromText($1,4326)::geography) AS distance_meters,
      created_at
    FROM marketplace_listings
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY distance_meters ASC
    LIMIT 100;
  `;

  const rows = await prisma.$queryRawUnsafe(query, ...params);

  // Convert BigInt id to string for JSON safety
  return (rows || []).map((r) => {
    if (typeof r.id === 'bigint') r.id = r.id.toString();
    return r;
  });
};
