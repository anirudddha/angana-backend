import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './users.routes.js';
import feedRoutes from './feed.routes.js'; // Import new routes
import postRoutes from './posts.routes.js'; // Import new routes
import mediaRoutes from './media.routes.js'; // Import
import addressRoutes from './address.routes.js'; // Import
import marketplaceRoutes from './marketplace.routes.js'; // Import
import conversationRoutes from './conversations.routes.js'; // <-- IMPORT a new routes
import notificationRoutes from './notifications.routes.js';
import searchRoutes from './search.routes.js';
import businessRoutes from './business.routes.js'; // <-- ADD THIS
import dealRoutes from './deals.routes.js';       // <-- ADD THIS
import eventRoutes from './events.routes.js'; // <-- ADD THIS
import serviceRoutes from './services.routes.js';
import petRoutes from './pets.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/feed', feedRoutes); // Add new routes
router.use('/posts', postRoutes); // Add new routes
router.use('/media', mediaRoutes); // Add
router.use('/addresses', addressRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/conversations', conversationRoutes); // <-- USE the new routes

router.use('/notifications', notificationRoutes);
router.use('/search', searchRoutes);

router.use('/business', businessRoutes); // <-- ADD THIS
router.use('/deals', dealRoutes);         // <-- ADD THIS

router.use('/events', eventRoutes);
router.use('/services', serviceRoutes);

router.use('/pets', petRoutes);

export default router;