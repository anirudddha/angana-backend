import NodeGeocoder from 'node-geocoder';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// const geocoder = NodeGeocoder({ provider: 'openstreetmap' });

const geocoder = NodeGeocoder({
  provider: 'openstreetmap',
  userAgent: 'NeighborhoodConnectApp/1.0 (blackperl06@angana.com)',
});

/**
 * Sets a user's address, geocodes it, finds their neighborhood,
 * and creates their neighborhood membership.
 */
export const setUserAddress = async (userId, addressData) => {
  // 1️⃣ Geocode the address
  const fullAddress = `${addressData.address_line_1}, ${addressData.city}, ${addressData.postal_code}`;
  const geoResult = await geocoder.geocode(fullAddress);

  if (!geoResult || geoResult.length === 0) {
    throw new Error('Could not geocode the provided address.');
  }
  const { latitude, longitude } = geoResult[0];
  const point = `POINT(${longitude} ${latitude})`; // Lon Lat order

  // 2️⃣ Find neighborhood containing this point
  const neighborhoods = await prisma.$queryRaw`
    SELECT id FROM neighborhoods
    WHERE ST_Contains(boundaries::geometry, ST_GeomFromText(${point}, 4326))
    LIMIT 1;
  `;

  if (neighborhoods.length === 0) {
    throw new Error('Sorry, your address is not within a supported neighborhood.');
  }
  const neighborhoodId = neighborhoods[0].id;

  // 3️⃣ Transaction: save address & membership
  const result = await prisma.$transaction(async (tx) => {
    // Insert or update address with UUID cast
    await tx.$executeRaw`
      INSERT INTO addresses (user_id, address_line_1, city, postal_code, neighborhood_id, location)
      VALUES (${Prisma.raw(`'${userId}'::uuid`)}, 
              ${addressData.address_line_1}, 
              ${addressData.city}, 
              ${addressData.postal_code}, 
              ${neighborhoodId}, 
              ST_GeomFromText(${point}, 4326))
      ON CONFLICT (user_id)
      DO UPDATE SET
        address_line_1 = EXCLUDED.address_line_1,
        city = EXCLUDED.city,
        postal_code = EXCLUDED.postal_code,
        neighborhood_id = EXCLUDED.neighborhood_id,
        location = EXCLUDED.location;
    `;

    // Upsert neighborhood membership with UUID cast
    await tx.$executeRaw`
      INSERT INTO neighborhood_memberships (user_id, neighborhood_id)
      VALUES (${Prisma.raw(`'${userId}'::uuid`)}, ${neighborhoodId})
      ON CONFLICT (user_id, neighborhood_id) DO NOTHING;
    `;

    return { neighborhoodId, latitude, longitude };
  });

  return result;
};
