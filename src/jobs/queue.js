// src/jobs/queue.js
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import admin from '../config/firebase.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

// --- Queue export so other code can add jobs ---
export const notificationQueue = new Queue('notifications', { connection });

// Helper: determine if an error from FCM means the token is invalid/unregistered
function isInvalidTokenErrorObj(err) {
  if (!err) return false;
  const code = (err.code || err.errorInfo?.code || String(err)).toString().toLowerCase();
  const message = (err.message || '').toLowerCase();
  return (
    code.includes('invalid-registration-token') ||
    code.includes('registration-token-not-registered') ||
    code.includes('messaging/invalid-registration-token') ||
    code.includes('messaging/registration-token-not-registered') ||
    // Fallback: server sometimes returns invalid-argument with text "not a valid FCM registration token"
    (code.includes('invalid-argument') && message.includes('not a valid fcm registration token')) ||
    message.includes('not a valid fcm registration token') ||
    message.includes('not-registered')
  );
}

async function removeInvalidTokens(invalidTokens = []) {
  if (!invalidTokens || invalidTokens.length === 0) return;
  try {
    await prisma.deviceToken.deleteMany({
      where: { token: { in: invalidTokens } },
    });
    console.log(`Removed ${invalidTokens.length} invalid tokens from DB (sample: ${invalidTokens.slice(0,3).map(t => maskToken(t)).join(', ')})`);
  } catch (err) {
    console.error('Error removing invalid tokens:', err);
  }
}

function maskToken(token) {
  if (!token || typeof token !== 'string') return '<invalid>';
  const start = token.slice(0, 6);
  const end = token.slice(-6);
  return `${start}...${end}`;
}

// Defensive: ensure firebase admin is initialized and messaging is available
if (!admin || typeof admin.messaging !== 'function') {
  console.error('Firebase admin is not initialized correctly. admin.messaging() is missing.');
  // you may choose to throw here to avoid running worker without FCM
}

// --- The Worker ---
const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    const { recipientId, title, body, data } = job.data ?? {};
    console.log(`Processing notification for user: ${recipientId}, jobId: ${job.id}`);

    if (!recipientId) {
      console.warn('Job missing recipientId — skipping.');
      return;
    }

    // Fetch device tokens
    const deviceRows = await prisma.deviceToken.findMany({
      where: { user_id: recipientId },
      select: { token: true },
    });

    const rawTokens = (deviceRows || []).map(r => r.token).filter(Boolean);

    // Basic heuristic filter: tokens should be strings with some minimal length; adjust threshold if needed.
    const tokens = Array.from(new Set(rawTokens.filter(t => typeof t === 'string' && t.length > 20)));

    if (!tokens || tokens.length === 0) {
      console.log(`No valid device tokens for user ${recipientId}. Skipping.`);
      return;
    }

    // Prepare data payload: FCM expects string values
    const dataPayload = {};
    if (data && typeof data === 'object') {
      for (const [k, v] of Object.entries(data)) {
        dataPayload[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
    }

    const notification = {};
    if (title) notification.title = String(title);
    if (body) notification.body = String(body);

    // If single token, use admin.messaging().send(); handle invalid-token errors gracefully.
    if (tokens.length === 1) {
      const token = tokens[0];
      console.log(`Sending single FCM message to ${recipientId}, token=${maskToken(token)}`);
      try {
        const sendResp = await admin.messaging().send({
          token,
          notification,
          data: dataPayload,
        });
        console.log(`Sent single FCM message: messageId=${sendResp} for user ${recipientId}`);
      } catch (err) {
        console.error('Error sending single FCM message:', err?.message ?? err);

        if (isInvalidTokenErrorObj(err)) {
          console.warn(`Token appears invalid. Removing token: ${maskToken(token)}`);
          await removeInvalidTokens([token]);
          // DO NOT rethrow — we handled the invalid token case
          return;
        }

        // For other errors, rethrow so BullMQ can handle retries according to config
        throw err;
      }
      return;
    }

    // Multiple tokens -> sendMulticast if available
    console.log(`Sending multicast to ${tokens.length} tokens for user ${recipientId} (sample: ${maskToken(tokens[0])}, ${maskToken(tokens[1] || tokens[0])})`);
    // Defensive fallback if sendMulticast not available
    if (!admin || typeof admin.messaging().sendMulticast !== 'function') {
      console.warn('admin.messaging().sendMulticast not available — falling back to send() per token.');
      const invalidTokens = [];
      for (const token of tokens) {
        try {
          await admin.messaging().send({ token, notification, data: dataPayload });
        } catch (err) {
          console.error('Fallback send() error for token', maskToken(token), err?.message ?? err);
          if (isInvalidTokenErrorObj(err)) invalidTokens.push(token);
          else {
            // Other errors: we continue but log them. Do not fail the whole job for one transient error.
            console.warn('Non-token error occurred while sending to', maskToken(token), '- continuing.');
          }
        }
      }
      if (invalidTokens.length > 0) await removeInvalidTokens(invalidTokens);
      return;
    }

    try {
      const multicastResp = await admin.messaging().sendMulticast({
        tokens,
        notification,
        data: dataPayload,
      });

      console.log(`sendMulticast result: success=${multicastResp.successCount}, failure=${multicastResp.failureCount}`);

      const invalidTokens = [];
      multicastResp.responses.forEach((r, idx) => {
        if (!r.success) {
          const token = tokens[idx];
          if (isInvalidTokenErrorObj(r.error)) {
            invalidTokens.push(token);
          } else {
            console.warn(`FCM error for token ${maskToken(token)}:`, r.error?.message ?? r.error);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await removeInvalidTokens(invalidTokens);
      }
    } catch (err) {
      console.error('Error in sendMulticast:', err?.message ?? err);
      // If the top-level sendMulticast call fails with an invalid-token style error (rare),
      // try to attempt per-token sends and cleanup invalid ones instead of failing the job.
      if (isInvalidTokenErrorObj(err)) {
        console.warn('Top-level sendMulticast reported invalid-token error. Falling back to per-token send to detect and remove invalid tokens.');
        const invalidTokens = [];
        for (const token of tokens) {
          try {
            await admin.messaging().send({ token, notification, data: dataPayload });
          } catch (e2) {
            if (isInvalidTokenErrorObj(e2)) invalidTokens.push(token);
            else console.warn('Non-token error on fallback send for', maskToken(token), e2?.message ?? e2);
          }
        }
        if (invalidTokens.length > 0) await removeInvalidTokens(invalidTokens);
        // don't rethrow: we handled invalid tokens
        return;
      }
      // For other errors, rethrow to let BullMQ retry
      throw err;
    }
  },
  { connection }
);

// Worker event listeners
notificationWorker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed!`);
});
notificationWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} has failed with ${err?.message ?? err}`);
});

console.log('Notification worker started.');

export default notificationWorker;
