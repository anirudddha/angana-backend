import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getFeedController } from '../controllers/feed.controller.js';

const router = Router();

// Protected route - requires valid JWT
router.get('/', authenticate, getFeedController);

export default router;
