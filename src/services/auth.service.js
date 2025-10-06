// src/services/auth.service.js
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const signInWithGoogle = async (idToken) => {
  // 1. verify token
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.sub) {
    throw new Error('Invalid Google token');
  }

  const email = String(payload.email).trim().toLowerCase();

  // 2. get users page and find by email (listUsers returns { data: { users } })
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    // increase page size if you expect many users; keep it reasonable
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const users = listData?.users ?? [];
  let user = users.find(u => String(u.email ?? '').trim().toLowerCase() === email);

  // 3. if not found, try createUser; handle duplicate email race (422)
  if (!user) {
    const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: payload.name,
        avatar_url: payload.picture,
      },
    }).catch(async (err) => {
      // If createUser errored, re-check listUsers in case of race (email was just created)
      if (err?.status === 422) {
        const { data: latestListData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const latestUsers = latestListData?.users ?? [];
        const existing = latestUsers.find(u => String(u.email ?? '').trim().toLowerCase() === email);
        if (existing) return { data: existing, error: null }; // treat as success
      }
      throw err; // rethrow if not handled
    });

    // normalize returned shape: some endpoints return { user } or { users } — handle both
    user = (newUserData?.user) ?? (newUserData) ?? null;
  }

  if (!user?.id) throw new Error('Supabase user ID not found');

  // 4. upsert Prisma profile using user_id (not profile.id)
  const profile = await prisma.profile.upsert({
    where: { user_id: user.id }, // ensure `user_id` is unique in your Prisma schema
    update: {
      full_name: payload.name,
      avatar_url: payload.picture,
    },
    create: {
      user_id: user.id,
      full_name: payload.name,
      avatar_url: payload.picture,
    },
  });

  // 5. generate JWT using Supabase user id
  const apiToken = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return { profile, token: apiToken };
};
