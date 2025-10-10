// src/services/address.service.js  (updated)
import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

/* existing cache + rate-limit code (unchanged) */
const geocodeCache = new Map();
const GEOCODE_TTL_MS = 1000 * 60 * 60 * 24;
let lastOsmRequestTimestamp = 0;
const MIN_OSM_INTERVAL_MS = 1100;
function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }
function cacheGet(key) { const e = geocodeCache.get(key); if (!e) return null; if (Date.now() > e.expiresAt) { geocodeCache.delete(key); return null; } return e.value; }
function cacheSet(key, value) { geocodeCache.set(key, { value, expiresAt: Date.now() + GEOCODE_TTL_MS }); }

/* keep your existing geocodeAddress but add optional GOOGLE_GEOCODING_KEY fallback (recommended).
   For brevity, I assume your existing geocodeAddress is kept (LocationIQ -> Nominatim).
   If you want the full improved geocodeAddress, say so and I will paste it. */

async function geocodeAddress(fullAddress) {
  const normalized = fullAddress.trim().toLowerCase();
  const cached = cacheGet(normalized);
  if (cached) return cached;

  const locIqKey = process.env.LOCATIONIQ_KEY;
  const userAgent = process.env.GEOCODE_USER_AGENT || 'NeighborhoodConnectApp/1.0 (contact@example.com)';
  const referer = process.env.GEOCODE_REFERER || 'https://yourdomain.example';

  // LocationIQ
  if (locIqKey) {
    try {
      const url = `https://us1.locationiq.com/v1/search.php?key=${encodeURIComponent(locIqKey)}&q=${encodeURIComponent(fullAddress)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { 'User-Agent': userAgent, Referer: referer } });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          const { lat, lon } = json[0];
          const value = { latitude: String(lat), longitude: String(lon) };
          cacheSet(normalized, value);
          return value;
        }
      } else {
        const body = await res.text();
        console.warn('[geocode] LocationIQ failed', res.status, body);
      }
    } catch (err) {
      console.warn('[geocode] LocationIQ error', err && err.message);
    }
  }

  // Optional: Google Geocoding fallback (if you set GOOGLE_GEOCODING_KEY)
  const googleKey = process.env.GOOGLE_GEOCODING_KEY;
  if (googleKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${encodeURIComponent(googleKey)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json && json.status === 'OK' && json.results && json.results.length > 0) {
        const loc = json.results[0].geometry.location;
        const value = { latitude: String(loc.lat), longitude: String(loc.lng) };
        cacheSet(normalized, value);
        return value;
      } else {
        console.warn('[geocode] Google geocode status', json && json.status, json && json.error_message);
      }
    } catch (err) {
      console.warn('[geocode] Google geocode error', err && err.message);
    }
  }

  // Fallback: Nominatim with rate-limiting
  const now = Date.now();
  const since = now - lastOsmRequestTimestamp;
  if (since < MIN_OSM_INTERVAL_MS) await sleep(MIN_OSM_INTERVAL_MS - since);

  const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1&addressdetails=0`;
  const nomRes = await fetch(nomUrl, { headers: { 'User-Agent': userAgent, Referer: referer } });
  lastOsmRequestTimestamp = Date.now();
  if (!nomRes.ok) {
    const body = await nomRes.text();
    throw new Error(`Geocoding (Nominatim) failed: ${nomRes.status} ${nomRes.statusText} — ${body}`);
  }
  const nomJson = await nomRes.json();
  if (!Array.isArray(nomJson) || nomJson.length === 0) {
    // return null so caller can handle fallback instead of throwing here if you prefer
    throw new Error('Could not geocode the provided address (no results).');
  }
  const { lat, lon } = nomJson[0];
  const result = { latitude: String(lat), longitude: String(lon) };
  cacheSet(normalized, result);
  return result;
}

/**
 * setUserAddress: robust neighborhood assignment & graceful fallback
 */
export const setUserAddress = async (userId, addressData) => {
  if (!userId) throw new Error('userId is required');
  if (!addressData || !addressData.address_line_1 || !addressData.city) {
    throw new Error('addressData with address_line_1 and city is required');
  }

  const fullAddress = `${addressData.address_line_1}, ${addressData.city}${addressData.postal_code ? ', ' + addressData.postal_code : ''}`;
  console.debug('[setUserAddress] address=', fullAddress);

  // 1) geocode
  let geo;
  try {
    geo = await geocodeAddress(fullAddress);
  } catch (err) {
    console.warn('[setUserAddress] geocode failed', err && err.message);
    // *Important:* do NOT block user for geocode failure — store address and return assigned=false
    const saved = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO addresses (user_id, address_line_1, city, postal_code)
        VALUES (CAST(${userId} AS uuid), ${addressData.address_line_1}, ${addressData.city}, ${addressData.postal_code})
        ON CONFLICT (user_id) DO UPDATE SET
          address_line_1 = EXCLUDED.address_line_1,
          city = EXCLUDED.city,
          postal_code = EXCLUDED.postal_code;
      `;
      return { neighborhoodId: null, latitude: null, longitude: null, assigned: false, geocodeError: String(err && err.message) };
    });
    return saved;
  }

  const latitude = String(geo.latitude);
  const longitude = String(geo.longitude);
  console.debug('[setUserAddress] geocoded to', latitude, longitude);

  // Helper: point SQL expression using parameterized numbers
  // ST_SetSRID(ST_MakePoint(lon, lat), 4326)
  // We'll use interpolation which Prisma will parameterize for numbers.
  const lonNum = Number(longitude);
  const latNum = Number(latitude);

  // 2) try strict contains
  let neighborhoods = [];
  try {
    neighborhoods = await prisma.$queryRaw`
      SELECT id
      FROM neighborhoods
      WHERE ST_Contains(boundaries::geometry, ST_SetSRID(ST_MakePoint(${lonNum}, ${latNum})::geometry, 4326))
      LIMIT 1;
    `;
  } catch (err) {
    console.warn('[setUserAddress] ST_Contains error', err && err.message);
    neighborhoods = [];
  }

  // 3) fallback to ST_Within
  if (!neighborhoods || neighborhoods.length === 0) {
    try {
      neighborhoods = await prisma.$queryRaw`
        SELECT id
        FROM neighborhoods
        WHERE ST_Within(ST_SetSRID(ST_MakePoint(${lonNum}, ${latNum})::geometry, 4326), boundaries::geometry)
        LIMIT 1;
      `;
    } catch (err) {
      console.warn('[setUserAddress] ST_Within error', err && err.message);
      neighborhoods = [];
    }
  }

  // 4) fallback to nearest within radius (meters) using geography operations
  if (!neighborhoods || neighborhoods.length === 0) {
    const bufferMeters = Number(process.env.NEIGHBORHOOD_FALLBACK_METERS || '200'); // default 200m
    try {
      // Use boundaries::geography and point::geography for meter-based distance
      neighborhoods = await prisma.$queryRaw`
        SELECT id, ST_Distance(boundaries::geography, ST_SetSRID(ST_MakePoint(${lonNum}, ${latNum}), 4326)::geography) as dist
        FROM neighborhoods
        WHERE ST_DWithin(boundaries::geography, ST_SetSRID(ST_MakePoint(${lonNum}, ${latNum})::geometry, 4326)::geography, ${bufferMeters})
        ORDER BY dist ASC
        LIMIT 1;
      `;
    } catch (err) {
      console.warn('[setUserAddress] ST_DWithin error', err && err.message);
      neighborhoods = [];
    }
  }

  // If still none, do not block user — save address and return assigned=false
  if (!neighborhoods || neighborhoods.length === 0) {
    console.warn('[setUserAddress] no neighborhood match for', { fullAddress, latitude, longitude });
    const res = await prisma.$transaction(async (tx) => {
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
      // do NOT insert membership if neighborhood unknown
      return { neighborhoodId: null, latitude, longitude, assigned: false };
    });
    return res;
  }

  // neighborhood found: upsert and create membership
  const neighborhoodId = neighborhoods[0].id;
  const result = await prisma.$transaction(async (tx) => {
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

    await tx.$executeRaw`
      INSERT INTO neighborhood_memberships (user_id, neighborhood_id)
      VALUES (CAST(${userId} AS uuid), ${neighborhoodId})
      ON CONFLICT (user_id, neighborhood_id) DO NOTHING;
    `;
    return { neighborhoodId, latitude, longitude, assigned: true };
  });

  return result;
};

export async function disconnect() { await prisma.$disconnect(); }
