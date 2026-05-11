import { Router } from 'express';
import {
  getAuthUrl,
  exchangeCodeForTokens,
  getUserInfo,
} from '../services/google-auth.js';
import { createSession, deleteSession, getSession } from '../services/session.js';
import { AppError } from '../middleware/error.js';

export const authRouter = Router();

// Initiate OAuth flow
authRouter.get('/login', (_req, res) => {
  const authUrl = getAuthUrl();
  res.redirect(authUrl);
});

// OAuth callback
authRouter.get('/callback', async (req, res, next) => {
  try {
    const { code, error } = req.query;

    console.log('[Auth] Callback received, code present:', !!code);

    if (error) {
      throw new AppError(400, `OAuth error: ${error}`, 'OAUTH_ERROR');
    }

    if (!code || typeof code !== 'string') {
      throw new AppError(400, 'Missing authorization code', 'MISSING_CODE');
    }

    // Exchange code for tokens
    console.log('[Auth] Exchanging code for tokens...');
    const tokens = await exchangeCodeForTokens(code);
    console.log('[Auth] Got tokens, access_token:', !!tokens.access_token, 'refresh_token:', !!tokens.refresh_token);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new AppError(500, 'Failed to get tokens', 'TOKEN_ERROR');
    }

    // Get user info
    console.log('[Auth] Getting user info...');
    const userInfo = await getUserInfo(tokens.access_token);
    console.log('[Auth] User:', userInfo.email);

    // Create session
    console.log('[Auth] Creating session...');
    const sessionId = createSession({
      userId: userInfo.id,
      email: userInfo.email,
      name: userInfo.name || undefined,
      picture: userInfo.picture || undefined,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });
    console.log('[Auth] Session created:', sessionId);

    // Set secure cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    console.log('[Auth] Cookie set, redirecting to:', process.env.CLIENT_URL);

    // Redirect to client
    res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
  } catch (error) {
    console.error('[Auth] Error:', error);
    next(error);
  }
});

// Get current user
authRouter.get('/me', async (req, res, next) => {
  try {
    const sessionId = req.cookies?.session_id;
    console.log('[Auth] /me called, sessionId:', sessionId ? 'present' : 'missing');

    if (!sessionId) {
      res.json({ user: null });
      return;
    }

    const session = getSession(sessionId);
    console.log('[Auth] Session found:', !!session);

    if (!session) {
      res.clearCookie('session_id');
      res.json({ user: null });
      return;
    }

    res.json({
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        picture: session.picture,
      },
    });
  } catch (error) {
    console.error('[Auth] /me error:', error);
    next(error);
  }
});

// Logout
authRouter.post('/logout', (req, res) => {
  const sessionId = req.cookies?.session_id;

  if (sessionId) {
    deleteSession(sessionId);
    res.clearCookie('session_id');
  }

  res.json({ success: true });
});
