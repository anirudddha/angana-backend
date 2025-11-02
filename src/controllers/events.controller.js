import asyncHandler from 'express-async-handler';
import * as eventService from '../services/event.service.js';

// Converts all BigInt values in an object to strings
const serializeBigInt = (obj) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
  );

export const createEventController = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent(req.user.user_id, req.body);
  res.status(201).json(serializeBigInt(event));
});

export const getEventsForNeighborhoodController = asyncHandler(async (req, res) => {
  const neighborhoodId = BigInt(req.params.id);
  const events = await eventService.getEventsForNeighborhood(neighborhoodId);
  res.status(200).json(serializeBigInt(events));
});

export const getEventDetailsController = asyncHandler(async (req, res) => {
  const eventId = BigInt(req.params.id);
  const event = await eventService.getEventDetails(eventId, req.user.user_id);

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  res.status(200).json(serializeBigInt(event));
});

export const rsvpController = asyncHandler(async (req, res) => {
  const eventId = BigInt(req.params.id);
  await eventService.rsvpToEvent(req.user.user_id, eventId);
  res.status(204).send();
});

export const cancelRsvpController = asyncHandler(async (req, res) => {
  const eventId = BigInt(req.params.id);
  await eventService.cancelRsvp(req.user.user_id, eventId);
  res.status(204).send();
});

export const getMyEventsController = asyncHandler(async (req, res) => {
  const events = await eventService.getEventsByCreator(req.user.user_id);
  res.status(200).json(serializeBigInt(events));
});

/**
 * PUT /api/v1/events/:id
 * Update an event
 */
export const updateEventController = asyncHandler(async (req, res) => {
  const eventId = BigInt(req.params.id);

  try {
    const updatedEvent = await eventService.updateEvent(eventId, req.user.user_id, req.body);
    res.status(200).json(serializeBigInt(updatedEvent));
  } catch (error) {
    // Handle specific errors from the service layer
    if (error.message.includes('not authorized')) {
      return res.status(403).json({ message: 'Forbidden: You are not the creator of this event.' });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: 'Event not found.' });
    }
    // For other errors, let the default error handler take over
    throw error;
  }
});

/**
 * DELETE /api/v1/events/:id
 * Delete an event
 */
export const deleteEventController = asyncHandler(async (req, res) => {
  const eventId = BigInt(req.params.id);

  try {
    await eventService.deleteEvent(eventId, req.user.user_id);
    res.status(204).send(); // Success, no content to return
  } catch (error) {
    if (error.message.includes('not authorized')) {
      return res.status(403).json({ message: 'Forbidden: You are not the creator of this event.' });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: 'Event not found.' });
    }
    throw error;
  }
});