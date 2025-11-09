// src/services/event.service.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Creates a new event.
 * @param {string} creatorId - The authenticated user's ID (mapped to Profile.user_id in your schema).
 * @param {object} eventData - The details of the event.
 */
export const createEvent = async (creatorId, eventData) => {
  const { title, description, location_name, startTime, endTime, mediaUrls = [] } = eventData;

  if (!title || !startTime) {
    throw new Error('title and startTime are required to create an event');
  }

  const profile = await prisma.profile.findUnique({
    where: { user_id: creatorId },
  });

  if (!profile) {
    throw new Error('Creator profile does not exist');
  }

  const membership = await prisma.neighborhoodMembership.findFirst({
    where: { user_id: creatorId },
  });
  if (!membership) {
    throw new Error('User is not a member of any neighborhood');
  }

  const start = new Date(startTime);
  if (isNaN(start.getTime())) throw new Error('Invalid startTime');

  const end = endTime ? new Date(endTime) : null;
  if (endTime && isNaN(end.getTime())) throw new Error('Invalid endTime');

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        creator_id: profile.id,
        neighborhood_id: membership.neighborhood_id,
        title,
        description,
        location_name,
        start_time: start,
        end_time: end,
        organizer_type: profile.role || 'resident',
      },
    });

    if (mediaUrls && Array.isArray(mediaUrls) && mediaUrls.length > 0) {
      const mediaData = mediaUrls.map((url) => ({
        uploader_id: profile.user_id,
        url,
        event_id: event.id,
      }));
      await tx.media.createMany({ data: mediaData });
    }

    return tx.event.findUnique({
      where: { id: event.id },
      include: { media: true },
    });
  });
};

/**
 * Fetches upcoming events for a given neighborhood.
 * @param {BigInt} neighborhoodId
 */
export const getEventsForNeighborhood = async (neighborhoodId) => {
  return prisma.event.findMany({
    where: {
      neighborhood_id: neighborhoodId,
      start_time: { gte: new Date() },
    },
    include: {
      creator: { select: { id: true, full_name: true, avatar_url: true } },
      media: { select: { url: true }, take: 1 },
      _count: { select: { rsvps: true } },
    },
    orderBy: { start_time: 'asc' },
  });
};

/**
 * Gets the full details of a single event, including the user's RSVP status.
 * @param {BigInt} eventId
 * @param {string} currentUserId
 */
export const getEventDetails = async (eventId, currentUserId) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      creator: { select: { id: true, full_name: true, avatar_url: true } },
      media: { select: { id: true, url: true } },
      _count: { select: { rsvps: true } },
    },
  });

  if (!event) return null;

  const profile = await prisma.profile.findUnique({
    where: { user_id: currentUserId },
    select: { id: true },
  });

  if (!profile) {
    return { ...event, has_rsvpd: false };
  }

  const userRsvp = await prisma.eventRsvp.findUnique({
    where: { user_id_event_id: { user_id: profile.id, event_id: eventId } },
  });

  return { ...event, has_rsvpd: !!userRsvp };
};

/**
 * RSVPs a user for an event.
 * @param {string} userId
 * @param {BigInt} eventId
 */
export const rsvpToEvent = async (userId, eventId) => {
  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
  });
  if (!profile) {
    throw new Error('Creator profile does not exist');
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new Error('Event not found');
  }

  return prisma.eventRsvp.upsert({
    where: { user_id_event_id: { user_id: profile.id, event_id: eventId } },
    update: {},
    create: { user_id: profile.id, event_id: eventId },
  });
};

export const cancelRsvp = async (userId, eventId) => {
  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
  });
  if (!profile) {
    throw new Error('Creator profile does not exist');
  }

  try {
    return await prisma.eventRsvp.delete({
      where: { user_id_event_id: { user_id: profile.id, event_id: eventId } },
    });
  } catch (error) {
    if (error.code === 'P2025') return;
    throw error;
  }
};

/**
 * NEW AND IMPROVED: Updates an event's details and/or its associated media.
 */
