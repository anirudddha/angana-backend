import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { registerDeviceController } from '../controllers/notifications.controller.js';

const router = Router();

// All routes in this file require authentication
router.use(authenticate);

router.post('/register', registerDeviceController);

export default router;