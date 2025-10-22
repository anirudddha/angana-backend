import asyncHandler from 'express-async-handler';
import * as groupPostService from '../services/groupPost.service.js';

// Helper to convert BigInt -> string for JSON serialization
const serializeBigInt = (obj) =>
  JSON.parse(JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));

export const createGroupPostController = asyncHandler(async (req, res) => {
  const groupId = BigInt(req.params.groupId);
  const post = await groupPostService.createGroupPost(req.user.id, req.user.user_id, groupId, req.body);
  // Apply the helper here
  res.status(201).json(serializeBigInt(post));
});

export const getGroupFeedController = asyncHandler(async (req, res) => {
  const groupId = BigInt(req.params.groupId);
  const feed = await groupPostService.getGroupFeed(groupId, req.user.id);
  // Apply the helper here (works on arrays of objects too)
  res.status(200).json(serializeBigInt(feed));
});

export const likeGroupPostController = asyncHandler(async (req, res) => {
  const groupPostId = BigInt(req.params.id);
  await groupPostService.likeGroupPost(req.user.id, groupPostId);
  // No JSON body is sent, so no change is needed
  res.status(204).send();
});

export const unlikeGroupPostController = asyncHandler(async (req, res) => {
  const groupPostId = BigInt(req.params.id);
  await groupPostService.unlikeGroupPost(req.user.id, groupPostId);
  // No JSON body is sent, so no change is needed
  res.status(204).send();
});

export const commentOnGroupPostController = asyncHandler(async (req, res) => {
  const groupPostId = BigInt(req.params.id);
  const { content } = req.body;
  const comment = await groupPostService.commentOnGroupPost(req.user.id, groupPostId, content);
  // Apply the helper here
  res.status(201).json(serializeBigInt(comment));
});

export const getGroupPostCommentsController = asyncHandler(async (req, res) => {
  const groupPostId = BigInt(req.params.id);
  const comments = await groupPostService.getGroupPostComments(groupPostId);
  // Apply the helper here
  res.status(200).json(serializeBigInt(comments));
});