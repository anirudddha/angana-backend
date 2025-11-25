import { PrismaClient } from '@prisma/client';
import { sendNotification } from './notification.service.js';
const prisma = new PrismaClient();

export const getUserConversations = async (userId) => {
  return prisma.conversation.findMany({
    where: { participants: { some: { user_id: userId } } },
    include: {
      participants: {
        include: { user: { select: { id: true, full_name: true, avatar_url: true } } }
      },
      messages: { // Get the latest message for preview
        orderBy: { sent_at: 'desc' },
        take: 1
      }
    }
  });
};

export const getConversationMessages = async (conversationId, userId, page = 1, limit = 20) => {
  // Security check
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversation_id_user_id: { conversation_id: conversationId, user_id: userId } }
  });

  if (!participant) {
    throw new Error('User is not a participant in this conversation');
  }

  return prisma.message.findMany({
    where: { conversation_id: conversationId },
    include: {
      sender: { select: { id: true, full_name: true, avatar_url: true } }
    },
    orderBy: { sent_at: 'desc' },
    skip: (page - 1) * limit,
    take: limit
  });
};

export const startConversation = async (initiatorId, recipientId) => {
  // Check if a 1-on-1 conversation already exists
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { user_id: initiatorId } } },
        { participants: { some: { user_id: recipientId } } },
      ],
      // This ensures it's only a 2-person conversation
      participants: { every: { user_id: { in: [initiatorId, recipientId] } } }
    }
  });

  if (existingConversation) {
    return existingConversation;
  }

  // Create a new one
  const newConversation = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { user_id: initiatorId },
          { user_id: recipientId },
        ]
      }
    }
  });

  // 🔔 Send notification to recipient about new conversation
  try {
    const initiator = await prisma.profile.findUnique({
      where: { id: initiatorId },
      select: { full_name: true }
    });

    const initiatorName = initiator?.full_name || 'Someone';

    await sendNotification(
      recipientId,
      'New message request',
      `${initiatorName} wants to chat with you`,
      {
        type: 'new_conversation',
        conversationId: newConversation.id.toString(),
      }
    );
  } catch (err) {
    console.error('Failed to send new conversation notification:', err);
  }

  return newConversation;
}