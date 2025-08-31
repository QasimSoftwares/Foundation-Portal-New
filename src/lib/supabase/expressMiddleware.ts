import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from './middleware';
import { Request, Response, NextFunction, RequestHandler } from 'express';

export const expressWithAuth = (requiredRole?: string): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Create a mock NextRequest with the minimum required properties
      const nextRequest = {
        ...req,
        headers: new Headers(req.headers as Record<string, string>),
        cookies: {
          get: (name: string) => req.cookies?.[name],
          getAll: () => Object.entries(req.cookies || {}).map(([name, value]) => ({ name, value })),
          set: (name: string, value: string, options: any = {}) => {
            res.cookie(name, value, options);
          },
          delete: (name: string, options: any = {}) => {
            res.clearCookie(name, options);
          },
          has: (name: string) => name in (req.cookies || {})
        },
        url: req.originalUrl || req.url,
        method: req.method,
        json: () => Promise.resolve(req.body),
        text: () => Promise.resolve(JSON.stringify(req.body)),
        nextUrl: new URL(req.originalUrl || '/', 'http://localhost:3000'),
        geo: {},
        ua: {},
        ip: req.ip || (req.socket?.remoteAddress || 'unknown'),
        // Add other required properties with sensible defaults
        // @ts-ignore - Required by NextRequest type
        [Symbol.for('NextRequestMeta')]: {},
        // @ts-ignore - Required by NextRequest type
        [Symbol.for('NextInternalRequestMeta')]: {}
      } as unknown as NextRequest;

      const response = await withAuth(
        async () => NextResponse.next(),
        requiredRole
      )(nextRequest);

      if (response.status === 401 || response.status === 403) {
        return res.status(response.status).json({ 
          error: 'Unauthorized',
          message: response.status === 401 ? 'Authentication required' : 'Insufficient permissions'
        });
      }
      
      // Attach user to request if available
      const user = (nextRequest as any).user;
      if (user) {
        (req as any).user = user;
      }
      
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during authentication'
      });
    }
  };
};

// Convenience middleware for admin-only routes
export const expressRequireAdmin = expressWithAuth('admin');

// Middleware for role-based access control
export const expressRequirePermission = (permission: string): RequestHandler => {
  return expressWithAuth(permission);
};
