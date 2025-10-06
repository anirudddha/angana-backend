import { Router } from 'express';
import { googleSignInController } from '../controllers/auth.controller.js';

const router = Router();

router.post('/google', googleSignInController);

export default router;