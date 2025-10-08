import { PrismaClient } from '@prisma/client';
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

    // ✅ Convert BigInt fields before sending
    io.to(roomName).emit('new_message', safeJson(message));
  };

  socket.on('join_conversation', joinConversation);
  socket.on('send_message', sendMessage);
};
