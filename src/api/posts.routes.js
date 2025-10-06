import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
    createPostController,
    getPostController,
    addCommentController,
    likePostController,
    unlikePostController,
} from '../controllers/posts.controller.js';

const router = Router();
router.use(authenticate); // Protect all post routes

router.route('/')
    .post(createPostController);

router.route('/:id')
    .get(getPostController);

router.route('/:id/comments')
    .post(addCommentController);

router.route('/:id/like')
    .post(likePostController)
    .delete(unlikePostController);

export default router;