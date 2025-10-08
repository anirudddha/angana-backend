// src/real-time/connection.js
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { registerChatHandlers } from './handlers/chatHandler.js';
import { instrument } from '@socket.io/admin-ui';

const prisma = new PrismaClient();

/**
 * Initialize and return a Socket.IO server attached to the provided httpServer.
 * - Supports optional Redis adapter if REDIS_URL is provided.
 * - Adds admin UI instrumentation (dev only).
 * - Adds JWT auth middleware and registers chat handlers.
 */
export const initializeSocketIO = (httpServer) => {
  // Build allowed origins list. Accept comma-separated env var or default localhost.
  const defaultOrigins = [
    'http://localhost:3000',       // React local dev
    'http://127.0.0.1:5501',       // Your client.html served via Live Server or local host
    'https://admin.socket.io',     // Admin UI for debugging
  ];

  // Add any extra origins from .env (comma-separated)
  const envOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Merge and remove duplicates
  const origins = [...new Set([...defaultOrigins, ...envOrigins])];

  // --- Initialize Socket.IO ---
  const io = new Server(httpServer, {
    cors: {
      origin: origins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  console.log('✅ Allowed CORS origins:', origins);

  // Instrument Admin UI (development only)
  try {
    instrument(io, {
      auth: false, // Only for development. Secure this in production!
      mode: 'development',
    });
    console.log('🧠 Socket.IO Admin UI instrumented (dev mode). Visit /admin on your server.');
  } catch (err) {
    console.warn('⚠️ Failed to instrument Admin UI:', err.message);
  }

  // --- Redis Adapter (optional, only if REDIS_URL present) ---
  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log('🔗 Socket.IO Redis adapter connected.');
      })
      .catch((err) => {
        console.error('⚠️ Redis adapter failed to connect — continuing without adapter:', err.message);
      });
  } else {
    console.log('⚠️ No REDIS_URL provided — running Socket.IO without Redis adapter (ok for local dev).');
  }

  // --- Authentication middleware ---
  io.use(async (socket, next) => {
    // Support token via handshake.auth.token OR Authorization header "Bearer <token>"
    const tokenFromAuth = socket.handshake?.auth?.token;
    const authHeader = socket.handshake?.headers?.authorization;
    const token = tokenFromAuth || (authHeader && authHeader.split(' ')[1]);

    if (!token) {
      return next(new Error('Authentication error: Token not provided.'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // NOTE: adjust this if your JWT payload uses a different key (e.g., user_id)
      // Here we expect `decoded.id` to be the Profile.id
      const user = await prisma.profile.findUnique({ where: { id: decoded.id } });

      if (!user) {
        return next(new Error('Authentication error: User not found.'));
      }

      socket.user = user; // attach user object to socket
      return next();
    } catch (err) {
      console.error('Authentication middleware error:', err.message);
      return next(new Error('Authentication error: Invalid token.'));
    }
  });

  // --- Connection handler ---
  io.on('connection', (socket) => {
    try {
      const displayName = socket.user?.full_name ?? socket.user?.id ?? 'Unknown';
      console.log(`🟢 User connected: ${displayName} (socket id: ${socket.id})`);

      // Register domain-specific handlers (chat, notifications, etc.)
      registerChatHandlers(io, socket);

      socket.on('disconnect', (reason) => {
        console.log(`🔴 User disconnected: ${displayName} (socket id: ${socket.id}) reason: ${reason}`);
      });
    } catch (err) {
      console.error('Error in connection handler:', err);
    }
  });

  return io;
};
