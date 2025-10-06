import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './users.routes.js';
import feedRoutes from './feed.routes.js'; // Import new routes
import postRoutes from './posts.routes.js'; // Import new routes

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/feed', feedRoutes); // Add new routes
router.use('/posts', postRoutes); // Add new routes

export default router;