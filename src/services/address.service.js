import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

/**
 * Helper: Geocode using Google Maps API (Server Side)
 * Only used as a backup if the frontend fails to send coordinates.
 */
async function geocodeWithGoogle(fullAddress) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Server missing GOOGLE_MAPS_API_KEY in .env file');
  }

  console.debug('[geocodeWithGoogle] Fetching for:', fullAddress);

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (json.status === 'OK' && json.results && json.results.length > 0) {
      const loc = json.results[0].geometry.location;
      return {
        latitude: String(loc.lat),
        longitude: String(loc.lng)
      };
    } else {
      throw new Error(`Google Geocode failed: ${json.status} - ${json.error_message || 'No results'}`);
    }
  } catch (err) {
    console.error('[geocodeWithGoogle] Error:', err.message);
    throw err;
  }
}

/**
 * setUserAddress
 * Logic:
 * 1. Determine Coordinates (Frontend or Google API).
 * 2. Find Neighborhood (PostGIS).
 * 3. Save Address + Update Profile (is_onboarding_complete = true).
 */
export const setUserAddress = async (userId, addressData) => {
  if (!userId) throw new Error('userId is required');
  if (!addressData || !addressData.address_line_1 || !addressData.city) {
    throw new Error('addressData with address_line_1 and city is required');
  }

  const fullAddress = `${addressData.address_line_1}, ${addressData.city}${addressData.postal_code ? ', ' + addressData.postal_code : ''}`;

  let latitude = null;
  let longitude = null;

  // ---------------------------------------------------------
  // STEP 1: Determine Coordinates
  // ---------------------------------------------------------

  // A. Check if Frontend sent coordinates (Preferred/Fastest)
  if (addressData.latitude && addressData.longitude) {
    console.debug('[setUserAddress] Using coordinates from Frontend/GPS');
    latitude = String(addressData.latitude);
    longitude = String(addressData.longitude);
  }
  // B. Fallback: Geocode using Google API
  else {
    try {
      const geo = await geocodeWithGoogle(fullAddress);
      latitude = geo.latitude;
      longitude = geo.longitude;
    } catch (err) {
      console.warn('[setUserAddress] Coordinate lookup failed:', err.message);

      // FALLBACK TRANSACTION: Save address without location & Complete Onboarding
      return await prisma.$transaction(async (tx) => {
        // 1. Save Address (Partial)
        await tx.$executeRaw`
          INSERT INTO addresses (user_id, address_line_1, city, postal_code)
          VALUES (CAST(${userId} AS uuid), ${addressData.address_line_1}, ${addressData.city}, ${addressData.postal_code})
          ON CONFLICT (user_id) DO UPDATE SET
            address_line_1 = EXCLUDED.address_line_1,
            city = EXCLUDED.city,
            postal_code = EXCLUDED.postal_code;
        `;

        // 2. Mark Onboarding Complete
        await tx.profile.update({
          where: { id: userId },
          data: { is_onboarding_complete: true },
        });

        return { neighborhoodId: null, latitude: null, longitude: null, assigned: false, error: 'Location not found' };
      });
    }
  }

  // ---------------------------------------------------------
  // STEP 2: Find Neighborhood (PostGIS)
  // ---------------------------------------------------------

  const lonNum = Number(longitude);
  const latNum = Number(latitude);

  // A. Try Strict Contains (Point inside Polygon)
  let neighborhoods = [];
  try {
    neighborhoods = await prisma.$queryRaw`
      SELECT id
      FROM neighborhoods
      WHERE ST_Contains(boundaries::geometry, ST_SetSRID(ST_MakePoint(${lonNum}, ${latNum})::geometry, 4326))
      LIMIT 1;
    `;
  } catch (err) {
    console.warn('[setUserAddress] ST_Contains error:', err.message);
  }

  // B. Fallback: Try Nearest Neighbor (within 200m buffer)
  if (!neighborhoods || neighborhoods.length === 0) {
    const bufferMeters = Number(process.env.NEIGHBORHOOD_FALLBACK_METERS || '200');
    try {
      neighborhoods = await prisma.$queryRaw`
        SELECT id, ST_Distance(boundaries::geography, ST_SetSRID(ST_MakePoint(${lonNum}, ${latNum}), 4326)::geography) as dist
        FROM neighborhoods
        WHERE ST_DWithin(boundaries::geography, ST_SetSRID(ST_MakePoint(${lonNum}, ${latNum})::geometry, 4326)::geography, ${bufferMeters})
        ORDER BY dist ASC
        LIMIT 1;
      `;
    } catch (err) {
      console.warn('[setUserAddress] ST_DWithin error:', err.message);
    }
  }

  // ---------------------------------------------------------
  // STEP 3: Save to Database
  // ---------------------------------------------------------

  // Case: No Neighborhood Found (But location is valid)
  if (!neighborhoods || neighborhoods.length === 0) {
    console.warn('[setUserAddress] No neighborhood match for:', fullAddress);
    const res = await prisma.$transaction(async (tx) => {
      // 1. Save Address with Location
      await tx.$executeRaw`
        INSERT INTO addresses (user_id, address_line_1, city, postal_code, location)
        VALUES (CAST(${userId} AS uuid), ${addressData.address_line_1}, ${addressData.city}, ${addressData.postal_code}, ST_SetSRID(ST_MakePoint(${lonNum}, ${latNum})::geometry, 4326))
        ON CONFLICT (user_id)
        DO UPDATE SET
          address_line_1 = EXCLUDED.address_line_1,
          city = EXCLUDED.city,
          postal_code = EXCLUDED.postal_code,
          location = EXCLUDED.location;
      `;

      // 2. Mark Onboarding Complete (Even if no neighborhood assigned, they are done setup)
      await tx.profile.update({
        where: { user_id: userId },
        data: { is_onboarding_complete: true },
      });

      return { neighborhoodId: null, latitude, longitude, assigned: false };
    });
    return res;
  }

  // Case: Neighborhood Found
  const neighborhoodId = neighborhoods[0].id;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Upsert Address
    await tx.$executeRaw`
      INSERT INTO addresses (user_id, address_line_1, city, postal_code, neighborhood_id, location)
      VALUES (CAST(${userId} AS uuid), ${addressData.address_line_1}, ${addressData.city}, ${addressData.postal_code}, ${neighborhoodId}, ST_SetSRID(ST_MakePoint(${lonNum}, ${latNum})::geometry, 4326))
      ON CONFLICT (user_id)
      DO UPDATE SET
        address_line_1 = EXCLUDED.address_line_1,
        city = EXCLUDED.city,
        postal_code = EXCLUDED.postal_code,
        neighborhood_id = EXCLUDED.neighborhood_id,
        location = EXCLUDED.location;
    `;

    // 2. Upsert Membership
    await tx.$executeRaw`
      INSERT INTO neighborhood_memberships (user_id, neighborhood_id)
      VALUES (CAST(${userId} AS uuid), ${neighborhoodId})
      ON CONFLICT (user_id, neighborhood_id) DO NOTHING;
    `;

    // 3. Mark Onboarding Complete
    await tx.profile.update({
      where: { id: userId },
      data: { is_onboarding_complete: true },
    });

    return { neighborhoodId, latitude, longitude, assigned: true };
  });

  return result;
};

export async function disconnect() { await prisma.$disconnect(); }