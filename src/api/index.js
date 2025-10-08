import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './users.routes.js';
import feedRoutes from './feed.routes.js'; // Import new routes
import postRoutes from './posts.routes.js'; // Import new routes
import mediaRoutes from './media.routes.js'; // Import
import addressRoutes from './address.routes.js'; // Import
import marketplaceRoutes from './marketplace.routes.js'; // Import
import conversationRoutes from './conversations.routes.js'; // <-- IMPORT a new routes

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/feed', feedRoutes); // Add new routes
router.use('/posts', postRoutes); // Add new routes
router.use('/media', mediaRoutes); // Add
router.use('/addresses', addressRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/conversations', conversationRoutes); // <-- USE the new routes

export default router;