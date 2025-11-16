import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const getNotificationTypes = async () => {
  return prisma.notificationType.findMany({
    orderBy: {
      name: 'asc',
    },
  });
};

export const createNotificationType = async ({ name, description }) => {
  return prisma.notificationType.create({
    data: {
      name,
      description,
    },
  });
};

export const getUserNotificationSettings = async (userId) => {
  return prisma.userNotificationSetting.findMany({
    where: { user_id: userId },
    include: { notification_type: true },
  });
};

export const updateUserNotificationSetting = async (userId, notificationTypeId, { enablePush, enableEmail, enableDigest }) => {
  return prisma.userNotificationSetting.upsert({
    where: {
      user_id_notification_type_id: {
        user_id: userId,
        notification_type_id: notificationTypeId,
      },
    },
    update: {
      enable_push: enablePush,
      enable_email: enableEmail,
      enable_digest: enableDigest,
    },
    create: {
      user_id: userId,
      notification_type_id: notificationTypeId,
      enable_push: enablePush,
      enable_email: enableEmail,
      enable_digest: enableDigest,
    },
  });
};

export const initializeDefaultNotificationSettings = async (userId) => {
  const notificationTypes = await prisma.notificationType.findMany();
  const defaultSettings = notificationTypes.map(type => ({
    user_id: userId,
    notification_type_id: type.id,
    enable_push: true, // Default to true for push
    enable_email: false, // Default to false for email
    enable_digest: false, // Default to false for digest
  }));

  return prisma.userNotificationSetting.createMany({
    data: defaultSettings,
    skipDuplicates: true, // Avoids errors if settings already exist
  });
};