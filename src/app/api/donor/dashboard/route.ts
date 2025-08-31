import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/middleware';

async function handler(req: NextRequest) {
  return NextResponse.json({
    message: 'Welcome to Donor Dashboard',
    data: {
      donations: [
        { id: 1, amount: 100, date: '2023-06-01', status: 'completed' },
        { id: 2, amount: 50, date: '2023-06-10', status: 'completed' },
      ],
    },
  });
}

export const GET = requirePermission('donor')(handler);

export const dynamic = 'force-dynamic';
