import { NextApiRequest, NextApiResponse } from 'next';
import { NextApiHandler } from 'next';
import { withAuth } from '@/lib/supabase/middleware';

const handler: NextApiHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // Your protected route logic here
    return res.status(200).json({ 
      success: true,
      message: 'This is a protected route',
      data: { /* your data */ }
    });
  } catch (error) {
    console.error('Protected route error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'An error occurred while processing your request'
    });
  }
};

// Apply new middleware protection to the handler
export default withAuth(handler as any);
