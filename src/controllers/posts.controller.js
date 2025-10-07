import asyncHandler from 'express-async-handler';
import * as postService from '../services/post.service.js';

export const createPostController = asyncHandler(async (req, res) => {
    const { content, neighborhoodId, mediaUrls } = req.body;

    if (!content || !neighborhoodId) {
        res.status(400);
        throw new Error('Content and neighborhoodId are required.');
    }

    const post = await postService.createPost(req.user.user_id, {
        content,
        neighborhoodId: Number(neighborhoodId),
        mediaUrls, // optional array of image/video URLs
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