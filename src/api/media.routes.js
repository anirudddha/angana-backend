import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getUploadUrlController } from '../controllers/media.controller.js';

const router = Router();
router.use(authenticate);

router.get('/upload-url', getUploadUrlController);

export default router;