export const updateEvent = async (eventId, userId, eventData) => {
  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
  });

  if (!profile) {
    throw new Error('User profile not found');
  }

  const existingEvent = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!existingEvent) {
    throw new Error('Event not found');
  }

  if (existingEvent.creator_id !== profile.id) {
    throw new Error('User is not authorized to update this event');
  }

  const { title, description, location_name, startTime, endTime, mediaUrls } = eventData;

  return prisma.$transaction(async (tx) => {
    // Step 1: Update the event's scalar fields (title, description, etc.)
    const dataToUpdate = {};
    if (title) dataToUpdate.title = title;
    if (description) dataToUpdate.description = description;
    if (location_name) dataToUpdate.location_name = location_name;
    if (startTime) dataToUpdate.start_time = new Date(startTime);
    if (endTime) dataToUpdate.end_time = new Date(endTime);

    if (Object.keys(dataToUpdate).length > 0) {
      await tx.event.update({
        where: { id: eventId },
        data: dataToUpdate,
      });
    }

    // Step 2: If mediaUrls is provided, replace the existing media.
    // This allows adding, removing, or changing all images at once.
    if (mediaUrls && Array.isArray(mediaUrls)) {
      // Delete all old media for this event
      await tx.media.deleteMany({
        where: { event_id: eventId },
      });

      // If the new array has URLs, create the new media entries
      if (mediaUrls.length > 0) {
        const mediaData = mediaUrls.map((url) => ({
          uploader_id: profile.user_id,
          url,
          event_id: eventId,
        }));
        await tx.media.createMany({ data: mediaData });
      }
    }
    
    // Step 3: Return the fully updated event with the new media included
    return tx.event.findUnique({
      where: { id: eventId },
      include: { media: true }
    });
  });
};


/**
 * Deletes an event.
 */
export const deleteEvent = async (eventId, userId) => {
  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
  });
  if (!profile) throw new Error('User profile not found');

  const existingEvent = await prisma.event.findUnique({
    where: { id: eventId },
  });
  if (!existingEvent) throw new Error('Event not found');

  if (existingEvent.creator_id !== profile.id) {
    throw new Error('User is not authorized to delete this event');
  }

  return prisma.event.delete({
    where: { id: eventId },
  });
};

/**
 * NEW AND IMPROVED: Fetches all events created by a specific user, including a cover image.
 * @param {string} userId - The creator's user ID (Profile.user_id).
 */
export const getEventsByCreator = async (userId) => {
  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
  });
  if (!profile) throw new Error('User profile not found');

  return prisma.event.findMany({
    where: {
      creator_id: profile.id,
    },
    include: {
      // THIS IS THE NEW PART: Include the first media item as a cover image
      media: { select: { url: true }, take: 1 },
      _count: { select: { rsvps: true } },
    },
    orderBy: { start_time: 'desc' },
  });
};

export const getEventsUserRsvpdTo = async (userId) => {
  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
    select: { id: true },
  });

  if (!profile) {
    // Return the new data structure even if empty
    return { upcoming: [], past: [] };
  }

  // 1. Remove the start_time filter to get ALL events the user RSVP'd to.
  const allRsvpdEvents = await prisma.event.findMany({
    where: {
      rsvps: {
        some: {
          user_id: profile.id,
        },
      },
    },
    include: {
      creator: { select: { id: true, full_name: true, avatar_url: true } },
      media: { select: { url: true }, take: 1 },
      _count: { select: { rsvps: true } },
    },
    // 2. Sort all events by start time, descending (most recent first).
    // This is useful for both upcoming and past lists.
    orderBy: { start_time: 'desc' },
  });

  // 3. Separate the events into 'upcoming' and 'past' arrays.
  const now = new Date();
  const upcoming = [];
  const past = [];

  for (const event of allRsvpdEvents) {
    if (event.start_time >= now) {
      upcoming.push(event);
    } else {
      past.push(event);
    }
  }

  // Upcoming events should be sorted ascending (soonest first)
  upcoming.reverse();

  // 4. Return the structured object.
  return { upcoming, past };
};