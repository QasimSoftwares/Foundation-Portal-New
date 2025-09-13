import { NextRequest, NextResponse } from 'next/server';
// Access control is enforced centrally in src/middleware.ts. No per-route wrappers.

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

export const GET = handler;

export const dynamic = 'force-dynamic';
