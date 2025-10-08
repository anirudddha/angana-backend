import { PrismaClient } from '@prisma/client';
import { notificationQueue } from '../jobs/queue.js';
const prisma = new PrismaClient();

export const registerDeviceToken = async (userId, token, deviceType) => {
  return prisma.deviceToken.upsert({
    where: { token: token },
    update: { user_id: userId, device_type: deviceType },
    create: { user_id: userId, token, device_type: deviceType },
  });
};

export const sendNotification = async (recipientId, title, body, data) => {
  // Add job to the queue
  await notificationQueue.add('send-notification', {
    recipientId,
    title,
    body,
    data,
  });
};