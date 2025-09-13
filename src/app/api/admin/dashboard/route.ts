import { NextRequest, NextResponse } from 'next/server';
// Access control is enforced centrally in src/middleware.ts. No per-route wrappers.

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

export const GET = handler;

export const dynamic = 'force-dynamic';
