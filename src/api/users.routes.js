import { Router } from 'express';
import { getCurrentUserController, updateCurrentUserController } from '../controllers/users.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// All routes in this file are protected
router.use(authenticate);

router.get('/me', getCurrentUserController);
router.patch('/me', updateCurrentUserController);

export default router;