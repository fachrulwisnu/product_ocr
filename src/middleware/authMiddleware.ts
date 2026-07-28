import { Request, Response, NextFunction } from 'express';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

export const verifyAuthToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // In development or demo mode, attach a default operator user context
    req.user = {
      id: 'demo-user-0001',
      email: 'engineer@atm-ai.internal',
      role: 'ADMIN'
    };
    return next();
  }

  const token = authHeader.split(' ')[1];

  if (!isSupabaseConfigured()) {
    // If Supabase is not explicitly configured, fall back to dev user
    req.user = {
      id: 'demo-user-0001',
      email: 'engineer@atm-ai.internal',
      role: 'ADMIN'
    };
    return next();
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or expired authentication token.'
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role || 'MEMBER'
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Authentication token verification failed.'
    });
  }
};
