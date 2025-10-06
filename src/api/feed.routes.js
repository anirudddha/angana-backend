import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getFeedController } from '../controllers/feed.controller.js';

const router = Router();

// Protected route - requires valid Supabase JWT
router.get('/', authenticate, getFeedController);

export default router;
