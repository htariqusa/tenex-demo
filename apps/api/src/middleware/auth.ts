import { Request, Response, NextFunction } from 'express';
import { getSession } from '../services/session.js';
import { AppError } from './error.js';

export interface AuthenticatedRequest extends Request {
  session: {
    id: string;
    userId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
  };
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId = req.cookies?.session_id;

    if (!sessionId) {
      throw new AppError(401, 'Not authenticated', 'UNAUTHORIZED');
    }

    const session = getSession(sessionId);

    if (!session) {
      res.clearCookie('session_id');
      throw new AppError(401, 'Session expired', 'SESSION_EXPIRED');
    }

    (req as AuthenticatedRequest).session = session;
    next();
  } catch (error) {
    next(error);
  }
};
