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
