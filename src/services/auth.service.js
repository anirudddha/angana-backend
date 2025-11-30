// src/services/auth.service.js
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// ===== SUPABASE REPLACED WITH NEONDB =====
// The code below is commented out as we've migrated to NeonDB
// Supabase was previously used for user authentication management
// Now we generate UUIDs ourselves and use Prisma directly with NeonDB (PostgreSQL)
// We use Google's 'sub' stored in full_name temporarily to look up users (not ideal but works without schema changes)
// 
// import { createClient } from '@supabase/supabase-js';
// const supabase = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_SERVICE_ROLE_KEY
// );

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const signInWithGoogle = async (idToken) => {
  try {
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
    const googleSub = payload.sub; // Google's unique user identifier (numeric string, not UUID)

    console.log('[Auth] Google sign-in attempt for:', email);
    console.log('[Auth] Google sub:', googleSub);

    // 2. Try to find existing user by checking if bio contains the Google sub
    // This is a workaround since we can't change the schema easily
    // In production, you'd want to add a separate 'google_id' field to Profile model
    let existingProfile = await prisma.profile.findFirst({
      where: {
        bio: googleSub, // Using bio field temporarily to store Google sub
      }
    });

    // 3. If user doesn't exist, create a new one
    if (!existingProfile) {
      console.log('[Auth] Creating new profile for user');

      // Generate a proper UUID for user_id (required by schema)
      const userId = randomUUID();

      // Create new profile
      existingProfile = await prisma.profile.create({
        data: {
          user_id: userId, // Use generated UUID
          full_name: payload.name || 'User',
          avatar_url: payload.picture,
          bio: googleSub, // Store Google sub in bio field for lookup (temporary solution)
        },
      });

      console.log('[Auth] Profile created successfully with ID:', existingProfile.id);
    } else {
      console.log('[Auth] Found existing profile:', existingProfile.id);

      // Update existing profile with latest info from Google
      existingProfile = await prisma.profile.update({
        where: { id: existingProfile.id },
        data: {
          full_name: payload.name || existingProfile.full_name,
          avatar_url: payload.picture,
        },
      });

      console.log('[Auth] Profile updated successfully');
    }

    // 4. Generate JWT using our user_id
    const apiToken = jwt.sign(
      {
        id: existingProfile.user_id,
        email: payload.email,
        user_id: existingProfile.user_id // Add user_id to JWT payload
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    console.log('[Auth] JWT generated successfully');

    return { profile: existingProfile, token: apiToken };

  } catch (error) {
    console.error('[Auth] Error in signInWithGoogle:', error);
    throw error;
  }
};


// ===== COMMENTED OUT: OLD SUPABASE IMPLEMENTATION =====
// export const signInWithGoogle = async (idToken) => {
//   // 1. verify token
//   const ticket = await googleClient.verifyIdToken({
//     idToken,
//     audience: process.env.GOOGLE_CLIENT_ID,
//   });
//   const payload = ticket.getPayload();
//   if (!payload || !payload.email || !payload.sub) {
//     throw new Error('Invalid Google token');
//   }
//
//   const email = String(payload.email).trim().toLowerCase();
//
//   // 2. get users page and find by email (listUsers returns { data: { users } })
//   const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
//     // increase page size if you expect many users; keep it reasonable
//     page: 1,
//     perPage: 1000,
//   });
//   if (listError) throw listError;
//
//   const users = listData?.users ?? [];
//   let user = users.find(u => String(u.email ?? '').trim().toLowerCase() === email);
//
//   // 3. if not found, try createUser; handle duplicate email race (422)
//   if (!user) {
//     const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
//       email,
//       email_confirm: true,
//       user_metadata: {
//         full_name: payload.name,
//         avatar_url: payload.picture,
//       },
//     }).catch(async (err) => {
//       // If createUser errored, re-check listUsers in case of race (email was just created)
//       if (err?.status === 422) {
//         const { data: latestListData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
//         const latestUsers = latestListData?.users ?? [];
//         const existing = latestUsers.find(u => String(u.email ?? '').trim().toLowerCase() === email);
//         if (existing) return { data: existing, error: null }; // treat as success
//       }
//       throw err; // rethrow if not handled
//     });
//
//     // normalize returned shape: some endpoints return { user } or { users } — handle both
//     user = (newUserData?.user) ?? (newUserData) ?? null;
//   }
//
//   if (!user?.id) throw new Error('Supabase user ID not found');
//
//   // 4. upsert Prisma profile using user_id (not profile.id)
//   const profile = await prisma.profile.upsert({
//     where: { user_id: user.id }, // ensure `user_id` is unique in your Prisma schema
//     update: {
//       full_name: payload.name,
//       avatar_url: payload.picture,
//     },
//     create: {
//       user_id: user.id,
//       full_name: payload.name,
//       avatar_url: payload.picture,
//     },
//   });
//
//   // 5. generate JWT using Supabase user id
//   const apiToken = jwt.sign(
//     { id: user.id, email: user.email },
//     process.env.JWT_SECRET,
//     { expiresIn: process.env.JWT_EXPIRES_IN }
//   );
//
//   return { profile, token: apiToken };
// };
