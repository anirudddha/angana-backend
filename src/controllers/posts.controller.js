import asyncHandler from 'express-async-handler';
import * as postService from '../services/post.service.js';

export const createPostController = asyncHandler(async (req, res) => {
    const { content, mediaUrls, categoryIds, pollQuestion, pollOptions, isUrgent } = req.body;

    if (!content && !pollQuestion) { // Content or poll question is required
        res.status(400);
        throw new Error('Content or poll question is required.');
    }

    if (pollQuestion && (!pollOptions || pollOptions.length < 2)) {
      res.status(400);
      throw new Error('Polls must have at least two options.');
    }

    const post = await postService.createPost(req.user.user_id, {
        content,
        mediaUrls, // optional array of image/video URLs
        categoryIds, // optional array of category IDs
        pollQuestion,
        pollOptions,
        isUrgent,
    });

    // Convert BigInt fields to string before sending JSON
    const serializedPost = JSON.parse(
        JSON.stringify(post, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
        )
    );

    res.status(201).json(serializedPost);
});

export const getPostController = asyncHandler(async (req, res) => {
    const postId = BigInt(req.params.id);
    const post = await postService.getPostDetails(postId, req.user.user_id);
    if (!post) {
        res.status(404);
        throw new Error('Post not found');
    }
    res.status(200).json(post);
});

export const addCommentController = asyncHandler(async (req, res) => {
    const postId = BigInt(req.params.id);
    const { content } = req.body;

    console.log('Adding comment to postId:', postId.toString()); // debug

    if (!content) {
        res.status(400);
        throw new Error('Content is required');
    }

    const comment = await postService.addComment(req.user.user_id, postId, content);

    res.status(201).json(comment);
});

export const likePostController = asyncHandler(async (req, res) => {
    const postId = BigInt(req.params.id);
    await postService.likePost(req.user.user_id, postId);
    res.status(204).send(); // No content
});

export const unlikePostController = asyncHandler(async (req, res) => {
    const postId = BigInt(req.params.id);
    await postService.unlikePost(req.user.user_id, postId);
    res.status(204).send();
});