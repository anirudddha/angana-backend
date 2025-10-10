// setUserAddress.js
import fetch from 'node-fetch'; // npm i node-fetch
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

/**
 * Simple in-memory cache for geocoding results.
 * Keyed by normalized address string -> { lat, lon, expiresAt }
 * Not persistent across restarts. Replace with Redis if you need persistence.
 */
const geocodeCache = new Map();
const GEOCODE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// Rate-limiting for OSM Nominatim: keep at least 1s between requests
let lastOsmRequestTimestamp = 0;
const MIN_OSM_INTERVAL_MS = 1100; // slightly > 1s to be safe

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function cacheGet(key) {
  const entry = geocodeCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    geocodeCache.delete(key);
    return null;
  }
  return entry.value;
}
function cacheSet(key, value) {
  geocodeCache.set(key, { value, expiresAt: Date.now() + GEOCODE_TTL_MS });
}

/**
 * Geocode a freeform address.
 * Tries LocationIQ first (if LOCATIONIQ_KEY env var present), otherwise falls back to OSM Nominatim.
 * Ensures a custom User-Agent and Referer are sent to avoid Nominatim blocking.
 *
 * Returns: { latitude: string, longitude: string }
 */
async function geocodeAddress(fullAddress) {
  const normalized = fullAddress.trim().toLowerCase();
  const cached = cacheGet(normalized);
  if (cached) return cached;

  // Prefer LocationIQ if key available (more robust than free Nominatim).
  const locIqKey = process.env.LOCATIONIQ_KEY;
  const userAgent = process.env.GEOCODE_USER_AGENT || 'NeighborhoodConnectApp/1.0 (blackperl06@angana.com)';
  const referer = process.env.GEOCODE_REFERER || 'https://yourdomain.example';

  if (locIqKey) {
    const url = `https://us1.locationiq.com/v1/search.php?key=${encodeURIComponent(locIqKey)}&q=${encodeURIComponent(fullAddress)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        Referer: referer,
      },
    });
    if (!res.ok) {
      // If LocationIQ fails (rate limit, quota), fall back to Nominatim
      // but only after logging the status
      const txt = await res.text();
      console.warn(`LocationIQ returned ${res.status}: ${txt}`);
    } else {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        const { lat, lon } = json[0];
        const value = { latitude: lat, longitude: lon };
        cacheSet(normalized, value);
        return value;
      }
    }
  }

  // Fallback to OSM Nominatim (public). Respect rate limits and set identifying headers.
  const now = Date.now();
  const since = now - lastOsmRequestTimestamp;
  if (since < MIN_OSM_INTERVAL_MS) {
    await sleep(MIN_OSM_INTERVAL_MS - since);
  }

  const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1&addressdetails=0`;
  const nomRes = await fetch(nomUrl, {
    headers: {
      'User-Agent': userAgent,
      Referer: referer,
    },
  });
  lastOsmRequestTimestamp = Date.now();

  if (!nomRes.ok) {
    const body = await nomRes.text();
    throw new Error(`Geocoding (Nominatim) failed: ${nomRes.status} ${nomRes.statusText} — ${body}`);
  }

  const nomJson = await nomRes.json();
  if (!Array.isArray(nomJson) || nomJson.length === 0) {
    throw new Error('Could not geocode the provided address (no results).');
  }

  const { lat, lon } = nomJson[0];
  const result = { latitude: lat, longitude: lon };
  cacheSet(normalized, result);
  return result;
}

/**
 * Sets a user's address, geocodes it, finds their neighborhood,
 * and creates/updates their neighborhood membership.
 *
 * @param {string} userId - UUID string
 * @param {{ address_line_1: string, city: string, postal_code: string }} addressData
 * @returns {{ neighborhoodId: number, latitude: string, longitude: string }}
 */
export const setUserAddress = async (userId, addressData) => {
  if (!userId) throw new Error('userId is required');
  if (!addressData || !addressData.address_line_1 || !addressData.city) {
    throw new Error('addressData with address_line_1 and city is required');
  }

  const fullAddress = `${addressData.address_line_1}, ${addressData.city}${addressData.postal_code ? ', ' + addressData.postal_code : ''}`;

  // 1) Geocode
  const geoResult = await geocodeAddress(fullAddress);
  if (!geoResult || !geoResult.latitude || !geoResult.longitude) {
    throw new Error('Could not geocode the provided address.');
  }
  const latitude = String(geoResult.latitude);
  const longitude = String(geoResult.longitude);

  // PostGIS expects "POINT(lon lat)"
  const point = `POINT(${longitude} ${latitude})`;

  // 2) Find neighborhood that contains this point (parameterized)
  const neighborhoods = await prisma.$queryRaw`
    SELECT id FROM neighborhoods
    WHERE ST_Contains(boundaries::geometry, ST_GeomFromText(${point}, 4326))
    LIMIT 1;
  `;

  if (!Array.isArray(neighborhoods) || neighborhoods.length === 0) {
    throw new Error('Sorry, your address is not within a supported neighborhood.');
  }
  const neighborhoodId = neighborhoods[0].id;

  // 3) Transaction: upsert address & membership using parameterized SQL
  const result = await prisma.$transaction(async (tx) => {
    // Addresses upsert via INSERT ... ON CONFLICT
    await tx.$executeRaw`
      INSERT INTO addresses (user_id, address_line_1, city, postal_code, neighborhood_id, location)
      VALUES (CAST(${userId} AS uuid), ${addressData.address_line_1}, ${addressData.city}, ${addressData.postal_code}, ${neighborhoodId}, ST_GeomFromText(${point}, 4326))
      ON CONFLICT (user_id)
      DO UPDATE SET
        address_line_1 = EXCLUDED.address_line_1,
        city = EXCLUDED.city,
        postal_code = EXCLUDED.postal_code,
        neighborhood_id = EXCLUDED.neighborhood_id,
        location = EXCLUDED.location;
    `;

    // Neighborhood membership insert (do nothing on conflict)
    await tx.$executeRaw`
      INSERT INTO neighborhood_memberships (user_id, neighborhood_id)
      VALUES (CAST(${userId} AS uuid), ${neighborhoodId})
      ON CONFLICT (user_id, neighborhood_id) DO NOTHING;
    `;

    return { neighborhoodId, latitude, longitude };
  });

  return result;
};

// optional: graceful shutdown helper
export async function disconnect() {
  await prisma.$disconnect();
}
