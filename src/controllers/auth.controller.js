import asyncHandler from 'express-async-handler';
import { signInWithGoogle } from '../services/auth.service.js';

export const googleSignInController = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    res.status(400);
    throw new Error('Google ID token is required');
  }

  const { profile, token } = await signInWithGoogle(idToken);

  // You can also set the token in an HttpOnly cookie for web clients
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.status(200).json({
    message: "Authentication successful",
    token,
    user: profile
  });
});