import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { checkGroupMembership } from '../middleware/checkGroupPermission.js';
import {
  createGroupPostController,
  getGroupFeedController,
  likeGroupPostController,
  unlikeGroupPostController,
  commentOnGroupPostController,
  getGroupPostCommentsController,
} from '../controllers/groupPosts.controller.js';

const router = Router();
router.use(authenticate);

// These routes act on a specific group post directly by its ID
router.route('/:id/like')
  .post(likeGroupPostController) // Note: Membership check should happen inside service for these
  .delete(unlikeGroupPostController);

router.route('/:id/comments')
  .post(commentOnGroupPostController)
  .get(getGroupPostCommentsController);

export default router;