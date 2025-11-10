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
    })
  ]);

  listing.media = media;
  listing.seller = seller;

  return listing;
};

// Get all listings created by a specific user (my listings/my offers)
export const getMyListings = async (userId) => {
  const listings = await prisma.marketplaceListing.findMany({
    where: { seller_id: userId },
    include: {
      media: { select: { id: true, url: true } },
      seller: { select: { user_id: true, full_name: true } },
      neighborhood: { select: { id: true, name: true } }
    },
    orderBy: { created_at: 'desc' }
  });

  // Convert BigInt fields to strings
  return listings.map(listing => ({
    ...listing,
    id: listing.id.toString(),
    neighborhood_id: listing.neighborhood_id.toString(),
    media: listing.media.map(m => ({
      ...m,
      id: m.id.toString()
    }))
  }));
};

// Update a listing (seller only)
export const updateListing = async (listingId, sellerId, updateData) => {
  const listingIdBigInt = typeof listingId === 'string' ? BigInt(listingId) : listingId;

  // Verify ownership using updateMany (atomic check)
  const updatePayload = {};
  if (updateData.title !== undefined) updatePayload.title = updateData.title;
  if (updateData.description !== undefined) updatePayload.description = updateData.description;
  if (updateData.price !== undefined) updatePayload.price = updateData.price;
  if (updateData.category !== undefined) updatePayload.category = updateData.category;
  if (updateData.status !== undefined) updatePayload.status = updateData.status;

  return await prisma.$transaction(async (tx) => {
    // Get user's address location if we need to update location
    if (updateData.updateLocation) {
      const locRows = await tx.$queryRawUnsafe(
        `SELECT ST_AsText(location) AS wkt FROM addresses WHERE user_id = $1::uuid LIMIT 1;`,
        sellerId
      );
      if (locRows && locRows.length > 0 && locRows[0].wkt) {
        const pointWkt = locRows[0].wkt;
        // Use raw query for location update since Prisma doesn't support geography directly
        await tx.$queryRawUnsafe(
          `UPDATE marketplace_listings 
           SET location = ST_GeomFromText($1, 4326)
           WHERE id = $2::bigint AND seller_id = $3::uuid;`,
          pointWkt,
          listingIdBigInt,
          sellerId
        );
      }
    }
    // Update the listing (only if there are fields to update)
    if (Object.keys(updatePayload).length > 0) {
      const updateResult = await tx.marketplaceListing.updateMany({
        where: {
          id: listingIdBigInt,
          seller_id: sellerId
        },
        data: updatePayload
      });

      if (updateResult.count === 0) {
        // Check if listing exists
        const exists = await tx.marketplaceListing.findUnique({
          where: { id: listingIdBigInt }
        });
        if (!exists) {
          throw new Error('Listing not found');
        }
        throw new Error('Not authorized to update this listing');
      }
    }

    // Handle media updates if provided
    if (Array.isArray(updateData.mediaUrls)) {
      // Delete existing media
      await tx.media.deleteMany({
        where: { marketplace_listing_id: listingIdBigInt }
      });

      // Create new media if provided
      if (updateData.mediaUrls.length > 0) {
        const mediaData = updateData.mediaUrls.map((url) => ({
          uploader_id: sellerId,
          url,
          marketplace_listing_id: listingIdBigInt,
        }));
        await tx.media.createMany({ data: mediaData });
      }
    }

    // Fetch updated listing with media
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
      listingIdBigInt
    );

    if (!listingWithMediaRows || listingWithMediaRows.length === 0) {
      throw new Error('Failed to fetch updated listing');
    }

    return listingWithMediaRows[0];
  });
};

// Delete a listing (seller only)
export const deleteListing = async (listingId, sellerId) => {
  const listingIdBigInt = typeof listingId === 'string' ? BigInt(listingId) : listingId;

  // Verify ownership
  const existingListing = await prisma.marketplaceListing.findUnique({
    where: { id: listingIdBigInt }
  });

  if (!existingListing) {
    throw new Error('Listing not found');
  }

  if (existingListing.seller_id !== sellerId) {
    throw new Error('Not authorized to delete this listing');
  }

  // Delete media first (cascade should handle this, but being explicit)
  await prisma.media.deleteMany({
    where: { marketplace_listing_id: listingIdBigInt }
  });

  // Delete the listing
  await prisma.marketplaceListing.delete({
    where: { id: listingIdBigInt }
  });

  return { message: 'Listing deleted successfully' };
};

// Admin: Get all listings with optional filters
export const getAllListings = async (filters = {}) => {
  const { status, category, sellerId, neighborhoodId, limit = 100, offset = 0 } = filters;

  const where = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (sellerId) where.seller_id = sellerId;
  if (neighborhoodId) {
    where.neighborhood_id = typeof neighborhoodId === 'string' ? BigInt(neighborhoodId) : neighborhoodId;
  }

  const listings = await prisma.marketplaceListing.findMany({
    where,
    include: {
      media: { select: { id: true, url: true } },
      seller: { select: { user_id: true, full_name: true } },
      neighborhood: { select: { id: true, name: true } }
    },
    orderBy: { created_at: 'desc' },
    take: parseInt(limit),
    skip: parseInt(offset)
  });

  // Convert BigInt fields to strings
  return listings.map(listing => ({
    ...listing,
    id: listing.id.toString(),
    neighborhood_id: listing.neighborhood_id.toString(),
    media: listing.media.map(m => ({
      ...m,
      id: m.id.toString()
    }))
  }));
};

// Admin: Update listing status (can update any listing)
export const updateListingStatus = async (listingId, status) => {
  const listingIdBigInt = typeof listingId === 'string' ? BigInt(listingId) : listingId;

  const existingListing = await prisma.marketplaceListing.findUnique({
    where: { id: listingIdBigInt }
  });

  if (!existingListing) {
    throw new Error('Listing not found');
  }

  const updated = await prisma.marketplaceListing.update({
    where: { id: listingIdBigInt },
    data: { status },
    include: {
      media: { select: { id: true, url: true } },
      seller: { select: { user_id: true, full_name: true } }
    }
  });

  return {
    ...updated,
    id: updated.id.toString(),
    neighborhood_id: updated.neighborhood_id.toString(),
    media: updated.media.map(m => ({
      ...m,
      id: m.id.toString()
    }))
  };
};

// Admin: Delete any listing
export const deleteListingAdmin = async (listingId) => {
  const listingIdBigInt = typeof listingId === 'string' ? BigInt(listingId) : listingId;

  const existingListing = await prisma.marketplaceListing.findUnique({
    where: { id: listingIdBigInt }
  });

  if (!existingListing) {
    throw new Error('Listing not found');
  }

  // Delete media first
  await prisma.media.deleteMany({
    where: { marketplace_listing_id: listingIdBigInt }
  });

  // Delete the listing
  await prisma.marketplaceListing.delete({
    where: { id: listingIdBigInt }
  });

  return { message: 'Listing deleted successfully by admin' };
};