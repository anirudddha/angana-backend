import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  getUserConversationsController,
  getConversationMessagesController,
  startConversationController,
} from '../controllers/conversations.controller.js';

const router = Router();

// All routes in this file are protected and require a valid user session
router.use(authenticate);

router.route('/')
  .get(getUserConversationsController)
  .post(startConversationController);

router.route('/:id/messages')
  .get(getConversationMessagesController);

export default router;