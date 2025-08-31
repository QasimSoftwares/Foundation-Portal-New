import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/middleware';

async function handler(req: NextRequest) {
  return NextResponse.json({
    message: 'Welcome to Volunteer Dashboard',
    data: {
      upcomingEvents: [
        { id: 1, name: 'Food Drive', date: '2023-06-15' },
        { id: 2, name: 'Community Cleanup', date: '2023-06-20' },
      ],
    },
  });
}

export const GET = requirePermission('volunteer')(handler);

export const dynamic = 'force-dynamic';
