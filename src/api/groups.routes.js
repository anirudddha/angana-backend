import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { checkGroupAdmin } from '../middleware/checkGroupPermission.js';
import { checkGroupMembership } from '../middleware/checkGroupPermission.js';

import {
  createGroupController,
  getGroupDetailsController,
  findGroupsInNeighborhoodController,
  joinGroupController,
  leaveGroupController,
  approveRequestController,
  manageMemberController,
} from '../controllers/groups.controller.js';

import {
  createGroupPostController,
  getGroupFeedController
} from '../controllers/groupPosts.controller.js'

const router = Router();
router.use(authenticate);

// General group routes
router.route('/')
  .post(createGroupController);

router.get('/neighborhood/:id', findGroupsInNeighborhoodController);

// Routes for a specific group
router.route('/:id')
  .get(getGroupDetailsController);

// Membership actions
router.post('/:id/join', joinGroupController);
router.post('/:id/leave', leaveGroupController);

// Admin-only actions for member management
router.post('/:id/members/:userId/approve', checkGroupAdmin, approveRequestController);
router.patch('/:id/members/:userId', checkGroupAdmin, manageMemberController); // For role changes
router.delete('/:id/members/:userId', checkGroupAdmin, manageMemberController); // For removal

// These routes are nested under a group context for creation and listing
router.route('/:groupId/posts')
  .post(checkGroupMembership, createGroupPostController) // Use :groupId here
  .get(checkGroupMembership, getGroupFeedController);    // Use :groupId here

export default router;