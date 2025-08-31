import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/middleware';

async function handler(req: NextRequest) {
  return NextResponse.json({
    message: 'Welcome to Admin Dashboard',
    data: {
      stats: {
        totalUsers: 150,
        activeUsers: 120,
        totalDonations: 5000,
      },
    },
  });
}

export const GET = requireAdmin(handler);

export const dynamic = 'force-dynamic';
