import { Router, type Request, type Response, type NextFunction } from 'express';
import { supabaseClient } from '@/lib/supabaseClient';
import { auditEvents } from '../services/auditService';

async function checkAdminStatus(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient.rpc('is_admin', { user_id: userId });
    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
    return data || false;
  } catch (error) {
    console.error('Unexpected error checking admin status:', error);
    return false;
  }
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      roles: Record<string, boolean>;
      isAdmin: boolean;
    }

    interface Request {
      user?: User;
      ip?: string;
    }
  }
}

interface SessionData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user?: {
    id: string;
    email?: string;
  };
}

const router = Router();

// Login endpoint - CSRF is now handled by the centralized middleware
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session) {
      return res.status(401).json({ 
        error: error?.message || 'Authentication failed' 
      });
    }

    const session = data.session as SessionData;
    const userId = session.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not found in session' });
    }

    // Get user roles
    const { data: rolesData } = await supabaseClient.rpc('my_roles');
    const roles = rolesData || {};
    const isAdmin = await checkAdminStatus(userId);

    // Set user on request
    req.user = {
      id: userId,
      email: session.user?.email || '',
      roles,
      isAdmin
    };

    // Set session cookies
    res.cookie('sb-access-token', session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: session.expires_in * 1000,
    });

    res.cookie('sb-refresh-token', session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Log successful login
    try {
      await auditEvents.rateLimitExceeded(
        { userId, ip: req.ip },
        { 
          event_type: 'user_login',
          path: req.path,
          method: req.method,
          attempts: 1,
          backoff: 0,
          retryAfter: 0
        },
        req
      );
    } catch (error) {
      console.error('Error logging login event:', error);
    }

    res.json({
      user: {
        id: userId,
        email: session.user?.email,
        roles,
      },
      // CSRF token is now handled by the centralized middleware
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint - CSRF is now handled by the centralized middleware
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Clear session cookies
    res.clearCookie('sb-access-token');
    res.clearCookie('sb-refresh-token', { path: '/auth/refresh' });
    res.clearCookie('sb-csrf-token');

    // Sign out from Supabase client
    const { error } = await supabaseClient.auth.signOut();
    
    if (error) {
      console.error('Logout error:', error);
      return res.status(500).json({ error: 'Failed to sign out' });
    }

    // Log successful logout
    if (userId) {
      try {
        await auditEvents.rateLimitExceeded(
          { userId, ip: req.ip },
          { 
            event_type: 'user_logout',
            path: req.path,
            method: req.method,
            attempts: 1,
            backoff: 0,
            retryAfter: 0
          },
          req
        );
      } catch (error) {
        console.error('Error logging logout event:', error);
      }
    }

    res.status(200).json({ message: 'Successfully signed out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Email verification endpoint - CSRF is now handled by the centralized middleware
router.post('/verify-email', async (req: Request, res: Response) => {
  // Verify email logic here
  res.status(501).json({ message: 'Not implemented' });
});

// Password reset request endpoint - CSRF is now handled by the centralized middleware
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    // Password reset logic here
    res.status(501).json({ message: 'Not implemented' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Signup endpoint - CSRF is now handled by the centralized middleware
router.post('/signup', async (req: Request, res: Response) => {
  try {
    // Signup logic here
    res.status(501).json({ message: 'Not implemented' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token endpoint with rotation - CSRF is now handled by the centralized middleware
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies['sb-refresh-token'];
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  try {
    const { data, error } = await supabaseClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data?.session) {
      console.error('Refresh token error:', error);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const session = data.session as SessionData;

    // Set new session cookies
    res.cookie('sb-access-token', session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: session.expires_in * 1000,
    });

    res.cookie('sb-refresh-token', session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ 
      message: 'Token refreshed',
      // CSRF token is now handled by the centralized middleware
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error || !user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user roles and permissions
    const [
      { data: roles },
      { data: isAdmin },
    ] = await Promise.all([
      supabaseClient.rpc('my_roles'),
      supabaseClient.rpc('is_admin'),
    ]);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        roles,
        isAdmin,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Generate CSRF token for the session
router.get('/csrf-token', (req: Request, res: Response) => {
  // CSRF token is now handled by the centralized middleware
  res.status(501).json({ message: 'Not implemented' });
});

export default router;
