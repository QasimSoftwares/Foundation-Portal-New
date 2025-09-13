import { NextResponse } from 'next/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/lib/utils/logger';

// This API route is protected by the centralized middleware in src/middleware.ts
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    switch (req.method) {
      case 'GET':
        // Your protected GET logic here
        return res.status(200).json({ 
          success: true,
          message: 'This is a protected route',
          data: { /* your data */ }
        });
      
      case 'POST':
      case 'PUT':
      case 'DELETE':
        // Implement other methods as needed
        return res.status(200).json({ 
          success: true,
          message: `Method ${req.method} is supported`,
          data: { /* your data */ }
        });
      
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ 
          error: 'Method not allowed',
          message: `Method ${req.method} is not supported` 
        });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const errorToLog = error instanceof Error 
      ? error 
      : new Error(errorMessage);
    
    logger.error(`[ProtectedRoute] Error: ${errorMessage}`, errorToLog);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'An error occurred while processing your request',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
}
