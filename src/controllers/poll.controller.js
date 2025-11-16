import asyncHandler from 'express-async-handler';
import * as pollService from '../services/poll.service.js';

const serializeBigInts = (data) => {
  return JSON.parse(JSON.stringify(data, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
};

export const voteOnPollController = asyncHandler(async (req, res) => {
  const { pollOptionId } = req.body;
  const userId = req.user.user_id;

  if (!pollOptionId) {
    res.status(400);
    throw new Error('Poll option ID is required.');
  }

  await pollService.voteOnPoll(userId, pollOptionId);
  res.status(204).send(); // No content
});

export const getPollResultsController = asyncHandler(async (req, res) => {
  const pollId = BigInt(req.params.id);
  const pollResults = await pollService.getPollResults(pollId);

  if (!pollResults) {
    res.status(404);
    throw new Error('Poll not found.');
  }

  res.status(200).json(serializeBigInts(pollResults));
});