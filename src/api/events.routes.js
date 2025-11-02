import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  createEventController,
  getEventsForNeighborhoodController,
  getEventDetailsController,
  rsvpController,
  cancelRsvpController,
  getMyEventsController,
  updateEventController,
  deleteEventController,
  getMyRsvpsController,
} from '../controllers/events.controller.js';

const router = Router();
router.use(authenticate); // Protect all event routes

// Main routes for creating and listing events
router.route('/')
  .post(createEventController);

// Get events the current user has registered for
router.route('/my-rsvps')
  .get(getMyRsvpsController);

router.route('/my-events')
  .get(getMyEventsController);

router.route('/neighborhood/:id')
  .get(getEventsForNeighborhoodController);

// Routes for a specific event
router.route('/:id')
  .get(getEventDetailsController)
  .put(updateEventController)    // Or .patch() if you prefer
  .delete(deleteEventController);

// Routes for RSVPing to a specific event
router.route('/:id/rsvp')
  .post(rsvpController)
  .delete(cancelRsvpController);

export default router;