import { PrismaClient } from '@prisma/client';
import { sendNotification } from '../../services/notification.service.js';
const prisma = new PrismaClient();

function safeJson(obj) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

export const registerChatHandlers = (io, socket) => {
  const { user } = socket;

  const joinConversation = async (conversationId) => {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversation_id_user_id: { conversation_id: conversationId, user_id: user.id }
      }
    });

    if (participant) {
      const roomName = `conversation:${conversationId}`;
      socket.join(roomName);
      console.log(`${user.full_name} joined room: ${roomName}`);
    } else {
      console.warn(`Unauthorized attempt by ${user.full_name} to join conv ${conversationId}`);
    }
  };

  const sendMessage = async ({ conversationId, content }) => {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversation_id_user_id: { conversation_id: conversationId, user_id: user.id }
      }
    });

    if (!participant) return;

    const message = await prisma.message.create({
      data: {
        conversation_id: conversationId,
        sender_id: user.id,
        content,
      },
      include: {
        sender: { select: { id: true, full_name: true, avatar_url: true } }
      }
    });

    const roomName = `conversation:${conversationId}`;

    // ✅ Emit message to all users in the room
    io.to(roomName).emit('new_message', safeJson(message));

    // --- Push notifications to users NOT in the room ---
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversation_id: conversationId, NOT: { user_id: user.id } }
    });

    const socketsInRoom = await io.in(roomName).fetchSockets();
    const connectedUserIds = new Set(socketsInRoom.map(s => s.user.id));

    for (const p of participants) {
      if (!connectedUserIds.has(p.user_id)) {
        sendNotification(
          p.user_id,
          `New message from ${user.full_name}`,
          content.substring(0, 100), // Truncate for notification
          { conversationId: String(conversationId) }
        );
      }
    }
  };

  socket.on('join_conversation', joinConversation);
  socket.on('send_message', sendMessage);
};
