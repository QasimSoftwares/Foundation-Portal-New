import { NextResponse } from 'next/server';

// Placeholder for email change handler
// TODO: Implement actual email change logic with Supabase Auth and
// revoke all sessions/tokens for the user on success.

export async function POST() {
  return NextResponse.json({ error: 'Not Implemented', message: 'Email change route pending implementation' }, { status: 501 });
}
