// test-notification.js
import { PrismaClient } from '@prisma/client';
import { sendNotification, registerDeviceToken } from './src/services/notification.service.js';

const prisma = new PrismaClient();

async function run() {
  const args = process.argv.slice(2);
  const userId = args[0];
  const deviceToken = args[1];

  if (!userId || !deviceToken) {
    console.error('Usage: node test-notification.js <USER_ID> <DEVICE_TOKEN>');
    console.error('Example: node test-notification.js "your-user-id-uuid" "your-device-fcm-token"');
    process.exit(1);
  }

  console.log(`Preparing to send notification to user: ${userId}`);
  console.log(`Using device token: ${deviceToken.substring(0, 15)}...`);

  try {
    // 1. Ensure the user exists
    const user = await prisma.profile.findUnique({ where: { id: userId } });
    if (!user) {
      console.error(`Error: User with ID '${userId}' not found in the profiles table.`);
      return;
    }
    console.log(`Found user: ${user.full_name}`);

    // 2. Register the device token to this user to ensure it's in the DB
    await registerDeviceToken(userId, deviceToken, 'test');
    console.log('Device token registered for testing.');

    // 3. Trigger the notification
    console.log('Sending notification...');
    await sendNotification(
      userId,
      'Backend Test Notification',
      'This is a test message sent manually from the backend!',
      {
        // Optional data payload for navigation
        screen: 'Home',
        timestamp: Date.now().toString(),
      }
    );

    console.log('✅ Notification has been successfully queued!');
    console.log('Check the worker console and the device for the notification.');

  } catch (error) {
    console.error('❌ An error occurred:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
