import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const voteOnPoll = async (userId, pollOptionId) => {
  // Ensure the user hasn't already voted in this poll
  const pollOption = await prisma.pollOption.findUnique({
    where: { id: pollOptionId },
    include: {
      poll: {
        include: {
          options: {
            include: {
              votes: {
                where: { user_id: userId }
              }
            }
          }
        }
      }
    }
  });

  if (!pollOption) {
    throw new Error('Poll option not found.');
  }

  const hasVotedInThisPoll = pollOption.poll.options.some(option =>
    option.votes.some(vote => vote.user_id === userId)
  );

  if (hasVotedInThisPoll) {
    throw new Error('User has already voted in this poll.');
  }

  return prisma.pollVote.create({
    data: {
      user_id: userId,
      poll_option_id: pollOptionId,
    },
  });
};

export const getPollResults = async (pollId) => {
  return prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: {
        include: {
          _count: { select: { votes: true } }
        }
      }
    }
  });
};