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

  // Basic validation
  if (!title || !startTime) {
    throw new Error('title and startTime are required to create an event');
  }

  // Find the profile by user_id (Profile.user_id is unique in your schema)
  const profile = await prisma.profile.findUnique({
    where: { user_id: creatorId }, // creatorId is expected to be Profile.user_id
  });

  if (!profile) {
    throw new Error('Creator profile does not exist');
  }

  // Check neighborhood membership (neighborhoodMembership.user_id references Profile.user_id)
  const membership = await prisma.neighborhoodMembership.findFirst({
    where: { user_id: creatorId },
  });
  if (!membership) {
    throw new Error('User is not a member of any neighborhood');
  }

  // Convert times and prepare event data
  const start = new Date(startTime);
  if (isNaN(start.getTime())) throw new Error('Invalid startTime');

  const end = endTime ? new Date(endTime) : null;
  if (endTime && isNaN(end.getTime())) throw new Error('Invalid endTime');

  // Use transaction to create event and associated media
  return prisma.$transaction(async (tx) => {
    // Create event using profile.id (Event.creator references Profile.id)
    const event = await tx.event.create({
      data: {
        creator_id: profile.id, // Profile.id (NOT profile.user_id)
        neighborhood_id: membership.neighborhood_id,
        title,
        description,
        location_name,
        start_time: start,
        end_time: end,
        organizer_type: profile.role || 'resident',
      },
    });

    // Attach media if provided
    if (mediaUrls && Array.isArray(mediaUrls) && mediaUrls.length > 0) {
      // IMPORTANT: Media.uploader references Profile.user_id in your schema,
      // so we must use profile.user_id here — not profile.id.
      const mediaData = mediaUrls.map((url) => ({
        uploader_id: profile.user_id, // <-- fixed: use Profile.user_id
        url,
        event_id: event.id,
      }));

      // createMany does not return created rows; it is fine for bulk insert
      await tx.media.createMany({ data: mediaData });
    }

    // Return the full event (with media)
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
      start_time: { gte: new Date() }, // Only show future events
    },
    include: {
      creator: { select: { id: true, full_name: true, avatar_url: true } },
      media: { select: { url: true }, take: 1 }, // Just get the cover image
      _count: { select: { rsvps: true } }, // Get the number of people attending
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

  // Check if the current user has RSVP'd
  const userRsvp = await prisma.eventRsvp.findUnique({
    where: { user_id_event_id: { user_id: currentUserId, event_id: eventId } },
  });

  return { ...event, has_rsvpd: !!userRsvp };
};

/**
 * RSVPs a user for an event.
 * @param {string} userId
 * @param {BigInt} eventId
 */
export const rsvpToEvent = async (userId, eventId) => {
  // userId here is the authenticated user's Profile.user_id (string)
  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
  });
  if (!profile) {
    throw new Error('Creator profile does not exist');
  }

  // Optional but recommended: ensure event exists so we can give a friendly error
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new Error('Event not found');
  }

  // Use profile.id for the relation (Profile.id is referenced by EventRsvp.user)
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
    // If no RSVP found, ignore (same final state)
    if (error.code === 'P2025') return;
    throw error;
  }
};

export const updateEvent = async (eventId, userId, eventData) => {
  // Find the profile of the user making the request
  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
  });

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Find the event to ensure it exists and the user is the owner
  const existingEvent = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!existingEvent) {
    throw new Error('Event not found'); // Or handle as 404 in controller
  }

  // Authorization check: only the creator can update the event
  if (existingEvent.creator_id !== profile.id) {
    throw new Error('User is not authorized to update this event'); // Handle as 403 in controller
  }

  const { title, description, location_name, startTime, endTime } = eventData;

  // Prepare data for update (only update fields that are provided)
  const dataToUpdate = {};
  if (title) dataToUpdate.title = title;
  if (description) dataToUpdate.description = description;
  if (location_name) dataToUpdate.location_name = location_name;
  if (startTime) dataToUpdate.start_time = new Date(startTime);
  if (endTime) dataToUpdate.end_time = new Date(endTime);

  return prisma.event.update({
    where: { id: eventId },
    data: dataToUpdate,
  });
};

/**
 * Deletes an event.
 * Ensures the user making the request is the creator of the event.
 * @param {BigInt} eventId - The ID of the event to delete.
 * @param {string} userId - The authenticated user's ID (Profile.user_id).
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

  // Authorization check
  if (existingEvent.creator_id !== profile.id) {
    throw new Error('User is not authorized to delete this event');
  }

  // Prisma will automatically handle cascading deletes for RSVPs and Media if your schema is set up for it.
  return prisma.event.delete({
    where: { id: eventId },
  });
};

/**
 * Fetches all events created by a specific user.
 * @param {string} userId - The creator's user ID (Profile.user_id).
 */
export const getEventsByCreator = async (userId) => {
  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
  });
  if (!profile) throw new Error('User profile not found');

  return prisma.event.findMany({
    where: {
      creator_id: profile.id, // Find events by the Profile.id
    },
    include: {
      _count: { select: { rsvps: true } },
    },
    orderBy: { start_time: 'desc' }, // Show most recent first
  });
};