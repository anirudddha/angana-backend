import asyncHandler from 'express-async-handler';
import * as conversationService from '../services/conversation.service.js';

const stringifyBigInt = (data) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );

export const getUserConversationsController = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const conversations = await conversationService.getUserConversations(userId);
  res.status(200).json(stringifyBigInt(conversations));
});

export const getConversationMessagesController = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const conversationId = BigInt(req.params.id);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const messages = await conversationService.getConversationMessages(conversationId, userId, page, limit);
  res.status(200).json(stringifyBigInt(messages));
});

export const startConversationController = asyncHandler(async (req, res) => {
  const { recipientId } = req.body;
  if (!recipientId) {
    res.status(400);
    throw new Error('Recipient ID is required.');
  }

  const initiatorId = req.user.id;
  if (initiatorId === recipientId) {
    res.status(400);
    throw new Error('You cannot start a conversation with yourself.');
  }

  const conversation = await conversationService.startConversation(initiatorId, recipientId);
  res.status(201).json(stringifyBigInt(conversation));
});
