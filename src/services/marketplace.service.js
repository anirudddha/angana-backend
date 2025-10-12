import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// src/services/marketplace.service.js
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
    `SELECT ST_AsText(location) AS wkt FROM addresses WHERE user_id = $1::uuid LIMIT 1;`,
    sellerId
  );

  if (!locRows || locRows.length === 0 || !locRows[0].wkt) {
    throw new Error('User address or location not found.');
  }

  const pointWkt = locRows[0].wkt; // e.g. "POINT(-122.037 37.39)"

  // 4. Use a transaction: insert listing (raw SQL) then insert media via Prisma
  const result = await prisma.$transaction(async (tx) => {
    // 4a. Insert the listing (raw, parameterized)
    const rows = await tx.$queryRawUnsafe(
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
    const listingDbId = created.id; // keep as BigInt (DB native) for FK insertion

    // 4b. Insert media rows (if any) using Prisma (safe)
    if (listingData.mediaUrls && listingData.mediaUrls.length > 0) {
      const mediaData = listingData.mediaUrls.map((url) => ({
        uploader_id: sellerId,
        url,
        marketplace_listing_id: listingDbId,
      }));
      await tx.media.createMany({ data: mediaData });
    }

    // 4c. Fetch listing with aggregated media (one query) and return it
    const listingWithMediaRows = await tx.$queryRawUnsafe(
      `
      SELECT
        l.id,
        l.seller_id,
        l.neighborhood_id,
        l.title,
        l.description,
        l.price,
        l.category,
        l.status,
        ST_AsText(l.location) AS location,
        l.created_at,
        COALESCE(
          json_agg(json_build_object('id', m.id, 'url', m.url) ORDER BY m.id) 
            FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) AS media
      FROM marketplace_listings l
      LEFT JOIN media m ON m.marketplace_listing_id = l.id
      WHERE l.id = $1::bigint
      GROUP BY l.id;
      `,
      listingDbId
    );

    if (!listingWithMediaRows || listingWithMediaRows.length === 0) {
      throw new Error('Failed to fetch created listing.');
    }

    return listingWithMediaRows[0];
  });

  // 5. Return result (controller will call convertBigIntToString before JSON)
  return result;
};



// In src/services/marketplace.service.js
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

  // 1️⃣ Raw query to get matching listing IDs and distances
  const rawListings = await prisma.$queryRawUnsafe(
    `
      SELECT
        id,
        ST_Distance(location, ST_GeomFromText($1,4326)::geography) AS distance_meters
      FROM marketplace_listings
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY distance_meters ASC
      LIMIT 100;
    `,
    ...params
  );

  if (!rawListings || rawListings.length === 0) return [];

  const listingIds = rawListings.map(l => l.id);

  // 2️⃣ Fetch full listing objects with media and seller info
  const listingsWithMedia = await prisma.marketplaceListing.findMany({
    where: { id: { in: listingIds } },
    include: {
      media: { select: { id: true, url: true } },
      seller: { select: { user_id: true, full_name: true } }
    }
  });

  // 3️⃣ Map distance back to listings
  const listingsMap = new Map(listingsWithMedia.map(l => [l.id, l]));
  return rawListings.map(raw => {
    const listing = listingsMap.get(raw.id);
    if (!listing) return null;

    // Convert BigInt id to string for JSON safety
    if (typeof listing.id === 'bigint') listing.id = listing.id.toString();

    return {
      ...listing,
      distance_meters: raw.distance_meters,
    };
  }).filter(Boolean);
};



export const getListingById = async (id) => {
  const listingId = typeof id === 'string' ? BigInt(id) : id;

  // 1️⃣ Fetch the main listing via raw query
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT
      id,
      seller_id,
      neighborhood_id,
      title,
      description,
      price,
      category,
      status,
      ST_AsText(location) AS location,      -- cast geography to text
      created_at,
      content_tsv::text AS content_tsv      -- cast tsvector to text
    FROM marketplace_listings
    WHERE id = $1::bigint
    LIMIT 1;
    `,
    listingId
  );

  if (!rows || rows.length === 0) return null;

  const listing = rows[0];

  // Convert BigInt fields to string for safe JSON
  if (typeof listing.id === 'bigint') listing.id = listing.id.toString();
  if (typeof listing.neighborhood_id === 'bigint') listing.neighborhood_id = listing.neighborhood_id.toString();

  // 2️⃣ Fetch related media and seller info
  const [media, seller] = await Promise.all([
    prisma.media.findMany({
      where: { marketplace_listing_id: listingId },
      select: { id: true, url: true },
    }),
    prisma.profile.findUnique({
      where: { user_id: listing.seller_id },
      select: { user_id: true, full_name: true, avatar_url: true },
    })
  ]);

  listing.media = media;
  listing.seller = seller;

  return listing;
};
