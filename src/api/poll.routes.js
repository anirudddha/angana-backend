import express from 'express';
import {
  voteOnPollController,
  getPollResultsController,
} from '../controllers/poll.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

router.post('/vote', authenticate, voteOnPollController);
router.get('/:id/results', getPollResultsController);

export default router;